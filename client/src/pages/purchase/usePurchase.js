import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import { API } from '../../api/endpoints'
import { generatePurchasePDF } from '../../utils/generatePurchasePDF'
import { isPostedDocument, createReversal } from '../../utils/journalLifecycle'
import { getAccessLevel } from '../../utils/routeProtection'
import connectRealtime from '../../utils/realtimeSocket'
import { useNotificationsState } from '../../components/layout/NotificationContext'
import { buildUnreadDocCounts } from '../../hooks/useNotifications'

const usePurchase = () => {
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  const purchasesRef = useRef([])
  const filterRef = useRef({ dateFrom: null, dateTo: null })

  const LIMIT = 50

  // List-page state.
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [isAdding, setIsAdding] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isPostedEdit, setIsPostedEdit] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState(null)
  const [isViewing, setIsViewing] = useState(false)
  const [viewingPurchase, setViewingPurchase] = useState(null)
  const [toast, setToast] = useState(null)
  const [isSequenceModalOpen, setIsSequenceModalOpen] = useState(false)
  const [pendingDateFrom, setPendingDateFrom] = useState('')
  const [pendingDateTo, setPendingDateTo] = useState('')
  const [activeDateFrom, setActiveDateFrom] = useState(null)
  const [activeDateTo, setActiveDateTo] = useState(null)
  const [prefillPurchaseData, setPrefillPurchaseData] = useState(null)
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
    () => buildUnreadDocCounts(notificationItems, 'purchase'),
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

  const prependPurchase = useCallback((purchase) => {
    if (!purchase || !purchase.id) return

    setPurchases((prev) => {
      if (prev.some((row) => row.id === purchase.id)) {
        return prev
      }
      const next = [purchase, ...prev]
      purchasesRef.current = next
      return next
    })
  }, [])

  const fetchPurchase = async (offset = 0, append = false, filters = {}) => {
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

      const queryDateFrom = filters.dateFrom || filterRef.current.dateFrom
      const queryDateTo = filters.dateTo || filterRef.current.dateTo

      if (queryDateFrom) params.append('dateFrom', queryDateFrom)
      if (queryDateTo) params.append('dateTo', queryDateTo)

      const response = await fetch(
        `${API.purchase()}?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

      const result = await response.json()
      if (!result.success)
        throw new Error(result.message || 'Failed to fetch purchases')

      const data = Array.isArray(result.data) ? result.data : []

      if (append) {
        const next = [...(purchasesRef.current || []), ...data]
        purchasesRef.current = next
        setPurchases(next)
      } else {
        purchasesRef.current = data
        setPurchases(data)
      }

      setHasMore(Boolean(result.hasMore))
    } catch (err) {
      setError(err.message || 'Failed to fetch purchases')
      if (!append) setPurchases([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    fetchPurchase(0, false)
  }, [])

  const refetchPurchases = useCallback(
    (filters = {}) => {
      fetchPurchase(0, false, filters)
    },
    [fetchPurchase],
  )

  const loadMore = useCallback(
    (filters = {}) => {
      fetchPurchase(purchasesRef.current.length || 0, true, filters)
    },
    [fetchPurchase],
  )

  // Prefill from navigation state.
  useEffect(() => {
    const incomingPrefill = location.state?.prefillPurchaseData
    if (incomingPrefill) {
      setPrefillPurchaseData(incomingPrefill)
      setIsAdding(true)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, navigate, location.pathname])

  // Date filters.
  const applyDateFilters = () => {
    setActiveDateFrom(pendingDateFrom)
    setActiveDateTo(pendingDateTo)
    refetchPurchases({
      dateFrom: pendingDateFrom,
      dateTo: pendingDateTo,
    })
  }

  const clearDateFilters = () => {
    setPendingDateFrom('')
    setPendingDateTo('')
    setActiveDateFrom(null)
    setActiveDateTo(null)
    refetchPurchases({
      dateFrom: null,
      dateTo: null,
    })
  }

  // Deep-link to a single purchase (?id=...).
  useEffect(() => {
    const id = searchParams.get('id')
    if (!id) return

    const fetchPurchaseById = async () => {
      try {
        const token = sessionStorage.getItem('authenticated')
        if (!token) throw new Error('No authentication token found')

        const response = await fetch(
          API.purchaseById(encodeURIComponent(id)),
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
          throw new Error(result.message || 'Failed to fetch purchase details')

        setViewingPurchase(result)
        setIsViewing(true)
        markReadForDocument('purchase', [id])
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete('id')
            return next
          },
          { replace: true },
        )
      } catch (err) {
        showToast('error', err.message || 'Failed to fetch purchase details')
      }
    }

    fetchPurchaseById()
  }, [searchParams, setSearchParams, markReadForDocument])

  // WebSocket subscription for live purchase updates.
  useEffect(() => {
    const close = connectRealtime({
      onMessage: (type, data) => {
        if (type === 'purchase_created' && data?.purchase) {
          prependPurchase(data.purchase)
        }
      },
      onError: (err) => console.error('Purchase realtime error', err),
    })

    return close
  }, [prependPurchase])

  // Access-gated checkbox visibility.
  const user = JSON.parse(sessionStorage.getItem('auth_user') || '{}')
  const accessLevel = getAccessLevel('purchase', user)
  const enableCheckboxes =
    accessLevel === 'Check Access' ||
    accessLevel === 'Approve Access' ||
    accessLevel === 'Edit Access' ||
    accessLevel === 'Full Access'

  // Filtering + totals.
  const filteredPurchases = useMemo(() => {
    if (!activeFilter) return purchases

    switch (activeFilter) {
      case 'PREPARED':
        return purchases?.filter((p) => p.state === 'PREPARED') || []
      case 'CHECKED':
        return purchases?.filter((p) => p.state === 'CHECKED') || []
      case 'CANCELLED':
        return purchases?.filter((p) => p.state === 'CANCELLED') || []
      case 'APPROVED':
        return purchases?.filter((p) => p.state === 'APPROVED') || []
      default:
        return purchases
    }
  }, [purchases, activeFilter])

  const filteredTotalAmount = useMemo(
    () =>
      filteredPurchases?.reduce(
        (sum, p) => sum + (parseFloat(p.amount_due) || 0),
        0,
      ) || 0,
    [filteredPurchases],
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

      const purchaseIds = selectedRows
        .map((row) => encodeURIComponent(String(row.id)))
        .join(',')

      const response = await fetch(
        `${API.purchasePrint(purchaseIds)}?copyType=${copyType}`,
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
        throw new Error(result.message || 'Failed to fetch purchases for printing')

      const data = result.data || []
      if (!Array.isArray(data))
        throw new Error('Invalid data format received from server')

      await generatePurchasePDF(data, copyType)

      showToast(
        'success',
        `${data.length} purchase PDF(s) downloaded (${copyType === 'customer' ? 'Vendor' : 'Internal'} Copy)`,
      )
    } catch (err) {
      console.error('Error generating purchase PDF:', err)
      showToast('error', err.message || 'Failed to generate PDF')
    }
  }

  // Bulk checkbox actions.
  const handleApproveSelected = async (selectedRows) => {
    const approvableRows = selectedRows.filter(
      (row) => row.state === 'PREPARED' || row.state === 'CHECKED',
    )

    if (approvableRows.length === 0) {
      showToast('error', 'No purchases are eligible for approval')
      return
    }

    openConfirmModal({
      onConfirm: async () => {
        try {
          const approveToken = sessionStorage.getItem('authenticated')
          if (!approveToken) {
            throw new Error('No authentication token found')
          }

          const updates = approvableRows.map((row) => ({
            id: row.id,
            currentState: row.state,
          }))

          const approveResponse = await fetch(
            API.purchaseState(),
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${approveToken}`,
              },
              body: JSON.stringify({ updates }),
            },
          )

          const approveResult = await approveResponse.json()

          if (!approveResponse.ok) {
            throw new Error(approveResult.message || 'Failed to approve purchases')
          }

          await refetchPurchases()

          showToast(
            'success',
            approveResult.message ||
              `${approvableRows.length} purchase(s) approved successfully`,
          )
          markReadForDocument(
            'purchase',
            approvableRows.map((row) => row.id),
          )
        } catch (err) {
          console.error('Error approving purchases:', err)
          showToast('error', err.message || 'Failed to approve purchases')
        }
      },
      title: 'Approve Purchases',
      message: `Are you sure you want to approve ${approvableRows.length} purchase(s)?`,
    })
  }

  const handleCancelSelected = async (selectedRows) => {
    const cancellableRows = selectedRows.filter(
      (row) => row.state !== 'CANCELLED' && row.state !== 'REJECTED' && row.state !== 'APPROVED',
    )

    if (cancellableRows.length === 0) {
      showToast('error', 'No purchases are eligible for cancellation')
      return
    }

    openConfirmModal({
      onConfirm: async () => {
        try {
          const cancelToken = sessionStorage.getItem('authenticated')
          if (!cancelToken) {
            throw new Error('No authentication token found')
          }

          const updates = cancellableRows.map((row) => ({
            id: row.id,
            currentState: row.state,
          }))

          const cancelResponse = await fetch(
            API.purchaseCancelState(),
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${cancelToken}`,
              },
              body: JSON.stringify({ updates }),
            },
          )

          const cancelResult = await cancelResponse.json()

          if (!cancelResponse.ok) {
            throw new Error(cancelResult.message || 'Failed to cancel purchases')
          }

          await refetchPurchases()

          showToast(
            'success',
            cancelResult.message ||
              `${cancellableRows.length} purchase(s) cancelled successfully`,
          )
          markReadForDocument(
            'purchase',
            cancellableRows.map((row) => row.id),
          )
        } catch (err) {
          console.error('Error cancelling purchases:', err)
          showToast('error', err.message || 'Failed to cancel purchases')
        }
      },
      title: 'Cancel Purchases',
      message: `Are you sure you want to cancel ${cancellableRows.length} purchase(s)?`,
      type: 'danger',
    })
  }

  // Row actions.
  const handleViewPurchase = async (row) => {
    try {
      const authToken = sessionStorage.getItem('authenticated')
      if (!authToken) {
        throw new Error('No authentication token found')
      }

      const viewResponse = await fetch(
        API.purchaseById(encodeURIComponent(row.id)),
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        },
      )

      const viewResult = await viewResponse.json()

      if (!viewResponse.ok) {
        throw new Error(
          viewResult.message || 'Failed to fetch purchase details',
        )
      }

      // Set purchase data for viewing
      setViewingPurchase(viewResult)
      setIsViewing(true)
      markReadForDocument('purchase', [row.id])
    } catch (err) {
      console.error('Error fetching purchase details:', err)
      showToast('error', err.message || 'Failed to fetch purchase details')
    }
  }

  const handleEditPurchase = async (row) => {
    try {
      setIsPostedEdit(isPostedDocument(row.state))

      const authToken = sessionStorage.getItem('authenticated')
      if (!authToken) {
        throw new Error('No authentication token found')
      }

      const editResponse = await fetch(
        API.purchaseById(encodeURIComponent(row.id)),
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        },
      )

      const editResult = await editResponse.json()

      if (!editResponse.ok) {
        throw new Error(
          editResult.message || 'Failed to fetch purchase details',
        )
      }

      // Set purchase data for editing
      setEditingPurchase(editResult)
      setIsEditing(true)
      markReadForDocument('purchase', [row.id])
    } catch (err) {
      console.error(
        'Error fetching purchase details for editing:',
        err,
      )
      showToast('error', err.message || 'Failed to fetch purchase details')
    }
  }

  const handleReversePurchase = (row) => {
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
            dbName: 'purchase',
            dbId: row.id,
            remarks: 'Reversal initiated from the Purchase module',
          })
          showToast('success', reversed.message || 'Reversal created')
          markReadForDocument('purchase', [row.id])
          navigate('/adjustments')
          await refetchPurchases()
        } catch (err) {
          console.error('Error creating purchase reversal:', err)
          showToast('error', err.message || 'Failed to create reversal')
        }
      },
      title: 'Reverse Purchase',
      message: `Create a REVERSAL for PURCHASE ${row.id}? The original transaction stays unchanged; the reversal (DR/CR mirrored) is created as a PREPARED adjustment and must be approved before it posts to the general journal.`,
      type: 'danger',
    })
  }

  // Form-return wiring.
  const closeAdding = () => {
    setIsAdding(false)
    setPrefillPurchaseData(null)
  }

  const handleAddFormSuccess = async (nextToast) => {
    if (nextToast) setToast(nextToast)
    setPrefillPurchaseData(null)
    await refetchPurchases()
    setIsAdding(false)
  }

  const closeEditing = () => {
    setIsEditing(false)
    setIsPostedEdit(false)
  }

  const handleEditFormSuccess = async (nextToast) => {
    if (nextToast) setToast(nextToast)
    await refetchPurchases()
    closeEditing()
  }

  const closeViewing = () => setIsViewing(false)

  const handleViewFormSuccess = async (nextToast) => {
    if (nextToast) setToast(nextToast)
    await refetchPurchases()
    setIsViewing(false)
  }

  return {
    purchases,
    loading,
    loadingMore,
    hasMore,
    error,
    refetchPurchases,
    loadMore,
    prependPurchase,
    isAdding,
    startAdding: () => setIsAdding(true),
    closeAdding,
    handleAddFormSuccess,
    prefillPurchaseData,
    isEditing,
    isPostedEdit,
    editingPurchase,
    closeEditing,
    handleEditFormSuccess,
    isViewing,
    viewingPurchase,
    closeViewing,
    handleViewFormSuccess,
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
    filteredPurchases,
    filteredTotalAmount,
    fetchAndDownloadPDF,
    handleApproveSelected,
    handleCancelSelected,
    handleViewPurchase,
    handleEditPurchase,
    handleReversePurchase,
  }
}

export default usePurchase
