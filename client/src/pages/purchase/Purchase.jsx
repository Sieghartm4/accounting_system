import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FilePlus,
  ShoppingCart,
  Package,
  ShieldCheck,
  TrendingDown,
  ArrowRight,
  Download,
  FileText,
  Building,
  CheckCircle,
  XCircle,
  ClipboardList,
  Wallet,
} from 'lucide-react'
import DynamicTable from '../../components/DynamicTable'
import DynamicToast from '../../components/DynamicToast'
import DynamicConfirmModal from '../../components/DynamicConfirmModal'
import RouteProtection from '../../components/RouteProtection'
import ProtectedAction from '../../components/ProtectedAction'
import usePurchase from './usePurchase'
import PurchaseForm from './PurchaseForm'
import { getAccessLevel } from '../../utils/routeProtection'
import { generatePurchasePDF } from '../../utils/generatePurchasePDF'
import { isPostedDocument, createReversal } from '../../utils/journalLifecycle'
import LoadingScreen from '../../components/LoadingScreen'
import connectRealtime from '../../utils/realtimeSocket'
import { API } from '../../api/endpoints'
import { useNotificationsState } from '../../components/layout/NotificationContext'
import { buildUnreadDocCounts } from '../../hooks/useNotifications'

export default function Purchase() {
  return (
    <RouteProtection routeName="purchase">
      <PurchaseContent />
    </RouteProtection>
  )
}

function PurchaseContent() {
  const {
    purchases,
    loading,
    loadingMore,
    hasMore,
    error,
    refetchPurchases,
    loadMore,
    prependPurchase,
  } = usePurchase()
  const { markReadForDocument, items: notificationItems } = useNotificationsState()
  const unreadRowMap = useMemo(
    () => buildUnreadDocCounts(notificationItems, 'purchase'),
    [notificationItems],
  )
  const [searchParams, setSearchParams] = useSearchParams()

  console.log('PurchaseContent - purchases:', purchases)
  console.log('PurchaseContent - loading:', loading)
  console.log('PurchaseContent - error:', error)
  const [isAdding, setIsAdding] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isPostedEdit, setIsPostedEdit] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState(null)
  const [isViewing, setIsViewing] = useState(false)
  const [viewingPurchase, setViewingPurchase] = useState(null)
  const [toast, setToast] = useState(null)
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
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const incomingPrefill = location.state?.prefillPurchaseData
    if (incomingPrefill) {
      setPrefillPurchaseData(incomingPrefill)
      setIsAdding(true)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, navigate, location.pathname])

  useEffect(() => {
    const id = searchParams.get('id')
    if (!id) return

    const fetchPurchase = async () => {
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
        setToast({
          type: 'error',
          message: err.message || 'Failed to fetch purchase details',
        })
      }
    }

    fetchPurchase()
  }, [searchParams, setSearchParams])

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

  // Check if user has access to enable checkboxes
  const user = JSON.parse(sessionStorage.getItem('auth_user') || '{}')
  const accessLevel = getAccessLevel('purchase', user)
  const enableCheckboxes =
    accessLevel === 'Check Access' ||
    accessLevel === 'Approve Access' ||
    accessLevel === 'Edit Access' ||
    accessLevel === 'Full Access'

  const checkboxCondition = null // Always show checkboxes (match other pages)

  // Filter purchases based on active card filter
  const getFilteredPurchases = () => {
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
  }

  const filteredPurchases = getFilteredPurchases()

  // Calculate totals based on filtered data
  const getFilteredTotalAmount = () => {
    return filteredPurchases?.reduce((sum, p) => sum + (parseFloat(p.amount_due) || 0), 0) || 0
  }

  // ─── Helper: fetch full purchase data then download as PDF ─────────────────
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
      console.log('PDF Data received:', data)
      if (!Array.isArray(data))
        throw new Error('Invalid data format received from server')

      await generatePurchasePDF(data, copyType)

      setToast({
        type: 'success',
        message: `${data.length} purchase PDF(s) downloaded (${copyType === 'customer' ? 'Vendor' : 'Internal'} Copy)`,
      })
    } catch (error) {
      console.error('Error generating purchase PDF:', error)
      setToast({ type: 'error', message: error.message || 'Failed to generate PDF' })
    }
  }

  // ─── Date Filter Functions ─────────────────────────────────────────────────
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
              message: 'No purchases are eligible for approval',
            })
            return
          }

          setConfirmModal({
            isOpen: true,
            onConfirm: async () => {
              try {
                console.log('Approving purchases:', approvableRows)

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

                setToast({
                  type: 'success',
                  message:
                    approveResult.message ||
                    `${approvableRows.length} purchase(s) approved successfully`,
                })
                markReadForDocument(
                  'purchase',
                  approvableRows.map((row) => row.id),
                )
              } catch (error) {
                console.error('Error approving purchases:', error)
                setToast({
                  type: 'error',
                  message: error.message || 'Failed to approve purchases',
                })
              }
            },
            title: 'Approve Purchases',
            message: `Are you sure you want to approve ${approvableRows.length} purchase(s)?`,
          })
        },
      },
      {
        label: 'Cancel Selected',
        style: 'orange',
        onClick: async (selectedRows) => {
          const cancellableRows = selectedRows.filter(
            (row) => row.state !== 'CANCELLED' && row.state !== 'REJECTED' && row.state !== 'APPROVED',
          )

          if (cancellableRows.length === 0) {
            setToast({
              type: 'error',
              message: 'No purchases are eligible for cancellation',
            })
            return
          }

          setConfirmModal({
            isOpen: true,
            onConfirm: async () => {
              try {
                console.log('Cancelling purchases:', cancellableRows)

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

                setToast({
                  type: 'success',
                  message:
                    cancelResult.message ||
                    `${cancellableRows.length} purchase(s) cancelled successfully`,
                })
                markReadForDocument(
                  'purchase',
                  cancellableRows.map((row) => row.id),
                )
              } catch (error) {
                console.error('Error cancelling purchases:', error)
                setToast({
                  type: 'error',
                  message: error.message || 'Failed to cancel purchases',
                })
              }
            },
            title: 'Cancel Purchases',
            message: `Are you sure you want to cancel ${cancellableRows.length} purchase(s)?`,
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
        label: 'Vendor Copy',
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
          (row) => row.state !== 'CANCELLED' && row.state !== 'REJECTED' && row.state !== 'APPROVED',
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
      <RouteProtection routeName="purchase">
        <PurchaseForm
          purchaseData={prefillPurchaseData}
          onBack={() => {
            setIsAdding(false)
            setPrefillPurchaseData(null)
          }}
          onSuccess={async (nextToast) => {
            if (nextToast) setToast(nextToast)
            setPrefillPurchaseData(null)
            await refetchPurchases()
            setIsAdding(false)
          }}
        />
      </RouteProtection>
    )

  if (isEditing)
    return (
      <RouteProtection routeName="purchase">
        <PurchaseForm
          isViewMode={false}
          isEditMode={true}
          isPostedLocked={isPostedEdit}
          purchaseData={editingPurchase}
          onBack={() => {
            setIsEditing(false)
            setIsPostedEdit(false)
          }}
          onSuccess={async (nextToast) => {
            if (nextToast) setToast(nextToast)
            await refetchPurchases()
            setIsEditing(false)
            setIsPostedEdit(false)
          }}
        />
      </RouteProtection>
    )

  if (isViewing)
    return (
      <RouteProtection routeName="purchase">
        <PurchaseForm
          isViewMode={true}
          purchaseData={viewingPurchase}
          onBack={() => setIsViewing(false)}
          onSuccess={async (nextToast) => {
            if (nextToast) setToast(nextToast)
            await refetchPurchases()
            setIsViewing(false)
          }}
        />
      </RouteProtection>
    )

  if (loading) {
    return <LoadingScreen label="Loading Purchase Data..." />
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
        {/* <nav className="flex items-center gap-2 mb-6 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <span>Commerce</span>
          <ArrowRight size={10} />
          <span className="text-black">Sales Performance</span>
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
                <ShoppingCart size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Purchase <span className="text-red-600 italic">Order</span>
              </h1>
            </div>
            {/* <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">
              Monitor real-time sales transactions and commercial volume.
            </p> */}
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <button className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm">
              <Download size={14} />
              EXPORT DATA
            </button>
            <ProtectedAction routeName="purchase">
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase"
              >
                <FilePlus size={14} />
                New Purchase
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

        {/* --- SUMMARY TILES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <SummaryTile
            label="Total Purchases"
            value={activeFilter ? filteredPurchases?.length || 0 : purchases?.length || 0}
            subText="Fetched"
            color="emerald"
            onClick={() => setActiveFilter(null)}
            isActive={activeFilter === null}
            icon={ShoppingCart}
          />
          <SummaryTile
            label="Prepared"
            value={
              activeFilter === 'PREPARED'
                ? filteredPurchases?.length || 0
                : purchases?.filter((p) => p.state === 'PREPARED').length || 0
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
                ? filteredPurchases?.length || 0
                : purchases?.filter((p) => p.state === 'CHECKED').length || 0
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
                ? filteredPurchases?.length || 0
                : purchases?.filter((p) => p.state === 'CANCELLED').length || 0
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
                ? filteredPurchases?.length || 0
                : purchases?.filter((p) => p.state === 'APPROVED').length || 0
            }
            subText="Transactions"
            color="emerald"
            onClick={() => setActiveFilter('APPROVED')}
            isActive={activeFilter === 'APPROVED'}
            icon={ShieldCheck}
          />
          <SummaryTile
            label="Total Amount Due"
            value={`₱ ${getFilteredTotalAmount().toLocaleString('en-PH', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }) || '0.00'}`}
            subText="PHP"
            color="dark"
            icon={Wallet}
          />
        </div>
      </div>

      {/* --- TABLE SECTION --- */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex-1 min-h-0 bg-white rounded-2xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100"
      >
        {console.log('About to render DynamicTable with data:', purchases)}
        <DynamicTable
          data={filteredPurchases}
          title="Purchase Ledger"
          unreadRowMap={unreadRowMap}
          enableDateFilter={true}
          dateFrom={pendingDateFrom}
          dateTo={pendingDateTo}
          onDateFromChange={setPendingDateFrom}
          onDateToChange={setPendingDateTo}
          onApplyDateFilter={applyDateFilters}
          onClearDateFilter={clearDateFilters}
          enableAddButton={false}
          enableCheckbox={enableCheckboxes}
          checkboxColumn="id"
          checkboxCondition={checkboxCondition}
          enableActionColumn={true}
          actionButtons={[
            {
              label: 'View',
              onClick: async (row) => {
                try {
                  console.log('View purchase:', row)

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

                  console.log('Purchase details:', viewResult)

                  // Set purchase data for viewing
                  setViewingPurchase(viewResult)
                  setIsViewing(true)
                  markReadForDocument('purchase', [row.id])
                } catch (error) {
                  console.error('Error fetching purchase details:', error)
                  setToast({
                    type: 'error',
                    message: error.message || 'Failed to fetch purchase details',
                  })
                }
              },
            },
            {
              label: 'Edit',
              onClick: async (row) => {
                try {
                  console.log('Editing purchase:', row)

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

                  console.log('Purchase details for editing:', editResult)

                  // Set purchase data for editing
                  setEditingPurchase(editResult)
                  setIsEditing(true)
                  markReadForDocument('purchase', [row.id])
                } catch (error) {
                  console.error(
                    'Error fetching purchase details for editing:',
                    error,
                  )
                  setToast({
                    type: 'error',
                    message: error.message || 'Failed to fetch purchase details',
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
                        dbName: 'purchase',
                        dbId: row.id,
                        remarks: 'Reversal initiated from the Purchase module',
                      })
                      setToast({
                        type: 'success',
                        message: reversed.message || 'Reversal created',
                      })
                      markReadForDocument('purchase', [row.id])
                      navigate('/adjustments')
                      await refetchPurchases()
                    } catch (error) {
                      console.error('Error creating purchase reversal:', error)
                      setToast({
                        type: 'error',
                        message: error.message || 'Failed to create reversal',
                      })
                    }
                  },
                  title: 'Reverse Purchase',
                  message: `Create a REVERSAL for PURCHASE ${row.id}? The original transaction stays unchanged; the reversal (DR/CR mirrored) is created as a PREPARED adjustment and must be approved before it posts to the general journal.`,
                  type: 'danger',
                })
              },
            },
          ]}
          badgeColumns={[
            {
              column: 'status',
              values: {
                PAID: 'green',
                UNPAID: 'red',
                'PARTIALLY PAID': 'yellow',
                OVERPAID: 'orange',
                REJECTED: 'red',
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

  const isClickable = label !== 'Total Amount Due'

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
          {label === 'Total Amount Due' ? (
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
            <Icon size={20} className={`${isActive ? 'text-white' : (label === 'Total Amount Due' ? theme.text : color === 'dark' ? theme.text : 'text-gray-600')} ${isClickable ? 'group-hover:text-white' : ''} transition-colors`} />
          )}
          <span className={`text-2xl font-bold font-mono tracking-tight ${isActive ? 'text-white' : (label === 'Total Amount Due' ? theme.text : 'text-black')} ${isClickable ? 'group-hover:text-white' : ''}`}>
            {value}
          </span>
        </div>
      </div>
    </div>
  )
}
