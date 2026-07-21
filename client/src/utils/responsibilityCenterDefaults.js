export function getItemResponsibilityCenter(item, fallbackCenter = '') {
  const value = item?.responsibilityCenter || item?.responsibility_center || ''
  if (typeof value === 'string' && value.trim()) {
    return value
  }
  return fallbackCenter || ''
}

export function getJournalEntryCenter(entry, fallbackCenter = '') {
  const value = entry?.center || entry?.responsibility_center || ''
  if (typeof value === 'string' && value.trim()) {
    return value
  }
  return fallbackCenter || ''
}
