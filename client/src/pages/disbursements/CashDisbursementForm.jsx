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
      <div className="flex items-center justify-between flex-shrink-0">
        <nav
          className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[2px] text-gray-400 cursor-pointer hover:text-black transition-colors"
          onClick={onBack}
        >
          <ArrowLeft size={17} />
          <span className="text-black">Back to Cash Disbursements</span>
        </nav>
        {!isViewMode && (
          <div className="flex gap-4">
            <button className="px-4 py-2 bg-white border border-gray-200 text-[12px] font-black text-gray-400 rounded-lg hover:bg-gray-50 transition-all uppercase">
              Save Draft
            </button>
            <button
              onClick={handlePostTransaction}
              className="px-6 py-2 bg-red-600 text-white text-[12px] font-black rounded-lg hover:bg-red-700 transition-all uppercase tracking-[2px] flex items-center gap-2 shadow-md shadow-red-200"
            >
              <Save size={14} /> Post Transaction
            </button>
          </div>
        )}
      </div>

      {/* BODY */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        {/* BASIC DETAILS */}
        <fieldset className="bg-black rounded-2xl p-3 pl-6 pr-6 text-white shadow-xl">
          <legend className="bg-red-600 text-[13px] font-black uppercase tracking-[3px] text-white flex items-center justify-center gap-2 px-4 py-1 rounded-lg mx-auto w-fit">
            <Landmark size={18} /> Basic Details
          </legend>
          <div
            className={`grid gap-3 ${modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER' ? 'grid-cols-6' : 'grid-cols-4'}`}
          >
            <fieldset className="col-span-1">
              <legend className="text-[11px] font-black uppercase text-gray-100">
                Vendor / Payee <span className="text-red-600">*</span>
              </legend>
              {isViewMode ? (
                <div className={inputBase + ' text-black py-1.5 cursor-not-allowed'}>
                  {vendorSearch || 'No vendor selected'}
                </div>
              ) : vendorLoading ? (
                <div className={inputBase + ' text-gray-400 py-1.5'}>
                  Loading vendors…
                </div>
              ) : (
                <SearchableDropdown
                  placeholder="Vendor / Payee"
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
                  inputClassName={inputBase}
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
            </fieldset>

            <fieldset className="col-span-1">
              <legend className="text-[11px] font-black uppercase text-gray-100">
                Reference
              </legend>
              <input
                type="text"
                placeholder="Reference"
                value={documentReference}
                onChange={(e) => setDocumentReference(e.target.value)}
                disabled={isViewMode}
                className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${isViewMode ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed' : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'}`}
              />
            </fieldset>

            <fieldset>
              <legend className="text-[11px] font-black uppercase text-gray-100">
                Mode of Payment
              </legend>
              {isViewMode ? (
                <div className={inputBase + ' text-black py-1.5 cursor-not-allowed'}>
                  {modeSearch || 'No mode selected'}
                </div>
              ) : (
                <SearchableDropdown
                  placeholder="Mode of Payment"
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
                  inputClassName={inputBase}
                  emptyText="No modes found"
                />
              )}
            </fieldset>

            <fieldset>
              <legend className="text-[11px] font-black uppercase text-gray-100">
                Date
              </legend>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                disabled={isViewMode}
                className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${isViewMode ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed' : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'}`}
              />
            </fieldset>

            {(modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') && (
              <fieldset>
                <legend className="text-[11px] font-black uppercase text-gray-100">
                  Bank Name
                </legend>
                <input
                  type="text"
                  placeholder="Bank Name"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  disabled={isViewMode}
                  className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${isViewMode ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed' : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'}`}
                />
              </fieldset>
            )}

            {(modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') && (
              <fieldset>
                <legend className="text-[11px] font-black uppercase text-gray-100">
                  Check #
                </legend>
                <input
                  type="text"
                  placeholder="Check #"
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                  disabled={isViewMode}
                  className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${isViewMode ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed' : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'}`}
                />
              </fieldset>
            )}
          </div>
        </fieldset>

        <div className="flex-1 flex gap-2 min-h-0">
          {/* LEFT SIDEBAR - SUMMARY */}
          <aside className="w-full flex-shrink-0 flex flex-col gap-2 h-full overflow-y-auto sidebar-scroll max-w-[20%]">
            <section className="bg-white rounded-2xl border-2 border-red-100 shadow-xl shadow-red-500/5 flex-1 flex flex-col min-h-0 overflow-hidden">
              <header className="bg-red-600 p-4 flex-shrink-0">
                <h3 className="text-[clamp(14px,1.4vw,16px)] font-black uppercase tracking-[3px] text-white flex items-center gap-2">
                  <Calculator size={16} className="shrink-0 text-white" />
                  Summary
                </h3>
              </header>
              <div className="custom-table-scroller overflow-y-auto min-h-0 flex-1 custom-scrollbar p-4 py-2">
                <div className="space-y-0">
                  <SummaryRow
                    label="Total Purchase Price"
                    value={fmt(summary.totalPurchasePrice)}
                  />
                  <SDivider />
                  <SummaryRow
                    label="Total Discount"
                    value={fmt(summary.totalDiscount)}
                    color="text-red-500"
                  />
                  <SDivider />
                  <SummaryRow
                    label="Total Discounted Amount"
                    value={fmt(summary.totalDiscounted)}
                  />
                  <SDivider />
                  <SummaryRow
                    label="Total VAT"
                    value={fmt(summary.totalVAT)}
                    color="text-red-600"
                  />
                  <SDivider />
                  <SummaryRow
                    label="VATable Purchases"
                    value={fmt(summary.vatablePurchases)}
                  />
                  <SDivider />
                  <SummaryRow
                    label="VAT-Exempt Purchases"
                    value={fmt(summary.vatExemptPurchases)}
                  />
                  <SDivider />
                  <SummaryRow
                    label="Zero Rated Purchases"
                    value={fmt(summary.zeroRatedPurchases)}
                  />
                  <SDivider />
                  <SummaryRow
                    label="Total No. VAT Discount"
                    value={fmt(summary.totalNoVatDiscount)}
                  />
                  <SDivider />
                  <SummaryRow
                    label="Total Net of VAT"
                    value={fmt(summary.totalNetOfVat)}
                  />
                  <SDivider />
                  <SummaryRow
                    label="Total Withholding Tax"
                    value={fmt(summary.totalWHT)}
                    color="text-red-700"
                  />
                </div>
              </div>
              <div className="p-4 pt-0 flex-shrink-0">
                <div className="flex flex-col gap-[2px] mb-3">
                  <div className="h-[3px] w-full bg-red-600 rounded-full" />
                  <div className="h-[1px] w-full bg-black/10" />
                </div>
                <div className="text-center bg-red-500 rounded-xl py-3 border border-gray-100">
                  <p className="text-[clamp(11px,1.1vw,12px)] font-black text-gray-100 uppercase tracking-[4px] mb-1">
                    Total Cash Disbursement
                  </p>
                  <p className="text-[clamp(22px,2.5vw,28px)] font-black text-white tracking-tighter leading-none flex items-baseline justify-center gap-2">
                    <span className="text-[clamp(12px,1.3vw,15px)] text-green-300 font-black">
                      PHP
                    </span>
                    {fmt(summary.totalAmountDue)}
                  </p>
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
              {/* 1. DISBURSEMENT ITEMS */}
              <TableSection
                title="Disbursement Items"
                icon={<Wallet size={14} />}
                headerActions={
                  <div className="w-full">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-red-400 pointer-events-none" />
                      <div className="pl-8">
                        <SearchableDropdown
                          placeholder="Responsibility Center to All"
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
                          inputClassName="w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all bg-white border border-red-300 text-black focus:ring-1 focus:ring-red-500"
                          emptyText={
                            responsibilityCentersError ||
                            'No responsibility centers found'
                          }
                          disabled={isViewMode}
                        />
                      </div>
                    </div>
                  </div>
                }
              >
                <div className="w-full flex flex-col gap-[2px] mb-3">
                  <div className="h-[2px] w-full bg-red-600 rounded-full" />
                  <div className="h-[1px] w-full bg-black/10" />
                </div>
                <div
                  ref={disbursementItemsScrollRef}
                  className="overflow-x-auto custom-table-scroller"
                >
                  <table
                    className="w-full text-center min-w-[1100px]"
                    style={{ tableLayout: 'fixed' }}
                  >
                    <colgroup>
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '6%' }} />
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '5%' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-gray-100">
                        {[
                          'Product/Service',
                          'Charts of Accounts',
                          'Description',
                          'Qty',
                          'Price',
                          'Disc %',
                          'Disc Type',
                          'VAT %',
                          'WHT %',
                          'Resp. Center',
                          '',
                        ].map((h, i) => (
                          <th
                            key={i}
                            className="pb-3 text-[12px] font-black uppercase text-gray-900 text-center whitespace-nowrap px-1"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
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
                            <input
                              disabled={isViewMode}
                              className={`${tableInput + ' font-black'} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              type="text"
                              placeholder="0.00"
                              inputMode="decimal"
                              value={formatPriceDisplay(item.price)}
                              onChange={(e) => {
                                const parsed = parsePriceInput(e.target.value)
                                updateDisbursementItem(item.id, 'price', parsed)
                              }}
                            />
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
                                  ? 'Percentage'
                                  : 'Fixed'}
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
                  <div className="flex gap-2 mt-3">
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
                      className="flex-1 py-2 border-2 border-dashed rounded-xl text-[11px] font-black uppercase border-red-300 text-red-600 transition-all duration-300 hover:bg-red-50 hover:border-red-500 hover:-translate-y-1 hover:shadow-lg hover:shadow-red-500/10 flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> ADD Product/Service
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
                      className="flex-1 py-2 border-2 border-dashed rounded-xl text-[11px] font-black uppercase border-black text-black transition-all duration-300 hover:bg-gray-100 hover:border-gray-600 border-gray-400 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/5 flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> ADD Others
                    </button>
                  </div>
                )}
              </TableSection>

              {/* 2. JOURNAL ENTRIES */}
              <TableSection title="Journal Entries" icon={<Layers size={14} />}>
                <div className="w-full flex flex-col gap-[2px] mb-4">
                  <div className="h-[2px] w-full bg-red-600 rounded-full" />
                  <div className="h-[1px] w-full bg-black/10" />
                </div>
                <div className="overflow-x-auto custom-table-scroller">
                  <table
                    className="w-full text-center"
                    style={{ tableLayout: 'fixed', minWidth: 600 }}
                  >
                    <colgroup>
                      <col style={{ width: '40%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '22%' }} />
                      <col style={{ width: '6%' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-gray-100">
                        {[
                          'Charts of Account',
                          'Debit',
                          'Credit',
                          'Responsibility Center',
                          '',
                        ].map((h, i) => (
                          <th
                            key={i}
                            className="pb-3 text-[12px] font-black uppercase text-gray-900 text-center px-1"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {journalEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td className="py-1.5 px-1">
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
                          <td className="py-1.5 px-1">
                            <input
                              disabled={isViewMode}
                              className={`${tableInput + ' font-black'} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
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
                          <td className="py-1.5 px-1">
                            <input
                              disabled={isViewMode}
                              className={`${tableInput + ' font-black text-red-600'} ${isViewMode ? 'bg-transparent cursor-not-allowed' : ''}`}
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
                          <td className="py-1.5 px-1">
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
                          <td className="py-1.5 text-center">
                            {!isViewMode && (
                              <button
                                className="p-1 text-red-600 transition-colors hover:bg-red-50 rounded"
                                onClick={() => removeJournalEntry(entry.id)}
                              >
                                <Trash2 size={15} className="mx-auto" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50/50 border">
                        <td
                          colSpan={1}
                          className="py-2 px-3 text-[12px] font-black uppercase text-black text-left"
                        >
                          Balance Check
                        </td>
                        <td className="py-2 px-1 text-center text-[13px] font-black">
                          {fmt(
                            journalEntries.reduce(
                              (s, e) => s + (parseFloat(e.debit) || 0),
                              0,
                            ),
                          )}
                        </td>
                        <td className="py-2 px-1 text-center text-[13px] font-black text-red-600">
                          {fmt(
                            journalEntries.reduce(
                              (s, e) => s + (parseFloat(e.credit) || 0),
                              0,
                            ),
                          )}
                        </td>
                        <td />
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {!isViewMode && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => addJournalEntry(bulkResponsibilityCenter)}
                      className="flex-1 py-2 border-2 border-dashed rounded-xl text-[11px] font-black uppercase border-red-300 text-red-600 transition-all duration-300 hover:bg-red-50 hover:border-red-500 hover:-translate-y-1 hover:shadow-lg hover:shadow-red-500/10 flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> ADD Ledger Row
                    </button>
                  </div>
                )}
              </TableSection>

              {/* 3. ATTACHMENTS & REMARKS */}
              <div className="grid grid-cols-1 gap-4">
                <TableSection
                  title="Attachments"
                  icon={<Paperclip size={14} />}
                  defaultCollapsed
                >
                  <div className="w-full flex flex-col gap-[2px] mb-4">
                    <div className="h-[2px] w-full bg-red-600 rounded-full" />
                    <div className="h-[1px] w-full bg-black/10" />
                  </div>
                  <div className="overflow-x-auto custom-table-scroller">
                    <table
                      className="w-full text-center"
                      style={{ tableLayout: 'fixed', minWidth: 800 }}
                    >
                      <colgroup>
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '25%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '5%' }} />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-gray-100">
                          {[
                            'File Name',
                            'File',
                            'Remarks',
                            'Uploaded By',
                            'Date',
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
                      <tbody className="divide-y divide-gray-50">
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
                                  className={`${tableInput} bg-transparent text-black cursor-not-allowed flex items-center justify-center`}
                                >
                                  {file.file &&
                                  typeof file.file === 'string' &&
                                  file.file.startsWith('data:image/') ? (
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
                                  ) : file.file ? (
                                    <span className="text-gray-500 text-[11px] italic">
                                      File attached
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
                            <td className="py-2 px-1 text-[12px] font-bold text-gray-600 tabular-nums">
                              {file.date}
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
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={addAttachment}
                        className="flex-1 py-2 border-2 border-dashed rounded-xl text-[11px] font-black uppercase border-red-300 text-red-600 transition-all duration-300 hover:bg-red-50 hover:border-red-500 hover:-translate-y-1 hover:shadow-lg hover:shadow-red-500/10 flex items-center justify-center gap-2"
                      >
                        <Plus size={14} /> ADD File
                      </button>
                    </div>
                  )}
                </TableSection>

                <TableSection
                  title="Remarks"
                  icon={<FileText size={14} />}
                  defaultCollapsed
                >
                  <textarea
                    disabled={isViewMode}
                    className={`w-full min-h-[100px] mt-4 p-4 bg-gray-50 border-none rounded-xl text-[14px] font-bold focus:ring-1 focus:ring-red-500 outline-none ${isViewMode ? 'cursor-not-allowed' : ''}`}
                    placeholder="Enter justification or internal notes here..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </TableSection>
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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-red-50 text-red-600 rounded-lg">{icon}</div>
          <h2 className="text-[15px] font-black uppercase tracking-[1px] text-black">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {headerActions && (
            <div className="w-[220px] sm:w-[260px]">{headerActions}</div>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed((v) => !v)}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            {isCollapsed ? (
              <>
                <Plus size={16} />
                <span className="text-[11px] font-black uppercase">Show</span>
              </>
            ) : (
              <>
                <Minus size={16} />
                <span className="text-[11px] font-black uppercase">Hide</span>
              </>
            )}
          </button>
        </div>
      </div>
      {!isCollapsed && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

function SDivider() {
  return <div className="h-[1px] w-full bg-gray-400" />
}

function SummaryRow({ label, value, color = 'text-gray-800', formula }) {
  return (
    <div className="summary-row relative flex justify-between items-center hover:bg-gray-50 rounded-md transition-colors py-1.5 px-1 cursor-default">
      <span className="text-[clamp(11px,1.1vw,12.5px)] font-black uppercase text-gray-500 leading-tight pr-1 flex-1">
        {label}
      </span>
      <span
        className={`${color} text-[clamp(12px,1.25vw,14px)] font-black tabular-nums tracking-tight whitespace-nowrap text-right flex-shrink-0`}
      >
        {value}
      </span>
      {formula && (
        <div className="summary-tooltip absolute left-0 bottom-full mb-1 z-50 bg-gray-900 text-white text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-xl pointer-events-none">
          <span className="text-gray-300 font-medium">{formula}</span>
          <div className="absolute left-3 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  )
}
