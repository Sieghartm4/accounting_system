import { useState, useEffect } from 'react'

const formatNumber = (value) =>
  Number(value || 0)
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const parseAmount = (record) => {
  return Number(
    record?.amount_due ||
      record?.total_amount_due ||
      record?.total_amount ||
      record?.amount ||
      0,
  )
}

const isApproved = (record) => {
  const status = (record?.status || record?.state || '')
    .toString()
    .trim()
    .toLowerCase()
  return status === 'approved'
}

const useCustomerTransactions = () => {
  const [customerTransactions, setCustomerTransactions] = useState([])
  const [summary, setSummary] = useState({
    customers: 0,
    totalAmountDue: 0,
    approvedReceipts: 0,
    approvedSales: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCustomerTransactions = async () => {
    try {
      setLoading(true)
      setError(null)

      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/customer/transactions`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch customer transactions')
      }

      const rows = Array.isArray(result.data) ? result.data : []
      const formattedRows = rows.map(({ total_amount_due, ...row }) => ({
        ...row,
        amount_due: `₱ ${formatNumber(Number(total_amount_due || 0))}`,
      }))

      setCustomerTransactions(formattedRows)
      setSummary({
        customers: result.summary?.customers || formattedRows.length,
        totalAmountDue: Number(result.summary?.totalAmountDue || 0),
        approvedReceipts: result.summary?.approvedReceipts || 0,
        approvedSales: result.summary?.approvedSales || 0,
      })
    } catch (err) {
      setError(err.message || 'Failed to load customer transaction data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomerTransactions()
  }, [])

  return {
    customerTransactions,
    loading,
    error,
    summary,
  }
}

export default useCustomerTransactions
