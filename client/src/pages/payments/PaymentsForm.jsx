import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Minus,
  FileText,
  Paperclip,
  Calculator,
  Layers,
  Landmark,
  Receipt,
} from 'lucide-react'
import ReactDOM from 'react-dom'
import DynamicToast from '../../components/DynamicToast'
import RightSideModal from '../../components/RightSideModal'
import useResponsibilityCenter from '../responsibility_center/useResponsibilityCenter'

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
// HELPERS — amount computation per line item
//
//  Collection items store only 3 things in the DB (collection_items table):
//    ci_sales_id       → which sales invoice line  (salesItemId)
//    ci_amount         → discounted + VAT − WHT     (amount)
//    ci_witholding_tax → WHT amount                 (whtAmount)
//
//  All other fields (gross, discAmt, vatAmt) are DERIVED for display only.
// ─────────────────────────────────────────────────────────────────────────────
function computeItemAmounts(
  qty,
  price,
  discountValue,
  discountType,
  vatPct,
  whtPct,
) {
  const gross = qty * price

  // Calculate discount amount based on discount type
  let discAmt
  if (discountType === 'PERCENT') {
    discAmt = gross * (discountValue / 100)
  } else {
    // FIXED amount - apply discount per unit, then multiply by quantity
    discAmt = discountValue * qty
  }

  const discounted = gross - discAmt
  const vatAmt = discounted * (vatPct / 100)
  const whtAmt = discounted * (whtPct / 100)
  const amount = discounted + vatAmt - whtAmt // → ci_amount
  return {
    gross: parseFloat(gross.toFixed(2)),
    discAmt: parseFloat(discAmt.toFixed(2)),
    vatAmt: parseFloat(vatAmt.toFixed(2)),
    whtAmount: parseFloat(whtAmt.toFixed(2)), // → ci_witholding_tax
    amount: parseFloat(amount.toFixed(2)), // → ci_amount
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY — derived entirely from pre-computed item fields
// ─────────────────────────────────────────────────────────────────────────────
function computeSummary(items) {
  return items.reduce(
    (acc, item) => ({
      totalGross: acc.totalGross + (item.gross || 0),
      totalDiscount: acc.totalDiscount + (item.discAmt || 0),
      totalVAT: acc.totalVAT + (item.vatAmt || 0),
      totalWHT: acc.totalWHT + (item.whtAmount || 0),
      totalCashCollected: acc.totalCashCollected + (item.amount || 0),
    }),
    {
      totalGross: 0,
      totalDiscount: 0,
      totalVAT: 0,
      totalWHT: 0,
      totalCashCollected: 0,
    },
  )
}

const fmt = (n = 0) =>
  Number(n).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

// Format price for display (adds commas to integers, allows unlimited decimals)
const formatPriceDisplay = (value) => {
  if (value === '' || value === null || value === undefined) return ''

  const stringValue = String(value)
  const parts = stringValue.split('.')
  const integerPart = parts[0]
  const decimalPart = parts.length > 1 ? parts[1] : null

  let formattedInteger = ''
  if (integerPart) {
    formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  if (decimalPart !== null) {
    return `${formattedInteger}.${decimalPart}`
  }

  return formattedInteger
}

const parsePriceInput = (input) => {
  if (input === '' || input === null || input === undefined) return ''

  let cleaned = String(input).replace(/[^0-9.]/g, '')
  const parts = cleaned.split('.')
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('')
  }
  return cleaned
}

// ─────────────────────────────────────────────────────────────────────────────
// Drag to scroll hook
// ─────────────────────────────────────────────────────────────────────────────
function useDragToScroll() {
  const ref = useRef(null)
  useEffect(() => {
    const elem = ref.current
    if (!elem) return
    let isDown = false,
      startX,
      scrollLeft
    const handleMouseDown = (e) => {
      isDown = true
      elem.style.cursor = 'grabbing'
      startX = e.pageX - elem.offsetLeft
      scrollLeft = elem.scrollLeft
    }
    const handleMouseLeave = () => {
      isDown = false
      elem.style.cursor = 'grab'
    }
    const handleMouseUp = () => {
      isDown = false
      elem.style.cursor = 'grab'
    }
    const handleMouseMove = (e) => {
      if (!isDown) return
      e.preventDefault()
      const x = e.pageX - elem.offsetLeft
      const walk = (x - startX) * 1.5
      elem.scrollLeft = scrollLeft - walk
    }
    elem.addEventListener('mousedown', handleMouseDown)
    elem.addEventListener('mouseleave', handleMouseLeave)
    elem.addEventListener('mouseup', handleMouseUp)
    elem.addEventListener('mousemove', handleMouseMove)
    return () => {
      elem.removeEventListener('mousedown', handleMouseDown)
      elem.removeEventListener('mouseleave', handleMouseLeave)
      elem.removeEventListener('mouseup', handleMouseUp)
      elem.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])
  return ref
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function PaymentsForm({
  onBack,
  onSuccess,
  isViewMode = false,
  isEditMode = false,
  paymentData = null,
}) {
  // ── Payment items ──────────────────────────────────────────────────────
  // Each item shape (what lives in state):
  // {
  //   id                 : React key (frontend only)
  //   purchaseItemId     : pi_id from purchase_items → ci_purchase_id (STORED)
  //   invoiceRef         : document_reference       (display only)
  //   description        : product name             (display only)
  //   responsibilityCenter                           (display only)
  //   gross              : qty × price              (display only)
  //   discAmt            : gross × disc%            (display only)
  //   vatAmt             : discounted × vat%        (display only)
  //   whtAmount          : discounted × wht%        → ci_witholding_tax (STORED)
  //   amount             : discounted + vat − wht   → ci_amount (STORED)
  //   isOther            : false for invoice items
  // }
  const [paymentItems, setPaymentItems] = useState([])
  const [journalEntries, setJournalEntries] = useState([])

  // ── Remote data ──────────────────────────────────────────────────────────
  const [vendors, setVendors] = useState([])
  const [vendorLoading, setVendorLoading] = useState(false)
  const [vendorError, setVendorError] = useState('')
  const [selectedVendor, setSelectedVendor] = useState('')
  const [vendorSearch, setVendorSearch] = useState('')

  const [chartsOfAccounts, setChartsOfAccounts] = useState([])

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

  // ── Payment / header fields ───────────────────────────────────────────────
  const [modeOfPayment, setModeOfPayment] = useState('')
  const [modeSearch, setModeSearch] = useState('')
  const [bankName, setBankName] = useState('')
  const [checkNumber, setCheckNumber] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [documentReference, setDocumentReference] = useState('')
  const [createdBy, setCreatedBy] = useState('')
  const [remarks, setRemarks] = useState('')

  const [attachments, setAttachments] = useState([])

  const [toast, setToast] = useState(null)
  const [imageModal, setImageModal] = useState({ isOpen: false, imageSrc: '' })

  // ── Vendor modal ──────────────────────────────────────────────────────────────
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

  // ── Purchase invoice modal ───────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [purchaseData, setPurchaseData] = useState([])
  const [purchaseDataLoading, setPurchaseDataLoading] = useState(false)
  const [purchaseDataError, setPurchaseDataError] = useState('')
  const [selectedPurchases, setSelectedPurchases] = useState([])

  const modeOfPaymentOptions = [
    'CASH',
    'CHECK',
    'BANK_TRANSFER',
    'CARD',
    'E-WALLET',
    'OTHERS',
  ]

  const coaOptions = chartsOfAccounts.map((a) => ({
    label: a.name || a.account_name,
    sublabel: a.code || a.account_code,
    value: a.id,
  }))
  const vendorOptions = vendors.map((v) => ({
    label: v.name || v.vendor_name,
    sublabel: v.code,
    value: v.id,
  }))

  // ── Fetchers ──────────────────────────────────────────────────────────────
  const fetchVendors = async () => {
    try {
      setVendorLoading(true)
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(`${import.meta.env.VITE_SERVER_LINK}/vendors`, {
        headers: { Authorization: `Bearer ${token}` },
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

  const fetchChartsOfAccounts = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/charts_of_accounts`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const result = await res.json()
      if (result.success) setChartsOfAccounts(result.data)
    } catch (err) {
      console.error('COA fetch error:', err.message)
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

  const fetchPurchaseData = async () => {
    try {
      setPurchaseDataLoading(true)
      setPurchaseDataError('')
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/payments/purchase-payment/`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const result = await res.json()
      if (result.success) setPurchaseData(result.data || [])
      else setPurchaseDataError(result.message || 'Failed to fetch purchase data')
    } catch (err) {
      setPurchaseDataError(err.message)
    } finally {
      setPurchaseDataLoading(false)
    }
  }

  useEffect(() => {
    fetchVendors()
    fetchChartsOfAccounts()
  }, [])
  useEffect(() => {
    if (isModalOpen) {
      fetchPurchaseData()
      setSelectedPurchases([])
    }
  }, [isModalOpen])

  // Populate form with payment data when in view or edit mode
  useEffect(() => {
    console.log(
      'useEffect triggered - isViewMode:',
      isViewMode,
      'isEditMode:',
      isEditMode,
      'paymentData:',
      paymentData,
    )
    if ((isViewMode || isEditMode) && paymentData) {
      // Set loading flag to prevent useEffect from interfering
      isLoadingData.current = true
      console.log('Populating form with payment data:', paymentData)
      console.log('paymentData structure:', Object.keys(paymentData))

      // Populate basic payment info - handle different data structures
      let payment = null
      if (paymentData.data && paymentData.data.length > 0) {
        payment = paymentData.data[0]
        console.log('Using paymentData.data[0]:', payment)
      } else if (paymentData.data && paymentData.data.id) {
        payment = paymentData.data
        console.log('Using paymentData.data directly:', payment)
      } else if (paymentData.id) {
        payment = paymentData
        console.log('Using paymentData directly:', payment)
      } else if (typeof paymentData === 'object' && paymentData !== null) {
        payment = paymentData
        console.log('Using paymentData as direct object:', payment)
      }

      if (payment) {
        console.log('Setting payment fields:', {
          vendor: payment.vendor,
          doc_ref: payment.doc_ref,
          mode_of_payment: payment.mode_of_payment,
          bank_name: payment.bank_name,
          check_number: payment.check_number,
          payment_date: payment.payment_date,
          remarks: payment.remarks,
          id: payment.id,
        })

        // Note: Vendor lookup is now handled in a separate useEffect
        setDocumentReference(payment.doc_ref || '')
        setModeOfPayment(payment.mode_of_payment || '')
        setModeSearch(payment.mode_of_payment || '')
        setPaymentDate(payment.payment_date || '')
        setBankName(payment.bank_name || '')
        setCheckNumber(payment.check_number || '')
        setRemarks(payment.remarks || '')
        setCreatedBy(payment.created_by || '')
      } else {
        console.warn('No payment data found in expected structure')
      }

      // Populate payment items
      if (paymentData.items && paymentData.items.length > 0) {
        console.log('Populating payment items:', paymentData.items)
        const items = paymentData.items.map((item, index) => ({
          id: item.id,
          purchaseItemId: item.purchase_item_id,
          invoiceRef: item.invoice_ref || '',
          description: item.product_service_name || item.description || '',
          responsibilityCenter: item.responsibility_center || '',
          gross:
            (parseFloat(item.amount) || 0) + (parseFloat(item.witholding_tax) || 0),
          discAmt: parseFloat(item.discount) || 0,
          vatAmt: parseFloat(item.vat) || 0,
          whtAmount: parseFloat(item.witholding_tax) || 0,
          amount: parseFloat(item.amount) || 0,
          isOther: false,
        }))
        console.log('Setting payment items:', items)
        setPaymentItems(items)
      } else {
        console.log('No payment items found or empty array')
      }

      // Populate journal entries
      // Check if journal entries are in paymentData.journal or as a separate property
      const journalData = paymentData.journal || paymentData.journal_entries || []

      if (journalData && journalData.length > 0) {
        console.log('DEBUG: Loading journal entries from data:', journalData)
        const journal = journalData.map((entry, index) => ({
          id: entry.id,
          account: entry.charts_of_accounts_name,
          accountSearch: entry.charts_of_accounts_name,
          center: entry.responsibility_center || '',
          debit: entry.type === 'DEBIT' ? parseFloat(entry.amount) || 0 : 0,
          credit: entry.type === 'CREDIT' ? parseFloat(entry.amount) || 0 : 0,
          isManual: false,
        }))
        console.log('DEBUG: Setting journal entries in edit mode:', journal)
        setJournalEntries(journal)
      } else {
        console.log('DEBUG: No journal entries found or empty array')
        console.log('DEBUG: paymentData structure:', Object.keys(paymentData))
        console.log('DEBUG: paymentData.journal:', paymentData.journal)
        console.log(
          'DEBUG: paymentData.journal_entries:',
          paymentData.journal_entries,
        )
      }

      // Populate attachments - handle both direct attachments property and nested structure
      const attachmentsData = paymentData.attachments || []
      console.log('Processing attachments:', attachmentsData)
      if (attachmentsData && attachmentsData.length > 0) {
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
          return {
            id: att.id,
            fileName: att.name || '', // Server now correctly sends name as filename
            file: att.file || null, // Server now correctly sends file as base64 string
            remarks: att.remarks || '',
            uploadedBy: att.uploaded_by || 'Current User',
            date: att.uploaded_date || new Date().toLocaleDateString(),
          }
        })
        console.log('Final attachments array:', attachments)
        setAttachments(attachments)
      } else {
        console.log('No attachments found or empty array, clearing attachments')
        setAttachments([]) // Explicitly set to empty array to prevent empty rows
      }
    }
  }, [isViewMode, isEditMode, paymentData])

  // ── Vendor lookup for edit mode ─────────────────────────────────────────────
  useEffect(() => {
    if ((isViewMode || isEditMode) && paymentData && vendors.length > 0) {
      // Extract payment data
      let payment = null
      if (paymentData.data && paymentData.data.length > 0) {
        payment = paymentData.data[0]
      } else if (paymentData.data && paymentData.data.id) {
        payment = paymentData.data
      } else if (paymentData.id) {
        payment = paymentData
      } else if (typeof paymentData === 'object' && paymentData !== null) {
        payment = paymentData
      }

      if (payment) {
        // Find vendor ID from vendor name when in edit mode
        const vendorName = payment.vendor || ''
        console.log('Looking up vendor:', vendorName, 'Available vendors:', vendors)
        const vendor = vendors.find((v) => (v.name || v.v_name) === vendorName)
        const vendorId = vendor ? vendor.id : ''
        console.log('Found vendor:', vendor, 'Vendor ID:', vendorId)

        setSelectedVendor(vendorId)
        setVendorSearch(vendorName)
      }

      // Clear loading flag when data loading is complete
      setTimeout(() => {
        isLoadingData.current = false
        console.log('DEBUG: Data loading complete, loading flag cleared')
      }, 100) // Small delay to ensure all state updates are complete
    }
  }, [isViewMode, isEditMode, paymentData, vendors])

  // ── Item helpers ──────────────────────────────────────────────────────────
  const removePaymentItem = (id) =>
    setPaymentItems((prev) => prev.filter((i) => i.id !== id))
  const togglePurchaseSelection = (purchaseId) =>
    setSelectedPurchases((prev) =>
      prev.includes(purchaseId)
        ? prev.filter((id) => id !== purchaseId)
        : [...prev, purchaseId],
    )

  // ── Add selected purchases → fetch their line items → map to payment items ──
  const handleAddSelectedPurchases = async () => {
    try {
      if (selectedPurchases.length === 0) {
        setToast({
          type: 'warning',
          message: 'Please select at least one purchase invoice',
        })
        return
      }
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')

      const queryParams = new URLSearchParams()
      selectedPurchases.forEach((id) => queryParams.append('purchase_id', id))

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/payments/purchase-items-payment?${queryParams.toString()}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const result = await response.json()
      if (!result.success)
        throw new Error(result.message || 'Failed to fetch purchase items')

      // ── Map purchase_items → payment items ──────────────────────────────
      //  We compute amounts here so the accountant sees the full breakdown.
      //  vat IS included — it is part of ci_amount (Discounted + VAT − WHT).
      const newItems = result.data.map((s) => {
        const qty = parseFloat(s.quantity) || 0
        const price = parseFloat(s.purchase_price) || 0
        const discountVal = parseFloat(s.discount) || 0
        const discountType = s.discount_type || 'PERCENT'
        const vatPct = parseFloat(s.vat) || 0 // ← MUST include VAT
        const whtPct = parseFloat(s.witholding_tax) || 0

        const computed = computeItemAmounts(
          qty,
          price,
          discountVal,
          discountType,
          vatPct,
          whtPct,
        )

        return {
          id: Date.now() + Math.random(),
          purchaseItemId: s.id, // → ci_purchase_id (purchase item ID)
          invoiceRef: s.document_reference || '', // display only
          description: s.product_service_name || s.description || '', // display only
          responsibilityCenter: s.responsibility_center || '', // display only
          gross: computed.gross, // display only
          discAmt: computed.discAmt, // display only
          vatAmt: computed.vatAmt, // display only
          whtAmount: computed.whtAmount, // → ci_witholding_tax
          amount: computed.amount, // → ci_amount
          isOther: false,
        }
      })

      // Clear existing payment items
      setPaymentItems([])
      // Add new items to payment
      setPaymentItems([...newItems])
      setIsModalOpen(false)
      setSelectedPurchases([])
      setToast({
        type: 'success',
        message: `${newItems.length} item(s) added from purchase invoice`,
      })
    } catch (error) {
      console.error('Error adding selected purchases:', error)
      setToast({ type: 'error', message: 'Error: ' + error.message })
    }
  }

  // ── Journal entry helpers ─────────────────────────────────────────────────
  const addJournalEntry = () => {
    console.log('DEBUG: addJournalEntry called')
    console.log('DEBUG: Current journalEntries before adding:', journalEntries)
    const newEntry = {
      id: Date.now(),
      account: '',
      accountSearch: '',
      center: '',
      debit: 0,
      credit: 0,
      isManual: true,
    }
    console.log('DEBUG: New entry to add:', newEntry)
    setJournalEntries((prev) => {
      const updated = [...prev, newEntry]
      console.log('DEBUG: Journal entries after adding:', updated)
      return updated
    })
  }
  const removeJournalEntry = (id) =>
    setJournalEntries((prev) => prev.filter((e) => e.id !== id))
  const updateJournalEntry = (id, field, value) => {
    console.log('DEBUG: updateJournalEntry called', { id, field, value })
    setJournalEntries((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
      console.log('DEBUG: Journal entries after update:', updated)
      return updated
    })
  }

  // ── Attachment helpers ────────────────────────────────────────────────────
  const addAttachment = () => {
    console.log('addAttachment called, current attachments:', attachments)
    // Generate a unique ID that won't conflict with existing server IDs
    // Use negative timestamp to distinguish from server IDs (which are positive)
    const newAttachment = {
      id: `new_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fileName: '',
      file: null,
      remarks: '',
      uploadedBy: 'Current User',
      date: new Date().toLocaleDateString(),
    }
    console.log('Adding new attachment:', newAttachment)
    setAttachments((prev) => {
      const updated = [...prev, newAttachment]
      console.log('Updated attachments after add:', updated)
      return updated
    })
  }
  const removeAttachment = (id) => {
    console.log(
      'removeAttachment called with id:',
      id,
      'current attachments:',
      attachments,
    )
    setAttachments((prev) => {
      const updated = prev.filter((a) => a.id !== id)
      console.log('Updated attachments after remove:', updated)
      return updated
    })
  }
  const updateAttachment = (id, field, value) => {
    console.log(
      'updateAttachment called with id:',
      id,
      'field:',
      field,
      'value:',
      value,
    )
    setAttachments((prev) => {
      const updated = prev.map((att) =>
        att.id === id ? { ...att, [field]: value } : att,
      )
      console.log('Updated attachments after update:', updated)
      return updated
    })
  }
  const handleFileChange = (id, file) => {
    if (file && file instanceof File) {
      updateAttachment(id, 'fileName', file.name)
      updateAttachment(id, 'file', file)
    } else if (file) {
      console.error('Invalid file object provided to handleFileChange:', file)
      setToast({
        type: 'error',
        message: 'Invalid file selected. Please choose a valid file.',
      })
    }
  }

  const summary = computeSummary(paymentItems)

  // ── Auto-generate journal entries ─────────────────────────────────────────
  //
  //  Per item:
  //    DR  Accounts Payable     amount     ← closes the full AP (liability decreases)
  //    DR  Purchase Discounts   discAmt    ← discount received
  //    DR  Input VAT             vatAmt     ← VAT input claimable
  //    DR  Creditable WHT        whtAmount  ← tax withheld (asset)
  //
  //  One combined:
  //    CR  Cash / Bank           totalCash  ← actual money paid
  //
  //  Balance proof per item:
  //    DR side = amount + discAmt + vatAmt + whtAmount
  //            = (discounted + vatAmt − whtAmt) + discAmt + vatAmt + whtAmount
  //            = discounted + discAmt + 2*vatAmt
  //            = (gross − discAmt) + discAmt + 2*vatAmt
  //            = gross + 2*vatAmt   ← note: AP was originally booked at gross + vatAmt in the Purchase JE
  //    CR side = gross + 2*vatAmt  ✅
  // ─────────────────────────────────────────────────────────────────────────
  const generateJournalEntries = () => {
    if (paymentItems.length === 0) {
      setJournalEntries([])
      return
    }

    const entries = []

    // Resolve cash/payment account
    let paymentAccount = null
    if (modeOfPayment === 'CASH') {
      paymentAccount =
        chartsOfAccounts.find((a) =>
          (a.name || '').toLowerCase().includes('cash on hand'),
        ) ??
        chartsOfAccounts.find((a) =>
          (a.name || '').toLowerCase().includes('petty cash'),
        )
    } else if (modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') {
      if (bankName) {
        paymentAccount = chartsOfAccounts.find((a) =>
          (a.name || '').toLowerCase().includes(bankName.toLowerCase()),
        )
      }
      paymentAccount ??= chartsOfAccounts.find((a) =>
        (a.name || '').toLowerCase().includes('cash in bank'),
      )
    }

    const apAccount = chartsOfAccounts.find((a) =>
      (a.name || '').toLowerCase().includes('accounts payable'),
    )

    let totalCash = 0

    paymentItems
      .filter((i) => !i.isOther)
      .forEach((item) => {
        totalCash += item.amount || 0

        // DR  Accounts Payable — amount paid
        if (apAccount && item.amount > 0) {
          entries.push({
            id: Date.now() + Math.random(),
            account: apAccount.id,
            accountSearch: apAccount.name,
            center: item.responsibilityCenter || '',
            debit: parseFloat(item.amount.toFixed(2)),
            credit: 0,
            isManual: false,
          })
        }
      })

    // CR  Cash / Bank — one combined entry
    if (paymentAccount && totalCash > 0) {
      entries.push({
        id: Date.now() + Math.random(),
        account: paymentAccount.id,
        accountSearch: paymentAccount.name,
        center: '',
        debit: 0,
        credit: parseFloat(totalCash.toFixed(2)),
        isManual: false,
      })
    }

    setJournalEntries(entries)
  }

  // Add a ref to track if we're loading data to prevent race conditions
  const isLoadingData = useRef(false)

  useEffect(() => {
    // Auto-generate journal entries logic:
    // 1. Never in view mode
    // 2. In create mode: always auto-generate when paymentItems or modeOfPayment changes
    // 3. In edit mode: NEVER auto-generate if we're loading existing payment data
    // 4. Auto-generation will replace all entries (both manual and auto) to maintain consistency

    console.log(
      'DEBUG: useEffect running - isEditMode:',
      isEditMode,
      'paymentItems.length:',
      paymentItems.length,
      'modeOfPayment:',
      modeOfPayment,
      'isLoadingData:',
      isLoadingData.current,
    )

    if (!isViewMode && !isLoadingData.current) {
      // In create mode, always auto-generate when paymentItems or modeOfPayment changes
      if (!isEditMode) {
        console.log('DEBUG: Auto-generating in create mode')
        generateJournalEntries()
      }
      // In edit mode: only auto-generate if there are no payment items AND no existing entries AND we're not loading data
      // This prevents overwriting existing database entries that are being loaded
      else {
        if (paymentItems.length === 0 && journalEntries.length === 0) {
          console.log('DEBUG: Auto-generating in edit mode (no items, no entries)')
          generateJournalEntries()
        } else {
          console.log(
            'DEBUG: NOT auto-generating in edit mode - paymentItems:',
            paymentItems.length,
            'journalEntries:',
            journalEntries.length,
          )
        }
      }
    } else {
      console.log(
        'DEBUG: NOT auto-generating - isViewMode:',
        isViewMode,
        'isLoadingData:',
        isLoadingData.current,
      )
    }
  }, [
    paymentItems,
    modeOfPayment,
    bankName,
    chartsOfAccounts,
    isViewMode,
    isEditMode,
  ])

  // Separate useEffect to handle when manual entries are added (should not trigger auto-generation)
  useEffect(() => {
    // This effect runs when journalEntries change to ensure manual entries are preserved
    // But it doesn't trigger auto-generation, preventing conflicts
    if (isEditMode && journalEntries.length > 0) {
      const hasManualEntries = journalEntries.some((entry) => entry.isManual)
      if (hasManualEntries) {
        console.log('Manual entries detected, preserving them')
      }
    }
  }, [journalEntries, isEditMode])

  // ── Post Transaction ──────────────────────────────────────────────────────
  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      // Validate that file is a Blob/File object
      if (!file || !(file instanceof Blob)) {
        reject(new Error('Invalid file: parameter is not a Blob or File object'))
        return
      }

      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result)
      reader.onerror = (err) => reject(err)
    })

  const handlePostTransaction = async () => {
    try {
      if (!selectedVendor) {
        setToast({ type: 'warning', message: 'Please select a vendor' })
        return
      }
      if (!modeOfPayment) {
        setToast({ type: 'warning', message: 'Please select mode of payment' })
        return
      }
      if (
        (modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') &&
        !bankName
      ) {
        setToast({ type: 'warning', message: 'Please enter bank name' })
        return
      }
      if (paymentItems.filter((i) => !i.isOther).length === 0) {
        setToast({
          type: 'warning',
          message: 'Please add at least one payment item from a purchase invoice',
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

      const userData = JSON.parse(localStorage.getItem('user') || '{}')
      const createdBy = userData.mu_username || userData.username || 'Unknown User'

      // ── payment_items payload — ONLY what the DB schema stores ──
      //   ci_purchase_id    → purchaseItemId
      //   ci_amount         → amount       (discounted + VAT − WHT)
      //   ci_witholding_tax → whtAmount
      // Only include payment items if they're not from existing data (new items)
      // In edit mode, existing payment items should not be sent unless they're modified
      const preparedItems = isEditMode
        ? [] // Don't send existing payment items in edit mode
        : paymentItems
            .filter((item) => !item.isOther)
            .map((item) => ({
              purchase_id: item.purchaseItemId,
              amount: item.amount,
              witholding_tax: item.whtAmount,
            }))

      const preparedJournalEntries = journalEntries.map((entry) => {
        // Look up account ID from account name
        const account = chartsOfAccounts.find(
          (a) =>
            (a.name || a.account_name) === entry.account ||
            (a.name || a.account_name) === entry.accountSearch,
        )
        const accountId = account ? account.id : null

        return {
          account_id: accountId,
          responsibility_center: entry.center || '',
          debit: parseFloat(entry.debit) || 0,
          credit: parseFloat(entry.credit) || 0,
          id: entry.id || null,
        }
      })

      console.log('DEBUG: Journal entries being sent:', preparedJournalEntries)
      console.log('DEBUG: Journal entries count:', preparedJournalEntries.length)

      const preparedAttachments = await Promise.all(
        attachments.map(async (att) => {
          try {
            let fileData = null

            // Only convert to base64 if it's a File object (new attachment)
            if (att.file && att.file instanceof File) {
              fileData = await fileToBase64(att.file)
            } else if (
              att.file &&
              typeof att.file === 'string' &&
              att.file.startsWith('data:')
            ) {
              // Already a base64 string (existing attachment), use as-is
              fileData = att.file
            }

            return {
              // Map client structure to server structure
              // Server expects: file (base64 string), name (filename)
              file: fileData,
              name: att.fileName || att.name || '',
              remarks: att.remarks || '',
              uploadedBy: att.uploadedBy || 'Current User',
              uploaded_date: att.date || new Date().toLocaleDateString(),
              // Include ID for update operations
              id: att.id || null,
            }
          } catch (error) {
            console.error('Error processing attachment:', att.fileName, error)
            throw new Error(
              `Failed to process attachment "${att.fileName}": ${error.message}`,
            )
          }
        }),
      )

      // ── payments header payload — matches DB columns exactly ──
      // c_vendor_id, c_document_reference, c_mode_of_payment,
      // c_bank_name, c_check_number, c_payment_date, c_remarks, c_created_by
      const requestPayload = {
        vendor_id: selectedVendor,
        document_reference: documentReference,
        mode_of_payment: modeOfPayment,
        bank_name: bankName || '',
        check_number: checkNumber || '',
        payment_date: new Date().toISOString().split('T')[0],
        remarks,
        total_amount_due: summary.totalCashCollected,
        payment_items: preparedItems,
        journal_entries: preparedJournalEntries,
        attachments: preparedAttachments,
      }

      // Add ID and updated_by for edit mode
      let paymentId = null
      if (isEditMode && paymentData) {
        paymentId = paymentData.data?.[0]?.id || paymentData.id
        if (paymentId) {
          requestPayload.id = paymentId
          requestPayload.updated_by = createdBy
        }
      } else {
        requestPayload.created_by = createdBy
      }

      const url =
        isEditMode && paymentId
          ? `${import.meta.env.VITE_SERVER_LINK}/payments/${paymentId}`
          : `${import.meta.env.VITE_SERVER_LINK}/payments`

      const method = isEditMode && paymentId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestPayload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`,
        )
      }

      const result = await response.json()
      if (result.success) {
        const action = isEditMode ? 'updated' : 'posted'
        const nextToast = {
          type: 'success',
          message: `Payment ${action} successfully!`,
        }
        setToast(nextToast)
        if (onSuccess) await onSuccess(nextToast)
        onBack()
      } else {
        const action = isEditMode ? 'update' : 'post'
        setToast({
          type: 'error',
          message: result.message || `Failed to ${action} payment`,
        })
      }
    } catch (error) {
      console.error('Error posting payment:', error)
      setToast({ type: 'error', message: 'Error: ' + error.message })
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const inputBase =
    'w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ' +
    (isViewMode
      ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed'
      : 'bg-gray-50 border border-gray-200 text-black focus:ring-1 focus:ring-red-500')
  const tableInput =
    'w-full rounded-md px-1 py-1 text-[13px] font-bold text-center outline-none ' +
    (isViewMode
      ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed'
      : 'bg-gray-50/50 focus:ring-1 focus:ring-red-400')
  const fadeInUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  }

  const totalDebit = journalEntries.reduce(
    (s, e) => s + (parseFloat(e.debit) || 0),
    0,
  )
  const totalCredit = journalEntries.reduce(
    (s, e) => s + (parseFloat(e.credit) || 0),
    0,
  )
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

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

      {/* TOP NAV */}
      <div className="flex items-center justify-between flex-shrink-0">
        <nav
          className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[2px] text-gray-400 cursor-pointer hover:text-black transition-colors"
          onClick={onBack}
        >
          <ArrowLeft size={17} />
          <span className="text-black">Back to Payments</span>
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
              <Save size={14} /> Post Payment
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
          <div
            className={`grid gap-3 ${modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER' ? 'grid-cols-6' : 'grid-cols-4'}`}
          >
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
                    dropdownFooter={
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault()
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                        }}
                        onClick={openVendorModal}
                        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-black text-white text-[11px] font-black rounded-xl hover:bg-red-600 transition-all"
                      >
                        <Plus size={12} /> Add Vendor
                      </button>
                    }
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
                  placeholder="OR-000"
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
            <fieldset>
              <legend className="text-[11px] font-black uppercase text-gray-100">
                Mode of Payment
              </legend>
              {isViewMode ? (
                <div className={inputBase + ' text-black py-1.5'}>
                  {modeSearch || 'No mode selected'}
                </div>
              ) : (
                <SearchableDropdown
                  placeholder="Select mode..."
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
            {(modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') && (
              <fieldset>
                <legend className="text-[11px] font-black uppercase text-gray-100">
                  Bank Name
                </legend>
                <input
                  type="text"
                  placeholder="Enter bank name"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  disabled={isViewMode}
                  className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${
                    isViewMode
                      ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed'
                      : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'
                  }`}
                />
              </fieldset>
            )}
            {(modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') && (
              <fieldset>
                <legend className="text-[11px] font-black uppercase text-gray-100">
                  Check Number
                </legend>
                <input
                  type="text"
                  placeholder="Check number"
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                  disabled={isViewMode}
                  className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${
                    isViewMode
                      ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed'
                      : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'
                  }`}
                />
              </fieldset>
            )}
          </div>
        </fieldset>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex gap-2 min-h-0">
          {/* LEFT SIDEBAR - SUMMARY ONLY */}
          <aside className="w-full flex-shrink-0 flex flex-col gap-2 h-full overflow-y-auto sidebar-scroll max-w-[20%]">
            {/* ── SUMMARY ── */}
            <section className="bg-white rounded-2xl border-2 border-red-100 shadow-xl shadow-red-500/5 flex-1 flex flex-col min-h-0 overflow-hidden">
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
                    label="Total Invoice Amount"
                    value={fmt(summary.totalGross)}
                  />
                  <SDivider />
                  <SummaryRow
                    label="Total Discount"
                    value={fmt(summary.totalDiscount)}
                    color="text-red-500"
                  />
                  <SDivider />
                  <SummaryRow
                    label="Total VAT"
                    value={fmt(summary.totalVAT)}
                    color="text-red-600"
                  />
                  <SDivider />
                  <SummaryRow
                    label="Total WHT"
                    value={fmt(summary.totalWHT)}
                    color="text-blue-600"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 flex-shrink-0">
                <div className="flex flex-col gap-[2px] mb-2">
                  <div className="h-[2px] w-full bg-red-600 rounded-full" />
                  <div className="h-[1px] w-full bg-black/10" />
                </div>
                <div className="mb-2 px-2 py-1 bg-red-50 rounded-lg border border-red-100 text-center">
                  <p className="text-[9px] font-black uppercase tracking-wide text-red-400">
                    Discounted + VAT − WHT
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-[3px] mb-1">
                    Total Amount Due
                  </p>
                  <p className="text-2xl font-black text-black tracking-tighter leading-none flex items-baseline justify-center gap-1">
                    <span className="text-[13px] text-red-600">PHP</span>
                    {fmt(summary.totalCashCollected)}
                  </p>
                </div>
              </div>
            </section>
          </aside>

          {/* ── MAIN CONTENT ── */}
          <main className="flex-1 overflow-y-auto custom-table-scroller space-y-4 pr-1 min-h-0">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="space-y-4"
            >
              {/* 1. PAYMENT ITEMS */}
              <TableSection title="Payment Items" icon={<Receipt size={14} />}>
                <div className="w-full flex flex-col gap-[2px] mb-3">
                  <div className="h-[2px] w-full bg-red-600 rounded-full" />
                  <div className="h-[1px] w-full bg-black/10" />
                </div>

                {/* <div className="mb-3 px-3 py-2 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-blue-600 text-[11px] font-black uppercase tracking-wide">
                  ℹ️ Collected against Sales Invoice — amounts are auto-computed from original invoice items (Discounted + VAT − WHT). Only Sales ID, Amount, and WHT are stored.
                </span>
              </div> */}

                {paymentItems.length === 0 ? (
                  <div className="py-10 text-center text-gray-400 text-[13px] font-bold border-2 border-dashed border-gray-100 rounded-xl">
                    No items yet. Click "Add Purchase Items" to select outstanding
                    invoices.
                  </div>
                ) : (
                  <div className="overflow-x-auto custom-table-scroller">
                    {/*
                    READ-ONLY display table.
                    All columns are for accountant review.
                    Only whtAmount (→ ci_witholding_tax) and amount (→ ci_amount) go to the DB.
                  */}
                    <table
                      className="w-full text-center min-w-[860px]"
                      style={{ tableLayout: 'fixed' }}
                    >
                      <colgroup>
                        <col style={{ width: '16%' }} /> {/* Invoice Ref */}
                        <col style={{ width: '20%' }} /> {/* Product/Service */}
                        <col style={{ width: '12%' }} /> {/* Gross Amt */}
                        <col style={{ width: '10%' }} /> {/* Discount */}
                        <col style={{ width: '10%' }} /> {/* VAT */}
                        <col style={{ width: '12%' }} />{' '}
                        {/* WHT → ci_witholding_tax */}
                        <col style={{ width: '14%' }} />{' '}
                        {/* Amount Due → ci_amount */}
                        <col style={{ width: '10%' }} />{' '}
                        {/* Responsibility Center */}
                        <col style={{ width: '6%' }} /> {/* Delete */}
                      </colgroup>
                      <thead>
                        <tr className="border-b border-gray-100">
                          {[
                            'Invoice Ref',
                            'Product/Service',
                            'Gross Amt',
                            'Discount',
                            'VAT',
                            'WHT',
                            'Amount Due',
                            'Responsibility Center',
                            '',
                          ].map((h, i) => (
                            <th
                              key={i}
                              className="pb-2 text-[11px] font-black uppercase text-gray-900 text-center px-1"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {paymentItems.map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-gray-50/50 transition-colors"
                          >
                            <td className="py-2 px-2 text-center">
                              <span className="font-mono text-[11px] bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                                {item.invoiceRef || '—'}
                              </span>
                            </td>
                            <td
                              className="py-2 px-2 text-[12px] font-bold text-center text-gray-700 truncate"
                              title={item.product_service_name || item.description}
                            >
                              {item.product_service_name || item.description || '—'}
                            </td>
                            <td className="py-2 px-2 text-[12px] font-bold text-center text-gray-800 tabular-nums">
                              {fmt(item.gross || 0)}
                            </td>
                            <td className="py-2 px-2 text-[12px] font-bold text-center text-orange-500 tabular-nums">
                              ({fmt(item.discAmt || 0)})
                            </td>
                            <td className="py-2 px-2 text-[12px] font-bold text-center text-red-500 tabular-nums">
                              +{fmt(item.vatAmt || 0)}
                            </td>
                            <td className="py-2 px-2 text-[12px] font-bold text-center text-blue-600 tabular-nums">
                              ({fmt(item.whtAmount || 0)})
                            </td>
                            <td className="py-2 px-2 text-[13px] font-black text-center text-green-700 tabular-nums">
                              {fmt(item.amount || 0)}
                            </td>
                            <td className="py-2 px-2 text-[12px] font-bold text-center text-gray-700 tabular-nums">
                              {item.responsibilityCenter || '---'}
                            </td>
                            <td className="py-2 px-1 text-center">
                              {!isViewMode && !isEditMode && (
                                <button
                                  onClick={() => removePaymentItem(item.id)}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 bg-gray-50/80">
                          <td
                            colSpan={2}
                            className="py-2 px-2 text-[13px] font-black uppercase text-gray-900 text-left"
                          >
                            Totals
                          </td>
                          <td className="py-2 px-2 text-[12px] font-black tabular-nums">
                            {fmt(summary.totalGross)}
                          </td>
                          <td className="py-2 px-2 text-[12px] font-black text-orange-500 tabular-nums">
                            ({fmt(summary.totalDiscount)})
                          </td>
                          <td className="py-2 px-2 text-[12px] font-black text-red-500 tabular-nums">
                            +{fmt(summary.totalVAT)}
                          </td>
                          <td className="py-2 px-2 text-[12px] font-black text-blue-600 tabular-nums">
                            ({fmt(summary.totalWHT)})
                          </td>
                          <td className="py-2 px-2 text-[13px] font-black text-green-700 tabular-nums">
                            {fmt(summary.totalCashCollected)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {!isViewMode && !isEditMode && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="flex-1 py-2 border-2 border-dashed rounded-xl text-[11px] font-black uppercase border-red-300 text-red-600 transition-all duration-300 hover:bg-red-50 hover:border-red-500 hover:-translate-y-1 hover:shadow-lg hover:shadow-red-500/10 flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> ADD Purchase Items
                    </button>
                  </div>
                )}
              </TableSection>

              {/* 2. JOURNAL ENTRIES */}
              <TableSection title={`Journal Entries`} icon={<Layers size={14} />}>
                <div className="w-full flex flex-col gap-[2px] mb-4">
                  <div className="h-[2px] w-full bg-red-600 rounded-full" />
                  <div className="h-[1px] w-full bg-black/10" />
                </div>

                {/* <div className="mb-3 grid grid-cols-2 gap-2">
                {[
                  { label: 'CR  Accounts Receivable', sub: 'Gross + VAT — closes the AR',      color: 'bg-red-50 border-red-100 text-red-600'       },
                  { label: 'DR  Sales Discounts',      sub: 'Discount given on collection',     color: 'bg-orange-50 border-orange-100 text-orange-600' },
                  { label: 'DR  Creditable WHT',       sub: 'Tax withheld by customer (asset)', color: 'bg-blue-50 border-blue-100 text-blue-600'      },
                  { label: 'DR  Cash / Bank',          sub: 'Actual cash received',             color: 'bg-green-50 border-green-100 text-green-600'   },
                ].map((leg, i) => (
                  <div key={i} className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase ${leg.color}`}>
                    {leg.label}<br />
                    <span className="opacity-70 normal-case font-semibold">{leg.sub}</span>
                  </div>
                ))}
              </div> */}

                <div className="overflow-x-auto custom-table-scroller">
                  <table
                    className="w-full text-center"
                    style={{ tableLayout: 'fixed', minWidth: 600 }}
                  >
                    <colgroup>
                      <col style={{ width: '35%' }} /> {/* Charts of Account */}
                      <col style={{ width: '18%' }} /> {/* Debit */}
                      <col style={{ width: '18%' }} /> {/* Credit */}
                      <col style={{ width: '23%' }} /> {/* Responsibility Center */}
                      <col style={{ width: '6%' }} /> {/* Delete */}
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
                      {journalEntries.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-6 text-[12px] text-gray-400 text-center"
                          >
                            Journal entries auto-generate once items are added and
                            mode of payment is selected.
                          </td>
                        </tr>
                      ) : (
                        journalEntries.map((entry) => (
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
                                className={`${tableInput + ' font-black text-red-600'} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                                placeholder="0.00"
                                type="text"
                                inputMode="decimal"
                                value={formatPriceDisplay(entry.credit ?? '')}
                                onChange={(e) => {
                                  const parsed = parsePriceInput(e.target.value)
                                  updateJournalEntry(
                                    entry.id,
                                    'credit',
                                    parsed === '' ? null : parseFloat(parsed) || 0,
                                  )
                                }}
                                readOnly={!entry.isManual}
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
                                  updateJournalEntry(
                                    entry.id,
                                    'center',
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
                            <td className="py-1.5 text-center">
                              {!isViewMode && entry.isManual ? (
                                <button
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  onClick={() => removeJournalEntry(entry.id)}
                                >
                                  <Trash2 size={14} className="mx-auto" />
                                </button>
                              ) : (
                                <span className="text-gray-300 text-[10px] italic">
                                  {isViewMode ? '' : 'Auto'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50/50 border">
                        <td className="py-2 px-3 text-[12px] font-black uppercase text-black text-left">
                          Balance Check
                        </td>
                        <td className="py-2 px-1 text-center text-[13px] font-black">
                          {fmt(totalDebit)}
                        </td>
                        <td
                          className={`py-2 px-1 text-center text-[13px] font-black ${isBalanced ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {fmt(totalCredit)}{' '}
                          <span className="text-[11px]">
                            {isBalanced ? '✅' : '❌'}
                          </span>
                        </td>
                        <td /> {/* Empty Responsibility Center - no totals */}
                        <td /> {/* Empty Delete column */}
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {!isViewMode && (
                  <button
                    onClick={() => {
                      console.log('DEBUG: isViewMode:', isViewMode)
                      console.log(
                        'DEBUG: Current journalEntries count:',
                        journalEntries.length,
                      )
                      addJournalEntry()
                    }}
                    className="mt-2 py-1.5 border-2 border-dashed rounded-lg w-full text-[12px] font-black uppercase border-red-300 text-red-600 transition-all duration-300 hover:bg-red-50 hover:border-red-500 hover:-translate-y-1 hover:shadow-lg hover:shadow-red-500/10 flex items-center justify-center gap-1"
                  >
                    <Plus size={15} /> Add Ledger Row
                  </button>
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
                        {console.log(
                          'Rendering attachments, current array:',
                          attachments,
                        ) ||
                          attachments.map((file) => (
                            <tr key={file.id}>
                              <td className="py-2 px-1">
                                <input
                                  disabled={isViewMode}
                                  className={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                                  placeholder="e.g. OR_Scan"
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
                                        onLoad={() =>
                                          console.log(
                                            'Image loaded successfully:',
                                            file.fileName,
                                          )
                                        }
                                        onError={(e) => {
                                          console.error(
                                            'Image failed to load:',
                                            file.fileName,
                                            e,
                                          )
                                          e.target.style.display = 'none'
                                          const fallback =
                                            document.createElement('span')
                                          fallback.className =
                                            'text-red-600 text-[10px] font-bold'
                                          fallback.textContent = 'Image error'
                                          e.target.parentNode.appendChild(fallback)
                                        }}
                                      />
                                    ) : file.file &&
                                      typeof file.file === 'string' ? (
                                      <span
                                        className="text-blue-600 text-[11px] font-bold"
                                        title={file.file.substring(0, 50) + '...'}
                                      >
                                        Non-image file
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
                              <td className="py-2 px-1 text-[12px] font-bold text-gray-600 tabular-nums">
                                {file.date}
                              </td>
                              <td className="py-2 text-center">
                                {!isViewMode && (
                                  <button
                                    onClick={() => removeAttachment(file.id)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <Trash2 size={14} />
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

                <TableSection
                  title="Remarks"
                  icon={<FileText size={14} />}
                  defaultCollapsed
                >
                  <textarea
                    disabled={isViewMode}
                    className={`w-full min-h-[100px] mt-4 p-4 rounded-xl text-[14px] font-bold outline-none ${
                      isViewMode
                        ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed resize-none'
                        : 'bg-gray-50 border-none focus:ring-1 focus:ring-red-500'
                    }`}
                    placeholder="Enter payment notes or justification here..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </TableSection>
              </div>
            </motion.div>
          </main>
        </div>
      </div>

      {/* ── PURCHASE INVOICE MODAL ── */}
      <RightSideModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Select Purchase Invoices"
        size="3xl"
      >
        <div className="space-y-4">
          <p className="text-[12px] text-gray-500 font-semibold">
            Select outstanding purchase invoices to pay. Their line items will be
            fetched and amounts auto-computed (Discounted + VAT − WHT).
          </p>

          {purchaseDataLoading ? (
            <div className="p-8 bg-gray-50 rounded-xl border border-gray-200 text-center">
              <p className="text-[12px] text-gray-400 font-bold animate-pulse">
                Loading purchase invoices…
              </p>
            </div>
          ) : purchaseDataError ? (
            <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-center">
              <p className="text-[12px] text-red-600 font-bold">
                {purchaseDataError}
              </p>
            </div>
          ) : purchaseData.length === 0 ? (
            <div className="p-8 bg-gray-50 rounded-xl border border-gray-200 text-center">
              <p className="text-[12px] text-gray-400 font-bold">
                No outstanding purchase invoices found.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden border border-gray-200 rounded-xl">
              <div className="max-h-[440px] overflow-y-auto custom-table-scroller">
                <table className="w-full" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '40%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '14%' }} />
                  </colgroup>
                  <thead className="bg-black sticky top-0 z-10">
                    <tr>
                      {[
                        '',
                        'Vendor',
                        'Doc Ref',
                        'Terms',
                        'Date Due',
                        'Amount Due',
                        'Status',
                      ].map((h, i) => (
                        <th
                          key={i}
                          className="px-4 py-3 text-center text-[11px] font-black uppercase text-white tracking-wider border-b-2 border-red-600"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {purchaseData.map((purchase, idx) => {
                      const isChecked = selectedPurchases.includes(purchase.id)
                      return (
                        <tr
                          key={purchase.id}
                          onClick={() => togglePurchaseSelection(purchase.id)}
                          className={`cursor-pointer transition-colors ${isChecked ? 'bg-red-50' : idx % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/40 hover:bg-gray-100'}`}
                        >
                          <td
                            className="px-4 py-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex justify-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePurchaseSelection(purchase.id)}
                                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                              />
                            </div>
                          </td>
                          <td
                            className="px-4 py-3 text-center text-[12px] font-bold text-gray-900 truncate"
                            title={purchase.vendor}
                          >
                            {purchase.vendor || '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-[11px] font-mono font-bold text-gray-700">
                            {purchase.doc_ref || '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-[11px] font-bold text-gray-500 uppercase">
                            {purchase.terms || '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-[11px] font-mono text-gray-600">
                            {purchase.date_due || '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-[12px] font-black tabular-nums text-gray-900">
                            {parseFloat(purchase.amount_due || 0).toLocaleString(
                              'en-PH',
                              { minimumFractionDigits: 2 },
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 text-[10px] font-black rounded-full border ${
                                purchase.status === 'PAID'
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : purchase.status === 'PARTIALLY PAID'
                                    ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                    : purchase.status === 'UNPAID'
                                      ? 'bg-red-50 text-red-700 border-red-200'
                                      : 'bg-gray-50 text-gray-600 border-gray-200'
                              }`}
                            >
                              {purchase.status || 'UNKNOWN'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedPurchases.length > 0 && (
            <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-center">
              <p className="text-[11px] font-black text-red-600 uppercase tracking-wide">
                {selectedPurchases.length} invoice
                {selectedPurchases.length > 1 ? 's' : ''} selected
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => {
                setIsModalOpen(false)
                setSelectedPurchases([])
              }}
              className="px-4 py-2 bg-gray-100 text-gray-600 text-[12px] font-black rounded-lg hover:bg-gray-200 transition-colors uppercase"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSelectedPurchases}
              disabled={selectedPurchases.length === 0}
              className={`px-6 py-2 text-[12px] font-black rounded-lg uppercase tracking-wider transition-colors ${
                selectedPurchases.length === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-200'
              }`}
            >
              Add{' '}
              {selectedPurchases.length > 0 ? `(${selectedPurchases.length})` : ''}{' '}
              Selected
            </button>
          </div>
        </div>
      </RightSideModal>

      {/* --- IMAGE MODAL --- */}
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

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function TableSection({ title, icon, children, defaultCollapsed = false }) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)

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

function SidebarInput({
  label,
  placeholder,
  type = 'text',
  required,
  value,
  onChange,
  disabled = false,
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-black uppercase text-gray-400 block">
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
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
            : 'bg-gray-50 border border-gray-200 text-black focus:ring-1 focus:ring-red-500'
        }`}
      />
    </div>
  )
}
