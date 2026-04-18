import React, { useState, useEffect } from 'react';

export default function BalanceSheet() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchBalanceSheet();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBalanceSheet();
    }, 500);
    return () => clearTimeout(timer);
  }, [startDate, endDate]);

  const fetchBalanceSheet = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      
      const url = `${import.meta.env.VITE_SERVER_LINK}/reports/balance-sheet${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.message || 'Failed to fetch balance sheet');
      }
    } catch (err) {
      setError('Error fetching balance sheet: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Balance Sheet</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            <span className="ml-3 text-gray-600">Loading balance sheet...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Balance Sheet</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-semibold">Error:</p>
            <p className="text-red-700 mt-2">{error}</p>
            <button 
              onClick={fetchBalanceSheet}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Balance Sheet</h1>
      
      {/* Date Filter Section */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                setStartDate(today);
                setEndDate(today);
              }}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              Today
            </button>
          </div>
        </div>
        {(startDate || endDate) && (
          <div className="mt-3 text-sm text-gray-600">
            Filter: {startDate && `From ${startDate}`} {startDate && endDate && ' to '} {endDate && `To ${endDate}`}
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assets Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-blue-50 px-6 py-4 border-b border-blue-200">
            <h2 className="text-lg font-semibold text-blue-800">ASSETS</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <tbody className="divide-y divide-gray-200">
                {data.assets?.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                      {item['Account Code']}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900">
                      {item['Account Name']}
                    </td>
                    <td className="px-6 py-3 text-sm text-right text-gray-900">
                      {formatCurrency(item.Current)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-blue-50 font-semibold">
                  <td colSpan="2" className="px-6 py-3 text-sm text-blue-800">
                    Total Assets
                  </td>
                  <td className="px-6 py-3 text-sm text-right text-blue-800">
                    {formatCurrency(data.totalAssets)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Liabilities Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-yellow-50 px-6 py-4 border-b border-yellow-200">
            <h2 className="text-lg font-semibold text-yellow-800">LIABILITIES</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <tbody className="divide-y divide-gray-200">
                {data.liabilities?.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                      {item['Account Code']}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900">
                      {item['Account Name']}
                    </td>
                    <td className="px-6 py-3 text-sm text-right text-gray-900">
                      {formatCurrency(item.Current)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-yellow-50 font-semibold">
                  <td colSpan="2" className="px-6 py-3 text-sm text-yellow-800">
                    Total Liabilities
                  </td>
                  <td className="px-6 py-3 text-sm text-right text-yellow-800">
                    {formatCurrency(data.totalLiabilities)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Equity Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-green-50 px-6 py-4 border-b border-green-200">
            <h2 className="text-lg font-semibold text-green-800">EQUITY</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <tbody className="divide-y divide-gray-200">
                {data.equity?.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                      {item['Account Code']}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900">
                      {item['Account Name']}
                    </td>
                    <td className="px-6 py-3 text-sm text-right text-gray-900">
                      {formatCurrency(item.Current)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-green-50 font-semibold">
                  <td colSpan="2" className="px-6 py-3 text-sm text-green-800">
                    Total Equity
                  </td>
                  <td className="px-6 py-3 text-sm text-right text-green-800">
                    {formatCurrency(data.totalEquity)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Balance Verification */}
      <div className="mt-6 bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">BALANCE VERIFICATION</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Total Assets:</span>
              <span className="text-lg font-semibold text-blue-600">
                {formatCurrency(data.totalAssets)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Total Liabilities:</span>
              <span className="text-lg font-semibold text-yellow-600">
                {formatCurrency(data.totalLiabilities)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Total Equity:</span>
              <span className="text-lg font-semibold text-green-600">
                {formatCurrency(data.totalEquity)}
              </span>
            </div>
            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-base font-semibold text-gray-900">Liabilities + Equity:</span>
                <span className="text-xl font-bold text-gray-900">
                  {formatCurrency(data.totalLiabilitiesAndEquity)}
                </span>
              </div>
            </div>
            <div className={`mt-4 p-4 rounded-lg ${
              Math.abs(data.totalAssets - data.totalLiabilitiesAndEquity) < 0.01 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center">
                <span className={`text-lg font-bold ${
                  Math.abs(data.totalAssets - data.totalLiabilitiesAndEquity) < 0.01 
                    ? 'text-green-800' 
                    : 'text-red-800'
                }`}>
                  {Math.abs(data.totalAssets - data.totalLiabilitiesAndEquity) < 0.01 ? '✓ BALANCED' : '✗ OUT OF BALANCE'}
                </span>
                <span className={`ml-3 text-sm ${
                  Math.abs(data.totalAssets - data.totalLiabilitiesAndEquity) < 0.01 
                    ? 'text-green-700' 
                    : 'text-red-700'
                }`}>
                  Difference: {formatCurrency(Math.abs(data.totalAssets - data.totalLiabilitiesAndEquity))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
