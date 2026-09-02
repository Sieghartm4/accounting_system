import { useState, useEffect } from 'react';

export function useDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('current');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchDashboardData(); }, [period, startDate, endDate]);

  const fetchDashboardData = async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const now = new Date();
      let queryStartDate, queryEndDate;

      if (startDate && endDate) {
        queryStartDate = startDate;
        queryEndDate = endDate;
      } else if (period === 'current') {
        queryStartDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        queryEndDate   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      } else {
        queryStartDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        queryEndDate   = now.toISOString().split('T')[0];
      }

      const params = new URLSearchParams({ start_date: queryStartDate, end_date: queryEndDate });
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/dashboard?${params}`,
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const result = await res.json();
      if (result.success) setData(result.data);
      else setError(result.message || 'Failed to fetch dashboard data');
    } catch (err) {
      setError('Connection Error: ' + err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // New dashboard structure
  const fh  = data?.fh || {};
  const cf  = data?.cf || {};
  const tax = data?.tax || {};
  const arAging = data?.arAging || {};
  const topVendors = data?.topVendors || [];
  const bankAccounts = data?.bankAccounts || [];
  const recentTransactions = data?.recentTransactions || [];
  const revenueExpenses = data?.revenueExpenses || [];

  const maxCF  = Math.max(cf.totalCollections || 1, cf.totalDisbursements || 1);
  const colPct = ((cf.totalCollections   || 0) / maxCF) * 100;
  const disPct = ((cf.totalDisbursements || 0) / maxCF) * 100;

  const isHealthy = (fh.netIncome || 0) >= 0;

  return {
    data,
    loading,
    error,
    period,
    setPeriod,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    refreshing,
    fetchDashboardData,
    fh,
    cf,
    tax,
    arAging,
    topVendors,
    bankAccounts,
    recentTransactions,
    revenueExpenses,
    colPct,
    disPct,
    isHealthy,
  };
}

export function fmt2(n) {
  return new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}