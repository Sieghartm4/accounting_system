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
import { getItemResponsibilityCenter } from '../../utils/responsibilityCenterDefaults'

// ─────────────────────────────────────────────────────────────────────────────
// Drag to Scroll Hook
// ─────────────────────────────────────────────────────────────────────────────
function useDragToScroll() {
  const ref = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const handleMouseDown = (e) => {
      setIsDragging(true)
      setStartX(e.pageX - element.offsetLeft)
      setScrollLeft(element.scrollLeft)
      element.style.cursor = 'grabbing'
      element.style.userSelect = 'none'
    }

    const handleMouseLeave = () => {
      setIsDragging(false)
      element.style.cursor = 'grab'
      element.style.userSelect = 'auto'
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      element.style.cursor = 'grab'
      element.style.userSelect = 'auto'
    }

    const handleMouseMove = (e) => {
      if (!isDragging) return
      e.preventDefault()
      const x = e.pageX - element.offsetLeft
      const walk = (x - startX) * 2 // Adjust scroll speed
      element.scrollLeft = scrollLeft - walk
    }

    // Add cursor style
    element.style.cursor = 'grab'

    element.addEventListener('mousedown', handleMouseDown)
    element.addEventListener('mouseleave', handleMouseLeave)
    element.addEventListener('mouseup', handleMouseUp)
    element.addEventListener('mousemove', handleMouseMove)

    return () => {
      element.removeEventListener('mousedown', handleMouseDown)
      element.removeEventListener('mouseleave', handleMouseLeave)
      element.removeEventListener('mouseup', handleMouseUp)
      element.removeEventListener('mousemove', handleMouseMove)
    }
  }, [isDragging, startX, scrollLeft])

  return ref
}

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
    if (disabled) return
    closeTimer.current = setTimeout(() => setOpen(false), 180)
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
// SUMMARY COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────
//
//  Per item:
//    gross            = qty × price
//    discountAmount   = gross × (discount / 100)          ← discount is a % field
//    discountedAmount = gross − discountAmount
//    vatAmount        = discountedAmount × (vat / 100)    ← vat is a % field (0 or 12)
//    whtAmount        = discountedAmount × (wht / 100)    ← wht is a % field
//
//  VATable item     → vat > 0
//    vatablePurchases  += discountedAmount / (1 + vat/100)   (the net-of-VAT base)
//    totalNoVatDiscount+= discountAmount                     (pre-VAT discount on vatable items)
//
//  Zero-Rated item  → vat === 0 AND wht > 0
//    zeroRatedPurchases += discountedAmount
//
//  VAT-Exempt item  → vat === 0 AND wht === 0
//    vatExemptPurchases += discountedAmount
//
//  totalNetOfVat    = Σ (net-of-VAT base per item)
//                   = Σ discountedAmount / (1 + vat/100)  for vatable
//                   + Σ discountedAmount                   for non-vatable
//
//  totalAmountDue   = totalDiscounted + totalVAT − totalWHT
//
function computeSummary(items) {
  let totalSalesPrice = 0
  let totalDiscount = 0
  let totalDiscounted = 0
  let totalVAT = 0
  let vatableSales = 0
  let vatExemptSales = 0
  let zeroRatedSales = 0
  let totalNoVatDiscount = 0
  let totalNetOfVat = 0
  let totalWHT = 0

  items.forEach((item) => {
    const qty = parseFloat(item.qty) || 0
    const price = parseFloat(item.price) || 0
    const discountValue = parseFloat(item.discount) || 0
    const discountType = item.discountType || 'PERCENT'
    const vatPct = parseFloat(item.vatRate) || 0
    const whtPct = parseFloat(item.whtRate) || 0
    const vatType = item.vatType || 'VAT-EX'

    const gross = qty * price
    let discAmt = 0

    if (discountType === 'PERCENT') {
      discAmt = gross * (discountValue / 100)
    } else {
      discAmt = discountValue * qty
    }

    const discounted = gross - discAmt
    
    let vatAmt, netBase
    if (vatType === 'VAT-INC' && vatPct > 0) {
      // VAT Inclusive: extract VAT from the discounted amount
      // Formula: VAT = discounted - (discounted / (1 + vatRate/100))
      // Net = discounted / (1 + vatRate/100)
      netBase = discounted / (1 + vatPct / 100)
      vatAmt = discounted - netBase
    } else {
      // VAT Exclusive: VAT is calculated on top of the discounted amount
      vatAmt = discounted * (vatPct / 100)
      netBase = discounted
    }
    
    const whtAmt = netBase * (whtPct / 100)

    // For VAT-exclusive pricing, VATable sales is the discounted amount (before VAT is added)
    totalSalesPrice += gross
    totalDiscount += discAmt
    totalDiscounted += discounted
    totalVAT += vatAmt
    totalWHT += whtAmt
    totalNetOfVat += netBase

    if (vatPct > 0) {
      vatableSales += netBase // This is now the discounted amount for VATable items
      totalNoVatDiscount += discAmt
    } else if (whtPct > 0) {
      zeroRatedSales += discounted
    } else {
      vatExemptSales += discounted
    }
  })

  // Calculate total amount due based on VAT type per item
  let totalAmountDue = 0
  items.forEach((item) => {
    const qty = parseFloat(item.qty) || 0
    const price = parseFloat(item.price) || 0
    const discountValue = parseFloat(item.discount) || 0
    const discountType = item.discountType || 'PERCENT'
    const vatPct = parseFloat(item.vatRate) || 0
    const whtPct = parseFloat(item.whtRate) || 0
    const vatType = item.vatType || 'VAT-EX'

    const gross = qty * price
    const discAmt = discountType === 'PERCENT' ? gross * (discountValue / 100) : discountValue * qty
    const discounted = gross - discAmt
    
    let netBase, vatAmt
    if (vatType === 'VAT-INC' && vatPct > 0) {
      netBase = discounted / (1 + vatPct / 100)
      vatAmt = discounted - netBase
    } else {
      netBase = discounted
      vatAmt = discounted * (vatPct / 100)
    }
    
    const whtAmt = netBase * (whtPct / 100)
    
    // For VAT-INC, amount due is discounted (VAT already included)
    // For VAT-EX, amount due is netBase + VAT
    const amountDue = vatType === 'VAT-INC' ? discounted : (netBase + vatAmt)
    totalAmountDue += (amountDue - whtAmt)
  })

  return {
    totalSalesPrice,
    totalDiscount,
    totalDiscounted,
    totalVAT,
    vatableSales,
    vatExemptSales,
    zeroRatedSales,
    totalNoVatDiscount,
    totalNetOfVat,
    totalWHT,
    totalAmountDue,
  }
}

const fmt = (n) =>
  n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
      </div>

      {!isCollapsed && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

function SDivider() {
  return <div className="h-[1px] w-full bg-gray-400" />
}

/**
 * SummaryRow — shows label + computed value.
 * Hovering reveals the formula as a tooltip.
 */
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

function SidebarInput({
  label,
  placeholder,
  type = 'text',
  required,
  dark,
  value,
  onChange,
  disabled = false,
}) {
  return (
    <div className="space-y-1">
      <label
        className={`text-[11px] font-black uppercase ${dark ? 'text-gray-500' : 'text-gray-400'} block`}
      >
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${
          disabled
            ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed'
            : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'
        }`}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function PurchaseForm({
  onBack,
  onSuccess,
  isViewMode = false,
  isEditMode = false,
  purchaseData = null,
}) {
  const [purchaseItems, setPurchaseItems] = useState([])

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

  const [isPurchaseItemsCollapsed, setIsPurchaseItemsCollapsed] = useState(false)
  const [isJournalEntriesCollapsed, setIsJournalEntriesCollapsed] = useState(false)
  const [isBasicDetailsCollapsed, setIsBasicDetailsCollapsed] = useState(false)

  const [journalEntries, setJournalEntries] = useState([
    { id: 1, account: '', accountSearch: '', center: '', debit: 0, credit: 0 },
  ])

  const [vendors, setVendors] = useState([])
  const [vendorLoading, setVendorLoading] = useState(false)
  const [vendorError, setVendorError] = useState('')
  const [selectedVendor, setSelectedVendor] = useState('')
  const [vendorSearch, setVendorSearch] = useState('')

  const [customers, setCustomers] = useState([])
  const [customerLoading, setCustomerLoading] = useState(false)
  const [customerError, setCustomerError] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')

  const [chartsOfAccounts, setChartsOfAccounts] = useState([])
  const [coaLoading, setCoaLoading] = useState(false)
  const [coaError, setCoaError] = useState('')
  const [coaSearch, setCoaSearch] = useState('')

  const [products, setProducts] = useState([])
  const [productLoading, setProductLoading] = useState(false)
  const [productError, setProductError] = useState('')

  const [vatOptions, setVatOptions] = useState([])
  const [vatLoading, setVatLoading] = useState(false)
  const [vatError, setVatError] = useState('')

  const [whtOptions, setWhtOptions] = useState([])
  const [whtLoading, setWhtLoading] = useState(false)
  const [whtError, setWhtError] = useState('')

  const [modeOfPayment, setModeOfPayment] = useState('')
  const [modeSearch, setModeSearch] = useState('')
  const [bankName, setBankName] = useState('')
  const [checkNumber, setCheckNumber] = useState('')
  const [category, setCategory] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [documentReference, setDocumentReference] = useState('')
  const [terms, setTerms] = useState('')
  const [termsOption, setTermsOption] = useState('DAYS')
  const [termsNumber, setTermsNumber] = useState('')
  const [dateDelivered, setDateDelivered] = useState('')
  const [dateDue, setDateDue] = useState('')
  const [remarks, setRemarks] = useState('')

  const [attachments, setAttachments] = useState([])

  const [toast, setToast] = useState(null)
  const [imageModal, setImageModal] = useState({ isOpen: false, imageSrc: '' })

  // ── Vendor modal ───────────────────────────────────────────────────────
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

  const coaOptions = chartsOfAccounts.map((a) => ({
    label: a.name || a.account_name,
    sublabel: a.code || a.account_code,
    value: a.id,
  }))
  const vendorOptions = vendors.map((v) => ({
    label: v.name || v.code,
    sublabel: v.code,
    value: v.id,
  }))
  const customerOptions = customers.map((c) => ({
    label: c.name || c.customer_name,
    sublabel: c.code,
    value: c.id,
  }))
  const productOptions = products.map((p) => ({
    label: p.name || p.product_name,
    sublabel: p.type || p.product_type || p.code || p.product_code,
    value: p.id,
  }))

  const fetchVendors = async () => {
    try {
      setVendorLoading(true)
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(`${import.meta.env.VITE_SERVER_LINK}/vendors`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const result = await res.json()
      if (result.success) setVendors(result.data)
      else setVendorError(result.message || 'Failed to fetch vendors')
    } catch (err) {
      setVendorError(err.message)
    } finally {
      setVendorLoading(false)
    }
  }

  const fetchCustomers = async () => {
    try {
      setCustomerLoading(true)
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(`${import.meta.env.VITE_SERVER_LINK}/customer`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const result = await res.json()
      if (result.success) setCustomers(result.data)
      else setCustomerError(result.message || 'Failed to fetch customers')
    } catch (err) {
      setCustomerError(err.message)
    } finally {
      setCustomerLoading(false)
    }
  }

  const fetchChartsOfAccounts = async () => {
    try {
      setCoaLoading(true)
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/charts_of_accounts`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const result = await res.json()
      if (result.success) setChartsOfAccounts(result.data)
      else setCoaError(result.message || 'Failed to fetch charts of accounts')
    } catch (err) {
      setCoaError(err.message)
    } finally {
      setCoaLoading(false)
    }
  }

  const fetchProducts = async () => {
    try {
      setProductLoading(true)
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/product_service`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const result = await res.json()
      if (result.success) setProducts(result.data)
      else setProductError(result.message || 'Failed to fetch products')
    } catch (err) {
      setProductError(err.message)
    } finally {
      setProductLoading(false)
    }
  }

  const createProduct = async ({
    code,
    name,
    type,
    category,
    sales_price,
    purchase_price,
    unit,
  }) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/product_service`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            code,
            name,
            type,
            category,
            sales_price,
            purchase_price,
            unit,
          }),
        },
      )
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP error! status: ${res.status}`)
      }
      const result = await res.json()
      if (!result.success) {
        throw new Error(result.message || 'Failed to create product')
      }
      await fetchProducts()
      return { success: true, data: result.data }
    } catch (err) {
      return { success: false, message: err.message }
    }
  }

  const fetchVat = async () => {
    try {
      setVatLoading(true)
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(`${import.meta.env.VITE_SERVER_LINK}/vat`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const result = await res.json()
      if (result.success) {
        const vatData = result.data.map((vat) => ({
          label: `${vat.code} - ${vat.name}`,
          value: vat.id,
          rate: parseFloat(vat.rate),
          code: vat.code,
          name: vat.name,
        }))
        setVatOptions(vatData)
      } else {
        setVatError(result.message || 'Failed to fetch VAT data')
      }
    } catch (err) {
      setVatError(err.message)
    } finally {
      setVatLoading(false)
    }
  }

  const fetchWht = async () => {
    try {
      setWhtLoading(true)
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/withholding_tax`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const result = await res.json()
      if (result.success) {
        const whtData = result.data.map((wht) => ({
          label: `${wht.code} - ${wht.name}`,
          value: wht.id,
          rate: parseFloat(wht.rate),
          code: wht.code,
          name: wht.name,
        }))
        setWhtOptions(whtData)
      } else {
        setWhtError(result.message || 'Failed to fetch WHT data')
      }
    } catch (err) {
      setWhtError(err.message)
    } finally {
      setWhtLoading(false)
    }
  }

  // Lazy loading functions
  const loadVatOnDemand = async () => {
    if (vatOptions.length === 0 && !vatLoading) {
      await fetchVat()
    }
  }

  const loadWhtOnDemand = async () => {
    if (whtOptions.length === 0 && !whtLoading) {
      await fetchWht()
    }
  }

  const createVendor = async ({
    code,
    name,
    category,
    type,
    status,
    address,
    tin,
    details,
    contact,
  }) => {
    try {
      setVendorCreateLoading(true)
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(`${import.meta.env.VITE_SERVER_LINK}/vendors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code,
          name,
          category,
          type,
          status,
          address,
          tin,
          details,
          contact,
        }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP error! status: ${res.status}`)
      }
      const result = await res.json()
      if (!result.success) {
        throw new Error(result.message || 'Failed to create vendor')
      }
      await fetchVendors()
      return { success: true, data: result.data }
    } catch (err) {
      return { success: false, message: err.message }
    } finally {
      setVendorCreateLoading(false)
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
    const payload = {
      ...vendorForm,
      tin: vendorForm.tin?.replace(/\D/g, '').slice(0, 14),
      contact: vendorForm.contact?.slice(0, 15),
    }
    const result = await createVendor(payload)
    if (result.success) {
      // Auto-select the newly created vendor
      const newVendor = result.data
      setSelectedVendor(newVendor.id)
      setVendorSearch(newVendor.name || newVendor.vendor_name)
      setToast({
        type: 'success',
        message: `Vendor "${vendorForm.name}" created successfully!`,
      })
      closeVendorModal()
    } else {
      setToast({
        type: 'error',
        message: result.message || 'Failed to create vendor',
      })
    }
  }

  // ── Product modal ───────────────────────────────────────────────────────
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
    const currentItemId = purchaseItems[purchaseItems.length - 1]?.id
    if (currentItemId) {
      updatePurchaseItem(currentItemId, 'productId', createdProduct.id || '')
      updatePurchaseItem(
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

  const findDefaultVatOption = (vatOptionsList) =>
    vatOptionsList.find(
      (opt) =>
        opt.code === 'No VAT' ||
        opt.name === 'No VAT%' ||
        opt.label?.includes('No VAT'),
    )

  const findDefaultWhtOption = (whtOptionsList) =>
    whtOptionsList.find(
      (opt) =>
        opt.code === 'NON-WHT' ||
        opt.name === 'NON-WHT' ||
        opt.label?.includes('NON-WHT'),
    )

  useEffect(() => {
    fetchVendors()
    fetchChartsOfAccounts()
    fetchProducts()
    fetchVat()
    fetchWht()
  }, [])

  // Populate form data when purchaseData is provided
  useEffect(() => {
    if (purchaseData) {
      console.log('Populating purchase form with data:', purchaseData)

      // Handle the API response structure
      const mainData = purchaseData.data ? purchaseData.data[0] : purchaseData
      const itemsData = purchaseData.items || []
      const journalData = purchaseData.journal || []
      const attachmentsData = purchaseData.attachments || []

      // Set vendor
      if (mainData && mainData.vendor_id) {
        setSelectedVendor(mainData.vendor_id)
        setVendorSearch(mainData.vendor)
      }

      // Set basic details
      setDocumentReference(mainData?.doc_ref || '')

      // Parse terms field to separate option and number
      if (mainData?.terms) {
        const termsParts = mainData.terms.trim().split(' ')
        if (termsParts.length >= 2) {
          setTermsNumber(termsParts[0])
          setTermsOption(termsParts.slice(1).join(' '))
        } else {
          setTermsNumber('')
          setTermsOption(mainData.terms)
        }
      } else {
        setTermsNumber('')
        setTermsOption('DAYS')
      }

      setDateDelivered(mainData?.date_delivered || '')
      setDateDue(mainData?.date_due || '')
      setRemarks(mainData?.remarks || '')

      // Populate purchase items
      if (itemsData && itemsData.length > 0) {
        console.log('Processing purchase items:', itemsData)
        const items = itemsData.map((item) => ({
          id: item.id,
          productId: item.product_service_id,
          productSearch: item.product_service_name,
          coa: item.charts_of_accounts_id,
          coaSearch: item.charts_of_accounts_name,
          description: item.description,
          qty: item.quantity ?? item.qty,
          price: item.purchase_price ?? item.price,
          discount: item.discount,
          discountType: item.discount_type || 'PERCENT',
          vat: item.vat_id ?? item.vat ?? item.vat_id ?? 0,
          vatSearch:
            item.vat_code || item.vat_name
              ? `${item.vat_code || ''}${item.vat_code && item.vat_name ? ' - ' : ''}${item.vat_name || ''}`
              : item.vat_id === 0 || item.vat === 0
                ? 'No VAT - No VAT%'
                : '',
          vatRate: parseFloat(item.vat_rate ?? item.vatRate) || 0,
          wht:
            item.withholding_tax_id ??
            item.witholding_tax_id ??
            item.withholding_tax ??
            item.witholding_tax ??
            item.wht ??
            0,
          whtSearch: item.withholding_tax_code
            ? `${item.withholding_tax_code}${item.withholding_tax_name ? ' - ' + item.withholding_tax_name : ''}`
            : item.withholding_tax_name ||
                item.witholding_tax_id === 0 ||
                item.withholding_tax_id === 0 ||
                item.witholding_tax === 0 ||
                item.wht === 0
              ? 'NON-WHT - NON-WHT'
              : '',
          whtRate:
            parseFloat(
              item.withholding_tax_rate ?? item.witholding_tax_rate ?? item.whtRate,
            ) || 0,
          responsibilityCenter:
            (item.responsibility_center ?? item.responsibilityCenter) || '',
          isOther: false,
          isNew: false,
        }))
        console.log('Final purchase items array:', items)
        setPurchaseItems(items)
      }

      // Populate journal entries
      if (journalData && journalData.length > 0) {
        console.log('Processing journal entries:', journalData)
        const entries = journalData.map((entry) => ({
          id: entry.id,
          account: entry.charts_of_accounts_id || entry.charts_of_accounts_name,
          accountSearch: entry.charts_of_accounts_name,
          center: entry.responsibility_center || '',
          debit: entry.type === 'DEBIT' ? parseFloat(entry.amount) || 0 : 0,
          credit: entry.type === 'CREDIT' ? parseFloat(entry.amount) || 0 : 0,
          isManual: false,
        }))
        console.log('Final journal entries array:', entries)
        setJournalEntries(entries)
      }

      // Populate attachments
      if (attachmentsData && attachmentsData.length > 0) {
        console.log('Processing attachments:', attachmentsData)
        const attachments = attachmentsData.map((att) => {
          console.log(
            'Processing attachment:',
            att.id,
            att.name,
            'File data type:',
            typeof att.file,
            'File data length:',
            att.file ? att.file.length : 'null',
          )

          // Check if base64 data is properly formatted
          let fileData = att.file || null
          if (fileData && typeof fileData === 'string') {
            console.log('Base64 data starts with:', fileData.substring(0, 50))

            // Check if base64 data is complete
            if (fileData.includes('...')) {
              console.warn('Base64 data appears to be truncated:', att.name)
            }
          }

          return {
            id: att.id,
            fileName: att.name || '',
            file: fileData, // Preserve base64 data from server for view mode
            remarks: att.remarks || '',
            uploadedBy: att.uploaded_by || 'Current User',
            date: att.uploaded_date || new Date().toLocaleDateString(),
          }
        })
        console.log('Final attachments array:', attachments)
        setAttachments(attachments)
      }
      // Note: Don't create empty attachment row - let user add manually
    }
  }, [isViewMode, isEditMode, purchaseData])

  useEffect(() => {
    // Intentionally not auto-applying default VAT/WHT here. Defaults are
    // applied only when the user submits the transaction if the fields are blank.
  }, [purchaseItems, vatOptions, whtOptions])

  useEffect(() => {
    if (
      purchaseItems.length === 0 ||
      products.length === 0 ||
      chartsOfAccounts.length === 0
    )
      return

    const inventoryCoa = chartsOfAccounts.find((coa) => {
      const label = (coa.name || coa.account_name || '').toLowerCase()
      return label.includes('inventory')
    })

    let didUpdate = false
    const updatedItems = purchaseItems.map((item) => {
      let nextItem = item

      const normalizedProductSearch = item.productSearch
        ? String(item.productSearch).trim().toLowerCase()
        : ''

      if (!item.productId && normalizedProductSearch) {
        const matchedProduct = products.find((p) => {
          const productLabel = String(p.name || p.product_name || '')
            .trim()
            .toLowerCase()
          return (
            productLabel === normalizedProductSearch ||
            String(p.id) === normalizedProductSearch
          )
        })

        if (matchedProduct) {
          nextItem = {
            ...nextItem,
            productId: matchedProduct.id,
            productSearch: matchedProduct.name || matchedProduct.product_name || '',
            description:
              nextItem.description ||
              matchedProduct.name ||
              matchedProduct.product_name ||
              '',
          }
          didUpdate = true
        }
      }

      if (item.productId && !item.productSearch) {
        const matchedProduct = products.find((p) => p.id === item.productId)
        if (matchedProduct) {
          nextItem = {
            ...nextItem,
            productSearch: matchedProduct.name || matchedProduct.product_name || '',
            description:
              nextItem.description ||
              matchedProduct.name ||
              matchedProduct.product_name ||
              '',
          }
          didUpdate = true
        }
      }

      // Only auto-assign inventory when loading existing data, not for new items
      if (!item.isNew && (!item.coa || item.coa === '') && inventoryCoa) {
        nextItem = {
          ...nextItem,
          coa: inventoryCoa.id,
          coaSearch: inventoryCoa.name || inventoryCoa.account_name || '',
        }
        didUpdate = true
      }

      return nextItem
    })

    if (didUpdate) {
      setPurchaseItems(updatedItems)
    }
  }, [purchaseItems, products, chartsOfAccounts])

  const addPurchaseItem = (isOther = false, defaultResponsibilityCenter = '') => {
    if (vatOptions.length === 0 && !vatLoading) {
      loadVatOnDemand()
    }
    if (whtOptions.length === 0 && !whtLoading) {
      loadWhtOnDemand()
    }

    // Leave VAT/WHT blank for new rows; defaults applied only on submit
    setPurchaseItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        productId: '',
        productSearch: '',
        coa: '',
        coaSearch: '',
        description: '',
        qty: 1,
        price: '',
        discount: 0,
        discountType: 'PERCENT',
        vatType: 'VAT-EX',
        vat: '',
        vatSearch: '',
        vatRate: 0,
        wht: '',
        whtSearch: '',
        whtRate: 0,
        responsibilityCenter: defaultResponsibilityCenter || '',
        isOther,
        isNew: true,
      },
    ])
  }
  const addJournalEntry = (defaultResponsibilityCenter = '') =>
    setJournalEntries((prev) => [
      ...prev,
      {
        id: Date.now(),
        account: '',
        accountSearch: '',
        center: defaultResponsibilityCenter || '',
        debit: 0,
        credit: 0,
        isManual: true,
      },
    ])
  const removePurchaseItem = (id) =>
    setPurchaseItems((prev) => prev.filter((i) => i.id !== id))
  const removeJournalEntry = (id) =>
    setJournalEntries((prev) => prev.filter((e) => e.id !== id))
  const updatePurchaseItem = (id, field, value) =>
    setPurchaseItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    )
  const updateJournalEntry = (id, field, value) =>
    setJournalEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    )
  const addAttachment = () =>
    setAttachments((prev) => [
      ...prev,
      {
        id: Date.now(),
        fileName: '',
        file: null,
        remarks: '',
        uploadedBy: 'Current User',
        date: new Date().toLocaleDateString(),
        isNew: true,
      },
    ])
  const removeAttachment = (id) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  const updateAttachment = (id, field, value) =>
    setAttachments((prev) =>
      prev.map((att) => (att.id === id ? { ...att, [field]: value } : att)),
    )
  const handleFileChange = (id, file) => {
    if (file) {
      updateAttachment(id, 'fileName', file.name)
      updateAttachment(id, 'file', file)
    }
  }

  const summary = computeSummary(purchaseItems)

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result)
      reader.onerror = (error) => reject(error)
    })
  }

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

  const generateJournalEntries = (defaultResponsibilityCenter = '') => {
    const entries = []
    let totalDebitAmount = 0
    let totalCreditAmount = 0
    let totalGrossAmount = 0
    let totalDiscountedAmount = 0
    let totalVatAmount = 0
    let totalWhtAmount = 0
    let totalDiscountAmount = 0

    // First pass: calculate totals
    purchaseItems.forEach((item) => {
      const qty = parseFloat(item.qty) || 0
      const price = parseFloat(item.price) || 0
      const discountPct = parseFloat(item.discount) || 0
      const vatPct = parseFloat(item.vatRate) || 0
      const whtPct = parseFloat(item.whtRate) || 0
      const vatType = item.vatType || 'VAT-EX'

      const gross = qty * price
      const discountAmount = gross * (discountPct / 100)
      const discountedAmount = gross - discountAmount
      
      let vatAmount, netBase, whtAmount
      if (vatType === 'VAT-INC' && vatPct > 0) {
        // VAT Inclusive: extract VAT from the discounted amount
        netBase = discountedAmount / (1 + vatPct / 100)
        vatAmount = discountedAmount - netBase
      } else {
        // VAT Exclusive: VAT is calculated on top of the discounted amount
        vatAmount = discountedAmount * (vatPct / 100)
        netBase = discountedAmount
      }
      
      whtAmount = netBase * (whtPct / 100)

      totalGrossAmount += gross
      totalDiscountAmount += discountAmount
      totalDiscountedAmount += discountedAmount
      totalVatAmount += vatAmount
      totalWhtAmount += whtAmount
    })

    // Find accounts payable account
    const apAccount = chartsOfAccounts.find((a) =>
      (a.name || '').toLowerCase().includes('accounts payable'),
    )

    // 1. Expense Accounts (DEBIT) - the purchase items themselves
    purchaseItems.forEach((item) => {
      if (item.coa) {
        const selectedCoa = chartsOfAccounts.find((a) => a.id === item.coa)
        const qty = parseFloat(item.qty) || 0
        const price = parseFloat(item.price) || 0
        const discountPct = parseFloat(item.discount) || 0
        const vatPct = parseFloat(item.vatRate) || 0
        const vatType = item.vatType || 'VAT-EX'
        
        const gross = qty * price
        const discountAmount = gross * (discountPct / 100)
        const discountedAmount = gross - discountAmount
        
        let netBase
        if (vatType === 'VAT-INC' && vatPct > 0) {
          netBase = discountedAmount / (1 + vatPct / 100)
        } else {
          netBase = discountedAmount
        }

        if (selectedCoa && gross > 0) {
          entries.push({
            id: Date.now() + Math.random(),
            account: selectedCoa.id,
            accountSearch: selectedCoa.name,
            center: getItemResponsibilityCenter(
              item,
              defaultResponsibilityCenter ||
                bulkResponsibilityCenter ||
                purchaseItems[0]?.responsibilityCenter ||
                '',
            ),
            debit: parseFloat(netBase.toFixed(2)),
            credit: 0,
            isManual: false,
          })
          totalDebitAmount += netBase
        }
      }
    })

    // 2. Input VAT (DEBIT) - for VATable purchases
    if (totalVatAmount > 0) {
      const inputVatAccount = chartsOfAccounts.find((a) =>
        (a.name || '').toLowerCase().includes('input vat'),
      )

      if (inputVatAccount) {
        entries.push({
          id: Date.now() + Math.random(),
          account: inputVatAccount.id,
          accountSearch: inputVatAccount.name,
          center: getItemResponsibilityCenter(
            purchaseItems[0],
            defaultResponsibilityCenter ||
              bulkResponsibilityCenter ||
              purchaseItems[0]?.responsibilityCenter ||
              '',
          ),
          debit: parseFloat(totalVatAmount.toFixed(2)),
          credit: 0,
          isManual: false,
        })
        totalDebitAmount += totalVatAmount
      }
    }

    // 3. Purchase Discounts (CREDIT)
    if (totalDiscountAmount > 0) {
      const discountAccount = chartsOfAccounts.find((a) =>
        (a.name || '').toLowerCase().includes('purchase discounts'),
      )

      if (discountAccount) {
        entries.push({
          id: Date.now() + Math.random(),
          account: discountAccount.id,
          accountSearch: discountAccount.name,
          center: getItemResponsibilityCenter(
            purchaseItems[0],
            defaultResponsibilityCenter ||
              bulkResponsibilityCenter ||
              purchaseItems[0]?.responsibilityCenter ||
              '',
          ),
          debit: 0,
          credit: parseFloat(totalDiscountAmount.toFixed(2)),
          isManual: false,
        })
        totalCreditAmount += totalDiscountAmount
      }
    }

    // 4. Withholding Tax (CREDIT) - Liability account
    // Determine if this is payroll-related or supplier-related based on COA
    if (totalWhtAmount > 0) {
      // Payroll-related COA keywords - use Withholding Tax - Compensation
      const payrollKeywords = [
        'salary', 'wage', 'commission', 'bonus', 'compensation',
        'sss', 'philhealth', 'pag-ibig', 'pagibig', 'payroll'
      ]
      
      // Check if any item has a payroll-related COA
      const hasPayrollItem = purchaseItems.some((item) => {
        const selectedCoa = chartsOfAccounts.find((a) => a.id === item.coa)
        const coaName = (selectedCoa?.name || '').toLowerCase()
        return payrollKeywords.some(keyword => coaName.includes(keyword))
      })
      
      // Select appropriate WHT liability account
      const whtAccount = chartsOfAccounts.find((a) => {
        const name = (a.name || '').toLowerCase()
        if (hasPayrollItem) {
          return name.includes('withholding tax - compensation')
        } else {
          return name.includes('withholding tax - expanded')
        }
      })

      if (whtAccount) {
        entries.push({
          id: Date.now() + Math.random(),
          account: whtAccount.id,
          accountSearch: whtAccount.name,
          center: getItemResponsibilityCenter(
            purchaseItems[0],
            defaultResponsibilityCenter ||
              bulkResponsibilityCenter ||
              purchaseItems[0]?.responsibilityCenter ||
              '',
          ),
          debit: 0,
          credit: parseFloat(totalWhtAmount.toFixed(2)),
          isManual: false,
        })
        totalCreditAmount += totalWhtAmount
      }
    }

    // 5. Accounts Payable (CREDIT) - what we owe
    if (apAccount && totalDiscountedAmount > 0) {
      // Calculate total amount owed based on VAT type
      let totalAmountOwed = 0
      purchaseItems.forEach((item) => {
        const qty = parseFloat(item.qty) || 0
        const price = parseFloat(item.price) || 0
        const discountPct = parseFloat(item.discount) || 0
        const vatPct = parseFloat(item.vatRate) || 0
        const whtPct = parseFloat(item.whtRate) || 0
        const vatType = item.vatType || 'VAT-EX'
        
        const gross = qty * price
        const discountAmount = gross * (discountPct / 100)
        const discountedAmount = gross - discountAmount
        
        let netBase, vatAmount, whtAmount
        if (vatType === 'VAT-INC' && vatPct > 0) {
          netBase = discountedAmount / (1 + vatPct / 100)
          vatAmount = discountedAmount - netBase
        } else {
          netBase = discountedAmount
          vatAmount = discountedAmount * (vatPct / 100)
        }
        
        whtAmount = netBase * (whtPct / 100)
        
        // For VAT-INC, amount owed is discounted (VAT already included)
        // For VAT-EX, amount owed is netBase + VAT
        const amountOwed = vatType === 'VAT-INC' ? discountedAmount : (netBase + vatAmount)
        totalAmountOwed += (amountOwed - whtAmount)
      })
      
      entries.push({
        id: Date.now() + Math.random(),
        account: apAccount.id,
        accountSearch: apAccount.name,
        center: getItemResponsibilityCenter(
          purchaseItems[0],
          defaultResponsibilityCenter ||
            bulkResponsibilityCenter ||
            purchaseItems[0]?.responsibilityCenter ||
            '',
        ),
        debit: 0,
        credit: parseFloat(totalAmountOwed.toFixed(2)),
        isManual: false,
      })
      totalCreditAmount += totalAmountOwed
    }

    setJournalEntries(entries)
  }

  const handlePostTransaction = async () => {
    try {
      const userData = JSON.parse(localStorage.getItem('user') || '{}')
      const createdBy = userData.mu_username || userData.username || 'Unknown User'

      if (!selectedVendor) {
        setToast({ type: 'warning', message: 'Please select a vendor' })
        return
      }

      if (!termsOption || !termsNumber) {
        setToast({
          type: 'warning',
          message: 'Please enter terms option and number',
        })
        return
      }

      if (!dateDelivered) {
        setToast({ type: 'warning', message: 'Please enter date delivered' })
        return
      }

      if (!dateDue) {
        setToast({ type: 'warning', message: 'Please enter date due' })
        return
      }

      if (
        purchaseItems.length === 0 ||
        (purchaseItems.length === 1 && purchaseItems[0].isOther)
      ) {
        setToast({
          type: 'warning',
          message: 'Please add at least one purchase item',
        })
        return
      }

      // Validate VAT-INC items have VAT selected
      const hasVatIncWithoutVat = purchaseItems.some(
        (item) => item.vatType === 'VAT-INC' && (!item.vat || item.vat === '' || item.vat === 0)
      )
      if (hasVatIncWithoutVat) {
        setToast({
          type: 'warning',
          message: 'Items with VAT Inclusive pricing must have a VAT rate selected',
        })
        return
      }

      const token = localStorage.getItem('token')
      if (!token) {
        setToast({
          type: 'error',
          message: 'No authorization token found. Please login again.',
        })
        return
      }

      // Check if journal entries are balanced
      const totalDebit = journalEntries.reduce(
        (sum, entry) => sum + (parseFloat(entry.debit) || 0),
        0,
      )
      const totalCredit = journalEntries.reduce(
        (sum, entry) => sum + (parseFloat(entry.credit) || 0),
        0,
      )

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        // Allow for small floating point differences
        setToast({
          type: 'warning',
          message:
            'Journal entries must be balanced. Total debits must equal total credits.',
        })
        return
      }

      // Apply defaults for VAT/WHT only at submit time if item value is blank
      const defaultVatOpt = findDefaultVatOption(vatOptions)
      const defaultWhtOpt = findDefaultWhtOption(whtOptions)

      const preparedPurchaseItems = purchaseItems
        .filter((item) => !item.isOther)
        .map((item) => ({
          id: item.isNew ? undefined : item.id,
          product_service: item.productId || null,
          charts_of_accounts: item.coa || item.accountId,
          description: item.description,
          quantity: parseFloat(item.qty) || 0,
          purchase_price: parseFloat(item.price) || 0,
          discount: parseFloat(item.discount) || 0,
          discount_type: item.discountType || 'PERCENT',
          vat:
            parseFloat(
              item.vat !== undefined && item.vat !== '' && item.vat !== null
                ? item.vat
                : item.vat_id !== undefined &&
                    item.vat_id !== '' &&
                    item.vat_id !== null
                  ? item.vat_id
                  : defaultVatOpt?.value || 0,
            ) || 0,
          witholding_tax:
            parseFloat(
              item.wht !== undefined && item.wht !== '' && item.wht !== null
                ? item.wht
                : item.witholding_tax !== undefined &&
                    item.witholding_tax !== '' &&
                    item.witholding_tax !== null
                  ? item.witholding_tax
                  : item.withholding_tax !== undefined &&
                      item.withholding_tax !== '' &&
                      item.withholding_tax !== null
                    ? item.withholding_tax
                    : item.witholding_tax_id !== undefined &&
                        item.witholding_tax_id !== '' &&
                        item.witholding_tax_id !== null
                      ? item.witholding_tax_id
                      : item.withholding_tax_id !== undefined &&
                          item.withholding_tax_id !== '' &&
                          item.withholding_tax_id !== null
                        ? item.withholding_tax_id
                        : defaultWhtOpt?.value || 0,
            ) || 0,
          responsibility_center: item.responsibilityCenter || '',
        }))

      const preparedJournalEntries = journalEntries
        .filter((entry) => !entry.isOther)
        .map((entry) => ({
          charts_of_accounts: entry.account || entry.accountId,
          responsibility_center: entry.center || '',
          debit: parseFloat(entry.debit) || 0,
          credit: parseFloat(entry.credit) || 0,
        }))

      const preparedAttachments = await Promise.all(
        attachments.map(async (att) => {
          // Only include ID if it's an existing record (not a new row)
          let fileData = null

          if (att.file) {
            // If file is already a base64 string (from API), use it directly
            if (typeof att.file === 'string' && att.file.startsWith('data:')) {
              fileData = att.file
            }
            // If file is a File object (newly uploaded), convert to base64
            else if (att.file instanceof File || att.file instanceof Blob) {
              fileData = await fileToBase64(att.file)
            }
          }

          return {
            id: att.id && !att.isNew ? att.id : null,
            name: att.fileName,
            file: fileData,
            remarks: att.remarks,
            uploaded_by: att.uploadedBy,
            uploaded_date: att.date,
          }
        }),
      )

      const purchaseDataPayload = {
        vendor_id: selectedVendor,
        document_reference: documentReference,
        terms: `${termsNumber} ${termsOption}`,
        date_delivered: dateDelivered,
        date_due: dateDue,
        remarks: remarks,
        total_amount_due: summary.totalAmountDue,
        purchase_items: preparedPurchaseItems,
        journal_entries: preparedJournalEntries,
        attachments: preparedAttachments,
      }

      // Add ID and updated_by for edit mode
      if (isEditMode && purchaseData) {
        const purchaseId = purchaseData.data?.[0]?.id || purchaseData.id
        if (purchaseId) {
          purchaseDataPayload.id = purchaseId
          purchaseDataPayload.updated_by = createdBy
        }
      } else {
        purchaseDataPayload.created_by = createdBy
      }

      const url =
        isEditMode && purchaseData?.data?.[0]?.id
          ? `${import.meta.env.VITE_SERVER_LINK}/purchase/${purchaseData.data[0].id}`
          : `${import.meta.env.VITE_SERVER_LINK}/purchase`

      const method = isEditMode && purchaseData?.data?.[0]?.id ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(purchaseDataPayload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage =
          errorData.message || `HTTP error! status: ${response.status}`
        throw new Error(errorMessage)
      }

      const result = await response.json()

      if (result.success) {
        const action = isEditMode ? 'updated' : 'created'
        const nextToast = {
          type: 'success',
          message: `Purchase ${action} successfully!`,
        }
        setToast(nextToast)
        if (onSuccess) await onSuccess(nextToast)
        onBack()
      } else {
        const action = isEditMode ? 'update' : 'create'
        setToast({
          type: 'error',
          message: result.message || `Failed to ${action} purchase`,
        })
      }
    } catch (error) {
      console.error('Error posting purchase:', error)
      setToast({ type: 'error', message: 'Error: ' + error.message })
    }
  }

  useEffect(() => {
    // Only auto-generate journal entries in add/edit mode, not in view mode
    if (!isViewMode) {
      generateJournalEntries(bulkResponsibilityCenter)
    }
  }, [
    purchaseItems,
    modeOfPayment,
    bankName,
    chartsOfAccounts,
    isViewMode,
    isEditMode,
  ])

  // Auto-calculate date due based on terms and date delivered
  useEffect(() => {
    if (!isViewMode && dateDelivered && termsOption && termsNumber) {
      const deliveredDate = new Date(dateDelivered)
      const termsNum = parseInt(termsNumber) || 0

      if (!isNaN(deliveredDate.getTime()) && termsNum > 0) {
        let dueDate = new Date(deliveredDate)

        switch (termsOption) {
          case 'DAYS':
            dueDate.setDate(dueDate.getDate() + termsNum)
            break
          case 'MONTHS':
            dueDate.setMonth(dueDate.getMonth() + termsNum)
            break
          case 'DURATION OF TIME':
            // Default to days for duration of time
            dueDate.setDate(dueDate.getDate() + termsNum)
            break
          default:
            dueDate.setDate(dueDate.getDate() + termsNum)
        }

        // Format as YYYY-MM-DD for input field
        const formattedDate = dueDate.toISOString().split('T')[0]
        setDateDue(formattedDate)
      }
    }
  }, [dateDelivered, termsOption, termsNumber, isViewMode])

  // Apply drag-to-scroll to purchase items table
  const purchaseItemsScrollRef = useDragToScroll()

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

      {/* Add Vendor Modal */}
      <RightSideModal
        isOpen={isVendorModalOpen}
        onClose={closeVendorModal}
        title="Create New Vendor"
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
              className="flex-1 px-4 py-3 bg-black text-white text-xs font-black rounded-xl hover:bg-red-600 transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus size={14} />
              {vendorCreateLoading ? 'Creating...' : 'Create Vendor'}
            </button>
          </div>
        </form>
      </RightSideModal>

      {/* Add Product Modal */}
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

      {/* TOP NAV */}
      <div className="flex items-center justify-between flex-shrink-0 mb-2">
        <nav
          className="cursor-pointer px-4 py-2 bg-gray-600 text-white text-[12px] font-black rounded-lg hover:bg-gray-700 transition-all uppercase tracking-[2px] flex items-center gap-2 shadow-md shadow-gray-200"
          onClick={onBack}
        >
          <ArrowLeft size={17} />
          <span className="text-white">Go Back</span>
        </nav>
        {!isViewMode && (
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white border border-gray-200 text-[12px] font-black text-gray-400 rounded-lg hover:bg-gray-50 transition-all uppercase">
              Save Draft
            </button>
            <button
              onClick={handlePostTransaction}
              className="px-6 py-2 bg-green-600 text-white text-[12px] font-black rounded-lg hover:bg-green-700 transition-all uppercase tracking-[2px] flex items-center gap-2 shadow-md shadow-green-200"
            >
              <Save size={14} /> {isEditMode ? 'Update Receipt' : 'Post Transaction'}
            </button>
          </div>
        )}
      </div>

      {/* BODY */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
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
                  value={fmt(summary.totalSalesPrice)}
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
                    value={fmt(summary.vatableSales)}
                    isNested
                  />
                  <SummaryRow
                    label="VAT-Exempt Purchases:"
                    value={fmt(summary.vatExemptSales)}
                    isNested
                  />
                  <SummaryRow
                    label="Zero Rated Purchases:"
                    value={fmt(summary.zeroRatedSales)}
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
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-5">
                      {/* Vendor Selection */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Vendor <span className="text-red-500">*</span>
                        </label>
                        {vendorLoading ? (
                          <div className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800">
                            Loading vendors...
                          </div>
                        ) : (
                          <SearchableDropdown
                            disabled={isViewMode}
                            placeholder="Search vendor..."
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

                      {/* Document Reference */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Document Reference
                        </label>
                        <input
                          type="text"
                          placeholder="INV-000"
                          value={documentReference}
                          onChange={(e) => setDocumentReference(e.target.value)}
                          disabled={isViewMode}
                          className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''} ${!documentReference ? 'border-red-500' : 'border-zinc-300'}`}
                        />
                      </div>

                      {/* Terms */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Terms
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            disabled={isViewMode}
                            value={termsOption}
                            onChange={(e) => setTermsOption(e.target.value)}
                            className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
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
                            value={termsNumber}
                            onChange={(e) => setTermsNumber(e.target.value)}
                            className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                          />
                        </div>
                      </div>

                      {/* Date Delivered */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Date Delivered
                        </label>
                        <input
                          type="date"
                          value={dateDelivered}
                          onChange={(e) => setDateDelivered(e.target.value)}
                          disabled={isViewMode}
                          className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                        />
                      </div>

                      {/* Date Due */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Date Due
                        </label>
                        <input
                          type="date"
                          value={dateDue}
                          onChange={(e) => setDateDue(e.target.value)}
                          disabled={isViewMode}
                          className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </section>
              {/* 1. PURCHASE ITEMS */}
              <section className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-zinc-900 text-white flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-semibold text-sm">
                      <Wallet size={14} />
                    </div>
                    <div>
                      <h2 className="text-base font-bold tracking-tight">Purchase Items</h2>
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
                            purchaseItems.forEach((item) =>
                              updatePurchaseItem(
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
                      onClick={() => setIsPurchaseItemsCollapsed(!isPurchaseItemsCollapsed)}
                      className="text-white bg-red-600 hover:bg-red-700 p-2 rounded-lg transition-colors"
                      title={isPurchaseItemsCollapsed ? 'Expand' : 'Collapse'}
                    >
                      {isPurchaseItemsCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>
                  </div>
                </div>

                {!isPurchaseItemsCollapsed && (
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
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '10%' }} />
                        </colgroup>
                        <thead className="bg-zinc-100 border-b border-zinc-200 uppercase font-bold text-zinc-700 tracking-wider">
                          <tr>
                            <th className="py-3 px-3 min-w-[180px] text-center">Product/Service</th>
                            <th className="py-3 px-2 min-w-[120px] text-center">Charts of Accounts</th>
                            <th className="py-3 px-2 min-w-[150px] text-center">Description</th>
                            <th className="py-3 px-2 w-16 text-center">Qty</th>
                            <th className="py-3 px-2 w-28 text-center">Price</th>
                            <th className="py-3 px-2 w-24 text-center">Disc %</th>
                            <th className="py-3 px-2 w-20 text-center">Disc Type</th>
                            <th className="py-3 px-2 w-20 text-center">VAT %</th>
                            <th className="py-3 px-2 w-20 text-center">WHT %</th>
                            <th className="py-3 px-2 min-w-[120px] text-center">Resp. Center</th>
                            <th className="py-3 px-2 w-10 text-center"></th>
                          </tr>
                        </thead>
                    <tbody className="divide-y divide-gray-50">
                      {purchaseItems.map((item) => (
                        <tr
                          key={item.id}
                          className={item.isOther ? 'bg-gray-50/30' : ''}
                        >
                          <td className="py-1 px-1">
                            <SearchableDropdown
                              disabled={isViewMode || item.isOther}
                              placeholder="Search product..."
                              value={item.productSearch}
                              onChange={(v) => {
                                updatePurchaseItem(item.id, 'productSearch', v)
                                // Clear productId when user manually changes search text
                                if (v === '') {
                                  updatePurchaseItem(item.id, 'productId', '')
                                }
                              }}
                              onSelect={(opt) => {
                                updatePurchaseItem(item.id, 'productId', opt.value)
                                updatePurchaseItem(
                                  item.id,
                                  'productSearch',
                                  opt.label,
                                )
                              }}
                              options={productOptions}
                              inputClassName={`${tableInput} ${isViewMode || item.isOther ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              emptyText={productError || 'No products found'}
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
                                    <Plus size={12} />
                                    Add Product
                                  </button>
                                ) : null
                              }
                            />
                          </td>
                          <td className="py-1 px-1">
                            <SearchableDropdown
                              disabled={isViewMode}
                              placeholder="Search account..."
                              value={item.coaSearch}
                              onChange={(v) =>
                                updatePurchaseItem(item.id, 'coaSearch', v)
                              }
                              onSelect={(opt) => {
                                updatePurchaseItem(item.id, 'coa', opt.value)
                                updatePurchaseItem(item.id, 'coaSearch', opt.label)
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
                                updatePurchaseItem(
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
                                updatePurchaseItem(
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
                                  updatePurchaseItem(item.id, 'price', parsed)
                                }}
                              />
                              <select
                                disabled={isViewMode}
                                value={item.vatType || 'VAT-EX'}
                                onChange={(e) => updatePurchaseItem(item.id, 'vatType', e.target.value)}
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
                                  updatePurchaseItem(
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
                          {/* DISCOUNT TYPE */}
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
                                  updatePurchaseItem(
                                    item.id,
                                    'discountType',
                                    e.target.value,
                                  )
                                }
                                className={`w-full px-2 py-1 text-[11px] font-bold border border-gray-200 rounded focus:ring-1 focus:ring-red-400 outline-none`}
                              >
                                <option value="PERCENT">PERCENT</option>
                                <option value="FIXED">FIXED</option>
                              </select>
                            )}
                          </td>
                          {/* VAT % */}
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
                                  updatePurchaseItem(item.id, 'vatSearch', v)
                                }
                                onFocus={loadVatOnDemand}
                                onSelect={(opt) => {
                                  updatePurchaseItem(item.id, 'vat', opt.value)
                                  updatePurchaseItem(item.id, 'vatSearch', opt.label)
                                  updatePurchaseItem(item.id, 'vatRate', opt.rate)
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
                                  updatePurchaseItem(item.id, 'whtSearch', v)
                                }
                                onFocus={loadWhtOnDemand}
                                onSelect={(opt) => {
                                  updatePurchaseItem(item.id, 'wht', opt.value)
                                  updatePurchaseItem(item.id, 'whtSearch', opt.label)
                                  updatePurchaseItem(item.id, 'whtRate', opt.rate)
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
                                updatePurchaseItem(
                                  item.id,
                                  'responsibilityCenter',
                                  v,
                                )
                              }
                              onSelect={(opt) =>
                                updatePurchaseItem(
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
                                onClick={() => removePurchaseItem(item.id)}
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
                    <button
                      onClick={() => addPurchaseItem(false, bulkResponsibilityCenter)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-500 border-dashed text-xs font-bold rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                    >
                      <Plus size={12} /> Add Product / Service
                    </button>
                    <span className="text-xs text-zinc-500 font-medium">{purchaseItems.length} {purchaseItems.length === 1 ? 'item' : 'items'}</span>
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
                          const totalDebit = journalEntries.reduce((s, e) => s + (parseFloat(e.debit) || 0), 0)
                          const totalCredit = journalEntries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0)
                          return Math.abs(totalDebit - totalCredit) < 0.01 ? 'Balanced' : 'Unbalanced'
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
                              disabled={isViewMode || !entry.isManual}
                              className={`${tableInput + ' font-black'} ${isViewMode || !entry.isManual ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
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
                              readOnly={isViewMode || !entry.isManual}
                            />
                          </td>
                          <td className="py-1.5 px-1">
                            <input
                              disabled={isViewMode || !entry.isManual}
                              className={`${tableInput + ' font-black text-red-600'} ${isViewMode || !entry.isManual ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
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
                              readOnly={isViewMode || !entry.isManual}
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
                            {!isViewMode && entry.isManual ? (
                              <button
                                className="p-1 text-red-600 transition-colors hover:bg-red-50 rounded"
                                onClick={() => removeJournalEntry(entry.id)}
                              >
                                <Trash2 size={15} className="mx-auto" />
                              </button>
                            ) : (
                              <span className="text-gray-300 text-[11px] italic">
                                {isViewMode ? '' : 'Auto'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-semibold text-slate-900 border-t border-slate-200">
                      {(() => {
                        const totalDebit = journalEntries.reduce((s, e) => s + (parseFloat(e.debit) || 0), 0)
                        const totalCredit = journalEntries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0)
                        return (
                          <tr>
                            <td colSpan={2} className="py-2.5 px-3 text-right text-xs">Total Ledger Balance:</td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-700 text-xs">{fmt(totalDebit)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-700 text-xs">{fmt(totalCredit)}</td>
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
      </div>

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
  )
}
