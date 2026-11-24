import { useCallback, useEffect, useState } from 'react'
import { API } from '../../api/endpoints'

const useAgeingPayables = () => {
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetchPurchases = useCallback(async (filters = {}) => {
    try {
      setLoading(true)
      setError(null)
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authorization token found')

      const params = new URLSearchParams()
      if (filters.date_from) params.set('date_from', filters.date_from)
      if (filters.date_to) params.set('date_to', filters.date_to)

      const response = await fetch(
        `${API.purchaseAging()}${params.toString() ? `?${params.toString()}` : ''}`,
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

      setPurchases(Array.isArray(result.data) ? result.data : [])
    } catch (err) {
      setError(err.message || 'Failed to load aging payables')
      setPurchases([])
    } finally {
      setLoading(false)
    }
  }, [])

  return { purchases, loading, error, refetchPurchases }
}

export default useAgeingPayables
