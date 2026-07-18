import { useState, useEffect } from 'react'

const useCustomer = () => {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      if (!token) {
        throw new Error('No authorization token found')
      }
      const response = await fetch(`${import.meta.env.VITE_SERVER_LINK}/customer`, {
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

      if (result.success) {
        setCustomers(result.data)
      } else {
        setError(result.message || 'Failed to fetch customers')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  const createCustomer = async (
    code,
    name,
    category,
    type,
    address,
    tin,
    details,
    contact,
  ) => {
    try {
      const token = localStorage.getItem('token')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(`${import.meta.env.VITE_SERVER_LINK}/customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code,
          name,
          category,
          type,
          address,
          tin,
          details,
          contact,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        // Refresh the customers list
        await fetchCustomers()
        return { success: true, data: result.data }
      } else {
        return {
          success: false,
          message: result.message || 'Failed to create customer',
        }
      }
    } catch (err) {
      console.error('Error creating customer:', err.message)
      return { success: false, message: err.message }
    }
  }

  const updateCustomer = async (
    id,
    code,
    name,
    category,
    type,
    address,
    tin,
    details,
    contact,
    status,
  ) => {
    try {
      const token = localStorage.getItem('token')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/customer/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            id,
            code,
            name,
            category,
            type,
            address,
            tin,
            details,
            contact,
            status,
          }),
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        await fetchCustomers()
        return { success: true, data: result.data }
      }

      return {
        success: false,
        message: result.message || 'Failed to update customer',
      }
    } catch (err) {
      console.error('Error updating customer:', err.message)
      return { success: false, message: err.message }
    }
  }

  return { customers, loading, error, createCustomer, updateCustomer }
}

export default useCustomer
