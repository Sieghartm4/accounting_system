import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { API } from '../../api/endpoints'
import { generatePaymentPDF } from '../../utils/generatePaymentPDF'
import { isPostedDocument, createReversal } from '../../utils/journalLifecycle'
import { getAccessLevel } from '../../utils/routeProtection'
import connectRealtime from '../../utils/realtimeSocket'
import { useNotificationsState } from '../../components/layout/NotificationContext'
import { buildUnreadDocCounts } from '../../hooks/useNotifications'

const usePayments = () => {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  const paymentsRef = useRef([])
  const filterRef = useRef({ dateFrom: null, dateTo: null })
  const LIMIT = 50

  // List-page state.
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [isAdding, setIsAdding] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isPostedEdit, setIsPostedEdit] = useState(false)
  const [viewingPayment, setViewingPayment] = useState(null)
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
  const [activeTab, setActiveTab] = useState('payments') // 'payments' or 'toBePaid'
  const [selectedPurchases, setSelectedPurchases] = useState([])
  const [toBePaidData, setToBePaidData] = useState([])
  const [loadingToBePaid, setLoadingToBePaid] = useState(false)
  const [expandedVendor, setExpandedVendor] = useState(null) // Track which vendor is expanded
  const [selectedPurchaseItems, setSelectedPurchaseItems] = useState([]) // Store fetched purchase items
  const { markReadForDocument, items: notificationItems } = useNotificationsState()

  const showToast = (type, message) => setToast({ type, message })
  const closeToast = () => setToast(null)

  const unreadRowMap = useMemo(
    () => buildUnreadDocCounts(notificationItems, 'payments'),
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

  const fetchPayments = useCallback(
    async (offset = 0, append = false, filters = {}) => {
      if (!append) {
        setLoading(true)
        setError(null)
      } else {
        setLoadingMore(true)
      }

      try {
        const token = sessionStorage.getItem('authenticated')

        if (!token) {
          throw new Error('No authorization token found')
        }
        const params = new URLSearchParams()
        params.append('offset', offset)
        params.append('limit', LIMIT)

        const queryDateFrom =
          filters.dateFrom !== undefined
            ? filters.dateFrom
            : filterRef.current.dateFrom
        const queryDateTo =
          filters.dateTo !== undefined ? filters.dateTo : filterRef.current.dateTo

        if (queryDateFrom) params.append('dateFrom', queryDateFrom)
        if (queryDateTo) params.append('dateTo', queryDateTo)

        const response = await fetch(
          `${API.payments()}?${params.toString()}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        )
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = await response.json()

        if (!result.success) {
          throw new Error(result.message || 'Failed to fetch payments')
        }

        const data = Array.isArray(result.data) ? result.data : []
        if (append) {
          const next = [...(paymentsRef.current || []), ...data]
          paymentsRef.current = next
          setPayments(next)
        } else {
          paymentsRef.current = data
          setPayments(data)
        }

        setHasMore(Boolean(result.hasMore))
      } catch (err) {
        setError(err.message)
        if (!append) setPayments([])
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [],
  )

  const prependPayment = useCallback((newPayment) => {
    setPayments((prevPayments) => {
      if (prevPayments.some((p) => p.id === newPayment.id)) {
        return prevPayments
      }
      return [newPayment, ...prevPayments]
    })
  }, [])

  useEffect(() => {
    fetchPayments(0, false)
  }, [fetchPayments])

  const refetchPayments = useCallback(
    (filters = {}) => {
      filterRef.current.dateFrom = filters.dateFrom || null
      filterRef.current.dateTo = filters.dateTo || null
      fetchPayments(0, false, filters)
    },
    [fetchPayments],
  )

  const loadMore = useCallback(
    (filters = {}) => fetchPayments(paymentsRef.current.length || 0, true, filters),
    [fetchPayments],
  )

  // Fetch purchase items for selected purchases
  const fetchPurchaseItems = async (purchaseIds) => {
    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authentication token found')

      const queryParams = new URLSearchParams()
      purchaseIds.forEach(id => queryParams.append('purchase_id', id))

      const response = await fetch(
        `${API.paymentsPurchasePayment()}?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Failed to fetch purchase data')

      return result.data || []
    } catch (err) {
      console.error('Error fetching purchase data:', err)
      showToast('error', err.message || 'Failed to fetch purchase data')
      return []
    }
  }

  // Fetch unpaid purchases for To Be Paid tab
  const fetchToBePaid = async (filters = {}) => {
    try {
      setLoadingToBePaid(true)
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authorization token found')

      const queryParams = new URLSearchParams()
      queryParams.append('forPayments', 'true')
      if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom)
      if (filters.dateTo) queryParams.append('dateTo', filters.dateTo)

      const response = await fetch(
        `${API.purchase()}?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Failed to fetch unpaid purchases')

      // Backend now handles filtering based on payments sum vs amount due
      const unpaidPurchases = result.data || []

      // Group by unique vendors
      const vendorMap = new Map()
      unpaidPurchases.forEach(purchase => {
        const vendorId = purchase.vendor_id || purchase.id // Use vendor_id from API
        const vendorName = purchase.vendor || purchase.vendor_name // Use vendor name from API

        if (!vendorMap.has(vendorId)) {
          vendorMap.set(vendorId, {
            vendorId,
            vendorName,
            totalUnpaid: 0,
            purchases: []
          })
        }
        const vendor = vendorMap.get(vendorId)
        const totalAmount = parseFloat(purchase.total_amount) || parseFloat(purchase.amount) || parseFloat(purchase.amount_due) || 0
        const paidAmount = parseFloat(purchase.paid_amount) || 0
        const unpaidAmount = totalAmount - paidAmount
        vendor.totalUnpaid += unpaidAmount
        vendor.purchases.push({
          ...purchase,
        })
      })

      const vendors = Array.from(vendorMap.values())

      setToBePaidData(vendors)
    } catch (err) {
      console.error('Error fetching to be paid:', err)
      showToast('error', err.message || 'Failed to fetch unpaid purchases')
    } finally {
      setLoadingToBePaid(false)
    }
  }

  // Fetch to be paid data when tab switches to toBePaid
  useEffect(() => {
    if (activeTab === 'toBePaid') {
      fetchToBePaid()
    }
  }, [activeTab])

  // Date filters.
  const applyDateFilters = async () => {
    const from = pendingDateFrom || null
    const to = pendingDateTo || null
    setActiveDateFrom(from)
    setActiveDateTo(to)
    await refetchPayments({ dateFrom: from, dateTo: to })
  }

  const clearDateFilters = async () => {
    setPendingDateFrom('')
    setPendingDateTo('')
    setActiveDateFrom(null)
    setActiveDateTo(null)
    await refetchPayments({ dateFrom: null, dateTo: null })
  }

  const applyToBePaidDateFilters = async () => {
    const from = pendingDateFrom || null
    const to = pendingDateTo || null
    setActiveDateFrom(from)
    setActiveDateTo(to)
    await fetchToBePaid({ dateFrom: from, dateTo: to })
  }

  const clearToBePaidDateFilters = async () => {
    setPendingDateFrom('')
    setPendingDateTo('')
    setActiveDateFrom(null)
    setActiveDateTo(null)
    await fetchToBePaid({ dateFrom: null, dateTo: null })
  }

  // WebSocket subscription for live payment updates
  useEffect(() => {
    const close = connectRealtime({
      onMessage: (type, data) => {
        if (type === 'payment_created' && data?.payment) {
          prependPayment(data.payment)
        }
      },
      onError: (err) => console.error('Payment realtime error', err),
    })

    return close
  }, [prependPayment])

  // Deep-link to a single payment (?id=...).
  useEffect(() => {
    const id = searchParams.get('id')
    if (!id) return

    const fetchPayment = async () => {
      try {
        const token = sessionStorage.getItem('authenticated')
        if (!token) throw new Error('No authentication token found')

        const response = await fetch(
          API.paymentsById(encodeURIComponent(id)),
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
          throw new Error(result.message || 'Failed to fetch payment details')

        setViewingPayment(result)
        setIsViewing(true)
        markReadForDocument('payments', [id])
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete('id')
            return next
          },
          { replace: true },
        )
      } catch (err) {
        showToast('error', err.message || 'Failed to fetch payment details')
      }
    }

    fetchPayment()
  }, [searchParams, setSearchParams, markReadForDocument])

  // Access-gated checkbox visibility.
  const user = JSON.parse(sessionStorage.getItem('auth_user') || '{}')
  const accessLevel = getAccessLevel('payments', user)
  const enableCheckboxes =
    accessLevel === 'Check Access' ||
    accessLevel === 'Approve Access' ||
    accessLevel === 'Edit Access' ||
    accessLevel === 'Full Access'

  // Filtering + totals.
  const filteredPayments = useMemo(() => {
    if (!activeFilter) return payments

    switch (activeFilter) {
      case 'PREPARED':
        return payments?.filter((p) => p.state === 'PREPARED') || []
      case 'CHECKED':
        return payments?.filter((p) => p.state === 'CHECKED') || []
      case 'CANCELLED':
        return payments?.filter((p) => p.state === 'CANCELLED') || []
      case 'APPROVED':
        return payments?.filter((p) => p.state === 'APPROVED') || []
      default:
        return payments
    }
  }, [payments, activeFilter])

  const filteredTotalPaidAmount = useMemo(
    () =>
      filteredPayments?.reduce(
        (sum, p) => sum + (parseFloat(p.paid_amount) || 0),
        0,
      ) || 0,
    [filteredPayments],
  )

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

      const paymentIds = selectedRows
        .map((row) => encodeURIComponent(String(row.id)))
        .join(',')

      const response = await fetch(
        `${API.paymentsPrint(paymentIds)}?copyType=${copyType}`,
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
        throw new Error(result.message || 'Failed to fetch payments for printing')

      const data = result.data || []
      if (!Array.isArray(data))
        throw new Error('Invalid data format received from server')

      await generatePaymentPDF(data, copyType)

      showToast(
        'success',
        `${data.length} payment PDF(s) downloaded (${copyType === 'customer' ? 'Vendor' : 'Internal'} Copy)`,
      )
    } catch (err) {
      console.error('Error generating payment PDF:', err)
      showToast('error', err.message || 'Failed to generate PDF')
    }
  }

  // Bulk checkbox actions.
  const handleApproveSelected = async (selectedRows) => {
    const approvableRows = selectedRows.filter(
      (row) => row.state === 'PREPARED' || row.state === 'CHECKED',
    )

    if (approvableRows.length === 0) {
      showToast('error', 'No payments are eligible for approval')
      return
    }

    openConfirmModal({
      onConfirm: async () => {
        try {
          const token = sessionStorage.getItem('authenticated')
          if (!token) {
            throw new Error('No authentication token found')
          }

          const updates = approvableRows.map((row) => ({
            id: row.id,
            currentState: row.state,
          }))

          const response = await fetch(
            API.paymentsState(),
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
            throw new Error(result.message || 'Failed to approve payments')
          }

          await refetchPayments()

          showToast(
            'success',
            result.message ||
              `${approvableRows.length} payment(s) approved successfully`,
          )
          markReadForDocument(
            'payments',
            approvableRows.map((row) => row.id),
          )
        } catch (err) {
          console.error('Error approving payments:', err)
          showToast('error', err.message || 'Failed to approve payments')
        }
      },
      title: 'Approve Payments',
      message: `Are you sure you want to approve ${approvableRows.length} payment(s)?`,
    })
  }

  const handleCancelSelected = async (selectedRows) => {
    const cancellableRows = selectedRows.filter(
      (row) => row.state !== 'CANCELLED' && row.state !== 'REJECTED' && row.state !== 'APPROVED',
    )

    if (cancellableRows.length === 0) {
      showToast('error', 'No payments are eligible for cancellation')
      return
    }

    openConfirmModal({
      onConfirm: async () => {
        try {
          const token = sessionStorage.getItem('authenticated')
          if (!token) {
            throw new Error('No authentication token found')
          }

          const updates = cancellableRows.map((row) => ({
            id: row.id,
            currentState: row.state,
          }))

          const response = await fetch(
            API.paymentsCancelState(),
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
            throw new Error(result.message || 'Failed to cancel payments')
          }

          await refetchPayments()

          showToast(
            'success',
            result.message ||
              `${cancellableRows.length} payment(s) cancelled successfully`,
          )
          markReadForDocument(
            'payments',
            cancellableRows.map((row) => row.id),
          )
        } catch (err) {
          console.error('Error cancelling payments:', err)
          showToast('error', err.message || 'Failed to cancel payments')
        }
      },
      title: 'Cancel Payments',
      message: `Are you sure you want to cancel ${cancellableRows.length} payment(s)?`,
      type: 'danger',
    })
  }

  // Row actions.
  const handleViewPayment = async (row) => {
    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(
        API.paymentsById(row.id),
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
          result.message || 'Failed to fetch payment details',
        )
      }

      setViewingPayment(result)
      setIsViewing(true)
      markReadForDocument('payments', [row.id])
    } catch (err) {
      console.error('Error fetching payment details:', err)
      showToast('error', err.message || 'Failed to fetch payment details')
    }
  }

  const handleEditPayment = async (row) => {
    try {
      setIsPostedEdit(isPostedDocument(row.state))

      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(
        API.paymentsById(row.id),
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
          result.message || 'Failed to fetch payment details',
        )
      }

      setViewingPayment(result)
      setIsEditing(true)
      markReadForDocument('payments', [row.id])
    } catch (err) {
      console.error('Error fetching payment details for editing:', err)
      showToast('error', err.message || 'Failed to fetch payment details')
    }
  }

  const handleReversePayment = (row) => {
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
            dbName: 'payments',
            dbId: row.id,
            remarks: 'Reversal initiated from the Payments module',
          })
          showToast('success', reversed.message || 'Reversal created')
          markReadForDocument('payments', [row.id])
          navigate('/adjustments')
          await refetchPayments()
        } catch (err) {
          console.error('Error creating payment reversal:', err)
          showToast('error', err.message || 'Failed to create reversal')
        }
      },
      title: 'Reverse Payment',
      message: `Create a REVERSAL for PAYMENT ${row.id}? The original transaction stays unchanged; the reversal (DR/CR mirrored) is created as a PREPARED adjustment and must be approved before it posts to the general journal.`,
      type: 'danger',
    })
  }

  // To Be Paid tab: selection + pay flow.
  const toggleVendorExpansion = (vendorId) =>
    setExpandedVendor(expandedVendor === vendorId ? null : vendorId)

  const handleVendorCheckboxChange = (selectedIds) => {
    const selectedVendors = toBePaidData.filter(row => selectedIds.includes(row.vendorId))
    const allPurchases = selectedVendors.flatMap(v => v.purchases)
    setSelectedPurchases(allPurchases)
  }

  const sameVendorOnlyCondition = (row) => {
    // Only allow selecting from same vendor
    if (selectedPurchases.length === 0) return true
    return selectedPurchases[0].vendor_id === row.vendorId
  }

  const handlePurchaseCheckboxChange = (selectedIds) => {
    const vendorData = toBePaidData.find(v => v.vendorId === expandedVendor)
    if (vendorData) {
      const selectedPurchasesData = vendorData.purchases.filter(p => selectedIds.includes(p.id))
      setSelectedPurchases(selectedPurchasesData)
    }
  }

  const sameVendorPurchaseCondition = (row) => {
    if (selectedPurchases.length === 0) return true
    return selectedPurchases[0].vendor_id === row.vendor_id
  }

  const startPayForPurchases = async (purchaseRows) => {
    const purchaseIds = purchaseRows.map(p => p.id)
    const items = await fetchPurchaseItems(purchaseIds)
    setSelectedPurchases(purchaseRows)
    setSelectedPurchaseItems(items)
    setIsAdding(true)
  }

  const handlePaySelectedVendors = async (selectedRows) => {
    const allPurchases = selectedRows.flatMap(v => v.purchases)
    await startPayForPurchases(allPurchases)
  }

  // Form-return wiring.
  const closeForm = () => {
    setIsAdding(false)
    setIsEditing(false)
    setIsViewing(false)
    setIsPostedEdit(false)
    setViewingPayment(null)
    setSelectedPurchases([])
    setSelectedPurchaseItems([])
  }

  const handleFormSuccess = async (nextToast) => {
    if (nextToast) setToast(nextToast)
    await refetchPayments()
    if (activeTab === 'toBePaid') {
      await fetchToBePaid()
    }
    closeForm()
  }

  const closeViewing = () => {
    setIsViewing(false)
    setViewingPayment(null)
  }

  return {
    payments,
    loading,
    loadingMore,
    error,
    hasMore,
    refetchPayments,
    loadMore,
    prependPayment,
    isAdding,
    isEditing,
    isViewing,
    isPostedEdit,
    viewingPayment,
    closeForm,
    handleFormSuccess,
    closeViewing,
    selectedPurchases,
    selectedPurchaseItems,
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
    applyToBePaidDateFilters,
    clearToBePaidDateFilters,
    confirmModal,
    closeConfirmModal,
    confirmAndClose,
    unreadRowMap,
    enableCheckboxes,
    activeFilter,
    setActiveFilter,
    activeTab,
    setActiveTab,
    toBePaidData,
    loadingToBePaid,
    expandedVendor,
    toggleVendorExpansion,
    handleVendorCheckboxChange,
    handlePurchaseCheckboxChange,
    sameVendorOnlyCondition,
    sameVendorPurchaseCondition,
    handlePaySelectedVendors,
    startPayForPurchases,
    filteredPayments,
    filteredTotalPaidAmount,
    fetchAndDownloadPDF,
    handleApproveSelected,
    handleCancelSelected,
    handleViewPayment,
    handleEditPayment,
    handleReversePayment,
  }
}

export default usePayments
