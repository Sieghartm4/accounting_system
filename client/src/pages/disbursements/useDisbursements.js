import { useState, useEffect, useCallback, useRef } from 'react'
import { API } from '../../api/endpoints'
import {
  getItemResponsibilityCenter,
  getJournalEntryCenter,
} from '../../utils/responsibilityCenterDefaults'
import {
  computeTotals,
  findMissingAutoAccounts,
  findMissingPaymentAccount,
} from '../../utils/taxCalculations'
import { filterActiveMasterRows } from '../../utils/activeMasterFilter'

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
  const { totals } = computeTotals(items)

  return {
    totalPurchasePrice: totals.gross,
    totalDiscount: totals.discount,
    totalDiscounted: totals.discounted,
    totalVAT: totals.vat,
    vatablePurchases: totals.vatableSales,
    vatExemptPurchases: totals.vatExemptSales,
    zeroRatedPurchases: totals.zeroRatedSales,
    totalNoVatDiscount: totals.discountOnVatable,
    totalNetOfVat: totals.netOfVat,
    totalWHT: totals.wht,
    totalAmountDue: totals.amountDue,
  }
}


export const fmt = (n) =>
  n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions to find default VAT and WHT options
// ─────────────────────────────────────────────────────────────────────────────
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
// fileToBase64 utility
// ─────────────────────────────────────────────────────────────────────────────
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result)
    reader.onerror = (error) => reject(error)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// useDisbursementForm — main hook for CashDisbursementForm state & logic
// ─────────────────────────────────────────────────────────────────────────────
export function useDisbursementForm({
  isViewMode,
  isEditMode,
  disbursementData,
  onBack,
  onSuccess,
}) {
  const [disbursementItems, setDisbursementItems] = useState([])
  const [journalEntries, setJournalEntries] = useState([
    {
      id: 1,
      account: '',
      accountSearch: '',
      center: '',
      debit: 0,
      credit: 0,
      isManual: false,
    },
  ])

  const [vendors, setVendors] = useState([])
  const [vendorLoading, setVendorLoading] = useState(false)
  const [vendorError, setVendorError] = useState('')
  const [selectedVendor, setSelectedVendor] = useState('')
  const [vendorSearch, setVendorSearch] = useState('')

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
  const [bankName, setBankName] = useState('')
  const [checkNumber, setCheckNumber] = useState('')
  const [documentReference, setDocumentReference] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [remarks, setRemarks] = useState('')

  const [attachments, setAttachments] = useState([])
  const [toast, setToast] = useState(null)
  const [imageModal, setImageModal] = useState({ isOpen: false, imageSrc: '' })

  // ── Derived option arrays ──
  // Inactive masters are hidden from the dropdowns, but anything already
  // referenced by the loaded items stays visible (edit/view mode).
  const referencedMasterIds = disbursementItems
    .flatMap((item) => [item.coa, item.productId, item.vat, item.wht])
    .filter((v) => v !== '' && v !== null && v !== undefined)
    .map(String)

  const coaOptions = filterActiveMasterRows(
    chartsOfAccounts,
    referencedMasterIds,
  ).map((a) => ({
    label: a.name || a.account_name,
    sublabel: a.code || a.account_code,
    value: a.id,
  }))
  const vendorOptions = vendors.map((v) => ({
    label: v.name || v.code,
    sublabel: v.code,
    value: v.id,
  }))
  const productOptions = filterActiveMasterRows(
    products,
    referencedMasterIds,
  ).map((p) => ({
    label: p.name || p.product_name,
    sublabel: p.type || p.product_type || p.code || p.product_code,
    value: p.id,
  }))

  // ── Fetch helpers ──
  const fetchVendors = async () => {
    try {
      setVendorLoading(true)
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(API.vendors(), {
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

  const createVendor = async ({
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
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(API.vendors(), {
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
        throw new Error(result.message || 'Failed to create vendor')
      }
      await fetchVendors()
      return { success: true, data: result.data }
    } catch (err) {
      return { success: false, message: err.message }
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
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(
        API.productService(),
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
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(
        API.chartsOfAccounts(),
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
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(
        API.productService(),
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
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(API.vat(), {
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
            status: vat.status,
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
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(
        API.withholdingTax(),
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
            status: wht.status,
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
    fetchVendors()
    fetchChartsOfAccounts()
    fetchProducts()
    fetchVat()
    fetchWht()
  }, [])

  // ── Populate form in view/edit mode ──
  useEffect(() => {
    if (disbursementData) {
      const mainData = disbursementData.data
        ? disbursementData.data[0]
        : disbursementData
      const itemsData = disbursementData.items || []
      const journalData = disbursementData.journal || []
      const attachmentsData = disbursementData.attachments || []

      if (mainData && mainData.vendor_id) {
        setSelectedVendor(mainData.vendor_id)
        setVendorSearch(mainData.vendor)
      }

      setDocumentReference(mainData?.doc_ref || '')
      setModeOfPayment(mainData?.mode || '')
      setModeSearch(mainData?.mode || '')
      setBankName(mainData?.bank_name || '')
      setCheckNumber(mainData?.check_number || '')
      setPaymentDate(mainData?.payment_date || '')
      setRemarks(mainData?.remarks || '')

      if (itemsData.length > 0) {
        setDisbursementItems(
          itemsData.map((item) => ({
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
            vat_code: item.vat_code,
            vat_name: item.vat_name,
            wht: parseFloat(item.withholding_tax_id) || 0,
            whtSearch: `${item.withholding_tax_code || ''} - ${item.withholding_tax_rate || ''} %`,
            whtRate: parseFloat(item.withholding_tax_rate) || 0,
            withholding_tax_code: item.withholding_tax_code,
            responsibilityCenter: item.responsibility_center,
            isOther: false,
          })),
        )
      }

      if (journalData.length > 0) {
        setJournalEntries(
          journalData.map((entry) => ({
            id: entry.id,
            account: entry.coa_id || entry.charts_of_accounts_id,
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
  }, [isViewMode, isEditMode, disbursementData])

  useEffect(() => {
    if (
      disbursementItems.length === 0 ||
      products.length === 0 ||
      chartsOfAccounts.length === 0
    )
      return

    const inventoryCoa = chartsOfAccounts.find((coa) => {
      const label = (coa.name || coa.account_name || '').toLowerCase()
      return label.includes('inventory')
    })

    let didUpdate = false
    const updatedItems = disbursementItems.map((item) => {
      let nextItem = item

      const normalizedProductSearch = item.productSearch
        ? String(item.productSearch).trim().toLowerCase()
        : ''

      if (!item.productId && normalizedProductSearch) {
        const matchedProduct = products.find((p) => {
          const productLabel = String(p.name || p.product_name || '')
            .trim()
            .toLowerCase()
          return (
            productLabel === normalizedProductSearch ||
            String(p.id) === normalizedProductSearch
          )
        })

        if (matchedProduct) {
          nextItem = {
            ...nextItem,
            productId: matchedProduct.id,
            productSearch: matchedProduct.name || matchedProduct.product_name || '',
            description:
              nextItem.description ||
              matchedProduct.name ||
              matchedProduct.product_name ||
              '',
          }
          didUpdate = true
        }
      }

      if (item.productId && !item.productSearch) {
        const matchedProduct = products.find((p) => p.id === item.productId)
        if (matchedProduct) {
          nextItem = {
            ...nextItem,
            productSearch: matchedProduct.name || matchedProduct.product_name || '',
            description:
              nextItem.description ||
              matchedProduct.name ||
              matchedProduct.product_name ||
              '',
          }
          didUpdate = true
        }
      }

      // Only auto-assign inventory when loading existing data, not for new items
      if (!item.isNew && (!item.coa || item.coa === '') && inventoryCoa) {
        nextItem = {
          ...nextItem,
          coa: inventoryCoa.id,
          coaSearch: inventoryCoa.name || inventoryCoa.account_name || '',
        }
        didUpdate = true
      }

      return nextItem
    })

    if (didUpdate) {
      setDisbursementItems(updatedItems)
    }
  }, [disbursementItems, products, chartsOfAccounts])

  // ── Match prefilled VAT/WHT codes with loaded options ──
  useEffect(() => {
    if (
      disbursementItems.length === 0 ||
      (vatOptions.length === 0 && whtOptions.length === 0)
    )
      return

    let didUpdate = false
    const updatedItems = disbursementItems.map((item) => {
      let nextItem = item

      // Match VAT by code/name
      if (
        (item.vat === 0 || item.vat === '') &&
        (item.vat_code || item.vatSearch === '')
      ) {
        // Only try to match VAT when the item contains a code/name/search value.
        const matchedVat = vatOptions.find(
          (opt) =>
            opt.code === item.vat_code ||
            opt.name === item.vat_name ||
            opt.label?.includes(item.vat_code),
        )
        if (matchedVat) {
          nextItem = {
            ...nextItem,
            vat: matchedVat.value,
            vatRate: matchedVat.rate,
            vatSearch: matchedVat.label,
            vat_code: matchedVat.code,
            vat_name: matchedVat.name,
          }
          didUpdate = true
        }
      }

      // Match WHT by code/name
      if (
        (item.wht === 0 || item.wht === '') &&
        (item.withholding_tax_code || item.whtSearch === '')
      ) {
        // Only try to match WHT when the item contains a code/name/search value.
        const matchedWht = whtOptions.find(
          (opt) =>
            opt.code === item.withholding_tax_code ||
            opt.name === item.withholding_tax_code ||
            opt.label?.includes(item.withholding_tax_code),
        )
        if (matchedWht) {
          nextItem = {
            ...nextItem,
            wht: matchedWht.value,
            whtRate: matchedWht.rate,
            whtSearch: matchedWht.label,
            withholding_tax_code: matchedWht.code,
          }
          didUpdate = true
        }
      }

      return nextItem
    })

    if (didUpdate) {
      setDisbursementItems(updatedItems)
    }
  }, [disbursementItems, vatOptions, whtOptions])

  // ── Disbursement Items CRUD ──
  const addDisbursementItem = (
    isOther = false,
    defaultVatOpt = null,
    defaultWhtOpt = null,
    defaultResponsibilityCenter = '',
  ) => {
    if (vatOptions.length === 0 && !vatLoading) {
      loadVatOnDemand()
    }
    if (whtOptions.length === 0 && !whtLoading) {
      loadWhtOnDemand()
    }

    // Leave VAT/WHT blank on new rows; defaults will be applied on submit only
    setDisbursementItems((prev) => [
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
        vatType: 'VAT-EX',
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

  const removeDisbursementItem = (id) =>
    setDisbursementItems((prev) => prev.filter((i) => i.id !== id))
  const updateDisbursementItem = (id, field, value) =>
    setDisbursementItems((prev) =>
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
  const hasNewDisbursementItems = () => disbursementItems.some((item) => item.isNew)

  // ── Journal Auto-generation ──
  const generateJournalEntries = useCallback(
    (defaultResponsibilityCenter = '') => {
      const entries = []
      const { lines, totals } = computeTotals(disbursementItems)

      const accountName = (a) => (a.name || a.account_name || '').toLowerCase()
      const findAccount = (terms) =>
        chartsOfAccounts.find((a) =>
          terms.some((term) => accountName(a).includes(term)),
        )

      let paymentAccount = null
      if (modeOfPayment === 'CASH') {
        paymentAccount =
          findAccount(['cash on hand']) || findAccount(['petty cash'])
      } else if (modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') {
        paymentAccount =
          (bankName &&
            chartsOfAccounts.find((a) =>
              accountName(a).includes(bankName.toLowerCase()),
            )) ||
          findAccount(['cash in bank'])
      }

      // Discount/VAT math comes from computeTotals (shared calculator):
      // - expense is debited at the pre-discount tax-exclusive amount (grossEx)
      // - input VAT is on the discounted (net) base
      // - cash settles at the discounted total, so the standalone Purchase
      //   Discounts credit keeps the entry balanced:
      //   grossEx + vat = settled + discountBook + wht
      const totalSettled =
        totals.grossEx + totals.vat - totals.discountBook - totals.wht

      // 1. Expense (DEBIT) - per item at pre-discount tax-exclusive amount
      lines.forEach(({ item, f }) => {
        if (item.coa && f.gross > 0) {
          const selectedCoa = chartsOfAccounts.find((a) => a.id === item.coa)
          if (selectedCoa) {
            entries.push({
              id: Date.now() + Math.random(),
              account: selectedCoa.id,
              accountSearch: selectedCoa.name,
              center: getItemResponsibilityCenter(item, defaultResponsibilityCenter),
              debit: f.grossEx,
              credit: 0,
              isManual: false,
            })
          }
        }
      })

      // 2. Input VAT (DEBIT) - on the discounted (net) base
      if (totals.vat > 0) {
        const inputVatAccount = findAccount(['input vat'])
        if (inputVatAccount) {
          entries.push({
            id: Date.now() + Math.random(),
            account: inputVatAccount.id,
            accountSearch: inputVatAccount.name,
            center: getItemResponsibilityCenter(
              disbursementItems[0],
              defaultResponsibilityCenter,
            ),
            debit: totals.vat,
            credit: 0,
            isManual: false,
          })
        }
      }

      // 3. Withholding Tax (CREDIT) - liability account
      // Payroll-related COA keywords use Withholding Tax - Compensation
      if (totals.wht > 0) {
        const payrollKeywords = [
          'salary', 'wage', 'commission', 'bonus', 'compensation',
          'sss', 'philhealth', 'pag-ibig', 'pagibig', 'payroll',
        ]
        const hasPayrollItem = lines.some(({ item }) => {
          const selectedCoa = chartsOfAccounts.find((a) => a.id === item.coa)
          const coaName = (selectedCoa?.name || '').toLowerCase()
          return payrollKeywords.some((keyword) => coaName.includes(keyword))
        })
        const whtAccount = findAccount([
          hasPayrollItem
            ? 'withholding tax - compensation'
            : 'withholding tax - expanded',
        ])
        if (whtAccount) {
          entries.push({
            id: Date.now() + Math.random(),
            account: whtAccount.id,
            accountSearch: whtAccount.name,
            center: getItemResponsibilityCenter(
              disbursementItems[0],
              defaultResponsibilityCenter,
            ),
            debit: 0,
            credit: totals.wht,
            isManual: false,
          })
        }
      }

      // 4. Purchase Discounts (CREDIT)
      if (totals.discountBook > 0) {
        const discountAccount = findAccount(['purchase discounts'])
        if (discountAccount) {
          entries.push({
            id: Date.now() + Math.random(),
            account: discountAccount.id,
            accountSearch: discountAccount.name,
            center: getItemResponsibilityCenter(
              disbursementItems[0],
              defaultResponsibilityCenter,
            ),
            debit: 0,
            credit: totals.discountBook,
            isManual: false,
          })
        }
      }

      // 5. Cash / Bank (CREDIT) - discounted settlement net of WHT
      if (paymentAccount && totalSettled > 0) {
        entries.push({
          id: Date.now() + Math.random(),
          account: paymentAccount.id,
          accountSearch: paymentAccount.name,
          center: getItemResponsibilityCenter(
            disbursementItems[0],
            defaultResponsibilityCenter,
          ),
          debit: 0,
          credit: totalSettled,
          isManual: false,
        })
      }

      setJournalEntries(entries)
    },
    [disbursementItems, modeOfPayment, bankName, chartsOfAccounts],
  )

  useEffect(() => {
    if (!isViewMode) {
      generateJournalEntries()
    }
  }, [
    disbursementItems,
    modeOfPayment,
    bankName,
    chartsOfAccounts,
    isViewMode,
  ])

  // ── Post / Submit ──

  const handlePostTransaction = async () => {
    try {
      const userData = JSON.parse(sessionStorage.getItem('auth_user') || '{}')
      const createdBy = userData.mu_username || userData.username || 'Unknown User'

      if (!selectedVendor) {
        setToast({ type: 'warning', message: 'Please select a vendor' })
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

      // Validate VAT-INC items have VAT selected
      const hasVatIncWithoutVat = disbursementItems.some(
        (item) => item.vatType === 'VAT-INC' && (!item.vat || item.vat === '' || item.vat === 0)
      )
      if (hasVatIncWithoutVat) {
        setToast({
          type: 'warning',
          message: 'Items with VAT Inclusive pricing must have a VAT rate selected',
        })
        return
      }

      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        setToast({
          type: 'error',
          message: 'No authorization token found. Please login again.',
        })
        return
      }

      // Guard: auto-generated entries reference standard accounts by name.
      // If one is missing the journal silently becomes unbalanced, so block
      // posting until the chart of accounts has them.
      const missingAccounts = [
        ...findMissingAutoAccounts({
          items: disbursementItems,
          chartsOfAccounts,
          side: 'disbursements',
        }),
        findMissingPaymentAccount({
          modeOfPayment,
          bankName,
          chartsOfAccounts,
        }),
      ].filter(Boolean)
      if (missingAccounts.length > 0) {
        setToast({
          type: 'error',
          message: `Missing chart of account(s): ${missingAccounts.join(', ')}. Add them before posting.`,
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

      const summary = computeSummary(disbursementItems)

      // Apply defaults for VAT/WHT only at submit time if item value is blank
      const defaultVatOpt = findDefaultVatOption(vatOptions)
      const defaultWhtOpt = findDefaultWhtOption(whtOptions)

      const preparedDisbursementItems = disbursementItems.map((item) => ({
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

      const mainData = disbursementData?.data
        ? disbursementData.data[0]
        : disbursementData
      const disbursementId = mainData?.id

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
        attachments: preparedAttachments,
      }

      if (isEditMode && disbursementId) {
        requestData.id = disbursementId
        requestData.updated_by = createdBy
      } else {
        requestData.created_by = createdBy
      }

      const url =
        isEditMode && disbursementId
          ? API.cashDisbursementsById(disbursementId)
          : API.cashDisbursements()

      const response = await fetch(url, {
        method: isEditMode && disbursementId ? 'PUT' : 'POST',
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
          message: `Cash disbursement ${action} successfully!`,
        }
        setToast(nextToast)
        if (onSuccess) await onSuccess(nextToast)
      } else {
        const action = isEditMode ? 'update' : 'create'
        setToast({
          type: 'error',
          message: result.message || `Failed to ${action} cash disbursement`,
        })
      }
    } catch (error) {
      console.error('Error posting cash disbursement:', error)
      setToast({ type: 'error', message: 'Error: ' + error.message })
    }
  }

  return {
    // state
    disbursementItems,
    journalEntries,
    attachments,
    toast,
    setToast,
    imageModal,
    setImageModal,
    vendors,
    vendorLoading,
    vendorError,
    selectedVendor,
    vendorSearch,
    setSelectedVendor,
    setVendorSearch,
    chartsOfAccounts,
    coaLoading,
    coaError,
    products,
    productLoading,
    productError,
    vatOptions: filterActiveMasterRows(vatOptions, referencedMasterIds),
    vatLoading,
    vatError,
    whtOptions: filterActiveMasterRows(whtOptions, referencedMasterIds),
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
    documentReference,
    setDocumentReference,
    paymentDate,
    setPaymentDate,
    remarks,
    setRemarks,
    // derived
    coaOptions,
    vendorOptions,
    productOptions,
    // actions
    addDisbursementItem,
    removeDisbursementItem,
    updateDisbursementItem,
    addJournalEntry,
    removeJournalEntry,
    updateJournalEntry,
    addAttachment,
    removeAttachment,
    updateAttachment,
    handleFileChange,
    loadVatOnDemand,
    loadWhtOnDemand,
    createVendor,
    createProduct,
    handlePostTransaction,
    summary: computeSummary(disbursementItems),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Original useDisbursements hook (list-fetching)
// ─────────────────────────────────────────────────────────────────────────────
const useDisbursements = () => {
  const [disbursements, setDisbursements] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const disbursementsRef = useRef([])
  const filterRef = useRef({ dateFrom: null, dateTo: null })
  const LIMIT = 50

  useEffect(() => {
    disbursementsRef.current = disbursements
  }, [disbursements])

  const prependDisbursement = useCallback((disbursement) => {
    if (!disbursement || !disbursement.id) return

    setDisbursements((prevDisbursements) => {
      if (prevDisbursements.some((item) => item.id === disbursement.id)) {
        return prevDisbursements
      }
      return [disbursement, ...prevDisbursements]
    })
  }, [])

  const fetchDisbursements = useCallback(
    async (isLoadMore = false, filters = {}) => {
      try {
        if (isLoadMore) {
          setLoadingMore(true)
        } else {
          setLoading(true)
        }
        setError(null)
        const token = sessionStorage.getItem('authenticated')
        if (!token) throw new Error('No authorization token found')

        const params = new URLSearchParams()
        params.append('offset', isLoadMore ? disbursementsRef.current.length : 0)
        params.append('limit', LIMIT)

        const queryDateFrom =
          filters.dateFrom !== undefined
            ? filters.dateFrom
            : filterRef.current.dateFrom
        const queryDateTo =
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
          `${API.cashDisbursements()}?${params.toString()}`,
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
          throw new Error(result.message || 'Failed to fetch disbursements')
        }

        if (isLoadMore) {
          setDisbursements((prev) => [...prev, ...(result.data || [])])
        } else {
          setDisbursements(result.data || [])
        }
        setHasMore(result.hasMore || false)
      } catch (err) {
        setError(err.message)
        if (!isLoadMore) {
          setDisbursements([])
        }
      } finally {
        if (isLoadMore) {
          setLoadingMore(false)
        } else {
          setLoading(false)
        }
      }
    },
    [],
  )

  const refetchDisbursements = useCallback(
    (filters = {}) => {
      fetchDisbursements(false, filters)
    },
    [fetchDisbursements],
  )

  useEffect(() => {
    refetchDisbursements()
  }, [refetchDisbursements])

  return {
    disbursements,
    loading,
    loadingMore,
    error,
    hasMore,
    refetchDisbursements,
    prependDisbursement,
    loadMore: (filters = {}) => fetchDisbursements(true, filters),
  }
}

export default useDisbursements
