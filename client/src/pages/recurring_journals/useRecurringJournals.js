import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { API } from '../../api/endpoints'
import { getAccessLevel } from '../../utils/routeProtection'
import connectRealtime from '../../utils/realtimeSocket'

const useRecurringJournals = () => {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const templatesRef = useRef([])
  const LIMIT = 50

  // List-page state.
  const [isAdding, setIsAdding] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [viewingTemplate, setViewingTemplate] = useState(null)
  const [toast, setToast] = useState(null)
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    onConfirm: null,
    title: '',
    message: '',
  })

  const showToast = (type, message) => setToast({ type, message })
  const closeToast = () => setToast(null)

  const openConfirmModal = ({ onConfirm, title, message, type = 'warning' }) =>
    setConfirmModal({
      isOpen: true,
      onConfirm,
      title,
      message,
      type,
    })

  const closeConfirmModal = () =>
    setConfirmModal((prev) => ({ ...prev, isOpen: false }))

  const confirmAndClose = () => {
    if (confirmModal.onConfirm) {
      confirmModal.onConfirm()
    }
    closeConfirmModal()
  }

  useEffect(() => {
    templatesRef.current = templates
  }, [templates])

  const fetchTemplates = useCallback(async (isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authorization token found')
      }

      const currentOffset = isLoadMore ? templatesRef.current.length : 0
      const params = new URLSearchParams()
      params.append('offset', currentOffset)
      params.append('limit', LIMIT)

      const response = await fetch(
        `${API.recurringJournals()}?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch recurring journals')
      }

      if (isLoadMore) {
        setTemplates((prev) => [...prev, ...(result.data || [])])
      } else {
        setTemplates(result.data || [])
      }

      setHasMore(result.hasMore || false)
    } catch (err) {
      setError(err.message || 'Unable to fetch recurring journals')
      if (!isLoadMore) {
        setTemplates([])
      }
    } finally {
      if (isLoadMore) {
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }, [])

  const fetchTemplateById = useCallback(async (templateId) => {
    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.recurringJournalsById(templateId),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch recurring journal template')
      }

      return result
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const createTemplate = useCallback(async (templateData) => {
    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.recurringJournals(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(templateData),
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to create recurring journal template')
      }

      return result
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const updateTemplate = useCallback(async (templateId, templateData) => {
    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.recurringJournalsById(templateId),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(templateData),
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to update recurring journal template')
      }

      return result
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const deleteTemplate = useCallback(async (templateId) => {
    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.recurringJournalsById(templateId),
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to delete recurring journal template')
      }

      return result
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const generateTemplate = useCallback(async (templateId) => {
    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.recurringJournalsGenerate(templateId),
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to generate recurring journal occurrences')
      }

      return result
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const generateAllDue = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.recurringJournalsGenerateAll(),
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to generate all due recurring journals')
      }

      return result
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const prependTemplate = useCallback((newTemplate) => {
    setTemplates((prevTemplates) => {
      if (prevTemplates.some((template) => template.id === newTemplate.id)) {
        return prevTemplates
      }
      return [newTemplate, ...prevTemplates]
    })
  }, [])

  const refetchTemplates = useCallback(() => {
    fetchTemplates(false)
  }, [fetchTemplates])

  const loadMore = useCallback(() => {
    fetchTemplates(true)
  }, [fetchTemplates])

  useEffect(() => {
    fetchTemplates(false)
  }, [fetchTemplates])

  // WebSocket subscription: recurring journals generate adjustments, and the
  // scheduler reports both, so either event means the template list is stale.
  useEffect(() => {
    const close = connectRealtime({
      onMessage: (type) => {
        if (type === 'adjustment_created' || type === 'recurring_journal_generated') {
          refetchTemplates()
        }
      },
      onError: (err) => console.error('Recurring journal realtime error', err),
    })

    return close
  }, [refetchTemplates])

  // Access-gated checkbox visibility.
  const user = JSON.parse(sessionStorage.getItem('auth_user') || '{}')
  const accessLevel = getAccessLevel('recurring_journals', user)
  const enableCheckboxes =
    accessLevel === 'Check Access' ||
    accessLevel === 'Approve Access' ||
    accessLevel === 'Edit Access' ||
    accessLevel === 'Full Access'

  // Summary tile data.
  const activeTemplates = useMemo(
    () => templates.filter((t) => t.status === 'ACTIVE'),
    [templates],
  )
  const dueTemplates = useMemo(
    () =>
      templates.filter(
        (t) => t.status === 'ACTIVE' && t.next_due_date && new Date(t.next_due_date) <= new Date(),
      ),
    [templates],
  )

  // Header action.
  const handleGenerateAllDue = async () => {
    try {
      const result = await generateAllDue()
      showToast('success', result.message || 'Generated all due recurring journals')
      refetchTemplates()
    } catch (err) {
      showToast('error', err.message || 'Failed to generate due journals')
    }
  }

  // Row actions.
  const handleViewTemplate = async (row) => {
    try {
      const result = await fetchTemplateById(row.id)
      setViewingTemplate(result)
      setIsViewing(true)
    } catch (err) {
      showToast('error', err.message || 'Failed to fetch template details')
    }
  }

  const handleEditTemplate = async (row) => {
    try {
      const result = await fetchTemplateById(row.id)
      setViewingTemplate(result)
      setIsEditing(true)
      setIsAdding(true)
    } catch (err) {
      showToast('error', err.message || 'Failed to fetch template details')
    }
  }

  const handleGenerateTemplate = async (row) => {
    try {
      const result = await generateTemplate(row.id)
      showToast('success', result.message || 'Generated occurrences successfully')
      refetchTemplates()
    } catch (err) {
      showToast('error', err.message || 'Failed to generate occurrences')
    }
  }

  const handleDeleteTemplate = (row) => {
    openConfirmModal({
      onConfirm: async () => {
        try {
          await deleteTemplate(row.id)
          showToast('success', 'Template deleted successfully')
          refetchTemplates()
        } catch (err) {
          showToast('error', err.message || 'Failed to delete template')
        }
      },
      title: 'Delete Template',
      message: `Are you sure you want to delete template "${row.name}"? This will also delete all associated items and generation history.`,
      type: 'danger',
    })
  }

  // Form-return wiring.
  const handleBack = () => {
    setIsAdding(false)
    setIsViewing(false)
    setIsEditing(false)
    setViewingTemplate(null)
  }

  const handleFormSuccess = async (nextToast) => {
    if (nextToast) setToast(nextToast)
    await refetchTemplates()
  }

  const closeViewing = () => {
    setIsViewing(false)
    setViewingTemplate(null)
  }

  return {
    templates,
    loading,
    loadingMore,
    error,
    hasMore,
    fetchTemplateById,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    generateTemplate,
    generateAllDue,
    prependTemplate,
    refetchTemplates,
    loadMore,
    isAdding,
    startAdding: () => setIsAdding(true),
    isViewing,
    isEditing,
    viewingTemplate,
    handleBack,
    handleFormSuccess,
    closeViewing,
    toast,
    closeToast,
    confirmModal,
    closeConfirmModal,
    confirmAndClose,
    enableCheckboxes,
    activeTemplates,
    dueTemplates,
    handleGenerateAllDue,
    handleViewTemplate,
    handleEditTemplate,
    handleGenerateTemplate,
    handleDeleteTemplate,
  }
}

export default useRecurringJournals
