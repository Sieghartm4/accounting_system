import { useState, useEffect } from 'react'



const BANK_SECTION_ITEMS = [

  {

    value: 'deposits_in_transit',

    label: 'Deposit in Transit',

    effect: 'add',

    description: 'Cash deposited but not yet reflected on the bank statement',

    color: 'text-emerald-700',

    bg: 'bg-emerald-50',

    badge: 'bg-emerald-100 text-emerald-700',

    borderColor: 'border-emerald-200',

  },

  {

    value: 'outstanding_checks',

    label: 'Outstanding Check',

    effect: 'deduct',

    description:

      'Checks issued and recorded in the books but not yet cleared the bank',

    color: 'text-rose-700',

    bg: 'bg-rose-50',

    badge: 'bg-rose-100 text-rose-700',

    borderColor: 'border-rose-200',

  },

  {

    value: 'error_bank',

    label: 'Bank Error',

    effect: 'adjustment',

    description:

      'An error made by the bank that requires correction on the bank side',

    color: 'text-amber-700',

    bg: 'bg-amber-50',

    badge: 'bg-amber-100 text-amber-700',

    borderColor: 'border-amber-200',

  },

]



const BOOK_SECTION_ITEMS = [

  {

    value: 'interest_income',

    label: 'Interest Earned',

    effect: 'add',

    description: 'Interest credited by bank, not yet recorded in the books',

    color: 'text-emerald-700',

    bg: 'bg-emerald-50',

    badge: 'bg-emerald-100 text-emerald-700',

    borderColor: 'border-emerald-200',

  },

  {

    value: 'credit_memo',

    label: 'Bank Credit Memo',

    effect: 'add',

    description: 'EFT collection or other credit noted by bank, not yet in GL',

    color: 'text-emerald-700',

    bg: 'bg-emerald-50',

    badge: 'bg-emerald-100 text-emerald-700',

    borderColor: 'border-emerald-200',

  },

  {

    value: 'bank_charges',

    label: 'Bank Service Fee',

    effect: 'deduct',

    description: 'Monthly service charge or fee deducted by the bank, not yet in GL',

    color: 'text-rose-700',

    bg: 'bg-rose-50',

    badge: 'bg-rose-100 text-rose-700',

    borderColor: 'border-rose-200',

  },

  {

    value: 'nsf_checks',

    label: 'NSF / Bounced Check',

    effect: 'deduct',

    description:

      'A customer check deposited that was returned due to insufficient funds',

    color: 'text-rose-700',

    bg: 'bg-rose-50',

    badge: 'bg-rose-100 text-rose-700',

    borderColor: 'border-rose-200',

  },

  {

    value: 'debit_memo',

    label: 'Bank Debit Memo',

    effect: 'deduct',

    description: 'A bank-initiated debit not yet recorded in the books',

    color: 'text-rose-700',

    bg: 'bg-rose-50',

    badge: 'bg-rose-100 text-rose-700',

    borderColor: 'border-rose-200',

  },

  {

    value: 'error_book',

    label: 'Book Error / Correction',

    effect: 'adjustment',

    description: 'A recording error in the GL that must be corrected',

    color: 'text-amber-700',

    bg: 'bg-amber-50',

    badge: 'bg-amber-100 text-amber-700',

    borderColor: 'border-amber-200',

  },

]



const ALL_ITEM_TYPES = [...BANK_SECTION_ITEMS, ...BOOK_SECTION_ITEMS]



const DEMO_RECONCILIATION = {

  bank_statement_balance: 40320.0,

  running_balance: 40320.0,

}



const DEMO_RECONCILIATION_ITEMS = [

  {

    id: 'demo-1',

    date: '2026-05-16',

    section: 'BOOK',

    details: 'interest_income',

    debit: 100.0,

    credit: 0,

  },

  {

    id: 'demo-2',

    date: '2026-05-19',

    section: 'BOOK',

    details: 'credit_memo',

    debit: 1000.0,

    credit: 0,

  },

  {

    id: 'demo-3',

    date: '2026-05-19',

    section: 'BOOK',

    details: 'bank_charges',

    debit: 0,

    credit: 100.0,

  },

  {

    id: 'demo-4',

    date: '2026-05-20',

    section: 'BANK',

    details: 'deposits_in_transit',

    debit: 2000.0,

    credit: 0,

  },

  {

    id: 'demo-5',

    date: '2026-05-20',

    section: 'BANK',

    details: 'outstanding_checks',

    debit: 0,

    credit: 1000.0,

  },

]



const DEMO_MODE =

  import.meta.env.DEV && import.meta.env.VITE_BANK_RECONCILIATION_DEMO === 'true'



export const getItemMeta = (val) => {

  return ALL_ITEM_TYPES.find((t) => t.value === val) || BANK_SECTION_ITEMS[0]

}



export const isBankSectionItem = (val) => {

  return BANK_SECTION_ITEMS.some((t) => t.value === val)

}



export const isBookSectionItem = (val) => {

  return BOOK_SECTION_ITEMS.some((t) => t.value === val)

}



export const getItemSection = (item) => {

  const detailsValue = item.bri_details || item.details || item.item_type

  if (isBankSectionItem(detailsValue)) return 'BANK'

  if (isBookSectionItem(detailsValue)) return 'BOOK'

  if (item.section === 'BOOK' || item.section === 'BANK') return item.section

  return 'BANK'

}



export const fmt = (num) => {

  const n = parseFloat(num)

  if (isNaN(n)) return '0.00'

  return n.toLocaleString('en-US', {

    minimumFractionDigits: 2,

    maximumFractionDigits: 2,

  })

}



export const getItemAmount = (item) => {

  const debit = Math.abs(parseFloat(item.bri_debit || item.debit || 0))

  const credit = Math.abs(parseFloat(item.bri_credit || item.credit || 0))

  const section = getItemSection(item)



  if (section === 'BOOK') {

    return debit > 0 ? debit : credit > 0 ? -credit : 0

  }



  if (section === 'BANK') {

    return debit > 0 ? debit : credit > 0 ? -credit : 0

  }



  return credit - debit

}



const emptyItemForm = () => ({

  date: new Date().toISOString().split('T')[0],

  reference_number: '',

  description: '',

  details: '',

  debit: '',

  credit: '',

  section: 'BANK',

})





export function useBankReconciliation(selectedReconciliation) {

  const [reconData, setReconData] = useState(

    DEMO_MODE ? DEMO_RECONCILIATION : selectedReconciliation,

  )

  const [items, setItems] = useState(DEMO_MODE ? DEMO_RECONCILIATION_ITEMS : [])

  const [itemsLoading, setItemsLoading] = useState(false)



  const [journalEntries, setJournalEntries] = useState([])

  const [journalEntriesLoading, setJournalEntriesLoading] = useState(false)





  const [showItemModal, setShowItemModal] = useState(false)

  const [editingItem, setEditingItem] = useState(null)

  const [itemFormData, setItemFormData] = useState(emptyItemForm())

  const [itemFormRows, setItemFormRows] = useState([emptyItemForm()])



  const [detailStartDate, setDetailStartDate] = useState('')

  const [detailEndDate, setDetailEndDate] = useState('')



  const [bankSearchTerm, setBankSearchTerm] = useState('')

  const [bookSearchTerm, setBookSearchTerm] = useState('')



  const [showToast, setShowToast] = useState(false)

  const [toastMessage, setToastMessage] = useState('')

  const [toastType, setToastType] = useState('success')



  const [bankSectionFilter, setBankSectionFilter] = useState('all')



  const [editingBankBalance, setEditingBankBalance] = useState(false)

  const [bankBalanceInput, setBankBalanceInput] = useState('')



  // Adjustment state for Bank and Book cards

  const [bankAdjustments, setBankAdjustments] = useState([])

  const [bookAdjustments, setBookAdjustments] = useState([])

  const [showBankAdjustmentForm, setShowBankAdjustmentForm] = useState(false)

  const [showBookAdjustmentForm, setShowBookAdjustmentForm] = useState(false)

  const [bankAdjustmentForm, setBankAdjustmentForm] = useState({

    type: '',

    description: '',

    amount: ''

  })

  const [bookAdjustmentForm, setBookAdjustmentForm] = useState({

    type: '',

    description: '',

    amount: ''

  })





  const showToastMsg = (message, type = 'success') => {

    setToastMessage(message)

    setToastType(type)

    setShowToast(true)

    setTimeout(() => setShowToast(false), 3000)

  }



  const buildDateQuery = (start = detailStartDate, end = detailEndDate) => {

    const params = new URLSearchParams()

    if (start) params.append('start_date', start)

    if (end) params.append('end_date', end)

    const queryString = params.toString()

    return queryString ? `?${queryString}` : ''

  }



  const fetchJournalEntriesByCoa = async (

    coaId,

    start = detailStartDate,

    end = detailEndDate,

  ) => {

    try {

      setJournalEntriesLoading(true)

      const token = localStorage.getItem('token')

      const response = await fetch(

        `${import.meta.env.VITE_SERVER_LINK}/journal_entries/coa/${coaId}${buildDateQuery(start, end)}`,

        {

          headers: {

            'Content-Type': 'application/json',

            Authorization: `Bearer ${token}`,

          },

        },

      )

      const result = await response.json()

      if (result.success) {

        setJournalEntries(result.data || [])

      } else {

        showToastMsg('Failed to load journal entries', 'error')

      }

    } catch {

      showToastMsg('Failed to load journal entries', 'error')

    } finally {

      setJournalEntriesLoading(false)

    }

  }





  const fetchReconciliationItems = async (

    startDate = detailStartDate,

    endDate = detailEndDate,

  ) => {

    try {

      setItemsLoading(true)

      const token = localStorage.getItem('token')

      const response = await fetch(

        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/${selectedReconciliation.id}${buildDateQuery(startDate, endDate)}`,

        {

          headers: {

            'Content-Type': 'application/json',

            Authorization: `Bearer ${token}`,

          },

        },

      )

      const result = await response.json()

      if (result.success) {

        setItems(result.data.items || [])

        setReconData(result.data)

        if (result.data.coa_id) {

          fetchJournalEntriesByCoa(result.data.coa_id, startDate, endDate)

        }

        // Fetch adjustments from backend

        fetchAdjustments(startDate, endDate)



        // Set initial date range from fetched items if not already set

        if (!startDate && !endDate && result.data.items && result.data.items.length > 0) {

          const dates = result.data.items

            .map(item => item.bri_date || item.date)

            .filter(date => date)

          if (dates.length > 0) {

            const minDate = new Date(Math.min(...dates.map(d => new Date(d))))

            const maxDate = new Date(Math.max(...dates.map(d => new Date(d))))

            setDetailStartDate(minDate.toISOString().split('T')[0])

            setDetailEndDate(maxDate.toISOString().split('T')[0])

          }

        }

      } else {

        showToastMsg('Failed to load reconciliation items', 'error')

      }

    } catch {

      showToastMsg('Failed to load reconciliation items', 'error')

    } finally {

      setItemsLoading(false)

    }

  }



  const fetchAdjustments = async (startDate = detailStartDate, endDate = detailEndDate) => {

    try {

      const token = localStorage.getItem('token')

      const queryString = buildDateQuery(startDate, endDate)

      const response = await fetch(

        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/${selectedReconciliation.id}/adjustments${queryString}`,

        {

          headers: {

            'Content-Type': 'application/json',

            Authorization: `Bearer ${token}`,

          },

        },

      )

      const result = await response.json()

      if (result.success) {

        const adjustments = result.data || []

        // Separate adjustments by side

        setBankAdjustments(adjustments.filter(adj => adj.side === 'BANK'))

        setBookAdjustments(adjustments.filter(adj => adj.side === 'BOOK'))

      }

    } catch {

      console.error('Failed to load adjustments')

    }

  }



  useEffect(() => {

    if (DEMO_MODE) return

    fetchReconciliationItems()

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [])



  useEffect(() => {

    const delayDebounceFn = setTimeout(() => {

      fetchReconciliationItems(detailStartDate, detailEndDate)

    }, 350)



    return () => clearTimeout(delayDebounceFn)

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [detailStartDate, detailEndDate])



  const handleUpdateBankStatementBalance = async () => {

    const val = parseFloat(bankBalanceInput)

    if (isNaN(val)) {

      showToastMsg('Please enter a valid amount', 'error')

      return

    }



    try {

      const token = localStorage.getItem('token')

      const response = await fetch(

        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/${selectedReconciliation.id}/balance`,

        {

          method: 'PUT',

          headers: {

            'Content-Type': 'application/json',

            Authorization: `Bearer ${token}`,

          },

          body: JSON.stringify({

            running_balance: val,

          }),

        },

      )

      const result = await response.json()

      if (result.success) {

        await fetchReconciliationItems()

        setEditingBankBalance(false)

        showToastMsg('Bank statement balance updated successfully')

      } else {

        showToastMsg(

          result.message || 'Failed to update bank statement balance',

          'error',

        )

      }

    } catch {

      showToastMsg('Server error while updating bank balance', 'error')

    }

  }



  const handleAddOrUpdateItem = async () => {

    const rowsToSave = editingItem ? [itemFormData] : itemFormRows



    const hasInvalidRow = rowsToSave.some((row) => {

      const debit = parseFloat(row.debit) || 0

      const credit = parseFloat(row.credit) || 0

      const detailsValue = row.details

      const meta = getItemMeta(detailsValue)

      const section = isBankSectionItem(detailsValue) ? 'BANK' : 'BOOK'



      const sectionMismatch = row.section && row.section !== section

      const invalidAmount = debit <= 0 && credit <= 0

      const bothAmounts = debit > 0 && credit > 0

      const wrongSideDebit = meta.effect === 'deduct' && debit > 0

      const wrongSideCredit = meta.effect === 'add' && credit > 0



      return (

        !row.date ||

        !row.details ||

        invalidAmount ||

        bothAmounts ||

        sectionMismatch ||

        wrongSideDebit ||

        wrongSideCredit

      )

    })



    if (hasInvalidRow) {

      showToastMsg(

        'Each row must have a Date, Details, and either Debit or Credit greater than 0. Debit-only for additions, Credit-only for deductions.',

        'error',

      )

      return

    }



    try {

      const token = localStorage.getItem('token')



      for (const row of rowsToSave) {

        const debit = parseFloat(row.debit) || 0

        const credit = parseFloat(row.credit) || 0



        const detailsValue = row.details

        const enforcedSection = isBankSectionItem(detailsValue) ? 'BANK' : 'BOOK'

        const payload = {

          bri_date: row.date,

          date: row.date,

          bri_description: row.description || null,

          description: row.description || null,

          bri_reference_number: row.reference_number || null,

          reference_number: row.reference_number || null,

          bri_details: detailsValue,

          details: detailsValue,

          section: enforcedSection,

          bri_debit: debit,

          debit,

          bri_credit: credit,

          credit,

          bri_balance: credit - debit,

          balance: credit - debit,

        }



        let url = `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/item/add`

        let method = 'POST'

        let bodyData = {

          br_id: selectedReconciliation.id,

          bri_br_id: selectedReconciliation.id,

          ...payload,

        }



        if (editingItem) {

          const itemId = editingItem.bri_id || editingItem.id

          url = `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/item/${itemId}`

          method = 'PUT'

          bodyData = payload

        }



        const response = await fetch(url, {

          method,

          headers: {

            'Content-Type': 'application/json',

            Authorization: `Bearer ${token}`,

          },

          body: JSON.stringify(bodyData),

        })



        const result = await response.json()

        if (!result.success) {

          showToastMsg(result.message || 'Failed to save line item', 'error')

          return

        }

      }



      showToastMsg(

        editingItem

          ? 'Item updated successfully'

          : `${rowsToSave.length} item(s) added successfully`,

      )

      await fetchReconciliationItems()

      setShowItemModal(false)

      setEditingItem(null)

      resetItemForm()

    } catch {

      showToastMsg('Server error while saving reconciliation item', 'error')

    }

  }





  const handleEditItem = (item) => {

    const activeDetails = item.bri_details || item.details || item.item_type || ''

    const debit = parseFloat(item.bri_debit || item.debit || 0)

    const credit = parseFloat(item.bri_credit || item.credit || 0)

    const resolvedSection = isBankSectionItem(activeDetails) ? 'BANK' : 'BOOK'



    setEditingItem(item)

    setItemFormData({

      date: item.bri_date || item.date || new Date().toISOString().split('T')[0],

      reference_number: item.bri_reference_number || item.reference_number || '',

      description: item.bri_description || item.description || '',

      details: activeDetails,

      section: item.section || resolvedSection,

      debit: debit > 0 ? debit.toString() : '',

      credit: credit > 0 ? credit.toString() : '',

    })

    setShowItemModal(true)

  }



  const handleDeleteItem = async (itemId) => {

    if (!window.confirm('Are you sure you want to delete this item?')) return



    try {

      const token = localStorage.getItem('token')

      const response = await fetch(

        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/item/${itemId}`,

        {

          method: 'DELETE',

          headers: {

            Authorization: `Bearer ${token}`,

          },

        },

      )

      const result = await response.json()

      if (result.success) {

        showToastMsg('Item deleted successfully')

        fetchReconciliationItems()

      } else {

        showToastMsg(result.message || 'Failed to delete item', 'error')

      }

    } catch {

      showToastMsg('Server error while deleting item', 'error')

    }

  }



  const resetItemForm = () => {

    setItemFormData(emptyItemForm())

    setItemFormRows([emptyItemForm()])

  }





  const updateItemFormRow = (index, field, value) => {

    setItemFormRows((prevRows) =>

      prevRows.map((row, i) => {

        if (i !== index) return row



        if (field === 'details') {

          const section = isBankSectionItem(value) ? 'BANK' : 'BOOK'

          return { ...row, details: value, section }

        }



        if (field === 'debit' && value) {

          return { ...row, debit: value, credit: '' }

        }



        if (field === 'credit' && value) {

          return { ...row, credit: value, debit: '' }

        }



        return { ...row, [field]: value }

      }),

    )

  }





  const addItemFormRow = () => {

    setItemFormRows((prevRows) => [...prevRows, emptyItemForm()])

  }





  const removeItemFormRow = (index) => {

    setItemFormRows((prevRows) =>

      prevRows.length === 1 ? prevRows : prevRows.filter((_, i) => i !== index),

    )

  }



  // Adjustment handlers

  const handleAddBankAdjustment = async () => {

    if (!bankAdjustmentForm.type || !bankAdjustmentForm.amount) {

      showToastMsg('Please select type and enter amount', 'error')

      return

    }

    const amount = parseFloat(bankAdjustmentForm.amount)

    if (isNaN(amount) || amount <= 0) {

      showToastMsg('Please enter a valid amount', 'error')

      return

    }



    try {

      const token = localStorage.getItem('token')

      const response = await fetch(

        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/adjustment/add`,

        {

          method: 'POST',

          headers: {

            'Content-Type': 'application/json',

            Authorization: `Bearer ${token}`,

          },

          body: JSON.stringify({

            br_id: selectedReconciliation.id,

            date: new Date().toISOString().split('T')[0],

            type: bankAdjustmentForm.type,

            description: bankAdjustmentForm.description,

            amount: amount,

            side: 'BANK',

          }),

        },

      )

      const result = await response.json()

      if (result.success) {

        await fetchAdjustments()

        setBankAdjustmentForm({ type: '', description: '', amount: '' })

        setShowBankAdjustmentForm(false)

        showToastMsg('Bank adjustment added successfully')

      } else {

        showToastMsg(result.message || 'Failed to add bank adjustment', 'error')

      }

    } catch {

      showToastMsg('Server error while adding bank adjustment', 'error')

    }

  }



  const handleAddBookAdjustment = async () => {

    if (!bookAdjustmentForm.type || !bookAdjustmentForm.amount) {

      showToastMsg('Please select type and enter amount', 'error')

      return

    }

    const amount = parseFloat(bookAdjustmentForm.amount)

    if (isNaN(amount) || amount <= 0) {

      showToastMsg('Please enter a valid amount', 'error')

      return

    }



    try {

      const token = localStorage.getItem('token')

      const response = await fetch(

        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/adjustment/add`,

        {

          method: 'POST',

          headers: {

            'Content-Type': 'application/json',

            Authorization: `Bearer ${token}`,

          },

          body: JSON.stringify({

            br_id: selectedReconciliation.id,

            date: new Date().toISOString().split('T')[0],

            type: bookAdjustmentForm.type,

            description: bookAdjustmentForm.description,

            amount: amount,

            side: 'BOOK',

          }),

        },

      )

      const result = await response.json()

      if (result.success) {

        await fetchAdjustments()

        setBookAdjustmentForm({ type: '', description: '', amount: '' })

        setShowBookAdjustmentForm(false)

        showToastMsg('Book adjustment added successfully')

      } else {

        showToastMsg(result.message || 'Failed to add book adjustment', 'error')

      }

    } catch {

      showToastMsg('Server error while adding book adjustment', 'error')

    }

  }



  const handleRemoveBankAdjustment = async (id) => {

    try {

      const token = localStorage.getItem('token')

      const response = await fetch(

        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/adjustment/${id}`,

        {

          method: 'DELETE',

          headers: {

            Authorization: `Bearer ${token}`,

          },

        },

      )

      const result = await response.json()

      if (result.success) {

        await fetchAdjustments()

        showToastMsg('Bank adjustment removed successfully')

      } else {

        showToastMsg(result.message || 'Failed to remove bank adjustment', 'error')

      }

    } catch {

      showToastMsg('Server error while removing bank adjustment', 'error')

    }

  }



  const handleRemoveBookAdjustment = async (id) => {

    try {

      const token = localStorage.getItem('token')

      const response = await fetch(

        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/adjustment/${id}`,

        {

          method: 'DELETE',

          headers: {

            Authorization: `Bearer ${token}`,

          },

        },

      )

      const result = await response.json()

      if (result.success) {

        await fetchAdjustments()

        showToastMsg('Book adjustment removed successfully')

      } else {

        showToastMsg(result.message || 'Failed to remove book adjustment', 'error')

      }

    } catch {

      showToastMsg('Server error while removing book adjustment', 'error')

    }

  }





  const bankSectionItems = items.filter((item) => getItemSection(item) === 'BANK')

  const bookSectionItems = items.filter((item) => getItemSection(item) === 'BOOK')



  const depositsInTransit = bankSectionItems

    .filter(

      (item) =>

        (item.bri_details || item.details || item.item_type) ===

        'deposits_in_transit',

    )

    .reduce((sum, item) => {

      const debit = Math.abs(parseFloat(item.bri_debit || item.debit || 0))

      return sum + debit

    }, 0)



  const outstandingChecks = bankSectionItems

    .filter(

      (item) =>

        (item.bri_details || item.details || item.item_type) ===

        'outstanding_checks',

    )

    .reduce((sum, item) => {

      const credit = Math.abs(parseFloat(item.bri_credit || item.credit || 0))

      return sum + credit

    }, 0)



  const bankErrors = bankSectionItems

    .filter(

      (item) =>

        (item.bri_details || item.details || item.item_type) === 'error_bank',

    )

    .reduce((sum, item) => {

      const c = parseFloat(item.bri_credit || item.credit || 0)

      const d = parseFloat(item.bri_debit || item.debit || 0)

      return sum + (c - d)

    }, 0)



  const bankStatementEndingBalance = parseFloat(

    reconData?.bank_statement_balance || 0,

  )



  const bankAdditions = bankSectionItems.reduce((sum, item) => {

    const debit = Math.abs(parseFloat(item.bri_debit || item.debit || 0))

    return sum + debit

  }, 0)



  const bankDeductions = bankSectionItems.reduce((sum, item) => {

    const credit = Math.abs(parseFloat(item.bri_credit || item.credit || 0))

    return sum + credit

  }, 0)



  // Calculate bank adjustments from the card adjustments

  const bankCardAdditions = bankAdjustments

    .filter(adj => adj.type === 'deposits_in_transit')

    .reduce((sum, adj) => sum + adj.amount, 0)



  const bankCardDeductions = bankAdjustments

    .filter(adj => adj.type === 'outstanding_checks')

    .reduce((sum, adj) => sum + adj.amount, 0)



  const bankCardErrors = bankAdjustments

    .filter(adj => adj.type === 'error_bank')

    .reduce((sum, adj) => {

      const meta = getItemMeta(adj.type)

      return sum + (meta.effect === 'add' ? adj.amount : -adj.amount)

    }, 0)



  const adjustedBankBalance =

    bankStatementEndingBalance + bankAdditions + bankCardAdditions - bankDeductions - bankCardDeductions + bankCardErrors



  const glDebits = journalEntries

    .filter((e) => e.type?.toLowerCase() === 'debit')

    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)



  const glCredits = journalEntries

    .filter((e) => e.type?.toLowerCase() === 'credit')

    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)



  const unadjustedBookBalance = glDebits - glCredits

  const endingBookBalance =

    journalEntries.length > 0

      ? unadjustedBookBalance

      : parseFloat(reconData?.running_balance || 0)



  const bookAdditions = bookSectionItems

    .filter(

      (item) =>

        getItemMeta(item.bri_details || item.details || item.item_type).effect ===

        'add',

    )

    .reduce((sum, item) => {

      const d = Math.abs(parseFloat(item.bri_debit || item.debit || 0))

      const c = Math.abs(parseFloat(item.bri_credit || item.credit || 0))

      return sum + Math.max(d, c)

    }, 0)



  const bookDeductions = bookSectionItems

    .filter(

      (item) =>

        getItemMeta(item.bri_details || item.details || item.item_type).effect ===

        'deduct',

    )

    .reduce((sum, item) => {

      const d = Math.abs(parseFloat(item.bri_debit || item.debit || 0))

      const c = Math.abs(parseFloat(item.bri_credit || item.credit || 0))

      return sum + Math.max(d, c)

    }, 0)



  const bookErrorAdjustments = bookSectionItems

    .filter(

      (item) =>

        (item.bri_details || item.details || item.item_type) === 'error_book',

    )

    .reduce((sum, item) => {

      const c = parseFloat(item.bri_credit || item.credit || 0)

      const d = parseFloat(item.bri_debit || item.debit || 0)

      return sum + (c - d)

    }, 0)



  // Calculate book adjustments from the card adjustments

  const bookCardAdditions = bookAdjustments

    .filter(adj => {

      const meta = getItemMeta(adj.type)

      return meta.effect === 'add'

    })

    .reduce((sum, adj) => sum + adj.amount, 0)



  const bookCardDeductions = bookAdjustments

    .filter(adj => {

      const meta = getItemMeta(adj.type)

      return meta.effect === 'deduct'

    })

    .reduce((sum, adj) => sum + adj.amount, 0)



  const bookCardErrors = bookAdjustments

    .filter(adj => adj.type === 'error_book')

    .reduce((sum, adj) => {

      const meta = getItemMeta(adj.type)

      return sum + (meta.effect === 'add' ? adj.amount : -adj.amount)

    }, 0)



  const adjustedBookBalance =

    endingBookBalance + bookAdditions + bookCardAdditions - bookDeductions - bookCardDeductions + bookErrorAdjustments + bookCardErrors



  const reconDifference = adjustedBookBalance - adjustedBankBalance

  const isReconciled = Math.abs(reconDifference) < 0.005



  const allBankItemsFiltered =

    bankSectionFilter === 'bank'

      ? bankSectionItems

      : bankSectionFilter === 'book'

        ? bookSectionItems

        : items



  const bankSearch = bankSearchTerm.toLowerCase().trim()

  const visibleBankItems = bankSearch

    ? allBankItemsFiltered.filter((item) =>

        [

          item.bri_date || item.date,

          item.bri_reference_number || item.reference_number,

          item.bri_description || item.description,

          getItemMeta(item.bri_details || item.details || item.item_type).label,

        ]

          .filter(Boolean)

          .some((v) => String(v).toLowerCase().includes(bankSearch)),

      )

    : allBankItemsFiltered



  const bookSearch = bookSearchTerm.toLowerCase().trim()

  const visibleJournalEntries = bookSearch

    ? journalEntries.filter((entry) =>

        [

          entry.date,

          entry.db_name,

          entry.responsibility_center,

          entry.coa_name,

          entry.type,

          entry.amount,

        ]

          .filter(Boolean)

          .some((v) => String(v).toLowerCase().includes(bookSearch)),

      )

    : journalEntries





  return {

    reconData,

    items,

    itemsLoading,

    journalEntries,

    journalEntriesLoading,

    showItemModal,

    setShowItemModal,

    editingItem,

    setEditingItem,

    itemFormData,

    setItemFormData,

    itemFormRows,

    detailStartDate,

    setDetailStartDate,

    detailEndDate,

    setDetailEndDate,

    bankSearchTerm,

    setBankSearchTerm,

    bookSearchTerm,

    setBookSearchTerm,

    showToast,

    setShowToast,

    toastMessage,

    toastType,

    bankSectionFilter,

    setBankSectionFilter,

    editingBankBalance,

    setEditingBankBalance,

    bankBalanceInput,

    setBankBalanceInput,

    fetchReconciliationItems,

    handleUpdateBankStatementBalance,

    handleAddOrUpdateItem,

    handleEditItem,

    handleDeleteItem,

    resetItemForm,

    updateItemFormRow,

    addItemFormRow,

    removeItemFormRow,

    depositsInTransit,

    outstandingChecks,

    bankAdditions,

    bankDeductions,

    bankErrors,

    bankStatementEndingBalance,

    endingBankStatementBalance: bankStatementEndingBalance,

    adjustedBankBalance,

    glDebits,

    glCredits,

    unadjustedBookBalance,

    endingBookBalance,

    bookAdditions,

    bookDeductions,

    bookErrorAdjustments,

    adjustedBookBalance,

    reconDifference,

    isReconciled,

    visibleBankItems,

    visibleJournalEntries,

    BANK_SECTION_ITEMS,

    BOOK_SECTION_ITEMS,

    // Adjustment state and handlers

    bankAdjustments,

    setBankAdjustments,

    bookAdjustments,

    setBookAdjustments,

    showBankAdjustmentForm,

    setShowBankAdjustmentForm,

    showBookAdjustmentForm,

    setShowBookAdjustmentForm,

    bankAdjustmentForm,

    setBankAdjustmentForm,

    bookAdjustmentForm,

    setBookAdjustmentForm,

    handleAddBankAdjustment,

    handleAddBookAdjustment,

    handleRemoveBankAdjustment,

    handleRemoveBookAdjustment,

    bankCardAdditions,

    bankCardDeductions,

    bankCardErrors,

    bookCardAdditions,

    bookCardDeductions,

    bookCardErrors,

  }

}

