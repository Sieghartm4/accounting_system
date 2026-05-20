import { useState, useEffect } from 'react'

const useAuditTrail = () => {
  const [auditTrails, setAuditTrails] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAuditTrails = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      if (!token) {
        throw new Error('No authorization token found')
      }
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/audit-trail`,
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
        setAuditTrails(result.data)
      } else {
        setError(result.message || 'Failed to fetch audit trails')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAuditTrails()
  }, [])

  return {
    auditTrails,
    loading,
    error,
    refetch: fetchAuditTrails,
  }
}

export default useAuditTrail
