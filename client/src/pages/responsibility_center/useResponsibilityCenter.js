import { useState, useEffect } from 'react'

const useResponsibilityCenter = () => {
  const [responsibilityCenters, setResponsibilityCenters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchResponsibilityCenters = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/responsibility_center`,
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
        setResponsibilityCenters(result.data || [])
      } else {
        setError(result.message || 'Failed to fetch responsibility center data')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const createResponsibilityCenter = async (centerData) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/responsibility_center`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(centerData),
        },
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        await fetchResponsibilityCenters()
        return { success: true, data: result.data }
      }

      return { success: false, error: result.message }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  const updateResponsibilityCenter = async (id, centerData) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/responsibility_center/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(centerData),
        },
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        await fetchResponsibilityCenters()
        return { success: true, data: result.data }
      }

      return { success: false, error: result.message }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  const importResponsibilityCenters = async (centers) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/responsibility_center/import`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ centers }),
        },
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        await fetchResponsibilityCenters()
        return { success: true, data: result.data }
      }

      return { success: false, message: result.message }
    } catch (err) {
      return { success: false, message: err.message }
    }
  }

  useEffect(() => {
    fetchResponsibilityCenters()
  }, [])

  return {
    responsibilityCenters,
    loading,
    error,
    createResponsibilityCenter,
    updateResponsibilityCenter,
    refreshResponsibilityCenters: fetchResponsibilityCenters,
    importResponsibilityCenters,
  }
}

export default useResponsibilityCenter
