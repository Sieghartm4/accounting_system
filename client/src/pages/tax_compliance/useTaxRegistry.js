import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { fetchWithAuth } from '../../utils/api'
// Draws the professional letterhead on exported PDFs. Without this import the
// name was an undeclared global, so exporting a return failed at runtime with
// "renderPDFCompanyHeader is not defined" rather than at build time.
import { renderPDFCompanyHeader } from '../../utils/pdfCompanyHeader'

/**
 * Data layer for the registry-driven tax page.
 *
 * Everything the page renders comes from /tax: the form catalogue, which forms
 * apply to this company, the deadlines, the taxpayer profile, filings and their
 * lines. The page contains no hardcoded form list, no form-specific
 * arithmetic, and the company is automatically set from the user's session
 * for security — users can only access their own company's tax filings.
 *
 * Error handling mirrors the API: a 400/404/409 body carries { code, message }
 * and is surfaced verbatim, so the user sees the same reason the server gave.
 */

const tax = async (path, { method = 'GET', body } = {}) => {
  const res = await fetchWithAuth(`/tax${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  const json = await res.json().catch(() => null)

  if (!res.ok) {
    const err = new Error(json?.message || `Request failed (${res.status})`)
    err.code = json?.code || 'HTTP_ERROR'
    err.status = res.status
    err.payload = json
    throw err
  }

  return json?.data
}

const json = async (path) => {
  const res = await fetchWithAuth(path, { headers: { 'Content-Type': 'application/json' } })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(body?.message || `Request failed (${res.status})`)
    err.code = body?.code || 'HTTP_ERROR'
    err.status = res.status
    throw err
  }
  return body?.data
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

// A filing's period_start/period_end come back as full ISO timestamps
// ("2026-07-31T16:00:00.000Z") because the column is a DATE read through a UTC
// Date. In a timezone ahead of UTC that renders as the previous day, which is
// exactly how a monthly return ends up labelled July instead of August. The
// server also returns period_label, which is already correct, so prefer it and
// only fall back to formatting when it is absent.
const monthDay = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  })
}

const manilaDate = (iso) => {
  if (!iso) return ''
  const plain = String(iso).slice(0, 10)
  // A value that is already a plain YYYY-MM-DD needs no timezone conversion.
  if (/^\d{4}-\d{2}-\d{2}$/.test(plain)) return plain
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return plain
  // en-CA formats as YYYY-MM-DD, which keeps this comparable with the plain
  // dates the compute response returns.
  return d.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Manila',
  })
}

const formatPHP = (value) =>
  `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

// GET /company returns rows through the DataModeling layer, which strips the
// mc_ prefix: the id arrives as `company_id`, not `id`. Reading `.id` here
// yielded undefined, so companyId stayed null, loadTenant never ran, and
// `loading` never cleared — the page sat on the loading screen forever.
const companyIdOf = (c) => {
  const raw = c?.company_id ?? c?.id ?? c?.mc_company_id
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

const currentMonthStart = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const currentMonthEnd = () => {
  const d = new Date()
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

const useTaxRegistry = () => {
  const [companyId, setCompanyId] = useState(null)
  const [companyName, setCompanyName] = useState('')
  // The full company row, kept for the PDF letterhead.
  //
  // Only the name and id were retained, so the header had nothing to draw: TIN,
  // address, phone, email, website and logo all live on the same row that
  // /company already returned and was being discarded. `companyName` is still
  // there for the UI; this is the record, not a summary of it.
  const [companyRecord, setCompanyRecord] = useState(null)

  const [registry, setRegistry] = useState(null)
  const [applicability, setApplicability] = useState(null)
  const [profile, setProfile] = useState(null)
  const [deadlines, setDeadlines] = useState(null)
  const [filings, setFilings] = useState([])
  const [filingDetail, setFilingDetail] = useState(null)

  const [activeForm, setActiveForm] = useState(null)
  const [formDetail, setFormDetail] = useState(null)
  const [startDate, setStartDate] = useState(currentMonthStart())
  const [endDate, setEndDate] = useState(currentMonthEnd())
  const [inputs, setInputs] = useState({})
  const [preview, setPreview] = useState(null)
  // Which form the preview on screen belongs to. Opening a form computes it
  // immediately, and the effect that loads the form's metadata used to clear the
  // preview unconditionally - so the figures arrived and were then wiped, and
  // the user had to click the form a second time to see them. Comparing the form
  // code is what tells "stale preview from the form I just left" apart from
  // "preview for the form I just opened".
  const previewFormRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  // The single toast the page renders. It lives here rather than in the
  // component because the actions below are what raise it, and a component that
  // mirrored `error`/`notice` into its own state through an effect would be
  // deriving state during render.
  const [toast, setToast] = useState(null)

  const say = useCallback((text) => {
    setNotice(text)
    if (text) setTimeout(() => setNotice((cur) => (cur === text ? '' : cur)), 6000)
  }, [])

  const fail = useCallback((err) => {
    setError(err?.message || String(err))
    setPreview(null)
  }, [])

  // Raise the toast as the outcome is recorded rather than in an effect on the
  // page. An error replaces a pending success instead of queueing behind it, so
  // a failure is never read as confirmation of the action before it.
  useEffect(() => {
    if (error) setToast({ type: 'error', message: error })
  }, [error])

  useEffect(() => {
    if (notice) setToast({ type: 'success', message: notice })
  }, [notice])

  /* --- bootstrap: get companies, then auto-select the first one ---------- */

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        setLoading(true)
        const list = (await json('/company')) || []
        if (!live) return
        
        if (list.length === 0) {
          throw new Error('No company associated with your account')
        }
        
        // Auto-select the first company (user's current company based on tenant)
        const firstCompany = list[0]
        const id = companyIdOf(firstCompany)
        
        if (!id) {
          throw new Error('Invalid company data')
        }
        
        setCompanyId(id)
        setCompanyName(firstCompany.company_name || firstCompany.name || `Company ${id}`)
        setCompanyRecord(firstCompany)
      } catch (err) {
        if (live) {
          fail(err)
          setLoading(false)
        }
      }
    })()
    return () => {
      live = false
    }
  }, [fail])

  const loadTenant = useCallback(
    async (id) => {
      if (!id) return
      try {
        setError(null)
        // Deadlines are asked for by the period the accountant is standing in.
        // Without a month the server anchors to 1 January, so in October the tab
        // listed ten returns that fell due in February and April — every one
        // already past — instead of what is actually next.
        const now = new Date()
        const [reg, app, prof, due, filed] = await Promise.all([
          tax(`/registry`),
          tax(`/applicability?companyId=${id}`),
          tax(`/profile?companyId=${id}`),
          tax(`/deadlines?companyId=${id}&year=${now.getFullYear()}&month=${now.getMonth() + 1}`),
          tax(`/filings?companyId=${id}`),
        ])
        setRegistry(reg)
        setApplicability(app)
        setProfile(prof?.profile ?? null)
        setDeadlines(due)
        setFilings(filed?.filings ?? [])
        // Default to the first form the company actually has to file, so the
        // page opens on something real rather than an arbitrary first row.
        const first =
          app?.results?.find((r) => r.status === 'conflict') ||
          app?.results?.find((r) => r.status === 'applicable') ||
          reg?.forms?.[0]
        if (first) setActiveForm(first.form_code)
      } catch (err) {
        fail(err)
      } finally {
        // The loading screen is cleared on every path out of loadTenant,
        // including a tenant with no applicable forms. Leaving it set on a
        // throw is what produced the permanent loading screen.
        setLoading(false)
      }
    },
    [fail],
  )

  useEffect(() => {
    if (companyId) loadTenant(companyId)
  }, [companyId, loadTenant])

  /* --- selected form ------------------------------------------------- */

  useEffect(() => {
    if (!activeForm) {
      setFormDetail(null)
      return
    }
    let live = true
    ;(async () => {
      try {
        const detail = await tax(`/forms/${activeForm}`)
        if (live) {
setFormDetail(detail)
            setInputs({})
            // Only discard a preview that belongs to a different form. A preview
            // for this form was just computed on open and must survive.
            if (previewFormRef.current !== activeForm) setPreview(null)
            setFilingDetail(null)
        }
      } catch (err) {
        if (live) fail(err)
      }
    })()
    return () => {
      live = false
    }
  }, [activeForm, fail])

  /* --- rendering helpers --------------------------------------------- */

  // header_fields and line_schema drive the form body. `columns` is empty for
  // every form in the current catalogue, so fall back to one value column
  // rather than rendering an empty table.
  const layout = useMemo(() => {
    const detail = formDetail
    if (!detail) return null

    const columns =
      Array.isArray(detail.columns) && detail.columns.length > 0
        ? detail.columns
        : [{ key: 'amount', label: 'Amount' }]

    const sections = []
    for (const line of detail.line_schema ?? []) {
      const section = line.section || '—'
      let bucket = sections.find((s) => s.name === section)
      if (!bucket) {
        bucket = { name: section, lines: [] }
        sections.push(bucket)
      }
      bucket.lines.push(line)
    }

    return {
      headerFields: detail.header_fields ?? [],
      columns,
      sections,
      exportProfiles: detail.export_profiles ?? [],
      frequency: detail.frequency,
      isFilable: detail.is_filable,
      notes: detail.notes,
      isSchedule: detail.category === 'Supporting Schedule',
    }
  }, [formDetail])

  const resultByForm = useMemo(() => {
    const map = new Map()
    for (const r of applicability?.results ?? []) map.set(r.form_code, r)
    return map
  }, [applicability])

  // The filing a given period already has on record.
  //
  // period_start arrives as a UTC timestamp ("2026-08-31T16:00:00.000Z" for
  // September 2026, because the column is a DATE read through a UTC Date), so
  // slicing the first 10 characters yields the day *before* the period starts
  // and never equals the preview's plain "2026-09-01". Compare the calendar
  // date in Manila time instead, the same conversion monthDay() uses to render
  // the row, and accept an already-plain date unchanged.
  const filingForPeriod = useMemo(() => {
    if (!preview?.period) return null
    const start = manilaDate(preview.period.start)
    if (!start) return null
    return (
      filings.find(
        (f) => f.form_code === activeForm && manilaDate(f.period_start) === start,
      ) || null
    )
  }, [preview, filings, activeForm])

  /* --- actions -------------------------------------------------------- */

  const runPreview = useCallback(async () => {
    if (!companyId || !activeForm) return
    setBusy(true)
    setError(null)
    try {
      const data = await tax(`/compute?companyId=${companyId}`, {
        method: 'POST',
        body: { formCode: activeForm, startDate, endDate, inputs, save: false },
      })
      previewFormRef.current = activeForm
      setPreview(data)
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }, [companyId, activeForm, startDate, endDate, inputs, fail])

  // Opening a form from the registry shows that form's figures straight away,
  // for the current month. Passing the code and the dates in rather than reading
  // them from state matters: setActiveForm has not taken effect yet at this
  // point, so a plain runPreview() would compute the form the user just left.
  // Compute remains the button for a period the user has picked by hand.
  const openForm = useCallback(async (code) => {
    const start = currentMonthStart()
    const end = currentMonthEnd()
    setActiveForm(code)
    setStartDate(start)
    setEndDate(end)
    // Inputs belong to the form that was open. Carrying them over would show
    // one form's figures against another's overrides.
    setInputs({})
    if (!companyId || !code) return
    setBusy(true)
    setError(null)
    try {
      const data = await tax(`/compute?companyId=${companyId}`, {
        method: 'POST',
        body: { formCode: code, startDate: start, endDate: end, inputs: {}, save: false },
      })
      previewFormRef.current = code
      setPreview(data)
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }, [companyId, fail])

  const saveFiling = useCallback(async () => {
    if (!companyId || !activeForm) return
    setBusy(true)
    setError(null)
    try {
      const data = await tax(`/compute?companyId=${companyId}`, {
        method: 'POST',
        body: { formCode: activeForm, startDate, endDate, inputs, save: true },
      })
      previewFormRef.current = activeForm
      setPreview(data)
      // The compute response names the row `filing.filing_id`; there is no
      // `id` on it and no top-level `filing_id`, so reading either of those
      // printed "Saved as draft filing #?" after every save.
      const savedId = data?.filing?.filing_id ?? data?.filing?.id ?? data?.filing_id
      say(`Saved as draft filing #${savedId ?? '?'}.`)
      setFilings((await tax(`/filings?companyId=${companyId}`))?.filings ?? [])
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }, [companyId, activeForm, startDate, endDate, inputs, fail, say])

  const refreshFiling = useCallback(
    async (id) => {
      if (!companyId || !id) return
      setBusy(true)
      try {
        const detail = await tax(`/filings/${id}?companyId=${companyId}`)
        setFilingDetail(detail)
      } catch (err) {
        fail(err)
      } finally {
        setBusy(false)
      }
    },
    [companyId, fail],
  )

  const acknowledge = useCallback(
    async (id, note) => {
      if (!companyId || !id) return
      setBusy(true)
      setError(null)
      try {
        await tax(`/filings/${id}/acknowledge?companyId=${companyId}`, {
          method: 'POST',
          body: { note },
        })
        say('Gaps acknowledged.')
        setFilings((await tax(`/filings?companyId=${companyId}`))?.filings ?? [])
        await refreshFiling(id)
      } catch (err) {
        fail(err)
      } finally {
        setBusy(false)
      }
    },
    [companyId, fail, refreshFiling, say],
  )

  const markFiled = useCallback(
    async (id) => {
      if (!companyId || !id) return
      setBusy(true)
      setError(null)
      try {
        await tax(`/filings/${id}/file?companyId=${companyId}`, { method: 'POST' })
        say('Marked as filed with BIR.')
        setFilings((await tax(`/filings?companyId=${companyId}`))?.filings ?? [])
        await refreshFiling(id)
      } catch (err) {
        fail(err)
      } finally {
        setBusy(false)
      }
    },
    [companyId, fail, refreshFiling, say],
  )

  const saveProfile = useCallback(
    async (patch) => {
      if (!companyId) return
      setBusy(true)
      setError(null)
      try {
        const data = await tax(`/profile?companyId=${companyId}`, { method: 'PUT', body: patch })
        setProfile(data?.profile ?? null)
        await loadTenant(companyId)
        say('Profile saved.')
      } catch (err) {
        fail(err)
      } finally {
        setBusy(false)
      }
    },
    [companyId, fail, loadTenant, say],
  )

  // Legacy export. The catalogue knows which profiles exist (efps_dat,
  // efps_xml, pdf_a4) but /tax has no export route yet, so the PDF button
  // still posts to the old endpoint with the same body shape it always had.
const exportPdf = useCallback(async () => {
    if (!activeForm) return
    setBusy(true)
    setError(null)
    try {
      const detail = await tax(`/forms/${activeForm}`)
      const lines = (preview?.result?.lines ?? {}) || {}
      const period = preview?.period

      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'letter',
      })

      const W = doc.internal.pageSize.getWidth()
      const H = doc.internal.pageSize.getHeight()
      const M = 36 // 0.5 inch margin

      // 1. Render standard professional company header
      let y = renderPDFCompanyHeader(doc, companyRecord || {}, W, M)

      // Palette matching your corporate slate/navy theme
      const BLK = [17, 24, 39]      // Slate 900
      const GRY = [100, 116, 139]   // Slate 500
      const LGT = [226, 232, 240]   // Slate 200
      const WHT = [255, 255, 255]
      const BG_ALT = [248, 250, 252]// Slate 50

      // 2. Document Title Section
      doc.setDrawColor(...LGT)
      doc.setLineWidth(1)
      doc.line(M, y, W - M, y)
      y += 14

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(...BLK)
      doc.text(`BIR FORM ${activeForm.toUpperCase()}`, M, y)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...GRY)
      doc.text('Tax Compliance & Declaration', W - M, y, { align: 'right' })

      y += 12
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...GRY)
      const dateRange = period ? `${period.start} — ${period.end}` : `${startDate} — ${endDate}`
      doc.text(`Period: ${dateRange}`, M, y)
      doc.text(`Generated: ${new Date().toLocaleDateString('en-PH')}`, W - M, y, { align: 'right' })
      y += 16

      // 3. Format tax form rows cleanly (Using clean human-readable labels without raw keys)
      const schema = detail.line_schema ?? []
      const body = schema.map((l) => {
        const rawVal = lines[l.key] ?? 0
        const formattedVal = typeof rawVal === 'number' 
          ? rawVal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
          : String(rawVal)
        return [
          l.label || l.key, // Clean label presentation
          formattedVal,
        ]
      })

      // 4. Render Table using autoTable
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        tableWidth: W - M * 2,
        head: [
          [
            { content: 'LINE ITEM DESCRIPTION', styles: { halign: 'left' } },
            { content: 'AMOUNT (Php)', styles: { halign: 'right' } },
          ],
        ],
        body: body,
        theme: 'plain',
        headStyles: {
          fillColor: BLK,
          textColor: WHT,
          fontStyle: 'bold',
          fontSize: 8.5,
          cellPadding: { top: 7, bottom: 7, left: 8, right: 8 },
        },
        alternateRowStyles: { fillColor: BG_ALT },
        styles: {
          fontSize: 8.5,
          font: 'helvetica',
          cellPadding: { top: 6, bottom: 6, left: 8, right: 8 },
          textColor: [30, 41, 59],
          lineColor: LGT,
          lineWidth: 0.5,
          valign: 'middle',
        },
        columnStyles: {
          0: { cellWidth: 'auto', halign: 'left' },
          1: { cellWidth: 120, halign: 'right', fontStyle: 'bold' },
        },
      })

      y = doc.lastAutoTable.finalY + 30

      // 5. Professional Signature Block
      if (y > H - 100) {
        doc.addPage()
        y = 50
      }

      doc.setDrawColor(...GRY)
      doc.setLineWidth(0.75)
      doc.line(W - M - 200, y, W - M, y)
      
      y += 12
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...GRY)
      doc.text('Authorized Officer / Representative Signature', W - M - 100, y, { align: 'center' })

      // 6. Page Footers (Page X of Y) across all pages
      const totalPages = doc.internal.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...GRY)
        doc.text(`Page ${i} of ${totalPages}`, W - M, H - 20, { align: 'right' })
        doc.text('Confidential — BIR Tax Compliance Report', M, H - 20)
      }

      doc.save(`BIR_Form_${activeForm}_${period?.start || startDate}.pdf`)
      say('PDF exported.')
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }, [activeForm, startDate, endDate, preview, companyRecord, fail, say])

  return {
    companyId,
    companyName,
    companies: [], // Not exposing company list since tenant only has one company
    registry,
    applicability,
    profile,
    deadlines,
    filings,
    filingDetail,
    activeForm,
    setActiveForm,
    formDetail,
    layout,
    resultByForm,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    inputs,
    setInputs,
    preview,
    filingForPeriod,
    loading,
    busy,
    error,
    notice,
    toast,
    setToast,
    runPreview,
    openForm,
    saveFiling,
    refreshFiling,
    acknowledge,
    markFiled,
    saveProfile,
    exportPdf,
    formatPHP,
    monthDay,
  }
}

export default useTaxRegistry
