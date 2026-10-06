import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchWithAuth } from '../../utils/api'

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
          setPreview(null)
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
      setPreview(data)
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }, [companyId, activeForm, startDate, endDate, inputs, fail])

  const saveFiling = useCallback(async () => {
    if (!companyId || !activeForm) return
    setBusy(true)
    setError(null)
    try {
      const data = await tax(`/compute?companyId=${companyId}`, {
        method: 'POST',
        body: { formCode: activeForm, startDate, endDate, inputs, save: true },
      })
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

      const res = await fetchWithAuth('/tax-compliance/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formType: activeForm,
          dateRange: period
            ? { start: period.start, end: period.end }
            : { start: startDate, end: endDate },
          formRows: (detail.line_schema ?? []).map((l) => [
            l.label,
            String(lines[l.key] ?? 0),
            '',
          ]),
        }),
      })
      if (!res.ok) throw new Error(`Export failed (${res.status})`)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `BIR_Form_${activeForm}_${preview?.period?.start || startDate}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      say('PDF exported.')
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }, [activeForm, startDate, endDate, preview, fail, say])

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
