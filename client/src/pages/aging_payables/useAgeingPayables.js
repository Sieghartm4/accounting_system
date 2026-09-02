import { useCallback, useEffect, useState } from 'react'

const useAgeingPayables = () => {
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetchPurchases = useCallback(async (filters = {}) => {
    try {
      setLoading(true)
      setError(null)
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')

      const params = new URLSearchParams({ offset: '0', limit: '100' })
      if (filters.date_from) params.set('date_from', filters.date_from)
      if (filters.date_to) params.set('date_to', filters.date_to)

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/purchase?${params.toString()}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

      const result = await response.json()
      if (!result.success)
        throw new Error(result.message || 'Failed to load payables')

      setPurchases(
        (Array.isArray(result.data) ? result.data : []).filter((purchase) => {
          const status = String(purchase.status || '')
            .trim()
            .toLowerCase()
          const state = String(purchase.state || '')
            .trim()
            .toUpperCase()
          return state === 'APPROVED' && status !== 'paid'
        }),
      )
    } catch (err) {
      setError(err.message || 'Failed to load aging payables')
      setPurchases([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetchPurchases()
  }, [refetchPurchases])

  return { purchases, loading, error, refetchPurchases }
}

export default useAgeingPayables
