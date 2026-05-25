import { useState, useEffect } from 'react'

const useCustomerTransactionDetail = (customerId) => {
  const [receipts, setReceipts] = useState([])
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchTransactionDetail = async () => {
      try {
        setLoading(true)
        setError(null)

        const token = localStorage.getItem('token')
        if (!token) {
          throw new Error('No authorization token found')
        }

        const [receiptsRes, salesRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_SERVER_LINK}/receipt`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${import.meta.env.VITE_SERVER_LINK}/sales`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }),
        ])

        const [receiptsResult, salesResult] = await Promise.all([
          receiptsRes.json(),
          salesRes.json(),
        ])

        if (!receiptsRes.ok || !receiptsResult.success) {
          throw new Error(receiptsResult.message || 'Failed to fetch receipts')
        }

        if (!salesRes.ok || !salesResult.success) {
          throw new Error(salesResult.message || 'Failed to fetch sales')
        }

        const allReceipts = Array.isArray(receiptsResult.data)
          ? receiptsResult.data
          : []
        const allSales = Array.isArray(salesResult.data) ? salesResult.data : []

        // Filter by customer ID and approved state
        const customerReceipts = allReceipts.filter(
          (r) =>
            String(r.customer_id) === String(customerId) &&
            String(r.state || r.status || '').toLowerCase() === 'approved',
        )
        const customerSales = allSales.filter(
          (s) =>
            String(s.customer_id) === String(customerId) &&
            String(s.state || s.status || '').toLowerCase() === 'approved',
        )

        setReceipts(customerReceipts)
        setSales(customerSales)
      } catch (err) {
        setError(err.message || 'Failed to load transaction details')
      } finally {
        setLoading(false)
      }
    }

    if (customerId) {
      fetchTransactionDetail()
    }
  }, [customerId])

  return {
    receipts,
    sales,
    loading,
    error,
  }
}

export default useCustomerTransactionDetail
