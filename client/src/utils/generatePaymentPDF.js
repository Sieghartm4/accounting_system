// generatePaymentPDF.js
// Place this in: src/utils/generatePaymentPDF.js
// Install deps: npm install jspdf jspdf-autotable

export async function generatePaymentPDF(paymentData, copyType = 'internal') {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const payments = Array.isArray(paymentData) ? paymentData : [paymentData]

  // Helper to format TIN with hyphens (000-000-000-000-000)
  const formatTin = (tin) => {
    if (!tin) return '000-000-000-0000'
    const digits = String(tin).replace(/\D/g, '').slice(0, 14)
    if (digits.length === 0) return '000-000-000-0000'
    const parts = []
    // 3-3-3-5 format
    parts.push(digits.slice(0, 3))
    if (digits.length > 3) parts.push(digits.slice(3, 6))
    if (digits.length > 6) parts.push(digits.slice(6, 9))
    if (digits.length > 9) parts.push(digits.slice(9, 14))
    return parts.join('-')
  }

  // Debug logging
  console.log('[PDF Generator] Received payments:', payments)

  for (let idx = 0; idx < payments.length; idx++) {
    const payment = payments[idx]

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const margin = 42
    const contentW = pageW - margin * 2

    // ── COLOUR PALETTE
    const RED = [176, 0, 32]
    const BLACK = [0, 0, 0]
    const WHITE = [255, 255, 255]
    const MGRAY = [110, 110, 110]
    const HAIRLINE = [215, 215, 215]

    const copyLabel = copyType === 'customer' ? 'VENDOR COPY' : 'INTERNAL COPY'
    const company = payment.company || {}

    // ── LETTERHEAD BAND (Full bleed red band across the top)
    const BAND_H = 46
    doc.setFillColor(...RED)
    doc.rect(0, 0, pageW, BAND_H, 'F')

    const LOGO_W = 32
    const LOGO_H = 32
    const logoX = margin
    const logoY = (BAND_H - LOGO_H) / 2

    if (company.logo) {
      try {
        // white plate behind the logo so it stands out elegantly on the red band
        doc.setFillColor(...WHITE)
        doc.roundedRect(logoX - 3, logoY - 3, LOGO_W + 6, LOGO_H + 6, 2, 2, 'F')
        const fmt = company.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG'
        doc.addImage(company.logo, fmt, logoX, logoY, LOGO_W, LOGO_H)
      } catch (e) {
        console.warn('[PDF] Logo render failed:', e.message)
      }
    }

    const compTextX = company.logo ? logoX + LOGO_W + 14 : margin

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...WHITE)
    doc.text(company.company_name || '', compTextX, BAND_H / 2 - 2)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(245, 220, 220)
    const contactLine = [company.phone, company.email]
      .filter(Boolean)
      .join('   |   ')
    if (contactLine) doc.text(contactLine, compTextX, BAND_H / 2 + 9)

    const tinWebLine = [
      company.tin ? 'TIN ' + company.tin : null,
      company.website ? company.website : null,
    ]
      .filter(Boolean)
      .join('   |   ')
    if (tinWebLine) doc.text(tinWebLine, compTextX, BAND_H / 2 + 18)

    // Title block — right side of the band
    const titleRightX = pageW - margin

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...WHITE)
    doc.text('PAYMENT VOUCHER', titleRightX, BAND_H / 2 - 3, { align: 'right' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(245, 220, 220)
    doc.text(copyLabel, titleRightX, BAND_H / 2 + 9, { align: 'right' })

    let y = BAND_H + 24

    // Payment ID number chip — centered beneath the header band
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...BLACK)
    const noText = 'No. ' + (payment.id ?? '')
    const noW = doc.getTextWidth(noText) + 16
    const centerX = pageW / 2
    doc.setDrawColor(...BLACK)
    doc.setLineWidth(0.75)
    doc.rect(centerX - noW / 2, y - 20, noW, 16, 'S')
    doc.text(noText, centerX, y - 9, { align: 'center' })

    // ── DIVIDER
    doc.setDrawColor(...BLACK)
    doc.setLineWidth(0.75)
    doc.line(margin, y, pageW - margin, y)
    y += 16

    // ── VENDOR INFO (left) + PAYMENT DETAILS (right)
    const vendorName = payment.vendor_name || payment.vendor || '—'

    const paymentTin =
      payment.vendor_tin || payment.tin || payment.vendor?.tin || '000-000-000-00000'

    const paymentAddress =
      payment.vendor_address || payment.address || payment.vendor?.address || ''

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...RED)
    doc.text('VENDOR INFORMATION', margin, y)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...BLACK)
    doc.text(vendorName, margin, y + 13)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MGRAY)
    doc.text(formatTin(paymentTin), margin, y + 25)
    let custExtra = 0
    if (paymentAddress) {
      doc.text(paymentAddress, margin, y + 37)
      custExtra = 12
    }

    let paymentDate = '—'
    if (payment.payment_date) {
      try {
        paymentDate = new Date(payment.payment_date).toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        })
      } catch (_) {}
    }

    const metaRows = [
      ['Doc Ref', payment.doc_ref || '—'],
      ['Mode', payment.mode_of_payment || '—'],
      ['Bank Name', payment.bank_name || '—'],
      ['Check Number', payment.check_number || '—'],
      ['Payment Date', paymentDate],
    ]

    const rightMetaX = pageW - margin

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...RED)
    doc.text('PAYMENT DETAILS', rightMetaX, y, { align: 'right' })

    metaRows.forEach(([lbl, val], i) => {
      const rowY = y + 13 + i * 12
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...BLACK)
      doc.text(lbl, rightMetaX - 140, rowY)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...MGRAY)
      doc.text(String(val), rightMetaX, rowY, { align: 'right' })
    })

    y += Math.max(5 * 12 + 13, 25 + custExtra) + 12
    doc.setDrawColor(...HAIRLINE)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageW - margin, y)
    y += 12

    // ── FORMAT HELPERS
    const fmt2 = (v) =>
      parseFloat(v || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

    const fmt1 = (v) =>
      parseFloat(v || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

    const fmtJ = (v) =>
      v != null && v !== '' && parseFloat(v) !== 0
        ? parseFloat(v).toLocaleString('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : ''

    // ── ITEMS TABLE
    const items = Array.isArray(payment.items) ? payment.items : []

    const itemRows = items.map((item, i) => {
      const qty = parseFloat(item.quantity || 1)
      const pp = parseFloat(item.purchase_price || 0)
      const tp = parseFloat(item.total_price || pp * qty)
      const disc = parseFloat(item.discount_amount || 0)
      const vatP = item.vat_percentage != null ? item.vat_percentage + '%' : '0%'
      const vatA = parseFloat(item.vat_amount || 0)
      const whtP = item.wht_percentage != null ? item.wht_percentage + '%' : '0%'
      const whtA = parseFloat(item.wht_amount || 0)
      const due = parseFloat(item.amount_due || item.amount || tp)
      return [
        i + 1,
        item.invoice_ref || '—',
        item.product_name || '—',
        item.description || '—',
        item.unit || '—',
        fmt2(qty),
        fmt2(pp),
        fmt2(tp),
        fmt2(disc),
        vatP,
        fmt2(vatA),
        whtP,
        fmt2(whtA),
        fmt2(due),
      ]
    })

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [
        [
          '#',
          'Invoice\nRef',
          'Product or\nService',
          'Description',
          'Unit',
          'Quantity',
          'Purchase\nPrice',
          'Total\nPrice',
          'Discount\nAmount',
          'VAT',
          'VAT\nAmount',
          'WHT',
          'WHT\nAmount',
          'Amount\nDue',
        ],
      ],
      body: itemRows.length > 0 ? itemRows : [Array(14).fill('')],
      styles: {
        fontSize: 6,
        cellPadding: { top: 4, bottom: 4, left: 2, right: 2 },
        textColor: BLACK,
        lineColor: HAIRLINE,
        lineWidth: 0.4,
        overflow: 'linebreak',
        font: 'helvetica',
      },
      headStyles: {
        fillColor: RED,
        textColor: WHITE,
        fontStyle: 'bold',
        fontSize: 6,
        halign: 'center',
        valign: 'middle',
        minCellHeight: 22,
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 14 },
        1: { halign: 'left', cellWidth: 38 },
        2: { halign: 'left' },
        3: { halign: 'left', cellWidth: 50 },
        4: { halign: 'center', cellWidth: 20 },
        5: { halign: 'right', cellWidth: 32 },
        6: { halign: 'right', cellWidth: 42 },
        7: { halign: 'right', cellWidth: 40 },
        8: { halign: 'right', cellWidth: 38 },
        9: { halign: 'center', cellWidth: 20 },
        10: { halign: 'right', cellWidth: 38 },
        11: { halign: 'center', cellWidth: 20 },
        12: { halign: 'right', cellWidth: 38 },
        13: { halign: 'right', cellWidth: 44 },
      },
      alternateRowStyles: { fillColor: [252, 240, 240] },
      tableLineColor: HAIRLINE,
      tableLineWidth: 0.4,
    })

    y = doc.lastAutoTable.finalY + 12

    // ── REMARKS — small red caps label
    if (payment.remarks) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.setTextColor(...RED)
      doc.text('REMARKS', margin, y + 8)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...BLACK)
      const wrapped = doc.splitTextToSize(payment.remarks, contentW * 0.6)
      doc.text(wrapped, margin + 48, y + 8)
      y += Math.max(16, wrapped.length * 10 + 4)
    } else {
      y += 6
    }

    // ── AMOUNT BREAKDOWN BOX
    const totals = items.reduce(
      (acc, item) => {
        const qty = parseFloat(item.quantity || 1)
        acc.purchasePrice += parseFloat(item.purchase_price || 0) * qty
        acc.totalDiscount += parseFloat(item.discount_amount || 0)
        acc.totalVAT += parseFloat(item.vat_amount || 0)
        acc.vatableSales += parseFloat(item.vatable_sales || 0)
        acc.vatExempt += parseFloat(item.vat_exempt_sales || 0)
        acc.zeroRated += parseFloat(item.zero_rated_sales || 0)
        acc.totalWHT += parseFloat(item.wht_amount || 0)
        acc.amountDue += parseFloat(item.amount_due || item.amount || 0)
        return acc
      },
      {
        purchasePrice: 0,
        totalDiscount: 0,
        totalVAT: 0,
        vatableSales: 0,
        vatExempt: 0,
        zeroRated: 0,
        totalWHT: 0,
        amountDue: 0,
      },
    )

    const discountedAmount = totals.purchasePrice - totals.totalDiscount
    const netOfVAT = discountedAmount - totals.totalVAT

    const BOX_X = margin
    const BOX_W = contentW
    const BOX_HEADER_H = 18
    const BOX_ROW_H = 13
    const BOX_COL_ROWS = 5
    const BOX_BODY_PAD_TOP = 10
    const BOX_BODY_H = BOX_COL_ROWS * BOX_ROW_H + BOX_BODY_PAD_TOP
    const BOX_DUE_H = 24
    const BOX_H = BOX_HEADER_H + BOX_BODY_H + BOX_DUE_H

    const boxTopY = y

    // Outer border
    doc.setDrawColor(...HAIRLINE)
    doc.setLineWidth(0.5)
    doc.rect(BOX_X, boxTopY, BOX_W, BOX_H, 'S')

    // Header bar
    doc.setFillColor(...WHITE)
    doc.rect(BOX_X, boxTopY, BOX_W, BOX_HEADER_H, 'F')
    doc.setDrawColor(...BLACK)
    doc.setLineWidth(0.5)
    doc.line(BOX_X, boxTopY + BOX_HEADER_H, BOX_X + BOX_W, boxTopY + BOX_HEADER_H)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...BLACK)
    doc.text('AMOUNT BREAKDOWN', BOX_X + 8, boxTopY + BOX_HEADER_H - 6)

    // Two-column body
    const colGap = 16
    const boxColW = (BOX_W - colGap) / 2
    const leftLabelX = BOX_X + 10
    const leftValueX = BOX_X + boxColW - 6
    const rightLabelX = BOX_X + boxColW + colGap
    const rightValueX = BOX_X + BOX_W - 10

    const bodyTopY = boxTopY + BOX_HEADER_H + BOX_BODY_PAD_TOP

    const leftRows = [
      ['Total Purchase Price', fmt1(totals.purchasePrice)],
      ['Total Discount', fmt1(totals.totalDiscount)],
      ['Total Discounted Amount', fmt1(discountedAmount)],
      ['Total VAT', fmt1(totals.totalVAT)],
      ['Total NOV Discount', fmt1(0)],
    ]

    const rightRows = [
      ['VATable Sales', fmt1(totals.vatableSales)],
      ['VAT-Exempt Sales', fmt1(totals.vatExempt)],
      ['Zero Rated Sales', fmt1(totals.zeroRated)],
      ['Total Net of VAT', fmt1(netOfVAT)],
      ['Total WHT', fmt1(totals.totalWHT)],
    ]

    doc.setFontSize(7.5)
    leftRows.forEach(([lbl, val], i) => {
      const rowY = bodyTopY + i * BOX_ROW_H
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...BLACK)
      doc.text(lbl, leftLabelX, rowY)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...BLACK)
      doc.text(val, leftValueX, rowY, { align: 'right' })
    })

    rightRows.forEach(([lbl, val], i) => {
      const rowY = bodyTopY + i * BOX_ROW_H
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...BLACK)
      doc.text(lbl, rightLabelX, rowY)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...BLACK)
      doc.text(val, rightValueX, rowY, { align: 'right' })
    })

    // Vertical divider
    doc.setDrawColor(...HAIRLINE)
    doc.setLineWidth(0.5)
    doc.line(
      BOX_X + boxColW + colGap / 2,
      boxTopY + BOX_HEADER_H + 2,
      BOX_X + boxColW + colGap / 2,
      boxTopY + BOX_HEADER_H + BOX_BODY_H - 2,
    )

    // Full-width white "due" row along the bottom of the box
    const dueY = boxTopY + BOX_HEADER_H + BOX_BODY_H
    doc.setFillColor(...WHITE)
    doc.rect(BOX_X, dueY, BOX_W, BOX_DUE_H, 'F')
    doc.setDrawColor(...BLACK)
    doc.setLineWidth(0.5)
    doc.line(BOX_X, dueY, BOX_X + BOX_W, dueY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...BLACK)
    doc.text('TOTAL AMOUNT PAID', BOX_X + 10, dueY + BOX_DUE_H / 2 + 3)
    doc.setFontSize(11)
    doc.text(fmt1(totals.amountDue), BOX_X + BOX_W - 10, dueY + BOX_DUE_H / 2 + 3, {
      align: 'right',
    })

    y = boxTopY + BOX_H + 20

    // ── JOURNAL TABLE
    const journal = Array.isArray(payment.journal) ? payment.journal : []

    if (journal.length > 0) {
      const journalRows = journal.map((j) => [
        j.account_name || '—',
        j.responsibility_center || 'Unassigned',
        fmtJ(j.debit),
        fmtJ(j.credit),
      ])

      const totalDebit = journal.reduce((s, j) => s + parseFloat(j.debit || 0), 0)
      const totalCredit = journal.reduce((s, j) => s + parseFloat(j.credit || 0), 0)
      journalRows.push(['TOTAL', '', fmtJ(totalDebit), fmtJ(totalCredit)])

      const lastRowIdx = journalRows.length - 1

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Chart Of Accounts', 'Responsibility Center', 'Debit', 'Credit']],
        body: journalRows,
        styles: {
          fontSize: 7.5,
          cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
          textColor: BLACK,
          lineColor: HAIRLINE,
          lineWidth: 0.4,
          font: 'helvetica',
        },
        headStyles: {
          fillColor: WHITE,
          textColor: BLACK,
          fontStyle: 'bold',
          fontSize: 7.5,
          halign: 'left',
          valign: 'middle',
          minCellHeight: 18,
          lineColor: BLACK,
          lineWidth: { bottom: 1 },
        },
        columnStyles: {
          0: { cellWidth: 'auto', halign: 'left' },
          1: { cellWidth: 150, halign: 'left' },
          2: { cellWidth: 80, halign: 'right' },
          3: { cellWidth: 80, halign: 'right' },
        },
        alternateRowStyles: { fillColor: [252, 252, 252] },
        tableLineColor: HAIRLINE,
        tableLineWidth: 0.4,
        didParseCell(data) {
          if (data.section === 'body' && data.row.index === lastRowIdx) {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.textColor = RED
          }
        },
      })

      y = doc.lastAutoTable.finalY + 8
    }

    // ── AUTHORIZATION / SIGNATURE SECTION
    y += 16

    doc.setDrawColor(...RED)
    doc.setLineWidth(1)
    doc.line(margin, y, margin + 90, y)
    y += 12

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...BLACK)
    doc.text('AUTHORIZATION', margin, y)
    y += 16

    const colW = contentW / 3
    const SIG_BODY_H = 46

    const signFields = [
      { label: 'APPROVED BY', value: payment.approved_by },
      { label: 'CHECKED BY', value: payment.checked_by },
      { label: 'SUBMITTED BY', value: payment.created_by },
    ]

    signFields.forEach((field, i) => {
      const sx = margin + i * colW
      const lineY = y + 14
      const lineX1 = sx + (i === 0 ? 0 : 10)
      const lineX2 = sx + colW - (i === 2 ? 0 : 10)

      doc.setDrawColor(...BLACK)
      doc.setLineWidth(0.75)
      doc.line(lineX1, lineY, lineX2, lineY)

      if (field.value) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.setTextColor(...BLACK)
        doc.text(field.value, sx + colW / 2, lineY + 12, { align: 'center' })
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.setTextColor(...RED)
      doc.text(field.label, sx + colW / 2, lineY + 23, { align: 'center' })
    })

    y += SIG_BODY_H

    // ── FOOTER (Full bleed red band mirroring the top)
    const FOOTER_BAND_H = 22
    doc.setFillColor(...RED)
    doc.rect(0, pageH - FOOTER_BAND_H, pageW, FOOTER_BAND_H, 'F')

    const footerTextY = pageH - FOOTER_BAND_H / 2 + 2

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(245, 220, 220)
    doc.text('Generated ' + new Date().toLocaleString('en-PH'), margin, footerTextY)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...WHITE)
    doc.text(
      copyLabel + '  ·  Payment Voucher #' + (payment.id ?? ''),
      pageW - margin,
      footerTextY,
      { align: 'right' },
    )

    // ── SAVE
    doc.save('payment_voucher_' + (payment.id ?? idx) + '_' + copyType + '.pdf')
  }
}
