import { currentReportPeriod } from '../client/src/utils/reportPeriod.js'

const cases = [
  ['January, 31 days',        new Date(2026, 0, 15),  '2026-01-01', '2026-01-31'],
  ['February, leap',          new Date(2024, 1, 10),  '2024-02-01', '2024-02-29'],
  ['February, non-leap',      new Date(2026, 1, 10),  '2026-02-01', '2026-02-28'],
  ['April, 30 days',          new Date(2026, 3, 1),   '2026-04-01', '2026-04-30'],
  ['December, year boundary', new Date(2026, 11, 31), '2026-12-01', '2026-12-31'],
  ['Last day of month',       new Date(2026, 6, 31),  '2026-07-01', '2026-07-31'],
]

let failed = 0
for (const [label, now, start, end] of cases) {
  const got = currentReportPeriod(now)
  const ok = got.start === start && got.end === end
  if (!ok) failed++
  console.log(
    '  ' + (ok ? 'ok   ' : 'FAIL ') +
    label.padEnd(26) +
    got.start + ' .. ' + got.end +
    (ok ? '' : '   expected ' + start + ' .. ' + end)
  )
}

// The month must come from local time. toISOString() would convert to UTC and
// roll the date over near midnight, or anywhere west of Greenwich.
const lateLocal = new Date(2026, 4, 31, 23, 30, 0)
const gotLate = currentReportPeriod(lateLocal)
const okLate = gotLate.start === '2026-05-01' && gotLate.end === '2026-05-31'
if (!okLate) failed++
console.log('  ' + (okLate ? 'ok   ' : 'FAIL ') + 'local time near midnight'.padEnd(26) + gotLate.start + ' .. ' + gotLate.end)

const isoShape = /^\d{4}-\d{2}-\d{2}$/.test(gotLate.start) && /^\d{4}-\d{2}-\d{2}$/.test(gotLate.end)
if (!isoShape) failed++
console.log('  ' + (isoShape ? 'ok   ' : 'FAIL ') + 'values are yyyy-mm-dd'.padEnd(26))

console.log(failed ? '  ' + failed + ' failed' : '  all period checks passed')
process.exit(failed ? 1 : 0)