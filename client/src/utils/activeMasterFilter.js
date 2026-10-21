// ─────────────────────────────────────────────────────────────────────────────
// Inactive master-data filtering for transaction modules
// (charts of accounts, VAT/WHT options, responsibility centers, products)
// ─────────────────────────────────────────────────────────────────────────────
// Rows marked INACTIVE in the settings masters must not appear in the
// dropdowns of the transaction modules (receipt, disbursement, sales,
// purchase, adjustments). Rows already referenced by a loaded transaction
// stay included so edit/view mode still displays the saved values.
//
// Masters without a status field (e.g. product/service) are always included
// so this stays safe to apply indiscriminately.

export const isActiveMasterRow = (row) => {
  if (row === null || row === undefined) return false
  const status = String(row?.status ?? '').trim().toLowerCase()
  if (status === '') return true
  return status !== 'inactive'
}

// rows                 : master rows or mapped option objects
// referencedValues     : ids/names already used by the loaded transaction
// key                  : which row field the referenced values match
//                        ('id' for most masters, 'name' for responsibility
//                        centers whose option value is the center name)
export function filterActiveMasterRows(rows, referencedValues = [], key = 'id') {
  const referenced = new Set((referencedValues || []).map((v) => String(v)))
  return (rows || []).filter((row) => {
    if (isActiveMasterRow(row)) return true
    if (referenced.size === 0) return false
    const ref = row && (row[key] ?? row.id)
    return ref !== undefined && ref !== null && referenced.has(String(ref))
  })
}
