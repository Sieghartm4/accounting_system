import React, { useState, useEffect } from 'react'
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FilePlus,
  Wallet,
  Banknote,
  ShieldCheck,
  History,
  ArrowRight,
  Download,
  Plus,
  Check,
  FileText,
  Building,
} from 'lucide-react'
import DynamicTable from '../../components/DynamicTable'
import DynamicToast from '../../components/DynamicToast'
import RouteProtection from '../../components/RouteProtection'
import ProtectedAction from '../../components/ProtectedAction'
import useDisbursements from './useDisbursements'
import CashDisbursementForm from './CashDisbursementForm'
import { getAccessLevel } from '../../utils/routeProtection'
import { generateDisbursementPDF } from '../../utils/generateDisbursementPDF'

export default function Disbursements() {
  return (
    <RouteProtection routeName="disbursement">
      <DisbursementsContent />
    </RouteProtection>
  )
}

function DisbursementsContent() {
  const {
    disbursements,
    loading,
    loadingMore,
    error,
    hasMore,
    refetchDisbursements,
    loadMore,
    prependDisbursement,
  } = useDisbursements()
  const [searchParams, setSearchParams] = useSearchParams()
  const [isAdding, setIsAdding] = useState(false)
  const [viewingDisbursement, setViewingDisbursement] = useState(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [toast, setToast] = useState(null)
  const [pendingDateFrom, setPendingDateFrom] = useState('')
  const [pendingDateTo, setPendingDateTo] = useState('')
  const [activeDateFrom, setActiveDateFrom] = useState(null)
  const [activeDateTo, setActiveDateTo] = useState(null)
  const [prefillDisbursementData, setPrefillDisbursementData] = useState(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const incomingPrefill = location.state?.prefillDisbursementData
    if (incomingPrefill) {
      setPrefillDisbursementData(incomingPrefill)
      setIsAdding(true)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, navigate, location.pathname])

  const applyDateFilters = async () => {
    const from = pendingDateFrom || null
    const to = pendingDateTo || null
    setActiveDateFrom(from)
    setActiveDateTo(to)
    await refetchDisbursements({ dateFrom: from, dateTo: to })
  }

  const clearDateFilters = async () => {
    setPendingDateFrom('')
    setPendingDateTo('')
    setActiveDateFrom(null)
    setActiveDateTo(null)
    await refetchDisbursements({ dateFrom: null, dateTo: null })
  }

  useEffect(() => {
    const id = searchParams.get('id')
    if (!id) return

    const fetchDisbursement = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) throw new Error('No authentication token found')

        const response = await fetch(
          `${import.meta.env.VITE_SERVER_LINK}/cash_disbursements/${id}`,
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
          throw new Error(result.message || 'Failed to fetch disbursement details')

        setViewingDisbursement(result)
        setIsEditMode(false)
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
          message: err.message || 'Failed to fetch disbursement details',
        })
      }
    }

    fetchDisbursement()
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
        if (
          payload?.type === 'disbursement_created' &&
          payload?.data?.disbursement
        ) {
          prependDisbursement(payload.data.disbursement)
        }
      } catch (err) {
        console.error('Disbursement WebSocket message parse error', err)
      }
    })

    socket.addEventListener('error', (err) => {
      console.error('Disbursement WebSocket error', err)
    })

    return () => {
      socket.close()
    }
  }, [prependDisbursement])

  // Check if user has access to enable checkboxes
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const accessLevel = getAccessLevel('disbursement', user)
  const enableCheckboxes =
    accessLevel === 'Check Access' ||
    accessLevel === 'Approve Access' ||
    accessLevel === 'Edit Access' ||
    accessLevel === 'Full Access'

  const checkboxCondition = null // Always show checkboxes

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  // ─── Helper: fetch full disbursement data then download as PDF ─────────────────
  const fetchAndDownloadPDF = async (selectedRows, copyType) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authentication token found')

      const disbursementIds = selectedRows
        .map((row) => encodeURIComponent(String(row.id)))
        .join(',')

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/cash_disbursements/print/${disbursementIds}?copyType=${copyType}`,
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
        throw new Error(
          result.message || 'Failed to fetch disbursements for printing',
        )

      // Extract the actual disbursement data from the response
      const data = result.data || []
      console.log('PDF Data received:', data)
      console.log('First disbursement:', data[0])
      console.log('First disbursement items:', data[0]?.items)
      console.log('First disbursement journal:', data[0]?.journal)
      console.log('Vendor/Customer info:', {
        customer: data[0]?.customer,
        vendor_name: data[0]?.vendor_name,
        vendor: data[0]?.vendor,
        customer_name: data[0]?.customer_name,
      })
      console.log('Payment date info:', {
        payment_date: data[0]?.payment_date,
        disbursement_date: data[0]?.disbursement_date,
        collection_date: data[0]?.collection_date,
        date: data[0]?.date,
        created_at: data[0]?.created_at,
      })
      if (!Array.isArray(data))
        throw new Error('Invalid data format received from server')

      // Generate & auto-download PDFs (one per disbursement)
      await generateDisbursementPDF(data, copyType)

      setToast({
        type: 'success',
        message: `${data.length} disbursement PDF(s) downloaded (${copyType === 'vendor' ? 'Vendor' : 'Internal'} Copy)`,
      })
    } catch (error) {
      console.error('Error generating disbursement PDF:', error)
      setToast({ type: 'error', message: error.message || 'Failed to generate PDF' })
    }
  }

  // Function to filter checkbox actions based on selected rows' states
  const getFilteredCheckboxActions = (selectedRows) => {
    const allActions = [
      {
        label: 'Approve Selected',
        icon: <Check size={14} />,
        onClick: async (selectedRows) => {
          try {
            const token = localStorage.getItem('token')
            if (!token) throw new Error('No authentication token found')

            // Filter to only include approvable rows (PREPARED or CHECKED)
            const approvableRows = selectedRows.filter(
              (row) => row.state === 'PREPARED' || row.state === 'CHECKED',
            )

            if (approvableRows.length === 0) {
              setToast({
                type: 'error',
                message: 'No disbursements are eligible for approval',
              })
              return
            }

            const updates = approvableRows.map((row) => ({
              id: row.id,
              currentState: row.state,
            }))

            const response = await fetch(
              `${import.meta.env.VITE_SERVER_LINK}/cash_disbursements/disbursement-state`,
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
            if (!response.ok)
              throw new Error(result.message || 'Failed to approve disbursements')

            await refetchDisbursements()
            setToast({
              type: 'success',
              message:
                result.message ||
                `${approvableRows.length} disbursement(s) approved successfully`,
            })
          } catch (error) {
            setToast({
              type: 'error',
              message: error.message || 'Failed to approve disbursements',
            })
          }
        },
      },
      {
        // ── Internal Copy → fetch data → generate + download PDF directly
        label: 'Internal Copy',
        icon: <FileText size={14} />,
        onClick: (selectedRows) => fetchAndDownloadPDF(selectedRows, 'internal'),
        style: 'blue', // Blue color for internal copy
      },
      {
        // ── Vendor Copy → same but labelled differently in PDF
        label: 'Vendor Copy',
        icon: <Building size={14} />,
        onClick: (selectedRows) => fetchAndDownloadPDF(selectedRows, 'vendor'),
        style: 'orange', // Orange color for vendor copy
      },
    ]

    // Filter Approve Selected button - show if at least one selected row is PREPARED or CHECKED
    return allActions.filter((action) => {
      if (action.label === 'Approve Selected') {
        // Show approve button if at least one selected row has state PREPARED or CHECKED
        return selectedRows.some(
          (row) => row.state === 'PREPARED' || row.state === 'CHECKED',
        )
      }
      return true // Always show other actions
    })
  }

  if (isAdding)
    return (
      <RouteProtection routeName="disbursement">
        <CashDisbursementForm
          disbursementData={prefillDisbursementData}
          onBack={() => {
            setIsAdding(false)
            setPrefillDisbursementData(null)
          }}
          onSuccess={async (nextToast) => {
            if (nextToast) setToast(nextToast)
            setPrefillDisbursementData(null)
            await refetchDisbursements()
          }}
        />
      </RouteProtection>
    )

  if (viewingDisbursement)
    return (
      <RouteProtection routeName="disbursement">
        <CashDisbursementForm
          isViewMode={!isEditMode}
          isEditMode={isEditMode}
          disbursementData={viewingDisbursement}
          onBack={() => {
            setViewingDisbursement(null)
            setIsEditMode(false)
          }}
          onSuccess={async (nextToast) => {
            if (nextToast) setToast(nextToast)
            await refetchDisbursements()
          }}
        />
      </RouteProtection>
    )

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-black uppercase tracking-[3px] text-gray-400">
          Processing Disbursements...
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
                <Wallet size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Cash <span className="text-red-600 italic">Disbursements</span>
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
            <ProtectedAction routeName="disbursement">
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase"
              >
                <FilePlus size={14} />
                New Disbursement
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

        {/* --- SUMMARY TILES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SummaryCard
            icon={<Wallet className="text-red-600" size={20} />}
            label="Total Vouchers"
            value={disbursements?.length || 0}
            subText="Processed"
          />
          <SummaryCard
            icon={<History className="text-black" size={20} />}
            label="Recent Cycles"
            value="Current"
            subText="Live Period"
          />
          <SummaryCard
            icon={<ShieldCheck className="text-gray-400" size={20} />}
            label="Compliance"
            value="SECURE"
            subText="Verified Ready"
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
          data={disbursements}
          title="Disbursement Ledger"
          enableAddButton={false}
          enableCheckbox={enableCheckboxes}
          checkboxColumn="id"
          checkboxCondition={checkboxCondition}
          enableActionColumn={true}
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
          actionButtons={[
            {
              label: 'View',
              onClick: async (row) => {
                try {
                  const token = localStorage.getItem('token')
                  if (!token) {
                    throw new Error('No authentication token found')
                  }

                  const response = await fetch(
                    `${import.meta.env.VITE_SERVER_LINK}/cash_disbursements/${row.id}`,
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
                      result.message || 'Failed to fetch disbursement details',
                    )
                  }

                  console.log('Disbursement details:', result)

                  // Set disbursement data for viewing
                  setViewingDisbursement(result)
                  setIsEditMode(false)
                } catch (error) {
                  console.error('Error fetching disbursement details:', error)
                  setToast({
                    type: 'error',
                    message: error.message || 'Failed to fetch disbursement details',
                  })
                }
              },
            },
            {
              label: 'Edit',
              onClick: async (row) => {
                try {
                  console.log('Editing disbursement:', row)

                  const token = localStorage.getItem('token')
                  if (!token) {
                    throw new Error('No authentication token found')
                  }

                  const response = await fetch(
                    `${import.meta.env.VITE_SERVER_LINK}/cash_disbursements/${row.id}`,
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
                      result.message || 'Failed to fetch disbursement details',
                    )
                  }

                  console.log('Disbursement details for editing:', result)

                  // Set disbursement data for editing (edit mode)
                  setViewingDisbursement(result)
                  setIsEditMode(true)
                } catch (error) {
                  console.error(
                    'Error fetching disbursement details for editing:',
                    error,
                  )
                  setToast({
                    type: 'error',
                    message: error.message || 'Failed to fetch disbursement details',
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
          checkboxActions={getFilteredCheckboxActions([])}
          checkboxActionsFilter={getFilteredCheckboxActions}
        />
      </motion.div>
    </div>
  )
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
