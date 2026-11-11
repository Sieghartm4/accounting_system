import { useState, useEffect } from 'react'
import { API } from '../../api/endpoints'
import { toCsvContent, CSV_EXCLUDE_COLUMNS, parseCsv, downloadCsv } from '../../utils/csv'

// TIN display format helpers (3-3-3-5 digits, dash separated).
export const formatTinInput = (value) => {
  const digits = String(value || '')
    .replace(/\D/g, '')
    .slice(0, 14)

  if (digits.length === 0) return ''
  if (digits.length <= 3) return digits

  const parts = []
  parts.push(digits.slice(0, 3))
  if (digits.length > 3) parts.push(digits.slice(3, 6))
  if (digits.length > 6) parts.push(digits.slice(6, 9))
  if (digits.length > 9) parts.push(digits.slice(9, 14))

  return parts.join('-')
}

const CUSTOMER_EXPORT_HEADERS = [
  'id',
  'code',
  'name',
  'category',
  'type',
  'address',
  'tin',
  'details',
  'contact',
  'status',
]

const EMPTY_FORM = {
  code: '',
  name: '',
  category: '',
  type: '',
  address: '',
  tin: '',
  details: '',
  contact: '',
  status: 'active',
}

const useCustomer = () => {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [toast, setToast] = useState(null)
  const [importing, setImporting] = useState(false)

  const showToast = (type, message) => setToast({ type, message })

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }
      const response = await fetch(API.customer(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        setCustomers(result.data)
      } else {
        setError(result.message || 'Failed to fetch customers')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  const createCustomer = async (
    code,
    name,
    category,
    type,
    address,
    tin,
    details,
    contact,
  ) => {
    try {
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(API.customer(), {
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
          address,
          tin,
          details,
          contact,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        // Refresh the customers list
        await fetchCustomers()
        return { success: true, data: result.data }
      } else {
        return {
          success: false,
          message: result.message || 'Failed to create customer',
        }
      }
    } catch (err) {
      console.error('Error creating customer:', err.message)
      return { success: false, message: err.message }
    }
  }

  const updateCustomer = async (
    id,
    code,
    name,
    category,
    type,
    address,
    tin,
    details,
    contact,
    status,
  ) => {
    try {
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.customerById(id),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            id,
            code,
            name,
            category,
            type,
            address,
            tin,
            details,
            contact,
            status,
          }),
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        await fetchCustomers()
        return { success: true, data: result.data }
      }

      return {
        success: false,
        message: result.message || 'Failed to update customer',
      }
    } catch (err) {
      console.error('Error updating customer:', err.message)
      return { success: false, message: err.message }
    }
  }

  const importCustomers = async (customers) => {
    try {
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(API.customerImport(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ customers }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        await fetchCustomers()
        return { success: true, data: result.data }
      } else {
        return { success: false, message: result.message || 'Failed to import customers' }
      }
    } catch (err) {
      return { success: false, message: err.message }
    }
  }

  // Modal + form wiring.
  const openModal = (customerData = null) => {
    if (customerData) {
      setEditingCustomer(customerData)
      setFormData({
        code: customerData.code || '',
        name: customerData.name || '',
        category: customerData.category || '',
        type: customerData.type || '',
        address: customerData.address || '',
        tin: formatTinInput(customerData.tin || ''),
        details: customerData.details || '',
        contact: customerData.contact || '',
        status:
          customerData.status?.toLowerCase() === 'inactive'
            ? 'inactive'
            : customerData.status?.toLowerCase() === 'active'
              ? 'active'
              : 'active',
      })
    } else {
      setEditingCustomer(null)
      setFormData(EMPTY_FORM)
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingCustomer(null)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Apply the TIN display mask while typing.
  const handleTinChange = (e) => {
    setFormData((prev) => ({ ...prev, tin: formatTinInput(e.target.value) }))
  }

  // Cap the contact number at 15 characters while typing.
  const handleContactChange = (e) => {
    setFormData((prev) => ({ ...prev, contact: e.target.value.slice(0, 15) }))
  }

  const exportCustomers = () => {
    try {
      if (!customers || customers.length === 0) {
        showToast('error', 'No customers to export')
        return
      }

      const csvContent = toCsvContent(CUSTOMER_EXPORT_HEADERS, customers)
      downloadCsv(csvContent, `customers_${Date.now()}.csv`)
      showToast('success', 'Export started')
    } catch {
      showToast('error', 'Failed to export CSV')
    }
  }

  const importCustomersFromFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      showToast('error', 'Please select a CSV file')
      return
    }

    setImporting(true)
    try {
      const text = await file.text()
      const customersList = parseCsv(text)

      if (customersList.length === 0) {
        showToast('error', 'No valid customers found in CSV')
        return
      }

      const result = await importCustomers(customersList)

      if (result.success) {
        const { created, updated, errors } = result.data
        showToast(
          'success',
          `Import completed: ${created.length} created, ${updated.length} updated${errors.length > 0 ? `, ${errors.length} errors` : ''}`,
        )
      } else {
        showToast('error', result.message || 'Failed to import customers')
      }
    } catch (err) {
      console.error('Import error:', err)
      showToast('error', 'Failed to read CSV file')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const sanitizedTin = formData.tin.replace(/\D/g, '')
      const result = editingCustomer
        ? await updateCustomer(
            editingCustomer.id,
            formData.code,
            formData.name,
            formData.category,
            formData.type,
            formData.address,
            sanitizedTin,
            formData.details,
            formData.contact,
            formData.status,
          )
        : await createCustomer(
            formData.code,
            formData.name,
            formData.category,
            formData.type,
            formData.address,
            sanitizedTin,
            formData.details,
            formData.contact,
          )

      if (result.success) {
        showToast(
          'success',
          `Customer "${formData.name}" ${editingCustomer ? 'updated' : 'created'} successfully!`,
        )
        closeModal()
      } else {
        showToast(
          'error',
          result.message ||
            `Failed to ${editingCustomer ? 'update' : 'create'} customer`,
        )
      }
    } catch {
      showToast(
        'error',
        `Network error occurred while ${editingCustomer ? 'updating' : 'creating'} customer`,
      )
    }
  }

  return {
    customers,
    loading,
    error,
    createCustomer,
    updateCustomer,
    importCustomers,
    isModalOpen,
    editingCustomer,
    formData,
    toast,
    importing,
    openModal,
    closeModal,
    handleInputChange,
    handleTinChange,
    handleContactChange,
    exportCustomers,
    importCustomersFromFile,
    handleSubmit,
    closeToast: () => setToast(null),
  }
}

export default useCustomer
