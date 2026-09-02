import React, { useState, useEffect } from 'react'
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
  Building2,
  Info,
  ChevronRight,
  UploadCloud,
  FileText,
  Edit2,
  Save,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { fetchWithAuth } from '../../utils/api'

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

  // Fallback / mock tax calculation data
  const tax = data?.tax || {
    outputVAT: 0,
    inputVAT: 0,
    netVATPayable: 0,
    wtExpanded: 0,
    wtCreditable: 0,
  }

  const vatBase = Number(tax.outputVAT || 0) / 0.12
  const inputBase = Number(tax.inputVAT || 0) / 0.12
  const ewtTotal = Number(tax.wtExpanded || 0)
  const cwtTotal = Number(tax.wtCreditable || 0)

  // Fetch tax data from journal entries when date range changes
  useEffect(() => {
    const fetchTaxData = async () => {
      try {
        setLoading(true)
        setFetchError('')

        const params = new URLSearchParams({
          start_date: submittedRange.start,
          end_date: submittedRange.end,
        })

        const response = await fetchWithAuth(
          `/tax-compliance/calculate-tax?${params.toString()}`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          },
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
  }, [submittedRange])

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

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to save draft')

      setDraftId(data.id)
      actionNotice(`✓ Draft saved successfully (ID: ${data.id})`)
    } catch (error) {
      actionNotice(`✗ Failed to save draft: ${error.message}`)
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
        `✓ PDF exported as BIR_Form_${activeForm}_${submittedRange.start}.pdf`,
      )
    } catch (error) {
      actionNotice(`✗ PDF export failed: ${error.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  const exportDAT = async () => {
    setIsExporting(true)
    try {
      const payload = {
        formType: activeForm,
        dateRange: submittedRange,
        formRows: formRows[activeForm].map((row, idx) => [
          row[0],
          getFormValue(activeForm, idx, 'base'),
          getFormValue(activeForm, idx, 'tax'),
        ]),
      }

      const response = await fetchWithAuth('/tax-compliance/export-dat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error('Failed to export DAT')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `SAWT_${activeForm}_${submittedRange.start}.dat`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      actionNotice(`✓ DAT file exported (SAWT format)`)
    } catch (error) {
      actionNotice(`✗ DAT export failed: ${error.message}`)
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

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to mark as filed')

      actionNotice(`✓ BIR Form ${activeForm} marked as FILED`)
    } catch (error) {
      actionNotice(`✗ Failed to mark as filed: ${error.message}`)
    }
  }

  const formRows = {
    '2550M': [
      ['Vatable Sales / Receipts (Private)', vatBase, tax.outputVAT],
      ['Less: Allowable Input Tax on Purchases', inputBase, tax.inputVAT],
      ['Net VAT Payable / (Overpayment)', null, tax.netVATPayable],
    ],
    '0619E': [['Total Expanded Withholding Tax Payable', 0, ewtTotal]],
    2307: [['Total Creditable Tax Certificates Claimed', 0, cwtTotal]],
    '1601EQ': [['Total Quarterly EWT Remittance Liability', 0, ewtTotal]],
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans antialiased">
      {/* Embedded Print Styling */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-bir-area, #printable-bir-area * {
            visibility: visible;
          }
          #printable-bir-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
        .bir-border { border: 1.5px solid #000; }
        .bir-border-b { border-bottom: 1.5px solid #000; }
        .bir-bg-header { background-color: #18181b; color: #ffffff; }
        .bir-box-num { font-size: 11px; font-weight: 800; color: #dc2626; }
      `}</style>

      <main className="max-w-8xl mx-auto space-y-6">
        {/* Streamlined Single-Line Executive Header with Larger Legible Text */}
        <section className="bg-white rounded-xl border border-zinc-300 p-4 shadow-sm no-print">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Left: Title & Org info */}
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-zinc-900 text-white rounded-lg shadow-sm">
                <Landmark className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <div className="flex items-center space-x-2.5">
                  <h1 className="text-base font-extrabold text-zinc-900">
                    Tax & Compliance Status
                  </h1>
                  <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wider bg-red-100 text-red-700 rounded-md">
                    RDO 057
                  </span>
                </div>
                <p className="text-xs font-medium text-zinc-600 mt-0.5">
                  ACME FINANCIAL TECHNOLOGIES INC. • TIN:{' '}
                  <span className="font-mono text-zinc-900 font-bold">
                    008-123-456-00000
                  </span>
                </p>
              </div>
            </div>

            {/* Center: Date Range Filter Form */}
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

            {/* Right: Toggle Button */}
            <button
              type="button"
              onClick={() => setShowOfficialForm((value) => !value)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm self-start lg:self-auto"
            >
              {showOfficialForm ? <EyeOff size={16} /> : <Eye size={16} />}
              {showOfficialForm ? 'Hide Official Form' : 'Preview Form'}
            </button>
          </div>
        </section>

        {/* Loading State */}
        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3 no-print">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <span className="text-sm font-semibold text-blue-900">
              Fetching tax data from journal entries...
            </span>
          </div>
        )}

        {/* Error Banner */}
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

        {/* KPI Cards Row */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
          <SummaryCard
            icon={<Receipt className="text-red-600" size={22} />}
            label="Net VAT Liability"
            value={formatPHP(tax.netVATPayable)}
            detail={`Output: ${formatPHP(tax.outputVAT)} | Input: ${formatPHP(tax.inputVAT)}`}
            accentBorder="border-zinc-200"
            highlightRed={true}
          />

          <SummaryCard
            icon={<HandCoins className="text-zinc-900" size={22} />}
            label="EWT Payable (Form 0619-E)"
            value={formatPHP(ewtTotal)}
            detail="Due Date: Oct 10, 2026"
            badge="Remittance"
            accentBorder="border-zinc-200"
          />

          <SummaryCard
            icon={<FileCheck2 className="text-zinc-900" size={22} />}
            label="Tax Credits (Form 2307)"
            value={formatPHP(cwtTotal)}
            detail="3 Verified Certificates"
            accentBorder="border-zinc-200"
          />

          {/* Featured Total BIR Payable Card */}
          <div className="bg-zinc-900 text-white rounded-xl border border-zinc-800 p-4 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">
                  Total BIR Payable
                </span>
                <h2 className="text-2xl font-black text-white mt-1">
                  {formatPHP(Number(tax.netVATPayable || 0) + ewtTotal)}
                </h2>
              </div>
              <div className="p-2 bg-red-600 text-white rounded-lg shadow-sm">
                <Scale size={22} />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-zinc-800 text-xs flex justify-between items-center text-zinc-200 font-semibold">
              <span>Status: Ready for eFPS</span>
              <span className="bg-red-600 text-white font-black px-2 py-0.5 rounded text-[11px]">
                12 Days Left
              </span>
            </div>
          </div>
        </section>

        {/* 2-Column Split Layout */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
          {/* LEFT SIDE (7 Columns): Operational Workspace */}
          <div
            className={`${showOfficialForm ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-6`}
          >
            {/* Form Selection Tabs */}
            <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <FileSpreadsheet className="w-4 h-4 text-red-600" />
                <h2 className="text-sm font-bold text-zinc-900">
                  Select Tax Declaration Return
                </h2>
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

            {/* Main Calculation Breakdown Table */}
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
                      <th className="p-3.5">Line Item Description</th>
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
                              value={
                                getFormValue(activeForm, idx, 'base') === null
                                  ? ''
                                  : getFormValue(activeForm, idx, 'base')
                              }
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
                              value={
                                getFormValue(activeForm, idx, 'tax') === null
                                  ? ''
                                  : getFormValue(activeForm, idx, 'tax')
                              }
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
                  </tbody>
                </table>
              </div>

              {/* Action Toolbar */}
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
                      disabled={isExporting}
                      onClick={exportDAT}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700 shadow-sm transition-colors disabled:opacity-50"
                    >
                      {isExporting ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <FileSpreadsheet size={15} />
                      )}
                      {isExporting ? 'Exporting...' : 'Export DAT (SAWT)'}
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

            {/* Supporting Schedule Alphalist Breakdown Table */}
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

              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4 bg-zinc-50 p-4 rounded-lg border border-zinc-200">
                  <div>
                    <p className="text-xs font-bold text-zinc-600 uppercase">
                      Output VAT (Sales)
                    </p>
                    <p className="text-lg font-black text-red-600 mt-1">
                      {formatPHP(tax.outputVAT)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-600 uppercase">
                      Input VAT (Purchases)
                    </p>
                    <p className="text-lg font-black text-zinc-900 mt-1">
                      {formatPHP(tax.inputVAT)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-600 uppercase">
                      Net VAT Payable
                    </p>
                    <p className="text-lg font-black text-red-600 mt-1">
                      {formatPHP(tax.netVATPayable)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-600 uppercase">
                      EWT Payable
                    </p>
                    <p className="text-lg font-black text-zinc-900 mt-1">
                      {formatPHP(ewtTotal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-600 uppercase">
                      CWT Creditable
                    </p>
                    <p className="text-lg font-black text-zinc-900 mt-1">
                      {formatPHP(cwtTotal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-600 uppercase">
                      Total Liability
                    </p>
                    <p className="text-lg font-black text-red-600 mt-1">
                      {formatPHP(Number(tax.netVATPayable || 0) + ewtTotal)}
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-900 font-semibold">
                    <Info className="inline w-4 h-4 mr-1" />
                    All amounts are calculated from actual journal entries. Edit form
                    values above to adjust before filing.
                  </p>
                </div>
              </div>
            </div>

            {/* Submissions & Deadlines Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Compliance Schedule */}
              <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm space-y-3">
                <h3 className="font-bold text-sm border-b border-zinc-100 pb-2 text-zinc-900 flex items-center">
                  <Calendar className="w-4 h-4 text-red-600 mr-1.5" />
                  Upcoming Filing Schedule
                </h3>
                <div className="space-y-2">
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

              {/* BIR Tools & Enrollment */}
              <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm space-y-3 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-sm border-b border-zinc-100 pb-2 text-zinc-900 flex items-center">
                    <UploadCloud className="w-4 h-4 text-red-600 mr-1.5" />
                    eSubmission Tools
                  </h3>
                  <div className="space-y-2 mt-2">
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={exportDAT}
                      className="w-full text-left px-3.5 py-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-lg text-xs font-bold text-zinc-900 flex items-center justify-between transition-colors disabled:opacity-50"
                    >
                      <span className="flex items-center">
                        {isExporting ? (
                          <Loader2 className="w-4 h-4 text-red-600 mr-2 animate-spin" />
                        ) : (
                          <FileSpreadsheet className="w-4 h-4 text-red-600 mr-2" />
                        )}
                        Export SAWT (.DAT File)
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                    </button>
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={exportPDF}
                      className="w-full text-left px-3.5 py-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-lg text-xs font-bold text-zinc-900 flex items-center justify-between transition-colors disabled:opacity-50"
                    >
                      <span className="flex items-center">
                        {isExporting ? (
                          <Loader2 className="w-4 h-4 text-zinc-900 mr-2 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4 text-zinc-900 mr-2" />
                        )}
                        Download Form PDF
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                    </button>
                  </div>
                </div>

                <div className="bg-zinc-900 rounded-lg p-3 text-white text-xs space-y-1 mt-2">
                  <div className="font-bold flex items-center text-white">
                    <ShieldCheck className="w-4 h-4 text-red-500 mr-1.5" /> eFPS
                    Registered
                  </div>
                  <p className="text-xs text-zinc-300 font-medium">
                    Returns are calculated and ready for transmission to eFPS.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE (5 Columns): Dedicated Official BIR Paper Form Preview */}
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

              {/* Authentic Paper Form Replica with dynamic form rows */}
              <div className="bir-border p-4 bg-white font-sans text-xs text-black space-y-3">
                {/* Form Header */}
                <div className="text-center bir-border-b pb-2.5">
                  <p className="font-extrabold text-[10px] uppercase tracking-tight text-zinc-800">
                    Republika ng Pilipinas • Kagawaran ng Pananalapi
                    <br />
                    Kawanihan ng Rentas Internas
                  </p>
                  <h3 className="text-lg font-black uppercase tracking-tight mt-1 text-zinc-900">
                    BIR Form {activeForm}
                  </h3>
                  <p className="text-[11px] font-bold text-zinc-800">
                    {activeForm === '2550M' && 'Monthly Value-Added Tax Declaration'}
                    {activeForm === '0619E' &&
                      'Monthly Remittance Return of Creditable Income Taxes Withheld'}
                    {activeForm === '2307' &&
                      'Certificate of Creditable Tax Withheld at Source'}
                    {activeForm === '1601EQ' &&
                      'Quarterly Remittance Return of Creditable Taxes Withheld'}
                  </p>
                  <p className="text-[11px] font-mono font-bold mt-0.5 text-zinc-700">
                    Period Covered: {submittedRange.start} to {submittedRange.end}
                  </p>
                </div>

                {/* Part I Background Info Box */}
                <div className="bir-bg-header p-1.5 font-bold text-[11px] border border-black uppercase tracking-wider">
                  Part I: Background Information
                </div>

                <div className="space-y-1 text-xs border border-black p-2.5 bg-zinc-50 font-medium">
                  <div className="grid grid-cols-12 gap-1 border-b border-zinc-300 pb-1">
                    <span className="col-span-4 font-bold text-zinc-700">TIN:</span>
                    <span className="col-span-8 font-mono font-bold text-black">
                      008-123-456-00000
                    </span>
                  </div>
                  <div className="grid grid-cols-12 gap-1 border-b border-zinc-300 pb-1">
                    <span className="col-span-4 font-bold text-zinc-700">
                      RDO Code:
                    </span>
                    <span className="col-span-8 font-bold text-black">057</span>
                  </div>
                  <div className="grid grid-cols-12 gap-1 border-b border-zinc-300 pb-1">
                    <span className="col-span-4 font-bold text-zinc-700">
                      Taxpayer:
                    </span>
                    <span className="col-span-8 font-black uppercase text-xs text-black">
                      ACME FINANCIAL TECH INC.
                    </span>
                  </div>
                  <div className="grid grid-cols-12 gap-1">
                    <span className="col-span-4 font-bold text-zinc-700">
                      Address:
                    </span>
                    <span className="col-span-8 text-xs font-semibold text-black">
                      Santa Rosa City, Laguna
                    </span>
                  </div>
                </div>

                {/* Part II Computation Summary */}
                <div className="bir-bg-header p-1.5 font-bold text-[11px] border border-black uppercase tracking-wider">
                  Part II: Computation of Tax
                </div>

                <table className="w-full border-collapse border border-black text-xs font-medium">
                  <thead>
                    <tr className="bg-zinc-200 border-b border-black font-extrabold text-black">
                      <th className="p-1.5 text-left border-r border-black">
                        Line Item Description
                      </th>
                      <th className="p-1.5 text-right">Amount (PHP)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black font-mono">
                    {formRows[activeForm].map((row, idx) => (
                      <tr key={idx}>
                        <td className="p-1.5 border-r border-black font-sans font-semibold text-black">
                          {row[0]}
                        </td>
                        <td
                          className={`p-1.5 text-right font-bold ${idx === formRows[activeForm].length - 1 ? 'text-red-700 font-black' : 'text-black'}`}
                        >
                          {row[1] === null ? formatPHP(row[2]) : formatPHP(row[2])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Signature Line */}
                <div className="pt-6 mt-3 border-t border-dashed border-zinc-400 text-center text-xs">
                  <div className="font-extrabold uppercase border-b-2 border-black pb-0.5 inline-block px-10 text-black">
                    JUAN DELA CRUZ
                  </div>
                  <p className="text-zinc-700 font-semibold mt-1">
                    Authorized Officer / Representative Signature
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Action Toast Notice */}
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

function SummaryCard({
  icon,
  label,
  value,
  detail,
  accentBorder = 'border-zinc-200',
  badge,
  highlightRed,
}) {
  return (
    <div
      className={`bg-white rounded-xl border ${accentBorder} p-4 shadow-sm hover:border-zinc-300 transition-all`}
    >
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
