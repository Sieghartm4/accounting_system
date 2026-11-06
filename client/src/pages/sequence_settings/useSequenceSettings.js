import { useState, useEffect, useCallback } from 'react'
import { API } from '../../api/endpoints'

const authHeaders = () => {
  const token = sessionStorage.getItem('authenticated')
  if (!token) throw new Error('No authorization token found')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

const request = async (path, options = {}) => {
  const response = await fetch(path, options)
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.message || `HTTP error! status: ${response.status}`)
  }
  return result
}

export const SEQUENCE_MODULES = [
  { code: 'receipts', label: 'Receipts', fallbackPrefix: 'CR' },
  { code: 'disbursements', label: 'Cash Disbursements', fallbackPrefix: 'CD' },
  { code: 'sales', label: 'Sales', fallbackPrefix: 'SO' },
  { code: 'collections', label: 'Collections', fallbackPrefix: 'CL' },
  { code: 'purchase', label: 'Purchases', fallbackPrefix: 'PO' },
  { code: 'payments', label: 'Payments', fallbackPrefix: 'PM' },
  { code: 'adjustments', label: 'Journal Vouchers', fallbackPrefix: 'JV' },
]

export const SEQUENCE_DATE_FORMATS = [
  { value: 'MMDDYY', label: 'MMDDYY (eg 110326)' },
  { value: 'YYMMDD', label: 'YYMMDD (eg 261103)' },
  { value: 'YYYYMMDD', label: 'YYYYMMDD (eg 20261103)' },
  { value: '', label: 'No date (continuous numbers)' },
]

export const moduleLabel = (code) =>
  SEQUENCE_MODULES.find((m) => m.code === code)?.label || code

export const buildSequencePreview = ({ prefix = '', date_format = '', padding = 4, next_sequence = 1 }) => {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const yy = String(now.getFullYear()).slice(-2)
  const yyyy = String(now.getFullYear())
  const dateParts = {
    MMDDYY: `${mm}${dd}${yy}`,
    YYMMDD: `${yy}${mm}${dd}`,
    YYYYMMDD: `${yyyy}${mm}${dd}`,
  }
  const datePart = date_format ? `${dateParts[date_format] || ''}-` : ''
  const padded = String(parseInt(next_sequence, 10) || 1).padStart(
    Math.min(Math.max(parseInt(padding, 10) || 4, 1), 8),
    '0',
  )
  return `${prefix}-${datePart}${padded}`
}

const useSequenceSettings = (moduleCode) => {
  const [settings, setSettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const fetchSequenceSettings = useCallback(async () => {
    try {
      setLoading(true)
      const result = await request(API.sequenceSettings(), {
        method: 'GET',
        headers: authHeaders(),
      })
      if (result.success) {
        setSettings(result.data || [])
        setError(null)
      } else {
        setError(result.message || 'Failed to fetch sequence settings')
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch sequence settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSequenceSettings()
  }, [fetchSequenceSettings])

  /**
   * The settings row for one module, or a default-shaped stub when the
   * company has not set one yet (matches the server's fallback behaviour).
   */
  const getSettingForModule = useCallback(
    (module) =>
      settings.find((row) => row.module === module) || {
        id: null,
        module,
        prefix: SEQUENCE_MODULES.find((m) => m.code === module)?.fallbackPrefix || '',
        date_format: 'MMDDYY',
        padding: 4,
        next_sequence: 1,
      },
    [settings],
  )

  /**
   * Creates the row when none exists yet, updates it otherwise. Kept in one
   * call so callers (masters page, transaction header buttons) do not care
   * which of the two it turns out to be.
   */
  const saveForModule = useCallback(
    async (module, { prefix, date_format, padding, next_sequence }) => {
      setSaving(true)
      try {
        const payload = {
          module,
          prefix: String(prefix || '').trim().toUpperCase(),
          date_format,
          padding,
          next_sequence,
        }
        const existing = settings.find((row) => row.module === module)
        const path = existing ? API.sequenceSettingsById(existing.id) : API.sequenceSettings()
        const result = await request(path, {
          method: existing ? 'PUT' : 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload),
        })
        if (result.success) {
          await fetchSequenceSettings()
          return { success: true, data: result.data }
        }
        return { success: false, message: result.message || 'Failed to save sequence' }
      } catch (err) {
        return { success: false, message: err.message || 'Failed to save sequence' }
      } finally {
        setSaving(false)
      }
    },
    [settings, fetchSequenceSettings],
  )

  return { settings, loading, saving, error, fetchSequenceSettings, getSettingForModule, saveForModule }
}

export default useSequenceSettings
