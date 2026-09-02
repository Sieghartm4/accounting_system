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
  ChevronDown,
  ChevronUp,
  Search,
  Wallet,
  Divide,
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

const formatPriceDisplay = (value) => {
  const normalized =
    value === '' || value === null || value === undefined ? '' : String(value)
  if (normalized === '') return ''
  const numeric = parseFloat(normalized)
  return Number.isNaN(numeric) ? '' : fmt(numeric)
}

const parsePriceInput = (input) => {
  if (input === '' || input === null || input === undefined) return ''
  const cleaned = String(input).replace(/[^0-9.]/g, '')
  const parts = cleaned.split('.')
  if (parts.length <= 1) return cleaned
  return `${parts[0]}.${parts[1].slice(0, 2)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function CollectionsForm({
  onBack,
  onSuccess,
  isViewMode = false,
  isEditMode = false,
  collectionData = null,
  preSelectedSales = null, // New prop for auto-filling from To Be Collected
  preSelectedSalesItems = null, // Fetched sales items for the selected sales
}) {
  // ── Collection items ──────────────────────────────────────────────────────
  // Each item shape (what lives in state):
  // {
  //   id                 : React key (frontend only)
  //   salesItemId        : id from sales_items    → ci_sales_id (STORED)
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
  const [collectionItems, setCollectionItems] = useState([])
  const [journalEntries, setJournalEntries] = useState([])

  // ── Remote data ──────────────────────────────────────────────────────────
  const [customers, setCustomers] = useState([])
  const [customerLoading, setCustomerLoading] = useState(false)
  const [customerError, setCustomerError] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')

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

  const [bulkResponsibilityCenter, setBulkResponsibilityCenter] = useState('')

  const [isCollectionItemsCollapsed, setIsCollectionItemsCollapsed] = useState(false)
  const [isJournalEntriesCollapsed, setIsJournalEntriesCollapsed] = useState(false)
  const [isBasicDetailsCollapsed, setIsBasicDetailsCollapsed] = useState(false)

  // ── Payment / header fields ───────────────────────────────────────────────
  const [modeOfPayment, setModeOfPayment] = useState('')
  const [modeSearch, setModeSearch] = useState('')
  const [bankName, setBankName] = useState('')
  const [checkNumber, setCheckNumber] = useState('')
  const [documentReference, setDocumentReference] = useState('')
  const [collectionDate, setCollectionDate] = useState('')
  const [remarks, setRemarks] = useState('')

  const [attachments, setAttachments] = useState([])

  const [toast, setToast] = useState(null)
  const [imageModal, setImageModal] = useState({ isOpen: false, imageSrc: '' })

  // ── Sales invoice modal ───────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [salesData, setSalesData] = useState([])
  const [salesDataLoading, setSalesDataLoading] = useState(false)
  const [salesDataError, setSalesDataError] = useState('')
  const [selectedSales, setSelectedSales] = useState([])

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
    try {
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')

      const payload = {
        ...customerForm,
        tin: customerForm.tin?.replace(/\D/g, '').slice(0, 14),
        contact: customerForm.contact?.slice(0, 15),
      }
      const res = await fetch(`${import.meta.env.VITE_SERVER_LINK}/customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP error! status: ${res.status}`)
      }

      const result = await res.json()
      if (!result.success) {
        throw new Error(result.message || 'Failed to create customer')
      }

      await fetchCustomers()
      const createdCustomer = result.data
      setSelectedCustomer(createdCustomer.id || '')
      setCustomerSearch(createdCustomer.name || createdCustomer.code || '')
      setToast({
        type: 'success',
        message: `Customer "${createdCustomer.name || createdCustomer.code}" added successfully.`,
      })
      closeCustomerModal()
    } catch (err) {
      setToast({
        type: 'error',
        message: err.message || 'Failed to create customer',
      })
    }
  }

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
  const customerOptions = customers.map((c) => ({
    label: c.name || c.customer_name,
    sublabel: c.code,
    value: c.id,
  }))

  // ── Fetchers ──────────────────────────────────────────────────────────────
  const fetchCustomers = async () => {
    try {
      setCustomerLoading(true)
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(`${import.meta.env.VITE_SERVER_LINK}/customer`, {
        headers: { Authorization: `Bearer ${token}` },
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

  const fetchSalesData = async () => {
    try {
      setSalesDataLoading(true)
      setSalesDataError('')
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/collections/sales-collection/`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const result = await res.json()
      if (result.success) setSalesData(result.data || [])
      else setSalesDataError(result.message || 'Failed to fetch sales data')
    } catch (err) {
      setSalesDataError(err.message)
    } finally {
      setSalesDataLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
    fetchChartsOfAccounts()
  }, [])
  useEffect(() => {
    if (isModalOpen) {
      fetchSalesData()
      setSelectedSales([])
    }
  }, [isModalOpen])

  // Auto-fill form from preSelectedSales (To Be Collected feature)
  useEffect(() => {
    if (
      preSelectedSales &&
      preSelectedSales.length > 0 &&
      !isViewMode &&
      !isEditMode &&
      customers.length > 0
    ) {
      console.log('Auto-filling form from preSelectedSales:', preSelectedSales)
      console.log(
        'Auto-filling form from preSelectedSalesItems:',
        preSelectedSalesItems,
      )
      console.log('Available customers:', customers)

      // Set customer from first sale - find matching customer by name to get ID
      const firstSale = preSelectedSales[0]
      const customerName = firstSale.customer_name || firstSale.customer || ''
      console.log('Looking for customer with name:', customerName)

      const matchingCustomer = customers.find(
        (c) =>
          c.name === customerName ||
          c.customer_name === customerName ||
          c.code === customerName,
      )

      if (matchingCustomer) {
        console.log('Found matching customer:', matchingCustomer)
        setSelectedCustomer(matchingCustomer.id)
        setCustomerSearch(matchingCustomer.name || matchingCustomer.customer_name)
      } else {
        console.log('No matching customer found, using name as fallback')
        setSelectedCustomer('')
        setCustomerSearch(customerName)
      }

      // Use fetched sales items if available, otherwise create placeholder items
      if (preSelectedSalesItems && preSelectedSalesItems.length > 0) {
        console.log('Using fetched sales items')
        const items = preSelectedSalesItems.map((item, index) => {
          console.log('Processing sales item:', item)
          const gross = parseFloat(item.sales_price) || 0
          const discount = parseFloat(item.discount) || 0
          const vat = parseFloat(item.vat) || 0
          const wht = parseFloat(item.witholding_tax) || 0
          const amount = gross - discount + vat - wht
          console.log(
            `Calculated: gross=${gross}, discount=${discount}, vat=${vat}, wht=${wht}, amount=${amount}`,
          )
          return {
            id: `auto-${index}`,
            salesItemId: item.id,
            invoiceRef: item.document_reference || '',
            description: item.product_service_name || item.name || '',
            responsibilityCenter: item.responsibility_center || '',
            gross: gross,
            discAmt: discount,
            vatAmt: vat,
            whtAmount: wht,
            amount: amount,
            isOther: false,
          }
        })
        setCollectionItems(items)
        console.log('Auto-filled collection items from fetched data:', items)
      } else {
        console.warn('No sales items were returned for the selected sales')
        setCollectionItems([])
      }
    }
  }, [preSelectedSales, preSelectedSalesItems, isViewMode, isEditMode, customers])

  // Populate form with collection data when in view or edit mode
  useEffect(() => {
    if ((isViewMode || isEditMode) && collectionData) {
      console.log('Populating form with collection data:', collectionData)
      console.log('collectionData structure:', Object.keys(collectionData))
      console.log('collectionData items:', collectionData.items)
      console.log('collectionData journal:', collectionData.journal)

      // Populate basic collection info - handle different data structures
      let collection = null
      if (collectionData.data && collectionData.data.length > 0) {
        collection = collectionData.data[0]
        console.log('Using collectionData.data[0]:', collection)
      } else if (collectionData.data && collectionData.data.id) {
        collection = collectionData.data
        console.log('Using collectionData.data directly:', collection)
      } else if (collectionData.id) {
        collection = collectionData
        console.log('Using collectionData directly:', collection)
      } else if (typeof collectionData === 'object' && collectionData !== null) {
        collection = collectionData
        console.log('Using collectionData as direct object:', collection)
      }

      if (collection) {
        console.log('Setting collection fields:', {
          customer: collection.customer,
          doc_ref: collection.doc_ref,
          mode_of_payment: collection.mode_of_payment,
          bank_name: collection.bank_name,
          check_number: collection.check_number,
          collection_date: collection.collection_date,
          remarks: collection.remarks,
          id: collection.id,
        })

        // Based on the API response, use 'customer' for both ID and search
        setSelectedCustomer(collection.customer || '')
        setCustomerSearch(collection.customer || '')
        setDocumentReference(collection.doc_ref || '')
        setModeOfPayment(collection.mode_of_payment || '')
        setModeSearch(collection.mode_of_payment || '')
        setBankName(collection.bank_name || '')
        setCheckNumber(collection.check_number || '')
        setCollectionDate(collection.collection_date || '')
        setRemarks(collection.remarks || '')
      } else {
        console.warn('No collection data found in expected structure')
      }

      // Populate collection items
      if (collectionData.items && collectionData.items.length > 0) {
        console.log('Populating collection items:', collectionData.items)
        const items = collectionData.items.map((item) => ({
          id: item.id,
          salesItemId: item.sales_id,
          invoiceRef: item.invoice_ref || '',
          description: item.product_service_name || item.description || '',
          responsibilityCenter: item.responsibility_center || '',
          gross: parseFloat(item.gross) || 0,
          discAmt: parseFloat(item.discount) || 0,
          vatAmt: parseFloat(item.vat) || 0,
          whtAmount: parseFloat(item.witholding_tax) || 0,
          amount: parseFloat(item.amount) || 0,
          isOther: false,
        }))
        console.log('Setting collection items:', items)
        setCollectionItems(items)
      } else {
        console.log('No collection items found or empty array')
      }

      // Populate journal entries
      if (collectionData.journal && collectionData.journal.length > 0) {
        console.log('Populating journal entries:', collectionData.journal)
        const journal = collectionData.journal.map((entry) => ({
          id: entry.id,
          account: entry.charts_of_accounts_name,
          accountSearch: entry.charts_of_accounts_name,
          center: entry.responsibility_center || '',
          debit: entry.type === 'DEBIT' ? parseFloat(entry.amount) || 0 : 0,
          credit: entry.type === 'CREDIT' ? parseFloat(entry.amount) || 0 : 0,
          isManual: false,
        }))
        console.log('Setting journal entries:', journal)
        setJournalEntries(journal)
      } else {
        console.log('No journal entries found or empty array')
      }

      // Populate attachments
      if (collectionData.attachments && collectionData.attachments.length > 0) {
        console.log('Processing attachments:', collectionData.attachments)
        const attachments = collectionData.attachments.map((att) => {
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
        console.log('No attachments found or empty array')
      }
    } else {
      console.log('Not populating data - conditions not met:', {
        isViewMode,
        isEditMode,
        hasCollectionData: !!collectionData,
        collectionDataKeys: collectionData ? Object.keys(collectionData) : 'null',
      })
    }
  }, [isViewMode, isEditMode, collectionData])

  // ── Item helpers ──────────────────────────────────────────────────────────
  const removeCollectionItem = (id) =>
    setCollectionItems((prev) => prev.filter((i) => i.id !== id))
  const toggleSalesSelection = (saleId) =>
    setSelectedSales((prev) =>
      prev.includes(saleId) ? prev.filter((id) => id !== saleId) : [...prev, saleId],
    )

  // ── Add selected invoices → fetch their line items → map to collection items ──
  const handleAddSelectedSales = async () => {
    try {
      if (selectedSales.length === 0) {
        setToast({
          type: 'warning',
          message: 'Please select at least one sales invoice',
        })
        return
      }
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')

      const queryParams = new URLSearchParams()
      selectedSales.forEach((id) => queryParams.append('sales_id', id))

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/collections/sales-items-collection?${queryParams.toString()}`,
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
        throw new Error(result.message || 'Failed to fetch sales items')

      // ── Map sales_items → collection items ──────────────────────────────
      //  We compute amounts here so the accountant sees the full breakdown.
      //  vat IS included — it is part of ci_amount (Discounted + VAT − WHT).
      const newItems = result.data.map((s) => {
        const qty = parseFloat(s.quantity) || 0
        const price = parseFloat(s.sales_price) || 0
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
          salesItemId: s.id, // → ci_sales_id (now using sales item ID)
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

      // Clear existing collection items
      setCollectionItems([])
      // Add new items to collection
      setCollectionItems([...newItems])
      setIsModalOpen(false)
      setSelectedSales([])
      setToast({
        type: 'success',
        message: `${newItems.length} item(s) added from sales invoice`,
      })
    } catch (error) {
      console.error('Error adding selected sales:', error)
      setToast({ type: 'error', message: 'Error: ' + error.message })
    }
  }

  // ── Journal entry helpers ─────────────────────────────────────────────────
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
  const removeJournalEntry = (id) =>
    setJournalEntries((prev) => prev.filter((e) => e.id !== id))
  const updateJournalEntry = (id, field, value) =>
    setJournalEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    )

  // ── Attachment helpers ────────────────────────────────────────────────────
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
      },
    ])
  const removeAttachment = (id) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  const updateAttachment = (id, field, value) =>
    setAttachments((prev) =>
      prev.map((att) => (att.id === id ? { ...att, [field]: value } : att)),
    )
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

  const summary = computeSummary(collectionItems)

  // ── Auto-generate journal entries ─────────────────────────────────────────
  //
  //  Per item:
  //    CR  Accounts Receivable   gross      ← closes the full AR (asset decreases)
  //    DR  Sales Discounts       discAmt    ← discount expense
  //    DR  Creditable WHT        whtAmount  ← asset: BIR owes us later
  //
  //  One combined:
  //    DR  Cash / Bank           totalCash  ← actual money received
  //
  //  Balance proof per item:
  //    DR side = discAmt + whtAmount + (amount)
  //            = discAmt + whtAmt + (discounted + vatAmt − whtAmt)
  //            = discAmt + discounted + vatAmt
  //            = discAmt + (gross − discAmt) + vatAmt
  //            = gross + vatAmt   ← note: AR was originally booked at gross + vatAmt in the Sales JE
  //    CR side = gross + vatAmt  ✅
  // ─────────────────────────────────────────────────────────────────────────
  const generateJournalEntries = () => {
    if (collectionItems.length === 0) {
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

    const arAccount = chartsOfAccounts.find((a) =>
      (a.name || '').toLowerCase().includes('accounts receivable'),
    )

    let totalCash = 0

    collectionItems
      .filter((i) => !i.isOther)
      .forEach((item) => {
        totalCash += item.amount || 0

        // CR  Accounts Receivable — amount collected
        if (arAccount && item.amount > 0) {
          entries.push({
            id: Date.now() + Math.random(),
            account: arAccount.id,
            accountSearch: arAccount.name,
            center: item.responsibilityCenter || '',
            debit: 0,
            credit: parseFloat(item.amount.toFixed(2)),
            isManual: false,
          })
        }
      })

    // DR  Cash / Bank — one combined entry
    if (paymentAccount && totalCash > 0) {
      entries.push({
        id: Date.now() + Math.random(),
        account: paymentAccount.id,
        accountSearch: paymentAccount.name,
        center: '',
        debit: parseFloat(totalCash.toFixed(2)),
        credit: 0,
        isManual: false,
      })
    }

    setJournalEntries(entries)
  }

  useEffect(() => {
    // Only auto-generate journal entries when NOT in view mode
    if (!isViewMode) {
      generateJournalEntries()
    }
  }, [
    collectionItems,
    modeOfPayment,
    bankName,
    chartsOfAccounts,
    isViewMode,
    isEditMode,
  ])

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
      if (!selectedCustomer) {
        setToast({ type: 'warning', message: 'Please select a customer' })
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
      if (collectionItems.filter((i) => !i.isOther).length === 0) {
        setToast({
          type: 'warning',
          message: 'Please add at least one collection item from a sales invoice',
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

      // ── collection_items payload — ONLY what the DB schema stores ──
      //   ci_sales_id       → salesItemId
      //   ci_amount         → amount       (discounted + VAT − WHT)
      //   ci_witholding_tax → whtAmount
      const preparedItems = collectionItems
        .filter((item) => !item.isOther)
        .map((item) => ({
          sales_id: item.salesItemId,
          amount: item.amount,
          witholding_tax: item.whtAmount,
        }))

      const preparedJournalEntries = journalEntries.map((entry) => ({
        account_id: entry.account || '',
        responsibility_center: entry.center || '',
        debit: parseFloat(entry.debit) || 0,
        credit: parseFloat(entry.credit) || 0,
      }))

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
              name: att.fileName || '',
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

      // ── collections header payload — matches DB columns exactly ──
      // c_customer_id, c_document_reference, c_mode_of_payment,
      // c_bank_name, c_check_number, c_collection_date, c_remarks, c_created_by
      const requestPayload = {
        customer_id: selectedCustomer,
        document_reference: documentReference,
        mode_of_payment: modeOfPayment,
        bank_name: bankName || '',
        check_number: checkNumber || '',
        collection_date: collectionDate || new Date().toISOString().split('T')[0],
        remarks,
        total_amount_due: summary.totalCashCollected,
        collection_items: preparedItems,
        journal_entries: preparedJournalEntries,
        attachments: preparedAttachments,
      }

      // Add ID and updated_by for edit mode
      let collectionId = null
      if (isEditMode && collectionData) {
        collectionId = collectionData.data?.[0]?.id || collectionData.id
        if (collectionId) {
          requestPayload.id = collectionId
          requestPayload.updated_by = createdBy
        }
      } else {
        requestPayload.created_by = createdBy
      }

      const url =
        isEditMode && collectionId
          ? `${import.meta.env.VITE_SERVER_LINK}/collections/${collectionId}`
          : `${import.meta.env.VITE_SERVER_LINK}/collections`

      const method = isEditMode && collectionId ? 'PUT' : 'POST'

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
          message: `Collection ${action} successfully!`,
        }
        setToast(nextToast)
        if (onSuccess) await onSuccess(nextToast)
        onBack()
      } else {
        const action = isEditMode ? 'update' : 'post'
        setToast({
          type: 'error',
          message: result.message || `Failed to ${action} collection`,
        })
      }
    } catch (error) {
      console.error('Error posting collection:', error)
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
                  <h3 className="text-sm font-bold tracking-tight">
                    Financial Summary
                  </h3>
                </div>
                <span className="text-xs bg-zinc-900 text-zinc-100 px-2.5 py-0.5 rounded-full border border-zinc-800 font-mono font-semibold">
                  PHP (₱)
                </span>
              </div>

              {/* Financial Summary Items */}
              <div className="custom-table-scroller overflow-y-auto min-h-0 flex-1 custom-scrollbar p-3.5 py-2 space-y-1.5">
                {/* 1. Total Sales Price */}
                <SummaryRow
                  label="Total Sales Price:"
                  value={fmt(summary.totalGross)}
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
                  value={fmt(summary.totalGross - summary.totalDiscount)}
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

                {/* 5. Total Withholding Tax (-) */}
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
                    <TotalHeroAmount value={summary.totalCashCollected} fmt={fmt} />

                    <p className="text-xs text-red-100/90 mt-0.5 font-medium">
                      Amount to be collected
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
                    <h2 className="text-base font-bold tracking-tight">
                      Basic Details
                    </h2>
                  </div>
                  <button
                    onClick={() =>
                      setIsBasicDetailsCollapsed(!isBasicDetailsCollapsed)
                    }
                    className="text-white bg-red-600 hover:bg-red-700 p-2 rounded-lg transition-colors"
                    title={isBasicDetailsCollapsed ? 'Expand' : 'Collapse'}
                  >
                    {isBasicDetailsCollapsed ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronUp size={16} />
                    )}
                  </button>
                </div>
                {!isBasicDetailsCollapsed && (
                  <div className="p-4">
                    <div
                      className={`grid gap-4 ${modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-4'}`}
                    >
                      {/* Customer Selection */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Customer Name <span className="text-red-500">*</span>
                        </label>
                        {isViewMode ? (
                          <div className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800">
                            {customerSearch || 'No customer selected'}
                          </div>
                        ) : customerLoading ? (
                          <div className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800">
                            Loading customers...
                          </div>
                        ) : (
                          <SearchableDropdown
                            placeholder="Select Customer..."
                            value={customerSearch}
                            onChange={(v) => {
                              setCustomerSearch(v)
                              setSelectedCustomer('')
                            }}
                            onSelect={(opt) => {
                              setSelectedCustomer(opt.value)
                              setCustomerSearch(opt.label)
                            }}
                            options={customerOptions}
                            inputClassName={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${!customerSearch ? 'border-red-500' : 'border-zinc-300'}`}
                            emptyText={customerError || 'No customers found'}
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
                      </div>

                      {/* Reference Number */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Reference / Official Receipt No.
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. OR-100234"
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
                            options={modeOfPaymentOptions.map((m) => ({
                              label: m,
                              value: m,
                            }))}
                            inputClassName={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${!modeOfPayment ? 'border-red-500' : 'border-zinc-300'}`}
                            emptyText="No modes found"
                          />
                        )}
                      </div>

                      {/* Collection Date */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Collection Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={collectionDate}
                          onChange={(e) => setCollectionDate(e.target.value)}
                          disabled={isViewMode}
                          className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''} ${!collectionDate ? 'border-red-500' : 'border-zinc-300'}`}
                        />
                      </div>

                      {/* Bank Name (conditional) */}
                      {(modeOfPayment === 'CHECK' ||
                        modeOfPayment === 'BANK_TRANSFER') && (
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
                            className={`w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                          />
                        </div>
                      )}

                      {/* Check Number (conditional) */}
                      {(modeOfPayment === 'CHECK' ||
                        modeOfPayment === 'BANK_TRANSFER') && (
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
                            className={`w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
              {/* 1. COLLECTION ITEMS */}
              <section className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-zinc-900 text-white flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-semibold text-sm">
                      <Receipt size={14} />
                    </div>
                    <div>
                      <h2 className="text-base font-bold tracking-tight">
                        Collection Items
                      </h2>
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
                      onClick={() =>
                        setIsCollectionItemsCollapsed(!isCollectionItemsCollapsed)
                      }
                      className="text-white bg-red-600 hover:bg-red-700 p-2 rounded-lg transition-colors"
                      title={isCollectionItemsCollapsed ? 'Expand' : 'Collapse'}
                    >
                      {isCollectionItemsCollapsed ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronUp size={16} />
                      )}
                    </button>
                  </div>
                </div>

                {!isCollectionItemsCollapsed && (
                  <>
                    <div className="overflow-x-auto custom-scrollbar">
                      <table
                        className="w-full text-left text-xs text-slate-600"
                        style={{ tableLayout: 'fixed', minWidth: 860 }}
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
                        <thead className="bg-zinc-100 border-b border-zinc-200 uppercase font-bold text-zinc-700 tracking-wider">
                          <tr>
                            <th className="py-3 px-3 min-w-[180px] text-center">
                              Invoice Ref
                            </th>
                            <th className="py-3 px-2 min-w-[120px] text-center">
                              Product/Service
                            </th>
                            <th className="py-3 px-2 min-w-[150px] text-center">
                              Gross Amt
                            </th>
                            <th className="py-3 px-2 w-16 text-center">Discount</th>
                            <th className="py-3 px-2 w-28 text-center">VAT</th>
                            <th className="py-3 px-2 w-24 text-center">WHT</th>
                            <th className="py-3 px-2 w-20 text-center">
                              Amount Due
                            </th>
                            <th className="py-3 px-2 w-20 text-center">
                              Resp. Center
                            </th>
                            <th className="py-3 px-2 w-10 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {collectionItems.map((item) => (
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
                                {item.product_service_name ||
                                  item.description ||
                                  '—'}
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
                                    onClick={() => removeCollectionItem(item.id)}
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
                    {!isViewMode && !isEditMode && (
                      <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
                        <button
                          onClick={() => setIsModalOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-500 border-dashed text-xs font-bold rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                        >
                          <Plus size={12} /> Add Sales Items
                        </button>
                        <span className="text-xs text-zinc-500 font-medium">
                          {collectionItems.length}{' '}
                          {collectionItems.length === 1 ? 'item' : 'items'}
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
                      <h2 className="text-base font-bold tracking-tight">
                        Journal Entries
                      </h2>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-800 text-zinc-100 border border-zinc-700`}
                      >
                        {isBalanced ? 'Balanced' : 'Unbalanced'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setIsJournalEntriesCollapsed(!isJournalEntriesCollapsed)
                    }
                    className="text-white bg-red-600 hover:bg-red-700 p-2 rounded-lg transition-colors"
                    title={isJournalEntriesCollapsed ? 'Expand' : 'Collapse'}
                  >
                    {isJournalEntriesCollapsed ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronUp size={16} />
                    )}
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
                            <th className="py-2.5 px-3 text-center">
                              Chart of Account
                            </th>
                            <th className="py-2.5 px-3 text-center w-32">
                              Debit (₱)
                            </th>
                            <th className="py-2.5 px-3 text-center w-32">
                              Credit (₱)
                            </th>
                            <th className="py-2.5 px-3 text-center">
                              Responsibility Center
                            </th>
                            <th className="py-2.5 px-3 w-10 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {journalEntries.length === 0 ? (
                            <tr>
                              <td
                                colSpan={5}
                                className="py-6 text-[12px] text-gray-400 text-center"
                              >
                                Journal entries auto-generate once items are added
                                and mode of payment is selected.
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
                                      updateJournalEntry(
                                        entry.id,
                                        'accountSearch',
                                        v,
                                      )
                                    }
                                    onSelect={(opt) => {
                                      updateJournalEntry(
                                        entry.id,
                                        'account',
                                        opt.value,
                                      )
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
                                    readOnly={!entry.isManual}
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
                        <tfoot className="bg-slate-50 font-semibold text-slate-900 border-t border-slate-200">
                          <tr>
                            <td
                              colSpan={2}
                              className="py-2.5 px-3 text-right text-xs"
                            >
                              Total Ledger Balance:
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-700 text-xs">
                              {fmt(totalDebit)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-700 text-xs">
                              {fmt(totalCredit)}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    {!isViewMode && (
                      <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
                        <button
                          onClick={addJournalEntry}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-500 border-dashed text-xs font-bold rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                        >
                          <Plus size={12} /> Add Ledger Row
                        </button>
                        <span className="text-xs text-zinc-500 font-medium">
                          {journalEntries.length}{' '}
                          {journalEntries.length === 1 ? 'entry' : 'entries'}
                        </span>
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
                      <h2 className="text-sm font-bold tracking-tight">
                        Attachments
                      </h2>
                    </div>
                    <span className="text-xs text-zinc-400 font-medium">
                      {attachments.length}{' '}
                      {attachments.length === 1 ? 'File' : 'Files'}
                    </span>
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
                            {['File Name', 'File', 'Remarks', 'Uploaded By', ''].map(
                              (h, i) => (
                                <th
                                  key={i}
                                  className="pb-3 text-[12px] font-black uppercase text-gray-900 tracking-tighter text-center px-1"
                                >
                                  {h}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {attachments.map((file) => (
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
                      <h2 className="text-sm font-bold tracking-tight">
                        Remarks & Internal Notes
                      </h2>
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

      {/* ── SALES INVOICE MODAL ── */}
      <RightSideModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Select Sales Invoices"
        size="3xl"
      >
        <div className="space-y-4">
          <p className="text-[12px] text-gray-500 font-semibold">
            Select outstanding sales invoices to collect. Their line items will be
            fetched and amounts auto-computed (Discounted + VAT − WHT).
          </p>

          {salesDataLoading ? (
            <div className="p-8 bg-gray-50 rounded-xl border border-gray-200 text-center">
              <p className="text-[12px] text-gray-400 font-bold animate-pulse">
                Loading sales invoices…
              </p>
            </div>
          ) : salesDataError ? (
            <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-center">
              <p className="text-[12px] text-red-600 font-bold">{salesDataError}</p>
            </div>
          ) : salesData.length === 0 ? (
            <div className="p-8 bg-gray-50 rounded-xl border border-gray-200 text-center">
              <p className="text-[12px] text-gray-400 font-bold">
                No outstanding sales invoices found.
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
                        'Customer',
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
                    {salesData.map((sale, idx) => {
                      const isChecked = selectedSales.includes(sale.id)
                      return (
                        <tr
                          key={sale.id}
                          onClick={() => toggleSalesSelection(sale.id)}
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
                                onChange={() => toggleSalesSelection(sale.id)}
                                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                              />
                            </div>
                          </td>
                          <td
                            className="px-4 py-3 text-center text-[12px] font-bold text-gray-900 truncate"
                            title={sale.customer}
                          >
                            {sale.customer || '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-[11px] font-mono font-bold text-gray-700">
                            {sale.doc_ref || '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-[11px] font-bold text-gray-500 uppercase">
                            {sale.terms || '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-[11px] font-mono text-gray-600">
                            {sale.date_due || '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-[12px] font-black tabular-nums text-gray-900">
                            {parseFloat(sale.amount_due || 0).toLocaleString(
                              'en-PH',
                              { minimumFractionDigits: 2 },
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 text-[10px] font-black rounded-full border ${
                                sale.status === 'COLLECTED'
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : sale.status === 'PARTIALLY COLLECTED'
                                    ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                    : sale.status === 'NOT COLLECTED'
                                      ? 'bg-red-50 text-red-700 border-red-200'
                                      : 'bg-gray-50 text-gray-600 border-gray-200'
                              }`}
                            >
                              {sale.status || 'UNKNOWN'}
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

          {selectedSales.length > 0 && (
            <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-center">
              <p className="text-[11px] font-black text-red-600 uppercase tracking-wide">
                {selectedSales.length} invoice{selectedSales.length > 1 ? 's' : ''}{' '}
                selected
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => {
                setIsModalOpen(false)
                setSelectedSales([])
              }}
              className="px-4 py-2 bg-gray-100 text-gray-600 text-[12px] font-black rounded-lg hover:bg-gray-200 transition-colors uppercase"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSelectedSales}
              disabled={selectedSales.length === 0}
              className={`px-6 py-2 text-[12px] font-black rounded-lg uppercase tracking-wider transition-colors ${
                selectedSales.length === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-200'
              }`}
            >
              Add {selectedSales.length > 0 ? `(${selectedSales.length})` : ''}{' '}
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
      <div className="flex items-center justify-between p-4 pb-2">
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

const SummaryRow = ({
  label,
  value,
  badge,
  badgeColor = 'text-zinc-400',
  valuePrefix = '',
  textColor = 'text-zinc-900',
  containerClassName = 'py-1 border-b border-zinc-500',
  isNested = false,
}) => {
  const strVal = String(value || '')

  const getValueFontSize = (len) => {
    if (len > 24) return 'text-xs'
    if (len > 18) return 'text-sm'
    return 'text-sm sm:text-base'
  }

  return (
    <div
      className={`flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 w-full min-w-0 ${containerClassName}`}
    >
      {/* Label & Badge */}
      <div className="flex items-center gap-1 min-w-max">
        <span
          className={`font-bold text-zinc-800 ${isNested ? 'text-xs' : 'text-sm'}`}
        >
          {label}
        </span>
        {badge && <span className={`text-xs font-bold ${badgeColor}`}>{badge}</span>}
      </div>

      {/* Value */}
      <div className="flex-1 flex justify-end min-w-max text-right">
        <span
          className={`font-extrabold font-mono tracking-tight whitespace-nowrap ml-auto ${textColor} ${getValueFontSize(
            strVal.length,
          )}`}
        >
          {valuePrefix && <span className="mr-0.5">{valuePrefix}</span>}
          <span className="text-emerald-600 font-extrabold mr-1">₱</span>
          <span>{strVal}</span>
        </span>
      </div>
    </div>
  )
}

const TotalHeroAmount = ({ value, fmt }) => {
  const formattedVal = fmt(value)
  const len = String(formattedVal || '').length

  const getHeroFontSize = (charCount) => {
    if (charCount > 25) return 'text-sm'
    if (charCount > 18) return 'text-base'
    if (charCount > 12) return 'text-xl'
    return 'text-2xl'
  }

  return (
    <div
      className={`font-black font-mono text-white tracking-tight drop-shadow-sm text-right whitespace-nowrap overflow-hidden transition-all duration-150 ${getHeroFontSize(
        len,
      )}`}
    >
      <span className="text-emerald-300 mr-1">₱</span>
      <span>{formattedVal}</span>
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
