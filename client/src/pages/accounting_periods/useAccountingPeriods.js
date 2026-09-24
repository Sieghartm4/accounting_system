import { useState, useEffect, useCallback, useRef } from 'react'

const normalizePeriod = (p = {}) => ({
  period_id: p.ap_id ?? p.period_id ?? p.ap_period_id ?? p.id ?? null,
  fiscal_year_id: p.ap_fiscal_year_id ?? p.fiscal_year_id ?? null,
  period: p.ap_period ?? p.period,
  year: p.ap_year ?? p.year,
  month: p.ap_month ?? p.month,
  start_date: p.ap_start_date ?? p.start_date,
  end_date: p.ap_end_date ?? p.end_date,
  status: p.ap_status ?? p.status,
  opened_date: p.ap_opened_date ?? p.opened_date,
  opened_by: p.ap_opened_by ?? p.opened_by,
  soft_closed_date: p.ap_soft_closed_date ?? p.soft_closed_date,
  soft_closed_by: p.ap_soft_closed_by ?? p.soft_closed_by,
  closed_date: p.ap_closed_date ?? p.closed_date,
  closed_by: p.ap_closed_by ?? p.closed_by,
  locked_date: p.ap_locked_date ?? p.locked_date,
  locked_by: p.ap_locked_by ?? p.locked_by,
  reopened_date: p.ap_reopened_date ?? p.reopened_date,
  reopened_by: p.ap_reopened_by ?? p.reopened_by,
  reopen_reason: p.ap_reopen_reason ?? p.reopen_reason,
})

const normalizePeriods = (rows = []) =>
  (Array.isArray(rows) ? rows : []).map(normalizePeriod)

const normalizeFiscalYear = (f = {}) => ({
  fiscal_year_id: f.afy_id ?? f.fiscal_year_id ?? f.id ?? null,
  code: f.afy_code ?? f.code,
  name: f.afy_name ?? f.name,
  start_date: f.afy_start_date ?? f.start_date,
  end_date: f.afy_end_date ?? f.end_date,
  status: f.afy_status ?? f.status,
  is_current: f.afy_is_current ?? f.is_current,
})

const normalizeFiscalYears = (rows = []) =>
  (Array.isArray(rows) ? rows : []).map(normalizeFiscalYear)

const useAccountingPeriods = () => {
  const [fiscalYears, setFiscalYears] = useState([])
  const [periods, setPeriods] = useState([])
  const [currentPeriod, setCurrentPeriod] = useState(null)
  const [selectedFiscalYearId, setSelectedFiscalYearId] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loadingFiscalYears, setLoadingFiscalYears] = useState(true)
  const [loadingPeriods, setLoadingPeriods] = useState(false)
  const [error, setError] = useState(null)
  const [periodsError, setPeriodsError] = useState(null)
  const selectedFiscalYearRef = useRef('')

  useEffect(() => {
    selectedFiscalYearRef.current = selectedFiscalYearId
  }, [selectedFiscalYearId])

  const apiRequest = useCallback(async (path, options = {}) => {
    const token = sessionStorage.getItem('authenticated')
    if (!token) throw new Error('No authorization token found')

    const response = await fetch(
      `${import.meta.env.VITE_SERVER_LINK}${path}`,
      {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      },
    )

    let result = null
    try {
      result = await response.json()
    } catch {
      // Non-JSON response (e.g. proxy/network error page)
    }

    if (!response.ok) {
      const message =
        (result && result.message) || `HTTP error! status: ${response.status}`
      throw new Error(message)
    }

    if (result && result.success === false) {
      throw new Error(result.message || 'Request failed')
    }

    return result || { data: null }
  }, [])

  const fetchFiscalYears = useCallback(async () => {
    try {
      setLoadingFiscalYears(true)
      setError(null)
      const result = await apiRequest('/accounting_periods/fiscal-years')
      const list = result.data || []
      setFiscalYears(normalizeFiscalYears(list))

      const currentId = selectedFiscalYearRef.current
      const stillExists =
        currentId &&
        list.some((fy) =>
          String(fy.fiscal_year_id || fy.id) === String(currentId),
        )

      if (!stillExists) {
        const preferred =
          list.find(
            (fy) =>
              fy.is_current === true ||
              fy.is_current === 1 ||
              String(fy.status || '').toUpperCase() === 'CURRENT',
          ) || list[0]
        setSelectedFiscalYearId(preferred ? String(preferred.fiscal_year_id || preferred.id) : '')
      }
    } catch (err) {
      setError(err.message || 'Unable to fetch fiscal years')
    } finally {
      setLoadingFiscalYears(false)
    }
  }, [apiRequest])

  const fetchPeriods = useCallback(async () => {
    try {
      setLoadingPeriods(true)
      setPeriodsError(null)
      const params = new URLSearchParams()
      const fyId = selectedFiscalYearRef.current
      if (fyId) params.append('fiscal_year_id', fyId)
      if (statusFilter) params.append('status', statusFilter)
      const query = params.toString()
      const result = await apiRequest(
        `/accounting_periods${query ? `?${query}` : ''}`,
      )
      setPeriods(normalizePeriods(result.data || []))
    } catch (err) {
      setPeriodsError(err.message || 'Unable to fetch accounting periods')
      setPeriods([])
    } finally {
      setLoadingPeriods(false)
    }
  }, [apiRequest, statusFilter])

  const fetchCurrentPeriod = useCallback(async () => {
    try {
      const result = await apiRequest('/accounting_periods/current-period')
      const row = Array.isArray(result.data)
        ? result.data[0]
        : result.data || {}
      setCurrentPeriod(normalizePeriod(row))
    } catch (err) {
      console.error('Failed to fetch current period:', err.message)
      setCurrentPeriod(null)
    }
  }, [apiRequest])

  const createFiscalYear = useCallback(
    async (payload) => {
      const result = await apiRequest('/accounting_periods/fiscal-years', {
        method: 'POST',
        body: payload,
      })
      return result
    },
    [apiRequest],
  )

  const updatePeriodStatus = useCallback(
    async (periodId, action, reopenReason = '') => {
      const body = { action }
      if (action === 'reopen') {
        body.reopen_reason = reopenReason
      }
      const result = await apiRequest(
        `/accounting_periods/${periodId}/status`,
        { method: 'PATCH', body },
      )
      return result
    },
    [apiRequest],
  )

  useEffect(() => {
    fetchFiscalYears()
    fetchCurrentPeriod()
  }, [fetchFiscalYears, fetchCurrentPeriod])

  useEffect(() => {
    fetchPeriods()
  }, [fetchPeriods, selectedFiscalYearId, statusFilter])

  return {
    fiscalYears,
    periods,
    currentPeriod,
    selectedFiscalYearId,
    setSelectedFiscalYearId,
    statusFilter,
    setStatusFilter,
    loadingFiscalYears,
    loadingPeriods,
    error,
    periodsError,
    fetchFiscalYears,
    fetchPeriods,
    fetchCurrentPeriod,
    createFiscalYear,
    updatePeriodStatus,
  }
}

export default useAccountingPeriods