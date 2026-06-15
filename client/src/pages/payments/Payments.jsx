import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
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
} from 'lucide-react'
import DynamicTable from '../../components/DynamicTable'
import DynamicToast from '../../components/DynamicToast'
import RouteProtection from '../../components/RouteProtection'
import ProtectedAction from '../../components/ProtectedAction'
import usePayments from './usePayments'
import PaymentsForm from './PaymentsForm'
import { getAccessLevel } from '../../utils/routeProtection'
import { generatePaymentPDF } from '../../utils/generatePaymentPDF'

export default function Payments() {
  return (
    <RouteProtection routeName="payments">
      <PaymentsContent />
    </RouteProtection>
  )
}

function PaymentsContent() {
  const {
    payments,
    loading,
    loadingMore,
    hasMore,
    error,
    refetchPayments,
    loadMore,
    prependPayment,
  } = usePayments()
  const [searchParams, setSearchParams] = useSearchParams()
  const [isAdding, setIsAdding] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [viewingPayment, setViewingPayment] = useState(null)
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
    await refetchPayments({ dateFrom: from, dateTo: to })
  }

  const clearDateFilters = async () => {
    setPendingDateFrom('')
    setPendingDateTo('')
    setActiveDateFrom(null)
    setActiveDateTo(null)
    await refetchPayments({ dateFrom: null, dateTo: null })
  }

  // WebSocket subscription for live payment updates
  useEffect(() => {
    const serverLink = import.meta.env.VITE_SERVER_LINK
    const pageIsSecure = window.location.protocol === 'https:'
    const wsUrl = pageIsSecure
      ? serverLink.replace(/^http:/i, 'wss:').replace(/^https:/i, 'wss:')
      : serverLink.replace(/^http:/i, 'ws:').replace(/^https:/i, 'ws:')

    let ws

    try {
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('WebSocket connected for payments')
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'payment_created' && message.data?.payment) {
            console.log('New payment received:', message.data.payment)
            prependPayment(message.data.payment)
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected for payments')
      }
    } catch (err) {
      console.error('Error creating WebSocket connection:', err)
    }

    return () => {
      if (ws) {
        ws.close()
      }
    }
  }, [prependPayment])

  useEffect(() => {
    const id = searchParams.get('id')
    if (!id) return

    const fetchPayment = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) throw new Error('No authentication token found')

        const response = await fetch(
          `${import.meta.env.VITE_SERVER_LINK}/payments/${Number(id)}`,
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
          message: err.message || 'Failed to fetch payment details',
        })
      }
    }

    fetchPayment()
  }, [searchParams, setSearchParams])

  // Check if user has access to enable checkboxes
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const accessLevel = getAccessLevel('payments', user)
  const enableCheckboxes =
    accessLevel === 'Check Access' ||
    accessLevel === 'Approve Access' ||
    accessLevel === 'Edit Access' ||
    accessLevel === 'Full Access'

  const checkboxCondition = null // Always show checkboxes (match other pages)

  // ─── Helper: fetch full payment data then download as PDF ─────────────────
  const fetchAndDownloadPDF = async (selectedRows, copyType) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authentication token found')

      const paymentIds = selectedRows.map((row) => row.id).join(',')

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/payments/print/${paymentIds}?copyType=${copyType}`,
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
      console.log('PDF Data received:', data)
      if (!Array.isArray(data))
        throw new Error('Invalid data format received from server')

      await generatePaymentPDF(data, copyType)

      setToast({
        type: 'success',
        message: `${data.length} payment PDF(s) downloaded (${copyType === 'customer' ? 'Vendor' : 'Internal'} Copy)`,
      })
    } catch (error) {
      console.error('Error generating payment PDF:', error)
      setToast({ type: 'error', message: error.message || 'Failed to generate PDF' })
    }
  }

  // Function to filter checkbox actions based on selected rows
  const getFilteredCheckboxActions = (selectedRows) => {
    const allActions = [
      {
        label: 'Approve Selected',
        onClick: async (selectedRows) => {
          try {
            console.log('Approving payments:', selectedRows)

            const token = localStorage.getItem('token')
            if (!token) {
              throw new Error('No authentication token found')
            }

            const updates = selectedRows.map((row) => ({
              id: row.id,
              currentState: row.state,
            }))

            const response = await fetch(
              `${import.meta.env.VITE_SERVER_LINK}/payments/payment-state`,
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

            setToast({
              type: 'success',
              message:
                result.message ||
                `${selectedRows.length} payment(s) approved successfully`,
            })
          } catch (error) {
            console.error('Error approving payments:', error)
            setToast({
              type: 'error',
              message: error.message || 'Failed to approve payments',
            })
          }
        },
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
      return true
    })
  }

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  if (isAdding || isEditing)
    return (
      <RouteProtection routeName="payments">
        <PaymentsForm
          isEditMode={isEditing}
          isViewMode={isViewing}
          paymentData={viewingPayment}
          onBack={() => {
            setIsAdding(false)
            setIsEditing(false)
            setIsViewing(false)
            setViewingPayment(null)
          }}
          onSuccess={async (nextToast) => {
            if (nextToast) setToast(nextToast)
            await refetchPayments()
          }}
        />
      </RouteProtection>
    )

  if (isViewing)
    return (
      <RouteProtection routeName="payments">
        <PaymentsForm
          isViewMode={true}
          paymentData={viewingPayment}
          onBack={() => {
            setIsViewing(false)
            setViewingPayment(null)
          }}
        />
      </RouteProtection>
    )

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-black uppercase tracking-[3px] text-gray-400">
          Retrieving Payments...
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
                <span className="text-red-600 italic">Payments</span>
              </h1>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white/90 px-3 py-2 shadow-sm">
                <div className="flex flex-wrap justify-center items-center gap-3 w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-500">From</span>
                    <input
                      type="date"
                      value={pendingDateFrom}
                      onChange={(e) => setPendingDateFrom(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-700 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      aria-label="Filter receipts from date"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-500">To</span>
                    <input
                      type="date"
                      value={pendingDateTo}
                      onChange={(e) => setPendingDateTo(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-700 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      aria-label="Filter receipts to date"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={applyDateFilters}
                    className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-all shadow-sm"
                    type="button"
                  >
                    Apply
                  </button>
                  <button
                    onClick={clearDateFilters}
                    className="px-4 py-2 bg-gray-900 text-gray-100 text-xs font-bold rounded-xl hover:bg-gray-800 transition-all shadow-sm"
                    type="button"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
            <button className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm">
              <Download size={14} />
              EXPORT DATA
            </button>
            <ProtectedAction routeName="receipts">
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase"
              >
                <FilePlus size={14} />
                New Receipt
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

        {/* --- SUMMARY TILES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SummaryCard
            icon={<Wallet className="text-red-600" size={20} />}
            label="Total Paid"
            value={payments?.length || 0}
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
          data={payments}
          title="Payments Ledger"
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
                  console.log('Viewing payment:', row)

                  const token = localStorage.getItem('token')
                  if (!token) {
                    throw new Error('No authentication token found')
                  }

                  const response = await fetch(
                    `${import.meta.env.VITE_SERVER_LINK}/payments/${row.id}`,
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

                  console.log('Payment details fetched:', result)
                  setViewingPayment(result)
                  setIsViewing(true)
                } catch (error) {
                  console.error('Error fetching payment details:', error)
                  setToast({
                    type: 'error',
                    message: error.message || 'Failed to fetch payment details',
                  })
                }
              },
            },
            {
              label: 'Edit',
              onClick: async (row) => {
                try {
                  console.log('Editing payment:', row)

                  const token = localStorage.getItem('token')
                  if (!token) {
                    throw new Error('No authentication token found')
                  }

                  const response = await fetch(
                    `${import.meta.env.VITE_SERVER_LINK}/payments/${row.id}`,
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

                  console.log('Payment details fetched for editing:', result)
                  setViewingPayment(result)
                  setIsEditing(true)
                } catch (error) {
                  console.error('Error fetching payment details for editing:', error)
                  setToast({
                    type: 'error',
                    message: error.message || 'Failed to fetch payment details',
                  })
                }
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
