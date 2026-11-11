import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { API } from '../../api/endpoints'
import connectRealtime from '../../utils/realtimeSocket'

export const fmt = (value) =>
  new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)

export const formatDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

const useAdvances = () => {
  const navigate = useNavigate()

  const [advances, setAdvances] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const LIMIT = 50

  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Group keys open in the detail table. Holds every open key so several
  // groups stack in the table below instead of replacing each other.
  const [expandedGroups, setExpandedGroups] = useState([])
  // Selected advances/groups awaiting adjustment navigation.
  const [selectedAdvances, setSelectedAdvances] = useState([])
  const [selectedGroups, setSelectedGroups] = useState([])
  const [toast, setToast] = useState(null)

  const fetchAdvances = useCallback(
    async (isLoadMore = false) => {
      try {
        if (!isLoadMore) {
          setLoading(true)
        } else {
          setLoadingMore(true)
        }
        setError(null)

        const token = sessionStorage.getItem('authenticated')
        const params = new URLSearchParams()
        const isDateFiltered = Boolean(startDate || endDate)
        const currentOffset = isLoadMore ? advances.length : 0

        if (startDate) params.append('start_date', startDate)
        if (endDate) params.append('end_date', endDate)
        if (!isDateFiltered) {
          params.append('offset', currentOffset)
          params.append('limit', LIMIT)
        }

        const url = `${API.reportsAdvances()}${
          params.toString() ? `?${params.toString()}` : ''
        }`
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        })

        const result = await response.json()
        if (!result.success) {
          throw new Error(result.message || 'Failed to fetch advances')
        }

        if (isLoadMore) {
          setAdvances((prev) => [...prev, ...(result.data || [])])
        } else {
          setAdvances(result.data || [])
        }

        if (isDateFiltered) {
          setHasMore(false)
        } else {
          setHasMore(result.hasMore || false)
        }
      } catch (err) {
        setError(err.message || 'Unable to fetch advances')
        if (!isLoadMore) {
          setAdvances([])
        }
      } finally {
        if (!isLoadMore) {
          setLoading(false)
        } else {
          setLoadingMore(false)
        }
      }
    },
    [startDate, endDate, advances],
  )

  useEffect(() => {
    fetchAdvances(false)
  }, [fetchAdvances])

  // Socket listener for journal entries creation (use WSS when page is secure).
  useEffect(() => {
    const close = connectRealtime({
      onMessage: (type) => {
        if (type === 'journal_entries_created') {
          fetchAdvances(false)
        }
      },
      onError: (err) => console.error('Advances realtime error', err),
    })

    return close
  }, [fetchAdvances])

  const applyDateFilters = () => {
    setStartDate(filterStartDate)
    setEndDate(filterEndDate)
  }

  const clearDateFilters = () => {
    setFilterStartDate('')
    setFilterEndDate('')
    setStartDate('')
    setEndDate('')
  }

  const totalDebit = advances.reduce(
    (sum, entry) => (entry.type === 'DEBIT' ? sum + Number(entry.amount || 0) : sum),
    0,
  )
  const totalCredit = advances.reduce(
    (sum, entry) =>
      entry.type === 'CREDIT' ? sum + Number(entry.amount || 0) : sum,
    0,
  )

  // Group advances by date and type.
  const groupedAdvances = useMemo(() => {
    const groups = new Map()

    advances.forEach((advance) => {
      const dateKey = formatDate(advance.date)
      const typeKey = advance.type
      const groupKey = `${dateKey}-${typeKey}`

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          groupKey,
          date: dateKey,
          type: typeKey,
          totalAmount: 0,
          advances: []
        })
      }

      const group = groups.get(groupKey)
      group.totalAmount += Number(advance.amount || 0)
      group.advances.push(advance)
    })

    return Array.from(groups.values()).sort((a, b) => {
      // Sort by date descending, then by type
      const dateA = new Date(a.date)
      const dateB = new Date(b.date)
      if (dateA.getTime() !== dateB.getTime()) {
        return dateB.getTime() - dateA.getTime()
      }
      return a.type.localeCompare(b.type)
    })
  }, [advances])

  // Every advance belonging to every open group, in the order the groups are
  // listed. Selecting two groups shows both sets of rows rather than the second
  // replacing the first.
  const expandedAdvances = useMemo(
    () =>
      groupedAdvances
        .filter((group) => expandedGroups.includes(group.groupKey))
        .flatMap((group) => group.advances),
    [groupedAdvances, expandedGroups],
  )

  const tableData = advances.map((entry) => ({
    ...entry,
    amount_raw: entry.amount,
    amount: `₱${fmt(entry.amount)}`,
    date: formatDate(entry.date),
  }))

  const toggleGroup = (groupKey, row) => {
    const key = row?.groupKey ?? groupKey
    setExpandedGroups((current) =>
      current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key],
    )
  }

  const handleGroupsCheckboxChange = (selectedIds) => {
    const rows = groupedAdvances.filter((row) => selectedIds.includes(row.groupKey))
    setSelectedGroups(rows)
  }

  const handleAdvancesCheckboxChange = (selectedIds) => {
    // Scoped to the rows actually on screen, so a tick only ever selects from
    // the open groups - picking one group cannot pick an advance from another.
    const rows = expandedAdvances.filter((row) => selectedIds.includes(row.id))
    setSelectedAdvances(rows)
  }

  const handleCreateAdjustment = (selectedRows) => {
    const selectedAdvanceJournalEntries = selectedRows.map((row) => ({
      ...row,
      amount: row.amount_raw ?? row.amount,
    }))

    navigate('/adjustments', {
      state: {
        selectedAdvanceJournalEntries,
      },
    })
  }

  const handleBulkCreateAdjustment = (group) => {
    const selectedAdvanceJournalEntries = group.advances.map((advance) => ({
      ...advance,
      amount: Number(advance.amount),
    }))

    navigate('/adjustments', {
      state: {
        selectedAdvanceJournalEntries,
      },
    })
  }

  const handleBulkCreateAdjustmentFromGroups = (selectedGroups) => {
    const selectedAdvanceJournalEntries = selectedGroups.flatMap((group) =>
      group.advances.map((advance) => ({
        ...advance,
        amount: Number(advance.amount),
      }))
    )

    navigate('/adjustments', {
      state: {
        selectedAdvanceJournalEntries,
      },
    })
  }

  return {
    advances,
    tableData,
    groupedAdvances,
    expandedAdvances,
    expandedGroups,
    totalDebit,
    totalCredit,
    loading,
    loadingMore,
    error,
    hasMore,
    refreshAdvances: () => fetchAdvances(false),
    loadMore: () => fetchAdvances(true),
    filterStartDate,
    setFilterStartDate,
    filterEndDate,
    setFilterEndDate,
    applyDateFilters,
    clearDateFilters,
    selectedAdvances,
    selectedGroups,
    toggleGroup,
    handleGroupsCheckboxChange,
    handleAdvancesCheckboxChange,
    handleCreateAdjustment,
    handleBulkCreateAdjustment,
    handleBulkCreateAdjustmentFromGroups,
    toast,
    closeToast: () => setToast(null),
  }
}

export default useAdvances
