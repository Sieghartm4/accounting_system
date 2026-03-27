import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Save, Plus, Trash2, Wallet,
  FileText, CheckCircle2, Paperclip, Calculator,
  Layers, Landmark
} from 'lucide-react';

export default function CashDisbursementForm({ onBack }) {
  const [disbursementItems, setDisbursementItems] = useState([
    {
      id: 1,
      product: '',
      coa: '',
      description: '',
      unit: '',
      qty: 1,
      price: 0,
      vat: 0,
      wht: 0,
      responsibilityCenter: ''
    }
  ]);

  const [journalEntries, setJournalEntries] = useState([
    {
      id: 1,
      account: '',
      center: '',
      debit: 0,
      credit: 0
    }
  ]);

  const fadeInUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  // Functions to handle adding new rows
  const addDisbursementItem = () => {
    const newItem = {
      id: disbursementItems.length + 1,
      product: '',
      coa: '',
      description: '',
      unit: '',
      qty: 1,
      price: 0,
      vat: 0,
      wht: 0,
      responsibilityCenter: ''
    };
    setDisbursementItems([...disbursementItems, newItem]);
  };

  const addJournalEntry = () => {
    const newEntry = {
      id: journalEntries.length + 1,
      account: '',
      center: '',
      debit: 0,
      credit: 0
    };
    setJournalEntries([...journalEntries, newEntry]);
  };

  const removeDisbursementItem = (id) => {
    setDisbursementItems(disbursementItems.filter(item => item.id !== id));
  };

  const removeJournalEntry = (id) => {
    setJournalEntries(journalEntries.filter(entry => entry.id !== id));
  };

  const updateDisbursementItem = (id, field, value) => {
    setDisbursementItems(disbursementItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const updateJournalEntry = (id, field, value) => {
    setJournalEntries(journalEntries.map(entry =>
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
  };
  // 1. Add this to your state declarations at the top
  const [attachments, setAttachments] = useState([
    { id: 1, fileName: '', file: null, remarks: '', uploadedBy: 'Current User', date: new Date().toLocaleDateString() }
  ]);

  // 2. Add these handler functions
  const addAttachment = () => {
    setAttachments([...attachments, {
      id: Date.now(),
      fileName: '',
      file: null,
      remarks: '',
      uploadedBy: 'Current User',
      date: new Date().toLocaleDateString()
    }]);
  };

  const removeAttachment = (id) => {
    setAttachments(attachments.filter(a => a.id !== id));
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F3F4F6]">
      {/* Custom Scroller Theme Styling */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-table-scroller::-webkit-scrollbar {
          height: 6px;
          width: 6px;
        }
        .custom-table-scroller::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-table-scroller::-webkit-scrollbar-thumb {
          background: #1a1a1a;
          border-radius: 10px;
        }
        .custom-table-scroller::-webkit-scrollbar-thumb:hover {
          background: #dc2626;
        }
      `}} />

      {/* --- TOP NAVIGATION & PRIMARY ACTION --- */}
      <div className="flex items-center justify-between mb-3">
        <nav
          className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[2px] text-gray-400 cursor-pointer hover:text-black transition-colors"
          onClick={onBack}
        >
          <ArrowLeft size={17} />
          <span className="text-black">Back to Cash Disbursements</span>
        </nav>

        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-gray-200 text-[12px] font-black text-gray-400 rounded-lg hover:bg-gray-50 transition-all uppercase tracking-widest">
            Save Draft
          </button>
          <button className="px-6 py-2 bg-red-600 text-white text-[12px] font-black rounded-lg hover:bg-red-700 transition-all uppercase tracking-[2px] flex items-center gap-2 shadow-md shadow-red-200">
            <Save size={14} />
            Post Transaction
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">

        {/* --- LEFT SIDEBAR: FIXED HEIGHT COMPONENTS --- */}
        <aside className="w-78 flex flex-col flex-shrink-0 gap-3 overflow-hidden">
          <section className="bg-black rounded-2xl p-4 text-white shadow-xl flex-shrink-0">
            <h3 className="text-[12px] font-black uppercase tracking-[3px] text-red-500 mb-1 flex items-center gap-2">
              <Landmark size={12} /> Basic Details
            </h3>
            <div className="grid grid-cols-1 gap-2.5">
              <SidebarInput label="Vendor / Payee" required />
              <div className="grid grid-cols-2 gap-2">
                <SidebarInput label="Reference" placeholder="INV-000" />
                <SidebarInput label="Date" type="date" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SidebarInput label="Mode" type="select" />
                <SidebarInput label="Category" type="select" />
              </div>
              <SidebarInput label="Bank / Check #" />
            </div>
          </section>

          <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex-1 flex flex-col justify-between overflow-hidden">
            <div>
              <h3 className="text-[12px] font-black uppercase tracking-[3px] text-gray-900 mb-4 flex items-center gap-2">
                <Calculator size={12} /> Summary
              </h3>
              <div className="space-y-0.5">
                <SummaryRow label="Total Purchase Price" value="0.00" />
                <Divider />
                <SummaryRow label="Total Discount" value="0.00" />
                <Divider />
                <SummaryRow label="Total Discounted Amount" value="1,000,000,000,000,000.00" />
                <Divider />
                <SummaryRow label="Total VAT" value="0.00" color="text-red-600" />
                <Divider />
                <SummaryRow label="VATable Purchases" value="0.00" />
                <Divider />
                <SummaryRow label="VAT-Exempted Purchases" value="0.00" />
                <Divider />
                <SummaryRow label="Zero Rated Purchases" value="0.00" />
                <Divider />
                <SummaryRow label="Total No. VAT Discount" value="0.00" />
                <Divider />
                <SummaryRow label="Total Net of VAT" value="0.00" />
                <Divider />
                <SummaryRow label="Total Withholding Tax" value="0.00" />

              </div>
            </div>
            <div className="mt-4 flex flex-col items-center">
              <div className="w-full flex flex-col gap-[2px] mb-4">
                <div className="h-[2px] w-full bg-red-600 rounded-full"></div>
                <div className="h-[1px] w-full bg-black/10"></div>
              </div>

              <div className="text-center">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[3px] mb-2">
                  Total Amount Due
                </p>
                <p className="text-3xl font-black text-black tracking-tighter uppercase leading-none flex items-baseline justify-center gap-1">
                  <span className="text-[14px] text-red-600">PHP</span>
                  0.00
                </p>
              </div>
            </div>
          </section>
        </aside>

        {/* --- MAIN CONTENT --- */}
        <main className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
          <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="space-y-4">

            {/* 1. DISBURSEMENT ITEMS*/}
            <TableSection title="Disbursement Items" icon={<Wallet size={14} />}>
              <div className="w-full flex flex-col gap-[2px] mb-4">
                <div className="h-[2px] w-full bg-red-600 rounded-full"></div>
                <div className="h-[1px] w-full bg-black/10"></div>
              </div>
              <div className="overflow-x-auto custom-table-scroller max-h-[400px]">
                <table className="w-full text-center table-fixed min-w-[1000px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="pb-2 text-[13px] font-black uppercase text-gray-500 tracking-tighter w-[12%]">Products & Service</th>
                      <th className="pb-2 text-[13px] font-black uppercase text-gray-500 tracking-tighter w-[12%]">COA</th>
                      <th className="pb-2 text-[13px] font-black uppercase text-gray-500 tracking-tighter w-[14%]">Description</th>
                      <th className="pb-2 text-[13px] font-black uppercase text-gray-500 tracking-tighter w-[7%]">Unit</th>
                      <th className="pb-2 text-[13px] font-black uppercase text-gray-500 tracking-tighter w-[6%]">Qty</th>
                      <th className="pb-2 text-[13px] font-black uppercase text-gray-500 tracking-tighter w-[6%]">Price</th>
                      <th className="pb-2 text-[13px] font-black uppercase text-gray-500 tracking-tighter w-[6%]">VAT</th>
                      <th className="pb-2 text-[13px] font-black uppercase text-gray-500 tracking-tighter w-[6%]">WHT</th>
                      <th className="pb-2 text-[13px] font-black uppercase text-gray-500 tracking-tighter w-[10%]">Responsibility Center</th>
                      <th className="pb-2 text-[13px] font-black uppercase text-gray-500 tracking-tighter w-[6%]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {disbursementItems.map((item) => (
                      <tr key={item.id} className="group">
                        <td className="py-1 px-1">
                          <input
                            className="w-full bg-gray-50/50 rounded-md px-1 py-1 text-[15px] font-bold text-center outline-none focus:ring-1 focus:ring-red-500 transition-all"
                            placeholder="Item..."
                            value={item.product}
                            onChange={(e) => updateDisbursementItem(item.id, 'product', e.target.value)}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <select
                            className="w-full bg-gray-50/50 rounded-md px-1 py-1 text-[15px] font-bold text-center outline-none appearance-none cursor-pointer"
                            value={item.coa}
                            onChange={(e) => updateDisbursementItem(item.id, 'coa', e.target.value)}
                          >
                            <option value="">Select</option>
                            <option value="account1">Account 1</option>
                            <option value="account2">Account 2</option>
                          </select>
                        </td>
                        <td className="py-1 px-1">
                          <input
                            className="w-full bg-gray-50/50 rounded-md px-1 py-1 text-[15px] font-bold text-center outline-none"
                            placeholder="Details..."
                            value={item.description}
                            onChange={(e) => updateDisbursementItem(item.id, 'description', e.target.value)}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <input
                            className="w-full bg-gray-50/50 rounded-md px-1 py-1 text-[15px] font-bold text-center outline-none"
                            placeholder="pc"
                            value={item.unit}
                            onChange={(e) => updateDisbursementItem(item.id, 'unit', e.target.value)}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <input
                            className="w-full bg-gray-50/50 rounded-md px-1 py-1 text-[15px] font-bold text-center outline-none"
                            type="number"
                            defaultValue="1"
                            value={item.qty}
                            onChange={(e) => updateDisbursementItem(item.id, 'qty', parseInt(e.target.value) || 0)}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <input
                            className="w-full bg-gray-50/50 rounded-md px-1 py-1 text-[15px] font-black text-center outline-none"
                            placeholder="0.00"
                            value={item.price}
                            onChange={(e) => updateDisbursementItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <input
                            className="w-full bg-gray-50/50 rounded-md px-1 py-1 text-[15px] font-black text-center text-red-600 outline-none"
                            placeholder="0.00"
                            value={item.vat}
                            onChange={(e) => updateDisbursementItem(item.id, 'vat', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <input
                            className="w-full bg-gray-50/50 rounded-md px-1 py-1 text-[15px] font-black text-center outline-none"
                            placeholder="0.00"
                            value={item.wht}
                            onChange={(e) => updateDisbursementItem(item.id, 'wht', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <input
                            className="w-full bg-gray-50/50 rounded-md px-1 py-1 text-[15px] font-bold text-center outline-none"
                            placeholder="Select"
                            value={item.responsibilityCenter}
                            onChange={(e) => updateDisbursementItem(item.id, 'responsibilityCenter', e.target.value)}
                          />
                        </td>
                        <td className="py-1 px-1 text-center">
                          <button
                            className="p-1 text-red-600 transition-colors"
                            onClick={() => removeDisbursementItem(item.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={addDisbursementItem} className="mt-2 py-1.5 border-2 border-dashed border-gray-100 rounded-lg w-full text-[12px] font-black uppercase tracking-widest text-gray-400 hover:border-red-200 hover:text-red-600 transition-all flex items-center justify-center gap-1">
                <Plus size={15} /> Add Line
              </button>
            </TableSection>

            {/* 2. JOURNAL ENTRIES */}
            <TableSection title="Journal Entries" icon={<Layers size={14} />}>
              <div className="w-full flex flex-col gap-[2px] mb-4">
                <div className="h-[2px] w-full bg-red-600 rounded-full"></div>
                <div className="h-[1px] w-full bg-black/10"></div>
              </div>
              <div className="overflow-x-auto custom-table-scroller max-h-[300px]">
                <table className="w-full text-center table-fixed">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="pb-3 text-[13px] font-black uppercase text-gray-500 tracking-widest w-[40%] text-center">Charts of Account</th>
                      <th className="pb-3 text-[13px] font-black uppercase text-gray-500 tracking-widest w-[20%] text-center">Responsibility Center</th>
                      <th className="pb-3 text-[13px] font-black uppercase text-gray-500 tracking-widest w-[17%] text-center">Debit</th>
                      <th className="pb-3 text-[13px] font-black uppercase text-gray-500 tracking-widest w-[17%] text-center">Credit</th>
                      <th className="pb-3 text-center w-[6%]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {journalEntries.map((entry) => (
                      <tr key={entry.id} className="group">
                        <td className="py-1.5 px-1">
                          <select
                            className="w-full bg-gray-50/50 rounded-md px-2 py-1.5 text-[12px] font-bold text-center outline-none appearance-none cursor-pointer"
                            value={entry.account}
                            onChange={(e) => updateJournalEntry(entry.id, 'account', e.target.value)}
                          >
                            <option value="">Account...</option>
                            <option value="account1">Cash in Bank</option>
                            <option value="account2">Purchase Expense</option>
                            <option value="account3">Accounts Payable</option>
                          </select>
                        </td>
                        <td className="py-1.5 px-1">
                          <input
                            className="w-full bg-gray-50/50 rounded-md px-2 py-1.5 text-[15px] font-bold text-center outline-none"
                            placeholder="Responsibility Center..."
                            value={entry.center}
                            onChange={(e) => updateJournalEntry(entry.id, 'center', e.target.value)}
                          />
                        </td>
                        <td className="py-1.5 px-1">
                          <input
                            className="w-full bg-gray-50/50 rounded-md px-2 py-1.5 text-[15px] font-black text-center outline-none"
                            placeholder="0.00"
                            type="number"
                            value={entry.debit}
                            onChange={(e) => updateJournalEntry(entry.id, 'debit', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="py-1.5 px-1">
                          <input
                            className="w-full bg-gray-50/50 rounded-md px-2 py-1.5 text-[15px] font-black text-center text-red-600 outline-none"
                            placeholder="0.00"
                            type="number"
                            value={entry.credit}
                            onChange={(e) => updateJournalEntry(entry.id, 'credit', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="py-1.5 text-center">
                          <button
                            className="p-1 text-red-600 transition-colors"
                            onClick={() => removeJournalEntry(entry.id)}
                          >
                            <Trash2 size={15} className="mx-auto" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50/50">
                      <td colSpan={2} className="py-2 px-3 text-[12px] font-black uppercase text-black text-left">Balance Check</td>
                      <td className="py-2 px-1 text-center text-[15px] font-black">0.00</td>
                      <td className="py-2 px-1 text-center text-[15px] font-black text-red-600">0.00</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <button onClick={addJournalEntry} className="mt-2 py-1.5 border-2 border-dashed border-gray-100 rounded-lg w-full text-[12px] font-black uppercase tracking-widest text-gray-400 hover:border-red-200 hover:text-red-600 transition-all flex items-center justify-center gap-1">
                <Plus size={15} /> Add Ledger Row
              </button>
            </TableSection>


            {/* 3. ATTACHMENTS & REMARKS */}
            <div className="grid grid-cols-1 gap-4">
              <TableSection title="Attachments" icon={<Paperclip size={14} />}>
                <div className="w-full flex flex-col gap-[2px] mb-4">
                  <div className="h-[2px] w-full bg-red-600 rounded-full"></div>
                  <div className="h-[1px] w-full bg-black/10"></div>
                </div>
                <div className="overflow-x-auto custom-table-scroller">
                  <table className="w-full text-center table-fixed min-w-[900px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="pb-3 text-[13px] font-black uppercase text-gray-500 tracking-tighter w-[20%]">File Name</th>
                        <th className="pb-3 text-[13px] font-black uppercase text-gray-500 tracking-tighter w-[20%]">File</th>
                        <th className="pb-3 text-[13px] font-black uppercase text-gray-500 tracking-tighter w-[25%]">Remarks</th>
                        <th className="pb-3 text-[13px] font-black uppercase text-gray-500 tracking-tighter w-[15%]">Uploaded By</th>
                        <th className="pb-3 text-[13px] font-black uppercase text-gray-500 tracking-tighter w-[15%]">Date</th>
                        <th className="pb-3 w-[5%]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {attachments.map((file) => (
                        <tr key={file.id}>
                          <td className="py-2 px-1">
                            <input className="w-full bg-gray-50/50 rounded-md px-2 py-1.5 text-[15px] font-bold outline-none focus:ring-1 focus:ring-red-500" placeholder="e.g. Invoice_Scan" />
                          </td>
                          <td className="py-2 px-1">
                            <input type="file" className="text-[11px] font-bold text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-black file:text-white cursor-pointer" />
                          </td>
                          <td className="py-2 px-1">
                            <input className="w-full bg-gray-50/50 rounded-md px-2 py-1.5 text-[15px] font-bold outline-none" placeholder="Add note..." />
                          </td>
                          <td className="py-2 px-1 text-[13px] font-bold text-gray-600 italic">
                            {file.uploadedBy}
                          </td>
                          <td className="py-2 px-1 text-[13px] font-bold text-gray-600 tabular-nums">
                            {file.date}
                          </td>
                          <td className="py-2 text-center">
                            <button onClick={() => removeAttachment(file.id)} className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors">
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={addAttachment} className="mt-2 py-1.5 border-2 border-dashed border-gray-100 rounded-lg w-full text-[12px] font-black uppercase tracking-widest text-gray-400 hover:border-red-200 hover:text-red-600 transition-all flex items-center justify-center gap-1">
                  <Plus size={15} /> Add File
                </button>
              </TableSection>

              {/* Moved Remarks to its own full-width or kept in grid as preferred */}
              <TableSection title="Remarks" icon={<FileText size={14} />}>
                <textarea
                  className="w-full min-h-[100px] mt-4 p-4 bg-gray-50 border-none rounded-xl text-[14px] font-bold focus:ring-1 focus:ring-red-500 outline-none"
                  placeholder="Enter justification or internal notes here..."
                />
              </TableSection>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}

// Sub-components
function TableSection({ title, icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-red-50 text-red-600 rounded-lg">{icon}</div>
        <h2 className="text-[15px] font-black uppercase tracking-[1px] text-black">{title}</h2>
      </div>
      {children}
    </div>
  );
}
{/* --- Updated Divider Component --- */ }
function Divider() {
  return <div className="h-[2px] w-full bg-gray-400 border-t border-gray-100/50" />;
}
function SidebarInput({ label, placeholder, type = "text", required, dark }) {
  return (
    <div className="space-y-1">
      <label className={`text-[11px] font-black uppercase tracking-widest ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${dark ? 'bg-gray-900 border-gray-800 text-white focus:ring-red-600' : 'bg-gray-50 border-gray-100 text-black focus:ring-red-500'
          } border focus:ring-1`}
      />
    </div>
  );
}

{/* --- UPDATED SUMMARYROW COMPONENT --- */ }
function SummaryRow({ label, value, color = "text-green-600" }) {
  return (
    <div className="flex justify-between items-center hover:bg-gray-50/50 rounded-md transition-colors group">
      {/* Label remains at 10px */}
      <span className="text-[12px] font-black uppercase tracking-widest text-gray-600">
        {label}
      </span>

      {/* Value increased to 14px */}
      <span className={`${color} text-[14px] font-black tabular-nums tracking-tighter whitespace-nowrap  text-right`}>
        {value}
      </span>
    </div>
  );
}

function AddRowButton({ label }) {
  return (
    <button className="mt-2 py-1.5 border-2 border-dashed border-gray-100 rounded-lg w-full text-[8px] font-black uppercase tracking-widest text-gray-400 hover:border-red-200 hover:text-red-600 transition-all flex items-center justify-center gap-1">
      <Plus size={10} /> {label}
    </button>
  );
}