import { useState, useEffect } from 'react'
import { API } from '../../api/endpoints'
import {
  downloadCsv,
  parseCsv,
  toCsvContent,
} from '../../utils/csv'

export const VENDOR_EXPORT_HEADERS = [
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

export const formatTinInput = (value) => {
  const digits = String(value || '')
    .replace(/\D/g, '')
    .slice(0, 14)

  if (digits.length === 0) return ''
  if (digits.length <= 3) return digits

  const parts = []
  // 3-3-3-5 format
  parts.push(digits.slice(0, 3))
  if (digits.length > 3) parts.push(digits.slice(3, 6))
  if (digits.length > 6) parts.push(digits.slice(6, 9))
  if (digits.length > 9) parts.push(digits.slice(9, 14))

  return parts.join('-')
}

const useVendors = () => {
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [toast, setToast] = useState(null)
  const [importing, setImporting] = useState(false)

  const showToast = (type, message) => setToast({ type, message })
  const closeToast = () => setToast(null)

  const fetchVendors = async () => {
    try {
      setLoading(true)
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }
      const response = await fetch(API.vendors(), {
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
        setVendors(result.data)
      } else {
        setError(result.message || 'Failed to fetch vendors')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVendors()
  }, [])

  const createVendor = async (
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

      const response = await fetch(API.vendors(), {
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
        // Refresh the vendors list
        await fetchVendors()
        return { success: true, data: result.data }
      } else {
        return {
          success: false,
          message: result.message || 'Failed to create vendor',
        }
      }
    } catch (err) {
      console.error('Error creating vendor:', err.message)
      return { success: false, message: err.message }
    }
  }

  const updateVendor = async (
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
        API.vendorsById(id),
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
        await fetchVendors()
        return { success: true, data: result.data }
      }

      return { success: false, message: result.message || 'Failed to update vendor' }
    } catch (err) {
      console.error('Error updating vendor:', err.message)
      return { success: false, message: err.message }
    }
  }

  const importVendors = async (vendors) => {
    try {
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(API.vendorsImport(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ vendors }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        await fetchVendors()
        return { success: true, data: result.data }
      } else {
        return { success: false, message: result.message || 'Failed to import vendors' }
      }
    } catch (err) {
      return { success: false, message: err.message }
    }
  }

  // Modal + form wiring.
  const openModal = (vendor = null) => {
    if (vendor) {
      setEditingVendor(vendor)
      setFormData({
        code: vendor.code || '',
        name: vendor.name || '',
        category: vendor.category || '',
        type: vendor.type || '',
        address: vendor.address || '',
        tin: formatTinInput(vendor.tin || ''),
        details: vendor.details || '',
        contact: vendor.contact || '',
        status:
          vendor.status?.toLowerCase() === 'inactive'
            ? 'inactive'
            : vendor.status?.toLowerCase() === 'active'
              ? 'active'
              : 'active',
      })
    } else {
      setEditingVendor(null)
      setFormData(EMPTY_FORM)
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingVendor(null)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleTinChange = (e) => {
    setFormData((prev) => ({ ...prev, tin: formatTinInput(e.target.value) }))
  }

  const handleContactChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      contact: e.target.value.slice(0, 15),
    }))
  }

  // Registry export.
  const handleExportVendors = () => {
    try {
      if (!vendors || vendors.length === 0) {
        showToast('error', 'No vendors to export')
        return
      }

      const csvContent = toCsvContent(VENDOR_EXPORT_HEADERS, vendors)
      downloadCsv(csvContent, `vendors_${Date.now()}.csv`)
      showToast('success', 'Export started')
    } catch {
      showToast('error', 'Failed to export CSV')
    }
  }

  const handleImportVendors = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      showToast('error', 'Please select a CSV file')
      return
    }

    setImporting(true)
    try {
      const text = await file.text()
      const vendorsList = parseCsv(text)

      if (vendorsList.length === 0) {
        showToast('error', 'No valid vendors found in CSV')
        return
      }

      const result = await importVendors(vendorsList)

      if (result.success) {
        const { created, updated, errors } = result.data
        showToast(
          'success',
          `Import completed: ${created.length} created, ${updated.length} updated${errors.length > 0 ? `, ${errors.length} errors` : ''}`,
        )
      } else {
        showToast('error', result.message || 'Failed to import vendors')
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
      const result = editingVendor
        ? await updateVendor(
            editingVendor.id,
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
        : await createVendor(
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
          `Vendor "${formData.name}" ${editingVendor ? 'updated' : 'created'} successfully!`,
        )
        closeModal()
      } else {
        showToast(
          'error',
          result.message ||
            `Failed to ${editingVendor ? 'update' : 'create'} vendor`,
        )
      }
    } catch {
      showToast(
        'error',
        `Network error occurred while ${editingVendor ? 'updating' : 'creating'} vendor`,
      )
    }
  }

  return {
    vendors,
    loading,
    error,
    createVendor,
    updateVendor,
    importVendors,
    isModalOpen,
    editingVendor,
    formData,
    toast,
    importing,
    openModal,
    closeModal,
    handleInputChange,
    handleTinChange,
    handleContactChange,
    handleExportVendors,
    handleImportVendors,
    handleSubmit,
    closeToast,
  }
}

export default useVendors
