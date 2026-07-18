import { useState, useEffect } from 'react'

const useWithholdingTax = () => {
  const [withholdingTax, setWithholdingTax] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchWithholdingTax = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      if (!token) {
        throw new Error('No authorization token found')
      }
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/withholding_tax`,
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
        setWithholdingTax(result.data)
      } else {
        setError(result.message || 'Failed to fetch Withholding Tax data')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const createWithholdingTaxEntry = async (withholdingTaxData) => {
    try {
      const token = localStorage.getItem('token')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/withholding_tax`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(withholdingTaxData),
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        // Refresh Withholding Tax list
        await fetchWithholdingTax()
        return { success: true, data: result.data }
      } else {
        return { success: false, error: result.message }
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  const updateWithholdingTaxEntry = async (id, withholdingTaxData) => {
    try {
      const token = localStorage.getItem('token')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/withholding_tax/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(withholdingTaxData),
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        // Refresh Withholding Tax list
        await fetchWithholdingTax()
        return { success: true, data: result.data }
      } else {
        return { success: false, error: result.message }
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  useEffect(() => {
    fetchWithholdingTax()
  }, [])

  return {
    withholdingTax,
    loading,
    error,
    createWithholdingTaxEntry,
    updateWithholdingTaxEntry,
    refreshWithholdingTax: fetchWithholdingTax,
  }
}

export default useWithholdingTax
