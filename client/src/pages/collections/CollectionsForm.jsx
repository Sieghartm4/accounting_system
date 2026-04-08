import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Save, Plus, Trash2,
  FileText, Paperclip, Calculator, Layers, Landmark, Receipt
} from 'lucide-react';
import ReactDOM from 'react-dom';
import DynamicToast from '../../components/DynamicToast';
import RightSideModal from '../../components/RightSideModal';

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
function SearchableDropdown({ placeholder, value, onChange, onSelect, options, inputClassName, emptyText = 'No results found' }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const closeTimer = useRef(null);
  const filtered = options.filter(o =>
    !value ||
    o.label.toLowerCase().includes(value.toLowerCase()) ||
    (o.sublabel || '').toLowerCase().includes(value.toLowerCase())
  );
  const handleBlur = () => { closeTimer.current = setTimeout(() => setOpen(false), 180); };
  const handleFocus = () => { clearTimeout(closeTimer.current); setOpen(true); };
  const handleSelect = (opt) => { clearTimeout(closeTimer.current); onSelect(opt); setOpen(false); };

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

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — amount computation per line item
//
//  Collection items store only 3 things in the DB (collection_items table):
//    ci_sales_id       → which sales invoice line  (salesItemId)
//    ci_amount         → discounted + VAT − WHT     (amount)
//    ci_witholding_tax → WHT amount                 (whtAmount)
//
//  All other fields (gross, discAmt, vatAmt) are DERIVED for display only.
// ─────────────────────────────────────────────────────────────────────────────
function computeItemAmounts(qty, price, discPct, vatPct, whtPct) {
  const gross      = qty * price;
  const discAmt    = gross * (discPct / 100);
  const discounted = gross - discAmt;
  const vatAmt     = discounted * (vatPct / 100);
  const whtAmt     = discounted * (whtPct / 100);
  const amount     = discounted + vatAmt - whtAmt;  // → ci_amount
  return {
    gross:     parseFloat(gross.toFixed(2)),
    discAmt:   parseFloat(discAmt.toFixed(2)),
    vatAmt:    parseFloat(vatAmt.toFixed(2)),
    whtAmount: parseFloat(whtAmt.toFixed(2)),        // → ci_witholding_tax
    amount:    parseFloat(amount.toFixed(2)),         // → ci_amount
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY — derived entirely from pre-computed item fields
// ─────────────────────────────────────────────────────────────────────────────
function computeSummary(items) {
  return items.reduce(
    (acc, item) => ({
      totalGross:         acc.totalGross         + (item.gross      || 0),
      totalDiscount:      acc.totalDiscount      + (item.discAmt    || 0),
      totalVAT:           acc.totalVAT           + (item.vatAmt     || 0),
      totalWHT:           acc.totalWHT           + (item.whtAmount  || 0),
      totalCashCollected: acc.totalCashCollected + (item.amount     || 0),
    }),
    { totalGross: 0, totalDiscount: 0, totalVAT: 0, totalWHT: 0, totalCashCollected: 0 }
  );
}

const fmt = (n = 0) => Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function CollectionsForm({ onBack, onSuccess }) {

  // ── Collection items ──────────────────────────────────────────────────────
  // Each item shape (what lives in state):
  // {
  //   id                 : React key (frontend only)
  //   salesItemId        : si_id from sales_items  → ci_sales_id (STORED)
  //   invoiceRef         : document_reference       (display only)
  //   description        : product name             (display only)
  //   responsibilityCenter                           (display only)
  //   gross              : qty × price              (display only)
  //   discAmt            : gross × disc%            (display only)
  //   vatAmt             : discounted × vat%        (display only)
  //   whtAmount          : discounted × wht%        → ci_witholding_tax (STORED)
  //   amount             : discounted + vat − wht   → ci_amount (STORED)
  //   isOther            : false for invoice items
  // }
  const [collectionItems, setCollectionItems] = useState([]);
  const [journalEntries,  setJournalEntries]  = useState([]);

  // ── Remote data ──────────────────────────────────────────────────────────
  const [customers,        setCustomers]        = useState([]);
  const [customerLoading,  setCustomerLoading]  = useState(false);
  const [customerError,    setCustomerError]    = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerSearch,   setCustomerSearch]   = useState('');

  const [chartsOfAccounts, setChartsOfAccounts] = useState([]);

  // ── Payment / header fields ───────────────────────────────────────────────
  const [modeOfPayment,     setModeOfPayment]     = useState('');
  const [modeSearch,        setModeSearch]        = useState('');
  const [bankName,          setBankName]          = useState('');
  const [checkNumber,       setCheckNumber]       = useState('');
  const [documentReference, setDocumentReference] = useState('');
  const [remarks,           setRemarks]           = useState('');

  const [attachments, setAttachments] = useState([
    { id: 1, fileName: '', file: null, remarks: '', uploadedBy: 'Current User', date: new Date().toLocaleDateString() }
  ]);

  const [toast, setToast] = useState(null);

  // ── Sales invoice modal ───────────────────────────────────────────────────
  const [isModalOpen,      setIsModalOpen]      = useState(false);
  const [salesData,        setSalesData]        = useState([]);
  const [salesDataLoading, setSalesDataLoading] = useState(false);
  const [salesDataError,   setSalesDataError]   = useState('');
  const [selectedSales,    setSelectedSales]    = useState([]);

  const modeOfPaymentOptions = ['CASH', 'CHECK', 'BANK_TRANSFER', 'CARD', 'E-WALLET', 'OTHERS'];

  const coaOptions      = chartsOfAccounts.map(a => ({ label: a.name || a.account_name, sublabel: a.code || a.account_code, value: a.id }));
  const customerOptions = customers.map(c => ({ label: c.name || c.customer_name, sublabel: c.code, value: c.id }));

  // ── Fetchers ──────────────────────────────────────────────────────────────
  const fetchCustomers = async () => {
    try {
      setCustomerLoading(true);
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authorization token found');
      const res    = await fetch(`${import.meta.env.VITE_SERVER_LINK}/customer`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const result = await res.json();
      if (result.success) setCustomers(result.data);
      else setCustomerError(result.message || 'Failed to fetch customers');
    } catch (err) { setCustomerError(err.message); }
    finally { setCustomerLoading(false); }
  };

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

  const fetchSalesData = async () => {
    try {
      setSalesDataLoading(true);
      setSalesDataError('');
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authorization token found');
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/collections/sales-collection/`,
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const result = await res.json();
      if (result.success) setSalesData(result.data || []);
      else setSalesDataError(result.message || 'Failed to fetch sales data');
    } catch (err) { setSalesDataError(err.message); }
    finally { setSalesDataLoading(false); }
  };

  useEffect(() => { fetchCustomers(); fetchChartsOfAccounts(); }, []);
  useEffect(() => {
    if (isModalOpen) { fetchSalesData(); setSelectedSales([]); }
  }, [isModalOpen]);

  // ── Item helpers ──────────────────────────────────────────────────────────
  const removeCollectionItem = (id) => setCollectionItems(prev => prev.filter(i => i.id !== id));
  const toggleSalesSelection = (saleId) =>
    setSelectedSales(prev => prev.includes(saleId) ? prev.filter(id => id !== saleId) : [...prev, saleId]);

  // ── Add selected invoices → fetch their line items → map to collection items ──
  const handleAddSelectedSales = async () => {
    try {
      if (selectedSales.length === 0) {
        setToast({ type: 'warning', message: 'Please select at least one sales invoice' });
        return;
      }
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authorization token found');

      const queryParams = new URLSearchParams();
      selectedSales.forEach(id => queryParams.append('sales_id', id));

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/collections/sales-items-collection?${queryParams.toString()}`,
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Failed to fetch sales items');

      // ── Map sales_items → collection items ──────────────────────────────
      //  We compute amounts here so the accountant sees the full breakdown.
      //  vat IS included — it is part of ci_amount (Discounted + VAT − WHT).
      const newItems = result.data.map(s => {
        const qty     = parseFloat(s.quantity)       || 0;
        const price   = parseFloat(s.purchase_price) || 0;
        const discPct = parseFloat(s.discount)       || 0;
        const vatPct  = parseFloat(s.vat)            || 0; // ← MUST include VAT
        const whtPct  = parseFloat(s.witholding_tax) || 0;

        const computed = computeItemAmounts(qty, price, discPct, vatPct, whtPct);

        return {
          id:                  Date.now() + Math.random(),
          salesItemId:         s.id,                        // → ci_sales_id
          invoiceRef:          s.document_reference || '',  // display only
          description:         s.product_service_name || s.description || '', // display only
          responsibilityCenter: s.responsibility_center || '', // display only
          gross:      computed.gross,     // display only
          discAmt:    computed.discAmt,   // display only
          vatAmt:     computed.vatAmt,    // display only
          whtAmount:  computed.whtAmount, // → ci_witholding_tax
          amount:     computed.amount,    // → ci_amount
          isOther:    false,
        };
      });

      // Clear existing collection items
      setCollectionItems([]);
      // Add new items to collection
      setCollectionItems([...newItems]);
      setIsModalOpen(false);
      setSelectedSales([]);
      setToast({ type: 'success', message: `${newItems.length} item(s) added from sales invoice` });

    } catch (error) {
      console.error('Error adding selected sales:', error);
      setToast({ type: 'error', message: 'Error: ' + error.message });
    }
  };

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

  const summary = computeSummary(collectionItems);

  // ── Auto-generate journal entries ─────────────────────────────────────────
  //
  //  Per item:
  //    CR  Accounts Receivable   gross      ← closes the full AR (asset decreases)
  //    DR  Sales Discounts       discAmt    ← discount expense
  //    DR  Creditable WHT        whtAmount  ← asset: BIR owes us later
  //
  //  One combined:
  //    DR  Cash / Bank           totalCash  ← actual money received
  //
  //  Balance proof per item:
  //    DR side = discAmt + whtAmount + (amount)
  //            = discAmt + whtAmt + (discounted + vatAmt − whtAmt)
  //            = discAmt + discounted + vatAmt
  //            = discAmt + (gross − discAmt) + vatAmt
  //            = gross + vatAmt   ← note: AR was originally booked at gross + vatAmt in the Sales JE
  //    CR side = gross + vatAmt  ✅
  // ─────────────────────────────────────────────────────────────────────────
  const generateJournalEntries = () => {
    if (collectionItems.length === 0) { setJournalEntries([]); return; }

    const entries = [];

    // Resolve cash/payment account
    let paymentAccount = null;
    if (modeOfPayment === 'CASH') {
      paymentAccount =
        chartsOfAccounts.find(a => (a.name || '').toLowerCase().includes('cash on hand')) ??
        chartsOfAccounts.find(a => (a.name || '').toLowerCase().includes('petty cash'));
    } else if (modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') {
      if (bankName) {
        paymentAccount = chartsOfAccounts.find(a => (a.name || '').toLowerCase().includes(bankName.toLowerCase()));
      }
      paymentAccount ??= chartsOfAccounts.find(a => (a.name || '').toLowerCase().includes('cash in bank'));
    }

    const arAccount = chartsOfAccounts.find(a => (a.name || '').toLowerCase().includes('accounts receivable'));

    let totalCash = 0;

    collectionItems.filter(i => !i.isOther).forEach(item => {
      totalCash += item.amount || 0;

      // CR  Accounts Receivable — amount collected
      if (arAccount && item.amount > 0) {
        entries.push({
          id:            Date.now() + Math.random(),
          account:       arAccount.id,
          accountSearch: arAccount.name,
          center:        item.responsibilityCenter || '',
          debit:         0,
          credit:        parseFloat(item.amount.toFixed(2)),
          isManual:      false,
        });
      }
    });

    // DR  Cash / Bank — one combined entry
    if (paymentAccount && totalCash > 0) {
      entries.push({
        id:            Date.now() + Math.random(),
        account:       paymentAccount.id,
        accountSearch: paymentAccount.name,
        center:        '',
        debit:         parseFloat(totalCash.toFixed(2)),
        credit:        0,
        isManual:      false,
      });
    }

    setJournalEntries(entries);
  };

  useEffect(() => { generateJournalEntries(); }, [collectionItems, modeOfPayment, bankName, chartsOfAccounts]);

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
      if (!selectedCustomer) { setToast({ type: 'warning', message: 'Please select a customer' }); return; }
      if (!modeOfPayment)    { setToast({ type: 'warning', message: 'Please select mode of payment' }); return; }
      if ((modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') && !bankName) {
        setToast({ type: 'warning', message: 'Please enter bank name' }); return;
      }
      if (collectionItems.filter(i => !i.isOther).length === 0) {
        setToast({ type: 'warning', message: 'Please add at least one collection item from a sales invoice' }); return;
      }

      const token = localStorage.getItem('token');
      if (!token) { setToast({ type: 'error', message: 'No authorization token found. Please login again.' }); return; }

      const userData  = JSON.parse(localStorage.getItem('user') || '{}');
      const createdBy = userData.mu_username || userData.username || 'Unknown User';

      // ── collection_items payload — ONLY what the DB schema stores ──
      //   ci_sales_id       → salesItemId
      //   ci_amount         → amount       (discounted + VAT − WHT)
      //   ci_witholding_tax → whtAmount
      const preparedItems = collectionItems
        .filter(item => !item.isOther)
        .map(item => ({
          sales_id:       item.salesItemId,
          amount:         item.amount,
          witholding_tax: item.whtAmount,
        }));

      const preparedJournalEntries = journalEntries.map(entry => ({
        account_id:            entry.account || '',
        responsibility_center: entry.center  || '',
        debit:                 parseFloat(entry.debit)  || 0,
        credit:                parseFloat(entry.credit) || 0,
      }));

      const preparedAttachments = await Promise.all(
        attachments.map(async att => ({
          fileName:   att.fileName,
          file:       att.file ? await fileToBase64(att.file) : null,
          remarks:    att.remarks,
          uploadedBy: att.uploadedBy,
          date:       att.date,
        }))
      );

      // ── collections header payload — matches DB columns exactly ──
      // c_customer_id, c_document_reference, c_mode_of_payment,
      // c_bank_name, c_check_number, c_collection_date, c_remarks, c_created_by
      const collectionData = {
        customer_id:        selectedCustomer,
        document_reference: documentReference,
        mode_of_payment:    modeOfPayment,
        bank_name:          bankName    || '',
        check_number:       checkNumber || '',
        collection_date:    new Date().toISOString().split('T')[0],
        remarks,
        total_amount_due:   summary.totalCashCollected,
        created_by:         createdBy,
        collection_items:   preparedItems,
        journal_entries:    preparedJournalEntries,
        attachments:        preparedAttachments,
      };

      const response = await fetch(`${import.meta.env.VITE_SERVER_LINK}/collections`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(collectionData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        const nextToast = { type: 'success', message: 'Collection posted successfully!' };
        setToast(nextToast);
        if (onSuccess) await onSuccess(nextToast);
        onBack();
      } else {
        setToast({ type: 'error', message: result.message || 'Failed to post collection' });
      }

    } catch (error) {
      console.error('Error posting collection:', error);
      setToast({ type: 'error', message: 'Error: ' + error.message });
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const inputBase  = 'w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all bg-gray-50 border border-gray-200 text-black focus:ring-1 focus:ring-red-500';
  const tableInput = 'w-full bg-gray-50/50 rounded-md px-1 py-1 text-[13px] font-bold text-center outline-none focus:ring-1 focus:ring-red-400';
  const fadeInUp   = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

  const totalDebit  = journalEntries.reduce((s, e) => s + (parseFloat(e.debit)  || 0), 0);
  const totalCredit = journalEntries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01;

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
          <ArrowLeft size={17} /><span className="text-black">Back to Collections</span>
        </nav>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-gray-200 text-[12px] font-black text-gray-400 rounded-lg hover:bg-gray-50 transition-all uppercase">
            Save Draft
          </button>
          <button
            onClick={handlePostTransaction}
            className="px-6 py-2 bg-red-600 text-white text-[12px] font-black rounded-lg hover:bg-red-700 transition-all uppercase tracking-[2px] flex items-center gap-2 shadow-md shadow-red-200"
          >
            <Save size={14} /> Post Collection
          </button>
        </div>
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
                <label className="text-[11px] font-black uppercase text-gray-400 block mb-1">Customer <span className="text-red-600">*</span></label>
                {customerLoading
                  ? <div className={inputBase + ' text-gray-400 py-1.5'}>Loading customers…</div>
                  : <SearchableDropdown
                      placeholder="Search customer..."
                      value={customerSearch}
                      onChange={v => { setCustomerSearch(v); setSelectedCustomer(''); }}
                      onSelect={opt => { setSelectedCustomer(opt.value); setCustomerSearch(opt.label); }}
                      options={customerOptions}
                      inputClassName={inputBase}
                      emptyText={customerError || 'No customers found'}
                    />
                }
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SidebarInput label="OR / Reference" placeholder="OR-000" value={documentReference} onChange={e => setDocumentReference(e.target.value)} />
                <SidebarInput label="Date" type="date" />
              </div>
              <div>
                <label className="text-[11px] font-black uppercase text-gray-400 block mb-1">Mode of Payment</label>
                <SearchableDropdown
                  placeholder="Select mode..."
                  value={modeSearch}
                  onChange={v => { setModeSearch(v); setModeOfPayment(''); }}
                  onSelect={opt => { setModeOfPayment(opt.value); setModeSearch(opt.label); }}
                  options={modeOfPaymentOptions.map(m => ({ label: m, value: m }))}
                  inputClassName={inputBase}
                  emptyText="No modes found"
                />
              </div>
              {(modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') && (
                <div className="grid grid-cols-2 gap-2">
                  <SidebarInput label="Bank Name" placeholder="Enter bank name" value={bankName} onChange={e => setBankName(e.target.value)} />
                  <SidebarInput label="Check #" placeholder="Check number" value={checkNumber} onChange={e => setCheckNumber(e.target.value)} />
                </div>
              )}
            </div>
          </section>

          {/* SUMMARY */}
          <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex-1 flex flex-col min-h-0">
            <h3 className="text-[12px] font-black uppercase tracking-[3px] text-gray-900 mb-2 flex items-center gap-2 flex-shrink-0">
              <Calculator size={12} /> Summary
            </h3>
            <div className="overflow-y-auto min-h-0 flex-1 space-y-0">
              <SummaryRow label="Total Invoice Amount" value={fmt(summary.totalGross)}         formula="Σ (Qty × Price)" />
              <SDivider />
              <SummaryRow label="Total Discount"       value={fmt(summary.totalDiscount)}      formula="Σ (Gross × Disc%)"        color="text-orange-500" />
              <SDivider />
              <SummaryRow label="Total VAT"            value={fmt(summary.totalVAT)}           formula="Σ (Discounted × VAT%)"    color="text-red-600" />
              <SDivider />
              <SummaryRow label="Total WHT"            value={fmt(summary.totalWHT)}           formula="Σ (Discounted × WHT%)"    color="text-blue-600" />
              <SDivider />
              <SummaryRow label="Total Amount Due" value={fmt(summary.totalCashCollected)} formula="Discounted + VAT - WHT"   color="text-green-600" />
            </div>
            <div className="mt-3 flex-shrink-0">
              <div className="flex flex-col gap-[2px] mb-2">
                <div className="h-[2px] w-full bg-red-600 rounded-full" />
                <div className="h-[1px] w-full bg-black/10" />
              </div>
              <div className="mb-2 px-2 py-1 bg-red-50 rounded-lg border border-red-100 text-center">
                <p className="text-[9px] font-black uppercase tracking-wide text-red-400">Discounted + VAT − WHT</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[3px] mb-1">Total Amount Due</p>
                <p className="text-2xl font-black text-black tracking-tighter leading-none flex items-baseline justify-center gap-1">
                  <span className="text-[13px] text-red-600">PHP</span>
                  {fmt(summary.totalCashCollected)}
                </p>
              </div>
            </div>
          </section>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 overflow-y-auto custom-table-scroller space-y-4 pr-1 min-h-0">
          <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="space-y-4">

            {/* 1. COLLECTION ITEMS */}
            <TableSection title="Collection Items" icon={<Receipt size={14} />}>
              <div className="w-full flex flex-col gap-[2px] mb-3">
                <div className="h-[2px] w-full bg-red-600 rounded-full" />
                <div className="h-[1px] w-full bg-black/10" />
              </div>

              {/* <div className="mb-3 px-3 py-2 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-blue-600 text-[11px] font-black uppercase tracking-wide">
                  ℹ️ Collected against Sales Invoice — amounts are auto-computed from original invoice items (Discounted + VAT − WHT). Only Sales ID, Amount, and WHT are stored.
                </span>
              </div> */}

              {collectionItems.length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-[13px] font-bold border-2 border-dashed border-gray-100 rounded-xl">
                  No items yet. Click "Add Sales Items" to select outstanding invoices.
                </div>
              ) : (
                <div className="overflow-x-auto custom-table-scroller">
                  {/*
                    READ-ONLY display table.
                    All columns are for accountant review.
                    Only whtAmount (→ ci_witholding_tax) and amount (→ ci_amount) go to the DB.
                  */}
                  <table className="w-full text-center min-w-[860px]" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '16%' }} /> {/* Invoice Ref */}
                      <col style={{ width: '20%' }} /> {/* Product/Service */}
                      <col style={{ width: '12%' }} /> {/* Gross Amt */}
                      <col style={{ width: '10%' }} /> {/* Discount */}
                      <col style={{ width: '10%' }} /> {/* VAT */}
                      <col style={{ width: '12%' }} /> {/* WHT → ci_witholding_tax */}
                      <col style={{ width: '14%' }} /> {/* Amount Due → ci_amount */}
                      <col style={{ width: '10%' }} /> {/* Responsibility Center */}
                      <col style={{ width: '6%'  }} /> {/* Delete */}
                    </colgroup>
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Invoice Ref', 'Product/Service', 'Gross Amt', 'Discount', 'VAT', 'WHT', 'Amount Due', 'Responsibility Center', ''].map((h, i) => (
                          <th key={i} className="pb-2 text-[11px] font-black uppercase text-gray-900 text-center px-1">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {collectionItems.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-2 px-2 text-center">
                            <span className="font-mono text-[11px] bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                              {item.invoiceRef || '—'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-[12px] font-bold text-center text-gray-700 truncate" title={item.product_service_name || item.description}>
                            {item.product_service_name || item.description || '—'}
                          </td>
                          <td className="py-2 px-2 text-[12px] font-bold text-center text-gray-800 tabular-nums">
                            {fmt(item.gross || 0)}
                          </td>
                          <td className="py-2 px-2 text-[12px] font-bold text-center text-orange-500 tabular-nums">
                            ({fmt(item.discAmt || 0)})
                          </td>
                          <td className="py-2 px-2 text-[12px] font-bold text-center text-red-500 tabular-nums">
                            +{fmt(item.vatAmt || 0)}
                          </td>
                          <td className="py-2 px-2 text-[12px] font-bold text-center text-blue-600 tabular-nums">
                            ({fmt(item.whtAmount || 0)})
                          </td>
                          <td className="py-2 px-2 text-[13px] font-black text-center text-green-700 tabular-nums">
                            {fmt(item.amount || 0)}
                          </td>
                          <td className="py-2 px-2 text-[12px] font-bold text-center text-gray-700 tabular-nums">
                            {item.responsibilityCenter || '---'}
                          </td>
                          <td className="py-2 px-1 text-center">
                            <button onClick={() => removeCollectionItem(item.id)} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50/80">
                        <td colSpan={2} className="py-2 px-2 text-[13px] font-black uppercase text-gray-900 text-left">Totals</td>
                        <td className="py-2 px-2 text-[12px] font-black text-center tabular-nums">{fmt(summary.totalGross)}</td>
                        <td className="py-2 px-2 text-[12px] font-black text-orange-500 text-center tabular-nums">({fmt(summary.totalDiscount)})</td>
                        <td className="py-2 px-2 text-[12px] font-black text-red-500 text-center tabular-nums">+{fmt(summary.totalVAT)}</td>
                        <td className="py-2 px-2 text-[12px] font-black text-blue-600 text-center tabular-nums">({fmt(summary.totalWHT)})</td>
                        <td className="py-2 px-2 text-[13px] font-black text-green-700 text-center tabular-nums">{fmt(summary.totalCashCollected)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              <div className="mt-3">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full py-2 border-2 border-dashed border-gray-100 rounded-xl text-[11px] font-black uppercase text-gray-400 hover:border-red-200 hover:text-red-600 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={14} /> Add Sales Items
                </button>
              </div>
            </TableSection>

            {/* 2. JOURNAL ENTRIES */}
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
                            placeholder="Search account..."
                            value={entry.accountSearch}
                            onChange={v => updateJournalEntry(entry.id, 'accountSearch', v)}
                            onSelect={opt => { updateJournalEntry(entry.id, 'account', opt.value); updateJournalEntry(entry.id, 'accountSearch', opt.label); }}
                            options={coaOptions}
                            inputClassName={tableInput}
                            emptyText="No accounts found"
                          />
                        </td>
                        <td className="py-1.5 px-1">
                          <input className={tableInput} placeholder="Center..." value={entry.center} onChange={e => updateJournalEntry(entry.id, 'center', e.target.value)} />
                        </td>
                        <td className="py-1.5 px-1">
                          <input
                            className={tableInput + ' font-black'} placeholder="0.00" type="number"
                            value={entry.debit}
                            onChange={e => updateJournalEntry(entry.id, 'debit', parseFloat(e.target.value) || 0)}
                            disabled={!entry.isManual} readOnly={!entry.isManual}
                          />
                        </td>
                        <td className="py-1.5 px-1">
                          <input
                            className={tableInput + ' font-black text-red-600'} placeholder="0.00" type="number"
                            value={entry.credit}
                            onChange={e => updateJournalEntry(entry.id, 'credit', parseFloat(e.target.value) || 0)}
                            disabled={!entry.isManual} readOnly={!entry.isManual}
                          />
                        </td>
                        <td className="py-1.5 text-center">
                          {entry.isManual ? (
                            <button className="p-1 text-red-600 hover:bg-red-50 rounded" onClick={() => removeJournalEntry(entry.id)}>
                              <Trash2 size={14} className="mx-auto" />
                            </button>
                          ) : (
                            <span className="text-gray-300 text-[10px] italic">Auto</span>
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

              <button
                onClick={addJournalEntry}
                className="mt-2 py-1.5 border-2 border-dashed border-gray-100 rounded-lg w-full text-[12px] font-black uppercase text-gray-400 hover:border-red-200 hover:text-red-600 transition-all flex items-center justify-center gap-1"
              >
                <Plus size={15} /> Add Ledger Row
              </button>
            </TableSection>

            {/* 3. ATTACHMENTS & REMARKS */}
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
                              className={tableInput} 
                              placeholder="e.g. OR_Scan" 
                              value={file.fileName}
                              onChange={(e) => updateAttachment(file.id, 'fileName', e.target.value)}
                            />
                          </td>
                          <td className="py-2 px-1">
                            <input 
                              type="file" 
                              className="text-[11px] font-bold text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-black file:text-white cursor-pointer w-full" 
                              onChange={(e) => handleFileChange(file.id, e.target.files[0])}
                            />
                          </td>
                          <td className="py-2 px-1">
                            <input 
                              className={tableInput} 
                              placeholder="Add note..." 
                              value={file.remarks}
                              onChange={(e) => updateAttachment(file.id, 'remarks', e.target.value)}
                            />
                          </td>
                          <td className="py-2 px-1 text-[12px] font-bold text-gray-600 italic">{file.uploadedBy}</td>
                          <td className="py-2 px-1 text-[12px] font-bold text-gray-600 tabular-nums">{file.date}</td>
                          <td className="py-2 text-center">
                            <button onClick={() => removeAttachment(file.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={addAttachment} className="mt-2 py-1.5 border-2 border-dashed border-gray-100 rounded-lg w-full text-[12px] font-black uppercase text-gray-400 hover:border-red-200 hover:text-red-600 transition-all flex items-center justify-center gap-1">
                  <Plus size={15} /> Add File
                </button>
              </TableSection>

              <TableSection title="Remarks" icon={<FileText size={14} />}>
                <textarea
                  className="w-full min-h-[100px] mt-4 p-4 bg-gray-50 border-none rounded-xl text-[14px] font-bold focus:ring-1 focus:ring-red-500 outline-none"
                  placeholder="Enter collection notes or justification here..."
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                />
              </TableSection>
            </div>

          </motion.div>
        </main>
      </div>

      {/* ── SALES INVOICE MODAL ── */}
      <RightSideModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Select Sales Invoices" size="2xl">
        <div className="space-y-4">
          <p className="text-[12px] text-gray-500 font-semibold">
            Select outstanding sales invoices to collect. Their line items will be fetched and amounts auto-computed (Discounted + VAT − WHT).
          </p>

          {salesDataLoading ? (
            <div className="p-8 bg-gray-50 rounded-xl border border-gray-200 text-center">
              <p className="text-[12px] text-gray-400 font-bold animate-pulse">Loading sales invoices…</p>
            </div>
          ) : salesDataError ? (
            <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-center">
              <p className="text-[12px] text-red-600 font-bold">{salesDataError}</p>
            </div>
          ) : salesData.length === 0 ? (
            <div className="p-8 bg-gray-50 rounded-xl border border-gray-200 text-center">
              <p className="text-[12px] text-gray-400 font-bold">No outstanding sales invoices found.</p>
            </div>
          ) : (
            <div className="overflow-hidden border border-gray-200 rounded-xl">
              <div className="max-h-[440px] overflow-y-auto custom-table-scroller">
                <table className="w-full" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '14%' }} />
                  </colgroup>
                  <thead className="bg-black sticky top-0 z-10">
                    <tr>
                      {['', 'Customer', 'Doc Ref', 'Terms', 'Date Due', 'Amount Due', 'Status'].map((h, i) => (
                        <th key={i} className="px-4 py-3 text-center text-[11px] font-black uppercase text-white tracking-wider border-b-2 border-red-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {salesData.map((sale, idx) => {
                      const isChecked = selectedSales.includes(sale.id);
                      return (
                        <tr
                          key={sale.id}
                          onClick={() => toggleSalesSelection(sale.id)}
                          className={`cursor-pointer transition-colors ${isChecked ? 'bg-red-50' : idx % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/40 hover:bg-gray-100'}`}
                        >
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSalesSelection(sale.id)}
                                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-[12px] font-bold text-gray-900 truncate" title={sale.customer}>{sale.customer || '—'}</td>
                          <td className="px-4 py-3 text-center text-[11px] font-mono font-bold text-gray-700">{sale.doc_ref || '—'}</td>
                          <td className="px-4 py-3 text-center text-[11px] font-bold text-gray-500 uppercase">{sale.terms || '—'}</td>
                          <td className="px-4 py-3 text-center text-[11px] font-mono text-gray-600">{sale.date_due || '—'}</td>
                          <td className="px-4 py-3 text-center text-[12px] font-black tabular-nums text-gray-900">
                            {parseFloat(sale.amount_due || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 text-[10px] font-black rounded-full border ${
                              sale.status === 'COLLECTED'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : sale.status === 'PARTIALLY COLLECTED'
                                ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                : sale.status === 'NOT COLLECTED'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-gray-50 text-gray-600 border-gray-200'
                            }`}>
                              {sale.status || 'UNKNOWN'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedSales.length > 0 && (
            <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-center">
              <p className="text-[11px] font-black text-red-600 uppercase tracking-wide">
                {selectedSales.length} invoice{selectedSales.length > 1 ? 's' : ''} selected
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => { setIsModalOpen(false); setSelectedSales([]); }}
              className="px-4 py-2 bg-gray-100 text-gray-600 text-[12px] font-black rounded-lg hover:bg-gray-200 transition-colors uppercase"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSelectedSales}
              disabled={selectedSales.length === 0}
              className={`px-6 py-2 text-[12px] font-black rounded-lg uppercase tracking-wider transition-colors ${
                selectedSales.length === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-200'
              }`}
            >
              Add {selectedSales.length > 0 ? `(${selectedSales.length})` : ''} Selected
            </button>
          </div>
        </div>
      </RightSideModal>
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

function SidebarInput({ label, placeholder, type = 'text', required, value, onChange }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-black uppercase text-gray-400 block">
        {label}{required && <span className="text-red-600 ml-1">*</span>}
      </label>
      <input
        type={type} placeholder={placeholder} value={value} onChange={onChange}
        className="w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all bg-gray-50 border border-gray-200 text-black focus:ring-1 focus:ring-red-500"
      />
    </div>
  );
}