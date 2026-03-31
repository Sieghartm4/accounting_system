import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Save, Plus, Trash2, Wallet,
  FileText, Paperclip, Calculator, Layers, Landmark
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
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [open, anchorRef]);

  if (!open) return null;
  return ReactDOM.createPortal(
    <div style={{ position: 'absolute', top: style.top, left: style.left, width: style.width, maxHeight: style.maxHeight, zIndex: 99999, overflowY: 'auto', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', boxShadow: '0 10px 40px -6px rgba(0,0,0,0.18)' }}>
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
  const filtered = options.filter(o => !value || o.label.toLowerCase().includes(value.toLowerCase()) || (o.sublabel || '').toLowerCase().includes(value.toLowerCase()));
  const handleBlur = () => { closeTimer.current = setTimeout(() => setOpen(false), 180); };
  const handleFocus = () => { clearTimeout(closeTimer.current); setOpen(true); };
  const handleSelect = (opt) => { clearTimeout(closeTimer.current); onSelect(opt); setOpen(false); };
  return (
    <div ref={anchorRef} className="relative w-full">
      <input type="text" placeholder={placeholder} value={value} onChange={e => { onChange(e.target.value); setOpen(true); }} onFocus={handleFocus} onBlur={handleBlur} className={inputClassName} autoComplete="off" />
      <PortalDropdown anchorRef={anchorRef} open={open}>
        {filtered.length > 0 ? filtered.map((opt, i) => (
          <div key={opt.value ?? i} onMouseDown={e => { e.preventDefault(); handleSelect(opt); }} className="flex items-center justify-between gap-2 px-3 py-2 text-[12px] font-bold hover:bg-red-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0 text-black">
            <span className="truncate flex-1">{opt.label}</span>
            {opt.sublabel && <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide flex-shrink-0">{opt.sublabel}</span>}
          </div>
        )) : <div className="px-3 py-3 text-[12px] text-gray-400 text-center">{emptyText}</div>}
      </PortalDropdown>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────
//
//  Per item:
//    gross            = qty × price
//    discountAmount   = gross × (discount / 100)          ← discount is a % field
//    discountedAmount = gross − discountAmount
//    vatAmount        = discountedAmount × (vat / 100)    ← vat is a % field (0 or 12)
//    whtAmount        = discountedAmount × (wht / 100)    ← wht is a % field
//
//  VATable item     → vat > 0
//    vatablePurchases  += discountedAmount / (1 + vat/100)   (the net-of-VAT base)
//    totalNoVatDiscount+= discountAmount                     (pre-VAT discount on vatable items)
//
//  Zero-Rated item  → vat === 0 AND wht > 0
//    zeroRatedPurchases += discountedAmount
//
//  VAT-Exempt item  → vat === 0 AND wht === 0
//    vatExemptPurchases += discountedAmount
//
//  totalNetOfVat    = Σ (net-of-VAT base per item)
//                   = Σ discountedAmount / (1 + vat/100)  for vatable
//                   + Σ discountedAmount                   for non-vatable
//
//  totalAmountDue   = totalDiscounted + totalVAT − totalWHT
//
function computeSummary(items) {
  let totalSalesPrice = 0;
  let totalDiscount = 0;
  let totalDiscounted = 0;
  let totalVAT = 0;
  let vatableSales = 0;
  let vatExemptSales = 0;
  let zeroRatedSales = 0;
  let totalNoVatDiscount = 0;
  let totalNetOfVat = 0;
  let totalWHT = 0;

  items.forEach(item => {
    const qty = parseFloat(item.qty) || 0;
    const price = parseFloat(item.price) || 0;
    const discPct = parseFloat(item.discount) || 0;
    const vatPct = parseFloat(item.vat) || 0;
    const whtPct = parseFloat(item.wht) || 0;

    const gross = qty * price;
    const discAmt = gross * (discPct / 100);
    const discounted = gross - discAmt;
    const vatAmt = discounted * (vatPct / 100);
    const whtAmt = discounted * (whtPct / 100);

    const netBase = vatPct > 0 ? discounted / (1 + vatPct / 100) : discounted;

    totalSalesPrice += gross;
    totalDiscount += discAmt;
    totalDiscounted += discounted;
    totalVAT += vatAmt;
    totalWHT += whtAmt;
    totalNetOfVat += netBase;

    if (vatPct > 0) {
      vatableSales += netBase;
      totalNoVatDiscount += discAmt;
    } else if (whtPct > 0) {
      zeroRatedSales += discounted;
    } else {
      vatExemptSales += discounted;
    }
  });

  return {
    totalSalesPrice,
    totalDiscount,
    totalDiscounted,
    totalVAT,
    vatableSales,
    vatExemptSales,
    zeroRatedSales,
    totalNoVatDiscount,
    totalNetOfVat,
    totalWHT,
    totalAmountDue: totalDiscounted + totalVAT - totalWHT,
  };
}

const fmt = (n) => n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function SalesForm({ onBack, onSuccess }) {
  const [salesItems, setSalesItems] = useState([
    { id: 1, productId: '', productSearch: '', coa: '', coaSearch: '', description: '', unit: '', qty: 1, price: 0, discount: 0, vat: 0, wht: 0, responsibilityCenter: '', isOther: false }
  ]);

  const [journalEntries, setJournalEntries] = useState([
    { id: 1, account: '', accountSearch: '', center: '', debit: 0, credit: 0 }
  ]);

  const [customers, setCustomers] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  const [vendors, setVendors] = useState([]);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [vendorError, setVendorError] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');

  const [chartsOfAccounts, setChartsOfAccounts] = useState([]);
  const [coaLoading, setCoaLoading] = useState(false);
  const [coaError, setCoaError] = useState('');
  const [coaSearch, setCoaSearch] = useState('');

  const [products, setProducts] = useState([]);
  const [productLoading, setProductLoading] = useState(false);
  const [productError, setProductError] = useState('');

  const [modeOfPayment, setModeOfPayment] = useState('');
  const [modeSearch, setModeSearch] = useState('');
  const [bankName, setBankName] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [category, setCategory] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [documentReference, setDocumentReference] = useState('');
  const [remarks, setRemarks] = useState('');

  const [attachments, setAttachments] = useState([
    { id: 1, fileName: '', file: null, remarks: '', uploadedBy: 'Current User', date: new Date().toLocaleDateString() }
  ]);

  const [toast, setToast] = useState(null);

  const modeOfPaymentOptions = ['CASH', 'CHECK', 'BANK_TRANSFER', 'CARD', 'E-WALLET', 'OTHERS'];
  const categoryOptions = ['OPERATIONAL EXPENSES', 'ADMINISTRATIVE EXPENSES', 'MARKETING EXPENSES', 'MAINTENANCE EXPENSES', 'UTILITIES EXPENSES', 'RENT EXPENSES', 'SUPPLIES EXPENSES', 'PROFESSIONAL FEES', 'INSURANCE EXPENSES', 'OTHER EXPENSES'];

  const coaOptions = chartsOfAccounts.map(a => ({ label: a.name || a.account_name, sublabel: a.code || a.account_code, value: a.id }));
  const vendorOptions = vendors.map(v => ({ label: v.name || v.code, sublabel: v.code, value: v.id }));
  const customerOptions = customers.map(c => ({ label: c.name || c.customer_name, sublabel: c.code, value: c.id }));
  const productOptions = products.map(p => ({ label: p.name || p.product_name, sublabel: p.code || p.product_code, value: p.id }));

  const fetchVendors = async () => {
    try {
      setVendorLoading(true);
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authorization token found");
      const res = await fetch(`${import.meta.env.VITE_SERVER_LINK}/vendors`, { method: "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const result = await res.json();
      if (result.success) setVendors(result.data); else setVendorError(result.message || 'Failed to fetch vendors');
    } catch (err) { setVendorError(err.message); } finally { setVendorLoading(false); }
  };

  const fetchCustomers = async () => {
    try {
      setCustomerLoading(true);
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authorization token found");
      const res = await fetch(`${import.meta.env.VITE_SERVER_LINK}/customer`, { method: "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const result = await res.json();
      if (result.success) setCustomers(result.data); else setCustomerError(result.message || 'Failed to fetch customers');
    } catch (err) { setCustomerError(err.message); } finally { setCustomerLoading(false); }
  };

  const fetchChartsOfAccounts = async () => {
    try {
      setCoaLoading(true);
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authorization token found");
      const res = await fetch(`${import.meta.env.VITE_SERVER_LINK}/charts_of_accounts`, { method: "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const result = await res.json();
      if (result.success) setChartsOfAccounts(result.data); else setCoaError(result.message || 'Failed to fetch charts of accounts');
    } catch (err) { setCoaError(err.message); } finally { setCoaLoading(false); }
  };

  const fetchProducts = async () => {
    try {
      setProductLoading(true);
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authorization token found");
      const res = await fetch(`${import.meta.env.VITE_SERVER_LINK}/product_service`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const result = await res.json();
      if (result.success) setProducts(result.data); else setProductError(result.message || 'Failed to fetch products');
    } catch (err) { setProductError(err.message); } finally { setProductLoading(false); }
  };

  useEffect(() => { fetchCustomers(); fetchChartsOfAccounts(); fetchProducts(); }, []);

  const addSalesItem = (isOther = false) => setSalesItems(prev => [...prev, { id: Date.now(), productId: '', productSearch: '', coa: '', coaSearch: '', description: '', unit: '', qty: 1, price: 0, discount: 0, vat: 0, wht: 0, responsibilityCenter: '', isOther }]);
  const addJournalEntry = () => setJournalEntries(prev => [...prev, { id: Date.now(), account: '', accountSearch: '', center: '', debit: 0, credit: 0 }]);
  const removeSalesItem = (id) => setSalesItems(prev => prev.filter(i => i.id !== id));
  const removeJournalEntry = (id) => setJournalEntries(prev => prev.filter(e => e.id !== id));
  const updateSalesItem = (id, field, value) => setSalesItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  const updateJournalEntry = (id, field, value) => setJournalEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  const addAttachment = () => setAttachments(prev => [...prev, { id: Date.now(), fileName: '', file: null, remarks: '', uploadedBy: 'Current User', date: new Date().toLocaleDateString() }]);
  const removeAttachment = (id) => setAttachments(prev => prev.filter(a => a.id !== id));

  const summary = computeSummary(salesItems);

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const inputBase = "w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all bg-gray-50 border border-gray-200 text-black focus:ring-1 focus:ring-red-500 text-center";
  const tableInput = "w-full bg-gray-50/50 rounded-md px-1 py-1 text-[13px] font-bold text-center outline-none focus:ring-1 focus:ring-red-400";
  const pctInput = tableInput + " pr-4";

  const fadeInUp = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

  const generateJournalEntries = () => {
    const entries = [];
    let totalCreditAmount = 0;

    let paymentAccount = '';

    if (modeOfPayment === 'CASH') {
      paymentAccount = chartsOfAccounts.find(a =>
        (a.name || '').toLowerCase().includes('cash on hand') ||
        (a.name || '').toLowerCase().includes('petty cash')
      );
    } else if (modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') {
      paymentAccount = chartsOfAccounts.find(a =>
        (a.name || '').toLowerCase().includes(bankName.toLowerCase())
      );

      if (!paymentAccount) {
        paymentAccount = chartsOfAccounts.find(a =>
          (a.name || '').toLowerCase().includes('cash in bank')
        );
      }
    }

    salesItems.forEach((item) => {
      const qty = parseFloat(item.qty) || 0;
      const price = parseFloat(item.price) || 0;
      const discountPct = parseFloat(item.discount) || 0;
      const vatPct = parseFloat(item.vat) || 0;
      const whtPct = parseFloat(item.wht) || 0;

      const gross = qty * price;
      const discountAmount = gross * (discountPct / 100);
      const discountedAmount = gross - discountAmount;
      const vatAmount = discountedAmount * (vatPct / 100);
      const whtAmount = discountedAmount * (whtPct / 100);
      const totalAmount = discountedAmount + vatAmount - whtAmount;

      totalCreditAmount += totalAmount;

      const selectedCoa = chartsOfAccounts.find(a => a.id === item.coa);

      if (selectedCoa && discountedAmount > 0) {
        entries.push({
          id: Date.now() + Math.random(),
          account: selectedCoa.id,
          accountSearch: selectedCoa.name,
          center: item.responsibilityCenter || '',
          debit: parseFloat(discountedAmount.toFixed(2)),
          credit: 0,
        });
      }

      if (vatAmount > 0) {
        const inputVatAccount = chartsOfAccounts.find(a =>
          (a.name || '').toLowerCase().includes('input vat')
        );

        if (inputVatAccount) {
          entries.push({
            id: Date.now() + Math.random(),
            account: inputVatAccount.id,
            accountSearch: inputVatAccount.name,
            center: item.responsibilityCenter || '',
            debit: parseFloat(vatAmount.toFixed(2)),
            credit: 0,
          });
        }
      }

      if (whtAmount > 0) {
        const whtAccount = chartsOfAccounts.find(a =>
          (a.name || '').toLowerCase().includes('withholding tax - expanded')
        );

        if (whtAccount) {
          entries.push({
            id: Date.now() + Math.random(),
            account: whtAccount.id,
            accountSearch: whtAccount.name,
            center: item.responsibilityCenter || '',
            debit: 0,
            credit: parseFloat(whtAmount.toFixed(2)),
          });
        }
      }

      if (discountAmount > 0) {
        const discountAccount = chartsOfAccounts.find(a =>
          (a.name || '').toLowerCase().includes('sales discounts')
        );

        if (discountAccount) {
          entries.push({
            id: Date.now() + Math.random(),
            account: discountAccount.id,
            accountSearch: discountAccount.name,
            center: item.responsibilityCenter || '',
            debit: 0,
            credit: parseFloat(discountAmount.toFixed(2)),
          });
        }
      }
    });

    if (paymentAccount && totalCreditAmount > 0) {
      entries.push({
        id: Date.now() + Math.random(),
        account: paymentAccount.id,
        accountSearch: paymentAccount.name,
        center: '',
        debit: 0,
        credit: parseFloat(totalCreditAmount.toFixed(2)),
      });
    }

    setJournalEntries(entries);
  };

  const handlePostTransaction = async () => {
    try {
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const createdBy = userData.mu_username || userData.username || 'Unknown User';

      if (!selectedCustomer) {
        setToast({ type: 'warning', message: 'Please select a customer' });
        return;
      }

      if (!modeOfPayment) {
        setToast({ type: 'warning', message: 'Please select mode of payment' });
        return;
      }

      if ((modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') && !bankName) {
        setToast({ type: 'warning', message: 'Please enter bank name' });
        return;
      }

      if (salesItems.length === 0 || (salesItems.length === 1 && salesItems[0].isOther)) {
        setToast({ type: 'warning', message: 'Please add at least one sales item' });
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        setToast({ type: 'error', message: 'No authorization token found. Please login again.' });
        return;
      }

      const preparedSalesItems = salesItems
        .filter(item => !item.isOther)
        .map(item => ({
          product_id: item.productId || null,
          account_id: item.coa || item.accountId,
          description: item.description,
          unit: item.unit || '',
          qty: parseFloat(item.qty) || 0,
          price: parseFloat(item.price) || 0,
          discount: parseFloat(item.discount) || 0,
          vat: parseFloat(item.vat) || 0,
          wtax: parseFloat(item.wht) || 0,
          responsibility_center: item.responsibilityCenter || ''
        }));

      const preparedJournalEntries = journalEntries
        .filter(entry => !entry.isOther)
        .map(entry => ({
          account_id: entry.account || entry.accountId,
          responsibility_center: entry.center || '',
          debit: parseFloat(entry.debit) || 0,
          credit: parseFloat(entry.credit) || 0
        }));

      const preparedAttachments = await Promise.all(
        attachments.map(async att => ({
          fileName: att.fileName,
          file: att.file ? await fileToBase64(att.file) : null,
          remarks: att.remarks,
          uploadedBy: att.uploadedBy,
          date: att.date
        }))
      );

      const salesData = {
        customer_id: selectedCustomer,
        document_reference: documentReference,
        payment_date: new Date().toISOString().split("T")[0],
        mode_of_payment: modeOfPayment,
        bank_name: bankName || "",
        check_number: checkNumber || "",
        category: category,
        remarks: remarks,
        total_amount_due: summary.totalAmountDue,
        created_by: createdBy,
        sales_items: preparedSalesItems,
        journal_entries: preparedJournalEntries,
        attachments: preparedAttachments
      };
      
      const response = await fetch(`${import.meta.env.VITE_SERVER_LINK}/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(salesData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.success) {
        const nextToast = { type: 'success', message: 'Sales created successfully!' };
        setToast(nextToast);
        if (onSuccess) await onSuccess(nextToast);
        onBack();
      } else {
        setToast({ type: 'error', message: result.message || 'Failed to create sales' });
      }

    } catch (error) {
      console.error('Error posting sales:', error);
      setToast({ type: 'error', message: 'Error: ' + error.message });
    }
  };

  useEffect(() => {
    generateJournalEntries();
  }, [salesItems, modeOfPayment, bankName, chartsOfAccounts]);
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
      `}} />

      {toast && (
        <DynamicToast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* TOP NAV */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <nav className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[2px] text-gray-400 cursor-pointer hover:text-black transition-colors" onClick={onBack}>
          <ArrowLeft size={17} /><span className="text-black">Back to Sales</span>
        </nav>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-gray-200 text-[12px] font-black text-gray-400 rounded-lg hover:bg-gray-50 transition-all uppercase">Save Draft</button>
          <button onClick={handlePostTransaction} className="px-6 py-2 bg-red-600 text-white text-[12px] font-black rounded-lg hover:bg-red-700 transition-all uppercase tracking-[2px] flex items-center gap-2 shadow-md shadow-red-200">
            <Save size={14} /> Post Transaction
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
              <div>
                <label className="text-[11px] font-black uppercase text-gray-400 block mb-1">Customer <span className="text-red-600">*</span></label>
                {customerLoading
                  ? <div className={inputBase + " text-gray-400 py-1.5"}>Loading customers…</div>
                  : <SearchableDropdown placeholder="Search customer..." value={customerSearch} onChange={v => { setCustomerSearch(v); setSelectedCustomer(''); }} onSelect={opt => { setSelectedCustomer(opt.value); setCustomerSearch(opt.label); }} options={customerOptions} inputClassName={inputBase} emptyText={customerError || 'No customers found'} />
                }
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SidebarInput label="Reference" placeholder="INV-000" value={documentReference} onChange={e => setDocumentReference(e.target.value)} />
                <SidebarInput label="Date" type="date" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-black uppercase text-gray-400 block mb-1">Mode of Payment</label>
                  <SearchableDropdown placeholder="Select mode..." value={modeSearch} onChange={v => { setModeSearch(v); setModeOfPayment(''); }} onSelect={opt => { setModeOfPayment(opt.value); setModeSearch(opt.label); }} options={modeOfPaymentOptions.map(m => ({ label: m, value: m }))} inputClassName={inputBase} emptyText="No modes found" />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase text-gray-400 block mb-1">Category</label>
                  <SearchableDropdown placeholder="Select category..." value={categorySearch} onChange={v => { setCategorySearch(v); setCategory(''); }} onSelect={opt => { setCategory(opt.value); setCategorySearch(opt.label); }} options={categoryOptions.map(c => ({ label: c, value: c }))} inputClassName={inputBase} emptyText="No categories found" />
                </div>
              </div>
              {(modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') && (
                <div className="grid grid-cols-2 gap-2">
                  <SidebarInput label="Bank Name" placeholder="Enter bank name" value={bankName} onChange={e => setBankName(e.target.value)} />
                  <SidebarInput label="Check #" placeholder="Enter check number" value={checkNumber} onChange={e => setCheckNumber(e.target.value)} />
                </div>
              )}
            </div>
          </section>

          {/* ── SUMMARY ── */}
          <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex-1 flex flex-col min-h-0">
            <h3 className="text-[12px] font-black uppercase tracking-[3px] text-gray-900 mb-2 flex items-center gap-2 flex-shrink-0">
              <Calculator size={12} /> Summary
            </h3>

            {/* Hint badge
            <div className="mb-2 flex-shrink-0 px-2 py-1 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-[9px] font-black uppercase tracking-wide text-amber-600 leading-snug">
                Disc / VAT / WHT are entered as&nbsp;<span className="text-red-500">%</span>&nbsp;values (e.g. 12 = 12%)
              </p>
            </div> */}

            {/* Scrollable rows */}
            <div className="overflow-y-auto min-h-0 flex-1">
              <div className="space-y-0">

                {/* 1. Total Sales Price = Σ(qty × price) */}
                <SummaryRow
                  label="Total Sales Price"
                  value={fmt(summary.totalSalesPrice)}
                  formula="Σ (Qty × Price)"
                />
                <SDivider />

                {/* 2. Total Discount = Σ(gross × disc%) */}
                <SummaryRow
                  label="Total Discount"
                  value={fmt(summary.totalDiscount)}
                  color="text-orange-500"
                  formula="Σ (Gross × Disc%)"
                />
                <SDivider />

                {/* 3. Total Discounted Amount = Σ(gross − discAmt) */}
                <SummaryRow
                  label="Total Discounted Amount"
                  value={fmt(summary.totalDiscounted)}
                  formula="Σ (Gross − Discount Amt)"
                />
                <SDivider />

                {/* 4. Total VAT = Σ(discounted × vat%) */}
                <SummaryRow
                  label="Total VAT"
                  value={fmt(summary.totalVAT)}
                  color="text-red-600"
                  formula="Σ (Discounted × VAT%)"
                />
                <SDivider />

                {/* 5. VATable Sales = Σ net-of-VAT base for vat>0 items */}
                <SummaryRow
                  label="VATable Sales"
                  value={fmt(summary.vatableSales)}
                  formula="Discounted ÷ (1 + VAT%) where VAT > 0"
                />
                <SDivider />

                {/* 6. VAT-Exempt = Σ discounted where vat=0 and wht=0 */}
                <SummaryRow
                  label="VAT-Exempt Sales"
                  value={fmt(summary.vatExemptSales)}
                  formula="Items with 0% VAT & 0% WHT"
                />
                <SDivider />

                {/* 7. Zero-Rated = Σ discounted where vat=0 but wht>0 */}
                <SummaryRow
                  label="Zero Rated Sales"
                  value={fmt(summary.zeroRatedSales)}
                  formula="Items with 0% VAT but WHT > 0"
                />
                <SDivider />

                {/* 8. Total No. VAT Discount = discount on vatable items only */}
                <SummaryRow
                  label="Total No. VAT Discount"
                  value={fmt(summary.totalNoVatDiscount)}
                  formula="Discount on VATable items (pre-VAT)"
                />
                <SDivider />

                {/* 9. Total Net of VAT = Σ (discounted / (1+vat%) or discounted) */}
                <SummaryRow
                  label="Total Net of VAT"
                  value={fmt(summary.totalNetOfVat)}
                  formula="VATable: Disc÷(1+VAT%); Others: Discounted"
                />
                <SDivider />

                {/* 10. Total WHT = Σ(discounted × wht%) */}
                <SummaryRow
                  label="Total Withholding Tax"
                  value={fmt(summary.totalWHT)}
                  color="text-blue-600"
                  formula="Σ (Discounted × WHT%)"
                />
              </div>
            </div>

            {/* Total Amount Due footer */}
            <div className="mt-3 flex-shrink-0">
              <div className="flex flex-col gap-[2px] mb-2">
                <div className="h-[2px] w-full bg-red-600 rounded-full" />
                <div className="h-[1px] w-full bg-black/10" />
              </div>
              {/* Formula hint */}
              <div className="mb-2 px-2 py-1 bg-red-50 rounded-lg border border-red-100 text-center">
                <p className="text-[9px] font-black uppercase tracking-wide text-red-400">
                  Discounted Amount + VAT − WHT
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[3px] mb-1">Total Amount Due</p>
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

            {/* 1. SALES ITEMS */}
            <TableSection title="Sales Items" icon={<Wallet size={14} />}>
              <div className="w-full flex flex-col gap-[2px] mb-3">
                <div className="h-[2px] w-full bg-red-600 rounded-full" />
                <div className="h-[1px] w-full bg-black/10" />
              </div>


              <div className="overflow-x-auto custom-table-scroller">
                <table className="w-full text-center min-w-[1100px]" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '5%' }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Product/Service', 'Charts of Accounts', 'Description', 'Unit', 'Qty', 'Price', 'Disc %', 'VAT %', 'WHT %', 'Resp. Center', ''].map((h, i) => (
                        <th key={i} className="pb-3 text-[12px] font-black uppercase text-gray-900 text-center px-1">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {salesItems.map((item) => (
                      <tr key={item.id} className={item.isOther ? 'bg-gray-50/30' : ''}>
                        <td className="py-1 px-1">
                          <SearchableDropdown
                            disabled={item.isOther}
                            placeholder="Search product..."
                            value={item.productSearch}
                            onChange={v => updateSalesItem(item.id, 'productSearch', v)}
                            onSelect={opt => { updateSalesItem(item.id, 'productId', opt.value); updateSalesItem(item.id, 'productSearch', opt.label); }}
                            options={productOptions}
                            inputClassName={`${tableInput} ${item.isOther ? 'bg-transparent text-gray-200 cursor-not-allowed' : ''}`}
                            emptyText={productError || 'No products found'}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <SearchableDropdown placeholder="Search account..." value={item.coaSearch} onChange={v => updateSalesItem(item.id, 'coaSearch', v)} onSelect={opt => { updateSalesItem(item.id, 'coa', opt.value); updateSalesItem(item.id, 'coaSearch', opt.label); }} options={coaOptions} inputClassName={tableInput} emptyText="No accounts found" />
                        </td>
                        <td className="py-1 px-1">
                          <input className={tableInput} placeholder="Details..." value={item.description} onChange={e => updateSalesItem(item.id, 'description', e.target.value)} />
                        </td>
                        <td className="py-1 px-1">
                          <input disabled={item.isOther} className={`${tableInput} ${item.isOther ? 'bg-transparent text-gray-200 cursor-not-allowed' : ''}`} placeholder={item.isOther ? '' : 'pc'} value={item.isOther ? '' : item.unit} onChange={e => updateSalesItem(item.id, 'unit', e.target.value)} />
                        </td>
                        <td className="py-1 px-1">
                          <input disabled={item.isOther} type="number" min="0" className={`${tableInput} ${item.isOther ? 'bg-transparent text-gray-200 cursor-not-allowed' : ''}`} placeholder={item.isOther ? '' : '1'} value={item.isOther ? '' : item.qty} onChange={e => updateSalesItem(item.id, 'qty', parseFloat(e.target.value) || 0)} />
                        </td>
                        <td className="py-1 px-1">
                          <input className={tableInput + ' font-black'} type="number" min="0" step="0.01" placeholder="0.00" value={item.price} onChange={e => updateSalesItem(item.id, 'price', parseFloat(e.target.value) || 0)} />
                        </td>
                        <td className="py-1 px-1">
                          <div className="relative">
                            <input className={pctInput + ' font-black'} type="number" min="0" max="100" step="0.01" placeholder="0" value={item.discount || 0} onChange={e => updateSalesItem(item.id, 'discount', parseFloat(e.target.value) || 0)} />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-black pointer-events-none">%</span>
                          </div>
                        </td>
                        <td className="py-1 px-1">
                          <div className="relative">
                            <input className={pctInput + ' font-black text-red-600'} type="number" min="0" max="100" step="0.01" placeholder="0" value={item.vat} onChange={e => updateSalesItem(item.id, 'vat', parseFloat(e.target.value) || 0)} />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-red-400 font-black pointer-events-none">%</span>
                          </div>
                        </td>
                        <td className="py-1 px-1">
                          <div className="relative">
                            <input className={pctInput + ' font-black text-blue-600'} type="number" min="0" max="100" step="0.01" placeholder="0" value={item.wht} onChange={e => updateSalesItem(item.id, 'wht', parseFloat(e.target.value) || 0)} />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-blue-400 font-black pointer-events-none">%</span>
                          </div>
                        </td>
                        <td className="py-1 px-1">
                          <input className={tableInput} placeholder="Select" value={item.responsibilityCenter} onChange={e => updateSalesItem(item.id, 'responsibilityCenter', e.target.value)} />
                        </td>
                        <td className="py-1 px-1 text-center">
                          <button onClick={() => removeSalesItem(item.id)} className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => addSalesItem(false)} className="flex-1 py-2 border-2 border-dashed border-gray-100 rounded-xl text-[11px] font-black uppercase text-gray-400 hover:border-red-200 hover:text-red-600 transition-all flex items-center justify-center gap-2">
                  <Plus size={14} /> ADD Product/Service
                </button>
                <button onClick={() => addSalesItem(true)} className="flex-1 py-2 border-2 border-dashed border-gray-100 rounded-xl text-[11px] font-black uppercase text-gray-400 hover:border-black hover:text-black transition-all flex items-center justify-center gap-2">
                  <Plus size={14} /> ADD Others
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
                    <col style={{ width: '6%' }} />
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
                          <SearchableDropdown placeholder="Search account..." value={entry.accountSearch} onChange={v => updateJournalEntry(entry.id, 'accountSearch', v)} onSelect={opt => { updateJournalEntry(entry.id, 'account', opt.value); updateJournalEntry(entry.id, 'accountSearch', opt.label); }} options={coaOptions} inputClassName={tableInput} emptyText="No accounts found" />
                        </td>
                        <td className="py-1.5 px-1"><input className={tableInput} placeholder="Center..." value={entry.center} onChange={e => updateJournalEntry(entry.id, 'center', e.target.value)} /></td>
                        <td className="py-1.5 px-1"><input className={tableInput + ' font-black'} placeholder="0.00" type="number" value={entry.debit} onChange={e => updateJournalEntry(entry.id, 'debit', parseFloat(e.target.value) || 0)} /></td>
                        <td className="py-1.5 px-1"><input className={tableInput + ' font-black text-red-600'} placeholder="0.00" type="number" value={entry.credit} onChange={e => updateJournalEntry(entry.id, 'credit', parseFloat(e.target.value) || 0)} /></td>
                        <td className="py-1.5 text-center">
                          <button className="p-1 text-red-600 transition-colors hover:bg-red-50 rounded" onClick={() => removeJournalEntry(entry.id)}>
                            <Trash2 size={15} className="mx-auto" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50/50">
                      <td colSpan={2} className="py-2 px-3 text-[12px] font-black uppercase text-black text-left">Balance Check</td>
                      <td className="py-2 px-1 text-center text-[13px] font-black">{fmt(journalEntries.reduce((s, e) => s + (parseFloat(e.debit) || 0), 0))}</td>
                      <td className="py-2 px-1 text-center text-[13px] font-black text-red-600">{fmt(journalEntries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0))}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <button onClick={addJournalEntry} className="mt-2 py-1.5 border-2 border-dashed border-gray-100 rounded-lg w-full text-[12px] font-black uppercase text-gray-400 hover:border-red-200 hover:text-red-600 transition-all flex items-center justify-center gap-1">
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
                      <col style={{ width: '20%' }} /><col style={{ width: '20%' }} /><col style={{ width: '25%' }} /><col style={{ width: '15%' }} /><col style={{ width: '15%' }} /><col style={{ width: '5%' }} />
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
                          <td className="py-2 px-1"><input className={tableInput} placeholder="e.g. Invoice_Scan" /></td>
                          <td className="py-2 px-1"><input type="file" className="text-[11px] font-bold text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-black file:text-white cursor-pointer w-full" /></td>
                          <td className="py-2 px-1"><input className={tableInput} placeholder="Add note..." /></td>
                          <td className="py-2 px-1 text-[12px] font-bold text-gray-600 italic">{file.uploadedBy}</td>
                          <td className="py-2 px-1 text-[12px] font-bold text-gray-600 tabular-nums">{file.date}</td>
                          <td className="py-2 text-center">
                            <button onClick={() => removeAttachment(file.id)} className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={15} /></button>
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
                <textarea className="w-full min-h-[100px] mt-4 p-4 bg-gray-50 border-none rounded-xl text-[14px] font-bold focus:ring-1 focus:ring-red-500 outline-none" placeholder="Enter justification or internal notes here..." value={remarks} onChange={e => setRemarks(e.target.value)} />
              </TableSection>
            </div>
          </motion.div>
        </main>
      </div>
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

/**
 * SummaryRow — shows label + computed value.
 * Hovering reveals the formula as a tooltip.
 */
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

function SidebarInput({ label, placeholder, type = 'text', required, dark, value, onChange }) {
  return (
    <div className="space-y-1">
      <label className={`text-[11px] font-black uppercase ${dark ? 'text-gray-500' : 'text-gray-400'} block`}>
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <input type={type} placeholder={placeholder} value={value} onChange={onChange} className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${dark ? 'bg-gray-900 border-gray-800 text-white focus:ring-red-600' : 'bg-gray-50 border-gray-200 text-black focus:ring-red-500'} border focus:ring-1`} />
    </div>
  );
}
