import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Wallet,
  FileText,
  Paperclip,
  Calculator,
  Layers,
  Landmark,
  Minus,
  Search,
  ChevronDown,
  ChevronUp,
  Receipt,
  Divide,
} from 'lucide-react'
import ReactDOM from 'react-dom'
import DynamicToast from '../../components/DynamicToast'
import RightSideModal from '../../components/RightSideModal'
import useResponsibilityCenter from '../responsibility_center/useResponsibilityCenter'
import {
  useDisbursementForm,
  useDragToScroll,
  fmt,
  findDefaultVatOption,
  findDefaultWhtOption,
} from './useDisbursements'

// ─────────────────────────────────────────────────────────────────────────────
// Portal Dropdown
// ─────────────────────────────────────────────────────────────────────────────
const MIN_DROPDOWN_WIDTH = 260

function PortalDropdown({ anchorRef, open, children }) {
  const [style, setStyle] = useState({})

  useEffect(() => {
    if (!open || !anchorRef.current) return
    const update = () => {
      const rect = anchorRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const spaceBelow = viewportHeight - rect.bottom
      const spaceAbove = rect.top
      const dropdownMaxH = 240
      const width = Math.max(rect.width, MIN_DROPDOWN_WIDTH)
      let top, maxHeight
      if (spaceBelow >= Math.min(dropdownMaxH, 160) || spaceBelow >= spaceAbove) {
        top = rect.bottom + window.scrollY + 4
        maxHeight = Math.min(dropdownMaxH, spaceBelow - 8)
      } else {
        maxHeight = Math.min(dropdownMaxH, spaceAbove - 8)
        top = rect.top + window.scrollY - maxHeight - 4
      }
      let left = rect.left + window.scrollX
      if (left + width > window.innerWidth - 8)
        left = window.innerWidth - width - 8 + window.scrollX
      setStyle({ top, left, width, maxHeight })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, anchorRef])

  if (!open) return null
  return ReactDOM.createPortal(
    <div
      style={{
        position: 'absolute',
        top: style.top,
        left: style.left,
        width: style.width,
        maxHeight: style.maxHeight,
        zIndex: 99999,
        overflowY: 'auto',
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        boxShadow: '0 10px 40px -6px rgba(0,0,0,0.18)',
      }}
    >
      {children}
    </div>,
    document.body,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable SearchableDropdown
// ─────────────────────────────────────────────────────────────────────────────
function SearchableDropdown({
  placeholder,
  value,
  onChange,
  onSelect,
  options,
  inputClassName,
  emptyText = 'No results found',
  disabled = false,
  onFocus,
  dropdownFooter,
}) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef(null)
  const closeTimer = useRef(null)
  const filtered = options.filter(
    (o) =>
      !value ||
      o.label.toLowerCase().includes(value.toLowerCase()) ||
      (o.sublabel || '').toLowerCase().includes(value.toLowerCase()),
  )
  const handleBlur = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 180)
  }
  const handleFocus = () => {
    if (!disabled) {
      clearTimeout(closeTimer.current)
      setOpen(true)
      if (onFocus) onFocus()
    }
  }
  const handleSelect = (opt) => {
    if (!disabled) {
      clearTimeout(closeTimer.current)
      onSelect(opt)
      setOpen(false)
    }
  }

  if (disabled) {
    return (
      <div className="relative w-full">
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          readOnly
          className={`${inputClassName} cursor-not-allowed text-black`}
          autoComplete="off"
        />
      </div>
    )
  }

  return (
    <div ref={anchorRef} className="relative w-full">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={inputClassName}
        autoComplete="off"
      />
      <PortalDropdown anchorRef={anchorRef} open={open}>
        {filtered.length > 0 ? (
          filtered.map((opt, i) => (
            <div
              key={opt.value ?? i}
              onMouseDown={(e) => {
                e.preventDefault()
                handleSelect(opt)
              }}
              className="flex items-center justify-between gap-2 px-3 py-2 text-[12px] font-bold hover:bg-red-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0 text-black"
            >
              <span className="truncate flex-1">{opt.label}</span>
              {opt.sublabel && (
                <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide flex-shrink-0">
                  {opt.sublabel}
                </span>
              )}
            </div>
          ))
        ) : (
          <div className="px-3 py-3 text-[12px] text-gray-400 text-center">
            {emptyText}
          </div>
        )}
        {dropdownFooter && (
          <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
            {React.cloneElement(dropdownFooter, {
              onClick: (e) => {
                if (dropdownFooter.props.onClick) {
                  dropdownFooter.props.onClick(e)
                }
                setOpen(false)
              },
            })}
          </div>
        )}
      </PortalDropdown>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────
// Format price for display (adds commas to integers, allows unlimited decimals)
const formatPriceDisplay = (value) => {
  if (value === '' || value === null || value === undefined) return ''

  // Ensure we are working with a string
  const stringValue = String(value)

  // Split the integer part and the decimal part
  const parts = stringValue.split('.')
  const integerPart = parts[0]
  const decimalPart = parts.length > 1 ? parts[1] : null

  // Add commas to the integer part (e.g., 98732123 -> 98,732,123)
  let formattedInteger = ''
  if (integerPart) {
    // Regex to add commas every 3 digits
    formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  // If the user typed a dot, reattach the dot and all exact decimal digits
  if (decimalPart !== null) {
    return `${formattedInteger}.${decimalPart}`
  }

  return formattedInteger
}

// Parse price input (keeps it as a safe string to preserve dots and zeros)
const parsePriceInput = (input) => {
  if (input === '' || input === null || input === undefined) return ''

  // Strip everything except digits and the decimal dot
  let cleaned = String(input).replace(/[^0-9.]/g, '')

  // Prevent multiple decimal dots (e.g., 1.2.3 becomes 1.23)
  const parts = cleaned.split('.')
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('')
  }

  // Return as a STRING so React doesn't delete trailing dots or zeros while typing
  return cleaned
}
// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function CashDisbursementForm({
  onBack,
  onSuccess,
  isViewMode = false,
  isEditMode = false,
  disbursementData = null,
}) {
  const {
    disbursementItems,
    journalEntries,
    attachments,
    toast,
    setToast,
    imageModal,
    setImageModal,
    vendors,
    vendorLoading,
    vendorError,
    selectedVendor,
    vendorSearch,
    setSelectedVendor,
    setVendorSearch,
    createVendor,
    createProduct,
    chartsOfAccounts,
    coaLoading,
    coaError,
    products,
    productLoading,
    productError,
    vatOptions,
    vatLoading,
    vatError,
    whtOptions,
    whtLoading,
    whtError,
    modeOfPayment,
    setModeOfPayment,
    modeSearch,
    setModeSearch,
    bankName,
    setBankName,
    checkNumber,
    setCheckNumber,
    documentReference,
    setDocumentReference,
    paymentDate,
    setPaymentDate,
    remarks,
    setRemarks,
    coaOptions,
    vendorOptions,
    productOptions,
    addDisbursementItem,
    removeDisbursementItem,
    updateDisbursementItem,
    addJournalEntry,
    removeJournalEntry,
    updateJournalEntry,
    addAttachment,
    removeAttachment,
    updateAttachment,
    handleFileChange,
    loadVatOnDemand,
    loadWhtOnDemand,
    handlePostTransaction,
    summary,
  } = useDisbursementForm({
    isViewMode,
    isEditMode,
    disbursementData,
    onBack,
    onSuccess,
  })

  const {
    responsibilityCenters,
    loading: responsibilityCentersLoading,
    error: responsibilityCentersError,
  } = useResponsibilityCenter()

  const responsibilityCenterOptions = responsibilityCenters.map((center) => ({
    label: center.name || '',
    sublabel: center.department || '',
    value: center.name || '',
  }))

  const [bulkResponsibilityCenter, setBulkResponsibilityCenter] = useState('')

  const [isDisbursementItemsCollapsed, setIsDisbursementItemsCollapsed] = useState(false)
  const [isJournalEntriesCollapsed, setIsJournalEntriesCollapsed] = useState(false)
  const [isBasicDetailsCollapsed, setIsBasicDetailsCollapsed] = useState(false)

  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false)
  const [vendorCreateLoading, setVendorCreateLoading] = useState(false)
  const [vendorForm, setVendorForm] = useState({
    code: '',
    name: '',
    category: '',
    type: '',
    address: '',
    tin: '',
    details: '',
    contact: '',
    status: 'active',
  })

  const formatTinInput = (value) => {
    const digits = String(value || '')
      .replace(/\D/g, '')
      .slice(0, 14)

    if (digits.length === 0) return ''
    if (digits.length <= 3) return digits

    const parts = []
    // 3-3-3-5 format
    parts.push(digits.slice(0, 3))
    if (digits.length > 3) parts.push(digits.slice(3, 6))
    if (digits.length > 6) parts.push(digits.slice(6, 9))
    if (digits.length > 9) parts.push(digits.slice(9, 14))

    return parts.join('-')
  }

  const calculateJournalBalance = () => {
    const totalDebit = journalEntries.reduce(
      (s, e) => s + (parseFloat(e.debit) || 0),
      0,
    )
    const totalCredit = journalEntries.reduce(
      (s, e) => s + (parseFloat(e.credit) || 0),
      0,
    )
    return {
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
      totalDebit,
      totalCredit,
    }
  }

  const openVendorModal = () => {
    setVendorForm({
      code: '',
      name: '',
      category: '',
      type: '',
      address: '',
      tin: '',
      details: '',
      contact: '',
      status: 'active',
    })
    setIsVendorModalOpen(true)
  }

  const closeVendorModal = () => {
    setIsVendorModalOpen(false)
    setVendorForm({
      code: '',
      name: '',
      category: '',
      type: '',
      address: '',
      tin: '',
      details: '',
      contact: '',
      status: 'active',
    })
  }

  const handleVendorFormSubmit = async (e) => {
    e.preventDefault()
    setVendorCreateLoading(true)
    const payload = {
      ...vendorForm,
      tin: vendorForm.tin?.replace(/\D/g, '').slice(0, 14),
      contact: vendorForm.contact?.slice(0, 15),
    }
    const result = await createVendor(payload)
    setVendorCreateLoading(false)

    if (!result.success) {
      setToast({
        type: 'error',
        message: result.message || 'Failed to create vendor',
      })
      return
    }

    const createdVendor = result.data
    setSelectedVendor(createdVendor.id || '')
    setVendorSearch(createdVendor.name || createdVendor.code || '')
    setToast({
      type: 'success',
      message: `Vendor "${createdVendor.name || createdVendor.code}" added successfully.`,
    })
    closeVendorModal()
  }

  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [productCreateLoading, setProductCreateLoading] = useState(false)
  const [productForm, setProductForm] = useState({
    code: '',
    name: '',
    type: '',
    category: '',
    sales_price: '',
    purchase_price: '',
    unit: '',
  })

  const openProductModal = () => {
    setProductForm({
      code: '',
      name: '',
      type: '',
      category: '',
      sales_price: '',
      purchase_price: '',
      unit: '',
    })
    setIsProductModalOpen(true)
  }

  const closeProductModal = () => {
    setIsProductModalOpen(false)
    setProductForm({
      code: '',
      name: '',
      type: '',
      category: '',
      sales_price: '',
      purchase_price: '',
      unit: '',
    })
  }

  const handleProductFormSubmit = async (e) => {
    e.preventDefault()
    setProductCreateLoading(true)
    const result = await createProduct(productForm)
    setProductCreateLoading(false)

    if (!result.success) {
      setToast({
        type: 'error',
        message: result.message || 'Failed to create product',
      })
      return
    }

    const createdProduct = result.data
    const currentItemId = disbursementItems[disbursementItems.length - 1]?.id
    if (currentItemId) {
      updateDisbursementItem(currentItemId, 'productId', createdProduct.id || '')
      updateDisbursementItem(
        currentItemId,
        'productSearch',
        createdProduct.name || createdProduct.code || '',
      )
    }
    setToast({
      type: 'success',
      message: `Product "${createdProduct.name || createdProduct.code}" added successfully.`,
    })
    closeProductModal()
  }

  const modeOfPaymentOptions = [
    'CASH',
    'CHECK',
    'BANK_TRANSFER',
    'CARD',
    'E-WALLET',
    'OTHERS',
  ]

  const inputBase =
    'w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ' +
    (isViewMode
      ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed'
      : 'bg-gray-50 border border-gray-200 text-black focus:ring-1 focus:ring-red-500 text-center')
  const tableInput =
    'w-full rounded-md px-1 py-1 text-[13px] font-bold text-center outline-none ' +
    (isViewMode
      ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed'
      : 'bg-gray-50/50 border border-gray-200 focus:ring-1 focus:ring-red-400')
  const pctInput = tableInput + ' pr-1'

  const fadeInUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  }
  const disbursementItemsScrollRef = useDragToScroll()

  return (
    <div className="h-full flex flex-col overflow-x-hidden bg-[#F3F4F6]">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-table-scroller::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-table-scroller::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        .custom-table-scroller::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 10px; }
        .custom-table-scroller::-webkit-scrollbar-thumb:hover { background: #dc2626; }
        .sidebar-scroll::-webkit-scrollbar { width: 4px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
        .summary-tooltip { display: none; }
        .summary-row:hover .summary-tooltip { display: block; }
      `,
        }}
      />

      {toast && (
        <DynamicToast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* TOP NAV */}
      <div className="flex items-center justify-between flex-shrink-0 mb-2">
        <nav
          className="cursor-pointer px-4 py-2 bg-gray-600 text-white text-[12px] font-black rounded-lg hover:bg-gray-700 transition-all uppercase tracking-[2px] flex items-center gap-2 shadow-md shadow-gray-200"
          onClick={onBack}
        >
          <ArrowLeft size={17} />
          <span className="text-white"> Go Back</span>
        </nav>
        {!isViewMode && (
          <div className="flex gap-4">
            <button className="px-4 py-2 bg-white border border-gray-200 text-[12px] font-black text-gray-400 rounded-lg hover:bg-gray-50 transition-all uppercase">
              Save Draft
            </button>
            <button
              onClick={handlePostTransaction}
              className="px-6 py-2 bg-green-600 text-white text-[12px] font-black rounded-lg hover:bg-green-700 transition-all uppercase tracking-[2px] flex items-center gap-2 shadow-md shadow-green-200"
            >
              <Save size={14} /> Post Transaction
            </button>
          </div>
        )}
      </div>

      {/* BODY */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex gap-2 min-h-0">
          {/* LEFT SIDEBAR - SUMMARY */}
          <aside className="w-full flex-shrink-0 flex flex-col gap-2 h-full max-w-[18%]">
            <section className="bg-white rounded-xl border border-red-200 shadow-md overflow-hidden flex-1 flex flex-col min-h-0">
              {/* Prominent Header */}
              <div className="px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white flex items-center justify-between border-b border-red-800 shadow-sm flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Calculator size={18} className="text-red-100" />
                  <h3 className="text-sm font-bold tracking-tight">Financial Summary</h3>
                </div>
                <span className="text-xs bg-zinc-900 text-zinc-100 px-2.5 py-0.5 rounded-full border border-zinc-800 font-mono font-semibold">
                  PHP (₱)
                </span>
              </div>

              {/* Financial Summary Items */}
              <div className="custom-table-scroller overflow-y-auto min-h-0 flex-1 custom-scrollbar p-3.5 py-2 space-y-1.5">
                {/* 1. Total Purchase Price */}
                <SummaryRow
                  label="Total Purchase Price:"
                  value={fmt(summary.totalPurchasePrice)}
                />

                {/* 2. Total Discount (-) */}
                <SummaryRow
                  label="Total Discount:"
                  value={fmt(summary.totalDiscount)}
                  badge="(-)"
                  badgeColor="text-red-500"
                  valuePrefix="-"
                  textColor="text-red-600"
                />

                {/* 3. Total Discounted Amount - Red Left Border + Bottom Zinc Line */}
                <SummaryRow
                  label="Total Discounted Amount:"
                  value={fmt(summary.totalDiscounted)}
                  containerClassName="p-2 rounded-md bg-red-50/70 border-l-3 border-red-500 my-1"
                />

                {/* 4. Total Output VAT (+) - Border explicitly removed (border-b-0) */}
                <SummaryRow
                  label="Total VAT (%):"
                  value={fmt(summary.totalVAT)}
                  badge="(+)"
                  badgeColor="text-zinc-400"
                  containerClassName="py-1 border-b-0"
                />

                {/* TAXABLE CATEGORY BREAKDOWN */}
                <div className="bg-zinc-50 border border-zinc-200/80 rounded-md p-2 space-y-1 my-1">
                  <div className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1">
                    <Receipt size={20} className="text-red-600" /> Taxable Breakdown
                  </div>
                  <hr />
                  <SummaryRow
                    label="VATable Purchases:"
                    value={fmt(summary.vatablePurchases)}
                    isNested
                  />
                  <SummaryRow
                    label="VAT-Exempt Purchases:"
                    value={fmt(summary.vatExemptPurchases)}
                    isNested
                  />
                  <SummaryRow
                    label="Zero Rated Purchases:"
                    value={fmt(summary.zeroRatedPurchases)}
                    isNested
                  />
                  <SummaryRow
                    label="Total Non-VAT Discount:"
                    value={fmt(summary.totalNoVatDiscount)}
                    textColor="text-zinc-500"
                    isNested
                  />
                </div>

                {/* 5. Total Net of VAT */}
                <SummaryRow
                  label="Total Net of VAT:"
                  value={fmt(summary.totalNetOfVat)}
                />

                {/* 6. Total Withholding Tax (-) */}
                <SummaryRow
                  label="Total Withholding Tax (WHT):"
                  value={fmt(summary.totalWHT)}
                  badge="(-)"
                  badgeColor="text-red-500"
                  valuePrefix="-"
                  textColor="text-red-600"
                />
              </div>

              {/* TOTAL AMOUNT HERO BOX */}
              <div className="p-3.5 pt-1 flex-shrink-0">
                <div className="h-[2px] w-full bg-red-600 rounded-full mb-2" />

                <div className="p-3 bg-gradient-to-br from-red-600 via-red-600 to-red-700 rounded-lg text-white shadow-md border-l-4 border-zinc-900 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-1">
                    <span className="bg-zinc-900 text-zinc-100 px-2.5 py-0.5 rounded text-xs font-black tracking-wider uppercase border border-zinc-800 shadow-sm flex items-center gap-1">
                      <Wallet size={11} className="text-red-500" />
                      TOTAL AMOUNT
                    </span>
                  </div>

                  <div className="text-right w-full min-w-0">
                    <TotalHeroAmount value={summary.totalAmountDue} fmt={fmt} />

                    <p className="text-xs text-red-100/90 mt-0.5 font-medium">
                      Amount to be disbursed
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </aside>

          {/* MAIN CONTENT */}
          <main className="flex-1 overflow-y-auto custom-table-scroller space-y-4 pr-1 min-h-0">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="space-y-4"
            >
              {/* BASIC DETAILS */}
              <section className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-zinc-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-semibold text-sm">
                      <Landmark size={14} />
                    </div>
                    <h2 className="text-base font-bold tracking-tight">Basic Details</h2>
                  </div>
                  <button
                    onClick={() => setIsBasicDetailsCollapsed(!isBasicDetailsCollapsed)}
                    className="text-white bg-red-600 hover:bg-red-700 p-2 rounded-lg transition-colors"
                    title={isBasicDetailsCollapsed ? 'Expand' : 'Collapse'}
                  >
                    {isBasicDetailsCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  </button>
                </div>
                {!isBasicDetailsCollapsed && (
                  <div className="p-4">
                  <div className={`grid gap-4 ${modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-4'}`}>
                    {/* Vendor Selection */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Vendor / Payee <span className="text-red-500">*</span>
                      </label>
                      {isViewMode ? (
                        <div className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800">
                          {vendorSearch || 'No vendor selected'}
                        </div>
                      ) : vendorLoading ? (
                        <div className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800">
                          Loading vendors...
                        </div>
                      ) : (
                        <SearchableDropdown
                          placeholder="Select Vendor..."
                          value={vendorSearch}
                          onChange={(v) => {
                            setVendorSearch(v)
                            setSelectedVendor('')
                          }}
                          onSelect={(opt) => {
                            setSelectedVendor(opt.value)
                            setVendorSearch(opt.label)
                          }}
                          options={vendorOptions}
                          inputClassName={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${!vendorSearch ? 'border-red-500' : 'border-zinc-300'}`}
                          emptyText={vendorError || 'No vendors found'}
                          onFocus={() => {
                            if (!vendorSearch && vendorOptions.length === 0) {
                              setVendorSearch('')
                            }
                          }}
                          dropdownFooter={
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={openVendorModal}
                              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-black text-white text-[11px] font-black rounded-xl hover:bg-red-600 transition-all"
                            >
                              <Plus size={12} /> Add Vendor
                            </button>
                          }
                        />
                      )}
                    </div>

                    {/* Reference Number */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Reference
                      </label>
                      <input
                        type="text"
                        placeholder="Reference"
                        value={documentReference}
                        onChange={(e) => setDocumentReference(e.target.value)}
                        disabled={isViewMode}
                        className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''} ${!documentReference ? 'border-red-500' : 'border-zinc-300'}`}
                      />
                    </div>

                    {/* Mode of Payment */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Mode of Payment <span className="text-red-500">*</span>
                      </label>
                      {isViewMode ? (
                        <div className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800">
                          {modeSearch || 'No mode selected'}
                        </div>
                      ) : (
                        <SearchableDropdown
                          placeholder="Select Mode..."
                          value={modeSearch}
                          onChange={(v) => {
                            setModeSearch(v)
                            setModeOfPayment('')
                          }}
                          onSelect={(opt) => {
                            setModeOfPayment(opt.value)
                            setModeSearch(opt.label)
                          }}
                          options={modeOfPaymentOptions.map((m) => ({ label: m, value: m }))}
                          inputClassName={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${!modeOfPayment ? 'border-red-500' : 'border-zinc-300'}`}
                          emptyText="No modes found"
                        />
                      )}
                    </div>

                    {/* Payment Date */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Payment Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        disabled={isViewMode}
                        className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''} ${!paymentDate ? 'border-red-500' : 'border-zinc-300'}`}
                      />
                    </div>

                    {/* Bank Name (conditional) */}
                    {(modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Bank Name
                        </label>
                        <input
                          type="text"
                          placeholder="Bank Name"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          disabled={isViewMode}
                          className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                        />
                      </div>
                    )}

                    {/* Check Number (conditional) */}
                    {(modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Check #
                        </label>
                        <input
                          type="text"
                          placeholder="Check #"
                          value={checkNumber}
                          onChange={(e) => setCheckNumber(e.target.value)}
                          disabled={isViewMode}
                          className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                        />
                      </div>
                    )}
                  </div>
                </div>
                )}
              </section>

              {/* 1. DISBURSEMENT ITEMS */}
              <section className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-zinc-900 text-white flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-semibold text-sm">
                      <Wallet size={14} />
                    </div>
                    <div>
                      <h2 className="text-base font-bold tracking-tight">Disbursement Items</h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white pointer-events-none" />
                      <div className="pl-7">
                        <SearchableDropdown
                          placeholder="Resp. Center to All"
                          value={bulkResponsibilityCenter}
                          onChange={setBulkResponsibilityCenter}
                          onSelect={(opt) => {
                            setBulkResponsibilityCenter(opt.value)
                            disbursementItems.forEach((item) =>
                              updateDisbursementItem(
                                item.id,
                                'responsibilityCenter',
                                opt.value,
                              ),
                            )
                            journalEntries.forEach((entry) =>
                              updateJournalEntry(entry.id, 'center', opt.value),
                            )
                          }}
                          options={responsibilityCenterOptions}
                          inputClassName="w-full px-2 py-1.5 rounded-lg text-[11px] font-medium outline-none transition-all bg-zinc-800 border border-white text-white focus:ring-2 focus:ring-red-500"
                          emptyText={
                            responsibilityCentersError ||
                            'No responsibility centers found'
                          }
                          disabled={isViewMode}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => setIsDisbursementItemsCollapsed(!isDisbursementItemsCollapsed)}
                      className="text-white bg-red-600 hover:bg-red-700 p-2 rounded-lg transition-colors"
                      title={isDisbursementItemsCollapsed ? 'Expand' : 'Collapse'}
                    >
                      {isDisbursementItemsCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>
                  </div>
                </div>

                {!isDisbursementItemsCollapsed && (
                  <>
                    <div className="overflow-x-auto custom-scrollbar">
                      <table
                        className="w-full text-left text-xs text-slate-600"
                        style={{ tableLayout: 'fixed', minWidth: 1000 }}
                      >
                        <colgroup>
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '16%' }} />
                          <col style={{ width: '14%' }} />
                          <col style={{ width: '6%' }} />
                          <col style={{ width: '14%' }} />
                          <col style={{ width: '8%' }} />
                          <col style={{ width: '9%' }} />
                          <col style={{ width: '9%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '4%' }} />
                        </colgroup>
                        <thead className="bg-zinc-100 border-b border-zinc-200 uppercase font-bold text-zinc-700 tracking-wider">
                          <tr>
                            <th className="py-3 px-3 min-w-[180px] text-center">Product / Service</th>
                            <th className="py-3 px-2 min-w-[120px] text-center">COA</th>
                            <th className="py-3 px-2 min-w-[150px] text-center">Description</th>
                            <th className="py-3 px-2 w-16 text-center">Qty</th>
                            <th className="py-3 px-2 w-28 text-center">Price (₱)</th>
                            <th className="py-3 px-2 w-24 text-center">Disc (₱)</th>
                            <th className="py-3 px-2 w-20 text-center">Disc Type</th>
                            <th className="py-3 px-2 w-20 text-center">VAT %</th>
                            <th className="py-3 px-2 w-20 text-center">WHT %</th>
                            <th className="py-3 px-2 min-w-[120px] text-center">Resp. Center</th>
                            <th className="py-3 px-2 w-10 text-center"></th>
                          </tr>
                        </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {disbursementItems.map((item) => (
                        <tr
                          key={item.id}
                          className={item.isOther ? 'bg-gray-50/30' : ''}
                        >
                          <td className="py-1 px-1">
                            {item.isOther ? (
                              <div className="cursor-not-allowed text-center text-gray-400 text-[11px] italic py-2" />
                            ) : (
                              <SearchableDropdown
                                disabled={isViewMode}
                                placeholder="Search product..."
                                value={item.productSearch}
                                onChange={(v) =>
                                  updateDisbursementItem(item.id, 'productSearch', v)
                                }
                                onSelect={(opt) => {
                                  updateDisbursementItem(
                                    item.id,
                                    'productId',
                                    opt.value,
                                  )
                                  updateDisbursementItem(
                                    item.id,
                                    'productSearch',
                                    opt.label,
                                  )
                                }}
                                options={productOptions}
                                inputClassName={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                                emptyText={productError || 'No products found'}
                                dropdownFooter={
                                  !isViewMode ? (
                                    <button
                                      onPointerDown={(e) => {
                                        e.preventDefault()
                                      }}
                                      onMouseDown={(e) => {
                                        e.preventDefault()
                                      }}
                                      onClick={() => openProductModal()}
                                      className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-[11px] font-black rounded-lg transition-colors"
                                    >
                                      <Plus size={14} />
                                      Add Product
                                    </button>
                                  ) : null
                                }
                              />
                            )}
                          </td>
                          <td className="py-1 px-1">
                            <SearchableDropdown
                              disabled={isViewMode}
                              placeholder="Search account..."
                              value={item.coaSearch}
                              onChange={(v) =>
                                updateDisbursementItem(item.id, 'coaSearch', v)
                              }
                              onSelect={(opt) => {
                                updateDisbursementItem(item.id, 'coa', opt.value)
                                updateDisbursementItem(
                                  item.id,
                                  'coaSearch',
                                  opt.label,
                                )
                              }}
                              options={coaOptions}
                              inputClassName={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              emptyText="No accounts found"
                            />
                          </td>
                          <td className="py-1 px-1">
                            <input
                              disabled={isViewMode}
                              className={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              placeholder="Details..."
                              value={item.description}
                              onChange={(e) =>
                                updateDisbursementItem(
                                  item.id,
                                  'description',
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="py-1 px-1">
                            <input
                              disabled={isViewMode || item.isOther}
                              type="number"
                              min="0"
                              className={`${tableInput} ${isViewMode || item.isOther ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              placeholder={item.isOther ? '' : '1'}
                              value={item.isOther ? '' : item.qty || ''}
                              onChange={(e) =>
                                updateDisbursementItem(
                                  item.id,
                                  'qty',
                                  e.target.value === ''
                                    ? ''
                                    : parseFloat(e.target.value) || 0,
                                )
                              }
                            />
                          </td>
                          <td className="py-1 px-1">
                            <div className="flex items-center gap-1">
                              <input
                                disabled={isViewMode}
                                className={`${tableInput + ' font-black w-28'} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                                type="text"
                                placeholder="0.00"
                                inputMode="decimal"
                                value={formatPriceDisplay(item.price)}
                                onChange={(e) => {
                                  const parsed = parsePriceInput(e.target.value)
                                  updateDisbursementItem(item.id, 'price', parsed)
                                }}
                              />
                              <select
                                disabled={isViewMode}
                                value={item.vatType || 'VAT-EX'}
                                onChange={(e) => updateDisbursementItem(item.id, 'vatType', e.target.value)}
                                className={`text-[10px] font-bold px-1 py-1 rounded border ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-300' : 'bg-white border-gray-200 text-black focus:ring-1 focus:ring-red-500'} outline-none`}
                              >
                                <option value="VAT-EX">EX</option>
                                <option value="VAT-INC">INC</option>
                              </select>
                            </div>
                          </td>
                          <td className="py-1 px-1">
                            <div className="relative">
                              <input
                                disabled={isViewMode}
                                className={`${tableInput + ' font-black'} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                                type="number"
                                min="0"
                                max={
                                  item.discountType === 'PERCENT' ? '100' : '999999'
                                }
                                step="0.01"
                                placeholder="0"
                                value={
                                  item.discount === null ||
                                  item.discount === undefined
                                    ? ''
                                    : item.discount
                                }
                                onChange={(e) =>
                                  updateDisbursementItem(
                                    item.id,
                                    'discount',
                                    e.target.value === ''
                                      ? null
                                      : parseFloat(e.target.value) || 0,
                                  )
                                }
                              />
                              {item.discountType === 'PERCENT' && (
                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-black pointer-events-none">
                                  %
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-1 px-1">
                            {isViewMode ? (
                              <div
                                className={`${tableInput} text-black py-1.5 text-center`}
                              >
                                {item.discountType === 'PERCENT'
                                  ? 'PERCENT'
                                  : 'FIXED'}
                              </div>
                            ) : (
                              <select
                                value={item.discountType || 'PERCENT'}
                                onChange={(e) =>
                                  updateDisbursementItem(
                                    item.id,
                                    'discountType',
                                    e.target.value,
                                  )
                                }
                                className="w-full px-2 py-1 text-[11px] font-bold border border-gray-200 rounded focus:ring-1 focus:ring-red-400 outline-none"
                              >
                                <option value="PERCENT">PERCENT</option>
                                <option value="FIXED">FIXED</option>
                              </select>
                            )}
                          </td>
                          <td className="py-1 px-1">
                            {isViewMode ? (
                              <div
                                className={`${tableInput} text-black py-1.5 text-center`}
                              >
                                {item.vatSearch}
                              </div>
                            ) : (
                              <SearchableDropdown
                                placeholder="VAT Rate"
                                value={item.vatSearch}
                                onChange={(v) =>
                                  updateDisbursementItem(item.id, 'vatSearch', v)
                                }
                                onFocus={loadVatOnDemand}
                                onSelect={(opt) => {
                                  updateDisbursementItem(item.id, 'vat', opt.value)
                                  updateDisbursementItem(
                                    item.id,
                                    'vatSearch',
                                    opt.label,
                                  )
                                  updateDisbursementItem(
                                    item.id,
                                    'vatRate',
                                    opt.rate,
                                  )
                                }}
                                options={vatOptions}
                                inputClassName={`${pctInput + ' font-black text-red-600'}`}
                                emptyText={vatError || 'No VAT rates found'}
                                disabled={vatLoading}
                              />
                            )}
                          </td>
                          <td className="py-1 px-1">
                            {isViewMode ? (
                              <div
                                className={`${tableInput} text-black py-1.5 text-center`}
                              >
                                {item.whtSearch}
                              </div>
                            ) : (
                              <SearchableDropdown
                                placeholder="WHT Rate"
                                value={item.whtSearch}
                                onChange={(v) =>
                                  updateDisbursementItem(item.id, 'whtSearch', v)
                                }
                                onFocus={loadWhtOnDemand}
                                onSelect={(opt) => {
                                  updateDisbursementItem(item.id, 'wht', opt.value)
                                  updateDisbursementItem(
                                    item.id,
                                    'whtSearch',
                                    opt.label,
                                  )
                                  updateDisbursementItem(
                                    item.id,
                                    'whtRate',
                                    opt.rate,
                                  )
                                }}
                                options={whtOptions}
                                inputClassName={`${pctInput + ' font-black text-blue-600'}`}
                                emptyText={whtError || 'No WHT rates found'}
                                disabled={whtLoading}
                              />
                            )}
                          </td>
                          <td className="py-1 px-1">
                            <SearchableDropdown
                              disabled={isViewMode}
                              placeholder="Select"
                              value={item.responsibilityCenter}
                              onChange={(v) =>
                                updateDisbursementItem(
                                  item.id,
                                  'responsibilityCenter',
                                  v,
                                )
                              }
                              onSelect={(opt) =>
                                updateDisbursementItem(
                                  item.id,
                                  'responsibilityCenter',
                                  opt.value,
                                )
                              }
                              options={responsibilityCenterOptions}
                              inputClassName={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              emptyText={
                                responsibilityCentersError ||
                                'No responsibility centers found'
                              }
                            />
                          </td>
                          <td className="py-1 px-1 text-center">
                            {!isViewMode && (
                              <button
                                onClick={() => removeDisbursementItem(item.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!isViewMode && (
                  <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const defaultVat = findDefaultVatOption(vatOptions)
                          const defaultWht = findDefaultWhtOption(whtOptions)
                          addDisbursementItem(
                            false,
                            defaultVat,
                            defaultWht,
                            bulkResponsibilityCenter,
                          )
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-500 border-dashed text-xs font-bold rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                      >
                        <Plus size={12} /> Add Product / Service
                      </button>
                      <button
                        onClick={() => {
                          const defaultVat = findDefaultVatOption(vatOptions)
                          const defaultWht = findDefaultWhtOption(whtOptions)
                          addDisbursementItem(
                            true,
                            defaultVat,
                            defaultWht,
                            bulkResponsibilityCenter,
                          )
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-300 text-xs font-semibold rounded-lg text-zinc-700 bg-white hover:bg-zinc-100 transition-colors"
                      >
                        <Plus size={12} /> Add Service Line
                      </button>
                    </div>
                    <span className="text-xs text-zinc-500 font-medium">
                      {disbursementItems.length} {disbursementItems.length === 1 ? 'item' : 'items'} added
                    </span>
                  </div>
                )}
                  </>
                )}
              </section>

              {/* 2. JOURNAL ENTRIES */}
              <section className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-zinc-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-semibold text-sm">
                      <Layers size={14} />
                    </div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold tracking-tight">Journal Entries</h2>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-800 text-zinc-100 border border-zinc-700`}>
                        {(() => {
                          const balance = calculateJournalBalance()
                          return balance.isBalanced ? 'Balanced' : 'Unbalanced'
                        })()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsJournalEntriesCollapsed(!isJournalEntriesCollapsed)}
                    className="text-white bg-red-600 hover:bg-red-700 p-2 rounded-lg transition-colors"
                    title={isJournalEntriesCollapsed ? 'Expand' : 'Collapse'}
                  >
                    {isJournalEntriesCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  </button>
                </div>

                {!isJournalEntriesCollapsed && (
                  <div className="">
                    <div className="overflow-x-auto">
                      <table
                        className="w-full text-left text-xs"
                        style={{ tableLayout: 'fixed', minWidth: 600 }}
                      >
                        <colgroup>
                          <col style={{ width: '35%' }} />
                          <col style={{ width: '18%' }} />
                          <col style={{ width: '18%' }} />
                          <col style={{ width: '22%' }} />
                          <col style={{ width: '6%' }} />
                        </colgroup>
                        <thead className="bg-zinc-100 border-b border-zinc-200 uppercase font-bold text-zinc-600 tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3 text-center">Chart of Account</th>
                            <th className="py-2.5 px-3 text-center w-32">Debit (₱)</th>
                            <th className="py-2.5 px-3 text-center w-32">Credit (₱)</th>
                            <th className="py-2.5 px-3 text-center">Responsibility Center</th>
                            <th className="py-2.5 px-3 w-10 text-center"></th>
                          </tr>
                        </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {journalEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td className="py-2 px-3 text-center">
                            <SearchableDropdown
                              disabled={isViewMode}
                              placeholder="Search account..."
                              value={entry.accountSearch}
                              onChange={(v) =>
                                updateJournalEntry(entry.id, 'accountSearch', v)
                              }
                              onSelect={(opt) => {
                                updateJournalEntry(entry.id, 'account', opt.value)
                                updateJournalEntry(
                                  entry.id,
                                  'accountSearch',
                                  opt.label,
                                )
                              }}
                              options={coaOptions}
                              inputClassName={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              emptyText="No accounts found"
                            />
                          </td>
                          <td className="py-2 px-3 text-center font-mono">
                            <input
                              disabled={isViewMode}
                              className={`${tableInput + ' font-black text-center'} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              placeholder="0.00"
                              type="text"
                              inputMode="decimal"
                              value={formatPriceDisplay(entry.debit ?? '')}
                              onChange={(e) => {
                                const parsed = parsePriceInput(e.target.value)
                                updateJournalEntry(
                                  entry.id,
                                  'debit',
                                  parsed === '' ? '' : parseFloat(parsed) || 0,
                                )
                              }}
                            />
                          </td>
                          <td className="py-2 px-3 text-center font-mono">
                            <input
                              disabled={isViewMode}
                              className={`${tableInput + ' font-black text-center text-red-600'} ${isViewMode ? 'bg-transparent text-gray-200 cursor-not-allowed' : ''}`}
                              placeholder="0.00"
                              type="text"
                              inputMode="decimal"
                              value={formatPriceDisplay(entry.credit ?? '')}
                              onChange={(e) => {
                                const parsed = parsePriceInput(e.target.value)
                                updateJournalEntry(
                                  entry.id,
                                  'credit',
                                  parsed === '' ? '' : parseFloat(parsed) || 0,
                                )
                              }}
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <SearchableDropdown
                              disabled={isViewMode}
                              placeholder="Select"
                              value={entry.center}
                              onChange={(v) =>
                                updateJournalEntry(entry.id, 'center', v)
                              }
                              onSelect={(opt) =>
                                updateJournalEntry(entry.id, 'center', opt.value)
                              }
                              options={responsibilityCenterOptions}
                              inputClassName={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              emptyText={
                                responsibilityCentersError ||
                                'No responsibility centers found'
                              }
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            {!isViewMode && (
                              <button
                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                onClick={() => removeJournalEntry(entry.id)}
                              >
                                <Trash2 size={15} className="mx-auto" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-semibold text-slate-900 border-t border-slate-200">
                      {(() => {
                        const balance = calculateJournalBalance()
                        return (
                          <tr>
                            <td colSpan={2} className="py-2.5 px-3 text-right text-xs">Total Ledger Balance:</td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-700 text-xs">{fmt(balance.totalDebit)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-700 text-xs">{fmt(balance.totalCredit)}</td>
                            <td />
                          </tr>
                        )
                      })()}
                    </tfoot>
                  </table>
                </div>
                {!isViewMode && (
                  <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
                    <button
                      onClick={() => addJournalEntry(bulkResponsibilityCenter)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-500 border-dashed text-xs font-bold rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                    >
                      <Plus size={12} /> Add Ledger Row
                    </button>
                    <span className="text-xs text-zinc-500 font-medium">{journalEntries.length} {journalEntries.length === 1 ? 'entry' : 'entries'}</span>
                  </div>
                )}
                  </div>
                )}
              </section>

              {/* 3. ATTACHMENTS & REMARKS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Attachments Card */}
                <section className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-zinc-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Paperclip className="text-red-500" size={16} />
                      <h2 className="text-sm font-bold tracking-tight">Attachments</h2>
                    </div>
                    <span className="text-xs text-zinc-400 font-medium">{attachments.length} {attachments.length === 1 ? 'File' : 'Files'}</span>
                  </div>
                  <div className="p-4">
                    <div className="overflow-x-auto custom-table-scroller">
                      <table
                        className="w-full text-center"
                        style={{ tableLayout: 'fixed', minWidth: 600 }}
                      >
                        <colgroup>
                          <col style={{ width: '25%' }} />
                          <col style={{ width: '25%' }} />
                          <col style={{ width: '25%' }} />
                          <col style={{ width: '15%' }} />
                          <col style={{ width: '10%' }} />
                        </colgroup>
                        <thead>
                          <tr className="border-b border-gray-100">
                            {[
                              'File Name',
                              'File',
                              'Remarks',
                              'Uploaded By',
                              '',
                            ].map((h, i) => (
                              <th
                                key={i}
                                className="pb-3 text-[12px] font-black uppercase text-gray-900 tracking-tighter text-center px-1"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {attachments.map((file) => (
                            <tr key={file.id}>
                              <td className="py-2 px-1">
                                <input
                                  disabled={isViewMode}
                                  className={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                                  placeholder="e.g. Invoice_Scan"
                                  value={file.fileName}
                                  onChange={(e) =>
                                    updateAttachment(
                                      file.id,
                                      'fileName',
                                      e.target.value,
                                    )
                                  }
                                />
                              </td>
                              <td className="py-2 px-1">
                                {isViewMode ? (
                                  <div
                                    className={`${tableInput} text-black cursor-not-allowed flex items-center justify-center`}
                                  >
                                    {file.file &&
                                    typeof file.file === 'string' &&
                                    file.file.startsWith('data:image/') ? (
                                      <>
                                        <img
                                          src={file.file}
                                          alt={file.fileName || 'Attachment'}
                                          className="max-h-16 max-w-full object-contain cursor-pointer hover:scale-105 transition-transform"
                                          onClick={() =>
                                            setImageModal({
                                              isOpen: true,
                                              imageSrc: file.file,
                                            })
                                          }
                                          title="Click to view full size"
                                        />
                                        <span className="text-[8px] text-gray-500 ml-2">
                                          {Math.round(file.file.length / 1024)}KB
                                        </span>
                                      </>
                                    ) : file.file && typeof file.file === 'string' ? (
                                      <span className="text-blue-600 text-[11px] font-bold">
                                        Non-image file (
                                        {Math.round(file.file.length / 1024)}KB)
                                      </span>
                                    ) : file.file ? (
                                      <span className="text-orange-600 text-[11px] font-bold">
                                        Invalid file data
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 text-[11px] italic">
                                        No file
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <input
                                    type="file"
                                    className="text-[11px] font-bold text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-black file:text-white cursor-pointer w-full"
                                    onChange={(e) =>
                                      handleFileChange(file.id, e.target.files[0])
                                    }
                                  />
                                )}
                              </td>
                              <td className="py-2 px-1">
                                <input
                                  disabled={isViewMode}
                                  className={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                                  placeholder="Add note..."
                                  value={file.remarks}
                                  onChange={(e) =>
                                    updateAttachment(
                                      file.id,
                                      'remarks',
                                      e.target.value,
                                    )
                                  }
                                />
                              </td>
                              <td className="py-2 px-1 text-[12px] font-bold text-gray-600 italic">
                                {file.uploadedBy}
                              </td>
                              <td className="py-2 text-center">
                                {!isViewMode && (
                                  <button
                                    onClick={() => removeAttachment(file.id)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!isViewMode && (
                      <button
                        onClick={addAttachment}
                        className="mt-2 py-1.5 border-2 border-dashed rounded-lg w-full text-[12px] font-black uppercase border-slate-300 text-slate-600 transition-all duration-300 hover:bg-slate-50 hover:border-slate-400 flex items-center justify-center gap-1"
                      >
                        <Plus size={15} /> Add File
                      </button>
                    )}
                  </div>
                </section>

                {/* Remarks Card */}
                <section className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-zinc-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="text-red-500" size={16} />
                      <h2 className="text-sm font-bold tracking-tight">Remarks & Internal Notes</h2>
                    </div>
                  </div>
                  <div className="p-4">
                    <textarea
                      disabled={isViewMode}
                      rows={4}
                      placeholder="Enter justification, payment reference notes, or internal instructions here..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className={`w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                    />
                  </div>
                </section>
              </div>
            </motion.div>
          </main>
        </div>

        {/* IMAGE MODAL */}
        {!isViewMode && (
          <RightSideModal
            isOpen={isVendorModalOpen}
            onClose={closeVendorModal}
            title="Add Vendor"
          >
            <form onSubmit={handleVendorFormSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                    Vendor Code <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={vendorForm.code}
                    onChange={(e) =>
                      setVendorForm({ ...vendorForm, code: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                    placeholder="Enter vendor code..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                    Vendor Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={vendorForm.name}
                    onChange={(e) =>
                      setVendorForm({ ...vendorForm, name: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                    placeholder="Enter vendor name..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                    Category
                  </label>
                  <input
                    type="text"
                    value={vendorForm.category}
                    onChange={(e) =>
                      setVendorForm({ ...vendorForm, category: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                    placeholder="Enter category..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                    Type
                  </label>
                  <select
                    value={vendorForm.type}
                    onChange={(e) =>
                      setVendorForm({ ...vendorForm, type: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Select type...</option>
                    <option value="individual">Individual</option>
                    <option value="partnership">Partnership</option>
                    <option value="corporation">Corporation</option>
                    <option value="government">Government</option>
                    <option value="non-profit">Non-Profit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    value={vendorForm.address}
                    onChange={(e) =>
                      setVendorForm({ ...vendorForm, address: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                    placeholder="Enter address..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                    TIN <span className="text-red-600">*</span>{' '}
                    <span className="text-[9px] text-gray-400">(max 15 chars)</span>
                  </label>
                  <input
                    type="text"
                    value={vendorForm.tin}
                    onChange={(e) =>
                      setVendorForm({
                        ...vendorForm,
                        tin: formatTinInput(e.target.value),
                      })
                    }
                    inputMode="numeric"
                    maxLength={18}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                    placeholder="Enter TIN (XXX-XXX-XXX-XXX-XXX)"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                    Details
                  </label>
                  <textarea
                    value={vendorForm.details}
                    onChange={(e) =>
                      setVendorForm({ ...vendorForm, details: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all min-h-[120px]"
                    placeholder="Enter additional details..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                    Contact{' '}
                    <span className="text-[9px] text-gray-400">(max 15 chars)</span>
                  </label>
                  <input
                    type="text"
                    value={vendorForm.contact}
                    onChange={(e) =>
                      setVendorForm({
                        ...vendorForm,
                        contact: e.target.value.slice(0, 15),
                      })
                    }
                    maxLength={15}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                    placeholder="Enter contact number..."
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeVendorModal}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 text-xs font-black rounded-xl hover:bg-gray-200 transition-all uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={vendorCreateLoading}
                  className="flex-1 px-4 py-3 bg-black text-white text-xs font-black rounded-xl hover:bg-red-600 transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Plus size={14} />
                  {vendorCreateLoading ? 'Creating...' : 'Create Vendor'}
                </button>
              </div>
            </form>
          </RightSideModal>
        )}

        {!isViewMode && (
          <RightSideModal
            isOpen={isProductModalOpen}
            onClose={closeProductModal}
            title="Add Product/Service"
          >
            <form onSubmit={handleProductFormSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                    Product/Service Code <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={productForm.code}
                    onChange={(e) =>
                      setProductForm({ ...productForm, code: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                    placeholder="Enter product/service code..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                    Product/Service Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={productForm.name}
                    onChange={(e) =>
                      setProductForm({ ...productForm, name: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                    placeholder="Enter product/service name..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                    Type <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={productForm.type}
                    onChange={(e) =>
                      setProductForm({ ...productForm, type: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all appearance-none cursor-pointer"
                    required
                  >
                    <option value="">Select type...</option>
                    <option value="product">Product</option>
                    <option value="service">Service</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                    Category
                  </label>
                  <input
                    type="text"
                    value={productForm.category}
                    onChange={(e) =>
                      setProductForm({ ...productForm, category: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                    placeholder="Enter category..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                      Sales Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={productForm.sales_price}
                      onChange={(e) =>
                        setProductForm({
                          ...productForm,
                          sales_price: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                      Purchase Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={productForm.purchase_price}
                      onChange={(e) =>
                        setProductForm({
                          ...productForm,
                          purchase_price: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                    Unit
                  </label>
                  <select
                    value={productForm.unit}
                    onChange={(e) =>
                      setProductForm({ ...productForm, unit: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Select unit...</option>
                    <option value="pcs">Pieces</option>
                    <option value="kg">Kilograms</option>
                    <option value="l">Liters</option>
                    <option value="m">Meters</option>
                    <option value="box">Box</option>
                    <option value="hour">Hour</option>
                    <option value="day">Day</option>
                    <option value="service">Service</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeProductModal}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 text-xs font-black rounded-xl hover:bg-gray-200 transition-all uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={productCreateLoading}
                  className="flex-1 px-4 py-3 bg-black text-white text-xs font-black rounded-xl hover:bg-red-600 transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Plus size={14} />
                  {productCreateLoading ? 'Creating...' : 'Create Product/Service'}
                </button>
              </div>
            </form>
          </RightSideModal>
        )}

        {imageModal.isOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setImageModal({ isOpen: false, imageSrc: '' })}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                setImageModal({ isOpen: false, imageSrc: '' })
              }}
              className="absolute top-6 right-6 text-white hover:text-red-500 transition-colors"
            >
              <ArrowLeft size={32} />
            </button>
            <img
              src={imageModal.imageSrc}
              alt="Preview"
              className="max-w-full max-h-full rounded-2xl shadow-2xl border-4 border-white/10 p-2 scale-in animate-in zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function TableSection({
  title,
  icon,
  children,
  defaultCollapsed = false,
  headerActions = null,
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 bg-zinc-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-semibold text-sm">
            {icon}
          </div>
          <h2 className="text-base font-bold tracking-tight">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          {headerActions && (
            <div className="w-[220px] sm:w-[260px]">{headerActions}</div>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed((v) => !v)}
            className="text-white bg-red-600 hover:bg-red-700 p-2 rounded-lg transition-colors"
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>
      {!isCollapsed && <div className="p-4">{children}</div>}
    </div>
  )
}

function SDivider() {
  return <div className="h-[1px] w-full bg-gray-400" />
}

const SummaryRow = ({
  label,
  value,
  badge,
  badgeColor = "text-zinc-400",
  valuePrefix = "",
  textColor = "text-zinc-900",
  containerClassName = "py-1 border-b border-zinc-500",
  isNested = false,
}) => {
  const strVal = String(value || "");

  const getValueFontSize = (len) => {
    if (len > 24) return "text-xs";
    if (len > 18) return "text-sm";
    return "text-sm sm:text-base";
  };

  return (
    <div
      className={`flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 w-full min-w-0 ${containerClassName}`}
    >
      {/* Label & Badge */}
      <div className="flex items-center gap-1 min-w-max">
        <span
          className={`font-bold text-zinc-800 ${isNested ? "text-xs" : "text-sm"
            }`}
        >
          {label}
        </span>
        {badge && (
          <span className={`text-xs font-bold ${badgeColor}`}>{badge}</span>
        )}
      </div>

      {/* Value */}
      <div className="flex-1 flex justify-end min-w-max text-right">
        <span
          className={`font-extrabold font-mono tracking-tight whitespace-nowrap ml-auto ${textColor} ${getValueFontSize(
            strVal.length
          )}`}
        >
          {valuePrefix && <span className="mr-0.5">{valuePrefix}</span>}
          <span className="text-emerald-600 font-extrabold mr-1">₱</span>
          <span>{strVal}</span>
        </span>
      </div>
    </div>
  );
};

const TotalHeroAmount = ({ value, fmt }) => {
  const formattedVal = fmt(value);
  const len = String(formattedVal || "").length;

  const getHeroFontSize = (charCount) => {
    if (charCount > 25) return "text-sm";
    if (charCount > 18) return "text-base";
    if (charCount > 12) return "text-xl";
    return "text-2xl";
  };

  return (
    <div
      className={`font-black font-mono text-white tracking-tight drop-shadow-sm text-right whitespace-nowrap overflow-hidden transition-all duration-150 ${getHeroFontSize(
        len
      )}`}
    >
      <span className="text-emerald-300 mr-1">₱</span>
      <span>{formattedVal}</span>
    </div>
  );
};
