import { useState, useEffect } from 'react'
import { API } from '../../api/endpoints'

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

        const token = sessionStorage.getItem('authenticated')
        if (!token) {
          throw new Error('No authorization token found')
        }

        const [receiptsRes, salesRes] = await Promise.all([
          fetch(API.receipt(), {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(API.sales(), {
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

        const customerReceipts = allReceipts.filter(
          (r) => {
            const customerMatch = String(r.customer_id) === String(customerId) ||
             String(r.customer) === String(customerId) ||
             String(r.customer_name) === String(customerId)
            const stateMatch = String(r.state || r.status || '').toLowerCase() === 'approved'
            return customerMatch && stateMatch
          }
        )
        const customerSales = allSales.filter(
          (s) => {
            const customerMatch = String(s.customer_id) === String(customerId) ||
             String(s.customer) === String(customerId) ||
             String(s.customer_name) === String(customerId)
            const stateMatch = String(s.state || s.status || '').toLowerCase() === 'approved'
            return customerMatch && stateMatch
          }
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
