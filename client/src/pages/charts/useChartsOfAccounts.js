import { useState, useEffect } from 'react'
import { API } from '../../api/endpoints'
import { objectsToCsv, parseCsv, downloadCsv } from '../../utils/csv'

const EMPTY_FORM = {
  code: '',
  name: '',
  type: '',
  description: '',
  status: 'active',
}

const normalizeStatus = (status) => {
  const normalized = String(status || 'active')
    .trim()
    .toLowerCase()
  return normalized === 'inactive' ? 'inactive' : 'active'
}

const useChartsOfAccounts = () => {
  const [chartsOfAccounts, setChartsOfAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingChart, setEditingChart] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [toast, setToast] = useState(null)
  const [importing, setImporting] = useState(false)

  const showToast = (type, message) => setToast({ type, message })

  const fetchChartsOfAccounts = async () => {
    try {
      setLoading(true)
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }
      const response = await fetch(
        API.chartsOfAccounts(),
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
        setChartsOfAccounts(result.data)
      } else {
        setError(result.message || 'Failed to fetch charts of accounts')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchChartsOfAccounts()
  }, [])

  const createChartsOfAccount = async (code, name, type, description) => {
    try {
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.chartsOfAccounts(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ code, name, type, description }),
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        // Refresh the charts of accounts list
        await fetchChartsOfAccounts()
        return { success: true, data: result.data }
      } else {
        return {
          success: false,
          message: result.message || 'Failed to create charts of account',
        }
      }
    } catch (err) {
      console.error('Error creating charts of account:', err.message)
      return { success: false, message: err.message }
    }
  }

  const updateChartsOfAccount = async (
    id,
    code,
    name,
    type,
    description,
    status,
  ) => {
    try {
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.chartsOfAccountsById(id),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ code, name, type, description, status }),
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        // Refresh the charts of accounts list
        await fetchChartsOfAccounts()
        return { success: true, data: result.data }
      } else {
        return {
          success: false,
          message: result.message || 'Failed to update charts of account',
        }
      }
    } catch (err) {
      console.error('Error updating charts of account:', err.message)
      return { success: false, message: err.message }
    }
  }

  const importChartsOfAccounts = async (accounts) => {
    try {
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.chartsOfAccountsImport(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ accounts }),
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        // Refresh the charts of accounts list
        await fetchChartsOfAccounts()
        return { success: true, data: result.data }
      } else {
        return {
          success: false,
          message: result.message || 'Failed to import charts of accounts',
        }
      }
    } catch (err) {
      console.error('Error importing charts of accounts:', err.message)
      return { success: false, message: err.message }
    }
  }

  // Modal + form wiring.
  const openModal = (chartData = null) => {
    if (chartData) {
      setEditingChart(chartData)
      setFormData({
        code: chartData.code || '',
        name: chartData.name || '',
        type: chartData.type || '',
        description: chartData.description || '',
        status: normalizeStatus(chartData.status),
      })
    } else {
      setEditingChart(null)
      setFormData(EMPTY_FORM)
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingChart(null)
    setFormData(EMPTY_FORM)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const exportChartsOfAccounts = () => {
    try {
      if (!Array.isArray(chartsOfAccounts) || chartsOfAccounts.length === 0) {
        showToast('error', 'No Chart of Accounts to export')
        return
      }

      const csvContent = objectsToCsv(chartsOfAccounts)
      downloadCsv(csvContent, `charts_of_accounts_${Date.now()}.csv`)
      showToast('success', 'Export started')
    } catch {
      showToast('error', 'Failed to export CSV')
    }
  }

  const importChartsOfAccountsFromFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      showToast('error', 'Please select a CSV file')
      return
    }

    setImporting(true)
    try {
      const text = await file.text()
      const accounts = parseCsv(text)

      if (accounts.length === 0) {
        showToast('error', 'No valid accounts found in CSV')
        return
      }

      const result = await importChartsOfAccounts(accounts)

      if (result.success) {
        const { created, updated, errors } = result.data
        showToast(
          'success',
          `Import completed: ${created.length} created, ${updated.length} updated${errors.length > 0 ? `, ${errors.length} errors` : ''}`,
        )
      } else {
        showToast(
          'error',
          result.message || 'Failed to import charts of accounts',
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const result = editingChart
        ? await updateChartsOfAccount(
            editingChart.id,
            formData.code,
            formData.name,
            formData.type,
            formData.description,
            formData.status,
          )
        : await createChartsOfAccount(
            formData.code,
            formData.name,
            formData.type,
            formData.description,
          )

      if (result.success) {
        showToast(
          'success',
          `Chart of Account "${formData.name}" ${editingChart ? 'updated' : 'created'} successfully!`,
        )
        closeModal()
      } else {
        showToast(
          'error',
          result.message ||
            `Failed to ${editingChart ? 'update' : 'create'} chart of account`,
        )
      }
    } catch {
      showToast(
        'error',
        `Network error occurred while ${editingChart ? 'updating' : 'creating'} chart of account`,
      )
    }
  }

  return {
    chartsOfAccounts,
    loading,
    error,
    createChartsOfAccount,
    updateChartsOfAccount,
    importChartsOfAccounts,
    isModalOpen,
    editingChart,
    formData,
    toast,
    importing,
    openModal,
    closeModal,
    exportChartsOfAccounts,
    importChartsOfAccountsFromFile,
    handleInputChange,
    handleSubmit,
    closeToast: () => setToast(null),
  }
}

export default useChartsOfAccounts
