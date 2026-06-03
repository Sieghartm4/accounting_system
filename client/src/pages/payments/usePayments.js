import { useState, useEffect, useCallback, useRef } from 'react'

const usePayments = () => {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  const paymentsRef = useRef([])
  const LIMIT = 50

  const fetchPayments = useCallback(async (offset = 0, append = false) => {
    if (!append) {
      setLoading(true)
      setError(null)
    } else {
      setLoadingMore(true)
    }

    try {
      const token = localStorage.getItem('token')

      if (!token) {
        throw new Error('No authorization token found')
      }
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/payments?offset=${offset}&limit=${LIMIT}`,
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

      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch payments')
      }

      const data = Array.isArray(result.data) ? result.data : []
      if (append) {
        const next = [...(paymentsRef.current || []), ...data]
        paymentsRef.current = next
        setPayments(next)
      } else {
        paymentsRef.current = data
        setPayments(data)
      }

      setHasMore(Boolean(result.hasMore))
    } catch (err) {
      setError(err.message)
      if (!append) setPayments([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  const prependPayment = useCallback((newPayment) => {
    setPayments((prevPayments) => {
      if (prevPayments.some((p) => p.id === newPayment.id)) {
        return prevPayments
      }
      return [newPayment, ...prevPayments]
    })
  }, [])

  useEffect(() => {
    fetchPayments(0, false)
  }, [fetchPayments])

  const refetchPayments = async () => fetchPayments(0, false)
  const loadMore = async () => fetchPayments(paymentsRef.current.length || 0, true)

  return {
    payments,
    loading,
    loadingMore,
    error,
    hasMore,
    refetchPayments,
    loadMore,
    prependPayment,
  }
}

export default usePayments
