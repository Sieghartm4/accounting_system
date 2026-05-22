import React from 'react'
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion'
import {
  Plus,
  Trash2,
  Check,
  X,
  Building2,
  AlertCircle,
  Loader,
  ArrowLeft,
  FileText,
  CheckCircle2,
  Scale,
  RefreshCw,
  Search,
  Calendar,
  TrendingUp,
  TrendingDown,
  Info,
  Edit,
} from 'lucide-react'
import DynamicToast from '../../components/DynamicToast'
import RightSideModal from '../../components/RightSideModal'

import {
  useBankReconciliation,
  getItemMeta,
  isBankSectionItem,
  getItemAmount,
  fmt,
} from './useBankReconciliation'

export default function BankReconciliationDetail({
  selectedReconciliation,
  onBack,
}) {
  const {
    reconData,
    items,
    itemsLoading,
    journalEntries,
    journalEntriesLoading,
    showItemModal,
    setShowItemModal,
    editingItem,
    setEditingItem,
    itemFormData,
    setItemFormData,
    itemFormRows,
    detailStartDate,
    setDetailStartDate,
    detailEndDate,
    setDetailEndDate,
    bankSearchTerm,
    setBankSearchTerm,
    bookSearchTerm,
    setBookSearchTerm,
    showToast,
    setShowToast,
    toastMessage,
    toastType,
    bankSectionFilter,
    setBankSectionFilter,
    editingBankBalance,
    setEditingBankBalance,
    bankBalanceInput,
    setBankBalanceInput,
    fetchReconciliationItems,
    handleUpdateBankStatementBalance,
    handleAddOrUpdateItem,
    handleEditItem,
    handleDeleteItem,
    resetItemForm,
    updateItemFormRow,
    addItemFormRow,
    removeItemFormRow,
    depositsInTransit,
    outstandingChecks,
    bankErrors,
    bankStatementEndingBalance,
    adjustedBankBalance,
    glDebits,
    glCredits,
    unadjustedBookBalance,
    endingBookBalance,
    bookAdditions,
    bookDeductions,
    bookErrorAdjustments,
    adjustedBookBalance,
    reconDifference,
    isReconciled,
    visibleBankItems,
    visibleJournalEntries,
    BANK_SECTION_ITEMS,
    BOOK_SECTION_ITEMS,
    // Adjustment state and handlers
    bankAdjustments,
    setBankAdjustments,
    bookAdjustments,
    setBookAdjustments,
    showBankAdjustmentForm,
    setShowBankAdjustmentForm,
    showBookAdjustmentForm,
    setShowBookAdjustmentForm,
    bankAdjustmentForm,
    setBankAdjustmentForm,
    bookAdjustmentForm,
    setBookAdjustmentForm,
    handleAddBankAdjustment,
    handleAddBookAdjustment,
    handleRemoveBankAdjustment,
    handleRemoveBookAdjustment,
    handleSaveSummary,
    bankCardAdditions,
    bankCardDeductions,
    bankCardErrors,
    bookCardAdditions,
    bookCardDeductions,
    bookCardErrors,
  } = useBankReconciliation(selectedReconciliation)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gray-50"
    >
      <div className="max-w-8xl mx-auto">
        {/* Back + Header */}
        <div className="mb-6">
          <motion.button
            whileHover={{ x: -3 }}
            onClick={onBack}
            className="mb-4 text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1.5 font-medium transition"
          >
            <ArrowLeft size={15} /> Back to Reconciliations
          </motion.button>
          <div className="flex justify-between items-start flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center">
                <Scale className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  Bank Reconciliation
                </h1>
                <p className="text-gray-500 text-sm">
                  {reconData.account_name} — {reconData.bank_account}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => fetchReconciliationItems()}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition flex items-center gap-2"
              >
                <RefreshCw size={14} /> Refresh
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  resetItemForm()
                  setEditingItem(null)
                  setShowItemModal(true)
                }}
                className="bg-gray-900 text-white px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-gray-800 transition"
              >
                <Plus size={16} /> Add Reconciling Item
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleSaveSummary()}
                className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-emerald-700 transition"
              >
                <FileText size={16} /> Save Summary
              </motion.button>
            </div>
          </div>
        </div>

        {/* Date Filter */}
        <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 mb-4 flex items-center gap-3 flex-wrap shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <Calendar size={15} />
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
              Filter by Date
            </p>
          </div>
          <div className="hidden md:block w-px h-8 bg-gray-100" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
              From
            </span>
            <input
              type="date"
              value={detailStartDate}
              onChange={(e) => setDetailStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-100 rounded-xl bg-gray-50 text-[11px] font-bold text-black outline-none focus:border-red-500 focus:bg-white transition-all"
            />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
              To
            </span>
            <input
              type="date"
              value={detailEndDate}
              onChange={(e) => setDetailEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-100 rounded-xl bg-gray-50 text-[11px] font-bold text-black outline-none focus:border-red-500 focus:bg-white transition-all"
            />
            <button
              onClick={() => {
                setDetailStartDate('')
                setDetailEndDate('')
              }}
              className="px-4 py-2 border border-gray-900 rounded-xl text-[10px] font-black text-gray-900 uppercase tracking-widest hover:border-red-500 hover:text-red-600 transition-all bg-white"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Status Banner */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`rounded-2xl border-2 p-5 mb-6 ${isReconciled ? 'border-emerald-500 bg-emerald-50' : 'border-red-500 bg-red-50'}`}
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              {isReconciled ? (
                <CheckCircle2 className="text-emerald-600" size={32} />
              ) : (
                <AlertCircle className="text-red-600" size={32} />
              )}
              <div>
                <p
                  className={`font-black text-lg ${isReconciled ? 'text-emerald-800' : 'text-red-800'}`}
                >
                  {isReconciled
                    ? '✓ RECONCILED — Adjusted book adjustments equals adjusted book balance'
                    : '⚠ NOT RECONCILED — Adjusted balances do not match'}
                </p>
                <p
                  className={`text-sm mt-0.5 ${isReconciled ? 'text-emerald-600' : 'text-red-600'}`}
                >
                  {isReconciled
                    ? 'Both adjusted balances equal ₱' + fmt(adjustedBankBalance)
                    : `Difference of ₱${fmt(Math.abs(reconDifference))} — review bank and book adjustments below`}
                </p>
              </div>
            </div>
            <div
              className={`text-right font-mono ${isReconciled ? 'text-emerald-800' : 'text-red-800'}`}
            >
              <p className="text-[10px] font-black uppercase tracking-wider opacity-60">
                Unreconciled Difference
              </p>
              <p className="text-3xl font-black">
                ₱{fmt(Math.abs(reconDifference))}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Two-Section Reconciliation Statement */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-6">
          {/* Section 1: Bank Balance */}
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
          >
            <div className="bg-blue-900 px-5 py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-5 h-5 rounded bg-blue-700 flex items-center justify-center text-white font-black text-xs">
                    1
                  </span>
                  <p className="text-white font-black text-sm uppercase tracking-wider">
                    BANK BALANCE RECONCILIATION
                  </p>
                </div>
                <p className="text-blue-300 text-xs">
                  Bank balance adjusted for deposits and outstanding checks
                </p>
                {detailStartDate && detailEndDate && (
                  <p className="text-blue-400 text-[10px] mt-1">
                    Period: {detailStartDate} to {detailEndDate}
                  </p>
                )}
              </div>
              <Building2 className="text-blue-400" size={22} />
            </div>
            <div className="p-5">
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <div>
                  <p className="text-sm font-bold text-gray-800">
                    Bank Statement Ending Balance
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Editable base bank statement closing amount
                  </p>
                </div>
                <div className="text-right">
                  {editingBankBalance ? (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm">₱</span>
                      <input
                        type="number"
                        step="0.01"
                        value={bankBalanceInput}
                        onChange={(e) => setBankBalanceInput(e.target.value)}
                        className="w-32 px-2 py-1 border border-blue-500 rounded-lg text-sm font-mono font-bold outline-none text-right"
                        autoFocus
                      />
                      <button
                        onClick={handleUpdateBankStatementBalance}
                        className="text-emerald-600 hover:text-emerald-700"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => setEditingBankBalance(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="font-black font-mono text-blue-700 text-xl hover:underline"
                      onClick={() => {
                        setBankBalanceInput(bankStatementEndingBalance.toFixed(2))
                        setEditingBankBalance(true)
                      }}
                      title="Click to update bank statement balance"
                    >
                      ₱{fmt(bankStatementEndingBalance)}
                    </button>
                  )}
                </div>
              </div>

              {/* Bank Adjustments Section */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Bank Adjustments
                  </p>
                  <button
                    onClick={() => setShowBankAdjustmentForm(!showBankAdjustmentForm)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Plus size={12} />
                    {showBankAdjustmentForm ? 'Cancel' : 'Add Adjustment'}
                  </button>
                </div>

                {showBankAdjustmentForm && (
                  <div className="bg-gray-50 rounded-xl p-3 mb-3 border border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                          Adjustment Type
                        </label>
                        <select
                          value={bankAdjustmentForm.type}
                          onChange={(e) => setBankAdjustmentForm({ ...bankAdjustmentForm, type: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold text-black bg-white outline-none focus:border-blue-500"
                        >
                          <option value="">Select type...</option>
                          <optgroup label="Bank Side">
                            <option value="deposits_in_transit">Deposit in Transit (add)</option>
                            <option value="outstanding_checks">Outstanding Check (less)</option>
                            <option value="error_bank">Bank Error / Correction (add/less)</option>
                          </optgroup>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                          Amount
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={bankAdjustmentForm.amount}
                          onChange={(e) => setBankAdjustmentForm({ ...bankAdjustmentForm, amount: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold text-black bg-white outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                        Description (optional)
                      </label>
                      <input
                        type="text"
                        placeholder="Enter description..."
                        value={bankAdjustmentForm.description}
                        onChange={(e) => setBankAdjustmentForm({ ...bankAdjustmentForm, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold text-black bg-white outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddBankAdjustment}
                        className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition"
                      >
                        Add Adjustment
                      </button>
                      <button
                        onClick={() => {
                          setShowBankAdjustmentForm(false)
                          setBankAdjustmentForm({ type: '', description: '', amount: '' })
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Bank Adjustments List */}
                {bankAdjustments.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {bankAdjustments.map((adj) => {
                      const meta = getItemMeta(adj.type)
                      return (
                        <div key={adj.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${meta.badge}`}>
                              {meta.label}
                            </span>
                            {adj.description && (
                              <span className="text-xs text-gray-600">{adj.description}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold font-mono text-xs ${meta.effect === 'add' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {meta.effect === 'add' ? '+' : '−'} ₱{fmt(adj.amount)}
                            </span>
                            <button
                              onClick={() => handleRemoveBankAdjustment(adj.id)}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <TrendingUp size={15} className="text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Add: Deposits in Transit
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Bank-side debits waiting to clear the statement
                    </p>
                  </div>
                </div>
                <span className="font-bold font-mono text-emerald-600">
                  + ₱{fmt(depositsInTransit + bankCardAdditions)}
                </span>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <TrendingDown size={15} className="text-rose-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Less: Outstanding Checks
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Bank-side credits still pending clearance
                    </p>
                  </div>
                </div>
                <span className="font-bold font-mono text-rose-600">
                  − ₱{fmt(outstandingChecks + bankCardDeductions)}
                </span>
              </div>

              {bankCardErrors !== 0 && (
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Info size={15} className="text-amber-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Add/Less: Bank Error Corrections
                      </p>
                      <p className="text-[10px] text-gray-400">
                        Corrections for bank errors
                      </p>
                    </div>
                  </div>
                  <span
                    className={`font-bold font-mono ${bankCardErrors >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    {bankCardErrors >= 0 ? '+' : '−'} ₱
                    {fmt(Math.abs(bankCardErrors))}
                  </span>
                </div>
              )}

              <div className="mt-4 pt-4 border-t-2 border-blue-900 flex justify-between items-center bg-blue-50 -mx-5 px-5 py-3">
                <div>
                  <p className="text-sm font-black text-blue-900 uppercase tracking-wide">
                    ADJUSTED BANK BALANCE
                  </p>
                  <p className="text-[10px] text-blue-600 mt-0.5">
                    Bank ending balance after reconciling deposits and checks
                  </p>
                </div>
                <span className="text-2xl font-black text-blue-900 font-mono">
                  ₱{fmt(adjustedBankBalance)}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Section 2: Book Balance */}
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
          >
            <div className="bg-violet-900 px-5 py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-5 h-5 rounded bg-violet-700 flex items-center justify-center text-white font-black text-xs">
                    2
                  </span>
                  <p className="text-white font-black text-sm uppercase tracking-wider">
                    BOOK BALANCE RECONCILIATION
                  </p>
                </div>
                <p className="text-violet-300 text-xs">
                  GL book records reconciled to bank reconciling items
                </p>
                {detailStartDate && detailEndDate && (
                  <p className="text-violet-400 text-[10px] mt-1">
                    Period: {detailStartDate} to {detailEndDate}
                  </p>
                )}
              </div>
              <FileText className="text-violet-400" size={22} />
            </div>
            <div className="p-5">
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <div>
                  <p className="text-sm font-bold text-gray-800">
                    Unadjusted Book Balance
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {journalEntries.length > 0
                      ? 'GL total debits minus GL total credits'
                      : 'No journal entries loaded — using stored GL running balance'}
                  </p>
                </div>
                <span className="text-xl font-black text-violet-900 font-mono">
                  ₱{fmt(unadjustedBookBalance)}
                </span>
              </div>

              {/* Book Adjustments Section */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Book Adjustments
                  </p>
                  <button
                    onClick={() => setShowBookAdjustmentForm(!showBookAdjustmentForm)}
                    className="text-xs font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1"
                  >
                    <Plus size={12} />
                    {showBookAdjustmentForm ? 'Cancel' : 'Add Adjustment'}
                  </button>
                </div>

                {showBookAdjustmentForm && (
                  <div className="bg-gray-50 rounded-xl p-3 mb-3 border border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                          Adjustment Type
                        </label>
                        <select
                          value={bookAdjustmentForm.type}
                          onChange={(e) => setBookAdjustmentForm({ ...bookAdjustmentForm, type: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold text-black bg-white outline-none focus:border-violet-500"
                        >
                          <option value="">Select type...</option>
                          <optgroup label="Book Side">
                            <option value="interest_income">Interest Earned (add)</option>
                            <option value="credit_memo">Bank Credit Memo / EFT (add)</option>
                            <option value="bank_charges">Bank Service Fee (less)</option>
                            <option value="nsf_checks">NSF / Bounced Check (less)</option>
                            <option value="debit_memo">Bank Debit Memo (less)</option>
                            <option value="error_book">Book Error / Correction (add/less)</option>
                          </optgroup>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                          Amount
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={bookAdjustmentForm.amount}
                          onChange={(e) => setBookAdjustmentForm({ ...bookAdjustmentForm, amount: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold text-black bg-white outline-none focus:border-violet-500"
                        />
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                        Description (optional)
                      </label>
                      <input
                        type="text"
                        placeholder="Enter description..."
                        value={bookAdjustmentForm.description}
                        onChange={(e) => setBookAdjustmentForm({ ...bookAdjustmentForm, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold text-black bg-white outline-none focus:border-violet-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddBookAdjustment}
                        className="flex-1 bg-violet-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-violet-700 transition"
                      >
                        Add Adjustment
                      </button>
                      <button
                        onClick={() => {
                          setShowBookAdjustmentForm(false)
                          setBookAdjustmentForm({ type: '', description: '', amount: '' })
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Book Adjustments List */}
                {bookAdjustments.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {bookAdjustments.map((adj) => {
                      const meta = getItemMeta(adj.type)
                      return (
                        <div key={adj.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${meta.badge}`}>
                              {meta.label}
                            </span>
                            {adj.description && (
                              <span className="text-xs text-gray-600">{adj.description}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold font-mono text-xs ${meta.effect === 'add' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {meta.effect === 'add' ? '+' : '−'} ₱{fmt(adj.amount)}
                            </span>
                            <button
                              onClick={() => handleRemoveBookAdjustment(adj.id)}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <TrendingUp size={15} className="text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Add: Book Additions
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Book-side debits that increase the GL balance
                    </p>
                  </div>
                </div>
                <span className="font-bold font-mono text-emerald-600">
                  + ₱{fmt(bookAdditions + bookCardAdditions)}
                </span>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <TrendingDown size={15} className="text-rose-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Less: Book Deductions
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Book-side credits that decrease the GL balance
                    </p>
                  </div>
                </div>
                <span className="font-bold font-mono text-rose-600">
                  − ₱{fmt(bookDeductions + bookCardDeductions)}
                </span>
              </div>

              {(bookErrorAdjustments !== 0 || bookCardErrors !== 0) && (
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Info size={15} className="text-amber-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Add/Less: Book Error Corrections
                      </p>
                      <p className="text-[10px] text-gray-400">
                        Corrections for recording errors in the GL
                      </p>
                    </div>
                  </div>
                  <span
                    className={`font-bold font-mono ${(bookErrorAdjustments + bookCardErrors) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    {(bookErrorAdjustments + bookCardErrors) >= 0 ? '+' : '−'} ₱
                    {fmt(Math.abs(bookErrorAdjustments + bookCardErrors))}
                  </span>
                </div>
              )}

              <div className="mt-4 pt-4 border-t-2 border-violet-900 flex justify-between items-center bg-violet-50 -mx-5 px-5 py-3">
                <div>
                  <p className="text-sm font-black text-violet-900 uppercase tracking-wide">
                    Adjusted Book Balance
                  </p>
                  <p className="text-[10px] text-violet-600 mt-0.5">
                    Must equal the Adjusted Bank Balance to reconcile
                  </p>
                </div>
                <span className="text-2xl font-black text-violet-900 font-mono">
                  ₱{fmt(adjustedBookBalance)}
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Equality Check Row */}
        <div
          className={`rounded-2xl border-2 p-4 mb-6 flex items-center justify-between flex-wrap gap-4 ${isReconciled ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-300'}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`px-4 py-3 rounded-xl text-center ${isReconciled ? 'bg-blue-100' : 'bg-blue-50'}`}
            >
              <p className="text-[9px] font-black text-blue-500 uppercase tracking-[2px]">
                Adjusted Book Adjustments
              </p>
              <p className="font-black font-mono text-blue-900 text-lg">
                ₱{fmt(adjustedBankBalance)}
              </p>
            </div>
            <div
              className={`font-black text-2xl ${isReconciled ? 'text-emerald-600' : 'text-amber-500'}`}
            >
              {isReconciled ? '=' : '≠'}
            </div>
            <div
              className={`px-4 py-3 rounded-xl text-center ${isReconciled ? 'bg-violet-100' : 'bg-violet-50'}`}
            >
              <p className="text-[9px] font-black text-violet-500 uppercase tracking-[2px]">
                Adjusted Book
              </p>
              <p className="font-black font-mono text-violet-900 text-lg">
                ₱{fmt(adjustedBookBalance)}
              </p>
            </div>
            {!isReconciled && (
              <div className="px-4 py-3 bg-red-50 rounded-xl text-center border border-red-200">
                <p className="text-[9px] font-black text-red-500 uppercase tracking-[2px]">
                  Difference
                </p>
                <p className="font-black font-mono text-red-700 text-lg">
                  ₱{fmt(Math.abs(reconDifference))}
                </p>
              </div>
            )}
          </div>
          <p
            className={`text-sm font-bold ${isReconciled ? 'text-emerald-700' : 'text-amber-700'}`}
          >
            {isReconciled
              ? '✓ Both adjusted balances match. Reconciliation is complete.'
              : 'Add more reconciling items until both adjusted balances are equal.'}
          </p>
        </div>

        {/* Reconciling Items Table */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm mb-6"
        >
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-black text-gray-900 text-sm uppercase tracking-wider">
                All Reconciling Items
                <span className="text-gray-400 font-normal normal-case ml-2 text-sm tracking-normal">
                  ({visibleBankItems.length} of {items.length})
                </span>
              </h2>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Bank section items adjust the bank statement; Book section items
                adjust the GL balance
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 h-9 focus-within:border-gray-900 focus-within:bg-white transition-all">
                <Search size={14} className="text-gray-300 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search items..."
                  value={bankSearchTerm}
                  onChange={(e) => setBankSearchTerm(e.target.value)}
                  className="w-44 bg-transparent border-none outline-none text-[12px] font-bold text-black placeholder:text-gray-300"
                />
                {bankSearchTerm && (
                  <button
                    onClick={() => setBankSearchTerm('')}
                    className="text-gray-300 hover:text-red-500"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs font-bold">
                {[
                  ['all', 'All'],
                  ['bank', 'Bank Side'],
                  ['book', 'Book Side'],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setBankSectionFilter(val)}
                    className={`px-3 py-1.5 rounded-md transition ${bankSectionFilter === val ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {itemsLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : visibleBankItems.length === 0 ? (
            <div className="p-12 text-center">
              <Scale className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">
                No reconciling items yet
              </p>
              <p className="text-gray-400 text-xs mt-1">
                Click "Add Reconciling Item" to add bank or book adjustments
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {[
                      'Date',
                      'Section',
                      'Details',
                      'Reference',
                      'Description',
                      'Debit',
                      'Credit',
                      'Actions',
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={`px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider ${h === 'Actions' ? 'text-center' : i >= 5 ? 'text-right' : 'text-left'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleBankItems.map((item, idx) => {
                    const detailsValue =
                      item.bri_details || item.details || item.item_type
                    const meta = getItemMeta(detailsValue)
                    const isBank = isBankSectionItem(detailsValue)
                    const debitValue = parseFloat(item.debit || 0)
                    const creditValue = parseFloat(item.credit || 0)
                    return (
                      <motion.tr
                        key={item.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.025 }}
                        className="border-b border-gray-50 hover:bg-gray-50 transition group"
                      >
                        <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                          {new Date(item.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${isBank ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}
                          >
                            {isBank ? 'Bank' : 'Book'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${meta.badge}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-500 font-mono">
                          {item.reference_number || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-700 max-w-xs truncate">
                          {item.description || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-sm font-bold font-mono text-right text-gray-900">
                          {debitValue !== 0 ? `₱${fmt(debitValue)}` : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-sm font-bold font-mono text-right text-gray-900">
                          {creditValue !== 0 ? `₱${fmt(creditValue)}` : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2 transition">
                            <button
                              onClick={() => handleEditItem(item)}
                              className="text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 px-2 py-1 rounded-lg transition"
                              aria-label="Edit item"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="text-xs font-bold text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 px-2 py-1 rounded-lg transition"
                              aria-label="Delete item"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-900">
                    <td
                      colSpan="5"
                      className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider"
                    >
                      Bank Side Total Impact &rarr;
                    </td>
                    <td colSpan="2" className="px-5 py-3 text-right">
                      <div className="space-y-1">
                        <div className="text-xs text-blue-600 font-bold font-mono">
                          Bank adj: +₱{fmt(depositsInTransit)} −₱
                          {fmt(outstandingChecks)}
                        </div>
                        <div className="text-xs text-violet-600 font-bold font-mono">
                          Book adj: +₱{fmt(bookAdditions)} −₱{fmt(bookDeductions)}
                        </div>
                      </div>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </motion.div>

        {/* General Ledger — Book Records */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
        >
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-violet-600 rounded flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <h3 className="font-black text-sm text-gray-900 uppercase tracking-wider">
                  General Ledger — Book Records
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  GL Balance: ₱{fmt(endingBookBalance)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 h-9 focus-within:border-gray-900 focus-within:bg-white transition-all">
              <Search size={14} className="text-gray-300 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search GL..."
                value={bookSearchTerm}
                onChange={(e) => setBookSearchTerm(e.target.value)}
                className="w-36 bg-transparent border-none outline-none text-[12px] font-bold text-black placeholder:text-gray-300"
              />
            </div>
          </div>

          {journalEntriesLoading ? (
            <div className="p-8 flex items-center justify-center">
              <Loader className="w-8 h-8 text-gray-300 animate-spin" />
            </div>
          ) : visibleJournalEntries.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400 text-sm font-medium">
                No journal entries found
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {[
                      'Date',
                      'Reference / DB',
                      'Responsibility Center',
                      'Debit (+)',
                      'Credit (−)',
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider ${i >= 3 ? 'text-right' : 'text-left'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleJournalEntries.map((entry) => {
                    const isDebit = entry.type?.toLowerCase() === 'debit'
                    return (
                      <motion.tr
                        key={entry.id}
                        className="border-b border-gray-50 hover:bg-violet-50/30 transition"
                      >
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                          {new Date(entry.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700 font-mono font-medium">
                          {entry.db_name || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {entry.responsibility_center || '—'}
                        </td>
                        <td
                          className={`px-4 py-3 text-right text-xs font-mono font-bold ${isDebit ? 'text-blue-700' : 'text-gray-300'}`}
                        >
                          {isDebit ? `₱${fmt(entry.amount)}` : '—'}
                        </td>
                        <td
                          className={`px-4 py-3 text-right text-xs font-mono font-bold ${!isDebit ? 'text-rose-600' : 'text-gray-300'}`}
                        >
                          {!isDebit ? `₱${fmt(entry.amount)}` : '—'}
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-violet-900">
                    <td
                      colSpan="3"
                      className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider"
                    >
                      TOTALS
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-black text-blue-700 font-mono">
                      ₱{fmt(glDebits)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-black text-rose-600 font-mono">
                      ₱{fmt(glCredits)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </motion.div>
      </div>

      {/* Add / Edit Item Modal */}
      <RightSideModal
        isOpen={showItemModal}
        onClose={() => {
          setShowItemModal(false)
          setEditingItem(null)
          resetItemForm()
        }}
        title={editingItem ? 'Edit Reconciling Item' : 'Add Reconciling Items'}
        size={editingItem ? 'xl' : '5xl'}
      >
        <div className="pb-16">
          <div className="p-3 overflow-y-auto max-h-[75vh]">
            <div className="mb-5 grid grid-cols-2 gap-3">
              {/* <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[2px] mb-1.5">
                  Bank Section Items
                </p>
                {BANK_SECTION_ITEMS.map((t) => (
                  <div
                    key={t.value}
                    className="flex items-center gap-1.5 text-[11px] text-blue-800 mb-0.5"
                  >
                    <span className="font-black">
                      {t.effect === 'add' ? '+' : t.effect === 'deduct' ? '−' : '±'}
                    </span>
                    {t.label}
                  </div>
                ))}
              </div>
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
                <p className="text-[10px] font-black text-violet-600 uppercase tracking-[2px] mb-1.5">
                  Book Section Items
                </p>
                {BOOK_SECTION_ITEMS.map((t) => (
                  <div
                    key={t.value}
                    className="flex items-center gap-1.5 text-[11px] text-violet-800 mb-0.5"
                  >
                    <span className="font-black">
                      {t.effect === 'add' ? '+' : t.effect === 'deduct' ? '−' : '±'}
                    </span>
                    {t.label}
                  </div>
                ))}
              </div> */}
            </div>

            {editingItem ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                    Details *
                  </label>
                  <input
                    type="text"
                    value={itemFormData.details}
                    onChange={(e) =>
                      setItemFormData({ ...itemFormData, details: e.target.value })
                    }
                    placeholder="Enter bank details"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={itemFormData.date}
                      onChange={(e) =>
                        setItemFormData({ ...itemFormData, date: e.target.value })
                      }
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                      Reference No.
                    </label>
                    <input
                      type="text"
                      value={itemFormData.reference_number}
                      onChange={(e) =>
                        setItemFormData({
                          ...itemFormData,
                          reference_number: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                      Description
                    </label>
                    <input
                      type="text"
                      value={itemFormData.description}
                      onChange={(e) =>
                        setItemFormData({
                          ...itemFormData,
                          description: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="col-span-2 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                        Debit
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                          ₱
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={itemFormData.debit}
                          onChange={(e) =>
                            setItemFormData({
                              ...itemFormData,
                              debit: e.target.value,
                              credit: e.target.value ? '' : itemFormData.credit,
                            })
                          }
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                        Credit
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                          ₱
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={itemFormData.credit}
                          onChange={(e) =>
                            setItemFormData({
                              ...itemFormData,
                              credit: e.target.value,
                              debit: e.target.value ? '' : itemFormData.debit,
                            })
                          }
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-black text-gray-900 uppercase tracking-wider">
                    Batch Reconciling Items
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Add multiple items in one save. Each row is one reconciling
                    entry.
                  </p>
                </div>

                <div className="space-y-2">
                  {itemFormRows.map((row, index) => {
                    const meta = getItemMeta(row.details)
                    return (
                      <div
                        key={index}
                        className={`border rounded-xl p-3 bg-white ${meta.borderColor}`}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-13 gap-2 items-end">
                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">
                              Details *
                            </label>
                            <input
                              type="text"
                              value={row.details}
                              onChange={(e) =>
                                updateItemFormRow(index, 'details', e.target.value)
                              }
                              placeholder="Enter details"
                              className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-xs"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">
                              Date *
                            </label>
                            <input
                              type="date"
                              value={row.date}
                              onChange={(e) =>
                                updateItemFormRow(index, 'date', e.target.value)
                              }
                              className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">
                              Reference No.
                            </label>
                            <input
                              type="text"
                              value={row.reference_number}
                              onChange={(e) =>
                                updateItemFormRow(
                                  index,
                                  'reference_number',
                                  e.target.value,
                                )
                              }
                              placeholder="Check no."
                              className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">
                              Description
                            </label>
                            <input
                              type="text"
                              value={row.description}
                              onChange={(e) =>
                                updateItemFormRow(
                                  index,
                                  'description',
                                  e.target.value,
                                )
                              }
                              placeholder="Description details"
                              className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                            />
                          </div>

                          <div className="md:col-span-3 grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">
                                Debit
                              </label>
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                                  ₱
                                </span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={row.debit}
                                  onChange={(e) => {
                                    updateItemFormRow(index, 'debit', e.target.value)
                                    if (e.target.value) {
                                      updateItemFormRow(index, 'credit', '')
                                    }
                                  }}
                                  placeholder="0.00"
                                  className="w-full pl-5 pr-2 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">
                                Credit
                              </label>
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                                  ₱
                                </span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={row.credit}
                                  onChange={(e) => {
                                    updateItemFormRow(
                                      index,
                                      'credit',
                                      e.target.value,
                                    )
                                    if (e.target.value) {
                                      updateItemFormRow(index, 'debit', '')
                                    }
                                  }}
                                  placeholder="0.00"
                                  className="w-full pl-5 pr-2 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="md:col-span-1 flex items-end justify-end">
                            <button
                              type="button"
                              onClick={() => removeItemFormRow(index)}
                              disabled={itemFormRows.length === 1}
                              className="w-9 h-9 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition"
                              aria-label="Delete row"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
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
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowItemModal(false)
                  setEditingItem(null)
                  resetItemForm()
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 text-sm font-bold hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddOrUpdateItem}
                className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition flex items-center justify-center gap-2"
              >
                <Check size={16} />
                {editingItem
                  ? 'Update Item'
                  : `Save ${itemFormRows.length} Reconciling Item${itemFormRows.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      </RightSideModal>


      {showToast && (
        <DynamicToast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
    </motion.div>
  )
}
