import React, { useState, useEffect } from 'react'
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
} from 'lucide-react'
import DynamicTable from '../../components/DynamicTable'
import DynamicToast from '../../components/DynamicToast'
import RouteProtection from '../../components/RouteProtection'
import ProtectedAction from '../../components/ProtectedAction'
import usePurchase from './usePurchase'
import PurchaseForm from './PurchaseForm'
import { getAccessLevel } from '../../utils/routeProtection'
import { generatePurchasePDF } from '../../utils/generatePurchasePDF'

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
  const [searchParams, setSearchParams] = useSearchParams()

  console.log('PurchaseContent - purchases:', purchases)
  console.log('PurchaseContent - loading:', loading)
  console.log('PurchaseContent - error:', error)
  const [isAdding, setIsAdding] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState(null)
  const [isViewing, setIsViewing] = useState(false)
  const [viewingPurchase, setViewingPurchase] = useState(null)
  const [toast, setToast] = useState(null)
  const [pendingDateFrom, setPendingDateFrom] = useState('')
  const [pendingDateTo, setPendingDateTo] = useState('')
  const [activeDateFrom, setActiveDateFrom] = useState(null)
  const [activeDateTo, setActiveDateTo] = useState(null)
  const [prefillPurchaseData, setPrefillPurchaseData] = useState(null)
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
        const token = localStorage.getItem('token')
        if (!token) throw new Error('No authentication token found')

        const response = await fetch(
          `${import.meta.env.VITE_SERVER_LINK}/purchase/${Number(id)}`,
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
    const serverLink = import.meta.env.VITE_SERVER_LINK
    if (!serverLink) return

    const pageIsSecure = window.location.protocol === 'https:'
    const socketUrl = pageIsSecure
      ? serverLink.replace(/^http:/i, 'wss:').replace(/^https:/i, 'wss:')
      : serverLink.replace(/^http:/i, 'ws:').replace(/^https:/i, 'ws:')
    const socket = new WebSocket(socketUrl)

    socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload?.type === 'purchase_created' && payload?.data?.purchase) {
          prependPurchase(payload.data.purchase)
        }
      } catch (err) {
        console.error('Purchase WebSocket message parse error', err)
      }
    })

    socket.addEventListener('error', (err) => {
      console.error('Purchase WebSocket error', err)
    })

    return () => {
      socket.close()
    }
  }, [prependPurchase])

  // Check if user has access to enable checkboxes
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const accessLevel = getAccessLevel('purchase', user)
  const enableCheckboxes =
    accessLevel === 'Check Access' ||
    accessLevel === 'Approve Access' ||
    accessLevel === 'Edit Access' ||
    accessLevel === 'Full Access'

  const checkboxCondition = null // Always show checkboxes (match other pages)

  // ─── Helper: fetch full purchase data then download as PDF ─────────────────
  const fetchAndDownloadPDF = async (selectedRows, copyType) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authentication token found')

      const purchaseIds = selectedRows.map((row) => row.id).join(',')

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/purchase/print/${purchaseIds}?copyType=${copyType}`,
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
          try {
            console.log('Approving purchases:', selectedRows)

            const approveToken = localStorage.getItem('token')
            if (!approveToken) {
              throw new Error('No authentication token found')
            }

            const updates = selectedRows.map((row) => ({
              id: row.id,
              currentState: row.state,
            }))

            const approveResponse = await fetch(
              `${import.meta.env.VITE_SERVER_LINK}/purchase/purchase-state`,
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
                `${selectedRows.length} purchase(s) approved successfully`,
            })
          } catch (error) {
            console.error('Error approving purchases:', error)
            setToast({
              type: 'error',
              message: error.message || 'Failed to approve purchases',
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
          purchaseData={editingPurchase}
          onBack={() => setIsEditing(false)}
          onSuccess={async (nextToast) => {
            if (nextToast) setToast(nextToast)
            await refetchPurchases()
            setIsEditing(false)
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
    return (
      <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-black uppercase tracking-[3px] text-gray-400">
          Loading Purchase Ledger...
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
                Purchase <span className="text-red-600 italic">Management</span>
              </h1>
            </div>
            {/* <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">
              Monitor real-time sales transactions and commercial volume.
            </p> */}
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
            icon={<ShoppingCart className="text-red-600" size={20} />}
            label="Total Purchases"
            value={purchases?.length || 0}
            subText="Transactions"
          />
          <SummaryCard
            icon={<TrendingDown className="text-black" size={20} />}
            label="Spending"
            value="Active"
            subText="Budget Flow"
          />
          <SummaryCard
            icon={<ShieldCheck className="text-gray-400" size={20} />}
            label="Verification"
            value="Secure"
            subText="Certified"
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
          data={purchases}
          title="Purchase Ledger"
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

                  const authToken = localStorage.getItem('token')
                  if (!authToken) {
                    throw new Error('No authentication token found')
                  }

                  const viewResponse = await fetch(
                    `${import.meta.env.VITE_SERVER_LINK}/purchase/${row.id}`,
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

                  const authToken = localStorage.getItem('token')
                  if (!authToken) {
                    throw new Error('No authentication token found')
                  }

                  const editResponse = await fetch(
                    `${import.meta.env.VITE_SERVER_LINK}/purchase/${row.id}`,
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
          ]}
          badgeColumns={[
            {
              column: 'status',
              values: {
                PAID: 'green',
                UNPAID: 'red',
                REJECTED: 'yellow',
              },
            },
            {
              column: 'state',
              values: {
                PREPARED: 'orange',
                CHECKED: 'blue',
                APPROVED: 'green',
                REJECTED: 'red',
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

{
  /* --- HELPER COMPONENT (Fixed: This was likely missing) --- */
}
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
