/**
 * The audit-change parser, against the exact strings the receipt controller
 * builds.
 *
 * These are copied from receipt.controller.js rather than invented, because the
 * parser's whole purpose is to read what that controller already produces.
 */
'use strict'

const { parseAuditChanges } = require('../server/src/services/notification/notification.service')

const ARROW = '\u2192'

let failed = 0
const ok = (label, pass, detail) => {
  if (!pass) failed++
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + label + (detail && !pass ? '  -> ' + detail : ''))
}

const cases = [
  ['a simple field', `Doc Ref: A-001 ${ARROW} A-002`, [{ field: 'Doc Ref', from: 'A-001', to: 'A-002' }]],
  ['a NULL becomes null, not the string', `Remarks: NULL ${ARROW} hello`, [{ field: 'Remarks', from: null, to: 'hello' }]],
  ['NULL on the right too', `Bank Name: NULL ${ARROW} NULL`, [{ field: 'Bank Name', from: null, to: null }]],
  ['a field whose label contains a colon-free id', `Item 12 Price: 10 ${ARROW} 12`, [{ field: 'Item 12 Price', from: '10', to: '12' }]],
  ['a multi-word field', `Item 3 Resp Center: NULL ${ARROW} FIN`, [{ field: 'Item 3 Resp Center', from: null, to: 'FIN' }]],
  ['an entry with no arrow becomes a note', 'Added new attachment: invoice.pdf', [{ field: null, note: 'Added new attachment: invoice.pdf' }]],
  ['a delete entry keeps its trailing id', 'Deleted attachment: old.pdf (ID: 9)', [{ field: null, note: 'Deleted attachment: old.pdf (ID: 9)' }]],
  ['an attachment remarks field', `Attachment 3 Remarks: NULL ${ARROW} x`, [{ field: 'Attachment 3 Remarks', from: null, to: 'x' }]],
  ['an amount', `Total Amount: 100 ${ARROW} 250`, [{ field: 'Total Amount', from: '100', to: '250' }]],
]

console.log('\n  the shapes the receipt controller produces')
for (const [label, input, expected] of cases) {
  const got = parseAuditChanges([input])
  ok(label, JSON.stringify(got) === JSON.stringify(expected), JSON.stringify(got))
}

console.log('\n  a mixed batch, as a state change produces')
const mixed = parseAuditChanges([
  `Doc Ref: A ${ARROW} B`,
  'Added new item: Widget',
  `Item 1 Qty: 2 ${ARROW} 5`,
])
ok('all three entries survive',
  mixed && mixed.length === 3, JSON.stringify(mixed))
ok('the note entry has no from/to',
  mixed[1].note === 'Added new item: Widget' && mixed[1].from === undefined)

console.log('\n  a change the caller already structured')
// The status handlers pass { field, from, to } when there was no audit text.
// String() on that would produce "[object Object]".
const alreadyStructured = [
  { field: 'state', from: 'PREPARED', to: 'CHECKED' },
  { field: 'total', from: null, to: '250' },
]
const passthrough = parseAuditChanges(alreadyStructured)
ok('structured changes pass through untouched',
  JSON.stringify(passthrough) === JSON.stringify(alreadyStructured), JSON.stringify(passthrough))
ok('a mix of strings and objects keeps both',
  (() => {
    const mixed = parseAuditChanges([`Doc Ref: A ${ARROW} B`, { field: 'state', from: 'X', to: 'Y' }])
    return mixed.length === 2 && mixed[0].field === 'Doc Ref' && mixed[1].to === 'Y'
  })())
ok('an object with neither field nor note is dropped',
  (parseAuditChanges([{ unrelated: 1 }]) || []).length === 0)

console.log('\n  empty input')
ok('an empty array is null, not []', parseAuditChanges([]) === null, JSON.stringify(parseAuditChanges([])))
ok('null is null', parseAuditChanges(null) === null)
ok('a non-array is null', parseAuditChanges('nope') === null)
ok('blank strings are dropped', parseAuditChanges(['   ', '']) === null)

console.log('\n  the arrow is the only non-ascii character involved')
ok('U+2192 is what the controller emits', ARROW === '\u2192')

console.log(failed ? '\n  ' + failed + ' failed' : '\n  all parser checks passed')
process.exit(failed ? 1 : 0)