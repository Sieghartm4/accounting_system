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
} from 'lucide-react'
import ReactDOM from 'react-dom'
import DynamicToast from '../../components/DynamicToast'
import RightSideModal from '../../components/RightSideModal'
import { useReceiptsForm, useDragToScroll, fmt } from './useReceipts'

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
// Format price for display (always shows .00)
const formatPriceDisplay = (value) => {
  if (value === '' || value === null || value === undefined) return ''
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return ''
  return num.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Parse price input - extract numeric value from user input
const parsePriceInput = (input) => {
  if (input === '' || input === null || input === undefined) return ''
  // Extract digits and decimal point only
  const cleaned = input.replace(/[^0-9.]/g, '')
  // Prevent multiple decimals
  const parts = cleaned.split('.')
  if (parts.length > 2) return parseFloat(parts[0] + '.' + parts[1]) || 0
  const parsed = parseFloat(cleaned) || 0
  return parsed
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function ReceiptsForm({
  onBack,
  onSuccess,
  isViewMode = false,
  isEditMode = false,
  receiptData = null,
}) {
  const {
    receiptItems,
    journalEntries,
    attachments,
    toast,
    setToast,
    imageModal,
    setImageModal,
    customers,
    customerLoading,
    customerError,
    selectedCustomer,
    customerSearch,
    selectedCustomerId,
    setSelectedCustomer,
    setCustomerSearch,
    setSelectedCustomerId,
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
    collectionDate,
    setCollectionDate,
    bankName,
    setBankName,
    checkNumber,
    setCheckNumber,
    documentReference,
    setDocumentReference,
    remarks,
    setRemarks,
    isDisabled,
    coaOptions,
    customerOptions,
    productOptions,
    addReceiptItem,
    removeReceiptItem,
    updateReceiptItem,
    addJournalEntry,
    removeJournalEntry,
    updateJournalEntry,
    addAttachment,
    removeAttachment,
    updateAttachment,
    handleFileChange,
    calculateJournalBalance,
    isAutoGeneratedEntry,
    loadVatOnDemand,
    loadWhtOnDemand,
    handlePostTransaction,
    summary,
    createCustomer,
    createProduct,
  } = useReceiptsForm({ isViewMode, isEditMode, receiptData, onBack, onSuccess })

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [customerCreateLoading, setCustomerCreateLoading] = useState(false)
  const [customerForm, setCustomerForm] = useState({
    code: '',
    name: '',
    category: '',
    type: '',
    status: 'active',
  })

  const openCustomerModal = () => {
    setCustomerForm({ code: '', name: '', category: '', type: '', status: 'active' })
    setIsCustomerModalOpen(true)
  }

  const closeCustomerModal = () => {
    setIsCustomerModalOpen(false)
    setCustomerForm({ code: '', name: '', category: '', type: '', status: 'active' })
  }

  const handleCustomerFormSubmit = async (e) => {
    e.preventDefault()
    setCustomerCreateLoading(true)
    const result = await createCustomer(customerForm)
    setCustomerCreateLoading(false)

    if (!result.success) {
      setToast({
        type: 'error',
        message: result.message || 'Failed to create customer',
      })
      return
    }

    const createdCustomer = result.data
    setSelectedCustomer(createdCustomer.name || createdCustomer.customer_name || '')
    setCustomerSearch(createdCustomer.name || createdCustomer.customer_name || '')
    setSelectedCustomerId(createdCustomer.id || '')
    setToast({
      type: 'success',
      message: `Customer "${createdCustomer.name || createdCustomer.customer_name}" added successfully.`,
    })
    closeCustomerModal()
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
    const currentItemId = receiptItems[receiptItems.length - 1]?.id
    if (currentItemId) {
      updateReceiptItem(currentItemId, 'productId', createdProduct.id || '')
      updateReceiptItem(
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
    (isDisabled
      ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed'
      : 'bg-gray-50 border border-gray-200 text-black focus:ring-1 focus:ring-red-500 text-center')
  const tableInput =
    'w-full rounded-md px-1 py-1 text-[13px] font-bold text-center outline-none ' +
    (isDisabled
      ? 'bg-gray-100 border border-gray-300 text-black! cursor-not-allowed'
      : 'bg-gray-50/50 focus:ring-1 focus:ring-red-400')
  const pctInput = tableInput + ' pr-1'

  const fadeInUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  }
  const receiptItemsScrollRef = useDragToScroll()

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
          <span className="text-black">
            {isDisabled
              ? 'Back to Receipts'
              : isEditMode
                ? 'Edit Receipt'
                : 'New Receipt'}
          </span>
        </nav>
        {!isDisabled && (
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white border border-gray-200 text-[12px] font-black text-gray-400 rounded-lg hover:bg-gray-50 transition-all uppercase">
              Save Draft
            </button>
            <button
              onClick={handlePostTransaction}
              className="px-6 py-2 bg-red-600 text-white text-[12px] font-black rounded-lg hover:bg-red-700 transition-all uppercase tracking-[2px] flex items-center gap-2 shadow-md shadow-red-200"
            >
              <Save size={14} /> {isEditMode ? 'Update Receipt' : 'Post Transaction'}
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
            <div className="col-span-1">
              <fieldset>
                <legend className="text-[11px] font-black uppercase text-gray-100">
                  Customer <span className="text-red-600">*</span>
                </legend>
                {isDisabled ? (
                  <div className={inputBase + ' text-black py-1.5'}>
                    {customerSearch || 'No customer selected'}
                  </div>
                ) : customerLoading ? (
                  <div className={inputBase + ' text-black py-1.5'}>
                    Loading customers...
                  </div>
                ) : (
                  <SearchableDropdown
                    placeholder="Customer *"
                    value={customerSearch}
                    onChange={(v) => {
                      setCustomerSearch(v)
                      setSelectedCustomer('')
                      setSelectedCustomerId('')
                    }}
                    onSelect={(opt) => {
                      setSelectedCustomer(opt.label)
                      setCustomerSearch(opt.label)
                      setSelectedCustomerId(opt.value)
                    }}
                    options={customerOptions}
                    inputClassName={inputBase}
                    emptyText={customerError || 'No customers found'}
                    onFocus={() => {
                      if (!customerSearch && customerOptions.length === 0) {
                        setCustomerSearch('')
                      }
                    }}
                    dropdownFooter={
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={openCustomerModal}
                        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-black text-white text-[11px] font-black rounded-xl hover:bg-red-600 transition-all"
                      >
                        <Plus size={12} /> Add Customer
                      </button>
                    }
                  />
                )}
              </fieldset>
            </div>
            <div className="col-span-1">
              <fieldset>
                <legend className="text-[11px] font-black uppercase text-gray-100">
                  Reference Number
                </legend>
                <input
                  type="text"
                  placeholder="Reference"
                  value={documentReference}
                  onChange={(e) => setDocumentReference(e.target.value)}
                  disabled={isDisabled}
                  className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${isDisabled ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed' : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'}`}
                />
              </fieldset>
            </div>
            <fieldset>
              <legend className="text-[11px] font-black uppercase text-gray-100">
                Mode of Payment
              </legend>
              {isDisabled ? (
                <div className={inputBase + ' text-black py-1.5'}>
                  {modeSearch || 'No mode selected'}
                </div>
              ) : (
                <SearchableDropdown
                  placeholder="Mode *"
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
                Collection Date
              </legend>
              <input
                type="date"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                disabled={isDisabled}
                className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${isDisabled ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed' : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'}`}
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
                  disabled={isDisabled}
                  className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${isDisabled ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed' : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'}`}
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
                  disabled={isDisabled}
                  className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${isDisabled ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed' : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'}`}
                />
              </fieldset>
            )}
          </div>
        </fieldset>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex gap-2 min-h-0">
          {/* LEFT SIDEBAR - SUMMARY */}
          <aside className="w-full flex-shrink-0 flex flex-col gap-2 h-full overflow-y-auto sidebar-scroll max-w-[18%]">
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
                    label="Total Sales Price"
                    value={fmt(summary.totalSalesPrice)}
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
                    label="VATable Sales"
                    value={fmt(summary.vatableSales)}
                  />
                  <SDivider />
                  <SummaryRow
                    label="VAT-Exempt Sales"
                    value={fmt(summary.vatExemptSales)}
                  />
                  <SDivider />
                  <SummaryRow
                    label="Zero Rated Sales"
                    value={fmt(summary.zeroRatedSales)}
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
                  <div className="h-[1px] w-full bg-gray-200" />
                </div>
                <div className="text-center bg-red-500 rounded-xl py-3 border border-gray-100">
                  <p className="text-[clamp(11px,1.1vw,12px)] font-black text-gray-200 uppercase tracking-[4px] mb-1">
                    Total Cash Receipt
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
              {/* 1. RECEIPT ITEMS */}
              <TableSection title="Receipt Items" icon={<Wallet size={14} />}>
                <div className="w-full flex flex-col gap-[2px] mb-3">
                  <div className="h-[2px] w-full bg-red-600 rounded-full" />
                  <div className="h-[1px] w-full bg-black/10" />
                </div>
                <div
                  ref={receiptItemsScrollRef}
                  className="overflow-x-auto custom-table-scroller"
                >
                  <table
                    className="w-full text-center min-w-[1000px]"
                    style={{ tableLayout: 'fixed' }}
                  >
                    <colgroup>
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '6%' }} />
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '10%' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-gray-100">
                        {[
                          'Product/Service',
                          'COA',
                          'Description',
                          'Qty',
                          'Price',
                          'Disc',
                          'Disc Type',
                          'VAT %',
                          'WHT %',
                          'Resp. Center',
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
                      {receiptItems.map((item) => (
                        <tr
                          key={item.id}
                          className={item.isOther ? 'bg-gray-50/30' : ''}
                        >
                          <td className="py-1 px-1">
                            {item.isOther ? (
                              <div className="cursor-not-allowed text-center text-gray-400 text-[11px] italic py-2" />
                            ) : (
                              <SearchableDropdown
                                disabled={isDisabled}
                                placeholder="Search product..."
                                value={item.productSearch}
                                onChange={(v) =>
                                  updateReceiptItem(item.id, 'productSearch', v)
                                }
                                onSelect={(opt) => {
                                  updateReceiptItem(item.id, 'productId', opt.value)
                                  updateReceiptItem(
                                    item.id,
                                    'productSearch',
                                    opt.label,
                                  )
                                }}
                                options={productOptions}
                                inputClassName={`${tableInput} ${isDisabled ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                                emptyText={productError || 'No products found'}
                                dropdownFooter={
                                  !isDisabled ? (
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
                              disabled={isDisabled}
                              placeholder="Search account..."
                              value={item.coaSearch}
                              onChange={(v) =>
                                updateReceiptItem(item.id, 'coaSearch', v)
                              }
                              onSelect={(opt) => {
                                updateReceiptItem(item.id, 'coa', opt.value)
                                updateReceiptItem(item.id, 'coaSearch', opt.label)
                              }}
                              options={coaOptions}
                              inputClassName={`${tableInput} ${isDisabled ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              emptyText="No accounts found"
                            />
                          </td>
                          <td className="py-1 px-1">
                            <input
                              disabled={isDisabled}
                              className={`${tableInput} ${isDisabled ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              placeholder="Details..."
                              value={item.description}
                              onChange={(e) =>
                                updateReceiptItem(
                                  item.id,
                                  'description',
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="py-1 px-1">
                            <input
                              disabled={isDisabled || item.isOther}
                              type="number"
                              min="0"
                              className={`${tableInput} ${isDisabled || item.isOther ? 'bg-transparent text-gray-200 cursor-not-allowed' : ''}`}
                              placeholder={item.isOther ? '' : '1'}
                              value={item.isOther ? '' : item.qty || ''}
                              onChange={(e) =>
                                updateReceiptItem(
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
                              disabled={isDisabled}
                              className={`${tableInput + ' font-black'} ${isDisabled ? 'bg-transparent text-gray-200 cursor-not-allowed' : ''}`}
                              type="text"
                              placeholder="0.00"
                              inputMode="decimal"
                              value={formatPriceDisplay(item.price)}
                              onChange={(e) => {
                                const parsed = parsePriceInput(e.target.value)
                                updateReceiptItem(item.id, 'price', parsed)
                              }}
                            />
                          </td>
                          <td className="py-1 px-1">
                            <div className="relative">
                              <input
                                disabled={isDisabled}
                                className={`${pctInput + ' font-black'} ${isDisabled ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                                type="number"
                                min="0"
                                max={
                                  item.discountType === 'PERCENT' ? '100' : '999999'
                                }
                                step="0.01"
                                placeholder="0"
                                value={item.discount || ''}
                                onChange={(e) =>
                                  updateReceiptItem(
                                    item.id,
                                    'discount',
                                    e.target.value === ''
                                      ? ''
                                      : parseFloat(e.target.value) || 0,
                                  )
                                }
                              />
                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-black pointer-events-none">
                                {item.discountType === 'PERCENT' ? '%' : '₱'}
                              </span>
                            </div>
                          </td>
                          <td className="py-1 px-1">
                            {isDisabled ? (
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
                                  updateReceiptItem(
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
                            {isDisabled ? (
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
                                  updateReceiptItem(item.id, 'vatSearch', v)
                                }
                                onSelect={(opt) => {
                                  updateReceiptItem(item.id, 'vat', opt.value)
                                  updateReceiptItem(item.id, 'vatSearch', opt.label)
                                  updateReceiptItem(item.id, 'vatRate', opt.rate)
                                }}
                                onFocus={loadVatOnDemand}
                                options={vatOptions}
                                inputClassName={`${pctInput + ' font-black text-red-600'}`}
                                emptyText={vatError || 'No VAT rates found'}
                                disabled={vatLoading}
                              />
                            )}
                          </td>
                          <td className="py-1 px-1">
                            {isDisabled ? (
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
                                  updateReceiptItem(item.id, 'whtSearch', v)
                                }
                                onSelect={(opt) => {
                                  updateReceiptItem(item.id, 'wht', opt.value)
                                  updateReceiptItem(item.id, 'whtSearch', opt.label)
                                  updateReceiptItem(item.id, 'whtRate', opt.rate)
                                }}
                                onFocus={loadWhtOnDemand}
                                options={whtOptions}
                                inputClassName={`${pctInput + ' font-black text-blue-600'}`}
                                emptyText={whtError || 'No WHT rates found'}
                                disabled={whtLoading}
                              />
                            )}
                          </td>
                          <td className="py-1 px-1">
                            <input
                              disabled={isDisabled}
                              className={`${tableInput} ${isDisabled ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              placeholder="Select"
                              value={item.responsibilityCenter}
                              onChange={(e) =>
                                updateReceiptItem(
                                  item.id,
                                  'responsibilityCenter',
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="py-1 px-1 text-center">
                            {!isDisabled && (
                              <button
                                onClick={() => removeReceiptItem(item.id)}
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
                {!isDisabled && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => addReceiptItem(false)}
                      className="flex-1 py-2 border-2 border-dashed rounded-xl text-[11px] font-black uppercase border-red-300 text-red-600 transition-all duration-300 hover:bg-red-50 hover:border-red-500 hover:-translate-y-1 hover:shadow-lg hover:shadow-red-500/10 flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> ADD Product/Service
                    </button>
                    <button
                      onClick={() => addReceiptItem(true)}
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
                      <col style={{ width: '35%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '18%' }} />
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
                              disabled={isDisabled}
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
                              inputClassName={`${tableInput} ${isDisabled ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              emptyText="No accounts found"
                            />
                          </td>
                          <td className="py-1.5 px-1">
                            <input
                              disabled={isDisabled}
                              className={`${tableInput + ' font-black'} ${isDisabled ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              placeholder="0.00"
                              type="number"
                              value={entry.debit || ''}
                              onChange={(e) =>
                                updateJournalEntry(
                                  entry.id,
                                  'debit',
                                  e.target.value === ''
                                    ? ''
                                    : parseFloat(e.target.value) || 0,
                                )
                              }
                            />
                          </td>
                          <td className="py-1.5 px-1">
                            <input
                              disabled={isDisabled}
                              className={`${tableInput + ' font-black text-red-600'} ${isDisabled ? 'bg-transparent text-gray-200 cursor-not-allowed' : ''}`}
                              placeholder="0.00"
                              type="number"
                              value={entry.credit || ''}
                              onChange={(e) =>
                                updateJournalEntry(
                                  entry.id,
                                  'credit',
                                  e.target.value === ''
                                    ? ''
                                    : parseFloat(e.target.value) || 0,
                                )
                              }
                            />
                          </td>
                          <td className="py-1.5 px-1">
                            <input
                              disabled={isDisabled}
                              className={`${tableInput} ${isDisabled ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              placeholder="Center..."
                              value={entry.center}
                              onChange={(e) =>
                                updateJournalEntry(
                                  entry.id,
                                  'center',
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="py-1.5 text-center">
                            {!isDisabled && (
                              <button
                                className="p-1 text-red-600 transition-colors hover:bg-red-50 rounded"
                                onClick={() => removeJournalEntry(entry.id)}
                              >
                                <Trash2 size={15} className="mx-auto" />
                              </button>
                            )}
                            {!isDisabled && (
                              <span className="text-gray-300 text-[11px] italic">
                                {isAutoGeneratedEntry(entry) ? 'Auto' : 'Manual'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      {(() => {
                        const balance = calculateJournalBalance()
                        return (
                          <tr className="bg-gray-50/50 border">
                            <td
                              colSpan={1}
                              className="py-2 px-3 text-[12px] font-black uppercase text-black text-left"
                            >
                              Balance Check{' '}
                              {balance.isBalanced ? 'Balanced' : 'Unbalanced'}
                            </td>
                            <td className="py-2 px-1 text-center text-[13px] font-black">
                              {fmt(balance.totalDebit)}
                            </td>
                            <td className="py-2 px-1 text-center text-[13px] font-black text-red-600">
                              {fmt(balance.totalCredit)}
                            </td>
                            <td className="py-2 px-1 text-center text-[13px] font-bold">
                              <span
                                className={
                                  balance.isBalanced
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                }
                              >
                                {balance.isBalanced
                                  ? 'Balanced'
                                  : `Diff: ${fmt(Math.abs(balance.totalDebit - balance.totalCredit))}`}
                              </span>
                            </td>
                            <td />
                          </tr>
                        )
                      })()}
                    </tfoot>
                  </table>
                </div>
                {!isDisabled && (
                  <button
                    onClick={addJournalEntry}
                    className="mt-2 py-1.5 border-2 border-dashed rounded-lg w-full text-[12px] font-black uppercase border-red-300 text-red-600 transition-all duration-300 hover:bg-red-50 hover:border-red-500 hover:-translate-y-1 hover:shadow-lg hover:shadow-red-500/10 flex items-center justify-center gap-1"
                  >
                    <Plus size={15} /> Add Ledger Row
                  </button>
                )}
              </TableSection>

              {/* 3. ATTACHMENTS & REMARKS */}
              <div className="grid grid-cols-1 gap-4">
                <TableSection title="Attachments" icon={<Paperclip size={14} />}>
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
                                disabled={isDisabled}
                                className={`${tableInput} ${isDisabled ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
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
                              {isDisabled ? (
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
                                        onError={(e) => {
                                          let fixedSrc = file.file.replace(/\s/g, '')
                                          const base64Content =
                                            fixedSrc.split(',')[1]
                                          if (base64Content) {
                                            const paddingNeeded =
                                              (4 - (base64Content.length % 4)) % 4
                                            if (paddingNeeded > 0) {
                                              e.target.src =
                                                fixedSrc.split(',')[0] +
                                                ',' +
                                                base64Content +
                                                '='.repeat(paddingNeeded)
                                              return
                                            }
                                          }
                                          e.target.style.display = 'none'
                                          const fallback =
                                            document.createElement('span')
                                          fallback.className =
                                            'text-red-600 text-[10px] font-bold'
                                          fallback.textContent = 'Image error'
                                          e.target.parentNode.appendChild(fallback)
                                        }}
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
                                disabled={isDisabled}
                                className={`${tableInput} ${isDisabled ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
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
                              {!isDisabled && (
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
                  {!isDisabled && (
                    <button
                      onClick={addAttachment}
                      className="mt-2 py-1.5 border-2 border-dashed rounded-lg w-full text-[12px] font-black uppercase border-red-300 text-red-600 transition-all duration-300 hover:bg-red-50 hover:border-red-500 hover:-translate-y-1 hover:shadow-lg hover:shadow-red-500/10 flex items-center justify-center gap-1"
                    >
                      <Plus size={15} /> Add File
                    </button>
                  )}
                </TableSection>

                <TableSection title="Remarks" icon={<FileText size={14} />}>
                  <textarea
                    disabled={isDisabled}
                    className={`w-full min-h-[100px] mt-4 p-4 rounded-xl text-[14px] font-bold outline-none ${isDisabled ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed resize-none' : 'bg-gray-50 border-none focus:ring-1 focus:ring-red-500'}`}
                    placeholder="Enter justification or internal notes here..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </TableSection>
              </div>
            </motion.div>
          </main>
        </div>

        {/* CUSTOMER ADD MODAL */}
        {!isDisabled && (
          <RightSideModal
            isOpen={isCustomerModalOpen}
            onClose={closeCustomerModal}
            title="Add Customer"
          >
            <form onSubmit={handleCustomerFormSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                    Customer Code <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerForm.code}
                    onChange={(e) =>
                      setCustomerForm({ ...customerForm, code: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                    placeholder="Enter customer code..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                    Customer Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerForm.name}
                    onChange={(e) =>
                      setCustomerForm({ ...customerForm, name: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                    placeholder="Enter customer name..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                    Category
                  </label>
                  <input
                    type="text"
                    value={customerForm.category}
                    onChange={(e) =>
                      setCustomerForm({ ...customerForm, category: e.target.value })
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
                    value={customerForm.type}
                    onChange={(e) =>
                      setCustomerForm({ ...customerForm, type: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Select type...</option>
                    <option value="individual">Individual</option>
                    <option value="business">Business</option>
                    <option value="government">Government</option>
                    <option value="non-profit">Non-Profit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                    Status <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={customerForm.status}
                    onChange={(e) =>
                      setCustomerForm({ ...customerForm, status: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all appearance-none cursor-pointer"
                    required
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeCustomerModal}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 text-xs font-black rounded-xl hover:bg-gray-200 transition-all uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={customerCreateLoading}
                  className="flex-1 px-4 py-3 bg-black text-white text-xs font-black rounded-xl hover:bg-red-600 transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Plus size={14} />
                  {customerCreateLoading ? 'Creating...' : 'Create Customer'}
                </button>
              </div>
            </form>
          </RightSideModal>
        )}

        {!isDisabled && (
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
                    Category <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={productForm.category}
                    onChange={(e) =>
                      setProductForm({ ...productForm, category: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                    placeholder="Enter category..."
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                      Sales Price <span className="text-red-600">*</span>
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
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                      Purchase Price <span className="text-red-600">*</span>
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
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                    Unit <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={productForm.unit}
                    onChange={(e) =>
                      setProductForm({ ...productForm, unit: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all appearance-none cursor-pointer"
                    required
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

        {/* IMAGE MODAL */}
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
function TableSection({ title, icon, children }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-red-50 text-red-600 rounded-lg">{icon}</div>
          <h2 className="text-[15px] font-black uppercase tracking-[1px] text-black">
            {title}
          </h2>
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
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
