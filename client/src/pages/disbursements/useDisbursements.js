import { useState, useEffect, useCallback, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Drag to Scroll Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useDragToScroll() {
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
      const walk = (x - startX) * 2;
      element.scrollLeft = scrollLeft - walk;
    };

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
// SUMMARY COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────
export function computeSummary(items) {
  let totalPurchasePrice = 0;
  let totalDiscount = 0;
  let totalDiscounted = 0;
  let totalVAT = 0;
  let vatablePurchases = 0;
  let vatExemptPurchases = 0;
  let zeroRatedPurchases = 0;
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

    let discAmt;
    if (discountType === 'PERCENT') {
      discAmt = gross * (discountValue / 100);
    } else {
      discAmt = discountValue * qty;
    }

    const discounted = gross - discAmt;
    const vatAmt = discounted * (vatPct / 100);
    const whtAmt = discounted * (whtPct / 100);

    totalPurchasePrice += gross;
    totalDiscount += discAmt;
    totalDiscounted += discounted;
    totalVAT += vatAmt;
    totalWHT += whtAmt;
    totalNetOfVat += discounted;

    if (vatPct > 0) {
      vatablePurchases += discounted;
      totalNoVatDiscount += discAmt;
    } else if (whtPct > 0) {
      zeroRatedPurchases += discounted;
    } else {
      vatExemptPurchases += discounted;
    }
  });

  return {
    totalPurchasePrice,
    totalDiscount,
    totalDiscounted,
    totalVAT,
    vatablePurchases,
    vatExemptPurchases,
    zeroRatedPurchases,
    totalNoVatDiscount,
    totalNetOfVat,
    totalWHT,
    totalAmountDue: totalDiscounted + totalVAT - totalWHT,
  };
}

export const fmt = (n) =>
  n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─────────────────────────────────────────────────────────────────────────────
// fileToBase64 utility
// ─────────────────────────────────────────────────────────────────────────────
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useDisbursementForm — main hook for CashDisbursementForm state & logic
// ─────────────────────────────────────────────────────────────────────────────
export function useDisbursementForm({ isViewMode, isEditMode, disbursementData, onBack, onSuccess }) {
  const [disbursementItems, setDisbursementItems] = useState([]);
  const [journalEntries, setJournalEntries] = useState([
    { id: 1, account: '', accountSearch: '', center: '', debit: 0, credit: 0, isManual: false }
  ]);

  const [vendors, setVendors] = useState([]);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [vendorError, setVendorError] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');

  const [chartsOfAccounts, setChartsOfAccounts] = useState([]);
  const [coaLoading, setCoaLoading] = useState(false);
  const [coaError, setCoaError] = useState('');

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
  const [bankName, setBankName] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [documentReference, setDocumentReference] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [remarks, setRemarks] = useState('');

  const [attachments, setAttachments] = useState([]);
  const [toast, setToast] = useState(null);
  const [imageModal, setImageModal] = useState({ isOpen: false, imageSrc: '' });

  // ── Derived option arrays ──
  const coaOptions = chartsOfAccounts.map(a => ({ label: a.name || a.account_name, sublabel: a.code || a.account_code, value: a.id }));
  const vendorOptions = vendors.map(v => ({ label: v.name || v.code, sublabel: v.code, value: v.id }));
  const productOptions = products.map(p => ({ label: p.name || p.product_name, sublabel: p.code || p.product_code, value: p.id }));

  // ── Fetch helpers ──
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
      const res = await fetch(`${import.meta.env.VITE_SERVER_LINK}/product_service`, { method: "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
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
      const res = await fetch(`${import.meta.env.VITE_SERVER_LINK}/vat`, { method: "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const result = await res.json();
      if (result.success) {
        setVatOptions(result.data.map(vat => ({ label: `${vat.code} - ${vat.name}`, value: vat.id, rate: parseFloat(vat.rate), code: vat.code, name: vat.name })));
      } else {
        setVatError(result.message || 'Failed to fetch VAT data');
      }
    } catch (err) { setVatError(err.message); } finally { setVatLoading(false); }
  };

  const fetchWht = async () => {
    try {
      setWhtLoading(true);
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authorization token found");
      const res = await fetch(`${import.meta.env.VITE_SERVER_LINK}/withholding_tax`, { method: "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const result = await res.json();
      if (result.success) {
        setWhtOptions(result.data.map(wht => ({ label: `${wht.code} - ${wht.name}`, value: wht.id, rate: parseFloat(wht.rate), code: wht.code, name: wht.name })));
      } else {
        setWhtError(result.message || 'Failed to fetch WHT data');
      }
    } catch (err) { setWhtError(err.message); } finally { setWhtLoading(false); }
  };

  const loadVatOnDemand = async () => {
    if (vatOptions.length === 0 && !vatLoading) await fetchVat();
  };

  const loadWhtOnDemand = async () => {
    if (whtOptions.length === 0 && !whtLoading) await fetchWht();
  };

  useEffect(() => { fetchVendors(); fetchChartsOfAccounts(); fetchProducts(); }, []);

  // ── Populate form in view/edit mode ──
  useEffect(() => {
    if ((isViewMode || isEditMode) && disbursementData) {
      const mainData = disbursementData.data ? disbursementData.data[0] : disbursementData;
      const itemsData = disbursementData.items || [];
      const journalData = disbursementData.journal || [];
      const attachmentsData = disbursementData.attachments || [];

      if (mainData && mainData.vendor_id) {
        setSelectedVendor(mainData.vendor_id);
        setVendorSearch(mainData.vendor);
      }

      setDocumentReference(mainData?.doc_ref || '');
      setModeOfPayment(mainData?.mode || '');
      setModeSearch(mainData?.mode || '');
      setBankName(mainData?.bank_name || '');
      setCheckNumber(mainData?.check_number || '');
      setPaymentDate(mainData?.payment_date || '');
      setRemarks(mainData?.remarks || '');

      if (itemsData.length > 0) {
        setDisbursementItems(itemsData.map(item => ({
          id: item.id,
          productId: item.product_service_id,
          productSearch: item.product_service_name,
          coa: item.charts_of_accounts_id,
          coaSearch: item.charts_of_accounts_name,
          description: item.description,
          qty: item.quantity,
          price: item.purchase_price,
          discount: item.discount,
          discountType: item.discount_type || 'PERCENT',
          vat: parseFloat(item.vat_id) || 0,
          vatSearch: `${item.vat_code || ''} - ${item.vat_name || ''}`,
          vatRate: parseFloat(item.vat_rate) || 0,
          wht: parseFloat(item.withholding_tax_id) || 0,
          whtSearch: `${item.withholding_tax_code || ''} - ${item.withholding_tax_rate || ''} %`,
          whtRate: parseFloat(item.withholding_tax_rate) || 0,
          responsibilityCenter: item.responsibility_center,
          isOther: false
        })));
      }

      if (journalData.length > 0) {
        setJournalEntries(journalData.map(entry => ({
          id: entry.id,
          account: entry.coa_id || entry.charts_of_accounts_id,
          accountSearch: entry.charts_of_accounts_name,
          center: entry.responsibility_center || '',
          debit: entry.type === 'DEBIT' ? parseFloat(entry.amount) || 0 : 0,
          credit: entry.type === 'CREDIT' ? parseFloat(entry.amount) || 0 : 0,
          isManual: false
        })));
      }

      if (attachmentsData.length > 0) {
        setAttachments(attachmentsData.map(att => {
          const attFile = typeof att.file === 'string' ? att.file : '';
          const attName = typeof att.name === 'string' ? att.name : '';
          const base64 = attFile.startsWith('data:image/') ? attFile : (attName.startsWith('data:image/') ? attName : null);
          const fileName = !attFile.startsWith('data:') && attFile ? attFile : (!attName.startsWith('data:') && attName ? attName : '');
          return {
            id: att.id,
            fileName,
            file: base64,
            remarks: att.remarks || '',
            uploadedBy: att.uploaded_by || 'Current User',
            date: att.uploaded_date || new Date().toLocaleDateString()
          };
        }));
      }
    }
  }, [isViewMode, isEditMode, disbursementData]);

  // ── Disbursement Items CRUD ──
  const addDisbursementItem = (isOther = false) =>
    setDisbursementItems(prev => [...prev, { id: Date.now(), productId: '', productSearch: '', coa: '', coaSearch: '', description: '', qty: 1, price: 0, discount: 0, discountType: 'PERCENT', vat: 0, vatSearch: '', vatRate: 0, wht: 0, whtSearch: '', whtRate: 0, responsibilityCenter: '', isOther, isNew: true }]);

  const removeDisbursementItem = (id) => setDisbursementItems(prev => prev.filter(i => i.id !== id));
  const updateDisbursementItem = (id, field, value) => setDisbursementItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));

  // ── Journal Entries CRUD ──
  const addJournalEntry = () =>
    setJournalEntries(prev => [...prev, { id: Date.now(), account: '', accountSearch: '', center: '', debit: 0, credit: 0, isManual: true }]);

  const removeJournalEntry = (id) => setJournalEntries(prev => prev.filter(e => e.id !== id));
  const updateJournalEntry = (id, field, value) => setJournalEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));

  // ── Attachments CRUD ──
  const addAttachment = () =>
    setAttachments(prev => [...prev, { id: Date.now(), fileName: '', file: null, remarks: '', uploadedBy: 'Current User', date: new Date().toLocaleDateString() }]);

  const removeAttachment = (id) => setAttachments(prev => prev.filter(a => a.id !== id));
  const updateAttachment = (id, field, value) => setAttachments(prev => prev.map(att => att.id === id ? { ...att, [field]: value } : att));

  const handleFileChange = (id, file) => {
    if (file) {
      updateAttachment(id, 'fileName', file.name);
      updateAttachment(id, 'file', file);
    }
  };

  // ── Helpers ──
  const hasNewDisbursementItems = () => disbursementItems.some(item => item.isNew);

  // ── Journal Auto-generation ──
  const generateJournalEntries = useCallback(() => {
    const entries = [];

    let paymentAccount = null;
    if (modeOfPayment === 'CASH') {
      paymentAccount = chartsOfAccounts.find(a => (a.name || '').toLowerCase().includes('cash on hand'))
        || chartsOfAccounts.find(a => (a.name || '').toLowerCase().includes('petty cash'));
    } else if (modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') {
      paymentAccount = chartsOfAccounts.find(a => (a.name || '').toLowerCase().includes(bankName.toLowerCase()))
        || chartsOfAccounts.find(a => (a.name || '').toLowerCase().includes('cash in bank'));
    }

    disbursementItems.forEach((item) => {
      const qty = parseFloat(item.qty) || 0;
      const price = parseFloat(item.price) || 0;
      const discountValue = parseFloat(item.discount) || 0;
      const discountType = item.discountType || 'PERCENT';
      const vatPct = parseFloat(item.vatRate) || 0;
      const whtPct = parseFloat(item.whtRate) || 0;
      const gross = qty * price;
      const discountAmount = discountType === 'PERCENT' ? gross * (discountValue / 100) : discountValue * qty;
      const discountedAmount = gross - discountAmount;
      const vatAmount = discountedAmount * (vatPct / 100);
      const whtAmount = discountedAmount * (whtPct / 100);

      const selectedCoa = chartsOfAccounts.find(a => a.id === item.coa);
      if (selectedCoa && gross > 0) {
        entries.push({ id: Date.now() + Math.random(), account: selectedCoa.id, accountSearch: selectedCoa.name, center: item.responsibilityCenter || '', debit: parseFloat(gross.toFixed(2)), credit: 0, isManual: false });
      }

      if (vatAmount > 0) {
        const inputVatAccount = chartsOfAccounts.find(a => (a.name || '').toLowerCase().includes('input vat'));
        if (inputVatAccount) {
          entries.push({ id: Date.now() + Math.random(), account: inputVatAccount.id, accountSearch: inputVatAccount.name, center: item.responsibilityCenter || '', debit: parseFloat(vatAmount.toFixed(2)), credit: 0, isManual: false });
        }
      }

      if (whtAmount > 0) {
        const whtAccount = chartsOfAccounts.find(a => (a.name || '').toLowerCase().includes('withholding tax - expanded'));
        if (whtAccount) {
          entries.push({ id: Date.now() + Math.random(), account: whtAccount.id, accountSearch: whtAccount.name, center: item.responsibilityCenter || '', debit: 0, credit: parseFloat(whtAmount.toFixed(2)), isManual: false });
        }
      }

      if (discountAmount > 0) {
        const discountAccount = chartsOfAccounts.find(a => (a.name || '').toLowerCase().includes('purchase discounts'));
        if (discountAccount) {
          entries.push({ id: Date.now() + Math.random(), account: discountAccount.id, accountSearch: discountAccount.name, center: item.responsibilityCenter || '', debit: 0, credit: parseFloat(discountAmount.toFixed(2)), isManual: false });
        }
      }
    });

    const totalCashPaid = disbursementItems.reduce((sum, item) => {
      const qty = parseFloat(item.qty) || 0;
      const price = parseFloat(item.price) || 0;
      const discountValue = parseFloat(item.discount) || 0;
      const discountType = item.discountType || 'PERCENT';
      const vatPct = parseFloat(item.vatRate) || 0;
      const whtPct = parseFloat(item.whtRate) || 0;
      const gross = qty * price;
      const discountAmount = discountType === 'PERCENT' ? gross * (discountValue / 100) : discountValue * qty;
      const discountedAmount = gross - discountAmount;
      const vatAmount = discountedAmount * (vatPct / 100);
      const whtAmount = discountedAmount * (whtPct / 100);
      return sum + (discountedAmount + vatAmount - whtAmount);
    }, 0);

    if (paymentAccount && totalCashPaid > 0) {
      entries.push({ id: Date.now() + Math.random(), account: paymentAccount.id, accountSearch: paymentAccount.name, center: '', debit: 0, credit: parseFloat(totalCashPaid.toFixed(2)), isManual: false });
    }

    setJournalEntries(entries);
  }, [disbursementItems, modeOfPayment, bankName, chartsOfAccounts]);

  useEffect(() => {
    if (!isViewMode) {
      if (!isEditMode || hasNewDisbursementItems()) {
        generateJournalEntries();
      }
    }
  }, [disbursementItems, modeOfPayment, bankName, chartsOfAccounts, isViewMode, isEditMode]);

  // ── Post / Submit ──
  const handlePostTransaction = async () => {
    try {
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const createdBy = userData.mu_username || userData.username || 'Unknown User';

      if (!selectedVendor) { setToast({ type: 'warning', message: 'Please select a vendor' }); return; }
      if (!modeOfPayment) { setToast({ type: 'warning', message: 'Please select mode of payment' }); return; }
      if ((modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') && !bankName) { setToast({ type: 'warning', message: 'Please enter bank name' }); return; }

      const token = localStorage.getItem('token');
      if (!token) { setToast({ type: 'error', message: 'No authorization token found. Please login again.' }); return; }

      const totalDebit = journalEntries.reduce((sum, e) => sum + (parseFloat(e.debit) || 0), 0);
      const totalCredit = journalEntries.reduce((sum, e) => sum + (parseFloat(e.credit) || 0), 0);
      if (Math.abs(totalDebit - totalCredit) > 0.01) { setToast({ type: 'warning', message: 'Journal entries must be balanced. Total debits must equal total credits.' }); return; }

      const summary = computeSummary(disbursementItems);

      const preparedDisbursementItems = disbursementItems.map(item => ({
        product_id: item.isOther ? null : (item.productId || null),
        account_id: item.coa || item.accountId,
        description: item.description,
        qty: item.isOther ? 1 : (parseFloat(item.qty) || 0),
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
        attachments
          .filter(att => att.file || att.fileName)
          .map(async att => ({
            id: att.id,
            fileName: att.fileName,
            file: att.file ? (typeof att.file === 'string' ? att.file : await fileToBase64(att.file)) : null,
            remarks: att.remarks,
            uploadedBy: att.uploadedBy,
            date: att.date
          }))
      );

      const mainData = disbursementData?.data ? disbursementData.data[0] : disbursementData;
      const disbursementId = mainData?.id;

      const requestData = {
        vendor_id: selectedVendor,
        document_reference: documentReference,
        payment_date: paymentDate || new Date().toISOString().split('T')[0],
        mode_of_payment: modeOfPayment,
        bank_name: bankName || '',
        check_number: checkNumber || '',
        remarks,
        total_amount_due: summary.totalAmountDue,
        disbursement_items: preparedDisbursementItems,
        journal_entries: preparedJournalEntries,
        attachments: preparedAttachments
      };

      if (isEditMode && disbursementId) {
        requestData.id = disbursementId;
        requestData.updated_by = createdBy;
      } else {
        requestData.created_by = createdBy;
      }

      const url = isEditMode && disbursementId
        ? `${import.meta.env.VITE_SERVER_LINK}/cash_disbursements/${disbursementId}`
        : `${import.meta.env.VITE_SERVER_LINK}/cash_disbursements`;

      const response = await fetch(url, {
        method: isEditMode && disbursementId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        const action = isEditMode ? 'updated' : 'created';
        const nextToast = { type: 'success', message: `Cash disbursement ${action} successfully!` };
        setToast(nextToast);
        if (onSuccess) await onSuccess(nextToast);
        onBack();
      } else {
        const action = isEditMode ? 'update' : 'create';
        setToast({ type: 'error', message: result.message || `Failed to ${action} cash disbursement` });
      }
    } catch (error) {
      console.error('Error posting cash disbursement:', error);
      setToast({ type: 'error', message: 'Error: ' + error.message });
    }
  };

  return {
    // state
    disbursementItems, journalEntries, attachments, toast, setToast, imageModal, setImageModal,
    vendors, vendorLoading, vendorError, selectedVendor, vendorSearch,
    setSelectedVendor, setVendorSearch,
    chartsOfAccounts, coaLoading, coaError,
    products, productLoading, productError,
    vatOptions, vatLoading, vatError,
    whtOptions, whtLoading, whtError,
    modeOfPayment, setModeOfPayment, modeSearch, setModeSearch,
    bankName, setBankName,
    checkNumber, setCheckNumber,
    documentReference, setDocumentReference,
    paymentDate, setPaymentDate,
    remarks, setRemarks,
    // derived
    coaOptions, vendorOptions, productOptions,
    // actions
    addDisbursementItem, removeDisbursementItem, updateDisbursementItem,
    addJournalEntry, removeJournalEntry, updateJournalEntry,
    addAttachment, removeAttachment, updateAttachment, handleFileChange,
    loadVatOnDemand, loadWhtOnDemand,
    handlePostTransaction,
    summary: computeSummary(disbursementItems),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Original useDisbursements hook (list-fetching)
// ─────────────────────────────────────────────────────────────────────────────
const useDisbursements = () => {
  const [disbursements, setDisbursements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetchDisbursements = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authorization token found");
      const response = await fetch(`${import.meta.env.VITE_SERVER_LINK}/cash_disbursements`, {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      if (result.success) { setDisbursements(result.data); } else { setError(result.message || 'Failed to fetch disbursements'); }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetchDisbursements(); }, [refetchDisbursements]);

  return { disbursements, loading, error, refetchDisbursements };
};

export default useDisbursements;