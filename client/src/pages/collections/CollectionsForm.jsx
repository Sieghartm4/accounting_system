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
// SUMMARY COMPUTATION — Collections
//
//  A Collection is a payment received against a previously issued Sales Invoice.
//  Output VAT was already recorded on the Sales Invoice, so it is NOT re-recorded here.
//
//  Per item:
//    gross            = qty × price          (the original invoice amount)
//    discountAmount   = gross × (disc / 100)
//    discountedAmount = gross − discountAmount
//    whtAmount        = discountedAmount × (wht / 100)
//    cashCollected    = discountedAmount − whtAmount  ← actual cash received
//
//  Journal entry per item:
//    DR  Sales Discounts              discountAmount
//    DR  Creditable Withholding Tax   whtAmount
//    DR  Cash in Bank                 cashCollected
//    CR  Accounts Receivable          gross          ← closes the AR balance
//
//  Balance: DR = discAmt + whtAmt + (discounted − whtAmt)
//               = discAmt + discounted
//               = discAmt + (gross − discAmt)
//               = gross  ✅
// ─────────────────────────────────────────────────────────────────────────────
function computeSummary(items) {
  let totalInvoiceAmount  = 0;
  let totalDiscount       = 0;
  let totalDiscounted     = 0;
  let totalWHT            = 0;
  let totalCashCollected  = 0;

  items.forEach(item => {
    const qty     = parseFloat(item.qty)      || 0;
    const price   = parseFloat(item.price)    || 0;
    const discPct = parseFloat(item.discount) || 0;
    const whtPct  = parseFloat(item.wht)      || 0;

    const gross      = qty * price;
    const discAmt    = gross * (discPct / 100);
    const discounted = gross - discAmt;
    const whtAmt     = discounted * (whtPct / 100);
    const cash       = discounted - whtAmt;

    totalInvoiceAmount += gross;
    totalDiscount      += discAmt;
    totalDiscounted    += discounted;
    totalWHT           += whtAmt;
    totalCashCollected += cash;
  });

  return {
    totalInvoiceAmount,
    totalDiscount,
    totalDiscounted,
    totalWHT,
    totalCashCollected,
    // "Total Amount Due" on a collection = cash actually received
    totalAmountDue: totalCashCollected,
  };
}

const fmt = (n) => n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function CollectionsForm({ onBack, onSuccess }) {

  const [collectionItems, setCollectionItems] = useState([
    {
      id: 1,
      productId: '', productSearch: '',
      coa: '', coaSearch: '',          // AR account (e.g. Accounts Receivable)
      invoiceRef: '',                  // linked sales invoice / OR number
      description: '',
      unit: '', qty: 1, price: 0,
      discount: 0, wht: 0,
      responsibilityCenter: '',
      isOther: false
    }
  ]);

  const [journalEntries, setJournalEntries] = useState([
    { id: 1, account: '', accountSearch: '', center: '', debit: 0, credit: 0, isManual: false }
  ]);

  // ── Remote data ──────────────────────────────────────────────────────────
  const [customers,       setCustomers]       = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError,   setCustomerError]   = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerSearch,  setCustomerSearch]  = useState('');

  const [chartsOfAccounts, setChartsOfAccounts] = useState([]);
  const [coaLoading,        setCoaLoading]       = useState(false);
  const [coaError,          setCoaError]         = useState('');

  const [products,       setProducts]       = useState([]);
  const [productLoading, setProductLoading] = useState(false);
  const [productError,   setProductError]   = useState('');

  // ── Payment fields ────────────────────────────────────────────────────────
  const [modeOfPayment,      setModeOfPayment]      = useState('');
  const [modeSearch,         setModeSearch]         = useState('');
  const [bankName,           setBankName]           = useState('');
  const [checkNumber,        setCheckNumber]        = useState('');
  const [documentReference,  setDocumentReference]  = useState('');
  const [remarks,            setRemarks]            = useState('');

  const [attachments, setAttachments] = useState([
    { id: 1, fileName: '', file: null, remarks: '', uploadedBy: 'Current User', date: new Date().toLocaleDateString() }
  ]);

  const [toast, setToast] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [salesData, setSalesData] = useState([]);
  const [salesDataLoading, setSalesDataLoading] = useState(false);
  const [salesDataError, setSalesDataError] = useState('');
  const [selectedSales, setSelectedSales] = useState([]);

  const modeOfPaymentOptions = ['CASH', 'CHECK', 'BANK_TRANSFER', 'CARD', 'E-WALLET', 'OTHERS'];

  const coaOptions      = chartsOfAccounts.map(a => ({ label: a.name || a.account_name, sublabel: a.code || a.account_code, value: a.id }));
  const customerOptions = customers.map(c => ({ label: c.name || c.customer_name, sublabel: c.code, value: c.id }));
  const productOptions  = products.map(p => ({ label: p.name || p.product_name, sublabel: p.code || p.product_code, value: p.id }));

  // ── Fetchers ─────────────────────────────────────────────────────────────
  const fetchCustomers = async () => {
    try {
      setCustomerLoading(true);
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authorization token found');
      const res    = await fetch(`${import.meta.env.VITE_SERVER_LINK}/customer`, { method: 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const result = await res.json();
      if (result.success) setCustomers(result.data); else setCustomerError(result.message || 'Failed to fetch customers');
    } catch (err) { setCustomerError(err.message); } finally { setCustomerLoading(false); }
  };

  const fetchChartsOfAccounts = async () => {
    try {
      setCoaLoading(true);
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authorization token found');
      const res    = await fetch(`${import.meta.env.VITE_SERVER_LINK}/charts_of_accounts`, { method: 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const result = await res.json();
      if (result.success) setChartsOfAccounts(result.data); else setCoaError(result.message || 'Failed to fetch charts of accounts');
    } catch (err) { setCoaError(err.message); } finally { setCoaLoading(false); }
  };

  const fetchProducts = async () => {
    try {
      setProductLoading(true);
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authorization token found');
      const res    = await fetch(`${import.meta.env.VITE_SERVER_LINK}/product_service`, { method: 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const result = await res.json();
      if (result.success) setProducts(result.data); else setProductError(result.message || 'Failed to fetch products');
    } catch (err) { setProductError(err.message); } finally { setProductLoading(false); }
  };

  const fetchSalesData = async () => {
    try {
      setSalesDataLoading(true);
      setSalesDataError('');
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authorization token found');
      
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/collections/sales-collection/`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      
      if (result.success) {
        setSalesData(result.data || []);
      } else {
        setSalesDataError(result.message || 'Failed to fetch sales data');
      }
    } catch (err) {
      setSalesDataError(err.message);
    } finally {
      setSalesDataLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); fetchChartsOfAccounts(); fetchProducts(); }, []);

  useEffect(() => {
    if (isModalOpen) {
      fetchSalesData();
      setSelectedSales([]);
    }
  }, [isModalOpen]);

  // ── Item / entry helpers ──────────────────────────────────────────────────
  const addCollectionItem  = (isOther = false) => setCollectionItems(prev => [...prev, { id: Date.now(), productId: '', productSearch: '', coa: '', coaSearch: '', invoiceRef: '', description: '', unit: '', qty: 1, price: 0, discount: 0, wht: 0, responsibilityCenter: '', isOther }]);
  const removeCollectionItem = (id) => setCollectionItems(prev => prev.filter(i => i.id !== id));
  const updateCollectionItem = (id, field, value) => setCollectionItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));

  const addJournalEntry    = () => setJournalEntries(prev => [...prev, { id: Date.now(), account: '', accountSearch: '', center: '', debit: 0, credit: 0, isManual: true }]);
  const removeJournalEntry = (id) => setJournalEntries(prev => prev.filter(e => e.id !== id));
  const updateJournalEntry = (id, field, value) => setJournalEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));

  const addAttachment    = () => setAttachments(prev => [...prev, { id: Date.now(), fileName: '', file: null, remarks: '', uploadedBy: 'Current User', date: new Date().toLocaleDateString() }]);
  const removeAttachment = (id) => setAttachments(prev => prev.filter(a => a.id !== id));

  // ── Sales selection helpers ───────────────────────────────────────────────────
  const toggleSalesSelection = (saleId) => {
    setSelectedSales(prev => 
      prev.includes(saleId) 
        ? prev.filter(id => id !== saleId)
        : [...prev, saleId]
    );
  };

  const handleAddSelectedSales = async () => {
    try {
      const token = localStorage.getItem("token");
      
      if (!token) {
        throw new Error("No authorization token found");
      }
      console.log("Selected sales:", selectedSales);
      // Send selected IDs to the testing API
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/collections/testing`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            selectedIds: selectedSales
          }),

        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        // Close modal and reset selection
        setIsModalOpen(false);
        setSelectedSales([]);
        console.log('Selected items sent successfully:', result);
      } else {
        throw new Error(result.message || 'Failed to add selected items');
      }
    } catch (error) {
      console.error('Error adding selected sales:', error);
      // You might want to show an error message to the user here
    }
  };

  const summary = computeSummary(collectionItems);

  // ── Journal-entry auto-generation ─────────────────────────────────────────
  //
  //  Collection Journal (per item):
  //    DR  Accounts Receivable  0          gross          ← closing the AR
  //
  //  Wait — AR is being CREDITED (we're collecting it / reducing it).
  //  AR is an asset: increases with DR, decreases with CR.
  //    CR  Accounts Receivable             gross
  //    DR  Sales Discounts      discAmt    0
  //    DR  CWT                  whtAmt     0
  //    DR  Cash in Bank         cashAmt    0
  // ─────────────────────────────────────────────────────────────────────────
  const generateJournalEntries = () => {
    const entries = [];

    // Resolve the payment/cash account
    let paymentAccount = null;
    if (modeOfPayment === 'CASH') {
      paymentAccount = chartsOfAccounts.find(a => (a.name || '').toLowerCase().includes('cash on hand'))
        ?? chartsOfAccounts.find(a => (a.name || '').toLowerCase().includes('petty cash'));
    } else if (modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') {
      paymentAccount = bankName
        ? chartsOfAccounts.find(a => (a.name || '').toLowerCase().includes(bankName.toLowerCase()))
        : null;
      paymentAccount ??= chartsOfAccounts.find(a => (a.name || '').toLowerCase().includes('cash in bank'));
    }

    let totalCash = 0;

    collectionItems.forEach(item => {
      const qty     = parseFloat(item.qty)      || 0;
      const price   = parseFloat(item.price)    || 0;
      const discPct = parseFloat(item.discount) || 0;
      const whtPct  = parseFloat(item.wht)      || 0;

      const gross      = qty * price;
      const discAmt    = gross * (discPct / 100);
      const discounted = gross - discAmt;
      const whtAmt     = discounted * (whtPct / 100);
      const cashAmt    = discounted - whtAmt;

      totalCash += cashAmt;

      // ── CR  Accounts Receivable (or whatever AR account is chosen per item) ──
      const selectedCoa = chartsOfAccounts.find(a => a.id === item.coa)
        ?? chartsOfAccounts.find(a => (a.name || '').toLowerCase().includes('accounts receivable'));

      if (selectedCoa && gross > 0) {
        entries.push({
          id: Date.now() + Math.random(),
          account: selectedCoa.id,
          accountSearch: selectedCoa.name,
          center: item.responsibilityCenter || '',
          debit: 0,
          credit: parseFloat(gross.toFixed(2)),
          isManual: false,
        });
      }

      // ── DR  Sales Discounts ──
      if (discAmt > 0) {
        const discAccount = chartsOfAccounts.find(a =>
          (a.name || '').toLowerCase().includes('sales discounts')
        );
        if (discAccount) {
          entries.push({
            id: Date.now() + Math.random(),
            account: discAccount.id,
            accountSearch: discAccount.name,
            center: item.responsibilityCenter || '',
            debit: parseFloat(discAmt.toFixed(2)),
            credit: 0,
            isManual: false,
          });
        }
      }

      // ── DR  Creditable Withholding Tax ──
      if (whtAmt > 0) {
        const whtAccount = chartsOfAccounts.find(a =>
          (a.name || '').toLowerCase().includes('creditable withholding tax')
        );
        if (whtAccount) {
          entries.push({
            id: Date.now() + Math.random(),
            account: whtAccount.id,
            accountSearch: whtAccount.name,
            center: item.responsibilityCenter || '',
            debit: parseFloat(whtAmt.toFixed(2)),
            credit: 0,
            isManual: false,
          });
        }
      }
    });

    // ── DR  Cash in Bank (one combined entry for all items) ──
    if (paymentAccount && totalCash > 0) {
      entries.push({
        id: Date.now() + Math.random(),
        account: paymentAccount.id,
        accountSearch: paymentAccount.name,
        center: '',
        debit: parseFloat(totalCash.toFixed(2)),
        credit: 0,
        isManual: false,
      });
    }

    setJournalEntries(entries);
  };

  useEffect(() => {
    generateJournalEntries();
  }, [collectionItems, modeOfPayment, bankName, chartsOfAccounts]);

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
      const userData  = JSON.parse(localStorage.getItem('user') || '{}');
      const createdBy = userData.mu_username || userData.username || 'Unknown User';

      if (!selectedCustomer) { setToast({ type: 'warning', message: 'Please select a customer' }); return; }
      if (!modeOfPayment)    { setToast({ type: 'warning', message: 'Please select mode of payment' }); return; }
      if ((modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') && !bankName) {
        setToast({ type: 'warning', message: 'Please enter bank name' }); return;
      }
      if (collectionItems.length === 0 || (collectionItems.length === 1 && collectionItems[0].isOther)) {
        setToast({ type: 'warning', message: 'Please add at least one collection item' }); return;
      }

      const token = localStorage.getItem('token');
      if (!token) { setToast({ type: 'error', message: 'No authorization token found. Please login again.' }); return; }

      const preparedItems = collectionItems
        .filter(item => !item.isOther)
        .map(item => ({
          product_id:            item.productId || null,
          account_id:            item.coa || item.accountId,
          invoice_ref:           item.invoiceRef || '',
          description:           item.description,
          unit:                  item.unit || '',
          qty:                   parseFloat(item.qty)      || 0,
          price:                 parseFloat(item.price)    || 0,
          discount:              parseFloat(item.discount) || 0,
          wtax:                  parseFloat(item.wht)      || 0,
          responsibility_center: item.responsibilityCenter || '',
        }));

      const preparedJournalEntries = journalEntries
        .filter(entry => !entry.isOther)
        .map(entry => ({
          account_id:            entry.account || entry.accountId,
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

      const collectionData = {
        customer_id:        selectedCustomer,
        document_reference: documentReference,
        collection_date:    new Date().toISOString().split('T')[0],
        mode_of_payment:    modeOfPayment,
        bank_name:          bankName     || '',
        check_number:       checkNumber  || '',
        remarks,
        total_amount_due:   summary.totalAmountDue,
        created_by:         createdBy,
        collection_items:   preparedItems,
        journal_entries:    preparedJournalEntries,
        attachments:        preparedAttachments,
      };

      const response = await fetch(`${import.meta.env.VITE_SERVER_LINK}/collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(collectionData),
      });

      if (!response.ok) {
        const errorData    = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
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
  const inputBase  = 'w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all bg-gray-50 border border-gray-200 text-black focus:ring-1 focus:ring-red-500 text-center';
  const tableInput = 'w-full bg-gray-50/50 rounded-md px-1 py-1 text-[13px] font-bold text-center outline-none focus:ring-1 focus:ring-red-400';
  const pctInput   = tableInput + ' pr-4';
  const fadeInUp   = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

  // ── Derived totals for Balance Check ─────────────────────────────────────
  const totalDebit  = journalEntries.reduce((s, e) => s + (parseFloat(e.debit)  || 0), 0);
  const totalCredit = journalEntries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0);

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
        <nav
          className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[2px] text-gray-400 cursor-pointer hover:text-black transition-colors"
          onClick={onBack}
        >
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

        {/* LEFT SIDEBAR */}
        <aside className="w-72 flex-shrink-0 flex flex-col gap-3 h-full overflow-y-auto sidebar-scroll pb-2">

          {/* Basic Details */}
          <section className="bg-black rounded-2xl p-4 text-white shadow-xl flex-shrink-0">
            <h3 className="text-[12px] font-black uppercase tracking-[3px] text-red-500 mb-3 flex items-center gap-2">
              <Landmark size={12} /> Basic Details
            </h3>
            <div className="grid grid-cols-1 gap-2.5">
              {/* Customer */}
              <div>
                <label className="text-[11px] font-black uppercase text-gray-400 block mb-1">
                  Customer <span className="text-red-600">*</span>
                </label>
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

              {/* Reference + Date */}
              <div className="grid grid-cols-2 gap-2">
                <SidebarInput
                  label="OR / Reference"
                  placeholder="OR-000"
                  value={documentReference}
                  onChange={e => setDocumentReference(e.target.value)}
                />
                <SidebarInput label="Date" type="date" />
              </div>

              {/* Mode of Payment */}
              <div className="grid grid-cols-2 gap-2">
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
              </div>

              {/* Bank / Check — shown only when relevant */}
              {(modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') && (
                <div className="grid grid-cols-2 gap-2">
                  <SidebarInput label="Bank Name" placeholder="Enter bank name" value={bankName} onChange={e => setBankName(e.target.value)} />
                  <SidebarInput label="Check #"   placeholder="Enter check number" value={checkNumber} onChange={e => setCheckNumber(e.target.value)} />
                </div>
              )}
            </div>
          </section>

          {/* ── SUMMARY ── */}
          <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex-1 flex flex-col min-h-0">
            <h3 className="text-[12px] font-black uppercase tracking-[3px] text-gray-900 mb-2 flex items-center gap-2 flex-shrink-0">
              <Calculator size={12} /> Summary
            </h3>

            <div className="overflow-y-auto min-h-0 flex-1">
              <div className="space-y-0">

                {/* 1. Total Invoice Amount = Σ (qty × price) */}
                <SummaryRow
                  label="Total Invoice Amount"
                  value={fmt(summary.totalInvoiceAmount)}
                  formula="Σ (Qty × Price)"
                />
                <SDivider />

                {/* 2. Total Discount */}
                <SummaryRow
                  label="Total Discount"
                  value={fmt(summary.totalDiscount)}
                  color="text-orange-500"
                  formula="Σ (Invoice Amount × Disc%)"
                />
                <SDivider />

                {/* 3. Total Discounted Amount */}
                <SummaryRow
                  label="Total Discounted Amount"
                  value={fmt(summary.totalDiscounted)}
                  formula="Invoice Amount − Discount"
                />
                <SDivider />

                {/* 4. Total WHT */}
                <SummaryRow
                  label="Total Withholding Tax"
                  value={fmt(summary.totalWHT)}
                  color="text-blue-600"
                  formula="Σ (Discounted × WHT%)"
                />
                <SDivider />

                {/* 5. Total Cash Collected */}
                <SummaryRow
                  label="Total Cash Collected"
                  value={fmt(summary.totalCashCollected)}
                  color="text-green-600"
                  formula="Discounted Amount − WHT"
                />

              </div>
            </div>

            {/* Total Amount Due footer */}
            <div className="mt-3 flex-shrink-0">
              <div className="flex flex-col gap-[2px] mb-2">
                <div className="h-[2px] w-full bg-red-600 rounded-full" />
                <div className="h-[1px] w-full bg-black/10" />
              </div>
              <div className="mb-2 px-2 py-1 bg-red-50 rounded-lg border border-red-100 text-center">
                <p className="text-[9px] font-black uppercase tracking-wide text-red-400">
                  Discounted Amount − WHT
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[3px] mb-1">Total Cash Received</p>
                <p className="text-2xl font-black text-black tracking-tighter leading-none flex items-baseline justify-center gap-1">
                  <span className="text-[13px] text-red-600">PHP</span>
                  {fmt(summary.totalAmountDue)}
                </p>
              </div>
            </div>
          </section>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto custom-table-scroller space-y-4 pr-1 min-h-0">
          <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="space-y-4">

            {/* 1. COLLECTION ITEMS */}
            <TableSection title="Collection Items" icon={<Receipt size={14} />}>
              <div className="w-full flex flex-col gap-[2px] mb-3">
                <div className="h-[2px] w-full bg-red-600 rounded-full" />
                <div className="h-[1px] w-full bg-black/10" />
              </div>

              {/* Info badge — explains VAT absence */}
              <div className="mb-3 px-3 py-2 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-2">
                <span className="text-blue-500 text-[11px] font-black uppercase tracking-wide leading-snug">
                  ℹ️ Collection against Sales Invoice — Output VAT was already recorded on the Sales Invoice and is not re-recorded here.
                </span>
              </div>

              <div className="overflow-x-auto custom-table-scroller">
                <table className="w-full text-center min-w-[1050px]" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '13%' }} />  {/* Product/Service */}
                    <col style={{ width: '14%' }} />  {/* Charts of Accounts (AR) */}
                    <col style={{ width: '12%' }} />  {/* Invoice Ref */}
                    <col style={{ width: '14%' }} />  {/* Description */}
                    <col style={{ width: '6%'  }} />  {/* Unit */}
                    <col style={{ width: '6%'  }} />  {/* Qty */}
                    <col style={{ width: '10%' }} />  {/* Price (Invoice Amt) */}
                    <col style={{ width: '8%'  }} />  {/* Disc % */}
                    <col style={{ width: '8%'  }} />  {/* WHT % */}
                    <col style={{ width: '12%' }} />  {/* Resp. Center */}
                    <col style={{ width: '5%'  }} />  {/* Delete */}
                  </colgroup>
                  <thead>
                    <tr className="border-b border-gray-100">
                      {[
                        'Product/Service',
                        'AR Account',
                        'Invoice Ref',
                        'Description',
                        'Unit', 'Qty',
                        'Invoice Amt',
                        'Disc %',
                        'WHT %',
                        'Resp. Center',
                        ''
                      ].map((h, i) => (
                        <th key={i} className="pb-3 text-[12px] font-black uppercase text-gray-900 text-center px-1">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {collectionItems.map((item) => (
                      <tr key={item.id} className={item.isOther ? 'bg-gray-50/30' : ''}>

                        {/* Product/Service */}
                        <td className="py-1 px-1">
                          <SearchableDropdown
                            disabled={item.isOther}
                            placeholder="Search product..."
                            value={item.productSearch}
                            onChange={v => updateCollectionItem(item.id, 'productSearch', v)}
                            onSelect={opt => { updateCollectionItem(item.id, 'productId', opt.value); updateCollectionItem(item.id, 'productSearch', opt.label); }}
                            options={productOptions}
                            inputClassName={`${tableInput} ${item.isOther ? 'bg-transparent text-gray-200 cursor-not-allowed' : ''}`}
                            emptyText={productError || 'No products found'}
                          />
                        </td>

                        {/* AR Account */}
                        <td className="py-1 px-1">
                          <SearchableDropdown
                            placeholder="Accounts Receivable..."
                            value={item.coaSearch}
                            onChange={v => updateCollectionItem(item.id, 'coaSearch', v)}
                            onSelect={opt => { updateCollectionItem(item.id, 'coa', opt.value); updateCollectionItem(item.id, 'coaSearch', opt.label); }}
                            options={coaOptions}
                            inputClassName={tableInput}
                            emptyText="No accounts found"
                          />
                        </td>

                        {/* Invoice Reference */}
                        <td className="py-1 px-1">
                          <input
                            className={tableInput}
                            placeholder="INV-000"
                            value={item.invoiceRef}
                            onChange={e => updateCollectionItem(item.id, 'invoiceRef', e.target.value)}
                          />
                        </td>

                        {/* Description */}
                        <td className="py-1 px-1">
                          <input
                            className={tableInput}
                            placeholder="Details..."
                            value={item.description}
                            onChange={e => updateCollectionItem(item.id, 'description', e.target.value)}
                          />
                        </td>

                        {/* Unit */}
                        <td className="py-1 px-1">
                          <input
                            disabled={item.isOther}
                            className={`${tableInput} ${item.isOther ? 'bg-transparent text-gray-200 cursor-not-allowed' : ''}`}
                            placeholder={item.isOther ? '' : 'pc'}
                            value={item.isOther ? '' : item.unit}
                            onChange={e => updateCollectionItem(item.id, 'unit', e.target.value)}
                          />
                        </td>

                        {/* Qty */}
                        <td className="py-1 px-1">
                          <input
                            disabled={item.isOther}
                            type="number" min="0"
                            className={`${tableInput} ${item.isOther ? 'bg-transparent text-gray-200 cursor-not-allowed' : ''}`}
                            placeholder={item.isOther ? '' : '1'}
                            value={item.isOther ? '' : item.qty}
                            onChange={e => updateCollectionItem(item.id, 'qty', parseFloat(e.target.value) || 0)}
                          />
                        </td>

                        {/* Price / Invoice Amount */}
                        <td className="py-1 px-1">
                          <input
                            className={tableInput + ' font-black'}
                            type="number" min="0" step="0.01"
                            placeholder="0.00"
                            value={item.price}
                            onChange={e => updateCollectionItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                          />
                        </td>

                        {/* Disc % */}
                        <td className="py-1 px-1">
                          <div className="relative">
                            <input
                              className={pctInput + ' font-black'}
                              type="number" min="0" max="100" step="0.01"
                              placeholder="0"
                              value={item.discount || 0}
                              onChange={e => updateCollectionItem(item.id, 'discount', parseFloat(e.target.value) || 0)}
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-black pointer-events-none">%</span>
                          </div>
                        </td>

                        {/* WHT % */}
                        <td className="py-1 px-1">
                          <div className="relative">
                            <input
                              className={pctInput + ' font-black text-blue-600'}
                              type="number" min="0" max="100" step="0.01"
                              placeholder="0"
                              value={item.wht}
                              onChange={e => updateCollectionItem(item.id, 'wht', parseFloat(e.target.value) || 0)}
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-blue-400 font-black pointer-events-none">%</span>
                          </div>
                        </td>

                        {/* Resp. Center */}
                        <td className="py-1 px-1">
                          <input
                            className={tableInput}
                            placeholder="Center"
                            value={item.responsibilityCenter}
                            onChange={e => updateCollectionItem(item.id, 'responsibilityCenter', e.target.value)}
                          />
                        </td>

                        {/* Delete */}
                        <td className="py-1 px-1 text-center">
                          <button
                            onClick={() => removeCollectionItem(item.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full py-2 border-2 border-dashed border-gray-100 rounded-xl text-[11px] font-black uppercase text-gray-400 hover:border-red-200 hover:text-red-600 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={14} /> ADD SALES ITEMS
                </button>
              </div>
            </TableSection>

            {/* 2. JOURNAL ENTRIES */}
            <TableSection title="Journal Entries" icon={<Layers size={14} />}>
              <div className="w-full flex flex-col gap-[2px] mb-4">
                <div className="h-[2px] w-full bg-red-600 rounded-full" />
                <div className="h-[1px] w-full bg-black/10" />
              </div>


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
                    {journalEntries.map((entry) => (
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
                            className={tableInput + ' font-black'}
                            placeholder="0.00" type="number"
                            value={entry.debit}
                            onChange={e => updateJournalEntry(entry.id, 'debit', parseFloat(e.target.value) || 0)}
                            disabled={!entry.isManual} readOnly={!entry.isManual}
                          />
                        </td>
                        <td className="py-1.5 px-1">
                          <input
                            className={tableInput + ' font-black text-red-600'}
                            placeholder="0.00" type="number"
                            value={entry.credit}
                            onChange={e => updateJournalEntry(entry.id, 'credit', parseFloat(e.target.value) || 0)}
                            disabled={!entry.isManual} readOnly={!entry.isManual}
                          />
                        </td>
                        <td className="py-1.5 text-center">
                          {entry.isManual ? (
                            <button className="p-1 text-red-600 transition-colors hover:bg-red-50 rounded" onClick={() => removeJournalEntry(entry.id)}>
                              <Trash2 size={15} className="mx-auto" />
                            </button>
                          ) : (
                            <span className="text-gray-300 text-[11px] italic">Auto</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50/50">
                      <td colSpan={2} className="py-2 px-3 text-[12px] font-black uppercase text-black text-left">
                        Balance Check
                      </td>
                      <td className="py-2 px-1 text-center text-[13px] font-black">
                        {fmt(totalDebit)}
                      </td>
                      <td className={`py-2 px-1 text-center text-[13px] font-black ${Math.abs(totalDebit - totalCredit) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                        {fmt(totalCredit)}
                        {Math.abs(totalDebit - totalCredit) < 0.01
                          ? <span className="ml-1 text-[10px]">✅</span>
                          : <span className="ml-1 text-[10px]">❌</span>
                        }
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
                      {attachments.map((file) => (
                        <tr key={file.id}>
                          <td className="py-2 px-1"><input className={tableInput} placeholder="e.g. OR_Scan" /></td>
                          <td className="py-2 px-1">
                            <input type="file" className="text-[11px] font-bold text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-black file:text-white cursor-pointer w-full" />
                          </td>
                          <td className="py-2 px-1"><input className={tableInput} placeholder="Add note..." /></td>
                          <td className="py-2 px-1 text-[12px] font-bold text-gray-600 italic">{file.uploadedBy}</td>
                          <td className="py-2 px-1 text-[12px] font-bold text-gray-600 tabular-nums">{file.date}</td>
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
                <button
                  onClick={addAttachment}
                  className="mt-2 py-1.5 border-2 border-dashed border-gray-100 rounded-lg w-full text-[12px] font-black uppercase text-gray-400 hover:border-red-200 hover:text-red-600 transition-all flex items-center justify-center gap-1"
                >
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

      {/* Right Side Modal for Sales Items */}
      <RightSideModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Select Sales Items"
        size="2xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 mb-4">
            Select sales invoices to add to this collection. This will populate the collection items with the selected invoice details.
          </p>
          
          {/* Sales Data Table */}
          <div className="space-y-3">
            {salesDataLoading ? (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 text-center">Loading sales data...</p>
              </div>
            ) : salesDataError ? (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-xs text-red-600 text-center">{salesDataError}</p>
              </div>
            ) : salesData.length === 0 ? (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 text-center">No sales invoices found</p>
              </div>
            ) : (
              <div className="overflow-hidden border border-gray-200 rounded-lg">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '60px' }} />  {/* Select */}
                      <col style={{ width: '20%' }} /> {/* Customer */}
                      <col style={{ width: '20%' }} /> {/* Doc Ref */}
                      <col style={{ width: '15%' }} /> {/* Terms */}
                      <col style={{ width: '15%' }} /> {/* Date Due */}
                      <col style={{ width: '15%' }} /> {/* Amount Due */}
                      <col style={{ width: '130px' }} /> {/* Status */}
                    </colgroup>
                    <thead className="bg-black border-b border-red-600 sticky top-0 z-10">
                      <tr>
                        <th className="p-4 text-center font-bold uppercase text-white text-xs tracking-wider">Select</th>
                        <th className="p-4 text-center font-bold uppercase text-white text-xs tracking-wider">Customer</th>
                        <th className="p-4 text-center font-bold uppercase text-white text-xs tracking-wider">Doc Ref</th>
                        <th className="p-4 text-center font-bold uppercase text-white text-xs tracking-wider">Terms</th>
                        <th className="p-4 text-center font-bold uppercase text-white text-xs tracking-wider">Date Due</th>
                        <th className="p-4 text-center font-bold uppercase text-white text-xs tracking-wider">Amount Due</th>
                        <th className="p-4 text-center font-bold uppercase text-white text-xs tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {salesData.map((sale, index) => (
                        <tr 
                          key={sale.id} 
                          className={`hover:bg-gray-50 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                          onClick={() => toggleSalesSelection(sale.id)}
                        >
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={selectedSales.includes(sale.id)}
                                onChange={() => toggleSalesSelection(sale.id)}
                                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500 focus:ring-2"
                              />
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="font-medium text-gray-900 truncate text-center" title={sale.customer}>
                              {sale.customer || '-'}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="font-medium text-gray-900 font-mono text-xs text-center" title={sale.doc_ref}>
                              {sale.doc_ref || '-'}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="text-gray-600 text-xs font-medium uppercase text-center">
                              {sale.terms || '-'}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="text-gray-600 text-xs font-mono text-center">
                              {sale.date_due || '-'}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-gray-900 text-right tabular-nums">
                              {parseFloat(sale.amount_due || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center">
                              <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold text-center rounded-full border ${
                                sale.status === 'COLLECTED' 
                                  ? 'bg-green-50 text-green-700 border-green-200' 
                                  : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                              }`}>
                                {sale.status || 'UNKNOWN'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-gray-200 text-gray-600 text-sm font-bold rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSelectedSales}
              disabled={selectedSales.length === 0}
              className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors ${
                selectedSales.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              Add Selected Items ({selectedSales.length})
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

function SDivider() {
  return <div className="h-[1px] w-full bg-gray-100" />;
}

function SummaryRow({ label, value, color = 'text-gray-800', formula }) {
  return (
    <div className="summary-row relative flex justify-between items-center hover:bg-gray-50 rounded-md transition-colors py-1 px-1 cursor-default">
      <span className="text-[10.5px] font-black uppercase text-gray-500 leading-tight pr-1 flex-1">{label}</span>
      <span className={`${color} text-[12px] font-black tabular-nums tracking-tight whitespace-nowrap text-right flex-shrink-0`}>
        {value}
      </span>
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
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <input
        type={type} placeholder={placeholder}
        value={value} onChange={onChange}
        className="w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all bg-gray-50 border border-gray-200 text-black focus:ring-red-500 border-gray-200 focus:ring-1"
      />
    </div>
  );
}