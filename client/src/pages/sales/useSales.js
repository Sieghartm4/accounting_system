import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getItemResponsibilityCenter } from '../../utils/responsibilityCenterDefaults'
import {
  computeTotals,
  findMissingAutoAccounts,
  round2,
} from '../../utils/taxCalculations'
import { filterActiveMasterRows } from '../../utils/activeMasterFilter'
import { API } from '../../api/endpoints'
import { generateSalesPDF } from '../../utils/generateSalesPDF'
import { isPostedDocument, createReversal } from '../../utils/journalLifecycle'
import { getAccessLevel } from '../../utils/routeProtection'
import connectRealtime from '../../utils/realtimeSocket'
import { useNotificationsState } from '../../components/layout/NotificationContext'
import { buildUnreadDocCounts } from '../../hooks/useNotifications'

// Signature of everything that feeds the auto-generated journal entries. It is
// used to tell a real user edit apart from the initial form hydration so that
// loading an existing document never regenerates (and therefore rewrites) the
// stored journal rows.
const buildJournalGenerationSignature = (
  items,
  modeOfPayment = '',
  bankName = '',
) =>
  JSON.stringify({
    mode: modeOfPayment,
    bank: bankName,
    items: (items || []).map((item) => [
      item.id ?? null,
      item.productId ?? '',
      item.coa ?? item.accountId ?? '',
      item.description ?? '',
      item.qty ?? '',
      item.price ?? '',
      item.discount ?? '',
      item.discountType ?? '',
      item.vat ?? '',
      item.vatRate ?? '',
      item.vatType ?? 'VAT-EX',
      item.wht ?? '',
      item.whtRate ?? '',
      item.responsibilityCenter ?? '',
      item.isOther ?? false,
    ]),
  })

// vatType (EX/INC) is not persisted, so it is inferred on hydration by
// comparing the stored per-item income credit (grossEx) against both
// formulas: EX -> qty*price, INC -> qty*price/(1+rate).
const inferVatTypeFromJournal = (dbItem, journalRows) => {
  const rate = parseFloat(dbItem.vat_rate) || 0
  const gross =
    (parseFloat(dbItem.quantity) || 0) * (parseFloat(dbItem.sales_price) || 0)
  if (rate <= 0 || gross <= 0) return 'VAT-EX'

  const credits = (journalRows || []).filter(
    (entry) =>
      entry.type === 'CREDIT' &&
      Number(entry.coa_id ?? entry.charts_of_accounts_id) ===
        Number(dbItem.charts_of_accounts_id),
  )
  if (credits.length === 0) return 'VAT-EX'

  const exAmount = gross
  const incAmount = gross / (1 + rate / 100)
  const minDiff = (target) =>
    Math.min(...credits.map((e) => Math.abs((parseFloat(e.amount) || 0) - target)))

  return minDiff(incAmount) < minDiff(exAmount) - 0.005 ? 'VAT-INC' : 'VAT-EX'
}

export function useSales() {
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  // List-page state.
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [isAdding, setIsAdding] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isPostedEdit, setIsPostedEdit] = useState(false)
  const [editingSales, setEditingSales] = useState(null)
  const [isViewing, setIsViewing] = useState(false)
  const [viewingSales, setViewingSales] = useState(null)
  const [toast, setToast] = useState(null)
  const [isSequenceModalOpen, setIsSequenceModalOpen] = useState(false)
  const [pendingDateFrom, setPendingDateFrom] = useState('')
  const [pendingDateTo, setPendingDateTo] = useState('')
  const [activeDateFrom, setActiveDateFrom] = useState(null)
  const [activeDateTo, setActiveDateTo] = useState(null)
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    onConfirm: null,
    title: '',
    message: '',
  })
  const [activeFilter, setActiveFilter] = useState(null)
  const { markReadForDocument, items: notificationItems } = useNotificationsState()

  const showToast = (type, message) => setToast({ type, message })
  const closeToast = () => setToast(null)

  const unreadRowMap = useMemo(
    () => buildUnreadDocCounts(notificationItems, 'sales'),
    [notificationItems],
  )

  const openConfirmModal = ({ onConfirm, title, message, type = 'warning' }) =>
    setConfirmModal({
      isOpen: true,
      onConfirm,
      title,
      message,
      type,
    })

  const closeConfirmModal = () =>
    setConfirmModal((prev) => ({ ...prev, isOpen: false }))

  const confirmAndClose = () => {
    if (confirmModal.onConfirm) {
      confirmModal.onConfirm()
    }
    closeConfirmModal()
  }

  const salesRef = useRef([])
  const filterRef = useRef({ dateFrom: null, dateTo: null })

  const prependSales = useCallback((sale) => {
    if (!sale || !sale.id) return

    setSales((prev) => {
      if (prev.some((row) => row.id === sale.id)) {
        return prev
      }
      const next = [sale, ...prev]
      salesRef.current = next
      return next
    })
  }, [])

  const LIMIT = 50

  const fetchSales = async (offset = 0, append = false, filters = {}) => {
    if (!append) {
      setLoading(true)
      setError(null)
    } else {
      setLoadingMore(true)
    }

    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authorization token found')

      const params = new URLSearchParams()
      params.append('offset', offset)
      params.append('limit', LIMIT)

      let queryDateFrom =
        filters.dateFrom !== undefined
          ? filters.dateFrom
          : filterRef.current.dateFrom
      let queryDateTo =
        filters.dateTo !== undefined ? filters.dateTo : filterRef.current.dateTo

      if (filters.dateFrom !== undefined || filters.dateTo !== undefined) {
        filterRef.current = {
          dateFrom: queryDateFrom,
          dateTo: queryDateTo,
        }
      }

      if (queryDateFrom) params.append('dateFrom', queryDateFrom)
      if (queryDateTo) params.append('dateTo', queryDateTo)

      const response = await fetch(
        `${API.sales()}?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch sales')
      }

      const data = Array.isArray(result.data) ? result.data : []

      if (append) {
        const next = [...(salesRef.current || []), ...data]
        salesRef.current = next
        setSales(next)
      } else {
        salesRef.current = data
        setSales(data)
      }

      setHasMore(Boolean(result.hasMore))
    } catch (err) {
      setError(err.message || 'Failed to load sales')
      if (!append) setSales([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const refetchSales = async (filters = {}) => fetchSales(0, false, filters)

  const loadMore = async (filters = {}) =>
    fetchSales(salesRef.current.length || 0, true, filters)

  useEffect(() => {
    refetchSales()
  }, [])

  // Deep-link to a single sale (?id=...).
  useEffect(() => {
    const id = searchParams.get('id')
    if (!id) return

    const fetchSales = async () => {
      try {
        const token = sessionStorage.getItem('authenticated')
        if (!token) throw new Error('No authentication token found')

        const response = await fetch(
          API.salesById(id),
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        )

        const result = await response.json()
        if (!response.ok)
          throw new Error(result.message || 'Failed to fetch sales details')

        setViewingSales(result)
        setIsViewing(true)
        markReadForDocument('sales', [id])
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete('id')
            return next
          },
          { replace: true },
        )
      } catch (err) {
        showToast('error', err.message || 'Failed to fetch sales details')
      }
    }

    fetchSales()
  }, [searchParams, setSearchParams, markReadForDocument])

  // Realtime prepend.
  useEffect(() => {
    const close = connectRealtime({
      onMessage: (type, data) => {
        if (type === 'sales_created' && data?.sale) {
          prependSales(data.sale)
        }
      },
      onError: (err) => console.error('Sales realtime error', err),
    })

    return close
  }, [prependSales])

  // Access-gated checkbox visibility.
  const user = JSON.parse(sessionStorage.getItem('auth_user') || '{}')
  const accessLevel = getAccessLevel('sales', user)
  const enableCheckboxes =
    accessLevel === 'Check Access' ||
    accessLevel === 'Approve Access' ||
    accessLevel === 'Edit Access' ||
    accessLevel === 'Full Access'

  // Filtering + totals.
  const filteredSales = useMemo(() => {
    if (!activeFilter) return sales

    switch (activeFilter) {
      case 'PREPARED':
        return sales?.filter((s) => s.state === 'PREPARED') || []
      case 'CHECKED':
        return sales?.filter((s) => s.state === 'CHECKED') || []
      case 'CANCELLED':
        return sales?.filter((s) => s.state === 'CANCELLED') || []
      case 'APPROVED':
        return sales?.filter((s) => s.state === 'APPROVED') || []
      default:
        return sales
    }
  }, [sales, activeFilter])

  const filteredTotalAmount = useMemo(
    () =>
      filteredSales?.reduce((sum, s) => sum + (parseFloat(s.amount_due) || 0), 0) ||
      0,
    [filteredSales],
  )

  // Date filters.
  const applyDateFilters = async () => {
    const from = pendingDateFrom || null
    const to = pendingDateTo || null
    setActiveDateFrom(from)
    setActiveDateTo(to)
    await refetchSales({ dateFrom: from, dateTo: to })
  }

  const clearDateFilters = async () => {
    setPendingDateFrom('')
    setPendingDateTo('')
    setActiveDateFrom(null)
    setActiveDateTo(null)
    await refetchSales({ dateFrom: null, dateTo: null })
  }

  // Sequence modal wiring.
  const openSequenceModal = () => setIsSequenceModalOpen(true)
  const closeSequenceModal = () => setIsSequenceModalOpen(false)
  const handleSequenceSaved = () =>
    showToast('success', 'Sequence updated. New documents will use it.')

  // PDF generation helper.
  const fetchAndDownloadPDF = async (selectedRows, copyType) => {
    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authentication token found')

      const salesIds = selectedRows
        .map((row) => encodeURIComponent(String(row.id)))
        .join(',')

      const response = await fetch(
        `${API.salesPrint(salesIds)}?copyType=${copyType}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const result = await response.json()
      if (!response.ok)
        throw new Error(result.message || 'Failed to fetch sales for printing')

      const data = result.data || []
      if (!Array.isArray(data))
        throw new Error('Invalid data format received from server')

      await generateSalesPDF(data, copyType)

      showToast(
        'success',
        `${data.length} sales PDF(s) downloaded (${copyType === 'customer' ? 'Customer' : 'Internal'} Copy)`,
      )
    } catch (err) {
      console.error('Error generating sales PDF:', err)
      showToast('error', err.message || 'Failed to generate PDF')
    }
  }

  // Bulk checkbox actions.
  const handleApproveSelected = async (selectedRows) => {
    const validRows = selectedRows.filter(
      (row) => row.state === 'PREPARED' || row.state === 'CHECKED',
    )

    if (validRows.length === 0) {
      showToast(
        'warning',
        'Only PREPARED or CHECKED sales can be bulk approved. Please select valid rows.',
      )
      return
    }

    openConfirmModal({
      onConfirm: async () => {
        try {
          const token = sessionStorage.getItem('authenticated')
          if (!token) {
            throw new Error('No authentication token found')
          }

          const updates = validRows.map((row) => ({
            id: row.id,
            currentState: row.state,
          }))

          const response = await fetch(
            API.salesState(),
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ updates }),
            },
          )

          const result = await response.json()

          if (!response.ok) {
            throw new Error(result.message || 'Failed to approve sales')
          }

          await refetchSales()

          showToast(
            'success',
            result.message ||
              `${validRows.length} sale(s) approved successfully`,
          )
          markReadForDocument(
            'sales',
            validRows.map((row) => row.id),
          )
        } catch (err) {
          console.error('Error approving sales:', err)
          showToast('error', err.message || 'Failed to approve sales')
        }
      },
      title: 'Approve Sales',
      message: `Are you sure you want to approve ${validRows.length} sale(s)?`,
    })
  }

  const handleCancelSelected = async (selectedRows) => {
    const validRows = selectedRows.filter(
      (row) =>
        row.state !== 'CANCELLED' && row.state !== 'REJECTED' && row.state !== 'APPROVED',
    )

    if (validRows.length === 0) {
      showToast(
        'warning',
        'Only sales not already CANCELLED, REJECTED or APPROVED can be cancelled. Please select valid rows.',
      )
      return
    }

    openConfirmModal({
      onConfirm: async () => {
        try {
          const token = sessionStorage.getItem('authenticated')
          if (!token) {
            throw new Error('No authentication token found')
          }

          const updates = validRows.map((row) => ({
            id: row.id,
            currentState: row.state,
          }))

          const response = await fetch(
            API.salesCancelState(),
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ updates }),
            },
          )

          const result = await response.json()

          if (!response.ok) {
            throw new Error(result.message || 'Failed to cancel sales')
          }

          await refetchSales()

          showToast(
            'success',
            result.message ||
              `${validRows.length} sale(s) cancelled successfully`,
          )
          markReadForDocument(
            'sales',
            validRows.map((row) => row.id),
          )
        } catch (err) {
          console.error('Error cancelling sales:', err)
          showToast('error', err.message || 'Failed to cancel sales')
        }
      },
      title: 'Cancel Sales',
      message: `Are you sure you want to cancel ${validRows.length} sale(s)?`,
      type: 'danger',
    })
  }

  // Row actions.
  const handleViewSales = async (row) => {
    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(
        API.salesById(row.id),
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.message || 'Failed to fetch sales details',
        )
      }

      // Set sales data for viewing
      setViewingSales(result)
      setIsViewing(true)
      markReadForDocument('sales', [row.id])
    } catch (err) {
      console.error('Error fetching sales details:', err)
      showToast('error', err.message || 'Failed to fetch sales details')
    }
  }

  const handleEditSales = async (row) => {
    try {
      setIsPostedEdit(isPostedDocument(row.state))

      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(
        API.salesById(row.id),
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.message || 'Failed to fetch sales details',
        )
      }

      // Set sales data for editing
      setEditingSales(result)
      setIsEditing(true)
      markReadForDocument('sales', [row.id])
    } catch (err) {
      console.error('Error fetching sales details for editing:', err)
      showToast('error', err.message || 'Failed to fetch sales details')
    }
  }

  const handleReverseSales = (row) => {
    if (!isPostedDocument(row.state)) {
      showToast(
        'error',
        `Only APPROVED/POSTED transactions can be reversed (current: ${row.state}).`,
      )
      return
    }

    openConfirmModal({
      onConfirm: async () => {
        try {
          const reversed = await createReversal({
            dbName: 'sales',
            dbId: row.id,
            remarks: 'Reversal initiated from the Sales module',
          })
          showToast('success', reversed.message || 'Reversal created')
          markReadForDocument('sales', [row.id])
          navigate('/adjustments')
          await refetchSales()
        } catch (err) {
          console.error('Error creating sales reversal:', err)
          showToast('error', err.message || 'Failed to create reversal')
        }
      },
      title: 'Reverse Sales',
      message: `Create a REVERSAL for SALES ${row.id}? The original transaction stays unchanged; the reversal (DR/CR mirrored) is created as a PREPARED adjustment and must be approved before it posts to the general journal.`,
      type: 'danger',
    })
  }

  // Form-return wiring.
  const startAdding = () => setIsAdding(true)

  const closeAdding = () => setIsAdding(false)

  const closeEditing = () => {
    setIsEditing(false)
    setIsPostedEdit(false)
  }

  const closeViewing = () => setIsViewing(false)

  const handleFormSuccess = async (nextToast) => {
    if (nextToast) setToast(nextToast)
    await refetchSales()
    setIsAdding(false)
    setIsEditing(false)
    setIsPostedEdit(false)
    setIsViewing(false)
  }

  return {
    sales,
    loading,
    loadingMore,
    hasMore,
    error,
    refetchSales,
    loadMore,
    prependSales,
    isAdding,
    startAdding,
    closeAdding,
    isEditing,
    editingSales,
    isPostedEdit,
    closeEditing,
    isViewing,
    viewingSales,
    closeViewing,
    handleFormSuccess,
    toast,
    closeToast,
    isSequenceModalOpen,
    openSequenceModal,
    closeSequenceModal,
    handleSequenceSaved,
    pendingDateFrom,
    pendingDateTo,
    setPendingDateFrom,
    setPendingDateTo,
    activeDateFrom,
    activeDateTo,
    applyDateFilters,
    clearDateFilters,
    confirmModal,
    closeConfirmModal,
    confirmAndClose,
    unreadRowMap,
    enableCheckboxes,
    activeFilter,
    setActiveFilter,
    filteredSales,
    filteredTotalAmount,
    fetchAndDownloadPDF,
    handleApproveSelected,
    handleCancelSelected,
    handleViewSales,
    handleEditSales,
    handleReverseSales,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────
export function computeSummary(items, journalEntries = []) {
  const { totals } = computeTotals(items)

  let totalJournalDebit = 0
  let totalJournalCredit = 0

  journalEntries.forEach((entry) => {
    totalJournalDebit += parseFloat(entry.debit) || 0
    totalJournalCredit += parseFloat(entry.credit) || 0
  })

  return {
    totalSalesPrice: totals.gross,
    totalDiscount: totals.discount,
    totalDiscounted: totals.discounted,
    totalVAT: totals.vat,
    vatableSales: totals.vatableSales,
    vatExemptSales: totals.vatExemptSales,
    zeroRatedSales: totals.zeroRatedSales,
    totalNoVatDiscount: totals.discountOnVatable,
    totalNetOfVat: totals.netOfVat,
    totalWHT: totals.wht,
    totalAmountDue: totals.amountDue,
    totalJournalDebit,
    totalJournalCredit,
  }
}

export const fmt = (n) =>
  n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ─────────────────────────────────────────────────────────────────────────────
// Drag to Scroll Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useDragToScroll() {
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
      const walk = (x - startX) * 2
      element.scrollLeft = scrollLeft - walk
    }

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
// Main Sales Form Hook
// ─────────────────────────────────────────────────────────────────────────────
export default function useSalesForm({
  isViewMode,
  isEditMode,
  salesData,
  onBack,
  onSuccess,
} = {}) {
  const [salesItems, setSalesItems] = useState([])
  const [journalEntries, setJournalEntries] = useState([
    { id: 1, account: '', accountSearch: '', center: '', debit: 0, credit: 0 },
  ])

  const [customers, setCustomers] = useState([])
  const [customerLoading, setCustomerLoading] = useState(false)
  const [customerError, setCustomerError] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')

  const [vendors, setVendors] = useState([])
  const [vendorLoading, setVendorLoading] = useState(false)
  const [vendorError, setVendorError] = useState('')
  const [selectedVendor, setSelectedVendor] = useState('')
  const [vendorSearch, setVendorSearch] = useState('')

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
  const lastJournalGenerationRef = useRef(null)
  const pendingJournalHydrationRef = useRef(null)
  const journalHydrationSettledRef = useRef(true)

  // ── Derived option arrays ──────────────────────────────────────────────────
  // Inactive masters are hidden from the dropdowns, but anything already
  // referenced by the loaded items stays visible (edit/view mode).
  const referencedMasterIds = salesItems
    .flatMap((item) => [item.coa, item.productId, item.vat, item.wht])
    .filter((v) => v !== '' && v !== null && v !== undefined)
    .map(String)

  const coaOptions = filterActiveMasterRows(
    chartsOfAccounts,
    referencedMasterIds,
  ).map((a) => ({
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
  const productOptions = filterActiveMasterRows(
    products,
    referencedMasterIds,
  ).map((p) => ({
    label: p.name || p.product_name,
    sublabel: p.type || p.product_type || p.code || p.product_code,
    value: p.id,
  }))

  // ── Fetch functions ────────────────────────────────────────────────────────
  const fetchVendors = async () => {
    try {
      setVendorLoading(true)
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(API.vendors(), {
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
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(API.customer(), {
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

  const createCustomer = async ({
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
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(API.customer(), {
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
        throw new Error(result.message || 'Failed to create customer')
      }
      await fetchCustomers()
      return { success: true, data: result.data }
    } catch (err) {
      return { success: false, message: err.message }
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
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(API.productService(), {
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

  const fetchChartsOfAccounts = async () => {
    try {
      setCoaLoading(true)
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(API.chartsOfAccounts(), {
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
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(API.productService(), {
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
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(API.vat(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const result = await res.json()
      if (result.success) {
        setVatOptions(
          result.data.map((vat) => ({
            label: `${vat.code} - ${vat.name}`,
            value: vat.id,
            rate: parseFloat(vat.rate),
            code: vat.code,
            name: vat.name,
            status: vat.status,
          })),
        )
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
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(API.withholdingTax(), {
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
        setWhtOptions(
          result.data.map((wht) => ({
            label: `${wht.code} - ${wht.name}`,
            value: wht.id,
            rate: parseFloat(wht.rate),
            code: wht.code,
            name: wht.name,
            status: wht.status,
          })),
        )
      } else {
        setWhtError(result.message || 'Failed to fetch WHT data')
      }
    } catch (err) {
      setWhtError(err.message)
    } finally {
      setWhtLoading(false)
    }
  }

  const loadVatOnDemand = async () => {
    if (vatOptions.length === 0 && !vatLoading) await fetchVat()
  }

  const loadWhtOnDemand = async () => {
    if (whtOptions.length === 0 && !whtLoading) await fetchWht()
  }

  // ── Item / entry / attachment mutators ────────────────────────────────────
  const addSalesItem = (isOther = false, defaultResponsibilityCenter = '') => {
    if (vatOptions.length === 0 && !vatLoading) {
      loadVatOnDemand()
    }
    if (whtOptions.length === 0 && !whtLoading) {
      loadWhtOnDemand()
    }

    // Leave VAT/WHT blank for new rows; defaults applied only on submit
    setSalesItems((prev) => [
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

  const removeSalesItem = (id) =>
    setSalesItems((prev) => prev.filter((i) => i.id !== id))
  const removeJournalEntry = (id) =>
    setJournalEntries((prev) => prev.filter((e) => e.id !== id))

  const updateSalesItem = (id, field, value) =>
    setSalesItems((prev) =>
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

  // ── Utilities ─────────────────────────────────────────────────────────────
  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result)
      reader.onerror = (error) => reject(error)
    })

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

  const buildAutoJournalEntries = (defaultResponsibilityCenter = '') => {
    const entries = []
    const { lines, totals } = computeTotals(salesItems)

    const getAccountName = (account) =>
      (account.name || account.account_name || '').toLowerCase()
    const findAccount = (terms) =>
      chartsOfAccounts.find((a) =>
        terms.some((term) => getAccountName(a).includes(term)),
      )

    // Discount/VAT math comes from computeTotals (shared calculator):
    // - income is credited at the pre-discount tax-exclusive amount (grossEx)
    // - output VAT is on the discounted (net) base
    // - AR settles at the discounted total, so the standalone Sales
    //   Discounts debit keeps the entry balanced:
    //   settled + discountBook + wht = grossEx + vat
    const totalSettled = round2(
      totals.grossEx + totals.vat - totals.discountBook - totals.wht,
    )

    // 1. Accounts Receivable (DEBIT) - discounted total net of WHT
    const arAccount = findAccount(['accounts receivable'])
    if (arAccount && totalSettled > 0) {
      entries.push({
        id: Date.now() + Math.random(),
        account: arAccount.id,
        accountSearch: arAccount.name || arAccount.account_name || '',
        center: getItemResponsibilityCenter(
          salesItems[0],
          defaultResponsibilityCenter,
        ),
        debit: totalSettled,
        credit: 0,
        isManual: false,
      })
    }

    // 2. Sales Discounts (DEBIT)
    if (totals.discountBook > 0) {
      const discountAccount = findAccount(['sales discounts'])
      if (discountAccount) {
        entries.push({
          id: Date.now() + Math.random(),
          account: discountAccount.id,
          accountSearch: discountAccount.name || discountAccount.account_name || '',
          center: getItemResponsibilityCenter(
            salesItems[0],
            defaultResponsibilityCenter,
          ),
          debit: totals.discountBook,
          credit: 0,
          isManual: false,
        })
      }
    }

    // 3. Creditable Withholding Tax (DEBIT)
    if (totals.wht > 0) {
      const whtAccount = findAccount([
        'creditable withholding tax',
        'creditable witholding tax',
      ])
      if (whtAccount) {
        entries.push({
          id: Date.now() + Math.random(),
          account: whtAccount.id,
          accountSearch: whtAccount.name || whtAccount.account_name || '',
          center: getItemResponsibilityCenter(
            salesItems[0],
            defaultResponsibilityCenter,
          ),
          debit: totals.wht,
          credit: 0,
          isManual: false,
        })
      }
    }

    // 4. Income (CREDIT) - per item at pre-discount tax-exclusive amount
    lines.forEach(({ item, f }) => {
      if (item.coa && f.grossEx > 0) {
        const selectedCoa = chartsOfAccounts.find((a) => a.id === item.coa)
        if (selectedCoa) {
          entries.push({
            id: Date.now() + Math.random(),
            account: selectedCoa.id,
            accountSearch: selectedCoa.name || selectedCoa.account_name || '',
            center: getItemResponsibilityCenter(item, defaultResponsibilityCenter),
            debit: 0,
            credit: f.grossEx,
            isManual: false,
          })
        }
      }
    })

    // 5. Output VAT (CREDIT) - on the discounted (net) base
    if (totals.vat > 0) {
      const outputVatAccount = findAccount(['output vat'])
      if (outputVatAccount) {
        entries.push({
          id: Date.now() + Math.random(),
          account: outputVatAccount.id,
          accountSearch:
            outputVatAccount.name || outputVatAccount.account_name || '',
          center: getItemResponsibilityCenter(
            salesItems[0],
            defaultResponsibilityCenter,
          ),
          debit: 0,
          credit: totals.vat,
          isManual: false,
        })
      }
    }

    return entries
  }


  const regenerateJournalEntries = () => {
    const manualEntries = journalEntries.filter((e) => e.isManual)
    setJournalEntries([...buildAutoJournalEntries(''), ...manualEntries])
  }

  const handlePostTransaction = async () => {
    try {
      const userData = JSON.parse(sessionStorage.getItem('auth_user') || '{}')
      const createdBy = userData.mu_username || userData.username || 'Unknown User'

      if (!selectedCustomer) {
        setToast({ type: 'warning', message: 'Please select a customer' })
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

      const hasValidItems = salesItems.some((item) =>
        item.isOther
          ? item.description.trim() !== '' && item.coa !== ''
          : item.productId !== '',
      )
      if (!hasValidItems) {
        setToast({
          type: 'warning',
          message: 'Please add at least one valid sales item',
        })
        return
      }

      // Validate VAT-INC items have VAT selected
      const hasVatIncWithoutVat = salesItems.some(
        (item) => item.vatType === 'VAT-INC' && (!item.vat || item.vat === '' || item.vat === 0)
      )
      if (hasVatIncWithoutVat) {
        setToast({
          type: 'warning',
          message: 'Items with VAT Inclusive pricing must have a VAT rate selected',
        })
        return
      }

      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        setToast({
          type: 'error',
          message: 'No authorization token found. Please login again.',
        })
        return
      }

      // Guard: auto-generated entries reference standard accounts by name.
      // If one is missing the journal silently becomes unbalanced, so block
      // posting until the chart of accounts has them.
      const missingAccounts = findMissingAutoAccounts({
        items: salesItems,
        chartsOfAccounts,
        side: 'sales',
      })
      if (missingAccounts.length > 0) {
        setToast({
          type: 'error',
          message: `Missing chart of account(s): ${missingAccounts.join(', ')}. Add them before posting.`,
        })
        return
      }

      const summary = computeSummary(salesItems, journalEntries)
      if (Math.abs(summary.totalJournalDebit - summary.totalJournalCredit) > 0.01) {
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

      const preparedSalesItems = salesItems.map((item) => ({
        id: item.isNew ? undefined : item.id,
        product_id: item.isOther ? null : item.productId || null,
        account_id: item.coa || item.accountId,
        description: item.description,
        qty: item.isOther ? 1 : parseFloat(item.qty) || 0,
        price: parseFloat(item.price) || 0,
        discount: parseFloat(item.discount) || 0,
        discount_type: item.discountType || 'PERCENT',
        vat:
          parseInt(
            item.vat === '' || item.vat === null || item.vat === undefined
              ? defaultVatOpt?.value || 0
              : item.vat,
          ) || 0,
        wtax:
          parseInt(
            item.wht === '' || item.wht === null || item.wht === undefined
              ? defaultWhtOpt?.value || 0
              : item.wht,
          ) || 0,
        responsibility_center: item.responsibilityCenter || '',
      }))

      const preparedJournalEntries = journalEntries
        .filter((entry) => !entry.isOther)
        .map((entry) => ({
          account_id: entry.account || entry.accountId,
          responsibility_center: entry.center || '',
          debit: parseFloat(entry.debit) || 0,
          credit: parseFloat(entry.credit) || 0,
        }))

      const preparedAttachments = await Promise.all(
        attachments
          .filter((att) => att.file || att.fileName)
          .map(async (att) => ({
            id: att.id,
            fileName: att.fileName,
            file: att.file
              ? typeof att.file === 'string'
                ? att.file
                : await fileToBase64(att.file)
              : null,
            remarks: att.remarks,
            uploadedBy: att.uploadedBy,
            date: att.date,
          })),
      )

      const mainData = salesData?.data ? salesData.data[0] : salesData
      const salesId = mainData?.id

      const requestData = {
        customer_id: selectedCustomer,
        document_reference: documentReference,
        terms: `${termsNumber} ${termsOption}`,
        date_delivered: dateDelivered,
        date_due: dateDue,
        remarks,
        total_amount_due: summary.totalAmountDue,
        sales_items: preparedSalesItems,
        journal_entries: preparedJournalEntries,
        attachments: preparedAttachments,
      }

      if (isEditMode && salesId) {
        requestData.id = salesId
        requestData.updated_by = createdBy
      } else {
        requestData.created_by = createdBy
      }

      const url =
        isEditMode && salesId
          ? API.salesById(salesId)
          : API.sales()
      const method = isEditMode && salesId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`,
        )
      }

      const result = await response.json()

      if (result.success) {
        const action = isEditMode ? 'updated' : 'created'
        const nextToast = {
          type: 'success',
          message: `Sales ${action} successfully!`,
        }
        setToast(nextToast)
        if (onSuccess) await onSuccess(nextToast)
      } else {
        const action = isEditMode ? 'update' : 'create'
        setToast({
          type: 'error',
          message: result.message || `Failed to ${action} sales`,
        })
      }
    } catch (error) {
      console.error('Error posting sales:', error)
      setToast({ type: 'error', message: 'Error: ' + error.message })
    }
  }

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchCustomers()
    fetchChartsOfAccounts()
    fetchProducts()
    fetchVat()
    fetchWht()
  }, [])

  useEffect(() => {
    // Intentionally not auto-applying default VAT/WHT here. Defaults are
    // applied only when the user submits the transaction if the fields are blank.
  }, [salesItems, vatOptions, whtOptions])

  useEffect(() => {
    if ((isViewMode || isEditMode) && salesData) {
      const mainData = salesData.data ? salesData.data[0] : salesData
      const itemsData = salesData.items || []
      const attachmentsData = salesData.attachments || []

      if (mainData?.customer) {
        setCustomerSearch(mainData.customer)
        setSelectedCustomer(mainData.customer_id || '')
      }

      setDocumentReference(mainData?.doc_ref || '')

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

      let hydratedItems = []
      const journalRows = salesData.journal || []

      if (itemsData.length > 0) {
        hydratedItems = itemsData.map((item) => ({
          id: item.id,
          productId: item.product_service_id,
          productSearch: item.product_service_name,
          coa: item.charts_of_accounts_id,
          coaSearch: item.charts_of_accounts_name,
          description: item.description,
          qty: item.quantity,
          price: item.sales_price,
          discount: item.discount,
          discountType: item.discount_type || 'PERCENT',
          vat: parseInt(item.vat_id) || 0,
          vatSearch: `${item.vat_code || ''} - ${item.vat_name || ''}`,
          vatRate: parseFloat(item.vat_rate) || 0,
          vatType: inferVatTypeFromJournal(item, journalRows),
          wht: parseInt(item.witholding_tax_id) || 0,
          whtSearch: item.withholding_tax_name
            ? `${item.withholding_tax_code || ''} - ${item.withholding_tax_name}`
            : `${item.withholding_tax_code || ''} - ${item.withholding_tax_rate || ''} %`,
          whtRate: parseFloat(item.withholding_tax_rate) || 0,
          responsibilityCenter: item.responsibility_center,
          isOther: false,
        }))
      }

      setSalesItems(hydratedItems)

      lastJournalGenerationRef.current = buildJournalGenerationSignature(
        hydratedItems,
        modeOfPayment,
        bankName,
      )

      pendingJournalHydrationRef.current = {
        items: hydratedItems,
        mode: modeOfPayment,
        bank: bankName,
      }
      journalHydrationSettledRef.current = false

      if (journalRows.length > 0) {
        setJournalEntries(
          journalRows.map((entry) => ({
            id: entry.id,
            account: entry.coa_id,
            accountSearch: entry.charts_of_accounts_name,
            center: entry.responsibility_center || '',
            debit: entry.type === 'DEBIT' ? parseFloat(entry.amount) || 0 : 0,
            credit: entry.type === 'CREDIT' ? parseFloat(entry.amount) || 0 : 0,
            isManual: false,
          })),
        )
      }

      if (attachmentsData.length > 0) {
        setAttachments(
          attachmentsData.map((att) => {
            const attFile = typeof att.file === 'string' ? att.file : ''
            const attName = typeof att.name === 'string' ? att.name : ''
            const base64 = attFile.startsWith('data:image/')
              ? attFile
              : attName.startsWith('data:image/')
                ? attName
                : null
            const fileName =
              !attFile.startsWith('data:') && attFile
                ? attFile
                : !attName.startsWith('data:') && attName
                  ? attName
                  : ''
            return {
              id: att.id,
              fileName,
              file: base64,
              remarks: att.remarks || '',
              uploadedBy: att.uploaded_by || 'Current User',
              date: att.uploaded_date || new Date().toLocaleDateString(),
            }
          }),
        )
      }
    }
  }, [isViewMode, isEditMode, salesData])

  useEffect(() => {
    if (isViewMode) return

    // Hydration schedules state updates that have not been applied yet in
    // this commit. Wait until items/mode/bank match the hydrated snapshot so
    // a stale render cannot regenerate (and wipe) the stored journal entries.
    const pendingHydration = pendingJournalHydrationRef.current
    if (pendingHydration && !journalHydrationSettledRef.current) {
      const settled =
        salesItems === pendingHydration.items &&
        modeOfPayment === pendingHydration.mode &&
        bankName === pendingHydration.bank
      if (!settled) return
      journalHydrationSettledRef.current = true
    }

    const signature = buildJournalGenerationSignature(
      salesItems,
      modeOfPayment,
      bankName,
    )

    // First run only records the baseline (empty form or a document that is
    // still hydrating). Hydration updates the ref itself before this effect
    // runs, so loading an existing document never triggers regeneration.
    if (lastJournalGenerationRef.current === null) {
      lastJournalGenerationRef.current = signature
      return
    }

    if (lastJournalGenerationRef.current === signature) return

    lastJournalGenerationRef.current = signature
    regenerateJournalEntries()
  }, [salesItems, modeOfPayment, bankName, chartsOfAccounts, isViewMode, isEditMode])

  useEffect(() => {
    if (!isViewMode && dateDelivered && termsOption && termsNumber) {
      const deliveredDate = new Date(dateDelivered)
      const termsNum = parseInt(termsNumber) || 0
      if (!isNaN(deliveredDate.getTime()) && termsNum > 0) {
        const dueDate = new Date(deliveredDate)
        if (termsOption === 'MONTHS') {
          dueDate.setMonth(dueDate.getMonth() + termsNum)
        } else {
          dueDate.setDate(dueDate.getDate() + termsNum)
        }
        setDateDue(dueDate.toISOString().split('T')[0])
      }
    }
  }, [dateDelivered, termsOption, termsNumber, isViewMode])

  // ── Returned API ──────────────────────────────────────────────────────────
  return {
    // State
    salesItems,
    journalEntries,
    customers,
    customerLoading,
    customerError,
    selectedCustomer,
    setSelectedCustomer,
    customerSearch,
    setCustomerSearch,
    vendors,
    vendorLoading,
    vendorError,
    selectedVendor,
    setSelectedVendor,
    vendorSearch,
    setVendorSearch,
    chartsOfAccounts,
    coaLoading,
    coaError,
    coaSearch,
    setCoaSearch,
    products,
    productLoading,
    productError,
    vatOptions: filterActiveMasterRows(vatOptions, referencedMasterIds),
    vatLoading,
    vatError,
    whtOptions: filterActiveMasterRows(whtOptions, referencedMasterIds),
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
    category,
    setCategory,
    categorySearch,
    setCategorySearch,
    documentReference,
    setDocumentReference,
    terms,
    setTerms,
    termsOption,
    setTermsOption,
    termsNumber,
    setTermsNumber,
    dateDelivered,
    setDateDelivered,
    dateDue,
    setDateDue,
    remarks,
    setRemarks,
    attachments,
    toast,
    setToast,
    imageModal,
    setImageModal,
    // Derived
    coaOptions,
    vendorOptions,
    customerOptions,
    productOptions,
    summary: computeSummary(salesItems, journalEntries),
    // Handlers
    addSalesItem,
    addJournalEntry,
    removeSalesItem,
    removeJournalEntry,
    updateSalesItem,
    updateJournalEntry,
    addAttachment,
    removeAttachment,
    updateAttachment,
    handleFileChange,
    loadVatOnDemand,
    loadWhtOnDemand,
    createCustomer,
    createProduct,
    handlePostTransaction,
  }
}
