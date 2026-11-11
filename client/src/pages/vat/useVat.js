import { useState, useEffect, useMemo } from 'react'
import { API } from '../../api/endpoints'

// -------------------------------------------------------------------------
// Options and formatting helpers
// -------------------------------------------------------------------------

export const VAT_TYPES = ['Zero-rated', 'Vatable', 'Exempt']
export const VAT_SUB_TYPES = ['Services', 'Goods Other Than Capital Goods', 'Capital Goods']
export const VAT_STATUSES = ['ACTIVE', 'INACTIVE']

const EMPTY_FORM = {
  id: '',
  code: '',
  name: '',
  rate: '',
  type: '',
  sub_type: '',
  description: '',
  status: 'ACTIVE',
}

const formatRate = (rate) => `${rate}%`

const buildCsvContent = (rows) => {
  const exclude = new Set(['id', '_id', 'action'])
  const headers = Object.keys(rows[0] || {}).filter((h) => !exclude.has(h))

  const csvRows = [headers.join(',')]
  rows.forEach((row) => {
    const values = headers.map((h) => {
      let val = row[h]
      if (val === null || val === undefined) return ''
      if (typeof val === 'object') {
        try {
          val = JSON.stringify(val)
        } catch {
          val = String(val)
        }
      }
      const escaped = String(val).replace(/"/g, '""')
      return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
    })
    csvRows.push(values.join(','))
  })
  return csvRows.join('\n')
}

const parseCSVLine = (line) => {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

const parseCSV = (csvText) => {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  const exclude = new Set(['id', '_id', 'action'])
  const validHeaders = headers.filter((h) => !exclude.has(h))

  const vats = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length !== headers.length) continue

    const vat = {}
    validHeaders.forEach((header, index) => {
      vat[header] = values[index]
    })
    vats.push(vat)
  }

  return vats
}

const authHeaders = () => {
  const token = sessionStorage.getItem('authenticated')
  if (!token) throw new Error('No authorization token found')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

// -------------------------------------------------------------------------
// Hook: data, form state, and every handler the VAT page needs
// -------------------------------------------------------------------------

const useVat = () => {
  const [vat, setVat] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingVat, setEditingVat] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [importing, setImporting] = useState(false)

  const fetchVat = async () => {
    try {
      setLoading(true)
      const response = await fetch(API.vat(), {
        method: 'GET',
        headers: authHeaders(),
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        setVat(result.data)
      } else {
        setError(result.message || 'Failed to fetch VAT data')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const createVatEntry = async (vatData) => {
    try {
      const response = await fetch(API.vat(), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(vatData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        // Refresh the VAT list
        await fetchVat()
        return { success: true, data: result.data }
      } else {
        return { success: false, error: result.message }
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  const updateVatEntry = async (id, vatData) => {
    try {
      const response = await fetch(API.vatById(id), {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(vatData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        // Refresh the VAT list
        await fetchVat()
        return { success: true, data: result.data }
      } else {
        return { success: false, error: result.message }
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  const importVat = async (vats) => {
    try {
      const response = await fetch(API.vatImport(), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ vats }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        await fetchVat()
        return { success: true, data: result.data }
      } else {
        return { success: false, message: result.message || 'Failed to import VAT' }
      }
    } catch (err) {
      return { success: false, message: err.message }
    }
  }

  useEffect(() => {
    fetchVat()
  }, [])

  // Rows prepared for the table (rate shown with its % sign).
  const vatDisplay = useMemo(
    () => vat.map((item) => ({ ...item, rate: formatRate(item.rate) })),
    [vat],
  )

  const exportVat = () => {
    try {
      if (!Array.isArray(vat) || vat.length === 0) {
        setToast({ type: 'error', message: 'No VAT data to export' })
        return
      }

      const csvContent = buildCsvContent(vat)
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `vat_data_${Date.now()}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setToast({ type: 'success', message: 'Export started' })
    } catch {
      setToast({ type: 'error', message: 'Failed to export VAT data' })
    }
  }

  const importVatFromFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setToast({ type: 'error', message: 'Please select a CSV file' })
      return
    }

    setImporting(true)
    try {
      const text = await file.text()
      const vats = parseCSV(text)

      if (vats.length === 0) {
        setToast({ type: 'error', message: 'No valid VAT entries found in CSV' })
        return
      }

      const result = await importVat(vats)

      if (result.success) {
        const { created, updated, errors } = result.data
        setToast({
          type: 'success',
          message: `Import completed: ${created.length} created, ${updated.length} updated${errors.length > 0 ? `, ${errors.length} errors` : ''}`,
        })
      } else {
        setToast({
          type: 'error',
          message: result.message || 'Failed to import VAT entries',
        })
      }
    } catch (err) {
      console.error('Import error:', err)
      setToast({ type: 'error', message: 'Failed to read CSV file' })
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    let result
    if (editingVat) {
      result = await updateVatEntry(editingVat.id, formData)
    } else {
      result = await createVatEntry(formData)
    }

    if (result.success) {
      setToast({
        type: 'success',
        message: `VAT entry ${editingVat ? 'updated' : 'created'} successfully!`,
      })
      setFormData(EMPTY_FORM)
      setEditingVat(null)
      setIsModalOpen(false)
    } else {
      setToast({
        type: 'error',
        message:
          result.error || `Failed to ${editingVat ? 'update' : 'create'} VAT entry`,
      })
    }

    setIsSubmitting(false)
  }

  const openModal = (vatData = null) => {
    if (vatData) {
      setEditingVat(vatData)
      setFormData({
        id: vatData.id || '',
        code: vatData.code || '',
        name: vatData.name || '',
        rate: vatData.rate || '',
        type: vatData.type || '',
        sub_type: vatData.sub_type || '',
        description: vatData.description || '',
        status: vatData.status || 'ACTIVE',
      })
    } else {
      setEditingVat(null)
      setFormData(EMPTY_FORM)
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  return {
    vat,
    vatDisplay,
    loading,
    error,
    toast,
    isModalOpen,
    editingVat,
    formData,
    isSubmitting,
    importing,
    createVatEntry,
    updateVatEntry,
    refreshVat: fetchVat,
    exportVat,
    importVatFromFile,
    handleInputChange,
    handleSubmit,
    openModal,
    closeModal,
    setToast,
  }
}

export default useVat
