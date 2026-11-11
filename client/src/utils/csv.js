// Shared CSV helpers used by masters pages for export/import.
// Behavior mirrors the original per-page implementations (RFC-4180-ish quoting).

export const CSV_EXCLUDE_COLUMNS = new Set(['id', '_id', 'action'])

export const csvEscape = (val) => {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object') {
    try {
      val = JSON.stringify(val)
    } catch {
      val = String(val)
    }
  }
  const escaped = String(val).replace(/"/g, '""')
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
}

// rows: array of objects (picked by headers) or arrays (index-matched).
export const toCsvContent = (headers, rows) => {
  const csvRows = [headers.join(',')]
  rows.forEach((row) => {
    csvRows.push(headers.map((h) => csvEscape(row[h])).join(','))
  })
  return csvRows.join('\n')
}

export const parseCsvLine = (line) => {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

// Parses CSV text into row objects, dropping excluded columns (id, action, ...).
export const parseCsv = (csvText) => {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  const validHeaders = headers.filter((h) => !CSV_EXCLUDE_COLUMNS.has(h))

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    if (values.length !== headers.length) continue

    const row = {}
    validHeaders.forEach((header, index) => {
      row[header] = values[index]
    })
    rows.push(row)
  }

  return rows
}

// Builds CSV content from row objects, skipping excluded columns.
export const objectsToCsv = (rows, headers = null) => {
  if (!Array.isArray(rows) || rows.length === 0) return ''
  const cols =
    headers ||
    Object.keys(rows[0] || {}).filter((h) => !CSV_EXCLUDE_COLUMNS.has(h))
  return toCsvContent(cols, rows)
}

export const downloadCsv = (csvContent, filename) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
