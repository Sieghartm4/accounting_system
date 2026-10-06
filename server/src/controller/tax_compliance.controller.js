const { Query, Insert, Update } = require('../database/util/queries.util')
const { TaxCompliance } = require('../schemas/tax-compliance.schema')
const { Accounting } = require('../database/model/Accounting')
const { Master } = require('../database/model/Master')
const { SQLQueryBuilder } = require('../util/helper.util')
const PDFDocument = require('pdfkit')
const { Readable } = require('stream')

const sql = new SQLQueryBuilder()

/**
 * Resolve the company this request is acting for, from the tenant's records.
 *
 * `req.company` is never populated by the auth middleware, so the old
 * `req.company?.id || 1` always evaluated to company 1. Every draft this
 * controller saved, and every export it printed, carried company 1's identity
 * regardless of which tenant was logged in. That is why this resolves from
 * `master_company` and refuses when it cannot.
 *
 * A tenant with exactly one company does not have to send an id, which keeps
 * the current client working. A tenant with several must say which one: there
 * is no safe guess.
 */
const resolveTenantCompany = async (req) => {
  const explicit = (req.body && req.body.companyId) || (req.query && req.query.companyId) || null

  if (explicit) {
    const rows = await Query(
      `SELECT mc_company_id, mc_company_name, mc_tin
         FROM master_company
        WHERE mc_company_id = ?
        LIMIT 1`,
      [Number(explicit)],
    )
    if (!rows || rows.length === 0) return null
    return rows[0]
  }

  const all = await Query(
    `SELECT mc_company_id, mc_company_name, mc_tin
       FROM master_company
      ORDER BY mc_company_id`,
    [],
  )
  if (!all || all.length !== 1) return null
  return all[0]
}

/**
 * The acting user.
 *
 * `tf_user_id` is NOT NULL and the default API token carries no user id, so
 * there is nothing truthful to write. This fails closed rather than recording
 * the work against user 1, who did not do it.
 */
const requireActorId = (req) => {
  const ctx = req.context || {}
  const userId = ctx.userId
  if (userId === null || userId === undefined) {
    const error = new Error(
      'This endpoint needs a signed-in user. The default API token carries no user id, so there is no user to record against.',
    )
    error.status = 401
    throw error
  }
  return Number(userId)
}

/** Escape the five XML entities. Names legitimately contain & and '. */
const xmlEscape = (value) =>
  String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

/**
 * Format a TIN for an export.
 *
 * A Philippine TIN is nine digits, optionally followed by an RDO branch
 * suffix, commonly five. It is written 9-3 in the XML header and 9-5 in the
 * SAWT DAT file. A nine-digit TIN with no branch is left nine digits: padding
 * it out with zeros would invent an RDO code the filer never had.
 */
const formatTin = (tin) => {
  const digits = String(tin === null || tin === undefined ? '' : tin).replace(/[^0-9]/g, '')
  if (digits.length < 9) return null
  const head = digits.slice(0, 9)
  const suffix = digits.slice(9)
  return { head, head3: `${head.slice(0, 3)}-${head.slice(3, 6)}-${head.slice(6, 9)}`, suffix }
}

const tinForXml = (tin) => {
  const t = formatTin(tin)
  if (!t) return null
  return t.suffix ? `${t.head3}-${t.suffix}` : t.head3
}

const tinForDat = (tin) => {
  const t = formatTin(tin)
  if (!t) return null
  return t.suffix ? `${t.head}-${t.suffix}` : t.head
}

// Save Tax Form Draft
const saveTaxFormDraft = async (req, res, next) => {
  try {
    const { formType, dateRange, formRows, editedValues } = req.body

    if (!formType || !dateRange || !formRows) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: formType, dateRange, formRows',
      })
    }

    // Resolved, not defaulted. `req.user` and `req.company` are never populated
    // by the auth middleware, so the previous `|| 1` silently filed every
    // tenant's drafts under company 1 and user 1.
    const userId = requireActorId(req)
    const company = await resolveTenantCompany(req)
    if (!company) {
      return res.status(400).json({
        success: false,
        message:
          'Cannot identify the filing company. Send companyId, or use an account with exactly one company.',
      })
    }
    const companyId = company.mc_company_id

    const formData = {
      formType,
      formRows,
      editedValues,
      savedAt: new Date().toISOString(),
      status: 'draft',
    }

    // Check if draft already exists for this period
    const existingQuery = `
      SELECT ${TaxCompliance.tax_forms.selectOptionColumns.id} 
      FROM ${TaxCompliance.tax_forms.tablename}
      WHERE tf_form_type = ? 
        AND tf_company_id = ? 
        AND tf_start_date = ? 
        AND tf_end_date = ?
      LIMIT 1
    `

    const existingRows = await Query(
      existingQuery,
      [formType, companyId, dateRange.start, dateRange.end],
      TaxCompliance.tax_forms.prefix_,
    )

    let result
    if (existingRows && existingRows.length > 0) {
      // Update existing draft
      const updateQuery = `
        UPDATE ${TaxCompliance.tax_forms.tablename}
        SET tf_form_data = ?,
            tf_status = 'draft',
            tf_updated_at = NOW()
        WHERE tf_id = ?
      `
      await Query(
        updateQuery,
        [JSON.stringify(formData), existingRows[0].tf_id],
        TaxCompliance.tax_forms.prefix_,
      )
      result = { id: existingRows[0].tf_id, isNew: false }
    } else {
      // Create new draft
      const insertQuery = `
        INSERT INTO ${TaxCompliance.tax_forms.tablename}
        (tf_form_type, tf_user_id, tf_company_id, tf_start_date, tf_end_date, tf_form_data, tf_status)
        VALUES (?, ?, ?, ?, ?, ?, 'draft')
      `
      const insertResult = await Query(
        insertQuery,
        [
          formType,
          userId,
          companyId,
          dateRange.start,
          dateRange.end,
          JSON.stringify(formData),
        ],
        TaxCompliance.tax_forms.prefix_,
      )
      result = { id: insertResult.insertId, isNew: true }
    }

    return res.status(200).json({
      success: true,
      message: 'Tax form draft saved successfully',
      ...result,
    })
  } catch (error) {
    console.error('Error saving tax form draft:', error)
    // An identity failure is a 401/400, not a server fault. Reporting it as a
    // 500 would tell the caller to retry something that will never succeed.
    const status = error.status || 500
    return res.status(status).json({
      success: false,
      message:
        status === 500
          ? 'Failed to save tax form draft'
          : error.message,
      error: error.message,
    })
  }
}

// Export to PDF
const exportTaxFormPDF = async (req, res, next) => {
  try {
    const { formType, dateRange, formRows } = req.body

    if (!formType || !dateRange || !formRows) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      })
    }

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true,
    })

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="BIR_Form_${formType}_${dateRange.start}.pdf"`,
    )

    // Pipe to response
    doc.pipe(res)

    // PDF Content
    doc.fontSize(10).font('Helvetica-Bold')
    doc.text('Republika ng Pilipinas', { align: 'center' })
    doc.text('Kagawaran ng Pananalapi', { align: 'center' })
    doc.text('Kawanihan ng Rentas Internas', { align: 'center' })

    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(`BIR FORM ${formType}`, { align: 'center' })

    const formTitles = {
      '2550M': 'Monthly Value-Added Tax Declaration',
      '0619E': 'Monthly Remittance Return of Creditable Income Taxes Withheld',
      2307: 'Certificate of Creditable Tax Withheld at Source',
      '1601EQ': 'Quarterly Remittance Return of Creditable Taxes Withheld',
    }

    doc
      .fontSize(11)
      .font('Helvetica')
      .text(formTitles[formType] || '', { align: 'center' })
    doc.moveDown()

    // Taxpayer Info
    doc.fontSize(9).font('Helvetica-Bold').text('Taxpayer Information:', { align: 'left' })
    doc.fontSize(8).font('Helvetica')
    // The identity on a filed return comes from the tenant's records, not from
    // the request body. A client could otherwise print a 2550M bearing another
    // company's TIN.
    const filingCompany = await resolveTenantCompany(req)
    if (filingCompany) {
      doc.text(`TIN: ${filingCompany.mc_tin || 'Not on file'}`)
      doc.text(`Company: ${filingCompany.mc_company_name || 'Not on file'}`)
    } else {
      // Stated plainly rather than filled with a plausible-looking value, so a
      // printed return cannot be mistaken for one that can actually be filed.
      doc
        .fillColor('#b00020')
        .text('TIN: NOT ON FILE - choose the filing company before submitting')
        .fillColor('#000')
    }
    doc.text(`Period: ${dateRange.start} to ${dateRange.end}`)
    doc.moveDown()

    // Table Header
    doc.fontSize(9).font('Helvetica-Bold')
    const tableTop = doc.y
    const col1 = 50
    const col2 = 300
    const col3 = 500

    doc.text('Line Item Description', col1, tableTop)
    doc.text('Taxable Gross Base', col2, tableTop, { width: 180, align: 'right' })
    doc.text('Tax / Remittance Due', col3, tableTop, { width: 60, align: 'right' })

    // Table Rows
    doc
      .moveTo(50, tableTop + 20)
      .lineTo(550, tableTop + 20)
      .stroke()
    let currentY = tableTop + 30

    doc.fontSize(8).font('Helvetica')
    formRows.forEach((row, idx) => {
      const description = row[0]
      const baseAmount =
        row[1] !== null
          ? `₱${(row[1] || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : '—'
      const taxAmount = `₱${(row[2] || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

      doc.text(description, col1, currentY, { width: 230, height: 50 })
      doc.text(baseAmount, col2, currentY, { width: 180, align: 'right' })
      doc.text(taxAmount, col3, currentY, { width: 60, align: 'right' })

      currentY += 40
    })

    // Signature area
    doc
      .moveTo(50, currentY + 20)
      .lineTo(550, currentY + 20)
      .stroke()
    currentY += 40
    doc.fontSize(8).font('Helvetica')
    doc.text(
      'Authorized Officer / Representative Signature: _______________________',
      col1,
      currentY,
    )
    currentY += 20
    doc.text('Date Filed: _______________________', col1, currentY)

    // Footer
    currentY += 40
    doc
      .fontSize(7)
      .font('Helvetica')
      .text(
        'This is a system-generated document for tax compliance purposes.',
        50,
        currentY,
        { align: 'center' },
      )

    // Finalize PDF
    doc.end()
  } catch (error) {
    console.error('Error exporting PDF:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to export PDF',
      error: error.message,
    })
  }
}

// Export to DAT (SAWT Format)
const exportTaxFormDAT = async (req, res, next) => {
  try {
    const { formType, dateRange, formRows } = req.body

    if (!formType || !dateRange || !formRows) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      })
    }

    // Generate DAT file content (SAWT format)
    const companyRow = await resolveTenantCompany(req)
    const datTin = tinForDat(companyRow && companyRow.mc_tin)
    if (!datTin) {
      return res.status(400).json({
        success: false,
        message:
          'Cannot export: no TIN on file for the filing company, or this account has more than one company and did not say which.',
      })
    }

    let datContent = ''

    // Header
    datContent += '001|' // Record Type = Header
    datContent += datTin + '|' // TIN
    datContent += (companyRow.mc_company_name || '') + '|' // Company Name
    datContent += '1|' // Form Type (1 for 2550M, etc.)
    datContent += dateRange.start + '|' // Period Start
    datContent += dateRange.end + '|' // Period End
    datContent += formRows.length + '|' // Number of detail records
    datContent += new Date().toISOString() + '\r\n' // Submission Date

    // Detail records
    formRows.forEach((row, idx) => {
      datContent += '002|' // Record Type = Detail
      datContent += idx + 1 + '|' // Line Number
      datContent += row[0] + '|' // Description
      datContent += (row[1] || 0) + '|' // Base Amount
      datContent += (row[2] || 0) + '|' // Tax Amount
      datContent += '\r\n'
    })

    // Trailer
    const totalAmount = formRows.reduce((sum, row) => sum + (row[2] || 0), 0)
    datContent += '003|' // Record Type = Trailer
    datContent += formRows.length + '|' // Total detail records
    datContent += totalAmount.toFixed(2) + '|' // Total tax amount
    datContent += new Date().toISOString() + '\r\n' // Generated Date

    // Send as downloadable file
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="SAWT_${formType}_${dateRange.start}.dat"`,
    )
    res.send(Buffer.from(datContent, 'utf-8'))
  } catch (error) {
    console.error('Error exporting DAT:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to export DAT file',
      error: error.message,
    })
  }
}

// Export to XML
const exportTaxFormXML = async (req, res, next) => {
  try {
    const { formType, dateRange, formRows } = req.body

    if (!formType || !dateRange || !formRows) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      })
    }

    // Generate XML content
    const companyRow = await resolveTenantCompany(req)
    const xmlTin = tinForXml(companyRow && companyRow.mc_tin)
    if (!xmlTin) {
      return res.status(400).json({
        success: false,
        message:
          'Cannot export: no TIN on file for the filing company, or this account has more than one company and did not say which.',
      })
    }

    let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\r\n'
    xmlContent += '<BIRTaxReturn>\r\n'
    xmlContent += '  <Header>\r\n'
    xmlContent += `    <TIN>${xmlTin}</TIN>\r\n`
    xmlContent += `    <Company>${xmlEscape(companyRow.mc_company_name)}</Company>\r\n`
    xmlContent += `    <FormType>${formType}</FormType>\r\n`
    xmlContent += `    <PeriodStart>${dateRange.start}</PeriodStart>\r\n`
    xmlContent += `    <PeriodEnd>${dateRange.end}</PeriodEnd>\r\n`
    xmlContent += `    <GeneratedDate>${new Date().toISOString()}</GeneratedDate>\r\n`
    xmlContent += '  </Header>\r\n'
    xmlContent += '  <Details>\r\n'

    formRows.forEach((row, idx) => {
      xmlContent += '    <Row>\r\n'
      xmlContent += `      <LineNumber>${idx + 1}</LineNumber>\r\n`
      // Descriptions carry account and payee names, so they routinely contain
      // & and '. Unescaped they produce a file the BIR parser rejects.
      xmlContent += `      <Description>${xmlEscape(row[0])}</Description>\r\n`
      xmlContent += `      <BaseAmount>${row[1] || 0}</BaseAmount>\r\n`
      xmlContent += `      <TaxAmount>${row[2] || 0}</TaxAmount>\r\n`
      xmlContent += '    </Row>\r\n'
    })

    xmlContent += '  </Details>\r\n'
    xmlContent += '</BIRTaxReturn>'

    res.setHeader('Content-Type', 'application/xml')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="BIR_Form_${formType}_${dateRange.start}.xml"`,
    )
    res.send(Buffer.from(xmlContent, 'utf-8'))
  } catch (error) {
    console.error('Error exporting XML:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to export XML file',
      error: error.message,
    })
  }
}

// Mark Tax Form as Filed
const markTaxFormFiled = async (req, res, next) => {
  try {
    const { formType, dateRange, draftId } = req.body

    if (!formType || !dateRange) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: formType, dateRange',
      })
    }

    const company = await resolveTenantCompany(req)
    if (!company) {
      return res.status(400).json({
        success: false,
        message:
          'Cannot identify the filing company. Send companyId, or use an account with exactly one company.',
      })
    }
    const companyId = company.mc_company_id

    let updateQuery
    let params

    if (draftId) {
      // Scoped by company. Without this, a caller who guessed or reused a
      // draft id could mark another company's return as filed.
      updateQuery = `
        UPDATE ${TaxCompliance.tax_forms.tablename}
        SET tf_status = 'filed_with_bir',
            tf_updated_at = NOW()
        WHERE tf_id = ? AND tf_form_type = ? AND tf_company_id = ?
      `
      params = [draftId, formType, companyId]
    } else {
      // Update latest draft for the period
      updateQuery = `
        UPDATE ${TaxCompliance.tax_forms.tablename}
        SET tf_status = 'filed_with_bir',
            tf_updated_at = NOW()
        WHERE tf_form_type = ? 
          AND tf_company_id = ? 
          AND tf_start_date = ? 
          AND tf_end_date = ?
      `
      params = [formType, companyId, dateRange.start, dateRange.end]
    }

    await Query(updateQuery, params, TaxCompliance.tax_forms.prefix_)

    return res.status(200).json({
      success: true,
      message: `BIR Form ${formType} marked as FILED with BIR`,
    })
  } catch (error) {
    console.error('Error marking form as filed:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to mark form as filed',
      error: error.message,
    })
  }
}

// Get Tax Form Draft
const getTaxFormDraft = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Draft ID is required',
      })
    }

    const query = `
      SELECT * FROM ${TaxCompliance.tax_forms.tablename}
      WHERE tf_id = ?
    `

    const rows = await Query(query, [id], TaxCompliance.tax_forms.prefix_)

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tax form draft not found',
      })
    }

    const draft = rows[0]
    return res.status(200).json({
      success: true,
      data: {
        ...draft,
        form_data: JSON.parse(draft.tf_form_data),
      },
    })
  } catch (error) {
    console.error('Error retrieving tax form draft:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve tax form draft',
      error: error.message,
    })
  }
}

// Calculate Tax Data from Journal Entries
const calculateTaxFromJournalEntries = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required query parameters: start_date, end_date',
      })
    }

    // Match dashboard/report behavior: only posted journals from approved
    // source documents are eligible for tax calculations and filings.
    const approvedJournalFilter = `
      AND (
        (je.je_db_name = 'receipts' AND EXISTS (
          SELECT 1 FROM receipts r
          WHERE r.r_id = je.je_db_id AND r.r_state = 'APPROVED'
        ))
        OR (je.je_db_name = 'cash_disbursements' AND EXISTS (
          SELECT 1 FROM cash_disbursements cd
          WHERE cd.cd_id = je.je_db_id AND cd.cd_state = 'APPROVED'
        ))
        OR (je.je_db_name = 'sales' AND EXISTS (
          SELECT 1 FROM sales s
          WHERE s.s_id = je.je_db_id AND s.s_state = 'APPROVED'
        ))
        OR (je.je_db_name = 'collections' AND EXISTS (
          SELECT 1 FROM collections c
          WHERE c.c_id = je.je_db_id AND c.c_state = 'APPROVED'
        ))
        OR (je.je_db_name = 'purchase' AND EXISTS (
          SELECT 1 FROM purchase p
          WHERE p.p_id = je.je_db_id AND p.p_state = 'APPROVED'
        ))
        OR (je.je_db_name = 'payments' AND EXISTS (
          SELECT 1 FROM payments pay
          WHERE pay.c_id = je.je_db_id AND pay.c_state = 'APPROVED'
        ))
        OR (je.je_db_name = 'adjustments' AND EXISTS (
          SELECT 1 FROM adjustments a
          WHERE a.a_id = je.je_db_id AND a.a_status = 'APPROVED'
        ))
      )
    `

    // Query Output VAT (CREDIT balance from Output VAT account)
    const outputVATQuery = `
      SELECT 
        SUM(CASE WHEN je.je_type = 'CREDIT'
                 THEN je.je_amount
                 ELSE -je.je_amount END) AS outputVAT
      FROM journal_entries je
      INNER JOIN charts_of_accounts coa
        ON je.je_coa_id = coa.coa_id
      WHERE coa.coa_name = 'Output VAT'
      AND je.je_db_id IS NOT NULL
      AND je.je_coa_id IS NOT NULL
      AND DATE(je.je_date) >= ?
      AND DATE(je.je_date) <= ?
      ${approvedJournalFilter}
    `

    const outputVATResult = await Query(outputVATQuery, [start_date, end_date])
    const outputVAT = parseFloat(outputVATResult[0]?.outputVAT || 0)

    // Query Input VAT (DEBIT balance from Input VAT account)
    const inputVATQuery = `
      SELECT 
        SUM(CASE WHEN je.je_type = 'DEBIT'
                 THEN je.je_amount
                 ELSE -je.je_amount END) AS inputVAT
      FROM journal_entries je
      INNER JOIN charts_of_accounts coa
        ON je.je_coa_id = coa.coa_id
      WHERE coa.coa_name = 'Input VAT'
      AND je.je_db_id IS NOT NULL
      AND je.je_coa_id IS NOT NULL
      AND DATE(je.je_date) >= ?
      AND DATE(je.je_date) <= ?
      ${approvedJournalFilter}
    `

    const inputVATResult = await Query(inputVATQuery, [start_date, end_date])
    const inputVAT = parseFloat(inputVATResult[0]?.inputVAT || 0)

    // Query Withholding Tax - Expanded (liability - CREDIT balance)
    const wtExpandedQuery = `
      SELECT 
        SUM(CASE WHEN je.je_type = 'CREDIT'
                 THEN je.je_amount
                 ELSE -je.je_amount END) AS wtExpanded
      FROM journal_entries je
      INNER JOIN charts_of_accounts coa
        ON je.je_coa_id = coa.coa_id
      WHERE coa.coa_name = 'Withholding Tax - Expanded'
      AND je.je_db_id IS NOT NULL
      AND je.je_coa_id IS NOT NULL
      AND DATE(je.je_date) >= ?
      AND DATE(je.je_date) <= ?
      ${approvedJournalFilter}
    `

    const wtExpandedResult = await Query(wtExpandedQuery, [start_date, end_date])
    const wtExpanded = parseFloat(wtExpandedResult[0]?.wtExpanded || 0)

    // Query Creditable Withholding Tax (asset - DEBIT balance)
    const wtCreditableQuery = `
      SELECT 
        SUM(CASE WHEN je.je_type = 'DEBIT'
                 THEN je.je_amount
                 ELSE -je.je_amount END) AS wtCreditable
      FROM journal_entries je
      INNER JOIN charts_of_accounts coa
        ON je.je_coa_id = coa.coa_id
      WHERE coa.coa_name = 'Creditable Withholding Tax'
      AND je.je_db_id IS NOT NULL
      AND je.je_coa_id IS NOT NULL
      AND DATE(je.je_date) >= ?
      AND DATE(je.je_date) <= ?
      ${approvedJournalFilter}
    `

    const wtCreditableResult = await Query(wtCreditableQuery, [start_date, end_date])
    const wtCreditable = parseFloat(wtCreditableResult[0]?.wtCreditable || 0)

    const journalEntriesQuery = `
      SELECT
        je.je_id AS id,
        je.je_db_name AS dbName,
        je.je_db_id AS dbId,
        je.je_type AS type,
        je.je_amount AS amount,
        je.je_date AS date,
        coa.coa_id AS coaId,
        coa.coa_code AS coaCode,
        coa.coa_name AS coaName,
        coa.coa_type AS coaType,
        CONCAT(je.je_db_name, ':', je.je_db_id) AS voucherId,
        COALESCE(
          (SELECT wt.wt_code FROM purchase_items pi
           INNER JOIN withholding_tax wt ON wt.wt_id = pi.pi_witholding_tax
           WHERE je.je_db_name = 'purchase' AND pi.pi_purchase_id = je.je_db_id
           LIMIT 1),
          (SELECT wt.wt_code FROM cash_disbursement_items cdi
           INNER JOIN withholding_tax wt ON wt.wt_id = cdi.cdi_witholding_tax
           WHERE je.je_db_name = 'cash_disbursements' AND cdi.cdi_cash_disbursement_id = je.je_db_id
           LIMIT 1),
          (SELECT wt.wt_code FROM sales_items si
           INNER JOIN withholding_tax wt ON wt.wt_id = si.si_witholding_tax
           WHERE je.je_db_name = 'sales' AND si.si_sales_id = je.je_db_id
           LIMIT 1),
          (SELECT wt.wt_code FROM receipt_items ri
           INNER JOIN withholding_tax wt ON wt.wt_id = ri.ri_witholding_tax
           WHERE je.je_db_name = 'receipts' AND ri.ri_receipts_id = je.je_db_id
           LIMIT 1),
          (SELECT wt.wt_code
           FROM payment_items payi
           INNER JOIN purchase_items pi ON pi.pi_purchase_id = payi.ci_purchase_id
           INNER JOIN withholding_tax wt ON wt.wt_id = pi.pi_witholding_tax
           WHERE je.je_db_name = 'payments' AND payi.ci_payment_id = je.je_db_id
           LIMIT 1)
        ) AS atc,
        COALESCE(
          (SELECT wt.wt_rate FROM purchase_items pi
           INNER JOIN withholding_tax wt ON wt.wt_id = pi.pi_witholding_tax
           WHERE je.je_db_name = 'purchase' AND pi.pi_purchase_id = je.je_db_id
           LIMIT 1),
          (SELECT wt.wt_rate FROM cash_disbursement_items cdi
           INNER JOIN withholding_tax wt ON wt.wt_id = cdi.cdi_witholding_tax
           WHERE je.je_db_name = 'cash_disbursements' AND cdi.cdi_cash_disbursement_id = je.je_db_id
           LIMIT 1),
          (SELECT wt.wt_rate FROM sales_items si
           INNER JOIN withholding_tax wt ON wt.wt_id = si.si_witholding_tax
           WHERE je.je_db_name = 'sales' AND si.si_sales_id = je.je_db_id
           LIMIT 1),
          (SELECT wt.wt_rate FROM receipt_items ri
           INNER JOIN withholding_tax wt ON wt.wt_id = ri.ri_witholding_tax
           WHERE je.je_db_name = 'receipts' AND ri.ri_receipts_id = je.je_db_id
           LIMIT 1),
          (SELECT wt.wt_rate
           FROM payment_items payi
           INNER JOIN purchase_items pi ON pi.pi_purchase_id = payi.ci_purchase_id
           INNER JOIN withholding_tax wt ON wt.wt_id = pi.pi_witholding_tax
           WHERE je.je_db_name = 'payments' AND payi.ci_payment_id = je.je_db_id
           LIMIT 1)
        ) AS withholdingRate,
        CASE
          WHEN je.je_db_name = 'receipts' THEN r.r_document_reference
          WHEN je.je_db_name = 'cash_disbursements' THEN cd.cd_document_reference
          WHEN je.je_db_name = 'sales' THEN s.s_document_reference
          WHEN je.je_db_name = 'collections' THEN c.c_document_reference
          WHEN je.je_db_name = 'purchase' THEN p.p_document_reference
          WHEN je.je_db_name = 'payments' THEN pay.c_document_reference
          WHEN je.je_db_name = 'adjustments' THEN a.a_document_reference
          ELSE NULL
        END AS referenceNo,
        CASE
          WHEN je.je_db_name IN ('receipts', 'sales', 'collections') THEN cust.c_name
          WHEN je.je_db_name IN ('cash_disbursements', 'purchase', 'payments') THEN vend.v_name
          ELSE NULL
        END AS payeeName,
        CASE
          WHEN je.je_db_name IN ('receipts', 'sales', 'collections') THEN ci.ci_tin
          WHEN je.je_db_name IN ('cash_disbursements', 'purchase', 'payments') THEN vi.vi_tin
          ELSE NULL
        END AS payeeTin
      FROM journal_entries je
      INNER JOIN charts_of_accounts coa ON je.je_coa_id = coa.coa_id
      LEFT JOIN receipts r
        ON je.je_db_name = 'receipts' AND r.r_id = je.je_db_id
      LEFT JOIN cash_disbursements cd
        ON je.je_db_name = 'cash_disbursements' AND cd.cd_id = je.je_db_id
      LEFT JOIN sales s
        ON je.je_db_name = 'sales' AND s.s_id = je.je_db_id
      LEFT JOIN collections c
        ON je.je_db_name = 'collections' AND c.c_id = je.je_db_id
      LEFT JOIN purchase p
        ON je.je_db_name = 'purchase' AND p.p_id = je.je_db_id
      LEFT JOIN payments pay
        ON je.je_db_name = 'payments' AND pay.c_id = je.je_db_id
      LEFT JOIN adjustments a
        ON je.je_db_name = 'adjustments' AND a.a_id = je.je_db_id
      LEFT JOIN customers cust
        ON (je.je_db_name = 'receipts' AND cust.c_id = r.r_customer_id)
        OR (je.je_db_name = 'sales' AND cust.c_id = s.s_customer_id)
        OR (je.je_db_name = 'collections' AND cust.c_id = c.c_customer_id)
      LEFT JOIN vendors vend
        ON (je.je_db_name = 'cash_disbursements' AND vend.v_id = cd.cd_vendor_id)
        OR (je.je_db_name = 'purchase' AND vend.v_id = p.p_vendor_id)
        OR (je.je_db_name = 'payments' AND vend.v_id = pay.c_vendor_id)
      LEFT JOIN customers_information ci ON ci.ci_customer_id = cust.c_id
      LEFT JOIN vendors_information vi ON vi.vi_vendor_id = vend.v_id
      WHERE je.je_db_id IS NOT NULL
        AND je.je_coa_id IS NOT NULL
        AND DATE(je.je_date) >= ?
        AND DATE(je.je_date) <= ?
        ${approvedJournalFilter}
      ORDER BY je.je_date ASC, je.je_id ASC
    `
    const journalEntries = await Query(journalEntriesQuery, [start_date, end_date])

    // Credit balances on liability accounts are positive amounts payable.
    const netVATPayable = outputVAT - inputVAT

    return res.status(200).json({
      success: true,
      data: {
        tax: {
          outputVAT: Math.max(0, outputVAT), // Ensure non-negative
          inputVAT: Math.max(0, inputVAT),
          netVATPayable: netVATPayable,
          wtExpanded: Math.max(0, wtExpanded),
          wtCreditable: Math.max(0, wtCreditable),
        },
        journalEntries,
      },
    })
  } catch (error) {
    console.error('Error calculating tax from journal entries:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate tax data',
      error: error.message,
    })
  }
}

module.exports = {
  saveTaxFormDraft,
  exportTaxFormPDF,
  exportTaxFormDAT,
  exportTaxFormXML,
  markTaxFormFiled,
  getTaxFormDraft,
  calculateTaxFromJournalEntries,
}

