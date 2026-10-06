import { useState, useEffect, useCallback } from 'react'

const useAgeingReceivables = () => {
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [asOf, setAsOf] = useState(null)

  // filters: { as_of: 'YYYY-MM-DD' }
  const refetchSales = useCallback(async (filters = {}) => {
    try {
      setLoading(true)
      setError(null)

      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authorization token found')
      }

      const qs = []
      if (filters.as_of) qs.push(`as_of=${encodeURIComponent(filters.as_of)}`)
      const url = `${import.meta.env.VITE_SERVER_LINK}/sales/aging${qs.length ? `?${qs.join('&')}` : ''}`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch aging receivables')
      }

      setSales(Array.isArray(result.data) ? result.data : [])
      if (result.as_of) setAsOf(result.as_of)
    } catch (err) {
      setError(err.message || 'Failed to load aging receivables')
      setSales([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetchSales()
  }, [refetchSales])

  return { sales, asOf, loading, error, refetchSales }
}

export default useAgeingReceivables