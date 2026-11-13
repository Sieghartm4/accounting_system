import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { API } from '../../api/endpoints'
import { generateCollectionPDF } from '../../utils/generateCollectionPDF'
import { isPostedDocument, createReversal } from '../../utils/journalLifecycle'
import { getAccessLevel } from '../../utils/routeProtection'
import connectRealtime from '../../utils/realtimeSocket'
import { useNotificationsState } from '../../components/layout/NotificationContext'
import { buildUnreadDocCounts } from '../../hooks/useNotifications'

const useCollections = () => {
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  // List-page state.
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [isAdding, setIsAdding] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isPostedEdit, setIsPostedEdit] = useState(false)
  const [viewingCollection, setViewingCollection] = useState(null)
  const [editingCollection, setEditingCollection] = useState(null)
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
  const [activeTab, setActiveTab] = useState('collections') // 'collections' or 'toBeCollected'
  const [selectedSales, setSelectedSales] = useState([])
  const [toBeCollectedData, setToBeCollectedData] = useState([])
  const [loadingToBeCollected, setLoadingToBeCollected] = useState(false)
  const [expandedCustomer, setExpandedCustomer] = useState(null) // Track which customer is expanded
  const [selectedSalesItems, setSelectedSalesItems] = useState([]) // Store fetched sales items
  const { markReadForDocument, items: notificationItems } = useNotificationsState()

  const showToast = (type, message) => setToast({ type, message })
  const closeToast = () => setToast(null)

  const unreadRowMap = useMemo(
    () => buildUnreadDocCounts(notificationItems, 'collection'),
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

  const collectionsRef = useRef([])
  const filterRef = useRef({ dateFrom: null, dateTo: null })

  const LIMIT = 50

  const prependCollection = useCallback((collection) => {
    if (!collection || !collection.id) return

    setCollections((prev) => {
      if (prev.some((row) => row.id === collection.id)) {
        return prev
      }
      const next = [collection, ...prev]
      collectionsRef.current = next
      return next
    })
  }, [])

  const fetchCollections = useCallback(
    async (offset = 0, append = false, filters = {}) => {
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
          `${API.collections()}?${params.toString()}`,
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
          throw new Error(result.message || 'Failed to fetch collections')

        const data = Array.isArray(result.data) ? result.data : []


        if (append) {
          const next = [...(collectionsRef.current || []), ...data]
          collectionsRef.current = next
          setCollections(next)
        } else {
          collectionsRef.current = data
          setCollections(data)
        }

        setHasMore(Boolean(result.hasMore))
      } catch (err) {
        setError(err.message || 'Failed to fetch collections')
        if (!append) setCollections([])
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [],
  )

  useEffect(() => {
    fetchCollections(0, false)
  }, [fetchCollections])

  const refetchCollections = useCallback(
    (filters = {}) => {
      fetchCollections(0, false, filters)
    },
    [fetchCollections],
  )

  const loadMore = async (filters = {}) =>
    fetchCollections(collectionsRef.current.length || 0, true, filters)

  // Fetch sales items for selected sales
  const fetchSalesItems = async (salesIds) => {
    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authentication token found')

      const queryParams = new URLSearchParams()
      salesIds.forEach((id) => queryParams.append('sales_id', id))

      const response = await fetch(
        `${API.collectionsSalesItemsCollection()}?${queryParams.toString()}`,
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
        throw new Error(result.message || 'Failed to fetch sales items')

      return result.data || []
    } catch (err) {
      console.error('Error fetching sales items:', err)
      showToast('error', err.message || 'Failed to fetch sales items')
      return []
    }
  }

  // Fetch unpaid sales for To Be Collected tab
  const fetchToBeCollected = async (filters = {}) => {
    try {
      setLoadingToBeCollected(true)
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authorization token found')

      const queryParams = new URLSearchParams()
      queryParams.append('forCollections', 'true')
      if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom)
      if (filters.dateTo) queryParams.append('dateTo', filters.dateTo)

      const response = await fetch(
        `${API.sales()}?${queryParams.toString()}`,
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
        throw new Error(result.message || 'Failed to fetch unpaid sales')

      const unpaidSales = result.data || []

      const customerMap = new Map()
      unpaidSales.forEach((sale) => {
        const customerId = sale.customer_id || sale.customer
        const customerName = sale.customer_name || sale.customer
        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            customerId,
            customerName,
            totalUnpaid: 0,
            sales: [],
          })
        }
        const customer = customerMap.get(customerId)
        // Calculate remaining balance for each sale
        const totalDue = parseFloat(sale.amount_due) || 0
        const paidAmount = parseFloat(sale.paid_amount) || 0
        const remainingBalance = totalDue - paidAmount
        customer.totalUnpaid += remainingBalance
        customer.sales.push({
          ...sale,
          remainingBalance,
          totalDue,
          paidAmount,
          sales_number: sale.sales_number || sale.document_reference || sale.id,
        })
      })

      setToBeCollectedData(Array.from(customerMap.values()))
    } catch (err) {
      console.error('Error fetching to be collected:', err)
      showToast('error', err.message || 'Failed to fetch unpaid sales')
    } finally {
      setLoadingToBeCollected(false)
    }
  }

  // Fetch to be collected data when tab switches
  useEffect(() => {
    if (activeTab === 'toBeCollected' && toBeCollectedData.length === 0) {
      fetchToBeCollected()
    }
  }, [activeTab])

  // Deep-link to a single collection (?id=...).
  useEffect(() => {
    const id = searchParams.get('id')
    if (!id) return

    const fetchCollection = async () => {
      try {
        const token = sessionStorage.getItem('authenticated')
        if (!token) throw new Error('No authentication token found')

        const response = await fetch(
          `${API.collectionsById(encodeURIComponent(id))}`,
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
          throw new Error(result.message || 'Failed to fetch collection details')

        setViewingCollection(result)
        setIsViewing(true)
        markReadForDocument('collection', [id])
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete('id')
            return next
          },
          { replace: true },
        )
      } catch (err) {
        showToast('error', err.message || 'Failed to fetch collection details')
      }
    }

    fetchCollection()
  }, [searchParams, setSearchParams, markReadForDocument])

  // Realtime prepend.
  useEffect(() => {
    const close = connectRealtime({
      onMessage: (type, data) => {
        if (type === 'collection_created' && data?.collection) {
          prependCollection(data.collection)
        }
      },
      onError: (err) => console.error('Collection realtime error', err),
    })

    return close
  }, [prependCollection])

  // Access-gated checkbox visibility.
  const user = JSON.parse(sessionStorage.getItem('auth_user') || '{}')
  const accessLevel = getAccessLevel('collections', user)
  const enableCheckboxes =
    accessLevel === 'Check Access' ||
    accessLevel === 'Approve Access' ||
    accessLevel === 'Edit Access' ||
    accessLevel === 'Full Access'

  // Filtering + totals.
  const filteredCollections = useMemo(() => {
    if (!activeFilter) return collections

    switch (activeFilter) {
      case 'PREPARED':
        return collections?.filter((c) => c.state === 'PREPARED') || []
      case 'CHECKED':
        return collections?.filter((c) => c.state === 'CHECKED') || []
      case 'CANCELLED':
        return collections?.filter((c) => c.state === 'CANCELLED') || []
      case 'APPROVED':
        return collections?.filter((c) => c.state === 'APPROVED') || []
      default:
        return collections
    }
  }, [collections, activeFilter])

  const filteredTotalCollectedAmount = useMemo(
    () =>
      filteredCollections?.reduce(
        (sum, c) => sum + (parseFloat(c.collected_amount) || 0),
        0,
      ) || 0,
    [filteredCollections],
  )

  // Date filters.
  const applyDateFilters = async () => {
    const from = pendingDateFrom || null
    const to = pendingDateTo || null
    setActiveDateFrom(from)
    setActiveDateTo(to)
    await refetchCollections({ dateFrom: from, dateTo: to })
  }

  const clearDateFilters = async () => {
    setPendingDateFrom('')
    setPendingDateTo('')
    setActiveDateFrom(null)
    setActiveDateTo(null)
    await refetchCollections({ dateFrom: null, dateTo: null })
  }

  const applyToBeCollectedDateFilters = async () => {
    const from = pendingDateFrom || null
    const to = pendingDateTo || null
    setActiveDateFrom(from)
    setActiveDateTo(to)
    await fetchToBeCollected({ dateFrom: from, dateTo: to })
  }

  const clearToBeCollectedDateFilters = async () => {
    setPendingDateFrom('')
    setPendingDateTo('')
    setActiveDateFrom(null)
    setActiveDateTo(null)
    await fetchToBeCollected({ dateFrom: null, dateTo: null })
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

      const collectionIds = selectedRows
        .map((row) => encodeURIComponent(String(row.id)))
        .join(',')

      const response = await fetch(
        `${API.collectionsPrint(collectionIds)}?copyType=${copyType}`,
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
        throw new Error(result.message || 'Failed to fetch collections for printing')

      const data = result.data || []
      if (!Array.isArray(data))
        throw new Error('Invalid data format received from server')

      await generateCollectionPDF(data, copyType)

      showToast(
        'success',
        `${data.length} collection PDF(s) downloaded (${copyType === 'customer' ? 'Customer' : 'Internal'} Copy)`,
      )
    } catch (err) {
      console.error('Error generating collection PDF:', err)
      showToast('error', err.message || 'Failed to generate PDF')
    }
  }

  // Bulk checkbox actions.
  const handleApproveSelected = async (selectedRows) => {
    const approvableRows = selectedRows.filter(
      (row) => row.state === 'PREPARED' || row.state === 'CHECKED',
    )

    if (approvableRows.length === 0) {
      showToast('error', 'No collections are eligible for approval')
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
            `${API.collectionsState()}`,
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
            throw new Error(result.message || 'Failed to approve collections')
          }

          await refetchCollections()

          showToast(
            'success',
            result.message ||
              `${approvableRows.length} collection(s) approved successfully`,
          )
          markReadForDocument(
            'collection',
            approvableRows.map((row) => row.id),
          )
        } catch (err) {
          console.error('Error approving collections:', err)
          showToast('error', err.message || 'Failed to approve collections')
        }
      },
      title: 'Approve Collections',
      message: `Are you sure you want to approve ${approvableRows.length} collection(s)?`,
    })
  }

  const handleCancelSelected = async (selectedRows) => {
    const cancellableRows = selectedRows.filter(
      (row) =>
        row.state !== 'CANCELLED' &&
        row.state !== 'REJECTED' &&
        row.state !== 'APPROVED',
    )

    if (cancellableRows.length === 0) {
      showToast('error', 'No collections are eligible for cancellation')
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
            `${API.collectionsCancelState()}`,
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
            throw new Error(result.message || 'Failed to cancel collections')
          }

          await refetchCollections()

          showToast(
            'success',
            result.message ||
              `${cancellableRows.length} collection(s) cancelled successfully`,
          )
          markReadForDocument(
            'collection',
            cancellableRows.map((row) => row.id),
          )
        } catch (err) {
          console.error('Error cancelling collections:', err)
          showToast('error', err.message || 'Failed to cancel collections')
        }
      },
      title: 'Cancel Collections',
      message: `Are you sure you want to cancel ${cancellableRows.length} collection(s)?`,
      type: 'danger',
    })
  }

  // Row actions.
  const handleViewCollection = async (row) => {
    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(
        API.collectionsById(row.id),
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
          result.message || 'Failed to fetch collection details',
        )
      }

      setViewingCollection(result)
      setIsViewing(true)
      markReadForDocument('collection', [row.id])
    } catch (err) {
      console.error('Error fetching collection details:', err)
      showToast('error', err.message || 'Failed to fetch collection details')
    }
  }

  const handleEditCollection = async (row) => {
    try {
      setIsPostedEdit(isPostedDocument(row.state))

      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(
        API.collectionsById(row.id),
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
          result.message || 'Failed to fetch collection details',
        )
      }

      setEditingCollection(result)
      setIsEditing(true)
      markReadForDocument('collection', [row.id])
    } catch (err) {
      console.error(
        'Error fetching collection details for editing:',
        err,
      )
      showToast('error', err.message || 'Failed to fetch collection details')
    }
  }

  const handleReverseCollection = (row) => {
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
            dbName: 'collections',
            dbId: row.id,
            remarks: 'Reversal initiated from the Collections module',
          })
          showToast('success', reversed.message || 'Reversal created')
          markReadForDocument('collection', [row.id])
          navigate('/adjustments')
          await refetchCollections()
        } catch (err) {
          console.error('Error creating collection reversal:', err)
          showToast('error', err.message || 'Failed to create reversal')
        }
      },
      title: 'Reverse Collection',
      message: `Create a REVERSAL for COLLECTION ${row.id}? The original transaction stays unchanged; the reversal (DR/CR mirrored) is created as a PREPARED adjustment and must be approved before it posts to the general journal.`,
      type: 'danger',
    })
  }

  // To Be Collected tab: selection + collect flow.
  const toggleCustomerExpansion = (customerId) =>
    setExpandedCustomer(expandedCustomer === customerId ? null : customerId)

  const handleCustomerCheckboxChange = (selectedIds) => {
    const selectedCustomers = toBeCollectedData.filter((row) =>
      selectedIds.includes(row.customerId),
    )
    const allSales = selectedCustomers.flatMap((c) => c.sales)
    setSelectedSales(allSales)
  }

  const sameCustomerOnlyCondition = (row) => {
    // Only allow selecting from same customer
    if (selectedSales.length === 0) return true
    return selectedSales[0].customer_id === row.customer_id
  }

  const handleSalesCheckboxChange = (selectedIds) => {
    const customer = toBeCollectedData.find(
      (c) => c.customerId === expandedCustomer,
    )
    if (!customer) return
    const selectedRows = customer.sales.filter((row) =>
      selectedIds.includes(row.id),
    )
    setSelectedSales(selectedRows)
  }

  const startCollectForSales = async (salesRows) => {
    const salesIds = salesRows.map((s) => s.id)
    const items = await fetchSalesItems(salesIds)
    if (items.length === 0) {
      showToast(
        'error',
        'This sales order has no sales items and cannot be collected.',
      )
      return
    }
    setSelectedSales(salesRows)
    setSelectedSalesItems(items)
    setIsAdding(true)
  }

  const handleCollectSelectedCustomers = async (selectedRows) => {
    const allSales = selectedRows.flatMap((c) => c.sales)
    await startCollectForSales(allSales)
  }

  // Form-return wiring.
  const closeAdding = () => {
    setIsAdding(false)
    setSelectedSales([])
    setSelectedSalesItems([])
  }

  const handleAddFormSuccess = async (nextToast) => {
    if (nextToast) setToast(nextToast)
    await refetchCollections()
    setSelectedSales([])
    setSelectedSalesItems([])
    await fetchToBeCollected()
    setIsAdding(false)
  }

  const closeViewing = () => {
    setIsViewing(false)
    setViewingCollection(null)
  }

  const closeEditing = () => {
    setIsEditing(false)
    setEditingCollection(null)
    setIsPostedEdit(false)
  }

  const handleEditFormSuccess = async (nextToast) => {
    if (nextToast) setToast(nextToast)
    await refetchCollections()
    setIsEditing(false)
    setEditingCollection(null)
    setIsPostedEdit(false)
  }

  return {
    collections,
    loading,
    loadingMore,
    hasMore,
    error,
    refetchCollections,
    loadMore,
    prependCollection,
    isAdding,
    closeAdding,
    handleAddFormSuccess,
    selectedSales,
    selectedSalesItems,
    isViewing,
    viewingCollection,
    closeViewing,
    isEditing,
    editingCollection,
    isPostedEdit,
    closeEditing,
    handleEditFormSuccess,
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
    applyToBeCollectedDateFilters,
    clearToBeCollectedDateFilters,
    confirmModal,
    closeConfirmModal,
    confirmAndClose,
    unreadRowMap,
    enableCheckboxes,
    activeFilter,
    setActiveFilter,
    activeTab,
    setActiveTab,
    toBeCollectedData,
    loadingToBeCollected,
    expandedCustomer,
    toggleCustomerExpansion,
    handleCustomerCheckboxChange,
    handleSalesCheckboxChange,
    sameCustomerOnlyCondition,
    handleCollectSelectedCustomers,
    startCollectForSales,
    filteredCollections,
    filteredTotalCollectedAmount,
    fetchAndDownloadPDF,
    handleApproveSelected,
    handleCancelSelected,
    handleViewCollection,
    handleEditCollection,
    handleReverseCollection,
  }
}

export default useCollections
