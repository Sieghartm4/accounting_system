import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FilePlus,
  ArrowLeft,
  Plus,
  Eye,
  Edit,
  Trash2,
  FileText,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Layers,
  ShieldCheck,
  ArrowRight,
  ClipboardList,
  Wallet,
} from 'lucide-react'
import DynamicTable from '../../components/DynamicTable'
import DynamicToast from '../../components/DynamicToast'
import DynamicConfirmModal from '../../components/DynamicConfirmModal'
import RouteProtection from '../../components/RouteProtection'
import ProtectedAction from '../../components/ProtectedAction'
import useAdjustments from './useAdjustments'
import AdjustmentsForm from './AdjustmentsForm'
import { getAccessLevel } from '../../utils/routeProtection'
import { isPostedDocument, createReversal } from '../../utils/journalLifecycle'
import LoadingScreen from '../../components/LoadingScreen'
import connectRealtime from '../../utils/realtimeSocket'

export default function Adjustments() {
  return (
    <RouteProtection routeName="adjustments">
      <AdjustmentsContent />
    </RouteProtection>
  )
}

function AdjustmentsContent() {
  const {
    adjustments,
    loading,
    loadingMore,
    error,
    hasMore,
    refetchAdjustments,
    loadMore,
    prependAdjustment,
  } = useAdjustments()
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

  useEffect(() => {
    const id = searchParams.get('id')
    if (!id) return

    const fetchAdjustment = async () => {
      try {
        const token = sessionStorage.getItem('authenticated')
        if (!token) throw new Error('No authentication token found')

        const response = await fetch(
          `${import.meta.env.VITE_SERVER_LINK}/adjustments/${encodeURIComponent(id)}`,
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
          message: err.message || 'Failed to fetch adjustment details',
        })
      }
    }

    fetchAdjustment()
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const selectedAdvanceJournalEntries =
      location.state?.selectedAdvanceJournalEntries || []

    if (selectedAdvanceJournalEntries.length > 0) {
      setInitialJournalEntries(selectedAdvanceJournalEntries)
      setIsAdding(true)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, navigate, location.pathname])

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

  // Check if user has access to enable checkboxes
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

  // Filter adjustments based on active card filter
  const getFilteredAdjustments = () => {
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
  }

  const filteredAdjustments = getFilteredAdjustments()

  // Calculate totals based on filtered data
  const getFilteredTotalAmount = () => {
    return filteredAdjustments?.reduce((sum, a) => sum + (parseFloat(a.total_amount) || 0), 0) || 0
  }

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  const actionButtons = [
    {
      label: 'View',
      icon: Eye,
      onClick: (adjustment) => {
        setViewingAdjustment(adjustment)
        setIsViewing(true)
      },
    },
    {
      label: 'Edit',
      icon: Edit,
      onClick: (adjustment) => {
        setViewingAdjustment(adjustment)
        setIsAdding(true)
      },
    },
    {
      label: 'Delete',
      icon: Trash2,
      onClick: (adjustment) => {
        // Handle delete
        setToast({
          type: 'warning',
          message: 'Delete functionality not implemented yet',
        })
      },
    },
  ]

  const badgeColumns = [
    {
      column: 'status',
      values: {
        PREPARED: 'yellow',
        CHECKED: 'blue',
        APPROVED: 'green',
        REJECTED: 'red',
        CANCELLED: 'orange',
      },
    },
  ]

  const checkboxActions = [
    {
      label: 'Approve',
      icon: CheckCircle,
      onClick: async (selectedIds) => {
        setToast({
          type: 'success',
          message: `${selectedIds.length} adjustment(s) approved`,
        })
        refetchAdjustments()
      },
      color: 'text-green-600 hover:bg-green-50',
      condition: accessLevel === 'Full Access',
    },
    {
      label: 'Reject',
      icon: XCircle,
      onClick: async (selectedIds) => {
        setToast({
          type: 'warning',
          message: `${selectedIds.length} adjustment(s) rejected`,
        })
        refetchAdjustments()
      },
      color: 'text-red-600 hover:bg-red-50',
      condition: accessLevel === 'Full Access',
    },
  ]

  const handleBack = () => {
    setIsAdding(false)
    setIsViewing(false)
    setIsEditing(false)
    setIsPostedEdit(false)
    setViewingAdjustment(null)
    setInitialJournalEntries([])
  }

  if (isAdding)
    return (
      <RouteProtection routeName="adjustments">
        <AdjustmentsForm
          isEditMode={isEditing}
          isPostedLocked={isPostedEdit}
          adjustmentData={isEditing ? viewingAdjustment : null}
          initialJournalEntries={initialJournalEntries}
          onBack={handleBack}
          onSuccess={async (nextToast) => {
            if (nextToast) setToast(nextToast)
            await refetchAdjustments()
            handleBack()
          }}
        />
      </RouteProtection>
    )

  if (isViewing)
    return (
      <RouteProtection routeName="adjustments">
        <AdjustmentsForm
          isViewMode={true}
          adjustmentData={viewingAdjustment}
          onBack={() => {
            setIsViewing(false)
            setViewingAdjustment(null)
          }}
        />
      </RouteProtection>
    )

  if (loading) {
    return <LoadingScreen label="Loading Adjustments Data..." />
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
                <span className="text-red-600 italic">Adjustments</span>
              </h1>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <button className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm">
              <Download size={14} />
              EXPORT DATA
            </button>
            <ProtectedAction routeName="adjustments">
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase"
              >
                <FilePlus size={14} />
                New Adjustment
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

{/* ── SUMMARY TILES ──────────────────────────────────────────────────── */}
<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
  <SummaryTile
    label="Total Adjustments"
    value={activeFilter ? filteredAdjustments?.length || 0 : adjustments?.length || 0}
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
        ? filteredAdjustments?.length || 0
        : adjustments?.filter((a) => a.status === 'PREPARED').length || 0
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
        ? filteredAdjustments?.length || 0
        : adjustments?.filter((a) => a.status === 'CHECKED').length || 0
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
        ? filteredAdjustments?.length || 0
        : adjustments?.filter((a) => a.status === 'CANCELLED').length || 0
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
        ? filteredAdjustments?.length || 0
        : adjustments?.filter((a) => a.status === 'APPROVED').length || 0
    }
    subText="Transactions"
    color="emerald"
    onClick={() => setActiveFilter('APPROVED')}
    isActive={activeFilter === 'APPROVED'}
    icon={ShieldCheck}
  />
  <SummaryTile
    label="Total Amount"
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
        <DynamicTable
          data={filteredAdjustments}
          title="Adjustments Ledger"
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
          actionButtons={[
            {
              label: 'View',
              onClick: async (row) => {
                try {
                  console.log('Viewing adjustment:', row)

                  const token = sessionStorage.getItem('authenticated')
                  if (!token) {
                    throw new Error('No authentication token found')
                  }

                  const response = await fetch(
                    `${import.meta.env.VITE_SERVER_LINK}/adjustments/${row.id}`,
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

                  console.log('Adjustment details fetched:', result)
                  setViewingAdjustment(result)
                  setIsViewing(true)
                } catch (error) {
                  console.error('Error fetching adjustment details:', error)
                  setToast({
                    type: 'error',
                    message: error.message || 'Failed to fetch adjustment details',
                  })
                }
              },
            },
            {
              label: 'Edit',
              onClick: async (row) => {
                try {
                  console.log('Editing adjustment:', row)

                  setIsPostedEdit(isPostedDocument(row.status))

                  const token = sessionStorage.getItem('authenticated')
                  if (!token) {
                    throw new Error('No authentication token found')
                  }

                  const response = await fetch(
                    `${import.meta.env.VITE_SERVER_LINK}/adjustments/${row.id}`,
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

                  console.log('Adjustment details fetched for editing:', result)
                  setViewingAdjustment(result)
                  setIsEditing(true)
                  setIsAdding(true)
                } catch (error) {
                  console.error(
                    'Error fetching adjustment details for editing:',
                    error,
                  )
                  setToast({
                    type: 'error',
                    message: error.message || 'Failed to fetch adjustment details',
                  })
                }
              },
            },
            {
              label: 'Reverse',
              onClick: (row) => {
                if (!isPostedDocument(row.status)) {
                  setToast({
                    type: 'error',
                    message: `Only APPROVED/POSTED adjustments can be reversed (current: ${row.status}).`,
                  })
                  return
                }

                setConfirmModal({
                  isOpen: true,
                  onConfirm: async () => {
                    try {
                      const reversed = await createReversal({
                        dbName: 'adjustments',
                        dbId: row.id,
                        remarks: 'Reversal initiated from the Adjustments module',
                      })
                      setToast({
                        type: 'success',
                        message: reversed.message || 'Reversal created',
                      })
                      navigate('/adjustments')
                      await refetchAdjustments()
                    } catch (error) {
                      console.error('Error creating adjustment reversal:', error)
                      setToast({
                        type: 'error',
                        message: error.message || 'Failed to create reversal',
                      })
                    }
                  },
                  title: 'Reverse Adjustment',
                  message: `Create a REVERSAL against ADJUSTMENT ${row.id}? The original transaction stays unchanged; the reversal (DR/CR mirrored) is created as a PREPARED adjustment and must be approved before it posts to the general journal.`,
                  type: 'danger',
                })
              },
            },
          ]}
          badgeColumns={[
            {
              column: 'status',
              values: {
                PREPARED: 'yellow',
                CHECKED: 'blue',
                APPROVED: 'green',
                REJECTED: 'red',
                CANCELLED: 'orange',
              },
            },
          ]}
          checkboxActions={[
            {
              label: 'Approve Selected',
              onClick: async (selectedRows) => {
                const approvableRows = selectedRows.filter(
                  (row) => row.status === 'PREPARED' || row.status === 'CHECKED',
                )

                if (approvableRows.length === 0) {
                  setToast({
                    type: 'error',
                    message: 'No adjustments are eligible for approval',
                  })
                  return
                }

                setConfirmModal({
                  isOpen: true,
                  onConfirm: async () => {
                    try {
                      console.log('Approving adjustments:', approvableRows)

                      const token = sessionStorage.getItem('authenticated')
                      if (!token) {
                        throw new Error('No authentication token found')
                      }

                      const updates = approvableRows.map((row) => ({
                        id: row.id,
                        currentState: row.status,
                      }))

                      const response = await fetch(
                        `${import.meta.env.VITE_SERVER_LINK}/adjustments/adjustment-state`,
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

                      setToast({
                        type: 'success',
                        message:
                          result.message ||
                          `${approvableRows.length} adjustment(s) approved successfully`,
                      })
                    } catch (error) {
                      console.error('Error approving adjustments:', error)
                      setToast({
                        type: 'error',
                        message: error.message || 'Failed to approve adjustments',
                      })
                    }
                  },
                  title: 'Approve Adjustments',
                  message: `Are you sure you want to approve ${approvableRows.length} adjustment(s)?`,
                })
              },
            },
            {
              label: 'Cancel Selected',
              style: 'orange',
              onClick: async (selectedRows) => {
                const cancellableRows = selectedRows.filter(
                  (row) => row.status !== 'CANCELLED' && row.status !== 'REJECTED' && row.status !== 'APPROVED',
                )

                if (cancellableRows.length === 0) {
                  setToast({
                    type: 'error',
                    message: 'No adjustments are eligible for cancellation',
                  })
                  return
                }

                setConfirmModal({
                  isOpen: true,
                  onConfirm: async () => {
                    try {
                      console.log('Cancelling adjustments:', cancellableRows)

                      const token = sessionStorage.getItem('authenticated')
                      if (!token) {
                        throw new Error('No authentication token found')
                      }

                      const updates = cancellableRows.map((row) => ({
                        id: row.id,
                        currentState: row.status,
                      }))

                      const response = await fetch(
                        `${import.meta.env.VITE_SERVER_LINK}/adjustments/cancel-state`,
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

                      setToast({
                        type: 'success',
                        message:
                          result.message ||
                          `${cancellableRows.length} adjustment(s) cancelled successfully`,
                      })
                    } catch (error) {
                      console.error('Error cancelling adjustments:', error)
                      setToast({
                        type: 'error',
                        message: error.message || 'Failed to cancel adjustments',
                      })
                    }
                  },
                  title: 'Cancel Adjustments',
                  message: `Are you sure you want to cancel ${cancellableRows.length} adjustment(s)?`,
                  type: 'danger',
                })
              },
            },
          ]}
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

  const isClickable = label !== 'Total Amount'

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
          {label === 'Total Amount' ? (
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
            <Icon size={20} className={`${isActive ? 'text-white' : (label === 'Total Amount' ? theme.text : 'text-gray-600')} ${isClickable ? 'group-hover:text-white' : ''} transition-colors`} />
          )}
          <span className={`text-2xl font-bold font-mono tracking-tight ${isActive ? 'text-white' : (label === 'Total Amount' ? theme.text : 'text-black')} ${isClickable ? 'group-hover:text-white' : ''}`}>
            {value}
          </span>
        </div>
      </div>
    </div>
  )
}
