/**
 * The reporting period a report page opens on.
 *
 * Every report used to start with both dates empty, which the fetch helpers
 * read as "no filter" - so each page loaded the whole ledger and the period
 * control sat there showing nothing while a full history filled the table. The
 * month a user is actually reporting on is the one they are looking at when they
 * open the page, so that is what it opens on.
 *
 * `toISODate` is written out rather than reached for from `toISOString()`
 * because that converts to UTC. Near midnight local time, or anywhere west of
 * Greenwich, it lands on the previous or next day and the month comes out wrong.
 *
 * @param {Date} [now] Injected by tests; defaults to the current time.
 * @returns {{ start: string, end: string }} ISO yyyy-mm-dd bounds.
 */
export const currentReportPeriod = (now = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0')
  const year = now.getFullYear()
  const month = now.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()

  return {
    start: `${year}-${pad(month + 1)}-01`,
    end: `${year}-${pad(month + 1)}-${pad(lastDay)}`,
  }
}