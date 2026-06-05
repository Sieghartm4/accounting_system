import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
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
  Wallet,
  ArrowRight,
} from 'lucide-react'
import DynamicTable from '../../components/DynamicTable'
import DynamicToast from '../../components/DynamicToast'
import RouteProtection from '../../components/RouteProtection'
import ProtectedAction from '../../components/ProtectedAction'
import useAdjustments from './useAdjustments'
import AdjustmentsForm from './AdjustmentsForm'
import { getAccessLevel } from '../../utils/routeProtection'

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
  const [viewingAdjustment, setViewingAdjustment] = useState(null)
  const [initialJournalEntries, setInitialJournalEntries] = useState([])
  const [toast, setToast] = useState(null)
  const [pendingDateFrom, setPendingDateFrom] = useState('')
  const [pendingDateTo, setPendingDateTo] = useState('')
  const [activeDateFrom, setActiveDateFrom] = useState(null)
  const [activeDateTo, setActiveDateTo] = useState(null)

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
        const token = localStorage.getItem('token')
        if (!token) throw new Error('No authentication token found')

        const response = await fetch(
          `${import.meta.env.VITE_SERVER_LINK}/adjustments/${Number(id)}`,
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
    const serverLink = import.meta.env.VITE_SERVER_LINK
    if (!serverLink) return

    const pageIsSecure = window.location.protocol === 'https:'
    let socketUrl = serverLink
    if (pageIsSecure) {
      socketUrl = serverLink.replace(/^http:/i, 'wss:').replace(/^https:/i, 'wss:')
    } else {
      socketUrl = serverLink.replace(/^http:/i, 'ws:').replace(/^https:/i, 'ws:')
    }
    const socket = new WebSocket(socketUrl)

    socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data)
        // Listen for adjustment creation
        if (payload?.type === 'adjustment_created' && payload?.data?.adjustment) {
          prependAdjustment(payload.data.adjustment)
        }
        // 🟢 ADDED: Also listen for journal entries creation to refresh if needed
        if (payload?.type === 'journal_entries_created') {
          refetchAdjustments()
        }
      } catch (err) {
        console.error('Adjustments WebSocket message parse error', err)
      }
    })

    socket.addEventListener('error', (err) => {
      console.error('Adjustments WebSocket error', err)
    })

    return () => {
      socket.close()
    }
  }, [prependAdjustment, refetchAdjustments])

  // Check if user has access to enable checkboxes
  const user = JSON.parse(localStorage.getItem('user') || '{}')
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
        PREPARED: 'gray',
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
    setViewingAdjustment(null)
    setInitialJournalEntries([])
  }

  const handleSuccess = (toastMessage) => {
    setToast(toastMessage)
    handleBack()
    refetchAdjustments()
  }

  if (isAdding)
    return (
      <RouteProtection routeName="adjustments">
        <AdjustmentsForm
          isEditMode={isEditing}
          adjustmentData={isEditing ? viewingAdjustment : null}
          initialJournalEntries={initialJournalEntries}
          onBack={handleBack}
          onSuccess={async (nextToast) => {
            if (nextToast) setToast(nextToast)
            await refetchAdjustments()
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
    return (
      <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-black uppercase tracking-[3px] text-gray-400">
          Retrieving Adjustments...
        </p>
      </div>
    )
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
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white/90 px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-500">From</span>
                  <input
                    type="date"
                    value={pendingDateFrom}
                    onChange={(e) => setPendingDateFrom(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-700 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    aria-label="Filter adjustments from date"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-500">To</span>
                  <input
                    type="date"
                    value={pendingDateTo}
                    onChange={(e) => setPendingDateTo(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-700 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    aria-label="Filter adjustments to date"
                  />
                </div>
              </div>
              <button
                onClick={applyDateFilters}
                className="px-4 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-sm"
                type="button"
              >
                Apply
              </button>
              <button
                onClick={clearDateFilters}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-200 transition-all shadow-sm"
                type="button"
              >
                Clear
              </button>
            </div>
            <button className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm">
              <Download size={14} />
              EXPORT LEDGER
            </button>
            <ProtectedAction routeName="adjustments">
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase"
              >
                <CheckCircle size={14} />
                New Adjustment
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

        {/* --- SUMMARY TILES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SummaryCard
            icon={<Wallet className="text-red-600" size={20} />}
            label="Total Adjustments"
            value={adjustments?.length || 0}
            subText="Entries"
          />
          <SummaryCard
            icon={<CheckCircle className="text-black" size={20} />}
            label="Verified"
            value="Active"
            subText="Compliance"
          />
          <SummaryCard
            icon={<ShieldCheck className="text-gray-400" size={20} />}
            label="Integrity"
            value="Valid"
            subText="Audit Status"
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
          data={adjustments}
          title="Adjustments Ledger"
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

                  const token = localStorage.getItem('token')
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

                  const token = localStorage.getItem('token')
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
          ]}
          badgeColumns={[
            {
              column: 'status',
              values: {
                PREPARED: 'orange',
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
                try {
                  console.log('Approving adjustments:', selectedRows)

                  const token = localStorage.getItem('token')
                  if (!token) {
                    throw new Error('No authentication token found')
                  }

                  const updates = selectedRows.map((row) => ({
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
                      `${selectedRows.length} adjustment(s) approved successfully`,
                  })
                } catch (error) {
                  console.error('Error approving adjustments:', error)
                  setToast({
                    type: 'error',
                    message: error.message || 'Failed to approve adjustments',
                  })
                }
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

// Reusable SummaryCard (Same as used in other pages)
function SummaryCard({ icon, label, value, subText }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-3 bg-gray-50 rounded-xl">{icon}</div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <h4 className="text-xl font-black text-black">{value}</h4>
          <span className="text-[9px] font-bold text-gray-400 uppercase">
            {subText}
          </span>
        </div>
      </div>
    </div>
  )
}
