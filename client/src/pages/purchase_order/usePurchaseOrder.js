import { useState, useEffect, useCallback } from 'react'

const usePurchaseOrder = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPurchaseOrders = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const token = localStorage.getItem('token')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/purchase_order`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        setPurchaseOrders(result.data || [])
      } else {
        setError(result.message || 'Failed to fetch purchase orders')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const updatePurchaseOrderStatus = useCallback(
    async (poId, updates) => {
      try {
        const token = localStorage.getItem('token')

        if (!token) {
          throw new Error('No authorization token found')
        }

        const response = await fetch(
          `${import.meta.env.VITE_SERVER_LINK}/purchase_order/${poId}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
          },
        )

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = await response.json()

        if (result.success) {
          await fetchPurchaseOrders()
          return result
        } else {
          throw new Error(result.message || 'Failed to update purchase order')
        }
      } catch (err) {
        setError(err.message)
        throw err
      }
    },
    [fetchPurchaseOrders],
  )

  const createPurchaseOrder = useCallback(
    async (payload) => {
      try {
        const token = localStorage.getItem('token')

        if (!token) {
          throw new Error('No authorization token found')
        }

        const response = await fetch(
          `${import.meta.env.VITE_SERVER_LINK}/purchase_order`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          },
        )

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP error! status: ${response.status} ${errorText}`)
        }

        const result = await response.json()

        if (result.success) {
          await fetchPurchaseOrders()
          return result
        }

        throw new Error(result.message || 'Failed to create purchase order')
      } catch (err) {
        setError(err.message)
        throw err
      }
    },
    [fetchPurchaseOrders],
  )

  useEffect(() => {
    fetchPurchaseOrders()
  }, [fetchPurchaseOrders])

  return {
    purchaseOrders,
    loading,
    error,
    refreshPurchaseOrders: fetchPurchaseOrders,
    updatePurchaseOrderStatus,
    createPurchaseOrder,
  }
}

export default usePurchaseOrder
