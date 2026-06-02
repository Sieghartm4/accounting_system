import { useState, useEffect, useCallback } from 'react'

const useAdvances = (startDate, endDate) => {
  const [advances, setAdvances] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const LIMIT = 50

  const fetchAdvances = useCallback(
    async (isLoadMore = false) => {
      try {
        if (!isLoadMore) {
          setLoading(true)
        } else {
          setLoadingMore(true)
        }
        setError(null)

        const token = localStorage.getItem('token')
        const params = new URLSearchParams()
        const isDateFiltered = Boolean(startDate || endDate)
        const currentOffset = isLoadMore ? advances.length : 0

        if (startDate) params.append('start_date', startDate)
        if (endDate) params.append('end_date', endDate)
        if (!isDateFiltered) {
          params.append('offset', currentOffset)
          params.append('limit', LIMIT)
        }

        const url = `${import.meta.env.VITE_SERVER_LINK}/reports/advances${
          params.toString() ? `?${params.toString()}` : ''
        }`
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        })

        const result = await response.json()
        if (!result.success) {
          throw new Error(result.message || 'Failed to fetch advances')
        }

        if (isLoadMore) {
          setAdvances((prev) => [...prev, ...(result.data || [])])
        } else {
          setAdvances(result.data || [])
        }

        if (isDateFiltered) {
          setHasMore(false)
        } else {
          setHasMore(result.hasMore || false)
        }
      } catch (err) {
        setError(err.message || 'Unable to fetch advances')
        if (!isLoadMore) {
          setAdvances([])
        }
      } finally {
        if (!isLoadMore) {
          setLoading(false)
        } else {
          setLoadingMore(false)
        }
      }
    },
    [startDate, endDate, advances],
  )

  useEffect(() => {
    fetchAdvances(false)
  }, [startDate, endDate])

  return {
    advances,
    loading,
    loadingMore,
    error,
    hasMore,
    refreshAdvances: () => fetchAdvances(false),
    loadMore: () => fetchAdvances(true),
  }
}

export default useAdvances
