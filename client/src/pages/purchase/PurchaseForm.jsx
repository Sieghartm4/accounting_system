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

    const gross = qty * price
    let discAmt = 0

    if (discountType === 'PERCENT') {
      discAmt = gross * (discountValue / 100)
    } else {
      discAmt = discountValue * qty
    }

    const discounted = gross - discAmt
    const vatAmt = discounted * (vatPct / 100)
    const whtAmt = discounted * (whtPct / 100)

    // For VAT-exclusive pricing, VATable sales is the discounted amount (before VAT is added)
    const netBase = discounted

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
    totalAmountDue: totalDiscounted + totalVAT - totalWHT,
  }
}

const fmt = (n) =>
  n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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

/**
 * SummaryRow — shows label + computed value.
 * Hovering reveals the formula as a tooltip.
 */
function SummaryRow({ label, value, color = 'text-gray-800', formula }) {
  return (
    <div className="summary-row relative flex justify-between items-center hover:bg-gray-50 rounded-md transition-colors py-1.5 px-1 cursor-default">
      {/* Label: 10.5px -> ~12.5px */}
      <span className="text-[clamp(11px,1.1vw,12.5px)] font-black uppercase text-gray-500 leading-tight pr-1 flex-1">
        {label}
      </span>

      {/* Value: 12px -> ~14px */}
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
    sublabel: p.code || p.product_code,
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
        setTermsOption('')
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
          qty: item.quantity,
          price: item.purchase_price,
          discount: item.discount,
          discountType: item.discount_type || 'PERCENT',
          vat: item.vat_id ?? item.vat,
          vatSearch:
            item.vat_code || item.vat_name
              ? `${item.vat_code || ''}${item.vat_code && item.vat_name ? ' - ' : ''}${item.vat_name || ''}`
              : '',
          vatRate: parseFloat(item.vat_rate) || 0,
          wht:
            item.witholding_tax_id ??
            item.witholding_tax ??
            item.witholding_tax_id ??
            item.witholding_tax_id,
          whtSearch: item.withholding_tax_code
            ? `${item.withholding_tax_code}${item.withholding_tax_name ? ' - ' + item.withholding_tax_name : ''}`
            : item.withholding_tax_name || '',
          whtRate: parseFloat(item.withholding_tax_rate) || 0,
          responsibilityCenter: item.responsibility_center,
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
    if (purchaseItems.length === 0) return

    let didUpdate = false
    const updatedItems = purchaseItems.map((item) => {
      let nextItem = item

      if ((item.vat === 0 || item.vat === '') && item.vatSearch === '') {
        const matchedVat = findDefaultVatOption(vatOptions)
        if (matchedVat) {
          nextItem = {
            ...nextItem,
            vat: matchedVat.value,
            vatSearch: matchedVat.label,
            vatRate: matchedVat.rate,
          }
          didUpdate = true
        }
      }

      if ((item.wht === 0 || item.wht === '') && item.whtSearch === '') {
        const matchedWht = findDefaultWhtOption(whtOptions)
        if (matchedWht) {
          nextItem = {
            ...nextItem,
            wht: matchedWht.value,
            whtSearch: matchedWht.label,
            whtRate: matchedWht.rate,
          }
          didUpdate = true
        }
      }

      return nextItem
    })

    if (didUpdate) {
      setPurchaseItems(updatedItems)
    }
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

      if ((!item.coa || item.coa === '') && inventoryCoa) {
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

  const addPurchaseItem = (isOther = false) => {
    if (vatOptions.length === 0 && !vatLoading) {
      loadVatOnDemand()
    }
    if (whtOptions.length === 0 && !whtLoading) {
      loadWhtOnDemand()
    }

    const defaultVat = findDefaultVatOption(vatOptions)
    const defaultWht = findDefaultWhtOption(whtOptions)

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
        price: 0,
        discount: 0,
        discountType: 'PERCENT',
        vat: defaultVat?.value || 0,
        vatSearch: defaultVat?.label || '',
        vatRate: defaultVat?.rate || 0,
        wht: defaultWht?.value || 0,
        whtSearch: defaultWht?.label || '',
        whtRate: defaultWht?.rate || 0,
        responsibilityCenter: '',
        isOther,
        isNew: true,
      },
    ])
  }
  const addJournalEntry = () =>
    setJournalEntries((prev) => [
      ...prev,
      {
        id: Date.now(),
        account: '',
        accountSearch: '',
        center: '',
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

  const generateJournalEntries = () => {
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

      const gross = qty * price
      const discountAmount = gross * (discountPct / 100)
      const discountedAmount = gross - discountAmount
      const vatAmount = discountedAmount * (vatPct / 100)
      const whtAmount = discountedAmount * (whtPct / 100)

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
        const gross = qty * price

        if (selectedCoa && gross > 0) {
          entries.push({
            id: Date.now() + Math.random(),
            account: selectedCoa.id,
            accountSearch: selectedCoa.name,
            center: item.responsibilityCenter || '',
            debit: parseFloat(gross.toFixed(2)),
            credit: 0,
            isManual: false,
          })
          totalDebitAmount += gross
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
          center: purchaseItems[0]?.responsibilityCenter || '',
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
          center: purchaseItems[0]?.responsibilityCenter || '',
          debit: 0,
          credit: parseFloat(totalDiscountAmount.toFixed(2)),
          isManual: false,
        })
        totalCreditAmount += totalDiscountAmount
      }
    }

    // 4. Creditable Withholding Tax (CREDIT)
    if (totalWhtAmount > 0) {
      const whtAccount = chartsOfAccounts.find((a) => {
        const name = (a.name || '').toLowerCase()
        return (
          name.includes('creditable withholding tax') ||
          name.includes('creditable witholding tax')
        )
      })

      if (whtAccount) {
        entries.push({
          id: Date.now() + Math.random(),
          account: whtAccount.id,
          accountSearch: whtAccount.name,
          center: purchaseItems[0]?.responsibilityCenter || '',
          debit: 0,
          credit: parseFloat(totalWhtAmount.toFixed(2)),
          isManual: false,
        })
        totalCreditAmount += totalWhtAmount
      }
    }

    // 5. Accounts Payable (CREDIT) - what we owe: discounted + VAT - WHT
    if (apAccount && totalDiscountedAmount > 0) {
      const apAmount = totalDiscountedAmount + totalVatAmount - totalWhtAmount
      entries.push({
        id: Date.now() + Math.random(),
        account: apAccount.id,
        accountSearch: apAccount.name,
        center: purchaseItems[0]?.responsibilityCenter || '',
        debit: 0,
        credit: parseFloat(apAmount.toFixed(2)),
        isManual: false,
      })
      totalCreditAmount += apAmount
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
          vat: parseFloat(item.vat) || 0,
          witholding_tax: parseFloat(item.wht) || 0,
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
      generateJournalEntries()
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

      {/* TOP NAV */}
      <div className="flex items-center justify-between flex-shrink-0">
        <nav
          className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[2px] text-gray-400 cursor-pointer hover:text-black transition-colors"
          onClick={onBack}
        >
          <ArrowLeft size={17} />
          <span className="text-black">Back to Purchases</span>
        </nav>
        {!isViewMode && (
          <div className="flex gap-2">
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
        {/* BASIC DETAILS - FULL WIDTH TOP */}
        <fieldset className="bg-black rounded-2xl p-3 pl-6 pr-6 text-white shadow-xl">
          <legend className="bg-red-600 text-[13px] font-black uppercase tracking-[3px] text-white flex items-center justify-center gap-2 px-4 py-1 rounded-lg mx-auto w-fit">
            <Landmark size={18} /> Basic Details
          </legend>
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-1">
              <fieldset>
                <legend className="text-[11px] font-black uppercase text-gray-100">
                  Vendor <span className="text-red-600">*</span>
                </legend>
                {vendorLoading ? (
                  <div className={inputBase + ' text-black py-1.5'}>
                    Loading vendors…
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
                    inputClassName={inputBase}
                    emptyText={vendorError || 'No vendors found'}
                  />
                )}
              </fieldset>
            </div>
            <div className="col-span-1">
              <fieldset>
                <legend className="text-[11px] font-black uppercase text-gray-100">
                  Document Reference
                </legend>
                <input
                  type="text"
                  placeholder="INV-000"
                  value={documentReference}
                  onChange={(e) => setDocumentReference(e.target.value)}
                  disabled={isViewMode}
                  className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${
                    isViewMode
                      ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed'
                      : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'
                  }`}
                />
              </fieldset>
            </div>
            <div className="col-span-1">
              <fieldset>
                <legend className="text-[11px] font-black uppercase text-gray-100">
                  Terms
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    disabled={isViewMode}
                    value={termsOption}
                    onChange={(e) => setTermsOption(e.target.value)}
                    className={inputBase}
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
                    className={inputBase}
                  />
                </div>
              </fieldset>
            </div>
            <div className="col-span-1">
              <fieldset>
                <legend className="text-[11px] font-black uppercase text-gray-100">
                  Date Delivered
                </legend>
                <input
                  type="date"
                  value={dateDelivered}
                  onChange={(e) => setDateDelivered(e.target.value)}
                  disabled={isViewMode}
                  className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${
                    isViewMode
                      ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed'
                      : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'
                  }`}
                />
              </fieldset>
            </div>
            <div className="col-span-1">
              <fieldset>
                <legend className="text-[11px] font-black uppercase text-gray-100">
                  Date Due
                </legend>
                <input
                  type="date"
                  value={dateDue}
                  onChange={(e) => setDateDue(e.target.value)}
                  disabled={isViewMode}
                  className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${
                    isViewMode
                      ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed'
                      : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'
                  }`}
                />
              </fieldset>
            </div>
          </div>
        </fieldset>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex gap-2 min-h-0">
          {/* LEFT SIDEBAR - SUMMARY ONLY */}
          <aside className="w-full flex-shrink-0 flex flex-col gap-2 h-full overflow-y-auto sidebar-scroll max-w-[20%]">
            {/* ── SUMMARY ── */}
            <section className=" bg-white rounded-2xl border-2 border-red-100 shadow-xl shadow-red-500/5 flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Header: Solid Red with White Text */}
              <header className="bg-red-600 p-4 flex-shrink-0">
                <h3 className="text-[clamp(14px,1.4vw,16px)] font-black uppercase tracking-[3px] text-white flex items-center gap-2">
                  <Calculator size={16} className="shrink-0 text-white" />
                  Summary
                </h3>
              </header>

              {/* Scrollable rows */}
              <div className="custom-table-scroller overflow-y-auto min-h-0 flex-1 custom-scrollbar p-4 py-2">
                <div className="space-y-0">
                  <SummaryRow
                    label="Total Purchase Price"
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
                    label="VATable Purchases"
                    value={fmt(summary.vatableSales)}
                  />
                  <SDivider />

                  <SummaryRow
                    label="VAT-Exempt Purchases"
                    value={fmt(summary.vatExemptSales)}
                  />
                  <SDivider />

                  <SummaryRow
                    label="Zero Rated Purchases"
                    value={fmt(summary.zeroRatedSales)}
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

              {/* Total Amount Due footer */}
              <div className="p-4 pt-0 flex-shrink-0">
                <div className="flex flex-col gap-[2px] mb-3">
                  <div className="h-[3px] w-full bg-red-600 rounded-full" />
                  <div className="h-[1px] w-full bg-gray-200" />
                </div>

                <div className="text-center bg-red-500 rounded-xl py-3 border border-gray-100">
                  <p className="text-[clamp(11px,1.1vw,12px)] font-black text-gray-200 uppercase tracking-[4px] mb-1">
                    Total Amount Due
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
              {/* 1. PURCHASE ITEMS */}
              <TableSection title="Purchase Items" icon={<Wallet size={14} />}>
                <div className="w-full flex flex-col gap-[2px] mb-3">
                  <div className="h-[2px] w-full bg-red-600 rounded-full" />
                  <div className="h-[1px] w-full bg-black/10" />
                </div>

                <div
                  ref={purchaseItemsScrollRef}
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
                              onChange={(v) =>
                                updatePurchaseItem(item.id, 'productSearch', v)
                              }
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
                            <input
                              disabled={isViewMode}
                              className={`${tableInput + ' font-black'} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={item.price || ''}
                              onChange={(e) =>
                                updatePurchaseItem(
                                  item.id,
                                  'price',
                                  e.target.value === ''
                                    ? ''
                                    : parseFloat(e.target.value) || 0,
                                )
                              }
                            />
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
                            <input
                              disabled={isViewMode}
                              className={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              placeholder="Select"
                              value={item.responsibilityCenter}
                              onChange={(e) =>
                                updatePurchaseItem(
                                  item.id,
                                  'responsibilityCenter',
                                  e.target.value,
                                )
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
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => addPurchaseItem(false)}
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
                      <col style={{ width: '22%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '16%' }} />
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
                              disabled={isViewMode || !entry.isManual}
                              className={`${tableInput + ' font-black'} ${isViewMode || !entry.isManual ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
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
                              readOnly={isViewMode || !entry.isManual}
                            />
                          </td>
                          <td className="py-1.5 px-1">
                            <input
                              disabled={isViewMode || !entry.isManual}
                              className={`${tableInput + ' font-black text-red-600'} ${isViewMode || !entry.isManual ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
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
                              readOnly={isViewMode || !entry.isManual}
                            />
                          </td>
                          <td className="py-1.5 px-1">
                            <input
                              disabled={isViewMode}
                              className={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
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
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {!isViewMode && (
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
                    disabled={isViewMode}
                    className={`w-full min-h-[100px] mt-4 p-4 rounded-xl text-[14px] font-bold focus:ring-1 focus:ring-red-500 outline-none ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : 'bg-gray-50 border-none'}`}
                    placeholder="Enter justification or internal notes here..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </TableSection>
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
