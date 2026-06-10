import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ShoppingCart,
  RefreshCcw,
  Hash,
  Package,
  DollarSign,
  AlertCircle,
  Plus,
  X,
  Trash2,
  Check,
} from 'lucide-react'
import DynamicTable from '../../components/DynamicTable'
import RouteProtection from '../../components/RouteProtection'
import DynamicToast from '../../components/DynamicToast'
import RightSideModal from '../../components/RightSideModal'
import usePurchaseOrder from './usePurchaseOrder'
import {
  findDefaultVatOption,
  findDefaultWhtOption,
} from '../disbursements/useDisbursements'

const fmt = (value) =>
  new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)

const emptyPurchaseOrderRow = {
  product: '',
  quantity: '',
  price: '',
  procurement_id: '',
  responsibility_center: '',
}

function PurchaseOrderContent() {
  const {
    purchaseOrders,
    loading,
    error,
    refreshPurchaseOrders,
    updatePurchaseOrderStatus,
    createPurchaseOrder,
  } = usePurchaseOrder()
  const [toastMessage, setToastMessage] = useState(null)
  const [toastType, setToastType] = useState('info')
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [itemFormRows, setItemFormRows] = useState([{ ...emptyPurchaseOrderRow }])
  const [isSaving, setIsSaving] = useState(false)
  const [modalError, setModalError] = useState(null)
  const [approvalModalOpen, setApprovalModalOpen] = useState(false)
  const [approvalTargetRows, setApprovalTargetRows] = useState([])
  const [approvalLoading, setApprovalLoading] = useState(false)
  const [approvalError, setApprovalError] = useState(null)
  const navigate = useNavigate()

  const resetItemForm = () => {
    setItemFormRows([{ ...emptyPurchaseOrderRow }])
    setModalError(null)
  }

  const handleCreateNew = () => {
    resetItemForm()
    setEditingItem(null)
    setShowItemModal(true)
  }

  const handleModalClose = () => {
    if (isSaving) return
    setShowItemModal(false)
    setEditingItem(null)
    resetItemForm()
  }

  const buildPurchaseFormPrefill = (rows) => ({
    items: rows.map((row) => {
      const productValue = row.product
      const parsedProductId =
        typeof productValue === 'number' ||
        (typeof productValue === 'string' &&
          String(productValue).trim() !== '' &&
          /^\d+$/.test(productValue))
          ? Number(productValue)
          : null
      const productLabel =
        parsedProductId === null && productValue != null
          ? String(productValue).trim()
          : ''

      return {
        id: Date.now() + Math.random(),
        product_service_id: parsedProductId,
        product_service_name: productLabel,
        coa: '',
        coaSearch: '',
        description: productLabel || '',
        qty: Number(row.quantity) || 0,
        price: Number(row.price) || 0,
        discount: 0,
        discountType: 'PERCENT',
        // Provide VAT fields using the same keys PurchaseForm expects so
        // the Purchase form populates the visible label immediately.
        vat: 0,
        vat_id: 0,
        vat_code: 'No VAT',
        vat_name: 'No VAT%',
        vat_rate: 0,
        vatSearch: 'No VAT - No VAT%',
        vatRate: 0,
        // Withholding tax defaults (include both correct and misspelled keys)
        wht: 0,
        withholding_tax_id: 0,
        withholding_tax_code: 'NON-WHT',
        withholding_tax_name: 'NON-WHT',
        withholding_tax_rate: 0,
        // Some existing code uses a misspelled key `witholding_tax_*`, include it too
        witholding_tax_id: 0,
        witholding_tax: 0,
        whtSearch: 'NON-WHT - NON-WHT',
        whtRate: 0,
        responsibilityCenter: row.responsibility_center || '',
        isOther: false,
        isNew: true,
      }
    }),
  })

  const buildDisbursementFormPrefill = (rows) => ({
    items: rows.map((row) => {
      const productValue = row.product
      const parsedProductId =
        typeof productValue === 'number' ||
        (typeof productValue === 'string' &&
          String(productValue).trim() !== '' &&
          /^\d+$/.test(productValue))
          ? Number(productValue)
          : null
      const productLabel =
        parsedProductId === null && productValue != null
          ? String(productValue).trim()
          : ''

      return {
        id: Date.now() + Math.random(),
        product_service_id: parsedProductId,
        product_service_name: productLabel,
        coa: '',
        coaSearch: '',
        description: productLabel || '',
        quantity: Number(row.quantity) || 0,
        purchase_price: Number(row.price) || 0,
        discount: 0,
        discount_type: 'PERCENT',
        vat_id: 0,
        vat_code: 'No VAT',
        vat_name: 'No VAT%',
        vat_rate: 0,
        withholding_tax_id: 0,
        withholding_tax_code: 'NON-WHT',
        withholding_tax_rate: 0,
        responsibility_center: row.responsibility_center || '',
        isOther: false,
      }
    }),
    doc_ref: '',
    mode: 'CASH',
    modeSearch: 'CASH',
    bank_name: '',
    check_number: '',
    payment_date: new Date().toISOString().slice(0, 10),
    remarks: '',
    vendor_id: null,
    vendor: '',
  })

  const handleApprovalModalClose = () => {
    if (approvalLoading) return
    setApprovalModalOpen(false)
    setApprovalTargetRows([])
    setApprovalError(null)
  }

  const handleBulkApprove = (selectedRows) => {
    // Approve any rows that are not already APPROVED (allow approving PENDING or REJECTED)
    const approvableRows = selectedRows.filter((row) => row.status !== 'APPROVED')

    if (approvableRows.length === 0) {
      setToastMessage('No purchase order(s) available to approve')
      setToastType('warning')
      return
    }

    setApprovalTargetRows(approvableRows)
    setApprovalModalOpen(true)
  }

  const handleApproveAndRedirect = async (paymentMethod) => {
    try {
      setApprovalLoading(true)
      setApprovalError(null)

      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authentication token found')

      const responses = await Promise.all(
        approvalTargetRows.map((row) =>
          fetch(`${import.meta.env.VITE_SERVER_LINK}/purchase_order/${row.id}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ...row, status: 'APPROVED' }),
          }),
        ),
      )

      const failedResponse = responses.find((res) => !res.ok)
      if (failedResponse) {
        const errorText = await failedResponse.text()
        throw new Error(`Failed to approve purchase order(s): ${errorText}`)
      }

      setToastMessage(
        `${approvalTargetRows.length} purchase order(s) approved successfully`,
      )
      setToastType('success')
      await refreshPurchaseOrders()
      setApprovalModalOpen(false)

      const prefillData =
        paymentMethod === 'CASH'
          ? buildDisbursementFormPrefill(approvalTargetRows)
          : buildPurchaseFormPrefill(approvalTargetRows)

      if (paymentMethod === 'CASH') {
        navigate('/disbursement', {
          state: { prefillDisbursementData: prefillData },
        })
      } else {
        navigate('/purchase', { state: { prefillPurchaseData: prefillData } })
      }
    } catch (err) {
      const message = err.message || 'Failed to approve purchase orders'
      setApprovalError(message)
      setToastMessage(message)
      setToastType('error')
    } finally {
      setApprovalLoading(false)
    }
  }

  const updateItemFormRow = (index, field, value) => {
    setItemFormRows((prevRows) =>
      prevRows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    )
  }

  const addItemFormRow = () => {
    setItemFormRows((prevRows) => [...prevRows, { ...emptyPurchaseOrderRow }])
  }

  const removeItemFormRow = (index) => {
    setItemFormRows((prevRows) =>
      prevRows.filter((_, rowIndex) => rowIndex !== index),
    )
  }

  const handleSavePurchaseOrders = async () => {
    try {
      setModalError(null)
      setIsSaving(true)

      const payload = itemFormRows.map((row) => ({
        product: row.product?.trim(),
        quantity: Number(row.quantity),
        price: Number(row.price),
        procurement_id: row.procurement_id?.trim() || null,
        responsibility_center: row.responsibility_center?.trim() || null,
        status: 'PENDING',
      }))

      const invalidRowIndex = itemFormRows.findIndex((row) => {
        const hasProduct = row.product?.trim()
        const quantityValue = row.quantity
        const priceValue = row.price
        return (
          !hasProduct ||
          quantityValue === '' ||
          priceValue === '' ||
          Number.isNaN(Number(quantityValue)) ||
          Number.isNaN(Number(priceValue))
        )
      })

      if (invalidRowIndex !== -1) {
        throw new Error(
          `Row ${invalidRowIndex + 1} needs a product, quantity, and price.`,
        )
      }

      await createPurchaseOrder(payload)
      setToastMessage(`${payload.length} purchase order(s) created successfully`)
      setToastType('success')
      setShowItemModal(false)
      resetItemForm()
      await refreshPurchaseOrders()
    } catch (err) {
      setModalError(err.message || 'Failed to create purchase orders')
    } finally {
      setIsSaving(false)
    }
  }

  const stats = useMemo(() => {
    return {
      total: purchaseOrders.length,
      pending: purchaseOrders.filter((po) => po.status === 'PENDING').length,
      approved: purchaseOrders.filter((po) => po.status === 'APPROVED').length,
      rejected: purchaseOrders.filter((po) => po.status === 'REJECTED').length,
      totalValue: purchaseOrders.reduce(
        (sum, po) => sum + Number(po.price * po.quantity || 0),
        0,
      ),
    }
  }, [purchaseOrders])

  const tableData = purchaseOrders.map((po) => ({
    ...po,
    product: po.product_name || po.product,
    procurement_id: po.procurement_id || null,
    amount: `₱${fmt(po.price * po.quantity)}`,
    unit_price: `₱${fmt(po.price)}`,
  }))

  const handleBulkReject = async (selectedRows) => {
    try {
      // Reject any rows that are not already REJECTED (allow rejecting PENDING or APPROVED)
      const rejectableRows = selectedRows.filter((row) => row.status !== 'REJECTED')
      const updatePromises = rejectableRows.map((row) =>
        updatePurchaseOrderStatus(row.id, {
          ...row,
          status: 'REJECTED',
        }),
      )

      await Promise.all(updatePromises)
      setToastMessage(
        `${updatePromises.length} purchase order(s) rejected successfully`,
      )
      setToastType('warning')
      await refreshPurchaseOrders()
    } catch (err) {
      setToastMessage(err.message || 'Failed to reject purchase orders')
      setToastType('error')
    }
  }

  // Filter which checkbox actions to show based on selection statuses
  const checkboxActionsFilter = (selectedRows) => {
    if (!selectedRows || selectedRows.length === 0) return []

    const allApproved = selectedRows.every((r) => r.status === 'APPROVED')
    const allRejected = selectedRows.every((r) => r.status === 'REJECTED')

    if (allApproved) {
      return [
        {
          label: 'Reject Selected',
          onClick: handleBulkReject,
          className: 'bg-red-600 hover:bg-red-700',
        },
      ]
    }

    if (allRejected) {
      return [
        {
          label: 'Approve Selected',
          onClick: handleBulkApprove,
          className: 'bg-green-600 hover:bg-green-700',
        },
      ]
    }

    // Mixed or pending: show both actions
    return [
      {
        label: 'Approve Selected',
        onClick: handleBulkApprove,
        className: 'bg-green-600 hover:bg-green-700',
      },
      {
        label: 'Reject Selected',
        onClick: handleBulkReject,
        className: 'bg-red-600 hover:bg-red-700',
      },
    ]
  }

  if (loading && purchaseOrders.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[3px] text-gray-400">
          Loading Purchase Orders...
        </p>
      </div>
    )
  }

  if (error && purchaseOrders.length === 0) {
    return (
      <div className="p-10">
        <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl">
          <h3 className="text-red-800 font-bold uppercase text-sm">Error</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={refreshPurchaseOrders}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-black rounded-lg uppercase tracking-widest hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-4 bg-[#F3F4F6] min-h-full custom-scrollbar">
      {toastMessage && (
        <DynamicToast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage(null)}
        />
      )}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-black rounded-xl shrink-0">
            <ShoppingCart size={22} className="text-red-500" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-black tracking-tighter leading-none">
              Purchase <span className="text-red-600 italic">Orders</span>
            </h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-1">
              Manage and approve purchase requisitions
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCreateNew}
            className="px-4 h-10 bg-red-600 text-white text-xs font-black rounded-xl hover:bg-red-700 uppercase tracking-widest flex items-center gap-2"
          >
            <Plus size={16} />
            New PO
          </button>
          <button
            onClick={refreshPurchaseOrders}
            className="w-10 h-10 bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center justify-center transition-colors"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <RightSideModal
        title={editingItem ? 'Edit Purchase Order' : 'Add Purchase Orders'}
        isOpen={showItemModal}
        onClose={handleModalClose}
        size={editingItem ? 'xl' : '5xl'}
      >
        <div className="pb-16">
          <div className="p-3 overflow-y-auto max-h-[75vh] space-y-5">
            {modalError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {modalError}
              </div>
            )}

            {!editingItem && (
              <div>
                <p className="text-xs font-black text-gray-900 uppercase tracking-wider">
                  Batch Purchase Orders
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Add multiple purchase orders in one save. Each row is one order
                  entry.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {itemFormRows.map((row, index) => (
                <div
                  key={`po-row-${index}`}
                  className="border rounded-xl bg-white p-3 shadow-sm"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-3">
                      <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">
                        Product *
                      </label>
                      <input
                        type="text"
                        value={row.product}
                        onChange={(e) =>
                          updateItemFormRow(index, 'product', e.target.value)
                        }
                        placeholder="Item name or description"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={row.quantity}
                        onChange={(e) =>
                          updateItemFormRow(index, 'quantity', e.target.value)
                        }
                        placeholder="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">
                        Unit Price *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                          ₱
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.price}
                          onChange={(e) =>
                            updateItemFormRow(index, 'price', e.target.value)
                          }
                          placeholder="0.00"
                          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">
                        Procurement ID
                      </label>
                      <input
                        type="text"
                        value={row.procurement_id}
                        onChange={(e) =>
                          updateItemFormRow(index, 'procurement_id', e.target.value)
                        }
                        placeholder="Optional"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">
                        Responsibility Center
                      </label>
                      <input
                        type="text"
                        value={row.responsibility_center}
                        onChange={(e) =>
                          updateItemFormRow(
                            index,
                            'responsibility_center',
                            e.target.value,
                          )
                        }
                        placeholder="Optional"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                      />
                    </div>

                    <div className="md:col-span-12 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeItemFormRow(index)}
                        disabled={itemFormRows.length === 1 || isSaving}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-start">
              <button
                type="button"
                onClick={addItemFormRow}
                className="px-4 py-2 border border-gray-900 text-gray-900 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition flex items-center gap-1.5"
              >
                <Plus size={13} /> Add Row
              </button>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleModalClose}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 text-sm font-bold hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePurchaseOrders}
                disabled={isSaving}
                className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={16} />
                {`Save ${itemFormRows.length} Purchase Order${itemFormRows.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      </RightSideModal>

      <RightSideModal
        title="Approve Purchase Orders"
        isOpen={approvalModalOpen}
        onClose={handleApprovalModalClose}
        size="md"
      >
        <div className="pb-8">
          <div className="p-4 space-y-4">
            <p className="text-sm font-semibold text-gray-900">
              Approve {approvalTargetRows.length} purchase order(s).
            </p>
            <p className="text-xs text-gray-500">
              Choose the payment route. If you close this dialog, orders will remain
              pending.
            </p>
            {approvalError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {approvalError}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={approvalLoading}
                onClick={() => handleApproveAndRedirect('CASH')}
                className="inline-flex items-center justify-center px-4 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                Pay with Cash
              </button>
              <button
                type="button"
                disabled={approvalLoading}
                onClick={() => handleApproveAndRedirect('GCASH')}
                className="inline-flex items-center justify-center px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                Pay with Credit
              </button>
            </div>
            <button
              type="button"
              disabled={approvalLoading}
              onClick={handleApprovalModalClose}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-800 font-semibold hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </RightSideModal>

      <div className="grid grid-cols-5 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <Package size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[3px] text-gray-400 mb-1 whitespace-nowrap">
              Total POs
            </p>
            <h4 className="font-black text-black leading-none truncate text-xl">
              {stats.total}
            </h4>
            <p className="text-[9px] font-bold text-gray-300 uppercase mt-1">
              All Orders
            </p>
          </div>
        </div>
        <div className="bg-white border border-yellow-100 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 bg-yellow-50 text-yellow-600 rounded-xl flex items-center justify-center shrink-0">
            <AlertCircle size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[3px] text-gray-400 mb-1 whitespace-nowrap">
              Pending
            </p>
            <h4 className="font-black text-yellow-600 leading-none truncate text-xl">
              {stats.pending}
            </h4>
            <p className="text-[9px] font-bold text-gray-300 uppercase mt-1">
              Awaiting Approval
            </p>
          </div>
        </div>
        <div className="bg-white border border-green-100 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center shrink-0">
            <Hash size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[3px] text-gray-400 mb-1 whitespace-nowrap">
              Approved
            </p>
            <h4 className="font-black text-green-600 leading-none truncate text-xl">
              {stats.approved}
            </h4>
            <p className="text-[9px] font-bold text-gray-300 uppercase mt-1">
              Approved Orders
            </p>
          </div>
        </div>
        <div className="bg-white border border-red-100 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center shrink-0">
            <AlertCircle size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[3px] text-gray-400 mb-1 whitespace-nowrap">
              Rejected
            </p>
            <h4 className="font-black text-red-600 leading-none truncate text-xl">
              {stats.rejected}
            </h4>
            <p className="text-[9px] font-bold text-gray-300 uppercase mt-1">
              Rejected Orders
            </p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
            <DollarSign size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[3px] text-gray-400 mb-1 whitespace-nowrap">
              Total Value
            </p>
            <h4 className="font-black text-purple-600 leading-none truncate text-xl">
              ₱{fmt(stats.totalValue)}
            </h4>
            <p className="text-[9px] font-bold text-gray-300 uppercase mt-1">
              All Orders
            </p>
          </div>
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
          data={tableData}
          title="Purchase Orders"
          actionButtons={[]}
          routeName="purchase_order"
          enableAddButton={false}
          enableCheckbox={true}
          checkboxColumn="id"
          badgeColumns={[
            {
              column: 'status',
              values: {
                PENDING: 'yellow',
                APPROVED: 'green',
                REJECTED: 'red',
              },
            },
          ]}
          hiddenColumns={new Set(['product'])}
          checkboxActionsFilter={checkboxActionsFilter}
          checkboxActions={[
            {
              label: 'Approve Selected',
              onClick: handleBulkApprove,
              className: 'bg-green-600 hover:bg-green-700',
            },
            {
              label: 'Reject Selected',
              onClick: handleBulkReject,
              className: 'bg-red-600 hover:bg-red-700',
            },
          ]}
        />
      </motion.div>
    </div>
  )
}

export default function PurchaseOrder() {
  return (
    <RouteProtection routeName="purchase_order">
      <PurchaseOrderContent />
    </RouteProtection>
  )
}
