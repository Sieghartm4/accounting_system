import { useState, useEffect, useCallback, useRef } from 'react'

const useAuditTrail = () => {
  const [auditTrails, setAuditTrails] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const auditTrailsRef = useRef([])
  const LIMIT = 50

  useEffect(() => {
    auditTrailsRef.current = auditTrails
  }, [auditTrails])

  const fetchAuditTrails = useCallback(async (isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const token = localStorage.getItem('token')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const currentOffset = isLoadMore ? auditTrailsRef.current.length : 0
      const params = new URLSearchParams()
      params.append('offset', currentOffset)
      params.append('limit', LIMIT)

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/audit-trail?${params.toString()}`,
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
        if (isLoadMore) {
          setAuditTrails((prev) => [...prev, ...(result.data || [])])
        } else {
          setAuditTrails(result.data || [])
        }
        setHasMore(result.hasMore || false)
      } else {
        setError(result.message || 'Failed to fetch audit trails')
        if (!isLoadMore) {
          setAuditTrails([])
        }
      }
    } catch (err) {
      setError(err.message)
      if (!isLoadMore) {
        setAuditTrails([])
      }
    } finally {
      if (isLoadMore) {
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }, [])

  const refetch = useCallback(() => {
    fetchAuditTrails(false)
  }, [fetchAuditTrails])

  const loadMore = useCallback(() => {
    fetchAuditTrails(true)
  }, [fetchAuditTrails])

  useEffect(() => {
    fetchAuditTrails(false)
  }, [fetchAuditTrails])

  return {
    auditTrails,
    loading,
    loadingMore,
    error,
    hasMore,
    refetch,
    loadMore,
  }
}

export default useAuditTrail
