import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Save, Plus, Trash2,
  FileText, Paperclip, Layers, Landmark, Calculator
} from 'lucide-react';
import ReactDOM from 'react-dom';
import DynamicToast from '../../components/DynamicToast';

// ─────────────────────────────────────────────────────────────────────────────
// Portal Dropdown
// ─────────────────────────────────────────────────────────────────────────────
const MIN_DROPDOWN_WIDTH = 260;

function PortalDropdown({ anchorRef, open, children }) {
  const [style, setStyle] = useState({});

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const update = () => {
      const rect = anchorRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownMaxH = 240;
      const width = Math.max(rect.width, MIN_DROPDOWN_WIDTH);
      let top, maxHeight;
      if (spaceBelow >= Math.min(dropdownMaxH, 160) || spaceBelow >= spaceAbove) {
        top = rect.bottom + window.scrollY + 4;
        maxHeight = Math.min(dropdownMaxH, spaceBelow - 8);
      } else {
        maxHeight = Math.min(dropdownMaxH, spaceAbove - 8);
        top = rect.top + window.scrollY - maxHeight - 4;
      }
      let left = rect.left + window.scrollX;
      if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8 + window.scrollX;
      setStyle({ top, left, width, maxHeight });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchorRef]);

  if (!open) return null;
  return ReactDOM.createPortal(
    <div style={{
      position: 'absolute', top: style.top, left: style.left,
      width: style.width, maxHeight: style.maxHeight,
      zIndex: 99999, overflowY: 'auto', background: '#fff',
      border: '1px solid #e5e7eb', borderRadius: '10px',
      boxShadow: '0 10px 40px -6px rgba(0,0,0,0.18)'
    }}>
      {children}
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable SearchableDropdown
// ─────────────────────────────────────────────────────────────────────────────
function SearchableDropdown({ placeholder, value, onChange, onSelect, options, inputClassName, emptyText = 'No results found', disabled = false }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const closeTimer = useRef(null);
  const filtered = options.filter(o =>
    !value ||
    o.label.toLowerCase().includes(value.toLowerCase()) ||
    (o.sublabel || '').toLowerCase().includes(value.toLowerCase())
  );
  const handleBlur = () => { closeTimer.current = setTimeout(() => setOpen(false), 180); };
  const handleFocus = () => { if (!disabled) { clearTimeout(closeTimer.current); setOpen(true); } };
  const handleSelect = (opt) => { if (!disabled) { clearTimeout(closeTimer.current); onSelect(opt); setOpen(false); } };

  if (disabled) {
    return (
      <div className="relative w-full">
        <input 
          type="text" 
          placeholder={placeholder} 
          value={value} 
          readOnly
          className={`${inputClassName} cursor-not-allowed text-black`} 
          autoComplete="off" 
        />
      </div>
    );
  }

  return (
    <div ref={anchorRef} className="relative w-full">
      <input
        type="text" placeholder={placeholder} value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={handleFocus} onBlur={handleBlur}
        className={inputClassName} autoComplete="off"
      />
      <PortalDropdown anchorRef={anchorRef} open={open}>
        {filtered.length > 0 ? filtered.map((opt, i) => (
          <div
            key={opt.value ?? i}
            onMouseDown={e => { e.preventDefault(); handleSelect(opt); }}
            className="flex items-center justify-between gap-2 px-3 py-2 text-[12px] font-bold hover:bg-red-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0 text-black"
          >
            <span className="truncate flex-1">{opt.label}</span>
            {opt.sublabel && (
              <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide flex-shrink-0">
                {opt.sublabel}
              </span>
            )}
          </div>
        )) : (
          <div className="px-3 py-3 text-[12px] text-gray-400 text-center">{emptyText}</div>
        )}
      </PortalDropdown>
    </div>
  );
}

const fmt = (n = 0) => Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions for summary
// ─────────────────────────────────────────────────────────────────────────────
function SDivider() { return <div className="h-[1px] w-full bg-gray-100" />; }

function SummaryRow({ label, value, color = 'text-gray-800', formula }) {
  return (
    <div className="summary-row relative flex justify-between items-center hover:bg-gray-50 rounded-md transition-colors py-1 px-1 cursor-default">
      <span className="text-[10.5px] font-black uppercase text-gray-500 leading-tight pr-1 flex-1">{label}</span>
      <span className={`${color} text-[12px] font-black tabular-nums tracking-tight whitespace-nowrap text-right flex-shrink-0`}>{value}</span>
      {formula && (
        <div className="summary-tooltip absolute left-0 bottom-full mb-1 z-50 bg-gray-900 text-white text-[10px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-xl pointer-events-none">
          <span className="text-gray-300 font-medium">{formula}</span>
          <div className="absolute left-3 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function AdjustmentsForm({ onBack, onSuccess, isViewMode = false, adjustmentData = null }) {

  const [journalEntries,  setJournalEntries]  = useState([]);

  // ── Remote data ──────────────────────────────────────────────────────────
  const [chartsOfAccounts, setChartsOfAccounts] = useState([]);

  // ── Payment / header fields ───────────────────────────────────────────────
  const [documentReference, setDocumentReference] = useState('');
  const [postingDate,      setPostingDate]      = useState('');
  const [remarks,           setRemarks]           = useState('');

  const [attachments, setAttachments] = useState([
    { id: 1, fileName: '', file: null, remarks: '', uploadedBy: 'Current User', date: new Date().toLocaleDateString() }
  ]);

  const [toast, setToast] = useState(null);
  const [imageModal, setImageModal] = useState({ isOpen: false, imageSrc: '' });


  const coaOptions = chartsOfAccounts.map(a => ({ label: a.name || a.account_name, sublabel: a.code || a.account_code, value: a.id }));

  const fetchChartsOfAccounts = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authorization token found');
      const res    = await fetch(`${import.meta.env.VITE_SERVER_LINK}/charts_of_accounts`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const result = await res.json();
      if (result.success) setChartsOfAccounts(result.data);
    } catch (err) { console.error('COA fetch error:', err.message); }
  };

  useEffect(() => { fetchChartsOfAccounts(); }, []);
  useEffect(() => {
    if (isViewMode && adjustmentData) {
      console.log('Populating form with adjustment data:', adjustmentData);
      
      // Populate basic adjustment info
      if (adjustmentData.data && adjustmentData.data.length > 0) {
        const adjustment = adjustmentData.data[0];
        setDocumentReference(adjustment.document_reference || '');
        setPostingDate(adjustment.posting_date || '');
        setRemarks(adjustment.remarks || '');
      }

      // Populate journal entries
      if (adjustmentData.journal_entries && adjustmentData.journal_entries.length > 0) {
        const journal = adjustmentData.journal_entries.map(entry => ({
          id: entry.id,
          account: entry.account_name,
          accountSearch: entry.account_name, // Use account_name for search
          center: entry.responsibility_center || '',
          debit: entry.type === 'DEBIT' ? parseFloat(entry.amount) || 0 : 0,
          credit: entry.type === 'CREDIT' ? parseFloat(entry.amount) || 0 : 0,
          isManual: false
        }));
        setJournalEntries(journal);
      }

      // Populate attachments
      if (adjustmentData.attachments && adjustmentData.attachments.length > 0) {
        console.log('Processing attachments:', adjustmentData.attachments);
        const attachments = adjustmentData.attachments.map(att => {
          console.log('Processing attachment:', att.id, att.name, 'File data type:', typeof att.file, 'File data length:', att.file ? att.file.length : 'null');
          return {
            id: att.id,
            fileName: att.name || '',
            file: att.file || null,
            remarks: att.remarks || '',
            uploadedBy: att.uploaded_by || 'Current User',
            date: att.uploaded_date || new Date().toLocaleDateString()
          };
        });
        setAttachments(attachments);
      }
    }
  }, [isViewMode, adjustmentData]);

  // ── Journal entry helpers ─────────────────────────────────────────────────
  const addJournalEntry    = () => setJournalEntries(prev => [...prev, { id: Date.now(), account: '', accountSearch: '', center: '', debit: 0, credit: 0, isManual: true }]);
  const removeJournalEntry = (id) => setJournalEntries(prev => prev.filter(e => e.id !== id));
  const updateJournalEntry = (id, field, value) => setJournalEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));

  // ── Attachment helpers ────────────────────────────────────────────────────
  const addAttachment    = () => setAttachments(prev => [...prev, { id: Date.now(), fileName: '', file: null, remarks: '', uploadedBy: 'Current User', date: new Date().toLocaleDateString() }]);
  const removeAttachment = (id) => setAttachments(prev => prev.filter(a => a.id !== id));
  const updateAttachment = (id, field, value) => setAttachments(prev => prev.map(att => att.id === id ? { ...att, [field]: value } : att));
  const handleFileChange = (id, file) => {
    if (file) {
      updateAttachment(id, 'fileName', file.name);
      updateAttachment(id, 'file', file);
    }
  };



  // ── Post Transaction ──────────────────────────────────────────────────────
  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload  = () => resolve(reader.result);
      reader.onerror = err => reject(err);
    });

  const handlePostTransaction = async () => {
    try {
      if (!documentReference) { setToast({ type: 'warning', message: 'Please enter document reference' }); return; }

      const token = localStorage.getItem('token');
      if (!token) { setToast({ type: 'error', message: 'No authorization token found. Please login again.' }); return; }

      const userData  = JSON.parse(localStorage.getItem('user') || '{}');
      const createdBy = userData.mu_username || userData.username || 'Unknown User';

      const preparedJournalEntries = journalEntries.map(entry => ({
        account_id:            entry.account || '',
        responsibility_center: entry.center  || '',
        debit:                 parseFloat(entry.debit)  || 0,
        credit:                parseFloat(entry.credit) || 0,
      }));

      const preparedAttachments = await Promise.all(
        attachments.map(async att => ({
          name:       att.fileName,
          file:       att.file ? await fileToBase64(att.file) : null,
          remarks:    att.remarks,
          uploaded_by: att.uploadedBy,
          uploaded_date: att.date || new Date().toLocaleDateString(),
        }))
      );

      // ── adjustment header payload ──
      const adjustmentPayload = {
        document_reference: documentReference,
        posting_date: new Date().toISOString().split('T')[0],
        remarks: remarks,
        status: 'PREPARED BY',
        total_amount: totalDebit, // Use total debit as the adjustment amount
        created_by: createdBy,
        adjustment_attachments: preparedAttachments,
        journal_entries: preparedJournalEntries,
      };

      const url = isViewMode && adjustmentData 
        ? `${import.meta.env.VITE_SERVER_LINK}/adjustments/${adjustmentData.data[0].a_id}`
        : `${import.meta.env.VITE_SERVER_LINK}/adjustments`;
      
      const method = isViewMode && adjustmentData ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(adjustmentPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        const nextToast = { type: 'success', message: isViewMode ? 'Adjustment updated successfully!' : 'Adjustment posted successfully!' };
        setToast(nextToast);
        if (onSuccess) await onSuccess(nextToast);
        onBack();
      } else {
        setToast({ type: 'error', message: result.message || 'Failed to save adjustment' });
      }

    } catch (error) {
      console.error('Error saving adjustment:', error);
      setToast({ type: 'error', message: 'Error: ' + error.message });
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const inputBase  = "w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all " + 
    (isViewMode ? "bg-gray-100 border border-gray-300 text-black cursor-not-allowed" : "bg-gray-50 border border-gray-200 text-black focus:ring-1 focus:ring-red-500");
  const tableInput = "w-full rounded-md px-1 py-1 text-[13px] font-bold text-center outline-none " + 
    (isViewMode ? "bg-gray-100 border border-gray-300 text-black cursor-not-allowed" : "bg-gray-50/50 focus:ring-1 focus:ring-red-400");
  const fadeInUp   = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

  const totalDebit  = journalEntries.reduce((s, e) => s + (parseFloat(e.debit)  || 0), 0);
  const totalCredit = journalEntries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01;
  const totalEntries = journalEntries.length;
  const manualEntries = journalEntries.filter(e => e.isManual).length;
  const autoEntries = totalEntries - manualEntries;

  return (
    <div className="h-full flex flex-col overflow-x-hidden bg-[#F3F4F6]">
      <style dangerouslySetInnerHTML={{
        __html: `
          .custom-table-scroller::-webkit-scrollbar { height: 6px; width: 6px; }
          .custom-table-scroller::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
          .custom-table-scroller::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 10px; }
          .custom-table-scroller::-webkit-scrollbar-thumb:hover { background: #dc2626; }
          .sidebar-scroll::-webkit-scrollbar { width: 4px; }
          .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
          .sidebar-scroll::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
          .summary-tooltip { display: none; }
          .summary-row:hover .summary-tooltip { display: block; }
        `
      }} />

      {toast && <DynamicToast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      {/* TOP NAV */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <nav className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[2px] text-gray-400 cursor-pointer hover:text-black transition-colors" onClick={onBack}>
          <ArrowLeft size={17} /><span className="text-black">Back to Adjustments</span>
        </nav>
        {!isViewMode && (
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white border border-gray-200 text-[12px] font-black text-gray-400 rounded-lg hover:bg-gray-50 transition-all uppercase">
              Save Draft
            </button>
            <button
              onClick={handlePostTransaction}
              className="px-6 py-2 bg-red-600 text-white text-[12px] font-black rounded-lg hover:bg-red-700 transition-all uppercase tracking-[2px] flex items-center gap-2 shadow-md shadow-red-200"
            >
              <Save size={14} /> Post Adjustment
            </button>
          </div>
        )}
      </div>

      {/* BODY */}
      <div className="flex-1 flex gap-4 min-h-0">

        {/* ── LEFT SIDEBAR ── */}
        <aside className="w-72 flex-shrink-0 flex flex-col gap-3 h-full overflow-y-auto sidebar-scroll pb-2">

          {/* Basic Details */}
          <section className="bg-black rounded-2xl p-4 text-white shadow-xl flex-shrink-0">
            <h3 className="text-[12px] font-black uppercase tracking-[3px] text-red-500 mb-3 flex items-center gap-2">
              <Landmark size={12} /> Basic Details
            </h3>
            <div className="grid grid-cols-1 gap-2.5">
              <div>
                <label className="text-[11px] font-black uppercase text-gray-400 block mb-1">Document Reference <span className="text-red-600">*</span></label>
                <input
                  type="text"
                  value={documentReference}
                  onChange={(e) => setDocumentReference(e.target.value)}
                  disabled={isViewMode}
                  className={inputBase}
                  placeholder="Enter document reference..."
                />
              </div>
              <div>
                <label className="text-[11px] font-black uppercase text-gray-400 block mb-1">Date</label>
                <input
                  type="date"
                  value={postingDate}
                  onChange={(e) => setPostingDate(e.target.value)}
                  disabled={isViewMode}
                  className={inputBase}
                />
              </div>
            </div>
          </section>

          {/* SUMMARY */}
          <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex-1 flex flex-col min-h-0">
            <h3 className="text-[12px] font-black uppercase tracking-[3px] text-gray-900 mb-2 flex items-center gap-2 flex-shrink-0">
              <Calculator size={12} /> Summary
            </h3>
            <div className="overflow-y-auto min-h-0 flex-1 space-y-0">
              <SummaryRow label="Total Entries" value={totalEntries} formula="Count of all journal rows" />
              <SDivider />
              <SummaryRow label="Manual Entries" value={manualEntries} formula="User-added journal rows" color="text-blue-600" />
              <SDivider />
              <SummaryRow label="Auto Entries" value={autoEntries} formula="System-generated rows" color="text-gray-600" />
              <SDivider />
              <SummaryRow label="Total Debit" value={fmt(totalDebit)} formula="Sum of all debit amounts" color="text-green-600" />
              <SDivider />
              <SummaryRow label="Total Credit" value={fmt(totalCredit)} formula="Sum of all credit amounts" color="text-red-600" />
            </div>
            <div className="mt-3 flex-shrink-0">
              <div className="flex flex-col gap-[2px] mb-2">
                <div className="h-[2px] w-full bg-red-600 rounded-full" />
                <div className="h-[1px] w-full bg-black/10" />
              </div>
              <div className={`mb-2 px-2 py-1 rounded-lg border text-center ${
                isBalanced 
                  ? 'bg-green-50 border-green-100' 
                  : 'bg-red-50 border-red-100'
              }`}>
                <p className={`text-[9px] font-black uppercase tracking-wide ${
                  isBalanced ? 'text-green-600' : 'text-red-600'
                }`}>
                  {isBalanced ? 'Balanced Entry' : 'Unbalanced Entry'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[3px] mb-1">Balance Status</p>
                <p className="text-2xl font-black text-black tracking-tighter leading-none flex items-baseline justify-center gap-1">
                  <span className={`text-[13px] ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                    {isBalanced ? 'Balanced' : 'Unbalanced'}
                  </span>
                  {!isBalanced && (
                    <span className="text-[16px] text-red-600">
                      {fmt(Math.abs(totalDebit - totalCredit))}
                    </span>
                  )}
                </p>
                {!isBalanced && (
                  <p className="text-[9px] font-black text-red-500 uppercase tracking-wide mt-1">
                    Difference: {fmt(Math.abs(totalDebit - totalCredit))}
                  </p>
                )}
              </div>
            </div>
          </section>

        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 overflow-y-auto custom-table-scroller space-y-4 pr-1 min-h-0">
          <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="space-y-4">

            {/* 1. JOURNAL ENTRIES */}
            <TableSection title="Journal Entries" icon={<Layers size={14} />}>
              <div className="w-full flex flex-col gap-[2px] mb-4">
                <div className="h-[2px] w-full bg-red-600 rounded-full" />
                <div className="h-[1px] w-full bg-black/10" />
              </div>

              {/* <div className="mb-3 grid grid-cols-2 gap-2">
                {[
                  { label: 'CR  Accounts Receivable', sub: 'Gross + VAT — closes the AR',      color: 'bg-red-50 border-red-100 text-red-600'       },
                  { label: 'DR  Sales Discounts',      sub: 'Discount given on collection',     color: 'bg-orange-50 border-orange-100 text-orange-600' },
                  { label: 'DR  Creditable WHT',       sub: 'Tax withheld by customer (asset)', color: 'bg-blue-50 border-blue-100 text-blue-600'      },
                  { label: 'DR  Cash / Bank',          sub: 'Actual cash received',             color: 'bg-green-50 border-green-100 text-green-600'   },
                ].map((leg, i) => (
                  <div key={i} className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase ${leg.color}`}>
                    {leg.label}<br />
                    <span className="opacity-70 normal-case font-semibold">{leg.sub}</span>
                  </div>
                ))}
              </div> */}

              <div className="overflow-x-auto custom-table-scroller">
                <table className="w-full text-center" style={{ tableLayout: 'fixed', minWidth: 600 }}>
                  <colgroup>
                    <col style={{ width: '40%' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '6%'  }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Charts of Account', 'Responsibility Center', 'Debit', 'Credit', ''].map((h, i) => (
                        <th key={i} className="pb-3 text-[12px] font-black uppercase text-gray-900 text-center px-1">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {journalEntries.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-[12px] text-gray-400 text-center">
                          Journal entries auto-generate once items are added and mode of payment is selected.
                        </td>
                      </tr>
                    ) : journalEntries.map(entry => (
                      <tr key={entry.id}>
                        <td className="py-1.5 px-1">
                          <SearchableDropdown 
                            disabled={isViewMode}
                            placeholder="Search account..." 
                            value={entry.accountSearch} 
                            onChange={v => updateJournalEntry(entry.id, 'accountSearch', v)} 
                            onSelect={opt => { updateJournalEntry(entry.id, 'account', opt.value); updateJournalEntry(entry.id, 'accountSearch', opt.label); }} 
                            options={coaOptions} 
                            inputClassName={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`} 
                            emptyText="No accounts found" 
                          />
                        </td>
                        <td className="py-1.5 px-1">
                          <input 
                            disabled={isViewMode}
                            className={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`} 
                            placeholder="Center..." 
                            value={entry.center} 
                            onChange={e => updateJournalEntry(entry.id, 'center', e.target.value)} 
                          />
                        </td>
                        <td className="py-1.5 px-1">
                          <input 
                            disabled={isViewMode || !entry.isManual} 
                            className={`${tableInput + ' font-black'} ${isViewMode || !entry.isManual ? 'bg-transparent text-black cursor-not-allowed' : ''}`} 
                            placeholder="0.00" 
                            type="number"
                            value={entry.debit} 
                            onChange={e => updateJournalEntry(entry.id, 'debit', parseFloat(e.target.value) || 0)} 
                            readOnly={!entry.isManual} 
                          />
                        </td>
                        <td className="py-1.5 px-1">
                          <input 
                            disabled={isViewMode || !entry.isManual} 
                            className={`${tableInput + ' font-black text-red-600'} ${isViewMode || !entry.isManual ? 'bg-transparent text-black cursor-not-allowed' : ''}`} 
                            placeholder="0.00" 
                            type="number"
                            value={entry.credit} 
                            onChange={e => updateJournalEntry(entry.id, 'credit', parseFloat(e.target.value) || 0)} 
                            readOnly={!entry.isManual} 
                          />
                        </td>
                        <td className="py-1.5 text-center">
                          {!isViewMode && entry.isManual ? (
                            <button className="p-1 text-red-600 hover:bg-red-50 rounded" onClick={() => removeJournalEntry(entry.id)}>
                              <Trash2 size={14} className="mx-auto" />
                            </button>
                          ) : (
                            <span className="text-gray-300 text-[10px] italic">{isViewMode ? '' : 'Auto'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50/50">
                      <td colSpan={2} className="py-2 px-3 text-[12px] font-black uppercase text-black text-left">Balance Check</td>
                      <td className="py-2 px-1 text-center text-[13px] font-black">{fmt(totalDebit)}</td>
                      <td className={`py-2 px-1 text-center text-[13px] font-black ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                        {fmt(totalCredit)} <span className="text-[11px]">{isBalanced ? '✅' : '❌'}</span>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {!isViewMode && (
                <button
                  onClick={addJournalEntry}
                  className="mt-2 py-1.5 border-2 border-dashed border-gray-100 rounded-lg w-full text-[12px] font-black uppercase text-gray-400 hover:border-red-200 hover:text-red-600 transition-all flex items-center justify-center gap-1"
                >
                  <Plus size={15} /> Add Ledger Row
                </button>
              )}
            </TableSection>

            {/* 2. ATTACHMENTS & REMARKS */}
            <div className="grid grid-cols-1 gap-4">
              <TableSection title="Attachments" icon={<Paperclip size={14} />}>
                <div className="w-full flex flex-col gap-[2px] mb-4">
                  <div className="h-[2px] w-full bg-red-600 rounded-full" />
                  <div className="h-[1px] w-full bg-black/10" />
                </div>
                <div className="overflow-x-auto custom-table-scroller">
                  <table className="w-full text-center" style={{ tableLayout: 'fixed', minWidth: 800 }}>
                    <colgroup>
                      <col style={{ width: '20%' }} /><col style={{ width: '20%' }} />
                      <col style={{ width: '25%' }} /><col style={{ width: '15%' }} />
                      <col style={{ width: '15%' }} /><col style={{ width: '5%'  }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['File Name', 'File', 'Remarks', 'Uploaded By', 'Date', ''].map((h, i) => (
                          <th key={i} className="pb-3 text-[12px] font-black uppercase text-gray-900 tracking-tighter text-center px-1">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {attachments.map(file => (
                        <tr key={file.id}>
                          <td className="py-2 px-1">
                            <input 
                              disabled={isViewMode}
                              className={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`} 
                              placeholder="e.g. OR_Scan" 
                              value={file.fileName}
                              onChange={(e) => updateAttachment(file.id, 'fileName', e.target.value)}
                            />
                          </td>
                          <td className="py-2 px-1">
                            {isViewMode ? (
                              <div className={`${tableInput} text-black cursor-not-allowed flex items-center justify-center`}>
                                {file.file && typeof file.file === 'string' && file.file.startsWith('data:image/') ? (
                                  <img 
                                    src={file.file} 
                                    alt={file.fileName || 'Attachment'} 
                                    className="max-h-16 max-w-full object-contain cursor-pointer hover:scale-105 transition-transform"
                                    onClick={() => setImageModal({ isOpen: true, imageSrc: file.file })}
                                    title="Click to view full size"
                                    onLoad={() => console.log('Image loaded successfully:', file.fileName)}
                                    onError={(e) => {
                                      console.error('Image failed to load:', file.fileName, e);
                                      e.target.style.display = 'none';
                                      const fallback = document.createElement('span');
                                      fallback.className = 'text-red-600 text-[10px] font-bold';
                                      fallback.textContent = 'Image error';
                                      e.target.parentNode.appendChild(fallback);
                                    }}
                                  />
                                ) : file.file && typeof file.file === 'string' ? (
                                  <span className="text-blue-600 text-[11px] font-bold" title={file.file.substring(0, 50) + '...'}>Non-image file</span>
                                ) : file.file ? (
                                  <span className="text-orange-600 text-[11px] font-bold">Invalid file data</span>
                                ) : (
                                  <span className="text-gray-400 text-[11px] italic">No file</span>
                                )}
                              </div>
                            ) : (
                              <input 
                                type="file" 
                                className="text-[11px] font-bold text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-black file:text-white cursor-pointer w-full" 
                                onChange={(e) => handleFileChange(file.id, e.target.files[0])}
                              />
                            )}
                          </td>
                          <td className="py-2 px-1">
                            <input 
                              disabled={isViewMode}
                              className={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`} 
                              placeholder="Add note..." 
                              value={file.remarks}
                              onChange={(e) => updateAttachment(file.id, 'remarks', e.target.value)}
                            />
                          </td>
                          <td className="py-2 px-1 text-[12px] font-bold text-gray-600 italic">{file.uploadedBy}</td>
                          <td className="py-2 px-1 text-[12px] font-bold text-gray-600 tabular-nums">{file.date}</td>
                          <td className="py-2 text-center">
                            {!isViewMode && (
                              <button onClick={() => removeAttachment(file.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!isViewMode && (
                  <button onClick={addAttachment} className="mt-2 py-1.5 border-2 border-dashed border-gray-100 rounded-lg w-full text-[12px] font-black uppercase text-gray-400 hover:border-red-200 hover:text-red-600 transition-all flex items-center justify-center gap-1">
                    <Plus size={15} /> Add File
                  </button>
                )}
              </TableSection>

              <TableSection title="Remarks" icon={<FileText size={14} />}>
                <textarea 
                  disabled={isViewMode}
                  className={`w-full min-h-[100px] mt-4 p-4 rounded-xl text-[14px] font-bold outline-none ${
                    isViewMode 
                      ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed resize-none' 
                      : 'bg-gray-50 border-none focus:ring-1 focus:ring-red-500'
                  }`} 
                  placeholder="Enter collection notes or justification here..." 
                  value={remarks} 
                  onChange={e => setRemarks(e.target.value)} 
                />
              </TableSection>
            </div>

          </motion.div>
        </main>
      </div>


      {/* --- IMAGE MODAL --- */}
      {imageModal.isOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setImageModal({ isOpen: false, imageSrc: '' })}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setImageModal({ isOpen: false, imageSrc: '' });
            }}
            className="absolute top-6 right-6 text-white hover:text-red-500 transition-colors"
          >
            <ArrowLeft size={32} />
          </button>
          <img
            src={imageModal.imageSrc}
            alt="Preview"
            className="max-w-full max-h-full rounded-2xl shadow-2xl border-4 border-white/10 p-2 scale-in animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function TableSection({ title, icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-red-50 text-red-600 rounded-lg">{icon}</div>
        <h2 className="text-[15px] font-black uppercase tracking-[1px] text-black">{title}</h2>
      </div>
      {children}
    </div>
  );
}


function SidebarInput({ label, placeholder, type = 'text', required, value, onChange, disabled = false }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-black uppercase text-gray-400 block">
        {label}{required && <span className="text-red-600 ml-1">*</span>}
      </label>
      <input
        type={type} placeholder={placeholder} value={value} onChange={onChange} disabled={disabled}
        className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${
          disabled 
            ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed' 
            : 'bg-gray-50 border border-gray-200 text-black focus:ring-1 focus:ring-red-500'
        }`}
      />
    </div>
  );
}