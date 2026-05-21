import { useState, useEffect, useCallback } from 'react'

const useAgeingReceivables = () => {
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // filters: { date_from: 'YYYY-MM-DD', date_to: 'YYYY-MM-DD' }
  const refetchSales = useCallback(async (filters = {}) => {
    try {
      setLoading(true)
      setError(null)

      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authorization token found')
      }

      // Build query string from filters
      const qs = []
      if (filters.date_from)
        qs.push(`date_from=${encodeURIComponent(filters.date_from)}`)
      if (filters.date_to) qs.push(`date_to=${encodeURIComponent(filters.date_to)}`)
      const url = `${import.meta.env.VITE_SERVER_LINK}/sales${qs.length ? `?${qs.join('&')}` : ''}`

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
        throw new Error(result.message || 'Failed to fetch sales')
      }

      const filteredSales = Array.isArray(result.data)
        ? result.data.filter((sale) => {
            const status = (sale.status || '').toString().trim().toLowerCase()
            return status !== 'paid'
          })
        : []

      setSales(filteredSales)
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

  return { sales, loading, error, refetchSales }
}

export default useAgeingReceivables
