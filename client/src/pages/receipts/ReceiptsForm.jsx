import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Save, Plus, Trash2, Wallet,
  FileText, Paperclip, Calculator, Layers, Landmark, ChevronDown, Minus
} from 'lucide-react';
import ReactDOM from 'react-dom';
import DynamicToast from '../../components/DynamicToast';

// ─────────────────────────────────────────────────────────────────────────────
// Drag to Scroll Hook
// ─────────────────────────────────────────────────────────────────────────────
function useDragToScroll() {
  const ref = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleMouseDown = (e) => {
      setIsDragging(true);
      setStartX(e.pageX - element.offsetLeft);
      setScrollLeft(element.scrollLeft);
      element.style.cursor = 'grabbing';
      element.style.userSelect = 'none';
    };

    const handleMouseLeave = () => {
      setIsDragging(false);
      element.style.cursor = 'grab';
      element.style.userSelect = 'auto';
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      element.style.cursor = 'grab';
      element.style.userSelect = 'auto';
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const x = e.pageX - element.offsetLeft;
      const walk = (x - startX) * 2; // Adjust scroll speed
      element.scrollLeft = scrollLeft - walk;
    };

    // Add cursor style
    element.style.cursor = 'grab';

    element.addEventListener('mousedown', handleMouseDown);
    element.addEventListener('mouseleave', handleMouseLeave);
    element.addEventListener('mouseup', handleMouseUp);
    element.addEventListener('mousemove', handleMouseMove);

    return () => {
      element.removeEventListener('mousedown', handleMouseDown);
      element.removeEventListener('mouseleave', handleMouseLeave);
      element.removeEventListener('mouseup', handleMouseUp);
      element.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isDragging, startX, scrollLeft]);

  return ref;
}

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
function SearchableDropdown({ placeholder, value, onChange, onSelect, options, inputClassName, emptyText = 'No results found', disabled = false, onFocus }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const closeTimer = useRef(null);
  const filtered = options.filter(o => !value || o.label.toLowerCase().includes(value.toLowerCase()) || (o.sublabel || '').toLowerCase().includes(value.toLowerCase()));
  const handleBlur = () => { closeTimer.current = setTimeout(() => setOpen(false), 180); };
  const handleFocus = () => { 
    if (!disabled) { 
      clearTimeout(closeTimer.current); 
      setOpen(true); 
      if (onFocus) onFocus(); 
    } 
  };
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
    const discountValue = parseFloat(item.discount) || 0;
    const discountType = item.discountType || 'PERCENT';
    const vatPct = parseFloat(item.vatRate) || 0;
    const whtPct = parseFloat(item.whtRate) || 0;

    const gross = qty * price;
    
    // Calculate discount amount based on discount type
    let discAmt;
    if (discountType === 'PERCENT') {
      discAmt = gross * (discountValue / 100);
    } else {
      // FIXED amount - apply discount per unit, then multiply by quantity
      discAmt = discountValue * qty;
    }
    
    const discounted = gross - discAmt;
    const vatAmt = discounted * (vatPct / 100);
    const whtAmt = discounted * (whtPct / 100);

    // For VATable items: VATable Sales = Discounted Amount (VAT-exclusive pricing)
    // For non-VATable items: use discounted amount directly
    const netBase = vatPct > 0 ? discounted : discounted;

    totalSalesPrice += gross;
    totalDiscount += discAmt;
    totalDiscounted += discounted;
    totalVAT += vatAmt;
    totalWHT += whtAmt;
    totalNetOfVat += netBase;

    if (vatPct > 0) {
      vatableSales += discounted; // VATable Sales = Discounted Amount
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
export default function ReceiptsForm({ onBack, onSuccess, isViewMode = false, receiptData = null }) {
  const [receiptItems, setReceiptItems] = useState([
    { id: 1, productId: '', productSearch: '', coa: '', coaSearch: '', description: '', qty: 1, price: 0, discount: 0, discountType: 'PERCENT', vat: 0, vatSearch: '', vatRate: 0, wht: 0, whtSearch: '', whtRate: 0, responsibilityCenter: '', isOther: false }
  ]);

  const [journalEntries, setJournalEntries] = useState([
    { id: 1, account: '', accountSearch: '', center: '', debit: 0, credit: 0, isManual: false }
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

  const [vatOptions, setVatOptions] = useState([]);
  const [vatLoading, setVatLoading] = useState(false);
  const [vatError, setVatError] = useState('');

  const [whtOptions, setWhtOptions] = useState([]);
  const [whtLoading, setWhtLoading] = useState(false);
  const [whtError, setWhtError] = useState('');

  const [modeOfPayment, setModeOfPayment] = useState('');
  const [modeSearch, setModeSearch] = useState('');
  const [collectionDate, setCollectionDate] = useState('');
  const [bankName, setBankName] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [documentReference, setDocumentReference] = useState('');
  const [remarks, setRemarks] = useState('');

  const [attachments, setAttachments] = useState([]);

  const [toast, setToast] = useState(null);
  const [imageModal, setImageModal] = useState({ isOpen: false, imageSrc: '' });

  const modeOfPaymentOptions = ['CASH', 'CHECK', 'BANK_TRANSFER', 'CARD', 'E-WALLET', 'OTHERS'];

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

  const fetchVat = async () => {
    try {
      setVatLoading(true);
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authorization token found");
      const res = await fetch(`${import.meta.env.VITE_SERVER_LINK}/vat`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const result = await res.json();
      if (result.success) {
        const vatData = result.data.map(vat => ({
          label: `${vat.code} - ${vat.name}`,
          value: vat.id,
          rate: parseFloat(vat.rate),
          code: vat.code,
          name: vat.name
        }));
        setVatOptions(vatData);
      } else {
        setVatError(result.message || 'Failed to fetch VAT data');
      }
    } catch (err) { 
      setVatError(err.message); 
    } finally { 
      setVatLoading(false); 
    }
  };

  const fetchWht = async () => {
    try {
      setWhtLoading(true);
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authorization token found");
      const res = await fetch(`${import.meta.env.VITE_SERVER_LINK}/withholding_tax`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const result = await res.json();
      if (result.success) {
        const whtData = result.data.map(wht => ({
          label: `${wht.code} - ${wht.name}`,
          value: wht.id,
          rate: parseFloat(wht.rate),
          code: wht.code,
          name: wht.name
        }));
        setWhtOptions(whtData);
      } else {
        setWhtError(result.message || 'Failed to fetch WHT data');
      }
    } catch (err) { 
      setWhtError(err.message); 
    } finally { 
      setWhtLoading(false); 
    }
  };

  // Lazy loading functions
  const loadVatOnDemand = async () => {
    if (vatOptions.length === 0 && !vatLoading) {
      await fetchVat();
    }
  };

  const loadWhtOnDemand = async () => {
    if (whtOptions.length === 0 && !whtLoading) {
      await fetchWht();
    }
  };

  useEffect(() => { fetchCustomers(); fetchChartsOfAccounts(); fetchProducts(); }, []);

  // Populate form with receipt data when in view mode
  useEffect(() => {
    if (isViewMode && receiptData) {
      console.log('Populating form with receipt data:', receiptData);

      // Populate basic receipt info
      if (receiptData.data && receiptData.data.length > 0) {
        const receipt = receiptData.data[0];
        setSelectedCustomer(receipt.customer);
        setCustomerSearch(receipt.customer);
        setDocumentReference(receipt.doc_ref || '');
        setModeOfPayment(receipt.mode || '');
        setModeSearch(receipt.mode || '');
        setCollectionDate(receipt.collection_date || '');
        setBankName(receipt.bank_name || '');
        setCheckNumber(receipt.check_number || '');
        setRemarks(receipt.remarks || '');
      }

      // Populate receipt items
      if (receiptData.items && receiptData.items.length > 0) {
        const items = receiptData.items.map(item => ({
          id: item.id,
          productId: item.product_service_name,
          productSearch: item.product_service_name,
          coa: item.charts_of_accounts_name,
          coaSearch: item.charts_of_accounts_name,
          description: item.description || '',
          qty: item.quantity || 1,
          price: parseFloat(item.sales_price) || 0,
          discount: parseFloat(item.discount) || 0,
          discountType: item.discount_type || 'PERCENT',
          vat: parseFloat(item.vat_code) || 0,
          vatSearch: `${item.vat_code || ''} - ${item.vat_name || ''}`,
          vatRate: parseFloat(item.vat_rate) || 0,
          wht: parseFloat(item.withholding_tax_code) || 0,
          whtSearch: `${item.withholding_tax_code || ''} - ${item.withholding_tax_rate || ''} %`,
          whtRate: parseFloat(item.withholding_tax_rate) || 0,
          responsibilityCenter: item.responsibility_center || '',
          isOther: false
        }));
        setReceiptItems(items);
      }

      // Populate journal entries
      if (receiptData.journal && receiptData.journal.length > 0) {
        const journal = receiptData.journal.map(entry => ({
          id: entry.id,
          account: entry.charts_of_accounts_name,
          accountSearch: entry.charts_of_accounts_name,
          center: entry.responsibility_center || '',
          debit: entry.type === 'DEBIT' ? parseFloat(entry.amount) || 0 : 0,
          credit: entry.type === 'CREDIT' ? parseFloat(entry.amount) || 0 : 0,
          isManual: false
        }));
        setJournalEntries(journal);
      }

      // Populate attachments
      if (receiptData.attachments && receiptData.attachments.length > 0) {
        console.log('Processing attachments:', receiptData.attachments);
        const attachments = receiptData.attachments.map(att => {
          console.log('Processing attachment:', att.id, att.name, 'File data type:', typeof att.file, 'File data length:', att.file ? att.file.length : 'null');
          return {
            id: att.id,
            fileName: att.name || '',
            file: att.file || null, // Preserve base64 data from server for view mode
            remarks: att.remarks || '',
            uploadedBy: att.uploaded_by || 'Current User',
            date: att.uploaded_date || new Date().toLocaleDateString()
          };
        });
        console.log('Final attachments array:', attachments);
        setAttachments(attachments);
      }
    }
  }, [isViewMode, receiptData]);

  const addReceiptItem = (isOther = false) => setReceiptItems(prev => [...prev, { id: Date.now(), productId: '', productSearch: '', coa: '', coaSearch: '', description: '', qty: 1, price: 0, discount: 0, discountType: 'PERCENT', vat: 0, vatSearch: '', vatRate: 0, wht: 0, whtSearch: '', whtRate: 0, responsibilityCenter: '', isOther }]);
  const addJournalEntry = () => setJournalEntries(prev => [...prev, { id: Date.now(), account: '', accountSearch: '', center: '', debit: 0, credit: 0, isManual: true }]);
  const removeReceiptItem = (id) => setReceiptItems(prev => prev.filter(i => i.id !== id));
  const removeJournalEntry = (id) => setJournalEntries(prev => prev.filter(e => e.id !== id));
  const updateReceiptItem = (id, field, value) => setReceiptItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  const updateJournalEntry = (id, field, value) => setJournalEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  const addAttachment = () => setAttachments(prev => [...prev, { id: Date.now(), fileName: '', file: null, remarks: '', uploadedBy: 'Current User', date: new Date().toLocaleDateString() }]);
  const removeAttachment = (id) => setAttachments(prev => prev.filter(a => a.id !== id));
  const updateAttachment = (id, field, value) => setAttachments(prev => prev.map(att => att.id === id ? { ...att, [field]: value } : att));
  const handleFileChange = (id, file) => {
    if (file) {
      updateAttachment(id, 'fileName', file.name);
      updateAttachment(id, 'file', file);
    }
  };

  const summary = computeSummary(receiptItems);

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const inputBase = "w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all " +
    (isViewMode ? "bg-gray-100 border border-gray-300 text-black cursor-not-allowed" : "bg-gray-50 border border-gray-200 text-black focus:ring-1 focus:ring-red-500 text-center");
  const tableInput = "w-full rounded-md px-1 py-1 text-[13px] font-bold text-center outline-none " +
    (isViewMode ? "bg-gray-100 border border-gray-300 text-black! cursor-not-allowed" : "bg-gray-50/50 focus:ring-1 focus:ring-red-400");
  const pctInput = tableInput + " pr-1";

  const fadeInUp = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

  // Apply drag-to-scroll to receipt items table
  const receiptItemsScrollRef = useDragToScroll();

  const generateJournalEntries = () => {
    const entries = [];
    let totalCreditAmount = 0;

    let paymentAccount = '';

    if (modeOfPayment === 'CASH') {
      paymentAccount = chartsOfAccounts.find(a =>
        (a.name || '').toLowerCase().includes('cash on hand')
      );

      // Fallback: try 'petty cash' if 'cash on hand' not found
      if (!paymentAccount) {
        paymentAccount = chartsOfAccounts.find(a =>
          (a.name || '').toLowerCase().includes('petty cash')
        );
      }
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

    receiptItems.forEach((item) => {
      const qty = parseFloat(item.qty) || 0;
      const price = parseFloat(item.price) || 0;
      const discountValue = parseFloat(item.discount) || 0;
      const discountType = item.discountType || 'PERCENT';
      const vatPct = parseFloat(item.vatRate) || 0;
      const whtPct = parseFloat(item.whtRate) || 0;

      const gross = qty * price;
      
      // Calculate discount amount based on discount type
      let discountAmount;
      if (discountType === 'PERCENT') {
        discountAmount = gross * (discountValue / 100);
      } else {
        // FIXED amount - apply discount per unit, then multiply by quantity
        discountAmount = discountValue * qty;
      }
      
      const discountedAmount = gross - discountAmount;
      const vatAmount = discountedAmount * (vatPct / 100);
      const whtAmount = discountedAmount * (whtPct / 100);
      const totalAmount = discountedAmount + vatAmount - whtAmount;

      totalCreditAmount += totalAmount;

      const selectedCoa = chartsOfAccounts.find(a => a.id === item.coa);

      // Income account credited at GROSS amount (before discount) - Gross Method
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

      if (vatAmount > 0) {
        const outputVatAccount = chartsOfAccounts.find(a =>
          (a.name || '').toLowerCase().includes('output vat')
        );

        if (outputVatAccount) {
          entries.push({
            id: Date.now() + Math.random(),
            account: outputVatAccount.id,
            accountSearch: outputVatAccount.name,
            center: item.responsibilityCenter || '',
            debit: 0,
            credit: parseFloat(vatAmount.toFixed(2)),
            isManual: false,
          });
        }
      }

      if (whtAmount > 0) {
        const whtAccount = chartsOfAccounts.find(a =>
          (a.name || '').toLowerCase().includes('creditable withholding tax')
        );

        if (whtAccount) {
          entries.push({
            id: Date.now() + Math.random(),
            account: whtAccount.id,
            accountSearch: whtAccount.name,
            center: item.responsibilityCenter || '',
            debit: parseFloat(whtAmount.toFixed(2)),
            credit: 0,
            isManual: false,
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
            debit: parseFloat(discountAmount.toFixed(2)),
            credit: 0,
            isManual: false,
          });
        }
      }
    });

    // Calculate total cash amount: Discounted Amount + VAT - WHT
    const totalCashAmount = receiptItems.reduce((sum, item) => {
      const qty = parseFloat(item.qty) || 0;
      const price = parseFloat(item.price) || 0;
      const discountValue = parseFloat(item.discount) || 0;
      const discountType = item.discountType || 'PERCENT';
      const vatPct = parseFloat(item.vatRate) || 0;
      const whtPct = parseFloat(item.whtRate) || 0;

      const gross = qty * price;
      
      // Calculate discount amount based on discount type
      let discountAmount;
      if (discountType === 'PERCENT') {
        discountAmount = gross * (discountValue / 100);
      } else {
        // FIXED amount - apply discount per unit, then multiply by quantity
        discountAmount = discountValue * qty;
      }
      
      const discountedAmount = gross - discountAmount;
      const vatAmount = discountedAmount * (vatPct / 100);
      const whtAmount = discountedAmount * (whtPct / 100);

      return sum + (discountedAmount + vatAmount - whtAmount);
    }, 0);

    if (paymentAccount && totalCashAmount > 0) {
      entries.push({
        id: Date.now() + Math.random(),
        account: paymentAccount.id,
        accountSearch: paymentAccount.name,
        center: '',
        debit: parseFloat(totalCashAmount.toFixed(2)),
        credit: 0,
        isManual: false,
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

      // Check if there are valid items (either regular items with product OR Other items with required fields)
      const hasValidItems = receiptItems.some(item => {
        if (item.isOther) {
          // Other items are valid if they have description and charts of accounts
          return item.description.trim() !== '' && item.coa !== '';
        } else {
          // Regular items are valid if they have a product
          return item.productId !== '';
        }
      });

      if (!hasValidItems) {
        setToast({ type: 'warning', message: 'Please add at least one valid receipt item' });
        return;
      }

      // Check if journal entries are balanced
      const totalDebit = journalEntries.reduce((sum, entry) => sum + (parseFloat(entry.debit) || 0), 0);
      const totalCredit = journalEntries.reduce((sum, entry) => sum + (parseFloat(entry.credit) || 0), 0);
      
      if (Math.abs(totalDebit - totalCredit) > 0.01) { // Allow for small floating point differences
        setToast({ type: 'warning', message: 'Journal entries must be balanced. Total debits must equal total credits.' });
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        setToast({ type: 'error', message: 'No authorization token found. Please login again.' });
        return;
      }

      const preparedReceiptItems = receiptItems
        .map(item => ({
          product_id: item.isOther ? null : (item.productId || null),
          account_id: item.coa || item.accountId,
          description: item.description,
          qty: item.isOther ? 1 : (parseFloat(item.qty) || 0), // Other items default to qty 1
          price: parseFloat(item.price) || 0,
          discount: parseFloat(item.discount) || 0,
          discount_type: item.discountType || 'PERCENT',
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

      const receiptData = {
        customer_id: selectedCustomer,
        document_reference: documentReference,
        payment_date: collectionDate || new Date().toISOString().split("T")[0],
        collection_date: collectionDate || new Date().toISOString().split("T")[0],
        mode_of_payment: modeOfPayment,
        bank_name: bankName || "",
        check_number: checkNumber || "",
        remarks: remarks,
        total_amount_due: summary.totalAmountDue,
        created_by: createdBy,
        receipt_items: preparedReceiptItems,
        journal_entries: preparedJournalEntries,
        attachments: preparedAttachments
      };

      const response = await fetch(`${import.meta.env.VITE_SERVER_LINK}/receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(receiptData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.success) {
        const nextToast = { type: 'success', message: 'Receipt created successfully!' };
        setToast(nextToast);
        if (onSuccess) await onSuccess(nextToast);
        onBack();
      } else {
        setToast({ type: 'error', message: result.message || 'Failed to create receipt' });
      }

    } catch (error) {
      console.error('Error posting receipt:', error);
      setToast({ type: 'error', message: 'Error: ' + error.message });
    }
  };

  useEffect(() => {
    // Only auto-generate journal entries in add/edit mode, not in view mode
    if (!isViewMode) {
      generateJournalEntries();
    }
  }, [receiptItems, modeOfPayment, bankName, chartsOfAccounts, isViewMode]);
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
      <div className="flex items-center justify-between flex-shrink-0">
        <nav className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[2px] text-gray-400 cursor-pointer hover:text-black transition-colors" onClick={onBack}>
          <ArrowLeft size={17} /><span className="text-black">{isViewMode ? 'Back to Receipts' : 'Back to Receipts'}</span>
        </nav>
        {!isViewMode && (
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white border border-gray-200 text-[12px] font-black text-gray-400 rounded-lg hover:bg-gray-50 transition-all uppercase">Save Draft</button>
            <button onClick={handlePostTransaction} className="px-6 py-2 bg-red-600 text-white text-[12px] font-black rounded-lg hover:bg-red-700 transition-all uppercase tracking-[2px] flex items-center gap-2 shadow-md shadow-red-200">
              <Save size={14} /> Post Transaction
            </button>
          </div>
        )}
      </div>

      {/* BODY */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">

        {/* BASIC DETAILS - FULL WIDTH TOP */}
        <fieldset className="bg-black rounded-2xl p-3 pl-6 pr-6 text-white shadow-xl">
          <legend className="bg-red-600 text-[13px] font-black uppercase tracking-[3px] text-white flex items-center justify-center gap-2 px-4 py-1 rounded-lg mx-auto w-fit">
            <Landmark size={18} /> Basic Details
          </legend>
          <div className={`grid gap-3 ${(modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') ? 'grid-cols-6' : 'grid-cols-4'}`}>
            <div className="col-span-1">
              <fieldset>
                <legend className="text-[11px] font-black uppercase text-gray-100">Customer <span className="text-red-600">*</span></legend>
                {isViewMode ? (
                  <div className={inputBase + " text-black py-1.5"}>{customerSearch || 'No customer selected'}</div>
                ) : customerLoading ? (
                  <div className={inputBase + " text-black py-1.5"}>Loading customers...</div>
                ) : (
                  <SearchableDropdown placeholder="Customer *" value={customerSearch} onChange={v => { setCustomerSearch(v); setSelectedCustomer(''); }} onSelect={opt => { setSelectedCustomer(opt.value); setCustomerSearch(opt.label); }} options={customerOptions} inputClassName={inputBase} emptyText={customerError || 'No customers found'} />
                )}
              </fieldset>
            </div>
            <div className="col-span-1">
              <fieldset>
                <legend className="text-[11px] font-black uppercase text-gray-100">Reference Number</legend>
                <input
                  type="text"
                  placeholder="Reference"
                  value={documentReference}
                  onChange={e => setDocumentReference(e.target.value)}
                  disabled={isViewMode}
                  className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${isViewMode
                    ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed'
                    : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'
                    }`}
                />
              </fieldset>
            </div>
            <fieldset>
              <legend className="text-[11px] font-black uppercase text-gray-100">Mode of Payment</legend>
              {isViewMode ? (
                <div className={inputBase + " text-black py-1.5"}>{modeSearch || 'No mode selected'}</div>
              ) : (
                <SearchableDropdown placeholder="Mode *" value={modeSearch} onChange={v => { setModeSearch(v); setModeOfPayment(''); }} onSelect={opt => { setModeOfPayment(opt.value); setModeSearch(opt.label); }} options={modeOfPaymentOptions.map(m => ({ label: m, value: m }))} inputClassName={inputBase} emptyText="No modes found" />
              )}
            </fieldset>
            <fieldset>
              <legend className="text-[11px] font-black uppercase text-gray-100">Collection Date</legend>
              <input
                type="date"
                value={collectionDate}
                onChange={e => setCollectionDate(e.target.value)}
                disabled={isViewMode}
                className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${isViewMode
                  ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed'
                  : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'
                  }`}
              />
            </fieldset>
            {(modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') && (
              <fieldset>
                <legend className="text-[11px] font-black uppercase text-gray-100">Bank Name</legend>
                <input
                  type="text"
                  placeholder="Bank Name"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  disabled={isViewMode}
                  className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${isViewMode
                    ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed'
                    : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'
                    }`}
                />
              </fieldset>
            )}
            {(modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') && (
              <fieldset>
                <legend className="text-[11px] font-black uppercase text-gray-100">Check #</legend>
                <input
                  type="text"
                  placeholder="Check #"
                  value={checkNumber}
                  onChange={e => setCheckNumber(e.target.value)}
                  disabled={isViewMode}
                  className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${isViewMode
                    ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed'
                    : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'
                    }`}
                />
              </fieldset>
            )}
          </div>
        </fieldset>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex gap-2 min-h-0">

          {/* LEFT SIDEBAR - SUMMARY ONLY */}
          <aside className="w-full flex-shrink-0 flex flex-col gap-2 h-full overflow-y-auto sidebar-scroll max-w-[18%]">

            {/* ── SUMMARY ── */}
            <section className=" bg-white rounded-2xl border-2 border-red-100 shadow-xl shadow-red-500/5 flex-1 flex flex-col min-h-0 overflow-hidden">

              {/* Header: Solid Red with White Text */}
              <header className="bg-red-600 p-4 flex-shrink-0">
                <h3 className="text-[clamp(14px,1.4vw,16px)] font-black uppercase tracking-[3px] text-white flex items-center gap-2">
                  <Calculator size={16} className="shrink-0 text-white" />
                  Summary
                </h3>
              </header>

              {/* Scrollable rows */}
              <div className="custom-table-scroller overflow-y-auto min-h-0 flex-1 custom-scrollbar p-4 py-2">
                <div className="space-y-0">
                  <SummaryRow
                    label="Total Sales Price"
                    value={fmt(summary.totalSalesPrice)}
                  // formula="Σ (Qty × Price)" 
                  />
                  <SDivider />

                  <SummaryRow
                    label="Total Discount"
                    value={fmt(summary.totalDiscount)}
                    color="text-red-500" // Standardized to red theme
                  // formula="Σ (Gross × Disc%)"
                  />
                  <SDivider />

                  <SummaryRow
                    label="Total Discounted Amount"
                    value={fmt(summary.totalDiscounted)}
                  // formula="Σ (Gross − Discount Amt)"
                  />
                  <SDivider />

                  <SummaryRow
                    label="Total VAT"
                    value={fmt(summary.totalVAT)}
                    color="text-red-600"
                  // formula="Σ (Discounted × VAT%)"
                  />
                  <SDivider />

                  <SummaryRow
                    label="VATable Sales"
                    value={fmt(summary.vatableSales)}
                  // formula="Discounted Amount where VAT > 0"
                  />
                  <SDivider />

                  <SummaryRow
                    label="VAT-Exempt Sales"
                    value={fmt(summary.vatExemptSales)}
                  // formula="Items with 0% VAT & 0% WHT"
                  />
                  <SDivider />

                  <SummaryRow
                    label="Zero Rated Sales"
                    value={fmt(summary.zeroRatedSales)}
                  // formula="Items with 0% VAT but WHT > 0"
                  />
                  <SDivider />

                  <SummaryRow
                    label="Total No. VAT Discount"
                    value={fmt(summary.totalNoVatDiscount)}
                  // formula="Discount on VATable items (pre-VAT)"
                  />
                  <SDivider />

                  <SummaryRow
                    label="Total Net of VAT"
                    value={fmt(summary.totalNetOfVat)}
                  // formula="Discounted Amount (VAT-exclusive pricing)"
                  />
                  <SDivider />

                  <SummaryRow
                    label="Total Withholding Tax"
                    value={fmt(summary.totalWHT)}
                    color="text-red-700" // Darker red for contrast
                  // formula="Σ (Discounted × WHT%)"
                  />
                </div>
              </div>

              {/* Total Amount Due footer */}
              <div className="p-4 pt-0 flex-shrink-0">
                <div className="flex flex-col gap-[2px] mb-3">
                  <div className="h-[3px] w-full bg-red-600 rounded-full" />
                  <div className="h-[1px] w-full bg-gray-200" />
                </div>

                {/* Formula hint: Commented out as requested */}
                {/* <div className="mb-2 px-2 py-1.5 bg-red-50 rounded-lg border border-red-100 text-center">
                  <p className="text-[clamp(10px,1vw,11px)] font-black uppercase tracking-wide text-red-400">
                    Discounted Amount + VAT − WHT
                  </p>
                </div> */}

                <div className="text-center bg-red-500 rounded-xl py-3 border border-gray-100">
                  <p className="text-[clamp(11px,1.1vw,12px)] font-black text-gray-200 uppercase tracking-[4px] mb-1">
                    Total Cash Receipt
                  </p>

                  <p className="text-[clamp(22px,2.5vw,28px)] font-black text-white tracking-tighter leading-none flex items-baseline justify-center gap-2">
                    <span className="text-[clamp(12px,1.3vw,15px)] text-green-300 font-black">PHP</span>
                    {fmt(summary.totalAmountDue)}
                  </p>
                </div>
              </div>
            </section>
          </aside>

          {/* MAIN CONTENT */}
          <main className="flex-1 overflow-y-auto custom-table-scroller space-y-4 pr-1 min-h-0">
            <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="space-y-4">

              {/* 1. RECEIPT ITEMS */}
              <TableSection title="Receipt Items" icon={<Wallet size={14} />}>
                <div className="w-full flex flex-col gap-[2px] mb-3">
                  <div className="h-[2px] w-full bg-red-600 rounded-full" />
                  <div className="h-[1px] w-full bg-black/10" />
                </div>


                <div ref={receiptItemsScrollRef} className="overflow-x-auto custom-table-scroller">
                  <table className="w-full text-center min-w-[1000px]" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '6%' }} />
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '10%' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Product/Service', 'COA', 'Description', 'Qty', 'Price', 'Disc', 'Disc Type', 'VAT %', 'WHT %', 'Resp. Center', ''].map((h, i) => (
                          <th key={i} className="pb-3 text-[12px] font-black uppercase text-gray-900 text-center px-1">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {receiptItems.map((item) => (
                        <tr key={item.id} className={item.isOther ? 'bg-gray-50/30' : ''}>
                          <td className="py-1 px-1">
                            {item.isOther ? (
                              <div className="cursor-not-allowed text-center text-gray-400 text-[11px] italic py-2">
                                
                              </div>
                            ) : (
                              <SearchableDropdown
                                disabled={isViewMode}
                                placeholder="Search product..."
                                value={item.productSearch}
                                onChange={v => updateReceiptItem(item.id, 'productSearch', v)}
                                onSelect={opt => { updateReceiptItem(item.id, 'productId', opt.value); updateReceiptItem(item.id, 'productSearch', opt.label); }}
                                options={productOptions}
                                inputClassName={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                                emptyText={productError || 'No products found'}
                              />
                            )}
                          </td>
                          <td className="py-1 px-1">
                            <SearchableDropdown
                              disabled={isViewMode}
                              placeholder="Search account..."
                              value={item.coaSearch}
                              onChange={v => updateReceiptItem(item.id, 'coaSearch', v)}
                              onSelect={opt => { updateReceiptItem(item.id, 'coa', opt.value); updateReceiptItem(item.id, 'coaSearch', opt.label); }}
                              options={coaOptions}
                              inputClassName={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              emptyText="No accounts found"
                            />
                          </td>
                          <td className="py-1 px-1">
                            <input
                              disabled={isViewMode}
                              className={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              placeholder="Details..."
                              value={item.description}
                              onChange={e => updateReceiptItem(item.id, 'description', e.target.value)}
                            />
                          </td>
                          <td className="py-1 px-1">
                            <input
                              disabled={isViewMode || item.isOther}
                              type="number"
                              min="0"
                              className={`${tableInput} ${isViewMode || item.isOther ? 'bg-transparent text-gray-200 cursor-not-allowed' : ''}`}
                              placeholder={item.isOther ? '' : '1'}
                              value={item.isOther ? '' : (item.qty || '')}
                              onChange={e => updateReceiptItem(item.id, 'qty', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td className="py-1 px-1">
                            <input
                              disabled={isViewMode}
                              className={`${tableInput + ' font-black'} ${isViewMode ? 'bg-transparent text-gray-200 cursor-not-allowed' : ''}`}
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={item.price || ''}
                              onChange={e => updateReceiptItem(item.id, 'price', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td className="py-1 px-1">
                            <div className="relative">
                              <input
                                disabled={isViewMode}
                                className={`${pctInput + ' font-black'} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                                type="number"
                                min="0"
                                max={item.discountType === 'PERCENT' ? '100' : '999999'}
                                step="0.01"
                                placeholder="0"
                                value={item.discount || ''}
                                onChange={e => updateReceiptItem(item.id, 'discount', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                              />
                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-black pointer-events-none">
                                {item.discountType === 'PERCENT' ? '%' : '₱'}
                              </span>
                            </div>
                          </td>
                          <td className="py-1 px-1">
                            {isViewMode ? (
                              <div className={`${tableInput} text-black py-1.5 text-center`}>
                                {item.discountType === 'PERCENT' ? 'PERCENT' : 'FIXED'}
                              </div>
                            ) : (
                              <select
                                value={item.discountType || 'PERCENT'}
                                onChange={e => updateReceiptItem(item.id, 'discountType', e.target.value)}
                                className={`w-full px-2 py-1 text-[11px] font-bold border border-gray-200 rounded focus:ring-1 focus:ring-red-400 outline-none`}
                              >
                                <option value="PERCENT">PERCENT</option>
                                <option value="FIXED">FIXED</option>
                              </select>
                            )}
                          </td>
                          <td className="py-1 px-1">
                            {isViewMode ? (
                              <div className={`${tableInput} text-black py-1.5 text-center`}>
                                {item.vatSearch}
                              </div>
                            ) : (
                              <SearchableDropdown
                                placeholder="VAT Rate"
                                value={item.vatSearch}
                                onChange={v => updateReceiptItem(item.id, 'vatSearch', v)}
                                onSelect={opt => { 
                                  updateReceiptItem(item.id, 'vat', opt.value); 
                                  updateReceiptItem(item.id, 'vatSearch', opt.label); 
                                  updateReceiptItem(item.id, 'vatRate', opt.rate); 
                                }}
                                onFocus={loadVatOnDemand}
                                options={vatOptions}
                                inputClassName={`${pctInput + ' font-black text-red-600'}`}
                                emptyText={vatError || 'No VAT rates found'}
                                disabled={vatLoading}
                              />
                            )}
                          </td>
                          <td className="py-1 px-1">
                            {isViewMode ? (
                              <div className={`${tableInput} text-black py-1.5 text-center`}>
                                {item.whtSearch}
                              </div>
                            ) : (
                              <SearchableDropdown
                                placeholder="WHT Rate"
                                value={item.whtSearch}
                                onChange={v => updateReceiptItem(item.id, 'whtSearch', v)}
                                onSelect={opt => { 
                                  updateReceiptItem(item.id, 'wht', opt.value); 
                                  updateReceiptItem(item.id, 'whtSearch', opt.label); 
                                  updateReceiptItem(item.id, 'whtRate', opt.rate); 
                                }}
                                onFocus={loadWhtOnDemand}
                                options={whtOptions}
                                inputClassName={`${pctInput + ' font-black text-blue-600'}`}
                                emptyText={whtError || 'No WHT rates found'}
                                disabled={whtLoading}
                              />
                            )}
                          </td>
                          <td className="py-1 px-1">
                            <input
                              disabled={isViewMode}
                              className={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              placeholder="Select"
                              value={item.responsibilityCenter}
                              onChange={e => updateReceiptItem(item.id, 'responsibilityCenter', e.target.value)}
                            />
                          </td>
                          <td className="py-1 px-1 text-center">
                            {!isViewMode && (
                              <button onClick={() => removeReceiptItem(item.id)} className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors">
                                <Trash2 size={15} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!isViewMode && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => addReceiptItem(false)}
                      className="flex-1 py-2 border-2 border-dashed rounded-xl text-[11px] font-black uppercase border-red-300 text-red-600 transition-all duration-300 hover:bg-red-50 hover:border-red-500 hover:-translate-y-1 hover:shadow-lg hover:shadow-red-500/10 flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> ADD Product/Service
                    </button>

                    <button
                      onClick={() => addReceiptItem(true)}
                      className="flex-1 py-2 border-2 border-dashed rounded-xl text-[11px] font-black uppercase border-black text-black transition-all duration-300 hover:bg-gray-100 hover:border-gray-600 border-gray-400 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/5 flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> ADD Others
                    </button>
                  </div>
                )}
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
                      <col style={{ width: '35%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '22%' }} />
                      <col style={{ width: '6%' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Charts of Account', 'Debit', 'Credit', 'Responsibility Center', ''].map((h, i) => (
                          <th key={i} className="pb-3 text-[12px] font-black uppercase text-gray-900 text-center px-1">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {journalEntries.map((entry) => (
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
                              disabled={isViewMode || !entry.isManual}
                              className={`${tableInput + ' font-black'} ${isViewMode || !entry.isManual ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                              placeholder="0.00"
                              type="number"
                              value={entry.debit || ''}
                              onChange={e => updateJournalEntry(entry.id, 'debit', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                              readOnly={!entry.isManual}
                            />
                          </td>
                          <td className="py-1.5 px-1">
                            <input
                              disabled={isViewMode || !entry.isManual}
                              className={`${tableInput + ' font-black text-red-600'} ${isViewMode || !entry.isManual ? 'bg-transparent text-gray-200 cursor-not-allowed' : ''}`}
                              placeholder="0.00"
                              type="number"
                              value={entry.credit || ''}
                              onChange={e => updateJournalEntry(entry.id, 'credit', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                              readOnly={!entry.isManual}
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
                          <td className="py-1.5 text-center">
                            {!isViewMode && entry.isManual ? (
                              <button className="p-1 text-red-600 transition-colors hover:bg-red-50 rounded" onClick={() => removeJournalEntry(entry.id)}>
                                <Trash2 size={15} className="mx-auto" />
                              </button>
                            ) : (
                              <span className="text-gray-300 text-[11px] italic">{isViewMode ? '' : 'Auto'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50/50 border">
                        <td colSpan={1} className="py-2 px-3 text-[12px] font-black uppercase text-black text-left">Balance Check</td>
                        <td className="py-2 px-1 text-center text-[13px] font-black">{fmt(journalEntries.reduce((s, e) => s + (parseFloat(e.debit) || 0), 0))}</td>
                        <td className="py-2 px-1 text-center text-[13px] font-black text-red-600">{fmt(journalEntries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0))}</td>
                        <td />
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {!isViewMode && (
                  <button
                    onClick={addJournalEntry}
                    className="mt-2 py-1.5 border-2 border-dashed rounded-lg w-full text-[12px] font-black uppercase border-red-300 text-red-600 transition-all duration-300 hover:bg-red-50 hover:border-red-500 hover:-translate-y-1 hover:shadow-lg hover:shadow-red-500/10 flex items-center justify-center gap-1"
                  >
                    <Plus size={15} /> Add Ledger Row
                  </button>
                )}
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
                            <td className="py-2 px-1">
                              <input
                                disabled={isViewMode}
                                className={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                                placeholder="e.g. Invoice_Scan"
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
                                <button onClick={() => removeAttachment(file.id)} className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={15} /></button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!isViewMode && (
                    <button
                      onClick={addAttachment}
                      className="mt-2 py-1.5 border-2 border-dashed rounded-lg w-full text-[12px] font-black uppercase border-red-300 text-red-600 transition-all duration-300 hover:bg-red-50 hover:border-red-500 hover:-translate-y-1 hover:shadow-lg hover:shadow-red-500/10 flex items-center justify-center gap-1"
                    >
                      <Plus size={15} /> Add File
                    </button>
                  )}
                </TableSection>

                <TableSection title="Remarks" icon={<FileText size={14} />}>
                  <textarea
                    disabled={isViewMode}
                    className={`w-full min-h-[100px] mt-4 p-4 rounded-xl text-[14px] font-bold outline-none ${isViewMode
                      ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed resize-none'
                      : 'bg-gray-50 border-none focus:ring-1 focus:ring-red-500'
                      }`}
                    placeholder="Enter justification or internal notes here..."
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function TableSection({ title, icon, children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-red-50 text-red-600 rounded-lg">{icon}</div>
          <h2 className="text-[15px] font-black uppercase tracking-[1px] text-black">{title}</h2>
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          {isCollapsed ? (
            <>
              <Plus size={16} />
              <span className="text-[11px] font-black uppercase">Show</span>
            </>
          ) : (
            <>
              <Minus size={16} />
              <span className="text-[11px] font-black uppercase">Hide</span>
            </>
          )}
        </button>
      </div>
      
      {!isCollapsed && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}

function SDivider() {
  return <div className="h-[1px] w-full bg-gray-400" />;
}

/**
 * SummaryRow — shows label + computed value.
 * Hovering reveals the formula as a tooltip.
 */
function SummaryRow({ label, value, color = 'text-gray-800', formula }) {
  return (
    <div className="summary-row relative flex justify-between items-center hover:bg-gray-50 rounded-md transition-colors py-1.5 px-1 cursor-default">
      {/* Label: 10.5px -> ~12.5px */}
      <span className="text-[clamp(11px,1.1vw,12.5px)] font-black uppercase text-gray-500 leading-tight pr-1 flex-1">
        {label}
      </span>

      {/* Value: 12px -> ~14px */}
      <span className={`${color} text-[clamp(12px,1.25vw,14px)] font-black tabular-nums tracking-tight whitespace-nowrap text-right flex-shrink-0`}>
        {value}
      </span>

      {formula && (
        <div className="summary-tooltip absolute left-0 bottom-full mb-1 z-50 bg-gray-900 text-white text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-xl pointer-events-none">
          <span className="text-gray-300 font-medium">{formula}</span>
          <div className="absolute left-3 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

function SidebarInput({ label, placeholder, type = 'text', required, dark, value, onChange, disabled = false }) {
  return (
    <div className="space-y-1">
      <label className={`text-[11px] font-black uppercase ${dark ? 'text-gray-500' : 'text-gray-400'} block`}>
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${disabled
          ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed'
          : 'bg-white border border-gray-200 text-black focus:ring-1 focus:ring-red-500'
          }`}
      />
    </div>
  );
}
