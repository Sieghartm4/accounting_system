import { useState, useEffect, useRef, useCallback } from 'react'

const usePurchase = () => {
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  const purchasesRef = useRef([])

  const LIMIT = 50

  const prependPurchase = useCallback((purchase) => {
    if (!purchase || !purchase.id) return

    setPurchases((prev) => {
      if (prev.some((row) => row.id === purchase.id)) {
        return prev
      }
      const next = [purchase, ...prev]
      purchasesRef.current = next
      return next
    })
  }, [])

  const fetchPurchase = async (offset = 0, append = false) => {
    if (!append) {
      setLoading(true)
      setError(null)
    } else {
      setLoadingMore(true)
    }

    try {
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/purchase?offset=${offset}&limit=${LIMIT}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

      const result = await response.json()
      if (!result.success)
        throw new Error(result.message || 'Failed to fetch purchases')

      const data = Array.isArray(result.data) ? result.data : []

      if (append) {
        const next = [...(purchasesRef.current || []), ...data]
        purchasesRef.current = next
        setPurchases(next)
      } else {
        purchasesRef.current = data
        setPurchases(data)
      }

      setHasMore(Boolean(result.hasMore))
    } catch (err) {
      setError(err.message || 'Failed to fetch purchases')
      if (!append) setPurchases([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    fetchPurchase(0, false)
  }, [])

  const refetchPurchases = async () => fetchPurchase(0, false)

  const loadMore = async () => fetchPurchase(purchasesRef.current.length || 0, true)

  return {
    purchases,
    loading,
    loadingMore,
    hasMore,
    error,
    refetchPurchases,
    loadMore,
    prependPurchase,
  }
}

export default usePurchase
