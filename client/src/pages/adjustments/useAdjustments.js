import { useState, useEffect, useCallback, useRef } from 'react'

const useAdjustments = () => {
  const [adjustments, setAdjustments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [selectedAdjustmentId, setSelectedAdjustmentId] = useState(null)
  const [adjustmentData, setAdjustmentData] = useState(null)
  const [adjustmentLoading, setAdjustmentLoading] = useState(false)
  const adjustmentsRef = useRef([])
  const LIMIT = 50

  useEffect(() => {
    adjustmentsRef.current = adjustments
  }, [adjustments])

  const fetchAdjustments = useCallback(async (isLoadMore = false) => {
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

      const currentOffset = isLoadMore ? adjustmentsRef.current.length : 0
      const params = new URLSearchParams()
      params.append('offset', currentOffset)
      params.append('limit', LIMIT)

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/adjustments?${params.toString()}`,
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
        throw new Error(result.message || 'Failed to fetch adjustments')
      }

      if (isLoadMore) {
        setAdjustments((prev) => [...prev, ...(result.data || [])])
      } else {
        setAdjustments(result.data || [])
      }

      setHasMore(result.hasMore || false)
    } catch (err) {
      setError(err.message || 'Unable to fetch adjustments')
      if (!isLoadMore) {
        setAdjustments([])
      }
    } finally {
      if (isLoadMore) {
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }, [])

  const fetchAdjustmentDetails = useCallback(async (adjustmentId) => {
    try {
      setAdjustmentLoading(true)
      const token = localStorage.getItem('token')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/adjustments/${adjustmentId}`,
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

      if (result.success) {
        setAdjustmentData(result)
      } else {
        setError(result.message || 'Failed to fetch adjustment details')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setAdjustmentLoading(false)
    }
  }, [])

  const handleAdjustmentRowClick = async (adjustment_id) => {
    console.log('Adjustment clicked!')
    console.log('Adjustment ID:', adjustment_id)

    if (selectedAdjustmentId === adjustment_id) {
      setSelectedAdjustmentId(null)
      setAdjustmentData(null)
    } else {
      setSelectedAdjustmentId(adjustment_id)
      await fetchAdjustmentDetails(adjustment_id)
    }
  }

  const prependAdjustment = useCallback((newAdjustment) => {
    setAdjustments((prevAdjustments) => {
      if (prevAdjustments.some((adjustment) => adjustment.id === newAdjustment.id)) {
        return prevAdjustments
      }
      return [newAdjustment, ...prevAdjustments]
    })
  }, [])

  const refetchAdjustments = useCallback(() => {
    fetchAdjustments(false)
  }, [fetchAdjustments])

  useEffect(() => {
    fetchAdjustments(false)
  }, [fetchAdjustments])

  return {
    adjustments,
    loading,
    loadingMore,
    error,
    hasMore,
    selectedAdjustmentId,
    adjustmentData,
    adjustmentLoading,
    handleAdjustmentRowClick,
    prependAdjustment,
    refetchAdjustments,
    loadMore: () => fetchAdjustments(true),
  }
}

export default useAdjustments
