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

  const fh  = data?.financialHealth    || {};
  const cf  = data?.cashFlowActivity   || {};
  const tv  = data?.transactionVolume  || {};
  const al  = data?.alerts             || {};
  const tr  = data?.trends             || {};

  const maxCF  = Math.max(cf.totalCollections || 1, cf.totalDisbursements || 1);
  const colPct = ((cf.totalCollections   || 0) / maxCF) * 100;
  const disPct = ((cf.totalDisbursements || 0) / maxCF) * 100;

  const totalTxn = (tv.salesCount || 0) + (tv.purchaseCount || 0) +
                   (tv.disbursementCount || 0) + (tv.adjustmentCount || 0) || 1;

  const donutData = [
    { label: 'Sales & Collections',   count: tv.salesCount        || 0, color: '#22c55e' },
    { label: 'Purchases & Payments',  count: tv.purchaseCount     || 0, color: '#3b82f6' },
    { label: 'Disbursements',         count: tv.disbursementCount || 0, color: '#ef4444' },
    { label: 'Adjustments',           count: tv.adjustmentCount   || 0, color: '#f59e0b' },
  ];

  const revenueExpenses = (tr.revenueVsExpenses || []).slice(-6);
  const cashTrend       = tr.cashFlowTrend || [];
  const collections     = cashTrend.filter(t => t.type === 'collection').slice(-6);
  const disbursements   = cashTrend.filter(t => t.type === 'disbursement').slice(-6);

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
    tv,
    al,
    tr,
    colPct,
    disPct,
    totalTxn,
    donutData,
    revenueExpenses,
    collections,
    disbursements,
    isHealthy,
  };
}

export function fmt2(n) {
  return new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}
