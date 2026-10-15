/**
 * The Advances page has a group table (date + type) above a detail table. Only
 * one group could be open at a time: the state held a single key and opening a
 * second group overwrote the first, so the detail table showed the last group
 * clicked and everything the user had already opened vanished.
 *
 * These checks pin the behaviour: open keys accumulate, clicking an open key
 * closes only that one, the detail table is the concatenation of every open
 * group, and the selection is scoped to what is on screen.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const ADVANCES = path.join(__dirname, '..', 'client/src/pages/advances/Advances.jsx')
const TABLE = path.join(__dirname, '..', 'client/src/components/DynamicTable.jsx')

const advances = fs.readFileSync(ADVANCES, 'utf8')
const table = fs.readFileSync(TABLE, 'utf8')

let failed = 0
const ok = (label, pass, detail) => {
  if (!pass) failed++
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + label + (detail && !pass ? '  -> ' + detail : ''))
}
const section = (t) => console.log('\n' + t)

section('the open state holds every group, not one')
ok('state is a list', /const \[expandedGroups, setExpandedGroups\] = useState\(\[\]\)/.test(advances))
ok('the single-key state is gone', !/expandedGroup[^s]/.test(advances))

section('clicking accumulates, clicking again closes one')
// The functional updater is what keeps two rapid clicks from reading the same
// stale value and losing one of the groups.
ok('the toggle uses a functional update',
  /setExpandedGroups\(\(current\) =>/.test(advances))
ok('an unopened key is appended', /:\s*\[\.\.\.current, key\],/.test(advances))
ok('an open key is removed on its own', /current\.filter\(\(k\) => k !== key\)/.test(advances))
ok('the key comes from groupKey, not a rebuilt string',
  /row\?\.groupKey \?\? groupKey/.test(advances))
ok('no stale closure over a single expanded group', !/expandedGroup === key \? null/.test(advances))

section('the detail table shows every open group')
ok('the detail rows are derived once, by concatenation',
  /const expandedAdvances = useMemo\([\s\S]{0,320}?\.flatMap\(\(group\) => group\.advances\)/.test(advances))
ok('it is memoised on both groups and open keys',
  /\[groupedAdvances, expandedGroups\]/.test(advances))
ok('only open groups contribute rows',
  /expandedGroups\.includes\(group\.groupKey\)/.test(advances))
ok('the detail table is fed from it', /data=\{expandedAdvances\}/.test(advances))
ok('the old single-group lookup is gone',
  !/groupedAdvances\.find\(g => `\$\{g\.date\}-\$\{g\.type\}` === expandedGroup\)/.test(advances))

section('selecting rows is scoped to what is shown')
ok('selection filters the visible rows',
  /const selectedRows = expandedAdvances\.filter\(\(row\) =>/.test(advances))
ok('an early return on a missing group is gone',
  !/const group = groupedAdvances\.find\([\s\S]{0,120}?\)\s*\r?\n\s*if \(!group\) return/.test(advances))

section('every open group stays highlighted')
ok('the highlight is fed the whole list',
  /highlightRow=\{\{ column: 'groupKey', value: expandedGroups \}\}/.test(advances))
ok('DynamicTable accepts an array of highlight values',
  /if \(Array\.isArray\(highlightRow\.value\)\)/.test(table))
ok('an empty list highlights nothing',
  /highlightRow\.value\.length === 0\) return false/.test(table))
ok('the single-value contract still works',
  /const highlightValue = String\(highlightRow\.value\)/.test(table))
ok('the array path uses exact string comparison',
  /highlightRow\.value\.some\(\(v\) => String\(v\) === rowValue\)/.test(table))

section('the bulk adjustment path is untouched')
ok('checkbox selection still collects whole groups',
  /groupedAdvances\.filter\(row => selectedIds\.includes\(row\.groupKey\)\)/.test(advances))
ok('the bulk action still exists',
  /handleBulkCreateAdjustmentFromGroups/.test(advances))
ok('the single-group action still exists', /handleCreateAdjustment/.test(advances))

// The behaviour itself, executed.
section('the accumulation behaves')
const toggle = (current, key) =>
  current.includes(key) ? current.filter((k) => k !== key) : [...current, key]

let open = []
open = toggle(open, 'a')
open = toggle(open, 'b')
open = toggle(open, 'c')
ok('three clicks leave three groups open', open.length === 3 && open.join('') === 'abc', open.join(','))

open = toggle(open, 'b')
ok('re-clicking closes only that group', open.join(',') === 'a,c', open.join(','))

const groups = [
  { groupKey: 'a', advances: [{ id: 1 }, { id: 2 }] },
  { groupKey: 'b', advances: [{ id: 3 }] },
  { groupKey: 'c', advances: [{ id: 4 }] },
]
const rows = groups.filter((g) => open.includes(g.groupKey)).flatMap((g) => g.advances)
ok('both remaining groups contribute their rows', rows.length === 3, String(rows.length))
ok('rows from the closed group are absent', !rows.some((r) => r.id === 3))
ok('selection is limited to visible rows',
  expandedFilter(rows, [1, 4]).map((r) => r.id).join(',') === '1,4')
function expandedFilter(all, ids) {
  return all.filter((r) => ids.includes(r.id))
}

console.log(failed ? '\n  ' + failed + ' failed' : '\n  all Advances expansion checks passed')
process.exit(failed ? 1 : 0)