import { useState, useEffect } from 'react'

const useCustomerTransactionDetail = (customerId) => {
  const [receipts, setReceipts] = useState([])
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  console.log('useCustomerTransactionDetail called with customerId:', customerId)

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

        console.log('All receipts:', allReceipts)
        console.log('All sales:', allSales)
        console.log('Customer ID:', customerId)

        // Log first receipt and sales to check their structure
        if (allReceipts.length > 0) {
          console.log('First receipt structure:', allReceipts[0])
          console.log('First receipt customer field:', allReceipts[0].customer)
          console.log('First receipt customer_id field:', allReceipts[0].customer_id)
          console.log('First receipt state:', allReceipts[0].state)
          console.log('First receipt status:', allReceipts[0].status)
        }
        if (allSales.length > 0) {
          console.log('First sales structure:', allSales[0])
          console.log('First sales customer field:', allSales[0].customer)
          console.log('First sales customer_id field:', allSales[0].customer_id)
          console.log('First sales state:', allSales[0].state)
          console.log('First sales status:', allSales[0].status)
        }

        // Filter by customer ID or customer name and approved state
        const customerReceipts = allReceipts.filter(
          (r) => {
            const customerMatch = String(r.customer_id) === String(customerId) ||
             String(r.customer) === String(customerId) ||
             String(r.customer_name) === String(customerId)
            const stateMatch = String(r.state || r.status || '').toLowerCase() === 'approved'
            console.log(`Receipt ${r.id}: customerMatch=${customerMatch}, stateMatch=${stateMatch}, customer=${r.customer}, state=${r.state}`)
            return customerMatch && stateMatch
          }
        )
        const customerSales = allSales.filter(
          (s) => {
            const customerMatch = String(s.customer_id) === String(customerId) ||
             String(s.customer) === String(customerId) ||
             String(s.customer_name) === String(customerId)
            const stateMatch = String(s.state || s.status || '').toLowerCase() === 'approved'
            console.log(`Sales ${s.id}: customerMatch=${customerMatch}, stateMatch=${stateMatch}, customer=${s.customer}, state=${s.state}`)
            return customerMatch && stateMatch
          }
        )

        console.log('Filtered receipts:', customerReceipts)
        console.log('Filtered sales:', customerSales)

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
