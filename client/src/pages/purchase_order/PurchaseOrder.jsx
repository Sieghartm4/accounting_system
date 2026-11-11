import React from 'react'
import { motion } from 'framer-motion'
import {
  ShoppingCart,
  RefreshCcw,
  Plus,
  Trash2,
  Check,
  CheckCircle,
  XCircle,
  ShieldCheck,
  Wallet,
  ClipboardList,
} from 'lucide-react'
import { DynamicTable, DynamicToast, LoadingScreen, RightSideModal } from '../../components/ui'
import { RouteProtection } from '../../components/access'
import usePurchaseOrder from './usePurchaseOrder'

function PurchaseOrderContent() {
  const {
    purchaseOrders,
    loading,
    error,
    refreshPurchaseOrders,
    toastMessage,
    toastType,
    closeToast,
    showItemModal,
    editingItem,
    isSaving,
    modalError,
    itemFormRows,
    handleCreateNew,
    handleModalClose,
    handleSavePurchaseOrders,
    updateItemFormRow,
    addItemFormRow,
    removeItemFormRow,
    approvalModalOpen,
    approvalTargetRows,
    approvalLoading,
    approvalError,
    handleApprovalModalClose,
    handleBulkApprove,
    handleBulkReject,
    handleApproveAndRedirect,
    checkboxActionsFilter,
    activeFilter,
    setActiveFilter,
    filteredPurchaseOrders,
    filteredTotalValue,
    tableData,
  } = usePurchaseOrder()

  if (loading) {
    return <LoadingScreen label="Loading Purchase Orders..." />
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
          onClose={closeToast}
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

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <SummaryTile
          label="Total POs"
          value={activeFilter ? filteredPurchaseOrders?.length || 0 : purchaseOrders?.length || 0}
          subText="Fetched"
          color="emerald"
          onClick={() => setActiveFilter(null)}
          isActive={activeFilter === null}
          icon={ShoppingCart}
        />
        <SummaryTile
          label="Pending"
          value={
            activeFilter === 'PENDING'
              ? filteredPurchaseOrders?.length || 0
              : purchaseOrders?.filter((po) => po.status === 'PENDING').length || 0
          }
          subText="Transactions"
          color="amber"
          onClick={() => setActiveFilter('PENDING')}
          isActive={activeFilter === 'PENDING'}
          icon={ClipboardList}
        />
        <SummaryTile
          label="Approved"
          value={
            activeFilter === 'APPROVED'
              ? filteredPurchaseOrders?.length || 0
              : purchaseOrders?.filter((po) => po.status === 'APPROVED').length || 0
          }
          subText="Transactions"
          color="emerald"
          onClick={() => setActiveFilter('APPROVED')}
          isActive={activeFilter === 'APPROVED'}
          icon={ShieldCheck}
        />
        <SummaryTile
          label="Rejected"
          value={
            activeFilter === 'REJECTED'
              ? filteredPurchaseOrders?.length || 0
              : purchaseOrders?.filter((po) => po.status === 'REJECTED').length || 0
          }
          subText="Transactions"
          color="rose"
          onClick={() => setActiveFilter('REJECTED')}
          isActive={activeFilter === 'REJECTED'}
          icon={XCircle}
        />
        <SummaryTile
          label="Total Value"
          value={`₱ ${filteredTotalValue.toLocaleString('en-PH', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }) || '0.00'}`}
          subText="PHP"
          color="dark"
          icon={Wallet}
        />
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

  const isClickable = label !== 'Total Value'

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
          {label === 'Total Value' ? (
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
            <Icon size={20} className={`${isActive ? 'text-white' : (label === 'Total Value' ? theme.text : 'text-gray-600')} ${isClickable ? 'group-hover:text-white' : ''} transition-colors`} />
          )}
          <span className={`text-2xl font-bold font-mono tracking-tight ${isActive ? 'text-white' : (label === 'Total Value' ? theme.text : 'text-black')} ${isClickable ? 'group-hover:text-white' : ''}`}>
            {value}
          </span>
        </div>
      </div>
    </div>
  )
}
