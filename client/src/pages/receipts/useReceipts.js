import { useState, useEffect, useCallback, useRef } from 'react'
import { getItemResponsibilityCenter } from '../../utils/responsibilityCenterDefaults'

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
// SUMMARY COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────
export function computeSummary(items) {
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

    let discAmt
    if (discountType === 'PERCENT') {
      discAmt = gross * (discountValue / 100)
    } else {
      discAmt = discountValue * qty
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
      vatableSales += discounted
      totalNoVatDiscount += discAmt
    } else if (whtPct > 0) {
      zeroRatedSales += discounted
    } else {
      vatExemptSales += discounted
    }
  })

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
  }
}

export const fmt = (n) =>
  n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ─────────────────────────────────────────────────────────────────────────────
// fileToBase64 utility
// ─────────────────────────────────────────────────────────────────────────────
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (
      !file ||
      typeof file !== 'object' ||
      !(file instanceof File || file instanceof Blob)
    ) {
      resolve(null)
      return
    }
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result)
    reader.onerror = (error) => reject(error)
  })
}

export function findDefaultVatOption(vatOptions) {
  return vatOptions.find(
    (opt) =>
      opt.code === 'No VAT' ||
      opt.name === 'No VAT%' ||
      opt.label?.includes('No VAT'),
  )
}

export function findDefaultWhtOption(whtOptions) {
  return whtOptions.find(
    (opt) =>
      opt.code === 'NON-WHT' ||
      opt.name === 'NON-WHT' ||
      opt.label?.includes('NON-WHT'),
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// useReceiptsForm — main hook for ReceiptsForm state & logic
// ─────────────────────────────────────────────────────────────────────────────
export function useReceiptsForm({
  isViewMode,
  isEditMode,
  receiptData,
  onBack,
  onSuccess,
}) {
  const [receiptItems, setReceiptItems] = useState([])
  const [journalEntries, setJournalEntries] = useState([])

  const [customers, setCustomers] = useState([])
  const [customerLoading, setCustomerLoading] = useState(false)
  const [customerError, setCustomerError] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')

  const [chartsOfAccounts, setChartsOfAccounts] = useState([])
  const [coaLoading, setCoaLoading] = useState(false)
  const [coaError, setCoaError] = useState('')

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
  const [collectionDate, setCollectionDate] = useState('')
  const [bankName, setBankName] = useState('')
  const [checkNumber, setCheckNumber] = useState('')
  const [documentReference, setDocumentReference] = useState('')
  const [remarks, setRemarks] = useState('')

  const [attachments, setAttachments] = useState([])
  const [toast, setToast] = useState(null)
  const [imageModal, setImageModal] = useState({ isOpen: false, imageSrc: '' })

  const isDisabled = isViewMode && !isEditMode

  // ── Derived option arrays ──
  const coaOptions = chartsOfAccounts.map((a) => ({
    label: a.name || a.account_name,
    sublabel: a.code || a.account_code,
    value: a.id,
  }))
  const customerOptions = customers.map((c) => ({
    label: c.name || c.customer_name,
    sublabel: c.code,
    value: c.id,
  }))
  const productOptions = products.map((p) => ({
    label: p.name || p.product_name,
    sublabel: p.type || p.product_type || p.code || p.product_code,
    value: p.id,
  }))

  // ── Fetch helpers ──
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
      if (result.success) {
        setCustomers(result.data)
        setCustomerError('')
      } else {
        setCustomerError(result.message || 'Failed to fetch customers')
      }
    } catch (err) {
      setCustomerError(err.message)
    } finally {
      setCustomerLoading(false)
    }
  }

  const createCustomer = async ({
    code,
    name,
    category,
    type,
    status,
    address,
    tin,
    details,
    contact,
  }) => {
    try {
      setCustomerLoading(true)
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(`${import.meta.env.VITE_SERVER_LINK}/customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code,
          name,
          category,
          type,
          status,
          address,
          tin,
          details,
          contact,
        }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP error! status: ${res.status}`)
      }
      const result = await res.json()
      if (!result.success) {
        throw new Error(result.message || 'Failed to create customer')
      }
      await fetchCustomers()
      return { success: true, data: result.data }
    } catch (err) {
      return { success: false, message: err.message }
    } finally {
      setCustomerLoading(false)
    }
  }

  const createProduct = async ({
    code,
    name,
    type,
    category,
    sales_price,
    purchase_price,
    unit,
  }) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/product_service`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            code,
            name,
            type,
            category,
            sales_price,
            purchase_price,
            unit,
          }),
        },
      )
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP error! status: ${res.status}`)
      }
      const result = await res.json()
      if (!result.success) {
        throw new Error(result.message || 'Failed to create product')
      }
      await fetchProducts()
      return { success: true, data: result.data }
    } catch (err) {
      return { success: false, message: err.message }
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

  useEffect(() => {
    fetchCustomers()
    fetchChartsOfAccounts()
    fetchProducts()
  }, [])

  // ── Populate form in view/edit mode ──
  useEffect(() => {
    if ((isViewMode || isEditMode) && receiptData) {
      if (receiptData.data && receiptData.data.length > 0) {
        const receipt = receiptData.data[0]
        setSelectedCustomer(receipt.customer)
        setCustomerSearch(receipt.customer)
        setSelectedCustomerId(receipt.customer_id)
        setDocumentReference(receipt.doc_ref || '')
        setModeOfPayment(receipt.mode || '')
        setModeSearch(receipt.mode || '')
        setCollectionDate(receipt.collection_date || '')
        setBankName(receipt.bank_name || '')
        setCheckNumber(receipt.check_number || '')
        setRemarks(receipt.remarks || '')
      }

      if (receiptData.items && receiptData.items.length > 0) {
        setReceiptItems(
          receiptData.items.map((item) => ({
            id: item.id,
            productId: item.product_service_id,
            productSearch: item.product_service_name,
            coa: item.charts_of_accounts_id,
            coaSearch: item.charts_of_accounts_name,
            description: item.description || '',
            qty: item.quantity || 1,
            price: parseFloat(item.sales_price) || 0,
            discount: parseFloat(item.discount) || 0,
            discountType: item.discount_type || 'PERCENT',
            vat: parseFloat(item.vat_id) || 0,
            vatSearch: `${item.vat_code || ''} - ${item.vat_name || ''}`,
            vatRate: parseFloat(item.vat_rate) || 0,
            wht: parseFloat(item.withholding_tax_id) || 0,
            whtSearch: `${item.withholding_tax_code || ''} - ${item.withholding_tax_rate || ''} %`,
            whtRate: parseFloat(item.withholding_tax_rate) || 0,
            responsibilityCenter: item.responsibility_center || '',
            isOther: false,
          })),
        )
      }

      if (receiptData.journal && receiptData.journal.length > 0) {
        setJournalEntries(
          receiptData.journal.map((entry) => ({
            id: entry.id,
            account: entry.coa_id,
            accountSearch: entry.charts_of_accounts_name,
            center: entry.responsibility_center || '',
            debit: entry.type === 'DEBIT' ? parseFloat(entry.amount) || 0 : 0,
            credit: entry.type === 'CREDIT' ? parseFloat(entry.amount) || 0 : 0,
            isManual: false,
          })),
        )
      } else {
        setJournalEntries([])
      }

      if (receiptData.attachments && receiptData.attachments.length > 0) {
        setAttachments(
          receiptData.attachments.map((att) => ({
            id: att.id,
            fileName: att.name || '',
            file: att.file || null,
            remarks: att.remarks || '',
            uploadedBy: att.uploaded_by || 'Current User',
            date: att.uploaded_date || new Date().toLocaleDateString(),
          })),
        )
      }
    }
  }, [isViewMode, receiptData])

  useEffect(() => {
    // Previously this effect auto-filled VAT/WHT defaults when options loaded.
    // We intentionally do not auto-apply defaults here to keep VAT/WHT blank
    // while the user edits the items. Defaults will be applied only on submit.
  }, [receiptItems, vatOptions, whtOptions])

  // ── Receipt Items CRUD ──
  const addReceiptItem = (isOther = false, defaultResponsibilityCenter = '') => {
    if (vatOptions.length === 0 && !vatLoading) {
      loadVatOnDemand()
    }
    if (whtOptions.length === 0 && !whtLoading) {
      loadWhtOnDemand()
    }

    // Do not auto-assign default VAT/WHT when creating a new row — leave blank
    const defaultVat = null
    const defaultWht = null

    setReceiptItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        productId: '',
        productSearch: '',
        coa: '',
        coaSearch: '',
        description: '',
        qty: 1,
        price: '',
        discount: 0,
        discountType: 'PERCENT',
        vat: '',
        vatSearch: '',
        vatRate: 0,
        wht: '',
        whtSearch: '',
        whtRate: 0,
        responsibilityCenter: defaultResponsibilityCenter || '',
        isOther,
        isNew: true,
      },
    ])
  }

  const removeReceiptItem = (id) =>
    setReceiptItems((prev) => prev.filter((i) => i.id !== id))
  const updateReceiptItem = (id, field, value) =>
    setReceiptItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    )

  // ── Journal Entries CRUD ──
  const addJournalEntry = (defaultResponsibilityCenter = '') =>
    setJournalEntries((prev) => [
      ...prev,
      {
        id: Date.now(),
        account: '',
        accountSearch: '',
        center: defaultResponsibilityCenter || '',
        debit: 0,
        credit: 0,
        isManual: true,
        isNew: true,
      },
    ])

  const removeJournalEntry = (id) =>
    setJournalEntries((prev) => prev.filter((e) => e.id !== id))
  const updateJournalEntry = (id, field, value) =>
    setJournalEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    )

  // ── Attachments CRUD ──
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
        isNew: true,
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

  // ── Helpers ──
  const hasNewReceiptItems = () => receiptItems.some((item) => item.isNew)

  const calculateJournalBalance = () => {
    const totalDebit = journalEntries.reduce(
      (sum, entry) => sum + (parseFloat(entry.debit) || 0),
      0,
    )
    const totalCredit = journalEntries.reduce(
      (sum, entry) => sum + (parseFloat(entry.credit) || 0),
      0,
    )
    return {
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    }
  }

  const isAutoGeneratedEntry = (entry) => {
    if (entry.isManual === false) return true
    if (entry.isManual === undefined) {
      const entryAmount = parseFloat(entry.debit) || parseFloat(entry.credit) || 0
      const matchesReceiptItem = receiptItems.some((item) => {
        const itemAmount = parseFloat(item.price) || 0
        const itemCoaId = item.coa || item.account || item.charts_of_accounts_id
        return (
          itemCoaId === entry.account && Math.abs(itemAmount - entryAmount) < 0.01
        )
      })
      const matchesVat = receiptItems.some((item) => {
        const vatAmount = parseFloat(item.vat) || 0
        return (
          vatAmount > 0 &&
          Math.abs(vatAmount - entryAmount) < 0.01 &&
          entry.account &&
          entry.account.toString().toLowerCase().includes('vat')
        )
      })
      const matchesWht = receiptItems.some((item) => {
        const whtAmount = parseFloat(item.wht) || 0
        return (
          whtAmount > 0 &&
          Math.abs(whtAmount - entryAmount) < 0.01 &&
          entry.account &&
          entry.account.toString().toLowerCase().includes('wht')
        )
      })
      const totalReceiptAmount = receiptItems.reduce((sum, item) => {
        const qty = parseFloat(item.qty) || 0
        const price = parseFloat(item.price) || 0
        const discountValue = parseFloat(item.discount) || 0
        const discountType = item.discountType || 'PERCENT'
        const gross = qty * price
        const discAmt =
          discountType === 'PERCENT'
            ? gross * (discountValue / 100)
            : discountValue * qty
        return sum + (gross - discAmt)
      }, 0)
      const isBankEntry =
        entry.account &&
        (entry.account.toString().toLowerCase().includes('cash') ||
          entry.account.toString().toLowerCase().includes('bank')) &&
        Math.abs(totalReceiptAmount - entryAmount) < 0.01
      return matchesReceiptItem || matchesVat || matchesWht || isBankEntry
    }
    return false
  }

  // ── Journal Auto-generation ──
  const generateJournalEntries = useCallback(
    (defaultResponsibilityCenter = '') => {
      const entries = []

      let paymentAccount = null
      if (modeOfPayment === 'CASH') {
        paymentAccount =
          chartsOfAccounts.find((a) =>
            (a.name || '').toLowerCase().includes('cash on hand'),
          ) ||
          chartsOfAccounts.find((a) =>
            (a.name || '').toLowerCase().includes('petty cash'),
          )
      } else if (modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') {
        paymentAccount =
          chartsOfAccounts.find((a) =>
            (a.name || '').toLowerCase().includes(bankName.toLowerCase()),
          ) ||
          chartsOfAccounts.find((a) =>
            (a.name || '').toLowerCase().includes('cash in bank'),
          )
      }

      receiptItems.forEach((item) => {
        const qty = parseFloat(item.qty) || 0
        const price = parseFloat(item.price) || 0
        const discountValue = parseFloat(item.discount) || 0
        const discountType = item.discountType || 'PERCENT'
        const vatPct = parseFloat(item.vatRate) || 0
        const whtPct = parseFloat(item.whtRate) || 0
        const gross = qty * price
        const discountAmount =
          discountType === 'PERCENT'
            ? gross * (discountValue / 100)
            : discountValue * qty
        const discountedAmount = gross - discountAmount
        const vatAmount = discountedAmount * (vatPct / 100)
        const whtAmount = discountedAmount * (whtPct / 100)

        const selectedCoa = chartsOfAccounts.find((a) => a.id === item.coa)
        if (selectedCoa && gross > 0) {
          entries.push({
            id: Date.now() + Math.random(),
            account: selectedCoa.id,
            accountSearch: selectedCoa.name,
            center: getItemResponsibilityCenter(item, defaultResponsibilityCenter),
            debit: 0,
            credit: parseFloat(gross.toFixed(2)),
            isManual: false,
          })
        }

        if (vatAmount > 0) {
          const outputVatAccount = chartsOfAccounts.find((a) =>
            (a.name || '').toLowerCase().includes('output vat'),
          )
          if (outputVatAccount) {
            entries.push({
              id: Date.now() + Math.random(),
              account: outputVatAccount.id,
              accountSearch: outputVatAccount.name,
              center: getItemResponsibilityCenter(item, defaultResponsibilityCenter),
              debit: 0,
              credit: parseFloat(vatAmount.toFixed(2)),
              isManual: false,
            })
          }
        }

        if (whtAmount > 0) {
          const whtAccount = chartsOfAccounts.find((a) =>
            (a.name || '').toLowerCase().includes('creditable withholding tax'),
          )
          if (whtAccount) {
            entries.push({
              id: Date.now() + Math.random(),
              account: whtAccount.id,
              accountSearch: whtAccount.name,
              center: getItemResponsibilityCenter(item, defaultResponsibilityCenter),
              debit: parseFloat(whtAmount.toFixed(2)),
              credit: 0,
              isManual: false,
            })
          }
        }

        if (discountAmount > 0) {
          const discountAccount = chartsOfAccounts.find((a) =>
            (a.name || '').toLowerCase().includes('sales discounts'),
          )
          if (discountAccount) {
            entries.push({
              id: Date.now() + Math.random(),
              account: discountAccount.id,
              accountSearch: discountAccount.name,
              center: getItemResponsibilityCenter(item, defaultResponsibilityCenter),
              debit: parseFloat(discountAmount.toFixed(2)),
              credit: 0,
              isManual: false,
            })
          }
        }
      })

      const totalCashAmount = receiptItems.reduce((sum, item) => {
        const qty = parseFloat(item.qty) || 0
        const price = parseFloat(item.price) || 0
        const discountValue = parseFloat(item.discount) || 0
        const discountType = item.discountType || 'PERCENT'
        const vatPct = parseFloat(item.vatRate) || 0
        const whtPct = parseFloat(item.whtRate) || 0
        const gross = qty * price
        const discountAmount =
          discountType === 'PERCENT'
            ? gross * (discountValue / 100)
            : discountValue * qty
        const discountedAmount = gross - discountAmount
        const vatAmount = discountedAmount * (vatPct / 100)
        const whtAmount = discountedAmount * (whtPct / 100)
        return sum + (discountedAmount + vatAmount - whtAmount)
      }, 0)

      if (paymentAccount && totalCashAmount > 0) {
        entries.push({
          id: Date.now() + Math.random(),
          account: paymentAccount.id,
          accountSearch: paymentAccount.name,
          center: getItemResponsibilityCenter(
            receiptItems[0],
            defaultResponsibilityCenter,
          ),
          debit: parseFloat(totalCashAmount.toFixed(2)),
          credit: 0,
          isManual: false,
        })
      }

      setJournalEntries(entries)
    },
    [receiptItems, modeOfPayment, bankName, chartsOfAccounts],
  )

  useEffect(() => {
    if (!isDisabled && (!isEditMode || !isViewMode)) {
      if (!isEditMode || hasNewReceiptItems()) {
        generateJournalEntries()
      }
    }
  }, [
    receiptItems,
    modeOfPayment,
    bankName,
    chartsOfAccounts,
    isDisabled,
    isEditMode,
    isViewMode,
  ])

  // ── Post / Submit ──
  const handlePostTransaction = async () => {
    const receiptId = isEditMode && receiptData?.data?.[0]?.id
    try {
      const userData = JSON.parse(localStorage.getItem('user') || '{}')
      const createdBy = userData.mu_username || userData.username || 'Unknown User'

      if (!selectedCustomer) {
        setToast({ type: 'warning', message: 'Please select a customer' })
        return
      }
      if (!modeOfPayment) {
        setToast({ type: 'warning', message: 'Please select mode of payment' })
        return
      }
      if (
        (modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') &&
        !bankName
      ) {
        setToast({ type: 'warning', message: 'Please enter bank name' })
        return
      }

      const hasValidItems = receiptItems.some((item) =>
        item.isOther
          ? item.description.trim() !== '' && item.coa !== ''
          : item.productId !== '',
      )
      if (!hasValidItems) {
        setToast({
          type: 'warning',
          message: 'Please add at least one valid receipt item',
        })
        return
      }

      const totalDebit = journalEntries.reduce(
        (sum, e) => sum + (parseFloat(e.debit) || 0),
        0,
      )
      const totalCredit = journalEntries.reduce(
        (sum, e) => sum + (parseFloat(e.credit) || 0),
        0,
      )
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        setToast({
          type: 'warning',
          message:
            'Journal entries must be balanced. Total debits must equal total credits.',
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

      const summary = computeSummary(receiptItems)

      // Apply defaults for VAT/WHT only at submit time if item value is blank
      const defaultVatOpt = findDefaultVatOption(vatOptions)
      const defaultWhtOpt = findDefaultWhtOption(whtOptions)

      const preparedReceiptItems = receiptItems.map((item) => ({
        id: item.id && !item.isNew ? item.id : null,
        product_id: item.isOther ? null : item.productId || null,
        account_id: item.coa || item.accountId,
        description: item.description,
        qty: item.isOther ? 1 : parseFloat(item.qty) || 0,
        price: parseFloat(item.price) || 0,
        discount: parseFloat(item.discount) || 0,
        discount_type: item.discountType || 'PERCENT',
        vat:
          parseFloat(
            item.vat === '' || item.vat === null || item.vat === undefined
              ? defaultVatOpt?.value || 0
              : item.vat,
          ) || 0,
        wtax:
          parseFloat(
            item.wht === '' || item.wht === null || item.wht === undefined
              ? defaultWhtOpt?.value || 0
              : item.wht,
          ) || 0,
        responsibility_center: item.responsibilityCenter || '',
      }))

      const preparedJournalEntries = journalEntries
        .filter((entry) => !entry.isOther)
        .map((entry) => ({
          id: entry.id && !entry.isNew ? entry.id : null,
          account_id: entry.account || entry.accountId,
          responsibility_center: entry.center || '',
          debit: parseFloat(entry.debit) || 0,
          credit: parseFloat(entry.credit) || 0,
        }))

      const preparedAttachments = await Promise.all(
        attachments.map(async (att) => {
          let fileData = null
          if (att.file) {
            if (typeof att.file === 'string' && att.file.startsWith('data:')) {
              fileData = att.file
            } else if (att.file instanceof File || att.file instanceof Blob) {
              fileData = await fileToBase64(att.file)
            }
          }
          return {
            id: att.id && !att.isNew ? att.id : null,
            fileName: att.fileName,
            file: fileData,
            remarks: att.remarks,
            uploadedBy: att.uploadedBy,
            date: att.date,
          }
        }),
      )

      const requestData = {
        customer_id: selectedCustomerId,
        document_reference: documentReference,
        payment_date: collectionDate || new Date().toISOString().split('T')[0],
        mode_of_payment: modeOfPayment,
        bank_name: bankName || '',
        check_number: checkNumber || '',
        remarks,
        total_amount_due: summary.totalAmountDue,
        receipt_items: preparedReceiptItems,
        journal_entries: preparedJournalEntries,
        attachments: preparedAttachments,
      }

      if (isEditMode && receiptId) {
        requestData.updated_by = createdBy
      } else {
        requestData.created_by = createdBy
      }

      const apiUrl = isEditMode
        ? `${import.meta.env.VITE_SERVER_LINK}/receipt/${receiptId}`
        : `${import.meta.env.VITE_SERVER_LINK}/receipt`

      const response = await fetch(apiUrl, {
        method: isEditMode ? 'PUT' : 'POST',
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
        const nextToast = {
          type: 'success',
          message: isEditMode
            ? 'Receipt updated successfully!'
            : 'Receipt created successfully!',
        }
        setToast(nextToast)
        if (onSuccess) await onSuccess(nextToast)
        onBack()
      } else {
        setToast({
          type: 'error',
          message:
            result.message ||
            (isEditMode ? 'Failed to update receipt' : 'Failed to create receipt'),
        })
      }
    } catch (error) {
      console.error('Error posting receipt:', error)
      setToast({ type: 'error', message: 'Error: ' + error.message })
    }
  }

  return {
    // state
    receiptItems,
    journalEntries,
    attachments,
    toast,
    setToast,
    imageModal,
    setImageModal,
    customers,
    customerLoading,
    customerError,
    selectedCustomer,
    customerSearch,
    selectedCustomerId,
    setSelectedCustomer,
    setCustomerSearch,
    setSelectedCustomerId,
    chartsOfAccounts,
    coaLoading,
    coaError,
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
    collectionDate,
    setCollectionDate,
    bankName,
    setBankName,
    checkNumber,
    setCheckNumber,
    documentReference,
    setDocumentReference,
    remarks,
    setRemarks,
    isDisabled,
    // derived
    coaOptions,
    customerOptions,
    productOptions,
    // actions
    addReceiptItem,
    removeReceiptItem,
    updateReceiptItem,
    addJournalEntry,
    removeJournalEntry,
    updateJournalEntry,
    createCustomer,
    createProduct,
    addAttachment,
    removeAttachment,
    updateAttachment,
    handleFileChange,
    calculateJournalBalance,
    isAutoGeneratedEntry,
    loadVatOnDemand,
    loadWhtOnDemand,
    handlePostTransaction,
    summary: computeSummary(receiptItems),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Original useReceipts hook (list-fetching)
// ─────────────────────────────────────────────────────────────────────────────
const useReceipts = () => {
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const receiptsRef = useRef([])
  const filterRef = useRef({ dateFrom: null, dateTo: null })
  const LIMIT = 50

  useEffect(() => {
    receiptsRef.current = receipts
  }, [receipts])

  const prependReceipt = useCallback((receipt) => {
    if (!receipt || !receipt.id) return

    setReceipts((prevReceipts) => {
      if (prevReceipts.some((item) => item.id === receipt.id)) {
        return prevReceipts
      }
      return [receipt, ...prevReceipts]
    })
  }, [])

  const fetchReceipts = useCallback(async (isLoadMore = false, filters = {}) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')

      const offset = isLoadMore ? receiptsRef.current.length : 0
      const params = new URLSearchParams()
      params.append('offset', offset)
      params.append('limit', LIMIT)

      let queryDateFrom =
        filters.dateFrom !== undefined
          ? filters.dateFrom
          : filterRef.current.dateFrom
      let queryDateTo =
        filters.dateTo !== undefined ? filters.dateTo : filterRef.current.dateTo

      if (filters.dateFrom !== undefined || filters.dateTo !== undefined) {
        filterRef.current = {
          dateFrom: queryDateFrom,
          dateTo: queryDateTo,
        }
      }

      if (queryDateFrom) params.append('dateFrom', queryDateFrom)
      if (queryDateTo) params.append('dateTo', queryDateTo)

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/receipt?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch receipts')
      }

      if (isLoadMore) {
        setReceipts((prev) => [...prev, ...(result.data || [])])
      } else {
        setReceipts(result.data || [])
      }

      setHasMore(result.hasMore || false)
    } catch (err) {
      setError(err.message)
      if (!isLoadMore) {
        setReceipts([])
      }
    } finally {
      if (isLoadMore) {
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }, [])

  const refetchReceipts = useCallback(
    (filters = {}) => {
      fetchReceipts(false, filters)
    },
    [fetchReceipts],
  )

  const loadMore = useCallback(
    (filters = {}) => {
      fetchReceipts(true, filters)
    },
    [fetchReceipts],
  )

  useEffect(() => {
    fetchReceipts(false)
  }, [fetchReceipts])

  return {
    receipts,
    loading,
    loadingMore,
    error,
    hasMore,
    refetchReceipts,
    prependReceipt,
    loadMore,
  }
}

export default useReceipts
