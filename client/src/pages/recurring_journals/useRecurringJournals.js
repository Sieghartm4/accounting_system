import { useState, useEffect, useCallback, useRef } from 'react'

const useRecurringJournals = () => {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const templatesRef = useRef([])
  const LIMIT = 50

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
        `${import.meta.env.VITE_SERVER_LINK}/recurring_journals?${params.toString()}`,
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
        `${import.meta.env.VITE_SERVER_LINK}/recurring_journals/${templateId}`,
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
        `${import.meta.env.VITE_SERVER_LINK}/recurring_journals`,
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
        `${import.meta.env.VITE_SERVER_LINK}/recurring_journals/${templateId}`,
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
        `${import.meta.env.VITE_SERVER_LINK}/recurring_journals/${templateId}`,
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
        `${import.meta.env.VITE_SERVER_LINK}/recurring_journals/${templateId}/generate`,
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
        `${import.meta.env.VITE_SERVER_LINK}/recurring_journals/generate-all`,
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
  }
}

export default useRecurringJournals
