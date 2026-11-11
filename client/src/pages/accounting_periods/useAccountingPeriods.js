import { useState, useEffect, useCallback, useRef } from 'react'
import { API } from '../../api/endpoints'

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

// --- Constants shared with the page UI ---

export const STATUS_ACTIONS = {
  OPEN: ['soft_close', 'close', 'lock'],
  SOFT_CLOSED: ['close', 'lock', 'reopen'],
  CLOSED: ['lock', 'reopen'],
  LOCKED: ['reopen'],
}

export const STATUS_BADGES = {
  OPEN: 'green',
  SOFT_CLOSED: 'yellow',
  CLOSED: 'orange',
  LOCKED: 'red',
}

export const ACTION_PAST = {
  soft_close: 'soft closed',
  close: 'closed',
  lock: 'locked',
  reopen: 'reopened',
}

// Status action metadata (labels + confirmation copy). Icons live in the JSX.
export const ACTION_META = {
  soft_close: {
    label: 'Soft Close',
    color: 'text-amber-600 hover:bg-amber-50 border-amber-200',
    message:
      'The period can still be reopened later, but further posting will be blocked until then.',
  },
  close: {
    label: 'Close',
    color: 'text-red-600 hover:bg-red-50 border-red-200',
    message:
      'A closed period is final and should only be reopened with a documented reason.',
  },
  lock: {
    label: 'Lock',
    color: 'text-purple-600 hover:bg-purple-50 border-purple-200',
    message: 'A locked period is immutable. Reopening will require a clear reason.',
  },
  reopen: {
    label: 'Reopen',
    color: 'text-blue-600 hover:bg-blue-50 border-blue-200',
  },
}

export const formatDate = (value) => {
  if (!value) return ''
  const stringValue = String(value)
  return stringValue.length >= 10 ? stringValue.slice(0, 10) : stringValue
}

const EMPTY_FORM = {
  code: '',
  name: '',
  start_date: '',
  end_date: '',
  status: 'ACTIVE',
  is_current: false,
}

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

  const [toast, setToast] = useState(null)
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    onConfirm: null,
    title: '',
    message: '',
    type: 'warning',
  })
  const [reopenModal, setReopenModal] = useState({
    isOpen: false,
    period: null,
  })
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const showToast = (type, message) => setToast({ type, message })

  const refreshAll = () => {
    fetchFiscalYears()
    fetchPeriods()
    fetchCurrentPeriod()
  }

  const runStatusAction = async (row, action, reopenReason = '') => {
    try {
      const result = await updatePeriodStatus(row.period_id, action, reopenReason)
      showToast(
        'success',
        result.message ||
          `Period ${row.period} successfully ${ACTION_PAST[action]}.`,
      )
      fetchPeriods()
      fetchCurrentPeriod()
      return true
    } catch (err) {
      showToast(
        'error',
        err.message || `Failed to ${action.replace(/_/g, ' ')} period`,
      )
      return false
    }
  }

  const handleAction = (row, action) => {
    if (action === 'reopen') {
      setReopenModal({ isOpen: true, period: row })
      return
    }
    const meta = ACTION_META[action]
    setConfirmModal({
      isOpen: true,
      title: `${meta.label} Period ${row.period}`,
      message: `Are you sure you want to ${meta.label.toLowerCase()} accounting period ${row.period}? ${meta.message || ''
        }`,
      type: action === 'close' ? 'danger' : 'warning',
      onConfirm: () => runStatusAction(row, action),
    })
  }

  // Reopen modal wiring.
  const closeReopenModal = () => setReopenModal({ isOpen: false, period: null })

  const handleReopen = async (reason) => {
    const ok = await runStatusAction(reopenModal.period, 'reopen', reason)
    if (ok) closeReopenModal()
  }

  // Create fiscal-year modal wiring.
  const openCreateModal = () => setIsCreateOpen(true)
  const closeCreateModal = () => setIsCreateOpen(false)

  const handleFormChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleCreateFiscalYear = async (e) => {
    e.preventDefault()
    if (
      !form.code.trim() ||
      !form.name.trim() ||
      !form.start_date ||
      !form.end_date
    ) {
      setToast({
        type: 'warning',
        message: 'Code, Name, Start Date and End Date are required',
      })
      return
    }
    if (form.end_date < form.start_date) {
      setToast({
        type: 'warning',
        message: 'End date must be on or after the start date',
      })
      return
    }
    setIsSubmitting(true)
    try {
      const result = await createFiscalYear({
        code: form.code.trim(),
        name: form.name.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        status: form.status,
        is_current: form.is_current,
      })
      showToast('success', result.message || 'Fiscal year created successfully')
      closeCreateModal()
      setForm(EMPTY_FORM)
      refreshAll()
    } catch (err) {
      showToast('error', err.message || 'Failed to create fiscal year')
    } finally {
      setIsSubmitting(false)
    }
  }

  const openPeriodCount = periods.filter(
    (p) => String(p.status || '').toUpperCase() === 'OPEN',
  ).length
  const lockedPeriodCount = periods.filter(
    (p) => String(p.status || '').toUpperCase() === 'LOCKED',
  ).length

  useEffect(() => {
    selectedFiscalYearRef.current = selectedFiscalYearId
  }, [selectedFiscalYearId])

  const apiRequest = useCallback(async (path, options = {}) => {
    const token = sessionStorage.getItem('authenticated')
    if (!token) throw new Error('No authorization token found')

    const response = await fetch(
      API.accountingPeriods(path),
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
      const result = await apiRequest('/fiscal-years')
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
        `${query ? `?${query}` : ''}`,
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
      const result = await apiRequest('/current-period')
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
      const result = await apiRequest('/fiscal-years', {
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
        `/${periodId}/status`,
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
    toast,
    refreshAll,
    closeToast: () => setToast(null),
    confirmModal,
    closeConfirmModal: () =>
      setConfirmModal((m) => ({ ...m, isOpen: false })),
    handleAction,
    reopenModal,
    closeReopenModal,
    handleReopen,
    isCreateOpen,
    openCreateModal,
    closeCreateModal,
    isSubmitting,
    form,
    handleFormChange,
    handleCreateFiscalYear,
    openPeriodCount,
    lockedPeriodCount,
  }
}

export default useAccountingPeriods