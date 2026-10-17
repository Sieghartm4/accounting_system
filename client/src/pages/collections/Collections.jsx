import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FilePlus,
  Layers,
  CheckCircle,
  ShieldCheck,
  Wallet,
  ArrowRight,
  Download,
  Plus,
  FileText,
  Building,
  ClipboardList,
  XCircle,
} from 'lucide-react'
import DynamicTable from '../../components/DynamicTable'
import DynamicToast from '../../components/DynamicToast'
import DynamicConfirmModal from '../../components/DynamicConfirmModal'
import RouteProtection from '../../components/RouteProtection'
import ProtectedAction from '../../components/ProtectedAction'
import useCollections from './useCollections'
import CollectionsForm from './CollectionsForm'
import { getAccessLevel } from '../../utils/routeProtection'
import { generateCollectionPDF } from '../../utils/generateCollectionPDF'
import { isPostedDocument, createReversal } from '../../utils/journalLifecycle'
import LoadingScreen from '../../components/LoadingScreen'
import connectRealtime from '../../utils/realtimeSocket'

export default function Collections() {
  return (
    <RouteProtection routeName="collections">
      <CollectionsContent />
    </RouteProtection>
  )
}

function CollectionsContent() {
  const {
    collections,
    loading,
    loadingMore,
    hasMore,
    error,
    refetchCollections,
    loadMore,
    prependCollection,
  } = useCollections()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [isAdding, setIsAdding] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isPostedEdit, setIsPostedEdit] = useState(false)
  const [viewingCollection, setViewingCollection] = useState(null)
  const [editingCollection, setEditingCollection] = useState(null)
  const [toast, setToast] = useState(null)
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

  // Fetch sales items for selected sales
  const fetchSalesItems = async (salesIds) => {
    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authentication token found')

      const queryParams = new URLSearchParams()
      salesIds.forEach((id) => queryParams.append('sales_id', id))

      console.log('Fetching sales items for IDs:', salesIds)
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/collections/sales-items-collection?${queryParams.toString()}`,
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

      console.log('Sales items API response:', result)
      console.log('Sales items data:', result.data)
      console.log(
        'Sales items data structure:',
        result.data ? result.data.map((item) => Object.keys(item)) : 'No data',
      )
      return result.data || []
    } catch (error) {
      console.error('Error fetching sales items:', error)
      setToast({
        type: 'error',
        message: error.message || 'Failed to fetch sales items',
      })
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
        `${import.meta.env.VITE_SERVER_LINK}/sales?${queryParams.toString()}`,
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

      console.log('Sales data received:', result.data)

      // Backend now handles filtering based on collections sum vs amount due
      const unpaidSales = result.data || []

      console.log('Sales from backend (already filtered):', unpaidSales)

      // Group by unique customers
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

      console.log(
        'Customer totals:',
        Array.from(customerMap.values()).map((c) => ({
          customer: c.customerName,
          totalUnpaid: c.totalUnpaid,
          salesCount: c.sales.length,
        })),
      )

      setToBeCollectedData(Array.from(customerMap.values()))
    } catch (error) {
      console.error('Error fetching to be collected:', error)
      setToast({
        type: 'error',
        message: error.message || 'Failed to fetch unpaid sales',
      })
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

  useEffect(() => {
    const id = searchParams.get('id')
    if (!id) return

    const fetchCollection = async () => {
      try {
        const token = sessionStorage.getItem('authenticated')
        if (!token) throw new Error('No authentication token found')

        const response = await fetch(
          `${import.meta.env.VITE_SERVER_LINK}/collections/${encodeURIComponent(id)}`,
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
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete('id')
            return next
          },
          { replace: true },
        )
      } catch (err) {
        setToast({
          type: 'error',
          message: err.message || 'Failed to fetch collection details',
        })
      }
    }

    fetchCollection()
  }, [searchParams, setSearchParams])

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

  // Check if user has access to enable checkboxes
  const user = JSON.parse(sessionStorage.getItem('auth_user') || '{}')
  const accessLevel = getAccessLevel('collections', user)
  const enableCheckboxes =
    accessLevel === 'Check Access' ||
    accessLevel === 'Approve Access' ||
    accessLevel === 'Edit Access' ||
    accessLevel === 'Full Access'

  const checkboxCondition = null // Always show checkboxes (match Receipts/Sales behavior)

  // Filter collections based on active card filter
  const getFilteredCollections = () => {
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
  }

  const filteredCollections = getFilteredCollections()

  // Calculate totals based on filtered data
  const getFilteredTotalCollectedAmount = () => {
    return filteredCollections?.reduce((sum, c) => sum + (parseFloat(c.collected_amount) || 0), 0) || 0
  }

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

  // ─── Helper: fetch full collection data then download as PDF ─────────────────
  const fetchAndDownloadPDF = async (selectedRows, copyType) => {
    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authentication token found')

      const collectionIds = selectedRows
        .map((row) => encodeURIComponent(String(row.id)))
        .join(',')

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/collections/print/${collectionIds}?copyType=${copyType}`,
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
      console.log('PDF Data received:', data)
      if (!Array.isArray(data))
        throw new Error('Invalid data format received from server')

      await generateCollectionPDF(data, copyType)

      setToast({
        type: 'success',
        message: `${data.length} collection PDF(s) downloaded (${copyType === 'customer' ? 'Customer' : 'Internal'} Copy)`,
      })
    } catch (error) {
      console.error('Error generating collection PDF:', error)
      setToast({ type: 'error', message: error.message || 'Failed to generate PDF' })
    }
  }

  // Function to filter checkbox actions based on selected rows
  const getFilteredCheckboxActions = (selectedRows) => {
    const allActions = [
      {
        label: 'Approve Selected',
        onClick: async (selectedRows) => {
          const approvableRows = selectedRows.filter(
            (row) => row.state === 'PREPARED' || row.state === 'CHECKED',
          )

          if (approvableRows.length === 0) {
            setToast({
              type: 'error',
              message: 'No collections are eligible for approval',
            })
            return
          }

          setConfirmModal({
            isOpen: true,
            onConfirm: async () => {
              try {
                console.log('Approving collections:', approvableRows)

                const token = sessionStorage.getItem('authenticated')
                if (!token) {
                  throw new Error('No authentication token found')
                }

                const updates = approvableRows.map((row) => ({
                  id: row.id,
                  currentState: row.state,
                }))

                const response = await fetch(
                  `${import.meta.env.VITE_SERVER_LINK}/collections/collection-state`,
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

                setToast({
                  type: 'success',
                  message:
                    result.message ||
                    `${approvableRows.length} collection(s) approved successfully`,
                })
              } catch (error) {
                console.error('Error approving collections:', error)
                setToast({
                  type: 'error',
                  message: error.message || 'Failed to approve collections',
                })
              }
            },
            title: 'Approve Collections',
            message: `Are you sure you want to approve ${approvableRows.length} collection(s)?`,
          })
        },
      },
      {
        label: 'Cancel Selected',
        style: 'orange',
        onClick: async (selectedRows) => {
          const cancellableRows = selectedRows.filter(
            (row) =>
              row.state !== 'CANCELLED' &&
              row.state !== 'REJECTED' &&
              row.state !== 'APPROVED',
          )

          if (cancellableRows.length === 0) {
            setToast({
              type: 'error',
              message: 'No collections are eligible for cancellation',
            })
            return
          }

          setConfirmModal({
            isOpen: true,
            onConfirm: async () => {
              try {
                console.log('Cancelling collections:', cancellableRows)

                const token = sessionStorage.getItem('authenticated')
                if (!token) {
                  throw new Error('No authentication token found')
                }

                const updates = cancellableRows.map((row) => ({
                  id: row.id,
                  currentState: row.state,
                }))

                const response = await fetch(
                  `${import.meta.env.VITE_SERVER_LINK}/collections/cancel-state`,
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

                setToast({
                  type: 'success',
                  message:
                    result.message ||
                    `${cancellableRows.length} collection(s) cancelled successfully`,
                })
              } catch (error) {
                console.error('Error cancelling collections:', error)
                setToast({
                  type: 'error',
                  message: error.message || 'Failed to cancel collections',
                })
              }
            },
            title: 'Cancel Collections',
            message: `Are you sure you want to cancel ${cancellableRows.length} collection(s)?`,
            type: 'danger',
          })
        },
      },
      {
        separator: true,
      },
      {
        label: 'Internal Copy',
        icon: <FileText size={14} />,
        onClick: (selectedRows) => fetchAndDownloadPDF(selectedRows, 'internal'),
        style: 'blue',
      },
      {
        label: 'Customer Copy',
        icon: <Building size={14} />,
        onClick: (selectedRows) => fetchAndDownloadPDF(selectedRows, 'customer'),
        style: 'orange',
      },
    ]

    return allActions.filter((action) => {
      if (action.label === 'Approve Selected') {
        return selectedRows.some(
          (row) => row.state === 'PREPARED' || row.state === 'CHECKED',
        )
      }
      if (action.label === 'Cancel Selected') {
        return selectedRows.some(
          (row) =>
            row.state !== 'CANCELLED' &&
            row.state !== 'REJECTED' &&
            row.state !== 'APPROVED',
        )
      }
      return true
    })
  }

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  if (isAdding)
    return (
      <RouteProtection routeName="collections">
        <CollectionsForm
          onBack={() => {
            setIsAdding(false)
            setSelectedSales([])
            setSelectedSalesItems([])
          }}
          onSuccess={async (nextToast) => {
            if (nextToast) setToast(nextToast)
            await refetchCollections()
            setSelectedSales([])
            setSelectedSalesItems([])
            await fetchToBeCollected()
            setIsAdding(false)
          }}
          preSelectedSales={selectedSales}
          preSelectedSalesItems={selectedSalesItems}
        />
      </RouteProtection>
    )

  if (isViewing)
    return (
      <RouteProtection routeName="collections">
        <CollectionsForm
          isViewMode={true}
          collectionData={viewingCollection}
          onBack={() => {
            setIsViewing(false)
            setViewingCollection(null)
          }}
        />
      </RouteProtection>
    )

  if (isEditing)
    return (
      <RouteProtection routeName="collections">
        <CollectionsForm
          isEditMode={true}
          isPostedLocked={isPostedEdit}
          collectionData={editingCollection}
          onBack={() => {
            setIsEditing(false)
            setEditingCollection(null)
            setIsPostedEdit(false)
          }}
          onSuccess={async (nextToast) => {
            if (nextToast) setToast(nextToast)
            await refetchCollections()
          }}
        />
      </RouteProtection>
    )

  if (loading) {
    return <LoadingScreen label="Loading Collections Data..." />
  }

  if (error) {
    return (
      <div className="p-10 flex items-center justify-center">
        <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl shadow-sm">
          <h3 className="text-red-800 font-bold uppercase text-sm">System Error</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      {toast && (
        <DynamicToast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
      <DynamicConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={() => {
          if (confirmModal.onConfirm) {
            confirmModal.onConfirm()
          }
          setConfirmModal({ ...confirmModal, isOpen: false })
        }}
        title={confirmModal.title}
        message={confirmModal.message}
        type="warning"
      />

      {/* --- HEADER SECTION --- */}
      <div className="shrink-0">
        {/* Tab Navigation */}

        {activeTab === 'collections' && (
          <>
            {/* <nav className="flex items-center gap-2 mb-6 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            <span>Treasury</span>
            <ArrowRight size={10} />
            <span className="text-black">Account Collections</span>
          </nav> */}

            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4"
            >
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-black rounded-lg text-red-500 shadow-lg shadow-black/20">
                    <Layers size={24} />
                  </div>
                  <h1 className="text-4xl font-black text-black tracking-tighter">
                    <span className="text-red-600 italic">Collections</span>
                  </h1>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <button className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm">
                  <Download size={14} />
                  EXPORT DATA
                </button>
                <ProtectedAction routeName="collections">
                  <button
                    onClick={() => setActiveTab('toBeCollected')}
                    className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase"
                  >
                    <FilePlus size={14} />
                    New Collection
                  </button>
                </ProtectedAction>
              </div>
            </motion.div>

            {/* --- SUMMARY TILES --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <SummaryTile
                label="Total Collections"
                value={activeFilter ? filteredCollections?.length || 0 : collections?.length || 0}
                subText="Fetched"
                color="emerald"
                onClick={() => setActiveFilter(null)}
                isActive={activeFilter === null}
                icon={Layers}
              />
              <SummaryTile
                label="Prepared"
                value={
                  activeFilter === 'PREPARED'
                    ? filteredCollections?.length || 0
                    : collections?.filter((c) => c.state === 'PREPARED').length || 0
                }
                subText="Transactions"
                color="rose"
                onClick={() => setActiveFilter('PREPARED')}
                isActive={activeFilter === 'PREPARED'}
                icon={ClipboardList}
              />
              <SummaryTile
                label="Checked"
                value={
                  activeFilter === 'CHECKED'
                    ? filteredCollections?.length || 0
                    : collections?.filter((c) => c.state === 'CHECKED').length || 0
                }
                subText="Transactions"
                color="blue"
                onClick={() => setActiveFilter('CHECKED')}
                isActive={activeFilter === 'CHECKED'}
                icon={CheckCircle}
              />
              <SummaryTile
                label="Cancelled"
                value={
                  activeFilter === 'CANCELLED'
                    ? filteredCollections?.length || 0
                    : collections?.filter((c) => c.state === 'CANCELLED').length || 0
                }
                subText="Transactions"
                color="orange"
                onClick={() => setActiveFilter('CANCELLED')}
                isActive={activeFilter === 'CANCELLED'}
                icon={XCircle}
              />
              <SummaryTile
                label="Approved"
                value={
                  activeFilter === 'APPROVED'
                    ? filteredCollections?.length || 0
                    : collections?.filter((c) => c.state === 'APPROVED').length || 0
                }
                subText="Transactions"
                color="emerald"
                onClick={() => setActiveFilter('APPROVED')}
                isActive={activeFilter === 'APPROVED'}
                icon={ShieldCheck}
              />
              <SummaryTile
                label="Total Collected"
                value={`₱ ${getFilteredTotalCollectedAmount().toLocaleString('en-PH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) || '0.00'}`}
                subText="PHP"
                color="dark"
                icon={Wallet}
              />
            </div>
          </>
        )}

        {activeTab === 'toBeCollected' && (
          <>
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4"
            >
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-black rounded-lg text-red-500 shadow-lg shadow-black/20">
                    <Wallet size={24} />
                  </div>
                  <h1 className="text-4xl font-black text-black tracking-tighter">
                    <span className="text-red-600 italic">To Be Collected</span>
                  </h1>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <button className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm">
                  <Download size={14} />
                  EXPORT DATA
                </button>
                <ProtectedAction routeName="collections">
                  <button
                    onClick={() => setActiveTab('toBeCollected')}
                    className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase"
                  >
                    <FilePlus size={14} />
                    New Collection
                  </button>
                </ProtectedAction>
              </div>
            </motion.div>

            {/* --- SUMMARY TILES --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <SummaryTile
                label="Approved Sales"
                value={
                  toBeCollectedData?.reduce((count, c) => {
                    return (
                      count +
                      (c.sales?.filter((s) => s.state === 'APPROVED').length || 0)
                    )
                  }, 0) || 0
                }
                subText="Transactions"
                color="blue"
                icon={CheckCircle}
              />
              <SummaryTile
                label="Total Customers"
                value={toBeCollectedData?.length || 0}
                subText="Clients"
                color="orange"
                icon={Building}
              />
              <SummaryTile
                label="Total Unpaid Amount"
                value={`₱ ${toBeCollectedData
                    ?.reduce((sum, c) => sum + (parseFloat(c.totalUnpaid) || 0), 0)
                    .toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }) || '0.00'}`}
                subText="PHP"
                color="dark"
                icon={Wallet}
              />
            </div>
          </>
        )}
      </div>
      <div className="flex items-center gap-2 mb-2 p-1 bg-white rounded-xl w-fit border border-gray-200 shadow-sm">
        <button
          onClick={() => setActiveTab('collections')}
          className={`px-5 py-2 text-xs font-bold tracking-wider rounded-lg transition-all relative ${
            activeTab === 'collections'
              ? 'bg-red-600 text-white shadow'
              : 'text-gray-600 hover:text-black hover:bg-gray-100'
          }`}
        >
          COLLECTED
        </button>

        <button
          onClick={() => setActiveTab('toBeCollected')}
          className={`px-5 py-2 text-xs font-bold tracking-wider rounded-lg transition-all relative ${
            activeTab === 'toBeCollected'
              ? 'bg-red-600 text-white shadow'
              : 'text-gray-600 hover:text-black hover:bg-gray-100'
          }`}
        >
          TO BE COLLECTED
        </button>
      </div>
      {/* --- TABLE SECTION --- */}
      {activeTab === 'collections' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex-1 min-h-0 bg-white rounded-2xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100"
        >
          {console.log('Rendering DynamicTable with collections:', collections)}
          <DynamicTable
            data={filteredCollections}
            title="Collections Ledger"
            enableDateFilter={true}
            dateFrom={pendingDateFrom}
            dateTo={pendingDateTo}
            onDateFromChange={setPendingDateFrom}
            onDateToChange={setPendingDateTo}
            onApplyDateFilter={applyDateFilters}
            onClearDateFilter={clearDateFilters}
            enableAddButton={false}
            enableCheckbox={enableCheckboxes}
            enableActionColumn={true}
            checkboxColumn="id"
            checkboxCondition={checkboxCondition}
            columns={[
              {
                key: 'id',
                label: 'ID',
              },
              {
                key: 'document_reference',
                label: 'Document Reference',
              },
              {
                key: 'customer',
                label: 'Customer',
              },
              {
                key: 'collection_date',
                label: 'Collection Date',
              },
              {
                key: 'mode_of_payment',
                label: 'Mode of Payment',
              },
              {
                key: 'collected_amount',
                label: 'Collected Amount',
              },
              {
                key: 'remarks',
                label: 'Remarks',
              },
              {
                key: 'state',
                label: 'State',
              },
            ]}
            badgeColumns={[
              {
                column: 'state',
                values: {
                  PREPARED: 'orange',
                  CHECKED: 'blue',
                  APPROVED: 'green',
                  REJECTED: 'red',
                  CANCELLED: 'orange',
                },
              },
            ]}
            actionButtons={[
              {
                label: 'View',
                onClick: async (row) => {
                  try {
                    console.log('Viewing collection:', row)

                    const token = sessionStorage.getItem('authenticated')
                    if (!token) {
                      throw new Error('No authentication token found')
                    }

                    const response = await fetch(
                      `${import.meta.env.VITE_SERVER_LINK}/collections/${row.id}`,
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

                    console.log('Collection details fetched:', result)
                    setViewingCollection(result)
                    setIsViewing(true)
                  } catch (error) {
                    console.error('Error fetching collection details:', error)
                    setToast({
                      type: 'error',
                      message: error.message || 'Failed to fetch collection details',
                    })
                  }
                },
              },
              {
                label: 'Edit',
                onClick: async (row) => {
                  try {
                    console.log('Editing collection:', row)

                    setIsPostedEdit(isPostedDocument(row.state))

                    const token = sessionStorage.getItem('authenticated')
                    if (!token) {
                      throw new Error('No authentication token found')
                    }

                    const response = await fetch(
                      `${import.meta.env.VITE_SERVER_LINK}/collections/${row.id}`,
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

                    console.log('Collection details fetched for editing:', result)
                    setEditingCollection(result)
                    setIsEditing(true)
                  } catch (error) {
                    console.error(
                      'Error fetching collection details for editing:',
                      error,
                    )
                    setToast({
                      type: 'error',
                      message: error.message || 'Failed to fetch collection details',
                    })
                  }
                },
              },
              {
                label: 'Reverse',
                onClick: (row) => {
                  if (!isPostedDocument(row.state)) {
                    setToast({
                      type: 'error',
                      message: `Only APPROVED/POSTED transactions can be reversed (current: ${row.state}).`,
                    })
                    return
                  }

                  setConfirmModal({
                    isOpen: true,
                    onConfirm: async () => {
                      try {
                        const reversed = await createReversal({
                          dbName: 'collections',
                          dbId: row.id,
                          remarks: 'Reversal initiated from the Collections module',
                        })
                        setToast({
                          type: 'success',
                          message: reversed.message || 'Reversal created',
                        })
                        navigate('/adjustments')
                        await refetchCollections()
                      } catch (error) {
                        console.error('Error creating collection reversal:', error)
                        setToast({
                          type: 'error',
                          message: error.message || 'Failed to create reversal',
                        })
                      }
                    },
                    title: 'Reverse Collection',
                    message: `Create a REVERSAL for COLLECTION ${row.id}? The original transaction stays unchanged; the reversal (DR/CR mirrored) is created as a PREPARED adjustment and must be approved before it posts to the general journal.`,
                    type: 'danger',
                  })
                },
              },
            ]}
            checkboxActions={getFilteredCheckboxActions([])}
            checkboxActionsFilter={getFilteredCheckboxActions}
            enableInfiniteScroll={true}
            hasMore={hasMore}
            isLoadingMore={loadingMore}
            onLoadMore={() =>
              loadMore({ dateFrom: activeDateFrom, dateTo: activeDateTo })
            }
          />
        </motion.div>
      )}

      {activeTab === 'toBeCollected' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-8 pb-4"
        >
          {loadingToBeCollected ? (
            <div className="col-span-1 md:col-span-12 h-full w-full flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-black uppercase tracking-[3px] text-gray-400">
                Loading To Be Collected...
              </p>
            </div>
          ) : (
            <>
              {/* LEFT COLUMN: Customer Table */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="col-span-1 md:col-span-4 flex flex-col min-h-0 bg-white rounded-2xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100"
              >
                <DynamicTable
                  data={toBeCollectedData}
                  title=""
                  enableDateFilter={false}
                  enableAddButton={false}
                  enableCheckbox={false}
                  enableActionColumn={true}
                  enableRowClick={true}
                  returnColumn="customerId"
                  onRowClick={(customerId, row) =>
                    setExpandedCustomer(
                      expandedCustomer === customerId ? null : customerId,
                    )
                  }
                  checkboxColumn="customerId"
                  checkboxCondition={(row) => {
                    // Only allow selecting from same customer
                    if (selectedSales.length === 0) return true
                    return selectedSales[0].customer_id === row.customer_id
                  }}
                  onCheckboxChange={(selectedIds) => {
                    const selectedCustomers = toBeCollectedData.filter((row) =>
                      selectedIds.includes(row.customerId),
                    )
                    const allSales = selectedCustomers.flatMap((c) => c.sales)
                    setSelectedSales(allSales)
                  }}
                  checkboxActions={[
                    {
                      label: 'Collect Selected',
                      onClick: async (selectedRows) => {
                        const allSales = selectedRows.flatMap((c) => c.sales)
                        const salesIds = allSales.map((s) => s.id)
                        const items = await fetchSalesItems(salesIds)
                        if (items.length === 0) {
                          setToast({
                            type: 'error',
                            message:
                              'This sales order has no sales items and cannot be collected.',
                          })
                          return
                        }
                        setSelectedSales(allSales)
                        setSelectedSalesItems(items)
                        setIsAdding(true)
                      },
                      style: 'red',
                    },
                  ]}
                  actionButtons={[
                    {
                      label: 'Collect',
                      icon: <Layers size={14} />,
                      onClick: async (row) => {
                        const salesIds = row.sales.map((s) => s.id)
                        const items = await fetchSalesItems(salesIds)
                        if (items.length === 0) {
                          setToast({
                            type: 'error',
                            message:
                              'This sales order has no sales items and cannot be collected.',
                          })
                          return
                        }
                        setSelectedSales(row.sales)
                        setSelectedSalesItems(items)
                        setIsAdding(true)
                      },
                    },
                  ]}
                  columns={[
                    { key: 'customerName', label: 'Customer' },
                    {
                      key: 'totalUnpaid',
                      label: 'Total Unpaid',
                      render: (value) => (
                        <span>
                          <span className="text-green-600">₱</span>
                          <span className="ml-1">
                            {isNaN(value)
                              ? '0.00'
                              : parseFloat(value).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                          </span>
                        </span>
                      ),
                    },
                  ]}
                  hiddenColumns={new Set(['customerId', 'sales'])}
                  highlightRow={{ column: 'customerId', value: expandedCustomer }}
                />
              </motion.div>

              {/* RIGHT COLUMN: Sales Table */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="col-span-1 md:col-span-8 flex flex-col min-h-0 bg-white rounded-2xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100"
              >
                <DynamicTable
                  data={
                    expandedCustomer
                      ? toBeCollectedData.find(
                          (c) => c.customerId === expandedCustomer,
                        )?.sales || []
                      : []
                  }
                  title=""
                  enableDateFilter={false}
                  enableAddButton={false}
                  enableCheckbox={true}
                  enableActionColumn={false}
                  checkboxColumn="id"
                  checkboxCondition={(row) => {
                    if (selectedSales.length === 0) return true
                    return selectedSales[0].customer_id === row.customer_id
                  }}
                  onCheckboxChange={(selectedIds) => {
                    const customer = toBeCollectedData.find(
                      (c) => c.customerId === expandedCustomer,
                    )
                    if (!customer) return
                    const selectedRows = customer.sales.filter((row) =>
                      selectedIds.includes(row.id),
                    )
                    setSelectedSales(selectedRows)
                  }}
                  checkboxActions={[
                    {
                      label: 'Collect Selected',
                      onClick: async (selectedRows) => {
                        const salesIds = selectedRows.map((s) => s.id)
                        const items = await fetchSalesItems(salesIds)
                        if (items.length === 0) {
                          setToast({
                            type: 'error',
                            message:
                              'This sales order has no sales items and cannot be collected.',
                          })
                          return
                        }
                        setSelectedSales(selectedRows)
                        setSelectedSalesItems(items)
                        setIsAdding(true)
                      },
                      style: 'red',
                    },
                  ]}
                  columns={[
                    { key: 'id', label: 'Sales ID' },
                    { key: 'doc_ref', label: 'Doc Ref' },
                    { key: 'terms', label: 'Terms' },
                    { key: 'date_delivered', label: 'Date Delivered' },
                    { key: 'date_due', label: 'Date Due' },
                    { key: 'remarks', label: 'Remarks' },
                    {
                      key: 'amount_due',
                      label: 'Amount Due',
                      render: (value) => (
                        <span>
                          <span className="text-green-600">₱</span>
                          <span className="ml-1">
                            {isNaN(value)
                              ? '0.00'
                              : parseFloat(value).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                          </span>
                        </span>
                      ),
                    },
                    { key: 'status', label: 'Status' },
                    { key: 'state', label: 'State' },
                  ]}
                  hiddenColumns={
                    new Set([
                      'customer_id',
                      'customer_name',
                      'totalUnpaid',
                      'unpaidAmount',
                      'sales_number',
                    ])
                  }
                  badgeColumns={[
                    {
                      column: 'status',
                      values: {
                        COLLECTED: 'green',
                        'NOT COLLECTED': 'red',
                        'PARTIALLY COLLECTED': 'yellow',
                        PAID: 'green',
                        UNPAID: 'red',
                      },
                    },
                    {
                      column: 'state',
                      values: {
                        PREPARED: 'orange',
                        CHECKED: 'blue',
                        APPROVED: 'green',
                        REJECTED: 'red',
                        CANCELLED: 'orange',
                      },
                    },
                  ]}
                />
              </motion.div>
            </>
          )}
        </motion.div>
      )}
    </div>
  )
}

function SummaryTile({ label, value, subText, color, onClick, isActive, icon: Icon }) {
  const theme = {
    emerald: {
      text: 'text-emerald-600 dark:text-emerald-400',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      bar: 'bg-emerald-500',
      bg: 'bg-emerald-500',
      textOnActive: 'text-white'
    },
    amber: {
      text: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      bar: 'bg-amber-500',
      bg: 'bg-amber-500',
      textOnActive: 'text-white'
    },
    orange: {
      text: 'text-orange-600 dark:text-orange-400',
      badgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
      bar: 'bg-orange-500',
      bg: 'bg-orange-500',
      textOnActive: 'text-white'
    },
    rose: {
      text: 'text-rose-600 dark:text-rose-400',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      bar: 'bg-rose-500',
      bg: 'bg-rose-500',
      textOnActive: 'text-white'
    },
    blue: {
      text: 'text-blue-600 dark:text-blue-400',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      bar: 'bg-blue-500',
      bg: 'bg-blue-500',
      textOnActive: 'text-white'
    },
    dark: {
      text: 'text-emerald-400',
      badgeBg: 'bg-emerald-950 text-emerald-300 border-emerald-800/50',
      bar: 'bg-emerald-400',
      bg: 'bg-emerald-400',
      textOnActive: 'text-white'
    },
  }[color] || {
    text: 'text-gray-700',
    badgeBg: 'bg-gray-50 text-gray-700 border-gray-200',
    bar: 'bg-gray-400',
    bg: 'bg-gray-400',
    textOnActive: 'text-white'
  }

  const bgClass = color === 'dark'
    ? 'bg-slate-900 text-white border-slate-800'
    : 'bg-white text-gray-900 border-gray-200/80 shadow-xs'

  const activeBgClass = isActive
    ? `${theme.bg} text-white border-transparent`
    : bgClass

  const isClickable = label !== 'Total Collected' && label !== 'Total Unpaid Amount'

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`${activeBgClass} p-3 rounded-xl border relative overflow-hidden flex flex-col justify-between h-full ${isClickable ? 'cursor-pointer hover:scale-105 hover:shadow-lg group' : ''} transition-all duration-300`}
    >
      {/* Bottom Accent Indicator - Animates on hover (behind content) */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${theme.bar} ${isClickable ? 'group-hover:h-full' : ''} transition-all duration-300 z-0`} />

      {/* Content wrapper with higher z-index */}
      <div className="relative z-10 flex flex-col justify-between h-full">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2 mb-2">
          {(label === 'Total Collected' || label === 'Total Unpaid Amount') ? (
            <span className={`text-xs font-semibold tracking-wide uppercase text-white`}>
              {label}
            </span>
          ) : (
            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${isActive ? 'bg-white text-gray-900 border-white' : theme.badgeBg} ${isClickable ? 'group-hover:bg-white group-hover:text-gray-900 group-hover:border-white' : ''}`}>
              {label}
            </span>
          )}
          <span className={`text-xs font-medium ${isActive ? 'text-white/80' : 'text-gray-400'} ${isClickable ? 'group-hover:text-white/80' : ''}`}>
            {subText}
          </span>
        </div>

        {/* Value Row with Icon */}
        <div className="flex items-center gap-2 my-1">
          {Icon && (
            <Icon size={20} className={`${isActive ? 'text-white' : ((label === 'Total Collected' || label === 'Total Unpaid Amount') ? theme.text : color === 'dark' ? theme.text : 'text-gray-600')} ${isClickable ? 'group-hover:text-white' : ''} transition-colors`} />
          )}
          <span className={`text-2xl font-bold font-mono tracking-tight ${isActive ? 'text-white' : ((label === 'Total Collected' || label === 'Total Unpaid Amount') ? theme.text : 'text-black')} ${isClickable ? 'group-hover:text-white' : ''}`}>
            {value}
          </span>
        </div>
      </div>
    </div>
  )
}
