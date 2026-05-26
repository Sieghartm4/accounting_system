import { useState, useEffect, useCallback } from 'react'

const useAdvances = (startDate, endDate) => {
  const [advances, setAdvances] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAdvances = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)

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

      setAdvances(result.data || [])
    } catch (err) {
      setError(err.message || 'Unable to fetch advances')
      setAdvances([])
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    fetchAdvances()
  }, [fetchAdvances])

  return {
    advances,
    loading,
    error,
    refreshAdvances: fetchAdvances,
  }
}

export default useAdvances
