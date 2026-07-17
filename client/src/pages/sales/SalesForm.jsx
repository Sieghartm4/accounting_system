import React, { useState } from 'react'
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
import useSalesForm, { fmt, useDragToScroll } from './useSales'

// ─────────────────────────────────────────────────────────────────────────────
// Portal Dropdown
// ─────────────────────────────────────────────────────────────────────────────
const MIN_DROPDOWN_WIDTH = 260

function PortalDropdown({ anchorRef, open, children }) {
  const [style, setStyle] = useState({})

  React.useEffect(() => {
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
  const anchorRef = React.useRef(null)
  const closeTimer = React.useRef(null)
  const filtered = options.filter(
    (o) =>
      !value ||
      o.label.toLowerCase().includes(value.toLowerCase()) ||
      (o.sublabel || '').toLowerCase().includes(value.toLowerCase()),
  )
  const handleBlur = () => {
    if (!disabled) closeTimer.current = setTimeout(() => setOpen(false), 180)
  }
  const handleFocus = () => {
    if (disabled) return
    clearTimeout(closeTimer.current)
    setOpen(true)
    if (onFocus) onFocus()
  }
  const handleSelect = (opt) => {
    clearTimeout(closeTimer.current)
    onSelect(opt)
    setOpen(false)
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
export default function SalesForm({
  onBack,
  onSuccess,
  isViewMode = false,
  isEditMode = false,
  salesData = null,
} = {}) {
  const form = useSalesForm({ isViewMode, isEditMode, salesData, onBack, onSuccess })
  const salesItemsScrollRef = useDragToScroll()

  const modeOfPaymentOptions = [
    'CASH',
    'CHECK',
    'BANK_TRANSFER',
    'CARD',
    'E-WALLET',
    'OTHERS',
  ]
  const categoryOptions = [
    'OPERATIONAL EXPENSES',
    'ADMINISTRATIVE EXPENSES',
    'MARKETING EXPENSES',
    'MAINTENANCE EXPENSES',
    'UTILITIES EXPENSES',
    'RENT EXPENSES',
    'SUPPLIES EXPENSES',
    'PROFESSIONAL FEES',
    'INSURANCE EXPENSES',
    'OTHER EXPENSES',
  ]
  const termsOptions = ['DAYS', 'MONTHS', 'DURATION OF TIME']

  const inputBase =
    'w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ' +
    (isViewMode
      ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed'
      : 'bg-gray-50 border border-gray-200 text-black focus:ring-1 focus:ring-red-500 text-center')

  const tableInput =
    'w-full rounded-md px-1 py-1 text-[13px] font-bold text-center outline-none ' +
    (isViewMode
      ? 'bg-gray-100 border border-gray-300 text-black! cursor-not-allowed'
      : 'bg-gray-50/50 focus:ring-1 focus:ring-red-400')

  const pctInput = tableInput + ' pr-1'
  const fadeInUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  }

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [customerForm, setCustomerForm] = useState({
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

  const openCustomerModal = () => {
    setCustomerForm({
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
    setIsCustomerModalOpen(true)
  }

  const closeCustomerModal = () => {
    setIsCustomerModalOpen(false)
    setCustomerForm({
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

  const handleCustomerFormSubmit = async (e) => {
    e.preventDefault()
    const payload = {
      ...customerForm,
      tin: customerForm.tin?.replace(/\D/g, '').slice(0, 14),
      contact: customerForm.contact?.slice(0, 15),
    }
    const result = await form.createCustomer(payload)

    if (!result.success) {
      form.setToast({
        type: 'error',
        message: result.message || 'Failed to create customer',
      })
      return
    }

    const createdCustomer = result.data
    form.setSelectedCustomer(createdCustomer.id || '')
    form.setCustomerSearch(createdCustomer.name || createdCustomer.code || '')
    form.setToast({
      type: 'success',
      message: `Customer "${createdCustomer.name || createdCustomer.code}" added successfully.`,
    })
    closeCustomerModal()
  }

  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
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
    const result = await form.createProduct(productForm)

    if (!result.success) {
      form.setToast({
        type: 'error',
        message: result.message || 'Failed to create product',
      })
      return
    }

    const createdProduct = result.data
    const currentItemId = form.salesItems[form.salesItems.length - 1]?.id
    if (currentItemId) {
      form.updateSalesItem(currentItemId, 'productId', createdProduct.id || '')
      form.updateSalesItem(
        currentItemId,
        'productSearch',
        createdProduct.name || createdProduct.code || '',
      )
    }
    form.setToast({
      type: 'success',
      message: `Product "${createdProduct.name || createdProduct.code}" added successfully.`,
    })
    closeProductModal()
  }

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

      {form.toast && (
        <DynamicToast
          type={form.toast.type}
          message={form.toast.message}
          onClose={() => form.setToast(null)}
        />
      )}

      <RightSideModal
        isOpen={isCustomerModalOpen}
        onClose={closeCustomerModal}
        title="Create New Customer"
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
                value={customerForm.address}
                onChange={(e) =>
                  setCustomerForm({ ...customerForm, address: e.target.value })
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
                value={customerForm.tin}
                onChange={(e) =>
                  setCustomerForm({
                    ...customerForm,
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
                value={customerForm.details}
                onChange={(e) =>
                  setCustomerForm({ ...customerForm, details: e.target.value })
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
                value={customerForm.contact}
                onChange={(e) =>
                  setCustomerForm({
                    ...customerForm,
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
              onClick={closeCustomerModal}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 text-xs font-black rounded-xl hover:bg-gray-200 transition-all uppercase tracking-widest"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-black text-white text-xs font-black rounded-xl hover:bg-red-600 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Plus size={14} />
              Create Customer
            </button>
          </div>
        </form>
      </RightSideModal>

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
                    setProductForm({ ...productForm, sales_price: e.target.value })
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
              className="flex-1 px-4 py-3 bg-black text-white text-xs font-black rounded-xl hover:bg-red-600 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Plus size={14} />
              Create Product/Service
            </button>
          </div>
        </form>
      </RightSideModal>

      {/* TOP NAV */}
      <div className="flex items-center justify-between flex-shrink-0">
        <nav
          className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[2px] text-gray-400 cursor-pointer hover:text-black transition-colors"
          onClick={onBack}
        >
          <ArrowLeft size={17} />
          <span className="text-black">Back to Sales</span>
        </nav>
        {!isViewMode && (
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white border border-gray-200 text-[12px] font-black text-gray-400 rounded-lg hover:bg-gray-50 transition-all uppercase">
              Save Draft
            </button>
            <button
              onClick={form.handlePostTransaction}
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
          <div className="grid gap-3 grid-cols-5">
            {/* Customer */}
            <div className="col-span-1">
              <fieldset>
                <legend className="text-[11px] font-black uppercase text-gray-100">
                  Customer <span className="text-red-600">*</span>
                </legend>
                {isViewMode ? (
                  <div className={inputBase + ' text-black py-1.5'}>
                    {form.customerSearch || 'No customer selected'}
                  </div>
                ) : form.customerLoading ? (
                  <div className={inputBase + ' text-black py-1.5'}>
                    Loading customers...
                  </div>
                ) : (
                  <SearchableDropdown
                    placeholder="Customer *"
                    value={form.customerSearch}
                    onChange={(v) => {
                      form.setCustomerSearch(v)
                      form.setSelectedCustomer('')
                    }}
                    onSelect={(opt) => {
                      form.setSelectedCustomer(opt.value)
                      form.setCustomerSearch(opt.label)
                    }}
                    options={form.customerOptions}
                    inputClassName={inputBase}
                    emptyText={form.customerError || 'No customers found'}
                    dropdownFooter={
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                        }}
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
            {/* Reference Number */}
            <div className="col-span-1">
              <fieldset>
                <legend className="text-[11px] font-black uppercase text-gray-100">
                  Reference Number
                </legend>
                <input
                  type="text"
                  placeholder="INV-000"
                  value={form.documentReference}
                  onChange={(e) => form.setDocumentReference(e.target.value)}
                  disabled={isViewMode}
                  className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${isViewMode ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed' : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'}`}
                />
              </fieldset>
            </div>
            {/* Terms */}
            <div className="col-span-1">
              <fieldset>
                <legend className="text-[11px] font-black uppercase text-gray-100">
                  Terms <span className="text-red-600">*</span>
                </legend>
                <div className="grid grid-cols-2 gap-1">
                  <select
                    disabled={isViewMode}
                    value={form.termsOption}
                    onChange={(e) => form.setTermsOption(e.target.value)}
                    className={`w-full px-2 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${isViewMode ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed' : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'}`}
                  >
                    {termsOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <input
                    disabled={isViewMode}
                    type="number"
                    placeholder="Number"
                    value={form.termsNumber}
                    onChange={(e) => form.setTermsNumber(e.target.value)}
                    className={`w-full px-2 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${isViewMode ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed' : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'}`}
                  />
                </div>
              </fieldset>
            </div>
            {/* Date Delivered */}
            <div className="col-span-1">
              <fieldset>
                <legend className="text-[11px] font-black uppercase text-gray-100">
                  Date Delivered
                </legend>
                <input
                  type="date"
                  disabled={isViewMode}
                  value={form.dateDelivered}
                  onChange={(e) => form.setDateDelivered(e.target.value)}
                  className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${isViewMode ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed' : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'}`}
                />
              </fieldset>
            </div>
            {/* Date Due */}
            <div className="col-span-1">
              <fieldset>
                <legend className="text-[11px] font-black uppercase text-gray-100">
                  Date Due
                </legend>
                <input
                  type="date"
                  disabled={isViewMode}
                  value={form.dateDue}
                  onChange={(e) => form.setDateDue(e.target.value)}
                  className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${isViewMode ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed' : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'}`}
                />
              </fieldset>
            </div>
          </div>
        </fieldset>

        <div className="flex-1 flex gap-2 min-h-0">
          {/* SUMMARY SIDEBAR */}
          <aside className="w-full flex-shrink-0 flex flex-col gap-2 h-full overflow-y-auto sidebar-scroll max-w-[20%]">
            <section className="bg-white rounded-2xl border-2 border-red-100 shadow-xl shadow-red-500/5 flex-1 flex flex-col min-h-0 overflow-hidden">
              <header className="bg-red-600 p-4 flex-shrink-0">
                <h3 className="text-[clamp(14px,1.4vw,16px)] font-black uppercase tracking-[3px] text-white flex items-center gap-2">
                  <Calculator size={16} className="shrink-0 text-white" /> Summary
                </h3>
              </header>
              <div className="custom-table-scroller overflow-y-auto min-h-0 flex-1 custom-scrollbar p-4 py-2">
                <div className="space-y-0">
                  <SummaryRow
                    label="Total Sales Price"
                    value={fmt(form.summary.totalSalesPrice)}
                  />
                  <SDivider />
                  <SummaryRow
                    label="Total Discount"
                    value={fmt(form.summary.totalDiscount)}
                    color="text-orange-500"
                  />
                  <SDivider />
                  <SummaryRow
                    label="Total Discounted Amount"
                    value={fmt(form.summary.totalDiscounted)}
                  />
                  <SDivider />
                  <SummaryRow
                    label="Total VAT"
                    value={fmt(form.summary.totalVAT)}
                    color="text-red-600"
                  />
                  <SDivider />
                  <SummaryRow
                    label="VATable Sales"
                    value={fmt(form.summary.vatableSales)}
                  />
                  <SDivider />
                  <SummaryRow
                    label="VAT-Exempt Sales"
                    value={fmt(form.summary.vatExemptSales)}
                  />
                  <SDivider />
                  <SummaryRow
                    label="Zero Rated Sales"
                    value={fmt(form.summary.zeroRatedSales)}
                  />
                  <SDivider />
                  <SummaryRow
                    label="Total No. VAT Discount"
                    value={fmt(form.summary.totalNoVatDiscount)}
                  />
                  <SDivider />
                  <SummaryRow
                    label="Total Net of VAT"
                    value={fmt(form.summary.totalNetOfVat)}
                  />
                  <SDivider />
                  <SummaryRow
                    label="Total Withholding Tax"
                    value={fmt(form.summary.totalWHT)}
                    color="text-blue-600"
                  />
                </div>
              </div>
              <div className="p-4 pt-0 flex-shrink-0">
                <div className="flex flex-col gap-[2px] mb-3">
                  <div className="h-[3px] w-full bg-red-600 rounded-full" />
                  <div className="h-[1px] w-full bg-black/10" />
                </div>
                <div className="text-center bg-red-500 rounded-xl py-3 border border-gray-100">
                  <p className="text-[clamp(11px,1.1vw,12px)] font-black text-gray-200 uppercase tracking-[4px] mb-1">
                    Total Sales
                  </p>
                  <p className="text-[clamp(22px,2.5vw,28px)] font-black text-white tracking-tighter leading-none flex items-baseline justify-center gap-2">
                    <span className="text-[clamp(12px,1.3vw,15px)] text-green-300 font-black">
                      PHP
                    </span>
                    {fmt(form.summary.totalAmountDue)}
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
              {/* 1. SALES ITEMS */}
              <TableSection title="Sales Items" icon={<Wallet size={14} />}>
                <div className="w-full flex flex-col gap-[2px] mb-3">
                  <div className="h-[2px] w-full bg-red-600 rounded-full" />
                  <div className="h-[1px] w-full bg-black/10" />
                </div>
                <div
                  ref={salesItemsScrollRef}
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
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '9%' }} />
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
                            className="pb-3 text-[12px] font-black uppercase text-gray-900 text-center px-1"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {form.salesItems.map((item) => (
                        <tr
                          key={item.id}
                          className={item.isOther ? 'bg-gray-50/30' : ''}
                        >
                          {/* Product */}
                          <td className="py-1 px-1">
                            <SearchableDropdown
                              disabled={isViewMode || item.isOther}
                              placeholder={item.isOther ? '' : 'Search product...'}
                              value={item.isOther ? '' : item.productSearch}
                              onChange={(v) =>
                                form.updateSalesItem(item.id, 'productSearch', v)
                              }
                              onSelect={(opt) => {
                                form.updateSalesItem(item.id, 'productId', opt.value)
                                form.updateSalesItem(
                                  item.id,
                                  'productSearch',
                                  opt.label,
                                )
                              }}
                              options={form.productOptions}
                              inputClassName={`${tableInput} ${isViewMode || item.isOther ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              emptyText={form.productError || 'No products found'}
                              dropdownFooter={
                                !isViewMode && !item.isOther ? (
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
                          </td>
                          {/* COA */}
                          <td className="py-1 px-1">
                            <SearchableDropdown
                              disabled={isViewMode}
                              placeholder="Search account..."
                              value={item.coaSearch}
                              onChange={(v) =>
                                form.updateSalesItem(item.id, 'coaSearch', v)
                              }
                              onSelect={(opt) => {
                                form.updateSalesItem(item.id, 'coa', opt.value)
                                form.updateSalesItem(item.id, 'coaSearch', opt.label)
                              }}
                              options={form.coaOptions}
                              inputClassName={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              emptyText="No accounts found"
                            />
                          </td>
                          {/* Description */}
                          <td className="py-1 px-1">
                            <input
                              disabled={isViewMode}
                              className={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              placeholder="Details..."
                              value={item.description}
                              onChange={(e) =>
                                form.updateSalesItem(
                                  item.id,
                                  'description',
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          {/* Qty */}
                          <td className="py-1 px-1">
                            <input
                              disabled={isViewMode || item.isOther}
                              type="number"
                              min="0"
                              className={`${tableInput} ${isViewMode || item.isOther ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              placeholder={item.isOther ? '' : '1'}
                              value={item.isOther ? '' : item.qty || ''}
                              onChange={(e) =>
                                form.updateSalesItem(
                                  item.id,
                                  'qty',
                                  e.target.value === ''
                                    ? ''
                                    : parseFloat(e.target.value) || 0,
                                )
                              }
                            />
                          </td>
                          {/* Price */}
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
                                form.updateSalesItem(item.id, 'price', parsed)
                              }}
                            />
                          </td>
                          {/* Discount */}
                          <td className="py-1 px-1">
                            <div className="relative">
                              <input
                                disabled={isViewMode}
                                className={`${pctInput + ' font-black'} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                                type="number"
                                min="0"
                                max={
                                  item.discountType === 'PERCENT' ? '100' : '999999'
                                }
                                step="0.01"
                                placeholder="0"
                                value={item.discount || ''}
                                onChange={(e) =>
                                  form.updateSalesItem(
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
                          {/* Discount Type */}
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
                                  form.updateSalesItem(
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
                          {/* VAT */}
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
                                  form.updateSalesItem(item.id, 'vatSearch', v)
                                }
                                onFocus={form.loadVatOnDemand}
                                onSelect={(opt) => {
                                  form.updateSalesItem(item.id, 'vat', opt.value)
                                  form.updateSalesItem(
                                    item.id,
                                    'vatSearch',
                                    opt.label,
                                  )
                                  form.updateSalesItem(item.id, 'vatRate', opt.rate)
                                }}
                                options={form.vatOptions}
                                inputClassName={`${pctInput + ' font-black text-red-600'}`}
                                emptyText={form.vatError || 'No VAT rates found'}
                                disabled={form.vatLoading}
                              />
                            )}
                          </td>
                          {/* WHT */}
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
                                  form.updateSalesItem(item.id, 'whtSearch', v)
                                }
                                onFocus={form.loadWhtOnDemand}
                                onSelect={(opt) => {
                                  form.updateSalesItem(item.id, 'wht', opt.value)
                                  form.updateSalesItem(
                                    item.id,
                                    'whtSearch',
                                    opt.label,
                                  )
                                  form.updateSalesItem(item.id, 'whtRate', opt.rate)
                                }}
                                options={form.whtOptions}
                                inputClassName={`${pctInput + ' font-black text-blue-600'}`}
                                emptyText={form.whtError || 'No WHT rates found'}
                                disabled={form.whtLoading}
                              />
                            )}
                          </td>
                          {/* Responsibility Center */}
                          <td className="py-1 px-1">
                            <input
                              disabled={isViewMode}
                              className={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              placeholder="Select"
                              value={item.responsibilityCenter}
                              onChange={(e) =>
                                form.updateSalesItem(
                                  item.id,
                                  'responsibilityCenter',
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          {/* Delete */}
                          <td className="py-1 px-1 text-center">
                            {!isViewMode && (
                              <button
                                onClick={() => form.removeSalesItem(item.id)}
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
                      onClick={() => form.addSalesItem(false)}
                      className="flex-1 py-2 border-2 border-dashed rounded-xl text-[11px] font-black uppercase border-red-300 text-red-600 transition-all duration-300 hover:bg-red-50 hover:border-red-500 hover:-translate-y-1 hover:shadow-lg hover:shadow-red-500/10 flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> ADD Product/Service
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
                      {form.journalEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td className="py-1.5 px-1">
                            <SearchableDropdown
                              disabled={isViewMode}
                              placeholder="Search account..."
                              value={entry.accountSearch}
                              onChange={(v) =>
                                form.updateJournalEntry(entry.id, 'accountSearch', v)
                              }
                              onSelect={(opt) => {
                                form.updateJournalEntry(
                                  entry.id,
                                  'account',
                                  opt.value,
                                )
                                form.updateJournalEntry(
                                  entry.id,
                                  'accountSearch',
                                  opt.label,
                                )
                              }}
                              options={form.coaOptions}
                              inputClassName={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              emptyText="No accounts found"
                            />
                          </td>
                          <td className="py-1.5 px-1">
                            <input
                              disabled={isViewMode}
                              className={`${tableInput + ' font-black'} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              placeholder="0.00"
                              type="number"
                              value={entry.debit || ''}
                              onChange={(e) =>
                                form.updateJournalEntry(
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
                              disabled={isViewMode}
                              className={`${tableInput + ' font-black text-red-600'} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              placeholder="0.00"
                              type="number"
                              value={entry.credit || ''}
                              onChange={(e) =>
                                form.updateJournalEntry(
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
                              disabled={isViewMode}
                              className={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              placeholder="Center..."
                              value={entry.center}
                              onChange={(e) =>
                                form.updateJournalEntry(
                                  entry.id,
                                  'center',
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="py-1.5 text-center">
                            {!isViewMode && (
                              <button
                                className="p-1 text-red-600 transition-colors hover:bg-red-50 rounded"
                                onClick={() => form.removeJournalEntry(entry.id)}
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
                          {fmt(form.summary.totalJournalDebit)}
                        </td>
                        <td className="py-2 px-1 text-center text-[13px] font-black text-red-600">
                          {fmt(form.summary.totalJournalCredit)}
                        </td>
                        <td />
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {!isViewMode && (
                  <button
                    onClick={form.addJournalEntry}
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
                        {form.attachments.map((file) => (
                          <tr key={file.id}>
                            <td className="py-2 px-1">
                              <input
                                disabled={isViewMode}
                                className={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                                placeholder="e.g. Invoice_Scan"
                                value={file.fileName}
                                onChange={(e) =>
                                  form.updateAttachment(
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
                                        form.setImageModal({
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
                                    form.handleFileChange(file.id, e.target.files[0])
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
                                  form.updateAttachment(
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
                                  onClick={() => form.removeAttachment(file.id)}
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
                      onClick={form.addAttachment}
                      className="mt-2 py-1.5 border-2 border-dashed rounded-lg w-full text-[12px] font-black uppercase border-red-300 text-red-600 transition-all duration-300 hover:bg-red-50 hover:border-red-500 hover:-translate-y-1 hover:shadow-lg hover:shadow-red-500/10 flex items-center justify-center gap-1"
                    >
                      <Plus size={15} /> Add File
                    </button>
                  )}
                </TableSection>

                <TableSection title="Remarks" icon={<FileText size={14} />}>
                  <textarea
                    disabled={isViewMode}
                    className={`w-full min-h-[100px] mt-4 p-4 rounded-xl text-[14px] font-bold focus:ring-1 focus:ring-red-500 outline-none ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : 'bg-gray-50 border-none'}`}
                    placeholder="Enter justification or internal notes here..."
                    value={form.remarks}
                    onChange={(e) => form.setRemarks(e.target.value)}
                  />
                </TableSection>
              </div>
            </motion.div>
          </main>
        </div>

        {/* Image Preview Modal */}
        {form.imageModal.isOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => form.setImageModal({ isOpen: false, imageSrc: '' })}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                form.setImageModal({ isOpen: false, imageSrc: '' })
              }}
              className="absolute top-6 right-6 text-white hover:text-red-500 transition-colors"
            >
              <ArrowLeft size={32} />
            </button>
            <img
              src={form.imageModal.imageSrc}
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
