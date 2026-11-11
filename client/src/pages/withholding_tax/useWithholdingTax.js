import { useState, useEffect } from 'react'
import { API } from '../../api/endpoints'
import { downloadCsv, objectsToCsv, parseCsv } from '../../utils/csv'

export const WITHHOLDING_TAX_STATUSES = ['ACTIVE', 'INACTIVE']

const EMPTY_FORM = {
  id: '',
  code: '',
  name: '',
  rate: '',
  tax_account: '',
  description: '',
  status: 'ACTIVE',
}

export const formatRate = (rate) => `${rate}%`

const useWithholdingTax = () => {
  const [withholdingTax, setWithholdingTax] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingWithholdingTax, setEditingWithholdingTax] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [toast, setToast] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [importing, setImporting] = useState(false)

  const showToast = (type, message) => setToast({ type, message })
  const closeToast = () => setToast(null)

  const fetchWithholdingTax = async () => {
    try {
      setLoading(true)
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }
      const response = await fetch(
        API.withholdingTax(),
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
        setWithholdingTax(result.data)
      } else {
        setError(result.message || 'Failed to fetch Withholding Tax data')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const createWithholdingTaxEntry = async (withholdingTaxData) => {
    try {
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.withholdingTax(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(withholdingTaxData),
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        // Refresh Withholding Tax list
        await fetchWithholdingTax()
        return { success: true, data: result.data }
      } else {
        return { success: false, error: result.message }
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  const updateWithholdingTaxEntry = async (id, withholdingTaxData) => {
    try {
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.withholdingTaxById(id),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(withholdingTaxData),
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        // Refresh Withholding Tax list
        await fetchWithholdingTax()
        return { success: true, data: result.data }
      } else {
        return { success: false, error: result.message }
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  const importWithholdingTax = async (taxes) => {
    try {
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.withholdingTaxImport(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ taxes }),
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        await fetchWithholdingTax()
        return { success: true, data: result.data }
      } else {
        return { success: false, message: result.message || 'Failed to import withholding tax' }
      }
    } catch (err) {
      return { success: false, message: err.message }
    }
  }

  useEffect(() => {
    fetchWithholdingTax()
  }, [])

  // Modal + form wiring.
  const openModal = (withholdingTaxData = null) => {
    if (withholdingTaxData) {
      setEditingWithholdingTax(withholdingTaxData)
      setFormData({
        id: withholdingTaxData.id || '',
        code: withholdingTaxData.code || '',
        name: withholdingTaxData.name || '',
        rate: withholdingTaxData.rate || '',
        tax_account: withholdingTaxData.tax_account || '',
        description: withholdingTaxData.description || '',
        status: withholdingTaxData.status || 'ACTIVE',
      })
    } else {
      setEditingWithholdingTax(null)
      setFormData(EMPTY_FORM)
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingWithholdingTax(null)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    let result
    if (editingWithholdingTax) {
      result = await updateWithholdingTaxEntry(editingWithholdingTax.id, formData)
    } else {
      result = await createWithholdingTaxEntry(formData)
    }

    if (result.success) {
      showToast(
        'success',
        `Withholding Tax entry ${editingWithholdingTax ? 'updated' : 'created'} successfully!`,
      )
      setFormData(EMPTY_FORM)
      setEditingWithholdingTax(null)
      setIsModalOpen(false)
    } else {
      showToast(
        'error',
        result.error ||
          `Failed to ${editingWithholdingTax ? 'update' : 'create'} Withholding Tax entry`,
      )
    }

    setIsSubmitting(false)
  }

  // Registry export.
  const handleExportWithholdingTax = () => {
    try {
      if (!Array.isArray(withholdingTax) || withholdingTax.length === 0) {
        showToast('error', 'No withholding tax data to export')
        return
      }

      const csvContent = objectsToCsv(withholdingTax)
      downloadCsv(csvContent, `withholding_tax_${Date.now()}.csv`)
      showToast('success', 'Export started')
    } catch {
      showToast('error', 'Failed to export withholding tax data')
    }
  }

  const handleImportWithholdingTax = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      showToast('error', 'Please select a CSV file')
      return
    }

    setImporting(true)
    try {
      const text = await file.text()
      const taxes = parseCsv(text)

      if (taxes.length === 0) {
        showToast('error', 'No valid tax entries found in CSV')
        return
      }

      const result = await importWithholdingTax(taxes)

      if (result.success) {
        const { created, updated, errors } = result.data
        showToast(
          'success',
          `Import completed: ${created.length} created, ${updated.length} updated${errors.length > 0 ? `, ${errors.length} errors` : ''}`,
        )
      } else {
        showToast(
          'error',
          result.message || 'Failed to import withholding tax entries',
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
    withholdingTax,
    loading,
    error,
    createWithholdingTaxEntry,
    updateWithholdingTaxEntry,
    refreshWithholdingTax: fetchWithholdingTax,
    importWithholdingTax,
    isModalOpen,
    editingWithholdingTax,
    formData,
    toast,
    isSubmitting,
    importing,
    openModal,
    closeModal,
    handleInputChange,
    handleSubmit,
    handleExportWithholdingTax,
    handleImportWithholdingTax,
    closeToast,
  }
}

export default useWithholdingTax
