const POSTED_STATES = ['APPROVED', 'POSTED', 'LOCKED']

/**
 * A document lifecycle state is "posted" (immutable) once it reaches
 * APPROVED / POSTED / LOCKED. Posted journal entries can no longer be edited,
 * deleted, replaced, or have their amount/date/account changed.
 */
export const isPostedDocument = (state) =>
  POSTED_STATES.includes(String(state || '').toUpperCase())

/**
 * Invokes POST /journal_entries/reverse to create a REVERSAL adjusting entry
 * against a posted transaction. The original transaction is never modified;
 * the reversal (DR/CR mirrored) is created as a PREPARED adjustment and must
 * be checked and approved before it appears in the general journal.
 */
export const createReversal = async ({ dbName, dbId, date, remarks }) => {
  const token = sessionStorage.getItem('authenticated')
  if (!token) throw new Error('No authentication token found')

  const response = await fetch(
    `${import.meta.env.VITE_SERVER_LINK}/journal_entries/reverse`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        db_name: dbName,
        db_id: dbId,
        posting_date: date || new Date().toISOString().split('T')[0],
        remarks: remarks || `Reversal of ${String(dbName).toUpperCase()} ${dbId}`,
      }),
    },
  )

  const result = await response.json()
  if (!response.ok) {
    throw new Error(result.message || 'Failed to create reversal')
  }
  return result
}