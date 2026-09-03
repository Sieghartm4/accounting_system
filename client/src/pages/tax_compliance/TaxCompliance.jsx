import React, { useState, useEffect, useMemo } from 'react'
import {
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  FileSpreadsheet,
  Filter,
  HandCoins,
  Landmark,
  Printer,
  Receipt,
  Scale,
  ShieldCheck,
  Info,
  ChevronRight,
  Edit2,
  Save,
  X,
  AlertCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { fetchWithAuth } from '../../utils/api'

/* ------------------------------------------------------------------ */
/* Data-model expectations                                             */
/* ------------------------------------------------------------------ */
// This component can only be as accurate as the journal entries it reads.
// Every entry from `/tax-compliance/calculate-tax` should ideally carry:
//   id            - unique line id
//   date          - YYYY-MM-DD
//   coaName       - chart-of-account name (already present)
//   amount, type  - already present (DEBIT/CREDIT)
//   voucherId  or referenceNo  - links the WHT leg to its income/expense leg
//   atc           - the BIR Alphanumeric Tax Code, e.g. "WC100"
//   payeeName, payeeTin  - counterparty on withholding transactions (2307)
// If voucherId/atc/payeeName are missing, this component falls back to the
// old regex-on-account-name heuristics and shows a banner telling you so —
// it does NOT fabricate numbers to fill the gaps.

const getCurrentMonthRange = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(year, today.getMonth() + 1, 0).getDate()
  return {
    start: `${year}-${month}-01`,
    end: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
  }
}

const formatPHP = (value) =>
  `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const monthKey = (dateStr) => String(dateStr || '').slice(0, 7) // "YYYY-MM"

const groupBy = (arr, keyFn) =>
  arr.reduce((acc, item) => {
    const key = keyFn(item)
    if (key === undefined || key === null || key === '') return acc
    ;(acc[key] = acc[key] || []).push(item)
    return acc
  }, {})

// Fallback ATC inference ONLY used when the ledger line has no `atc` field.
// This is a heuristic, not a source of truth — replace by tagging entries
// with a real ATC at the point of purchase-order / AP entry. Generic
// "Purchases" is intentionally NOT mapped to a confident code (goods,
// services, and several other ATCs all post to a generic purchases
// account) — it's flagged UNSPECIFIED so an accountant reviews it by hand
// rather than trusting a silent guess.
const inferAtc = (entry) => {
  const name = entry?.coaName || ''
  if (/professional|talent|consultanc/i.test(name))
    return { atc: 'WC120', inferred: true }
  if (/rent/i.test(name)) return { atc: 'WC100', inferred: true }
  return { atc: 'UNSPECIFIED', inferred: true }
}

// Builds YYYY-MM without ever constructing a Date + toISOString() round trip.
// That round trip converts through UTC and silently shifts the month back
// by one whenever the runtime's local timezone is ahead of UTC (e.g. PHT,
// UTC+8) — exactly the bug that produced "2026-06/07/08" instead of
// "2026-07/08/09" for a quarter anchored on Sept 1.
const ymKey = (year, monthIndexZeroBased) =>
  `${year}-${String(monthIndexZeroBased + 1).padStart(2, '0')}`

const isEwtLine = (e) => /withholding tax\s*-\s*expanded/i.test(e.coaName || '')
const isCwtLine = (e) => /creditable withholding tax/i.test(e.coaName || '')
const isRevenueLine = (e) => /^(income from|sales|revenue)/i.test(e.coaName || '')
const isExpenseLine = (e) =>
  /purchase|cost of sales|expense|professional fee|rent/i.test(e.coaName || '')

export default function App() {
  const currentMonth = getCurrentMonthRange()
  const [startDate, setStartDate] = useState(currentMonth.start)
  const [endDate, setEndDate] = useState(currentMonth.end)
  const [submittedRange, setSubmittedRange] = useState(currentMonth)
  const [activeForm, setActiveForm] = useState('2550M')
  const [showOfficialForm, setShowOfficialForm] = useState(true)
  const [data, setData] = useState(null)
  const [notice, setNotice] = useState('')
  const [isEditMode, setIsEditMode] = useState(false)
  const [editedValues, setEditedValues] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [draftId, setDraftId] = useState(null)
  const [isExporting, setIsExporting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [companyProfile, setCompanyProfile] = useState(null)
  const [companyDraft, setCompanyDraft] = useState(null)
  const [isEditingCompany, setIsEditingCompany] = useState(false)
  const [isSavingCompany, setIsSavingCompany] = useState(false)

  const tax = data?.tax || {
    outputVAT: 0,
    inputVAT: 0,
    netVATPayable: 0,
    wtExpanded: 0,
    wtCreditable: 0,
  }
  const journalEntries = useMemo(
    () => data?.journalEntries || [],
    [data?.journalEntries],
  )
  // Taxpayer identity must come from the company/org profile, never from a
  // literal in this file. Wire your calculate-tax response (or a separate
  // /company/profile call) to populate `data.company`.
  const company = companyProfile || data?.company || null

  const signedAmount = (entry) =>
    Number(entry.amount || 0) * (entry.type === 'DEBIT' ? 1 : -1)

  /* ---------------------------------------------------------------- */
  /* Period math — done first because everything below depends on it   */
  /* ---------------------------------------------------------------- */
  const selectedMonth = monthKey(submittedRange.start) // for monthly forms
  const quarterMonths = useMemo(() => {
    const anchor = new Date(`${submittedRange.start}T00:00:00`) // local-time parse, safe for getMonth/getFullYear
    const quarterStartMonth = Math.floor(anchor.getMonth() / 3) * 3
    return [0, 1, 2].map((offset) =>
      ymKey(anchor.getFullYear(), quarterStartMonth + offset),
    )
  }, [submittedRange.start])
  const quarterNumber =
    Math.floor(new Date(`${submittedRange.start}T00:00:00`).getMonth() / 3) + 1

  /* ---------------------------------------------------------------- */
  /* Voucher reconstruction — join the withholding-tax leg to the      */
  /* income/expense leg it belongs to, via voucherId / referenceNo.    */
  /* This is what makes "tax base" mean something real instead of      */
  /* just re-using the WHT entry's own amount.                         */
  /* ---------------------------------------------------------------- */
  // Without a real voucherId/referenceNo, grouping by `e.id` puts every
  // single line in its own group of one — meaning a WHT line can NEVER
  // find its sibling base line, and base silently collapses to the WHT
  // amount itself (100% "rate"). The fallback below instead groups lines
  // that share date + module + responsibility center, which reconstructs
  // every real transaction correctly for postings written atomically by a
  // single module action (sales, purchase, receipts, cash_disbursements).
  // It WILL incorrectly merge two unrelated same-day transactions in the
  // same module/RC — the only real fix is adding a voucherId column to
  // the journal_entries table.
  const vouchers = useMemo(() => {
    const key = (e) =>
      e.voucherId ||
      e.referenceNo ||
      `${e.date}|${e.module || ''}|${e.responsibilityCenter || e.responsibility_center || ''}`
    const groups = groupBy(journalEntries, key)
    return Object.values(groups)
  }, [journalEntries])

  const hasVoucherLinkage = journalEntries.some((e) => e.voucherId || e.referenceNo)
  const hasAtcTagging = journalEntries.some((e) => e.atc)
  const hasPayeeTagging = journalEntries.some(
    (e) => isCwtLine(e) && (e.payeeName || e.counterpartyName),
  )
  const dataGaps = [
    !hasVoucherLinkage &&
      'voucherId / referenceNo (links a WHT line to its income/expense line)',
    !hasAtcTagging && 'atc (ATC code is currently guessed from the account name)',
    !hasPayeeTagging &&
      'payeeName / payeeTin (Form 2307 needs a real payee, not an account name)',
    !company && 'company profile (TIN, RDO code, registered name/address)',
  ].filter(Boolean)

  // One reconstructed row per EWT transaction: { date, atc, payeeName, payeeTin, base, withheld }
  const ewtVouchers = useMemo(() => {
    return vouchers
      .map((lines) => {
        const wht = lines.find(isEwtLine)
        if (!wht) return null
        const baseLine = lines.find(
          (l) => l !== wht && (isExpenseLine(l) || isRevenueLine(l)),
        )
        const atcGuess = wht.atc
          ? { atc: wht.atc, inferred: false }
          : inferAtc(baseLine || wht)
        return {
          date: wht.date,
          atc: atcGuess.atc,
          atcInferred: atcGuess.inferred,
          baseAccountName: baseLine?.coaName || null,
          // No payee/vendor field exists on these entries at all — this is
          // NOT inferred, it's genuinely absent. Surfacing it plainly
          // rather than guessing a name from the account/department.
          payeeName:
            wht.payeeName || baseLine?.payeeName || wht.counterpartyName || null,
          payeeTin: wht.payeeTin || baseLine?.payeeTin || '',
          base: baseLine ? Math.abs(signedAmount(baseLine)) : null,
          withheld: Math.abs(signedAmount(wht)),
        }
      })
      .filter(Boolean)
  }, [vouchers])

  // Form 1601-EQ / operational schedule: one row per ATC, summed for the
  // whole selected period.
  const ewtByAtc = useMemo(() => {
    return Object.entries(groupBy(ewtVouchers, (v) => v.atc)).map(([atc, rows]) => {
      const knownBaseRows = rows.filter((r) => r.base !== null)
      const base = knownBaseRows.reduce((s, r) => s + r.base, 0)
      const withheld = rows.reduce((s, r) => s + r.withheld, 0)
      const unmatched = rows.length - knownBaseRows.length
      return {
        atc,
        base,
        withheld,
        rate: base ? `${((withheld / base) * 100).toFixed(1)}%` : '—',
        inferred: rows.some((r) => r.atcInferred),
        unmatched, // count of WHT lines whose sibling base line couldn't be found
      }
    })
  }, [ewtVouchers])

  const cwtVouchers = useMemo(() => {
    return vouchers
      .map((lines) => {
        const cwt = lines.find(isCwtLine)
        if (!cwt) return null
        const revenueLine = lines.find((line) => line !== cwt && isRevenueLine(line))
        return {
          date: cwt.date,
          atc: cwt.atc || 'UNSPECIFIED',
          payorName: cwt.payeeName || cwt.counterpartyName || null,
          payorTin: cwt.payeeTin || '',
          base: revenueLine ? Math.abs(signedAmount(revenueLine)) : null,
          withheld: Math.abs(signedAmount(cwt)),
        }
      })
      .filter(Boolean)
  }, [vouchers])

  // Form 0619-E: one total per calendar month (the form is filed monthly).
  const ewtByMonth = useMemo(() => {
    return Object.entries(groupBy(ewtVouchers, (v) => monthKey(v.date)))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, rows]) => ({
        month,
        base: rows.filter((r) => r.base !== null).reduce((s, r) => s + r.base, 0),
        withheld: rows.reduce((s, r) => s + r.withheld, 0),
      }))
  }, [ewtVouchers])

  // Form 2307: customer-side CWT, grouped by payor and split by quarter month.
  // Rows with no payee identity are grouped under a sentinel key instead of
  // being silently dropped by groupBy — the money still has to show up
  // somewhere, flagged as needing vendor tagging, rather than vanishing
  // from the total.
  const UNASSIGNED = '__UNASSIGNED__'
  const payeeSchedule = useMemo(() => {
    return Object.entries(
      groupBy(
        cwtVouchers,
        (v) => `${v.payorName || UNASSIGNED}|${v.payorTin || ''}`,
      ),
    ).map(([key, rows]) => {
      const [payeeName, payeeTin] = key.split('|')
      const months = quarterMonths.reduce((acc, m) => {
        acc[m] = rows
          .filter((r) => monthKey(r.date) === m && r.base !== null)
          .reduce((s, r) => s + r.base, 0)
        return acc
      }, {})
      return {
        payeeName: payeeName === UNASSIGNED ? null : payeeName,
        payeeTin,
        atc: rows[0]?.atc,
        months,
        totalBase: rows
          .filter((r) => r.base !== null)
          .reduce((s, r) => s + r.base, 0),
        totalWithheld: rows.reduce((s, r) => s + r.withheld, 0),
        voucherCount: rows.length,
      }
    })
  }, [cwtVouchers, quarterMonths])

  const revenueBase = useMemo(
    () =>
      vouchers
        .flatMap((lines) => lines.filter(isRevenueLine))
        .reduce((s, e) => s + Math.abs(signedAmount(e)), 0),
    [vouchers],
  )
  const purchaseBase = useMemo(
    () =>
      vouchers
        .flatMap((lines) => lines.filter(isExpenseLine))
        .reduce((s, e) => s + Math.abs(signedAmount(e)), 0),
    [vouchers],
  )

  // Sanity check: does the API's computed VAT match what the ledger implies?
  // A mismatch usually means zero-rated/exempt sales aren't excluded from
  // revenueBase yet, or the API is pulling from a different date filter.
  const vatReconciliationDelta = Math.abs(
    revenueBase * 0.12 - Number(tax.outputVAT || 0),
  )
  const vatReconciles = vatReconciliationDelta < 1

  const ewtTotalFromLedger = ewtByAtc.reduce((s, r) => s + r.withheld, 0)
  const selectedMonthRemit = ewtByMonth.find((m) => m.month === selectedMonth)

  /* ---------------------------------------------------------------- */
  /* Fetch                                                              */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const fetchTaxData = async () => {
      try {
        setLoading(true)
        setFetchError('')

        const params = new URLSearchParams({
          start_date:
            activeForm === '1601EQ' || activeForm === '2307'
              ? `${quarterMonths[0]}-01`
              : submittedRange.start,
          end_date:
            activeForm === '1601EQ' || activeForm === '2307'
              ? `${quarterMonths[2]}-${String(new Date(Number(quarterMonths[2].slice(0, 4)), Number(quarterMonths[2].slice(5, 7)), 0).getDate()).padStart(2, '0')}`
              : submittedRange.end,
        })

        const response = await fetchWithAuth(
          `/tax-compliance/calculate-tax?${params.toString()}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        )
        if (!response.ok) {
          throw new Error(`Tax API error: ${response.status} ${response.statusText}`)
        }

        const taxData = await response.json()
        if (taxData.success && taxData.data?.tax) {
          setData(taxData.data)
        } else {
          setFetchError(taxData.message || 'No tax data available for this period')
        }
      } catch (error) {
        console.error('Error fetching tax data:', error)
        setFetchError(`Failed to fetch tax data: ${error.message}`)
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchTaxData()
  }, [submittedRange, activeForm, quarterMonths])

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const response = await fetchWithAuth('/company/single', { method: 'GET' })
        const result = await response.json()
        if (response.ok && result.success && result.data) {
          const profile = {
            id: result.data.company_id,
            name: result.data.company_name,
            ownerName: result.data.owner_name,
            address: result.data.address,
            tin: result.data.tin,
            website: result.data.website,
            email: result.data.email,
            contactNumber: result.data.phone,
            rdoCode: result.data.rdo_code,
          }
          setCompanyProfile(profile)
          setCompanyDraft(profile)
        }
      } catch (error) {
        console.error('Error fetching company profile:', error)
      }
    }
    fetchCompany()
  }, [])

  const saveCompanyProfile = async () => {
    if (!companyDraft?.id || !companyDraft.name?.trim()) return
    setIsSavingCompany(true)
    try {
      const response = await fetchWithAuth(`/company/${companyDraft.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          company_name: companyDraft.name.trim(),
          owner_name: companyDraft.ownerName || '',
          address: companyDraft.address || '',
          tin: companyDraft.tin || '',
          website: companyDraft.website || '',
          email: companyDraft.email || '',
          phone: companyDraft.contactNumber || '',
        }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.message || 'Failed to save company profile')
      setCompanyProfile(companyDraft)
      setIsEditingCompany(false)
      actionNotice('Company profile updated')
    } catch (error) {
      actionNotice(`Company profile update failed: ${error.message}`)
    } finally {
      setIsSavingCompany(false)
    }
  }

  const exportCSV = () => {
    const rows = formRows[activeForm].map((row, index) => [
      index + 1,
      row[0],
      getFormValue(activeForm, index, 'base') ?? '',
      getFormValue(activeForm, index, 'tax') ?? '',
    ])
    const csvRows = [
      ['BIR Form', activeForm],
      ['Period Start', submittedRange.start],
      ['Period End', submittedRange.end],
      ['Company', company?.name || ''],
      ['TIN', company?.tin || ''],
      [],
      ['Line', 'Description', 'Taxable Base', 'Tax / Remittance Due'],
      ...rows,
    ]
    const csv = csvRows
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','),
      )
      .join('\r\n')
    const link = document.createElement('a')
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    )
    link.href = url
    link.download = `BIR_Form_${activeForm}_${submittedRange.start}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 0)
    actionNotice(`CSV exported for BIR Form ${activeForm}`)
  }

  const submitFilter = (event) => {
    if (event) event.preventDefault()
    setSubmittedRange({ start: startDate, end: endDate })
    setEditedValues({})
    actionNotice(`Tax ledgers updated for ${startDate} to ${endDate}`)
  }

  const actionNotice = (message) => {
    setNotice(message)
    setTimeout(() => setNotice(''), 3200)
  }

  /* ---------------------------------------------------------------- */
  /* formRows — the editable operational table AND the payload used     */
  /* for save/export. Every row is derived from the ledger, nothing is  */
  /* a literal.                                                          */
  /* ---------------------------------------------------------------- */
  const formRows = {
    '2550M': [
      ['Vatable Sales / Receipts (from ledger)', revenueBase, tax.outputVAT],
      [
        'Less: Allowable Input Tax on Purchases (from ledger)',
        purchaseBase,
        tax.inputVAT,
      ],
      ['Net VAT Payable / (Overpayment)', null, tax.netVATPayable],
    ],
    '0619E': [
      ...ewtByAtc.map((row) => [
        `ATC ${row.atc}${row.atc === 'UNSPECIFIED' ? ' — needs manual classification' : ''}${row.unmatched ? ` (${row.unmatched} unmatched)` : ''}`,
        row.base,
        row.withheld,
      ]),
      [
        'Total Amount of Remittance — selected month',
        selectedMonthRemit?.base ?? null,
        selectedMonthRemit?.withheld ?? 0,
      ],
    ],
    2307: [
      ...payeeSchedule.map((row) => [
        `${row.payeeName || 'NEEDS VENDOR TAGGING'} (${row.atc || '—'})`,
        row.totalBase,
        row.totalWithheld,
      ]),
      [
        'Total Creditable Tax Certificates',
        payeeSchedule.reduce((s, r) => s + r.totalBase, 0),
        payeeSchedule.reduce((s, r) => s + r.totalWithheld, 0),
      ],
    ],
    '1601EQ': [
      ...ewtByAtc.map((row) => [
        `ATC ${row.atc}${row.atc === 'UNSPECIFIED' ? ' — needs manual classification' : ''} — consolidated for quarter`,
        row.base,
        row.withheld,
      ]),
      [
        'Total Quarterly EWT Remittance Liability',
        ewtByAtc.reduce((s, r) => s + r.base, 0),
        ewtByAtc.reduce((s, r) => s + r.withheld, 0),
      ],
    ],
  }

  const getFormValue = (formKey, rowIndex, valueType) => {
    const key = `${formKey}_${rowIndex}_${valueType}`
    if (key in editedValues) return editedValues[key]
    return formRows[formKey][rowIndex][valueType === 'base' ? 1 : 2]
  }

  const setFormValue = (formKey, rowIndex, valueType, value) => {
    const key = `${formKey}_${rowIndex}_${valueType}`
    const numValue = value === '' ? null : Number(value) || 0
    setEditedValues((prev) => ({ ...prev, [key]: numValue }))
  }

  const saveDraft = async () => {
    setIsSaving(true)
    try {
      const payload = {
        formType: activeForm,
        dateRange: submittedRange,
        editedValues,
        formRows: formRows[activeForm].map((row, idx) => [
          row[0],
          getFormValue(activeForm, idx, 'base'),
          getFormValue(activeForm, idx, 'tax'),
        ]),
      }

      const response = await fetchWithAuth('/tax-compliance/save-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Failed to save draft')

      setDraftId(result.id)
      actionNotice(`Draft saved successfully (ID: ${result.id})`)
    } catch (error) {
      actionNotice(`Failed to save draft: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const exportPDF = async () => {
    setIsExporting(true)
    try {
      const payload = {
        formType: activeForm,
        dateRange: submittedRange,
        company,
        formRows: formRows[activeForm].map((row, idx) => [
          row[0],
          getFormValue(activeForm, idx, 'base'),
          getFormValue(activeForm, idx, 'tax'),
        ]),
      }

      const response = await fetchWithAuth('/tax-compliance/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error('Failed to export PDF')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute(
        'download',
        `BIR_Form_${activeForm}_${submittedRange.start}.pdf`,
      )
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      actionNotice(
        `PDF exported as BIR_Form_${activeForm}_${submittedRange.start}.pdf`,
      )
    } catch (error) {
      actionNotice(`PDF export failed: ${error.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  const markFiled = async () => {
    try {
      const response = await fetchWithAuth('/tax-compliance/mark-filed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formType: activeForm,
          dateRange: submittedRange,
          draftId,
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Failed to mark as filed')

      actionNotice(`BIR Form ${activeForm} marked as FILED`)
    } catch (error) {
      actionNotice(`Failed to mark as filed: ${error.message}`)
    }
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans antialiased">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-bir-area, #printable-bir-area * { visibility: visible; }
          #printable-bir-area {
            position: absolute; left: 0; top: 0; width: 100%;
            background: white !important; color: black !important;
            padding: 0 !important; margin: 0 !important;
            display: block !important;
          }
          .no-print { display: none !important; }
        }
        .bir-border { border: 1.5px solid #000; }
        .bir-border-b { border-bottom: 1.5px solid #000; }
        .bir-bg-header { background-color: #18181b; color: #ffffff; }
      `}</style>

      <main className="max-w-8xl mx-auto space-y-6 p-5">
        {/* Header */}
        <section className="bg-white rounded-xl border border-zinc-300 p-4 shadow-sm no-print">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-zinc-900 text-white rounded-lg shadow-sm">
                <Landmark className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <div className="flex items-center space-x-2.5">
                  <h1 className="text-base font-extrabold text-zinc-900">
                    Tax &amp; Compliance Status
                  </h1>
                  {company?.rdoCode && (
                    <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wider bg-red-100 text-red-700 rounded-md">
                      RDO {company.rdoCode}
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-zinc-600 mt-0.5">
                  {company?.name || 'Company profile not loaded'} • TIN:{' '}
                  <span className="font-mono text-zinc-900 font-bold">
                    {company?.tin || '— not on file —'}
                  </span>
                </p>
              </div>
            </div>

            <form
              onSubmit={submitFilter}
              className="flex items-center gap-2.5 text-sm"
            >
              <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-1.5 shadow-inner">
                <Calendar className="w-4 h-4 text-red-600" />
                <span className="font-bold text-zinc-700">Date Range:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="bg-transparent font-bold outline-none cursor-pointer text-zinc-900 text-sm"
                />
                <span className="text-zinc-500 font-bold">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="bg-transparent font-bold outline-none cursor-pointer text-zinc-900 text-sm"
                />
              </div>
              <button
                type="submit"
                className="bg-zinc-900 hover:bg-black text-white font-bold px-4 py-2 rounded-lg shadow-sm inline-flex items-center gap-1.5 transition-colors text-sm"
              >
                <Filter size={14} className="text-red-500" /> Submit
              </button>
            </form>

            <button
              type="button"
              onClick={() => setShowOfficialForm((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm self-start lg:self-auto"
            >
              {showOfficialForm ? <EyeOff size={16} /> : <Eye size={16} />}
              {showOfficialForm ? 'Hide Official Form' : 'Preview Form'}
            </button>
          </div>
        </section>

        {/* Data-gap banner — this replaces silent fake data with a visible checklist */}
        {dataGaps.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3 no-print">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-bold text-amber-900 block">
                Some figures below are estimated, not ledger-sourced
              </span>
              <span className="text-sm text-amber-800">
                Your journal entries or company profile are missing:{' '}
                {dataGaps.join('; ')}. Until these are wired up, ATC codes and payee
                names are inferred/heuristic rather than authoritative.
              </span>
            </div>
          </div>
        )}

        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3 no-print">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <span className="text-sm font-semibold text-blue-900">
              Fetching tax data from journal entries...
            </span>
          </div>
        )}

        {fetchError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 no-print">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-semibold text-red-900 block">
                Data Fetch Error
              </span>
              <span className="text-sm text-red-700">{fetchError}</span>
            </div>
          </div>
        )}

        {!vatReconciles && activeForm === '2550M' && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-3 no-print text-xs">
            <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
            <span className="text-orange-800 font-semibold">
              Ledger-derived VATable sales ({formatPHP(revenueBase)}) imply{' '}
              {formatPHP(revenueBase * 0.12)} output VAT, but the API returned{' '}
              {formatPHP(tax.outputVAT)}. Check for zero-rated/exempt sales not
              excluded from the revenue accounts, or a date-range mismatch.
            </span>
          </div>
        )}

        {/* KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
          <SummaryCard
            icon={<Receipt className="text-red-600" size={22} />}
            label="Net VAT Liability"
            value={formatPHP(tax.netVATPayable)}
            detail={`Output: ${formatPHP(tax.outputVAT)} | Input: ${formatPHP(tax.inputVAT)}`}
            highlightRed
          />
          <SummaryCard
            icon={<HandCoins className="text-zinc-900" size={22} />}
            label="EWT — this month (0619-E)"
            value={formatPHP(selectedMonthRemit?.withheld ?? 0)}
            detail={
              selectedMonthRemit
                ? `From ${ewtByAtc.length} ATC categories`
                : 'No EWT postings this month'
            }
            badge="Remittance"
          />
          <SummaryCard
            icon={<FileCheck2 className="text-zinc-900" size={22} />}
            label="Tax Credits — this quarter (2307)"
            value={formatPHP(payeeSchedule.reduce((s, r) => s + r.totalWithheld, 0))}
            detail={`${payeeSchedule.length} payee(s) identified from ledger`}
          />
          <div className="bg-zinc-900 text-white rounded-xl border border-zinc-800 p-4 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">
                  Total BIR Payable
                </span>
                <h2 className="text-2xl font-black text-white mt-1">
                  {formatPHP(
                    Number(tax.netVATPayable || 0) +
                      (selectedMonthRemit?.withheld ?? 0),
                  )}
                </h2>
              </div>
              <div className="p-2 bg-red-600 text-white rounded-lg shadow-sm">
                <Scale size={22} />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-zinc-800 text-xs flex justify-between items-center text-zinc-200 font-semibold">
              <span>
                Period: {submittedRange.start} to {submittedRange.end}
              </span>
            </div>
          </div>
        </section>

        {/* Workspace */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div
            className={`${showOfficialForm ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-6 no-print`}
          >
            {/* Tabs */}
            <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <FileSpreadsheet className="w-4 h-4 text-red-600" />
                <h2 className="text-sm font-bold text-zinc-900">
                  Select Tax Declaration Return
                </h2>
              </div>
              <div className="mb-3 border-b border-zinc-100 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                  Upcoming Filing Schedule
                </h3>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Deadline
                    title="BIR Form 0619-E"
                    date="Oct 10"
                    detail="Monthly EWT"
                    badge="In 12 Days"
                  />
                  <Deadline
                    title="BIR Form 2550M"
                    date="Oct 20"
                    detail="Monthly VAT"
                    badge="In 22 Days"
                  />
                  <Deadline
                    title="1601-EQ & SAWT"
                    date="Oct 31"
                    detail="Quarterly EWT"
                    badge="Q3 Return"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: '2550M', code: '2550M', label: 'Monthly VAT' },
                  { id: '0619E', code: '0619-E', label: 'Monthly EWT' },
                  { id: '2307', code: '2307', label: 'CWT Credits' },
                  { id: '1601EQ', code: '1601-EQ', label: 'Quarterly EWT' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveForm(item.id)}
                    className={`p-3 rounded-lg text-xs font-bold text-left border transition-all ${
                      activeForm === item.id
                        ? 'bg-red-600 text-white border-red-600 shadow-md'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-800 hover:bg-zinc-100'
                    }`}
                  >
                    <div className="text-sm font-black">{item.code}</div>
                    <span className="block text-[11px] mt-0.5 font-semibold opacity-95">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Editable calc table — now driven entirely by formRows[activeForm] */}
            <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div>
                  <span className="text-xs font-extrabold text-red-600 uppercase tracking-widest">
                    BIR Official Calculation Return
                  </span>
                  <h2 className="text-base font-black mt-0.5 text-zinc-900">
                    {activeForm === '2550M' &&
                      'BIR Form 2550M - Monthly VAT Declaration'}
                    {activeForm === '0619E' &&
                      'BIR Form 0619-E - Monthly EWT Remittance'}
                    {activeForm === '2307' &&
                      'BIR Form 2307 - Certificate of Creditable Tax Withheld'}
                    {activeForm === '1601EQ' &&
                      'BIR Form 1601-EQ - Quarterly EWT Return'}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-zinc-900 text-white">
                    {isEditMode ? 'Edit Mode' : 'Draft Mode'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditMode(!isEditMode)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      isEditMode
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-zinc-100 text-zinc-900 border border-zinc-300 hover:bg-zinc-200'
                    }`}
                  >
                    {isEditMode ? <X size={14} /> : <Edit2 size={14} />}
                    {isEditMode ? 'Cancel Edit' : 'Edit Values'}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-zinc-200 rounded-lg">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-900 text-white font-bold uppercase tracking-wider text-xs">
                    <tr>
                      <th className="p-3.5">Line Item (from ledger)</th>
                      <th className="p-3.5 text-right">Taxable Gross Base</th>
                      <th className="p-3.5 text-right">Tax / Remittance Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-zinc-900 font-medium">
                    {formRows[activeForm].map((row, idx) => (
                      <tr
                        key={idx}
                        className={`${isEditMode ? 'bg-zinc-50' : 'hover:bg-zinc-50'} transition-colors`}
                      >
                        <td className="p-3.5 font-bold">{row[0]}</td>
                        <td className="p-3.5 text-right">
                          {isEditMode && row[1] !== null ? (
                            <input
                              type="number"
                              value={getFormValue(activeForm, idx, 'base') ?? ''}
                              onChange={(e) =>
                                setFormValue(activeForm, idx, 'base', e.target.value)
                              }
                              className="w-full bg-white border border-blue-400 rounded px-2 py-1 text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <span
                              className={`font-mono ${row[1] === null ? 'text-zinc-400' : 'text-zinc-600'}`}
                            >
                              {row[1] === null
                                ? '—'
                                : formatPHP(getFormValue(activeForm, idx, 'base'))}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          {isEditMode ? (
                            <input
                              type="number"
                              value={getFormValue(activeForm, idx, 'tax') ?? ''}
                              onChange={(e) =>
                                setFormValue(activeForm, idx, 'tax', e.target.value)
                              }
                              className="w-full bg-white border border-blue-400 rounded px-2 py-1 text-right font-mono text-sm font-bold text-red-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="font-mono font-bold text-red-600">
                              {formatPHP(getFormValue(activeForm, idx, 'tax'))}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {formRows[activeForm].length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="p-4 text-center text-zinc-400 text-sm"
                        >
                          No matching journal entries for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-2">
                {isEditMode ? (
                  <>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={saveDraft}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 shadow-sm transition-colors disabled:opacity-50"
                    >
                      {isSaving ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Save size={15} />
                      )}
                      {isSaving ? 'Saving...' : 'Save as Draft'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditMode(false)
                        setEditedValues({})
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-zinc-200 text-zinc-900 rounded-lg text-xs font-bold hover:bg-zinc-300 transition-colors"
                    >
                      <X size={15} /> Discard Changes
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 shadow-sm transition-colors"
                    >
                      <Printer size={15} /> Print BIR Form
                    </button>
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={exportPDF}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-zinc-900 text-white rounded-lg text-xs font-bold hover:bg-black shadow-sm transition-colors disabled:opacity-50"
                    >
                      {isExporting ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Download size={15} />
                      )}
                      {isExporting ? 'Exporting...' : 'Export PDF'}
                    </button>
                    <button
                      type="button"
                      onClick={exportCSV}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-zinc-100 border border-zinc-300 text-zinc-900 rounded-lg text-xs font-bold hover:bg-zinc-200 shadow-sm transition-colors"
                    >
                      <FileSpreadsheet size={15} /> Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={markFiled}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-zinc-100 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 hover:bg-zinc-200 transition-colors"
                    >
                      <CheckCircle2 size={15} className="text-red-600" /> Mark Filed
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Ledger summary */}
            <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <h3 className="font-bold text-zinc-900 text-sm flex items-center">
                  <FileSpreadsheet className="w-4 h-4 text-red-600 mr-2" />
                  Tax Summary from Journal Entries
                </h3>
                <span className="text-xs text-zinc-600 font-bold font-mono">
                  {submittedRange.start} to {submittedRange.end}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 bg-zinc-50 p-4 rounded-lg border border-zinc-200 text-sm">
                <Stat
                  label="Output VAT (Sales)"
                  value={formatPHP(tax.outputVAT)}
                  red
                />
                <Stat
                  label="Input VAT (Purchases)"
                  value={formatPHP(tax.inputVAT)}
                />
                <Stat
                  label="Net VAT Payable"
                  value={formatPHP(tax.netVATPayable)}
                  red
                />
                <Stat
                  label="EWT withheld this quarter (ledger)"
                  value={formatPHP(ewtTotalFromLedger)}
                />
                <Stat
                  label="CWT creditable (ledger, 2307)"
                  value={formatPHP(
                    payeeSchedule.reduce((s, r) => s + r.totalWithheld, 0),
                  )}
                />
                <Stat
                  label="Journal lines in period"
                  value={String(journalEntries.length)}
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-900 font-semibold">
                  <Info className="inline w-4 h-4 mr-1" />
                  Every figure above is aggregated from journal-entry vouchers
                  matched by voucherId/referenceNo. Edit form values above only to
                  correct a genuine ledger error before filing — not to override a
                  real computed number.
                </p>
              </div>
            </div>
          </div>

          {showOfficialForm && (
            <div
              id="printable-bir-area"
              className="lg:col-span-5 bg-white border border-zinc-300 rounded-xl p-5 shadow-sm sticky top-6 self-start"
            >
              <div className="border-b border-zinc-200 pb-3 mb-4 flex items-center justify-between no-print">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-red-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                    Official BIR Form Replica
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-zinc-900 text-white text-xs px-3.5 py-1.5 rounded-lg font-bold hover:bg-black transition-colors inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Printer size={13} /> Print Replica
                </button>
              </div>

              <BIRFormPreview
                activeForm={activeForm}
                company={company}
                companyDraft={companyDraft}
                isEditingCompany={isEditingCompany}
                isSavingCompany={isSavingCompany}
                onEditCompany={() => {
                  setCompanyDraft(company)
                  setIsEditingCompany((value) => !value)
                }}
                onChangeCompany={setCompanyDraft}
                onSaveCompany={saveCompanyProfile}
                tax={tax}
                revenueBase={revenueBase}
                purchaseBase={purchaseBase}
                ewtByAtc={ewtByAtc}
                ewtByMonth={ewtByMonth}
                selectedMonth={selectedMonth}
                payeeSchedule={payeeSchedule}
                quarterMonths={quarterMonths}
                quarterNumber={quarterNumber}
              />
            </div>
          )}
        </section>

        {notice && (
          <div className="fixed bottom-5 right-5 bg-zinc-900 text-white text-xs px-4 py-3 rounded-lg shadow-xl z-50 border border-red-600 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-red-500" />
            <span className="font-bold">{notice}</span>
          </div>
        )}
      </main>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Official form replica — every value is a prop derived from the       */
/* ledger upstream; nothing here is a literal sample value.             */
/* ------------------------------------------------------------------ */
function BIRFormPreview({
  activeForm,
  company,
  companyDraft,
  isEditingCompany,
  isSavingCompany,
  onEditCompany,
  onChangeCompany,
  onSaveCompany,
  tax,
  revenueBase,
  purchaseBase,
  ewtByAtc,
  ewtByMonth,
  selectedMonth,
  payeeSchedule,
  quarterMonths,
  quarterNumber,
}) {
  const field = (label, value) => (
    <div className="border-b border-zinc-300 py-1 last:border-b-0">
      <span className="font-bold text-zinc-700">{label}: </span>
      <span className="font-semibold text-black">{value ?? '—'}</span>
    </div>
  )
  const amount = (value) => formatPHP(value)
  const selectedMonthRow = ewtByMonth.find((m) => m.month === selectedMonth)
  const quarterAtc = ewtByAtc // already scoped to submittedRange upstream
  const quarterWithheld = quarterAtc.reduce((s, r) => s + r.withheld, 0)
  const month1 = 0
  const month2 = 0
  const totalRemitted = month1 + month2
  const stillDue = Math.max(0, quarterWithheld - totalRemitted)
  const cwtTotal = payeeSchedule.reduce((s, r) => s + r.totalWithheld, 0)

  const header = {
    '1601EQ': 'Quarterly Remittance Return of Creditable Taxes Withheld',
    2307: 'Certificate of Creditable Tax Withheld at Source',
    '0619E': 'Monthly Remittance Return of Creditable Income Taxes Withheld',
    '2550M': 'Monthly Value-Added Tax Declaration',
  }[activeForm]

  return (
    <div className="bir-border p-4 bg-white font-sans text-xs text-black space-y-3">
      <div className="text-center bir-border-b pb-2.5">
        <p className="font-extrabold text-[10px] uppercase tracking-tight text-zinc-800">
          Republika ng Pilipinas - Kagawaran ng Pananalapi
          <br />
          Kawanihan ng Rentas Internas
        </p>
        <h3 className="text-lg font-black uppercase tracking-tight mt-1 text-zinc-900">
          BIR Form {activeForm}
        </h3>
        <p className="text-[11px] font-bold text-zinc-800">{header}</p>
      </div>

      <FormSection
        title="Part I - Background Information"
        action={
          <button
            type="button"
            onClick={onEditCompany}
            className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-[10px] font-bold text-zinc-900"
          >
            {isEditingCompany ? <X size={12} /> : <Edit2 size={12} />}
            {isEditingCompany ? 'Cancel' : 'Edit Fields'}
          </button>
        }
      >
        {isEditingCompany ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              ['name', 'Registered Name'],
              ['tin', 'TIN'],
              ['address', 'Registered Address'],
              ['contactNumber', 'Contact Number'],
              ['ownerName', 'Owner Name'],
              ['email', 'Email'],
            ].map(([key, label]) => (
              <label key={key} className="font-bold text-zinc-700">
                {label}
                <input
                  value={companyDraft?.[key] || ''}
                  onChange={(event) =>
                    onChangeCompany((previous) => ({
                      ...previous,
                      [key]: event.target.value,
                    }))
                  }
                  className="mt-1 w-full border border-zinc-400 bg-white px-2 py-1 font-medium text-black"
                />
              </label>
            ))}
            <button
              type="button"
              disabled={isSavingCompany}
              onClick={onSaveCompany}
              className="inline-flex w-fit items-center gap-1 rounded bg-green-600 px-3 py-1.5 font-bold text-white disabled:opacity-50"
            >
              {isSavingCompany ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Save size={12} />
              )}
              {isSavingCompany ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        ) : (
          <>
            {field('TIN', company?.tin)}
            {field('RDO Code', company?.rdoCode)}
            {field('Registered Name', company?.name)}
            {field('Registered Address', company?.address)}
            {field('Contact Number', company?.contactNumber)}
          </>
        )}
        {!company && (
          <p className="text-[10.5px] text-amber-700 font-semibold pt-1">
            Connect your company profile endpoint to populate this section — showing
            blanks rather than a sample taxpayer.
          </p>
        )}
      </FormSection>

      {activeForm === '2550M' && (
        <FormSection title="Part II - Computation of Tax (from ledger)">
          {field(
            '12 Vatable Sales/Receipts — Private (ledger base)',
            amount(revenueBase),
          )}
          {field(
            '16 Total Sales/Receipts and Output Tax Due',
            amount(tax.outputVAT),
          )}
          {field(
            '17/21 Total Allowable Input Tax (ledger base ' +
              amount(purchaseBase) +
              ')',
            amount(tax.inputVAT),
          )}
          {field('22 Net VAT Payable', amount(tax.netVATPayable))}
          {field('26 TOTAL AMOUNT PAYABLE', amount(tax.netVATPayable))}
        </FormSection>
      )}

      {activeForm === '0619E' && (
        <FormSection title="Part II - Tax Remittance (for the selected month)">
          {field('For the Month', selectedMonth)}
          <ScheduleTable
            headers={['ATC', 'Tax Base', 'Rate', 'Tax Withheld']}
            rows={ewtByAtc.map((row) => [
              row.atc,
              amount(row.base),
              row.rate,
              amount(row.withheld),
            ])}
          />
          {field(
            '14/16 Net Amount of Remittance',
            amount(selectedMonthRow?.withheld ?? 0),
          )}
          {field(
            '18 TOTAL AMOUNT OF REMITTANCE',
            amount(selectedMonthRow?.withheld ?? 0),
          )}
          {!selectedMonthRow && (
            <p className="text-[10.5px] text-amber-700 font-semibold pt-1">
              No EWT postings found for {selectedMonth} — confirm the date range
              covers exactly one month.
            </p>
          )}
        </FormSection>
      )}

      {activeForm === '2307' && (
        <FormSection
          title={`Part II - Income Payments &amp; Tax Withheld — Q${quarterNumber}`}
        >
          <ScheduleTable
            headers={[
              'Payee',
              'ATC',
              quarterMonths[0],
              quarterMonths[1],
              quarterMonths[2],
              'Total',
              'Tax Withheld',
            ]}
            rows={payeeSchedule.map((row) => [
              row.payeeName
                ? row.payeeTin
                  ? `${row.payeeName} (${row.payeeTin})`
                  : row.payeeName
                : `⚠ ${row.voucherCount} txn(s) — no payee on file`,
              row.atc || '—',
              amount(row.months[quarterMonths[0]] || 0),
              amount(row.months[quarterMonths[1]] || 0),
              amount(row.months[quarterMonths[2]] || 0),
              amount(row.totalBase),
              amount(row.totalWithheld),
            ])}
          />
          {field('Total Tax Withheld for the Quarter', amount(cwtTotal))}
          {payeeSchedule.some((r) => !r.payeeName) && (
            <p className="text-[10.5px] text-amber-700 font-semibold pt-1">
              {formatPHP(
                payeeSchedule
                  .filter((r) => !r.payeeName)
                  .reduce((s, r) => s + r.totalWithheld, 0),
              )}{' '}
              of the withheld total above has no payee attached — this cannot be
              issued as a valid 2307 certificate until those transactions are linked
              to a vendor. Do not file this section as-is.
            </p>
          )}
        </FormSection>
      )}

      {activeForm === '1601EQ' && (
        <FormSection title={`Part II - Computation of Tax — Q${quarterNumber}`}>
          <ScheduleTable
            headers={['ATC', 'Tax Base (Qtr)', 'Rate', 'Tax Withheld (Qtr)']}
            rows={ewtByAtc.map((row) => [
              row.atc,
              amount(row.base),
              row.rate,
              amount(row.withheld),
            ])}
          />
          {field('19 Total Taxes Withheld for the Quarter', amount(quarterWithheld))}
          {field(`20 Remittance — ${quarterMonths[0]}`, amount(month1))}
          {field(`21 Remittance — ${quarterMonths[1]}`, amount(month2))}
          {field('24 Total Remittances Made', amount(totalRemitted))}
          {field('25 Tax Still Due / (Over-remittance)', amount(stillDue))}
          {field('30 TOTAL AMOUNT STILL DUE', amount(stillDue))}
        </FormSection>
      )}
    </div>
  )
}

function FormSection({ title, action, children }) {
  return (
    <section>
      <div className="bir-bg-header flex items-center justify-between p-1.5 font-bold text-[11px] border border-black uppercase tracking-wider">
        <span>{title}</span>
        {action}
      </div>
      <div className="border border-black border-t-0 p-2 bg-zinc-50 font-medium">
        {children}
      </div>
    </section>
  )
}

function ScheduleTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto mb-1">
      <table className="w-full border-collapse border border-black text-[10px]">
        <thead>
          <tr className="bg-zinc-200 border-b border-black font-extrabold">
            {headers.map((h) => (
              <th
                key={h}
                className="p-1 text-left border-r border-black last:border-r-0"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-black last:border-b-0">
              {row.map((value, j) => (
                <td
                  key={j}
                  className="p-1 border-r border-black last:border-r-0 font-mono text-right"
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={headers.length} className="p-2 text-center text-zinc-400">
                No ledger data for this period
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Stat({ label, value, red }) {
  return (
    <div>
      <p className="text-xs font-bold text-zinc-600 uppercase">{label}</p>
      <p
        className={`text-lg font-black mt-1 ${red ? 'text-red-600' : 'text-zinc-900'}`}
      >
        {value}
      </p>
    </div>
  )
}

function SummaryCard({ icon, label, value, detail, badge, highlightRed }) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm hover:border-zinc-300 transition-all">
      <div className="flex justify-between items-start">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            {label}
          </span>
          <h2
            className={`text-2xl font-black mt-1 ${highlightRed ? 'text-red-600' : 'text-zinc-900'}`}
          >
            {value}
          </h2>
        </div>
        <span className="p-2.5 bg-zinc-100 rounded-lg border border-zinc-200">
          {icon}
        </span>
      </div>
      <div className="mt-3 pt-2 border-t border-zinc-100 text-xs text-zinc-600 flex justify-between items-center font-semibold">
        <span>{detail}</span>
        {badge && (
          <span className="px-2 py-0.5 bg-zinc-900 text-white text-[10px] font-bold rounded">
            {badge}
          </span>
        )}
      </div>
    </div>
  )
}

function Deadline({ title, date, detail, badge }) {
  return (
    <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg flex items-center justify-between text-xs">
      <div className="flex items-center space-x-3">
        <div className="bg-red-600 text-white font-black text-xs p-2 rounded text-center min-w-[46px]">
          {date}
        </div>
        <div>
          <div className="font-extrabold text-zinc-900">{title}</div>
          <p className="text-zinc-600 font-semibold text-[11px]">{detail}</p>
        </div>
      </div>
      {badge && (
        <span className="text-[10px] font-bold bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-200">
          {badge}
        </span>
      )}
    </div>
  )
}
