import { useState, useEffect } from 'react'
import { API } from '../../api/endpoints'
import { downloadCsv, objectsToCsv, parseCsv } from '../../utils/csv'

export const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE']

export const DEPARTMENT_OPTIONS = [
  { label: 'IT', value: 'IT' },
  { label: 'CABLING', value: 'CABLING' },
  { label: 'SHELL', value: 'SHELL' },
  { label: 'FINANCE', value: 'FINANCE' },
  { label: 'R&D', value: 'R&D' },
  { label: 'ADMIN', value: 'ADMIN' },
  { label: 'PERSONAL', value: 'PERSONAL' },
  { label: 'SALES', value: 'SALES' },
]

const EMPTY_FORM = {
  id: '',
  code: '',
  name: '',
  department: '',
  status: 'ACTIVE',
}

const useResponsibilityCenter = () => {
  const [responsibilityCenters, setResponsibilityCenters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCenter, setEditingCenter] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [toast, setToast] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [importing, setImporting] = useState(false)

  const showToast = (type, message) => setToast({ type, message })
  const closeToast = () => setToast(null)

  const fetchResponsibilityCenters = async () => {
    try {
      setLoading(true)
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.responsibilityCenter(),
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      if (result.success) {
        setResponsibilityCenters(result.data || [])
      } else {
        setError(result.message || 'Failed to fetch responsibility center data')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const createResponsibilityCenter = async (centerData) => {
    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.responsibilityCenter(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(centerData),
        },
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        await fetchResponsibilityCenters()
        return { success: true, data: result.data }
      }

      return { success: false, error: result.message }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  const updateResponsibilityCenter = async (id, centerData) => {
    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.responsibilityCenterById(id),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(centerData),
        },
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        await fetchResponsibilityCenters()
        return { success: true, data: result.data }
      }

      return { success: false, error: result.message }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  const importResponsibilityCenters = async (centers) => {
    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.responsibilityCenterImport(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ centers }),
        },
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        await fetchResponsibilityCenters()
        return { success: true, data: result.data }
      }

      return { success: false, message: result.message }
    } catch (err) {
      return { success: false, message: err.message }
    }
  }

  useEffect(() => {
    fetchResponsibilityCenters()
  }, [])

  // Modal + form wiring.
  const openModal = (center = null) => {
    if (center) {
      setEditingCenter(center)
      setFormData({
        id: center.id || '',
        code: center.code || '',
        name: center.name || '',
        department: center.department || '',
        status: center.status || 'ACTIVE',
      })
    } else {
      setEditingCenter(null)
      setFormData(EMPTY_FORM)
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingCenter(null)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    let result
    if (editingCenter) {
      result = await updateResponsibilityCenter(editingCenter.id, formData)
    } else {
      result = await createResponsibilityCenter(formData)
    }

    if (result.success) {
      showToast(
        'success',
        `Responsibility center ${editingCenter ? 'updated' : 'created'} successfully`,
      )
      setFormData(EMPTY_FORM)
      setEditingCenter(null)
      setIsModalOpen(false)
    } else {
      showToast(
        'error',
        result.error ||
          `Failed to ${editingCenter ? 'update' : 'create'} responsibility center`,
      )
    }

    setIsSubmitting(false)
  }

  // Catalog export.
  const handleExport = () => {
    try {
      if (
        !Array.isArray(responsibilityCenters) ||
        responsibilityCenters.length === 0
      ) {
        showToast('error', 'No responsibility center data to export')
        return
      }

      const csvContent = objectsToCsv(responsibilityCenters)
      downloadCsv(csvContent, `responsibility_center_${Date.now()}.csv`)
      showToast('success', 'Export started')
    } catch {
      showToast('error', 'Failed to export responsibility center data')
    }
  }

  const handleImportResponsibilityCenter = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      showToast('error', 'Please select a CSV file')
      return
    }

    setImporting(true)
    try {
      const text = await file.text()
      const centers = parseCsv(text)

      if (centers.length === 0) {
        showToast('error', 'No valid centers found in CSV')
        return
      }

      const result = await importResponsibilityCenters(centers)

      if (result.success) {
        const { created, updated, errors } = result.data
        showToast(
          'success',
          `Import completed: ${created.length} created, ${updated.length} updated${errors.length > 0 ? `, ${errors.length} errors` : ''}`,
        )
      } else {
        showToast(
          'error',
          result.message || 'Failed to import responsibility centers',
        )
      }
    } catch (err) {
      console.error('Import error:', err)
      showToast('error', 'Failed to read CSV file')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return {
    responsibilityCenters,
    loading,
    error,
    createResponsibilityCenter,
    updateResponsibilityCenter,
    refreshResponsibilityCenters: fetchResponsibilityCenters,
    importResponsibilityCenters,
    isModalOpen,
    editingCenter,
    formData,
    toast,
    isSubmitting,
    importing,
    openModal,
    closeModal,
    handleInputChange,
    handleSubmit,
    handleExport,
    handleImportResponsibilityCenter,
    closeToast,
  }
}

export default useResponsibilityCenter
