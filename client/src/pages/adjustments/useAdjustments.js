import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import { API } from '../../api/endpoints'
import { isPostedDocument, createReversal } from '../../utils/journalLifecycle'
import { getAccessLevel } from '../../utils/routeProtection'
import connectRealtime from '../../utils/realtimeSocket'
import { useNotificationsState } from '../../components/layout/NotificationContext'
import { buildUnreadDocCounts } from '../../hooks/useNotifications'

const useAdjustments = () => {
  const [adjustments, setAdjustments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [selectedAdjustmentId, setSelectedAdjustmentId] = useState(null)
  const [adjustmentData, setAdjustmentData] = useState(null)
  const [adjustmentLoading, setAdjustmentLoading] = useState(false)
  const adjustmentsRef = useRef([])
  const filterRef = useRef({ dateFrom: null, dateTo: null })
  const LIMIT = 50

  // List-page state.
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [isAdding, setIsAdding] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isPostedEdit, setIsPostedEdit] = useState(false)
  const [viewingAdjustment, setViewingAdjustment] = useState(null)
  const [initialJournalEntries, setInitialJournalEntries] = useState([])
  const [toast, setToast] = useState(null)
  const [isSequenceModalOpen, setIsSequenceModalOpen] = useState(false)
  const [pendingDateFrom, setPendingDateFrom] = useState('')
  const [pendingDateTo, setPendingDateTo] = useState('')
  const [activeDateFrom, setActiveDateFrom] = useState(null)
  const [activeDateTo, setActiveDateTo] = useState(null)
  const [activeFilter, setActiveFilter] = useState(null)
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    onConfirm: null,
    title: '',
    message: '',
  })
  const { markReadForDocument, items: notificationItems } = useNotificationsState()

  const showToast = (type, message) => setToast({ type, message })
  const closeToast = () => setToast(null)

  const unreadRowMap = useMemo(
    () => buildUnreadDocCounts(notificationItems, 'adjustments'),
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

  useEffect(() => {
    adjustmentsRef.current = adjustments
  }, [adjustments])

  const fetchAdjustments = useCallback(async (isLoadMore = false, filters = {}) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authorization token found')
      }

      const currentOffset = isLoadMore ? adjustmentsRef.current.length : 0
      const params = new URLSearchParams()
      params.append('offset', currentOffset)
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
        `${API.adjustments()}?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch adjustments')
      }

      if (isLoadMore) {
        setAdjustments((prev) => [...prev, ...(result.data || [])])
      } else {
        setAdjustments(result.data || [])
      }

      setHasMore(result.hasMore || false)
    } catch (err) {
      setError(err.message || 'Unable to fetch adjustments')
      if (!isLoadMore) {
        setAdjustments([])
      }
    } finally {
      if (isLoadMore) {
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }, [])

  const fetchAdjustmentDetails = useCallback(async (adjustmentId) => {
    try {
      setAdjustmentLoading(true)
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.adjustmentsById(adjustmentId),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        setAdjustmentData(result)
      } else {
        setError(result.message || 'Failed to fetch adjustment details')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setAdjustmentLoading(false)
    }
  }, [])

  const handleAdjustmentRowClick = async (adjustment_id) => {


    if (selectedAdjustmentId === adjustment_id) {
      setSelectedAdjustmentId(null)
      setAdjustmentData(null)
    } else {
      setSelectedAdjustmentId(adjustment_id)
      await fetchAdjustmentDetails(adjustment_id)
    }
  }

  const prependAdjustment = useCallback((newAdjustment) => {
    setAdjustments((prevAdjustments) => {
      if (prevAdjustments.some((adjustment) => adjustment.id === newAdjustment.id)) {
        return prevAdjustments
      }
      return [newAdjustment, ...prevAdjustments]
    })
  }, [])

  const refetchAdjustments = useCallback(
    (filters = {}) => {
      if (filters.dateFrom !== undefined) {
        filterRef.current.dateFrom = filters.dateFrom
      }
      if (filters.dateTo !== undefined) {
        filterRef.current.dateTo = filters.dateTo
      }
      fetchAdjustments(false, filters)
    },
    [fetchAdjustments],
  )

  const loadMore = useCallback(
    (filters = {}) => fetchAdjustments(true, filters),
    [fetchAdjustments],
  )

  useEffect(() => {
    fetchAdjustments(false)
  }, [fetchAdjustments])

  // Date filters.
  const applyDateFilters = async () => {
    const from = pendingDateFrom || null
    const to = pendingDateTo || null
    setActiveDateFrom(from)
    setActiveDateTo(to)
    await refetchAdjustments({ dateFrom: from, dateTo: to })
  }

  const clearDateFilters = async () => {
    setPendingDateFrom('')
    setPendingDateTo('')
    setActiveDateFrom(null)
    setActiveDateTo(null)
    await refetchAdjustments({ dateFrom: null, dateTo: null })
  }

  // Deep-link to a single adjustment (?id=...).
  useEffect(() => {
    const id = searchParams.get('id')
    if (!id) return

    const fetchAdjustment = async () => {
      try {
        const token = sessionStorage.getItem('authenticated')
        if (!token) throw new Error('No authentication token found')

        const response = await fetch(
          API.adjustmentsById(encodeURIComponent(id)),
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
          throw new Error(result.message || 'Failed to fetch adjustment details')

        setViewingAdjustment(result)
        setIsViewing(true)
        markReadForDocument('adjustments', [id])
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete('id')
            return next
          },
          { replace: true },
        )
      } catch (err) {
        showToast('error', err.message || 'Failed to fetch adjustment details')
      }
    }

    fetchAdjustment()
  }, [searchParams, setSearchParams, markReadForDocument])

  // Prefill journal entries from advances (navigation state).
  useEffect(() => {
    const selectedAdvanceJournalEntries =
      location.state?.selectedAdvanceJournalEntries || []

    if (selectedAdvanceJournalEntries.length > 0) {
      setInitialJournalEntries(selectedAdvanceJournalEntries)
      setIsAdding(true)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, navigate, location.pathname])

  // WebSocket subscription for live adjustment updates.
  useEffect(() => {
    const close = connectRealtime({
      onMessage: (type, data) => {
        if (type === 'adjustment_created' && data?.adjustment) {
          prependAdjustment(data.adjustment)
        }
      },
      onError: (err) => console.error('Adjustment realtime error', err),
    })

    return close
  }, [prependAdjustment, refetchAdjustments])

  // Access-gated checkbox visibility + condition.
  const user = JSON.parse(sessionStorage.getItem('auth_user') || '{}')
  const accessLevel = getAccessLevel('adjustments', user)
  const enableCheckboxes =
    accessLevel === 'Check Access' ||
    accessLevel === 'Approve Access' ||
    accessLevel === 'Edit Access' ||
    accessLevel === 'Full Access'

  // Determine checkbox condition based on access level
  const checkboxCondition = enableCheckboxes
    ? accessLevel === 'Full Access'
      ? { column: 'status', value: 'APPROVED', exclude: true } // Exclude APPROVED state for Full Access
      : {
          column: 'status',
          value:
            accessLevel === 'Check Access'
              ? 'PREPARED'
              : accessLevel === 'Approve Access'
                ? 'CHECKED'
                : 'CHECKED',
        }
    : null

  // Filtering + totals.
  const filteredAdjustments = useMemo(() => {
    if (!activeFilter) return adjustments

    switch (activeFilter) {
      case 'PREPARED':
        return adjustments?.filter((a) => a.status === 'PREPARED') || []
      case 'CHECKED':
        return adjustments?.filter((a) => a.status === 'CHECKED') || []
      case 'CANCELLED':
        return adjustments?.filter((a) => a.status === 'CANCELLED') || []
      case 'APPROVED':
        return adjustments?.filter((a) => a.status === 'APPROVED') || []
      case 'REJECTED':
        return adjustments?.filter((a) => a.status === 'REJECTED') || []
      default:
        return adjustments
    }
  }, [adjustments, activeFilter])

  const filteredTotalAmount = useMemo(
    () =>
      filteredAdjustments?.reduce(
        (sum, a) => sum + (parseFloat(a.total_amount) || 0),
        0,
      ) || 0,
    [filteredAdjustments],
  )

  // Sequence modal wiring.
  const openSequenceModal = () => setIsSequenceModalOpen(true)
  const closeSequenceModal = () => setIsSequenceModalOpen(false)
  const handleSequenceSaved = () =>
    showToast('success', 'Sequence updated. New documents will use it.')

  // Row actions.
  const handleViewAdjustment = async (row) => {
    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(
        API.adjustmentsById(row.id),
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
          result.message || 'Failed to fetch adjustment details',
        )
      }

      setViewingAdjustment(result)
      setIsViewing(true)
      markReadForDocument('adjustments', [row.id])
    } catch (err) {
      console.error('Error fetching adjustment details:', err)
      showToast('error', err.message || 'Failed to fetch adjustment details')
    }
  }

  const handleEditAdjustment = async (row) => {
    try {
      setIsPostedEdit(isPostedDocument(row.status))

      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(
        API.adjustmentsById(row.id),
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
          result.message || 'Failed to fetch adjustment details',
        )
      }

      setViewingAdjustment(result)
      setIsEditing(true)
      setIsAdding(true)
      markReadForDocument('adjustments', [row.id])
    } catch (err) {
      console.error(
        'Error fetching adjustment details for editing:',
        err,
      )
      showToast('error', err.message || 'Failed to fetch adjustment details')
    }
  }

  const handleReverseAdjustment = (row) => {
    if (!isPostedDocument(row.status)) {
      showToast(
        'error',
        `Only APPROVED/POSTED adjustments can be reversed (current: ${row.status}).`,
      )
      return
    }

    openConfirmModal({
      onConfirm: async () => {
        try {
          const reversed = await createReversal({
            dbName: 'adjustments',
            dbId: row.id,
            remarks: 'Reversal initiated from the Adjustments module',
          })
          showToast('success', reversed.message || 'Reversal created')
          markReadForDocument('adjustments', [row.id])
          navigate('/adjustments')
          await refetchAdjustments()
        } catch (err) {
          console.error('Error creating adjustment reversal:', err)
          showToast('error', err.message || 'Failed to create reversal')
        }
      },
      title: 'Reverse Adjustment',
      message: `Create a REVERSAL against ADJUSTMENT ${row.id}? The original transaction stays unchanged; the reversal (DR/CR mirrored) is created as a PREPARED adjustment and must be approved before it posts to the general journal.`,
      type: 'danger',
    })
  }

  // Bulk checkbox actions.
  const handleApproveSelected = async (selectedRows) => {
    const approvableRows = selectedRows.filter(
      (row) => row.status === 'PREPARED' || row.status === 'CHECKED',
    )

    if (approvableRows.length === 0) {
      showToast('error', 'No adjustments are eligible for approval')
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
            currentState: row.status,
          }))

          const response = await fetch(
            API.adjustmentsState(),
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
            throw new Error(
              result.message || 'Failed to approve adjustments',
            )
          }

          // Refresh adjustments data
          await refetchAdjustments()

          showToast(
            'success',
            result.message ||
              `                          ${approvableRows.length} adjustment(s) approved successfully`,
          )
          markReadForDocument(
            'adjustments',
            approvableRows.map((row) => row.id),
          )
        } catch (err) {
          console.error('Error approving adjustments:', err)
          showToast('error', err.message || 'Failed to approve adjustments')
        }
      },
      title: 'Approve Adjustments',
      message: `Are you sure you want to approve ${approvableRows.length} adjustment(s)?`,
    })
  }

  const handleCancelSelected = async (selectedRows) => {
    const cancellableRows = selectedRows.filter(
      (row) => row.status !== 'CANCELLED' && row.status !== 'REJECTED' && row.status !== 'APPROVED',
    )

    if (cancellableRows.length === 0) {
      showToast('error', 'No adjustments are eligible for cancellation')
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
            currentState: row.status,
          }))

          const response = await fetch(
            API.adjustmentsCancelState(),
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
            throw new Error(
              result.message || 'Failed to cancel adjustments',
            )
          }

          // Refresh adjustments data
          await refetchAdjustments()

          showToast(
            'success',
            result.message ||
              `                          ${cancellableRows.length} adjustment(s) cancelled successfully`,
          )
          markReadForDocument(
            'adjustments',
            cancellableRows.map((row) => row.id),
          )
        } catch (err) {
          console.error('Error cancelling adjustments:', err)
          showToast('error', err.message || 'Failed to cancel adjustments')
        }
      },
      title: 'Cancel Adjustments',
      message: `Are you sure you want to cancel ${cancellableRows.length} adjustment(s)?`,
      type: 'danger',
    })
  }

  // Form-return wiring.
  const handleBack = () => {
    setIsAdding(false)
    setIsViewing(false)
    setIsEditing(false)
    setIsPostedEdit(false)
    setViewingAdjustment(null)
    setInitialJournalEntries([])
  }

  const handleFormSuccess = async (nextToast) => {
    if (nextToast) setToast(nextToast)
    await refetchAdjustments()
    handleBack()
  }

  const closeViewing = () => {
    setIsViewing(false)
    setViewingAdjustment(null)
  }

  return {
    adjustments,
    loading,
    loadingMore,
    error,
    hasMore,
    selectedAdjustmentId,
    adjustmentData,
    adjustmentLoading,
    handleAdjustmentRowClick,
    prependAdjustment,
    refetchAdjustments,
    loadMore,
    isAdding,
    startAdding: () => setIsAdding(true),
    isViewing,
    isEditing,
    isPostedEdit,
    viewingAdjustment,
    initialJournalEntries,
    handleBack,
    handleFormSuccess,
    closeViewing,
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
    checkboxCondition,
    activeFilter,
    setActiveFilter,
    filteredAdjustments,
    filteredTotalAmount,
    handleApproveSelected,
    handleCancelSelected,
    handleViewAdjustment,
    handleEditAdjustment,
    handleReverseAdjustment,
  }
}

export default useAdjustments
