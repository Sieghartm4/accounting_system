import { useState, useEffect } from 'react'

const useVendorTransactionDetail = (vendorId) => {
  const [disbursements, setDisbursements] = useState([])
  const [purchases, setPurchases] = useState([])
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

        const [disbursementsRes, purchasesRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_SERVER_LINK}/cash_disbursements`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${import.meta.env.VITE_SERVER_LINK}/purchase`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }),
        ])

        const [disbursementsResult, purchasesResult] = await Promise.all([
          disbursementsRes.json(),
          purchasesRes.json(),
        ])

        if (!disbursementsRes.ok || !disbursementsResult.success) {
          throw new Error(
            disbursementsResult.message || 'Failed to fetch disbursements',
          )
        }

        if (!purchasesRes.ok || !purchasesResult.success) {
          throw new Error(purchasesResult.message || 'Failed to fetch purchases')
        }

        const allDisbursements = Array.isArray(disbursementsResult.data)
          ? disbursementsResult.data
          : []
        const allPurchases = Array.isArray(purchasesResult.data)
          ? purchasesResult.data
          : []

        console.log('All disbursements:', allDisbursements)
        console.log('All purchases:', allPurchases)
        console.log('Vendor ID:', vendorId)

        // Filter by vendor ID or vendor name and approved state
        const vendorDisbursements = allDisbursements.filter(
          (d) =>
            (String(d.vendor_id) === String(vendorId) ||
             String(d.vendor) === String(vendorId) ||
             String(d.vendor_name) === String(vendorId)) &&
            String(d.state || d.status || '').toLowerCase() === 'approved',
        )
        const vendorPurchases = allPurchases.filter(
          (p) =>
            (String(p.vendor_id) === String(vendorId) ||
             String(p.vendor) === String(vendorId) ||
             String(p.vendor_name) === String(vendorId)) &&
            String(p.state || p.status || '').toLowerCase() === 'approved',
        )

        console.log('Filtered disbursements:', vendorDisbursements)
        console.log('Filtered purchases:', vendorPurchases)

        setDisbursements(vendorDisbursements)
        setPurchases(vendorPurchases)
      } catch (err) {
        setError(err.message || 'Failed to load transaction details')
      } finally {
        setLoading(false)
      }
    }

    if (vendorId) {
      fetchTransactionDetail()
    }
  }, [vendorId])

  return {
    disbursements,
    purchases,
    loading,
    error,
  }
}

export default useVendorTransactionDetail
