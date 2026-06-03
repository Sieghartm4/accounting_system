import { useState, useEffect, useRef, useCallback } from 'react'

export function useSales() {
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  const salesRef = useRef([])

  const prependSales = useCallback((sale) => {
    if (!sale || !sale.id) return

    setSales((prev) => {
      if (prev.some((row) => row.id === sale.id)) {
        return prev
      }
      const next = [sale, ...prev]
      salesRef.current = next
      return next
    })
  }, [])

  const LIMIT = 50

  const fetchSales = async (offset = 0, append = false) => {
    if (!append) {
      setLoading(true)
      setError(null)
    } else {
      setLoadingMore(true)
    }

    try {
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/sales?offset=${offset}&limit=${LIMIT}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch sales')
      }

      const data = Array.isArray(result.data) ? result.data : []

      if (append) {
        const next = [...(salesRef.current || []), ...data]
        salesRef.current = next
        setSales(next)
      } else {
        salesRef.current = data
        setSales(data)
      }

      setHasMore(Boolean(result.hasMore))
    } catch (err) {
      setError(err.message || 'Failed to load sales')
      if (!append) setSales([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const refetchSales = async () => fetchSales(0, false)

  const loadMore = async () => fetchSales(salesRef.current.length || 0, true)

  useEffect(() => {
    refetchSales()
  }, [])

  return {
    sales,
    loading,
    loadingMore,
    hasMore,
    error,
    refetchSales,
    loadMore,
    prependSales,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────
export function computeSummary(items, journalEntries = []) {
  let totalSalesPrice = 0
  let totalDiscount = 0
  let totalDiscounted = 0
  let totalVAT = 0
  let vatableSales = 0
  let vatExemptSales = 0
  let zeroRatedSales = 0
  let totalNoVatDiscount = 0
  let totalNetOfVat = 0
  let totalWHT = 0

  items.forEach((item) => {
    const qty = parseFloat(item.qty) || 0
    const price = parseFloat(item.price) || 0
    const discountValue = parseFloat(item.discount) || 0
    const discountType = item.discountType || 'PERCENT'
    const vatPct = parseFloat(item.vatRate) || 0
    const whtPct = parseFloat(item.whtRate) || 0

    const gross = qty * price
    let discAmt = 0

    if (discountType === 'PERCENT') {
      discAmt = gross * (discountValue / 100)
    } else {
      discAmt = discountValue
    }

    const discounted = gross - discAmt
    const vatAmt = discounted * (vatPct / 100)
    const whtAmt = discounted * (whtPct / 100)
    const netBase = discounted

    totalSalesPrice += gross
    totalDiscount += discAmt
    totalDiscounted += discounted
    totalVAT += vatAmt
    totalWHT += whtAmt
    totalNetOfVat += netBase

    if (vatPct > 0) {
      vatableSales += netBase
      totalNoVatDiscount += discAmt
    } else if (whtPct > 0) {
      zeroRatedSales += discounted
    } else {
      vatExemptSales += discounted
    }
  })

  let totalJournalDebit = 0
  let totalJournalCredit = 0

  journalEntries.forEach((entry) => {
    totalJournalDebit += parseFloat(entry.debit) || 0
    totalJournalCredit += parseFloat(entry.credit) || 0
  })

  const totalAmountDue = totalDiscounted + totalVAT - totalWHT

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
    totalAmountDue,
    totalJournalDebit,
    totalJournalCredit,
  }
}

export const fmt = (n) =>
  n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ─────────────────────────────────────────────────────────────────────────────
// Drag to Scroll Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useDragToScroll() {
  const ref = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const handleMouseDown = (e) => {
      setIsDragging(true)
      setStartX(e.pageX - element.offsetLeft)
      setScrollLeft(element.scrollLeft)
      element.style.cursor = 'grabbing'
      element.style.userSelect = 'none'
    }
    const handleMouseLeave = () => {
      setIsDragging(false)
      element.style.cursor = 'grab'
      element.style.userSelect = 'auto'
    }
    const handleMouseUp = () => {
      setIsDragging(false)
      element.style.cursor = 'grab'
      element.style.userSelect = 'auto'
    }
    const handleMouseMove = (e) => {
      if (!isDragging) return
      e.preventDefault()
      const x = e.pageX - element.offsetLeft
      const walk = (x - startX) * 2
      element.scrollLeft = scrollLeft - walk
    }

    element.style.cursor = 'grab'
    element.addEventListener('mousedown', handleMouseDown)
    element.addEventListener('mouseleave', handleMouseLeave)
    element.addEventListener('mouseup', handleMouseUp)
    element.addEventListener('mousemove', handleMouseMove)

    return () => {
      element.removeEventListener('mousedown', handleMouseDown)
      element.removeEventListener('mouseleave', handleMouseLeave)
      element.removeEventListener('mouseup', handleMouseUp)
      element.removeEventListener('mousemove', handleMouseMove)
    }
  }, [isDragging, startX, scrollLeft])

  return ref
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Sales Form Hook
// ─────────────────────────────────────────────────────────────────────────────
export default function useSalesForm({
  isViewMode,
  isEditMode,
  salesData,
  onBack,
  onSuccess,
} = {}) {
  const [salesItems, setSalesItems] = useState([])
  const [journalEntries, setJournalEntries] = useState([
    { id: 1, account: '', accountSearch: '', center: '', debit: 0, credit: 0 },
  ])

  const [customers, setCustomers] = useState([])
  const [customerLoading, setCustomerLoading] = useState(false)
  const [customerError, setCustomerError] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')

  const [vendors, setVendors] = useState([])
  const [vendorLoading, setVendorLoading] = useState(false)
  const [vendorError, setVendorError] = useState('')
  const [selectedVendor, setSelectedVendor] = useState('')
  const [vendorSearch, setVendorSearch] = useState('')

  const [chartsOfAccounts, setChartsOfAccounts] = useState([])
  const [coaLoading, setCoaLoading] = useState(false)
  const [coaError, setCoaError] = useState('')
  const [coaSearch, setCoaSearch] = useState('')

  const [products, setProducts] = useState([])
  const [productLoading, setProductLoading] = useState(false)
  const [productError, setProductError] = useState('')

  const [vatOptions, setVatOptions] = useState([])
  const [vatLoading, setVatLoading] = useState(false)
  const [vatError, setVatError] = useState('')

  const [whtOptions, setWhtOptions] = useState([])
  const [whtLoading, setWhtLoading] = useState(false)
  const [whtError, setWhtError] = useState('')

  const [modeOfPayment, setModeOfPayment] = useState('')
  const [modeSearch, setModeSearch] = useState('')
  const [bankName, setBankName] = useState('')
  const [checkNumber, setCheckNumber] = useState('')
  const [category, setCategory] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [documentReference, setDocumentReference] = useState('')
  const [terms, setTerms] = useState('')
  const [termsOption, setTermsOption] = useState('DAYS')
  const [termsNumber, setTermsNumber] = useState('')
  const [dateDelivered, setDateDelivered] = useState('')
  const [dateDue, setDateDue] = useState('')
  const [remarks, setRemarks] = useState('')
  const [attachments, setAttachments] = useState([])
  const [toast, setToast] = useState(null)
  const [imageModal, setImageModal] = useState({ isOpen: false, imageSrc: '' })

  // ── Derived option arrays ──────────────────────────────────────────────────
  const coaOptions = chartsOfAccounts.map((a) => ({
    label: a.name || a.account_name,
    sublabel: a.code || a.account_code,
    value: a.id,
  }))
  const vendorOptions = vendors.map((v) => ({
    label: v.name || v.code,
    sublabel: v.code,
    value: v.id,
  }))
  const customerOptions = customers.map((c) => ({
    label: c.name || c.customer_name,
    sublabel: c.code,
    value: c.id,
  }))
  const productOptions = products.map((p) => ({
    label: p.name || p.product_name,
    sublabel: p.code || p.product_code,
    value: p.id,
  }))

  // ── Fetch functions ────────────────────────────────────────────────────────
  const fetchVendors = async () => {
    try {
      setVendorLoading(true)
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(`${import.meta.env.VITE_SERVER_LINK}/vendors`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const result = await res.json()
      if (result.success) setVendors(result.data)
      else setVendorError(result.message || 'Failed to fetch vendors')
    } catch (err) {
      setVendorError(err.message)
    } finally {
      setVendorLoading(false)
    }
  }

  const fetchCustomers = async () => {
    try {
      setCustomerLoading(true)
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(`${import.meta.env.VITE_SERVER_LINK}/customer`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const result = await res.json()
      if (result.success) setCustomers(result.data)
      else setCustomerError(result.message || 'Failed to fetch customers')
    } catch (err) {
      setCustomerError(err.message)
    } finally {
      setCustomerLoading(false)
    }
  }

  const fetchChartsOfAccounts = async () => {
    try {
      setCoaLoading(true)
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/charts_of_accounts`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const result = await res.json()
      if (result.success) setChartsOfAccounts(result.data)
      else setCoaError(result.message || 'Failed to fetch charts of accounts')
    } catch (err) {
      setCoaError(err.message)
    } finally {
      setCoaLoading(false)
    }
  }

  const fetchProducts = async () => {
    try {
      setProductLoading(true)
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/product_service`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const result = await res.json()
      if (result.success) setProducts(result.data)
      else setProductError(result.message || 'Failed to fetch products')
    } catch (err) {
      setProductError(err.message)
    } finally {
      setProductLoading(false)
    }
  }

  const fetchVat = async () => {
    try {
      setVatLoading(true)
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(`${import.meta.env.VITE_SERVER_LINK}/vat`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const result = await res.json()
      if (result.success) {
        setVatOptions(
          result.data.map((vat) => ({
            label: `${vat.code} - ${vat.name}`,
            value: vat.id,
            rate: parseFloat(vat.rate),
            code: vat.code,
            name: vat.name,
          })),
        )
      } else {
        setVatError(result.message || 'Failed to fetch VAT data')
      }
    } catch (err) {
      setVatError(err.message)
    } finally {
      setVatLoading(false)
    }
  }

  const fetchWht = async () => {
    try {
      setWhtLoading(true)
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/withholding_tax`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const result = await res.json()
      if (result.success) {
        setWhtOptions(
          result.data.map((wht) => ({
            label: `${wht.code} - ${wht.name}`,
            value: wht.id,
            rate: parseFloat(wht.rate),
            code: wht.code,
            name: wht.name,
          })),
        )
      } else {
        setWhtError(result.message || 'Failed to fetch WHT data')
      }
    } catch (err) {
      setWhtError(err.message)
    } finally {
      setWhtLoading(false)
    }
  }

  const loadVatOnDemand = async () => {
    if (vatOptions.length === 0 && !vatLoading) await fetchVat()
  }

  const loadWhtOnDemand = async () => {
    if (whtOptions.length === 0 && !whtLoading) await fetchWht()
  }

  // ── Item / entry / attachment mutators ────────────────────────────────────
  const addSalesItem = (isOther = false) =>
    setSalesItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        productId: '',
        productSearch: '',
        coa: '',
        coaSearch: '',
        description: '',
        qty: 1,
        price: 0,
        discount: 0,
        discountType: 'PERCENT',
        vat: 0,
        vatSearch: '',
        vatRate: 0,
        wht: 0,
        whtSearch: '',
        whtRate: 0,
        responsibilityCenter: '',
        isOther,
        isNew: true,
      },
    ])

  const addJournalEntry = () =>
    setJournalEntries((prev) => [
      ...prev,
      {
        id: Date.now(),
        account: '',
        accountSearch: '',
        center: '',
        debit: 0,
        credit: 0,
        isManual: true,
      },
    ])

  const removeSalesItem = (id) =>
    setSalesItems((prev) => prev.filter((i) => i.id !== id))
  const removeJournalEntry = (id) =>
    setJournalEntries((prev) => prev.filter((e) => e.id !== id))

  const updateSalesItem = (id, field, value) =>
    setSalesItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    )

  const updateJournalEntry = (id, field, value) =>
    setJournalEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    )

  const addAttachment = () =>
    setAttachments((prev) => [
      ...prev,
      {
        id: Date.now(),
        fileName: '',
        file: null,
        remarks: '',
        uploadedBy: 'Current User',
        date: new Date().toLocaleDateString(),
      },
    ])

  const removeAttachment = (id) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id))

  const updateAttachment = (id, field, value) =>
    setAttachments((prev) =>
      prev.map((att) => (att.id === id ? { ...att, [field]: value } : att)),
    )

  const handleFileChange = (id, file) => {
    if (file) {
      updateAttachment(id, 'fileName', file.name)
      updateAttachment(id, 'file', file)
    }
  }

  // ── Utilities ─────────────────────────────────────────────────────────────
  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result)
      reader.onerror = (error) => reject(error)
    })

  const buildAutoJournalEntries = () => {
    const entries = []
    let totalDebitAmount = 0
    let totalCreditAmount = 0
    let totalDiscountedAmount = 0
    let totalVatAmount = 0
    let totalWhtAmount = 0
    let totalDiscountAmount = 0

    const getAccountName = (account) =>
      (account.name || account.account_name || '').toLowerCase()

    salesItems.forEach((item) => {
      const qty = parseFloat(item.qty) || 0
      const price = parseFloat(item.price) || 0
      const discountValue = parseFloat(item.discount) || 0
      const discountType = item.discountType || 'PERCENT'
      const vatPct = parseFloat(item.vatRate) || 0
      const whtPct = parseFloat(item.whtRate) || 0

      const gross = qty * price
      const discountAmount =
        discountType === 'PERCENT' ? gross * (discountValue / 100) : discountValue
      const discountedAmount = gross - discountAmount
      const vatAmount = discountedAmount * (vatPct / 100)
      const whtAmount = discountedAmount * (whtPct / 100)

      totalDiscountAmount += discountAmount
      totalDiscountedAmount += discountedAmount
      totalVatAmount += vatAmount
      totalWhtAmount += whtAmount
    })

    const arAccount = chartsOfAccounts.find((a) =>
      getAccountName(a).includes('accounts receivable'),
    )
    if (arAccount && totalDiscountedAmount > 0) {
      const arAmount = totalDiscountedAmount + totalVatAmount - totalWhtAmount
      entries.push({
        id: Date.now() + Math.random(),
        account: arAccount.id,
        accountSearch: arAccount.name || arAccount.account_name || '',
        center: salesItems[0]?.responsibilityCenter || '',
        debit: parseFloat(arAmount.toFixed(2)),
        credit: 0,
        isManual: false,
      })
      totalDebitAmount += arAmount
    }

    if (totalDiscountAmount > 0) {
      const discountAccount = chartsOfAccounts.find((a) =>
        getAccountName(a).includes('sales discounts'),
      )
      if (discountAccount) {
        entries.push({
          id: Date.now() + Math.random(),
          account: discountAccount.id,
          accountSearch: discountAccount.name || discountAccount.account_name || '',
          center: salesItems[0]?.responsibilityCenter || '',
          debit: parseFloat(totalDiscountAmount.toFixed(2)),
          credit: 0,
          isManual: false,
        })
        totalDebitAmount += totalDiscountAmount
      }
    }

    if (totalWhtAmount > 0) {
      const whtAccount = chartsOfAccounts.find((a) => {
        const name = getAccountName(a)
        return (
          name.includes('creditable withholding tax') ||
          name.includes('creditable witholding tax')
        )
      })
      if (whtAccount) {
        entries.push({
          id: Date.now() + Math.random(),
          account: whtAccount.id,
          accountSearch: whtAccount.name || whtAccount.account_name || '',
          center: salesItems[0]?.responsibilityCenter || '',
          debit: parseFloat(totalWhtAmount.toFixed(2)),
          credit: 0,
          isManual: false,
        })
        totalDebitAmount += totalWhtAmount
      }
    }

    salesItems.forEach((item) => {
      if (item.coa) {
        const selectedCoa = chartsOfAccounts.find((a) => a.id === item.coa)
        const gross = (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0)
        if (selectedCoa && gross > 0) {
          entries.push({
            id: Date.now() + Math.random(),
            account: selectedCoa.id,
            accountSearch: selectedCoa.name || selectedCoa.account_name || '',
            center: item.responsibilityCenter || '',
            debit: 0,
            credit: parseFloat(gross.toFixed(2)),
            isManual: false,
          })
          totalCreditAmount += gross
        }
      }
    })

    if (totalVatAmount > 0) {
      const outputVatAccount = chartsOfAccounts.find((a) =>
        getAccountName(a).includes('output vat'),
      )
      if (outputVatAccount) {
        entries.push({
          id: Date.now() + Math.random(),
          account: outputVatAccount.id,
          accountSearch:
            outputVatAccount.name || outputVatAccount.account_name || '',
          center: salesItems[0]?.responsibilityCenter || '',
          debit: 0,
          credit: parseFloat(totalVatAmount.toFixed(2)),
          isManual: false,
        })
        totalCreditAmount += totalVatAmount
      }
    }

    return entries
  }

  const regenerateJournalEntries = () => {
    const manualEntries = journalEntries.filter((e) => e.isManual)
    setJournalEntries([...buildAutoJournalEntries(), ...manualEntries])
  }

  const handlePostTransaction = async () => {
    try {
      const userData = JSON.parse(localStorage.getItem('user') || '{}')
      const createdBy = userData.mu_username || userData.username || 'Unknown User'

      if (!selectedCustomer) {
        setToast({ type: 'warning', message: 'Please select a customer' })
        return
      }
      if (!termsOption || !termsNumber) {
        setToast({
          type: 'warning',
          message: 'Please enter terms option and number',
        })
        return
      }
      if (!dateDelivered) {
        setToast({ type: 'warning', message: 'Please enter date delivered' })
        return
      }
      if (!dateDue) {
        setToast({ type: 'warning', message: 'Please enter date due' })
        return
      }

      const hasValidItems = salesItems.some((item) =>
        item.isOther
          ? item.description.trim() !== '' && item.coa !== ''
          : item.productId !== '',
      )
      if (!hasValidItems) {
        setToast({
          type: 'warning',
          message: 'Please add at least one valid sales item',
        })
        return
      }

      const token = localStorage.getItem('token')
      if (!token) {
        setToast({
          type: 'error',
          message: 'No authorization token found. Please login again.',
        })
        return
      }

      const summary = computeSummary(salesItems, journalEntries)
      if (Math.abs(summary.totalJournalDebit - summary.totalJournalCredit) > 0.01) {
        setToast({
          type: 'warning',
          message:
            'Journal entries must be balanced. Total debits must equal total credits.',
        })
        return
      }

      const preparedSalesItems = salesItems.map((item) => ({
        id: item.isNew ? undefined : item.id,
        product_id: item.isOther ? null : item.productId || null,
        account_id: item.coa || item.accountId,
        description: item.description,
        qty: item.isOther ? 1 : parseFloat(item.qty) || 0,
        price: parseFloat(item.price) || 0,
        discount: parseFloat(item.discount) || 0,
        discount_type: item.discountType || 'PERCENT',
        vat: parseInt(item.vat) || 0,
        wtax: parseInt(item.wht) || 0,
        responsibility_center: item.responsibilityCenter || '',
      }))

      const preparedJournalEntries = journalEntries
        .filter((entry) => !entry.isOther)
        .map((entry) => ({
          account_id: entry.account || entry.accountId,
          responsibility_center: entry.center || '',
          debit: parseFloat(entry.debit) || 0,
          credit: parseFloat(entry.credit) || 0,
        }))

      const preparedAttachments = await Promise.all(
        attachments
          .filter((att) => att.file || att.fileName)
          .map(async (att) => ({
            id: att.id,
            fileName: att.fileName,
            file: att.file
              ? typeof att.file === 'string'
                ? att.file
                : await fileToBase64(att.file)
              : null,
            remarks: att.remarks,
            uploadedBy: att.uploadedBy,
            date: att.date,
          })),
      )

      const mainData = salesData?.data ? salesData.data[0] : salesData
      const salesId = mainData?.id

      const requestData = {
        customer_id: selectedCustomer,
        document_reference: documentReference,
        terms: `${termsNumber} ${termsOption}`,
        date_delivered: dateDelivered,
        date_due: dateDue,
        remarks,
        total_amount_due: summary.totalAmountDue,
        sales_items: preparedSalesItems,
        journal_entries: preparedJournalEntries,
        attachments: preparedAttachments,
      }

      if (isEditMode && salesId) {
        requestData.id = salesId
        requestData.updated_by = createdBy
      } else {
        requestData.created_by = createdBy
      }

      const url =
        isEditMode && salesId
          ? `${import.meta.env.VITE_SERVER_LINK}/sales/${salesId}`
          : `${import.meta.env.VITE_SERVER_LINK}/sales`
      const method = isEditMode && salesId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`,
        )
      }

      const result = await response.json()

      if (result.success) {
        const action = isEditMode ? 'updated' : 'created'
        const nextToast = {
          type: 'success',
          message: `Sales ${action} successfully!`,
        }
        setToast(nextToast)
        if (onSuccess) await onSuccess(nextToast)
        onBack()
      } else {
        const action = isEditMode ? 'update' : 'create'
        setToast({
          type: 'error',
          message: result.message || `Failed to ${action} sales`,
        })
      }
    } catch (error) {
      console.error('Error posting sales:', error)
      setToast({ type: 'error', message: 'Error: ' + error.message })
    }
  }

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchCustomers()
    fetchChartsOfAccounts()
    fetchProducts()
  }, [])

  useEffect(() => {
    if ((isViewMode || isEditMode) && salesData) {
      const mainData = salesData.data ? salesData.data[0] : salesData
      const itemsData = salesData.items || []
      const journalData = salesData.journal || []
      const attachmentsData = salesData.attachments || []

      if (mainData?.customer) {
        setCustomerSearch(mainData.customer)
        setSelectedCustomer(mainData.customer_id || '')
      }

      setDocumentReference(mainData?.doc_ref || '')

      if (mainData?.terms) {
        const termsParts = mainData.terms.trim().split(' ')
        if (termsParts.length >= 2) {
          setTermsNumber(termsParts[0])
          setTermsOption(termsParts.slice(1).join(' '))
        } else {
          setTermsNumber('')
          setTermsOption(mainData.terms)
        }
      } else {
        setTermsNumber('')
        setTermsOption('')
      }

      setDateDelivered(mainData?.date_delivered || '')
      setDateDue(mainData?.date_due || '')
      setRemarks(mainData?.remarks || '')

      if (itemsData.length > 0) {
        setSalesItems(
          itemsData.map((item) => ({
            id: item.id,
            productId: item.product_service_id,
            productSearch: item.product_service_name,
            coa: item.charts_of_accounts_id,
            coaSearch: item.charts_of_accounts_name,
            description: item.description,
            qty: item.quantity,
            price: item.sales_price,
            discount: item.discount,
            discountType: item.discount_type || 'PERCENT',
            vat: parseInt(item.vat_id) || 0,
            vatSearch: `${item.vat_code || ''} - ${item.vat_name || ''}`,
            vatRate: parseFloat(item.vat_rate) || 0,
            wht: parseInt(item.witholding_tax_id) || 0,
            whtSearch: `${item.withholding_tax_code || ''} - ${item.withholding_tax_rate || ''} %`,
            whtRate: parseFloat(item.withholding_tax_rate) || 0,
            responsibilityCenter: item.responsibility_center,
            isOther: false,
          })),
        )
      }

      if (journalData.length > 0) {
        setJournalEntries(
          journalData.map((entry) => ({
            id: entry.id,
            account: entry.coa_id,
            accountSearch: entry.charts_of_accounts_name,
            center: entry.responsibility_center || '',
            debit: entry.type === 'DEBIT' ? parseFloat(entry.amount) || 0 : 0,
            credit: entry.type === 'CREDIT' ? parseFloat(entry.amount) || 0 : 0,
            isManual: false,
          })),
        )
      }

      if (attachmentsData.length > 0) {
        setAttachments(
          attachmentsData.map((att) => {
            const attFile = typeof att.file === 'string' ? att.file : ''
            const attName = typeof att.name === 'string' ? att.name : ''
            const base64 = attFile.startsWith('data:image/')
              ? attFile
              : attName.startsWith('data:image/')
                ? attName
                : null
            const fileName =
              !attFile.startsWith('data:') && attFile
                ? attFile
                : !attName.startsWith('data:') && attName
                  ? attName
                  : ''
            return {
              id: att.id,
              fileName,
              file: base64,
              remarks: att.remarks || '',
              uploadedBy: att.uploaded_by || 'Current User',
              date: att.uploaded_date || new Date().toLocaleDateString(),
            }
          }),
        )
      }
    }
  }, [isViewMode, isEditMode, salesData])

  useEffect(() => {
    if (!isViewMode) regenerateJournalEntries()
  }, [salesItems, modeOfPayment, bankName, chartsOfAccounts, isViewMode, isEditMode])

  useEffect(() => {
    if (!isViewMode && dateDelivered && termsOption && termsNumber) {
      const deliveredDate = new Date(dateDelivered)
      const termsNum = parseInt(termsNumber) || 0
      if (!isNaN(deliveredDate.getTime()) && termsNum > 0) {
        const dueDate = new Date(deliveredDate)
        if (termsOption === 'MONTHS') {
          dueDate.setMonth(dueDate.getMonth() + termsNum)
        } else {
          dueDate.setDate(dueDate.getDate() + termsNum)
        }
        setDateDue(dueDate.toISOString().split('T')[0])
      }
    }
  }, [dateDelivered, termsOption, termsNumber, isViewMode])

  // ── Returned API ──────────────────────────────────────────────────────────
  return {
    // State
    salesItems,
    journalEntries,
    customers,
    customerLoading,
    customerError,
    selectedCustomer,
    setSelectedCustomer,
    customerSearch,
    setCustomerSearch,
    vendors,
    vendorLoading,
    vendorError,
    selectedVendor,
    setSelectedVendor,
    vendorSearch,
    setVendorSearch,
    chartsOfAccounts,
    coaLoading,
    coaError,
    coaSearch,
    setCoaSearch,
    products,
    productLoading,
    productError,
    vatOptions,
    vatLoading,
    vatError,
    whtOptions,
    whtLoading,
    whtError,
    modeOfPayment,
    setModeOfPayment,
    modeSearch,
    setModeSearch,
    bankName,
    setBankName,
    checkNumber,
    setCheckNumber,
    category,
    setCategory,
    categorySearch,
    setCategorySearch,
    documentReference,
    setDocumentReference,
    terms,
    setTerms,
    termsOption,
    setTermsOption,
    termsNumber,
    setTermsNumber,
    dateDelivered,
    setDateDelivered,
    dateDue,
    setDateDue,
    remarks,
    setRemarks,
    attachments,
    toast,
    setToast,
    imageModal,
    setImageModal,
    // Derived
    coaOptions,
    vendorOptions,
    customerOptions,
    productOptions,
    summary: computeSummary(salesItems, journalEntries),
    // Handlers
    addSalesItem,
    addJournalEntry,
    removeSalesItem,
    removeJournalEntry,
    updateSalesItem,
    updateJournalEntry,
    addAttachment,
    removeAttachment,
    updateAttachment,
    handleFileChange,
    loadVatOnDemand,
    loadWhtOnDemand,
    handlePostTransaction,
  }
}
