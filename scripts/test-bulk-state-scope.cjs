/**
 * A `nextState` that is not in scope where it is used.
 *
 * `PUT /receipt/receipt-state` returned 500 with
 *
 *   ReferenceError: nextState is not defined
 *     at updateReceiptState (receipt.controller.js:2678:103)
 *
 * A bulk-fix script renamed every `${result.nextState}` to `${nextState}` so the
 * notification loops would read a value declared next to them. The rename was
 * file-wide, so it also rewrote the audit loop, where `nextState` never existed.
 * Because the audit loop runs after the update commits, this broke status
 * changes for receipts outright while the syntax stayed perfectly valid.
 *
 * `node --check` cannot see this, and no unit test reached the handler, so the
 * rule is checked here: inside a loop, a bare `nextState` must have been declared
 * since that loop began.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const DIR = path.join(__dirname, '..', 'server/src/controller')
const CONTROLLERS = [
  'receipt', 'sales', 'purchase', 'payments',
  'collection', 'adjustments', 'cash_disbursement',
]

let failed = 0
const ok = (label, pass, detail) => {
  if (!pass) failed++
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + label + (detail && !pass ? '  -> ' + detail : ''))
}

const isComment = (l) => /^\s*(\/\/|\*|\/\*)/.test(l)

/**
 * Reduce a line to the code that affects scoping: drop comments and the literal
 * text of template strings, while keeping the identifiers inside `${...}`.
 *
 * Both dropped things contain braces and the word nextState, and neither is a
 * variable reference - but the *interpolations* are references, and that is
 * exactly where the crash was (`STATE UPDATE: ... → ${nextState}`). Stripping
 * template bodies wholesale hid the very expression this check exists to find,
 * so interpolation contents are preserved and only their delimiters are removed.
 */
const code = (raw) => {
  let out = raw.replace(/\/\/.*$/, '')
  let inTemplate = false
  let result = ''
  for (let i = 0; i < out.length; i++) {
    const ch = out[i]
    if (ch === '`') { inTemplate = !inTemplate; continue }
    if (!inTemplate) { result += ch; continue }
    if (ch === '$' && out[i + 1] === '{') {
      // Keep the expression, drop the delimiters so depth is unaffected.
      let depth = 1
      result += ' '
      for (i += 2; i < out.length && depth > 0; i++) {
        if (out[i] === '{') depth++
        else if (out[i] === '}') { depth--; if (depth === 0) break }
        result += out[i]
      }
      continue
    }
  }
  return result
}

for (const name of CONTROLLERS) {
  const file = path.join(DIR, `${name}.controller.js`)
  const lines = fs.readFileSync(file, 'utf8').split('\n')

  // Scope stack: one frame per open brace, flagged if a nextState was declared
  // in that block. A `let` declared in a block is visible to every block nested
  // inside it, so a use is in scope when any open frame is flagged.
  const frames = [{ declared: false }]
  const offenders = []

  const inScope = () => frames.some((f) => f.declared)

  lines.forEach((raw, i) => {
    const stripped = code(raw)

    if (/^\s*(const|let|var)\s+nextState\b/.test(stripped)) {
      frames[frames.length - 1].declared = true
    }

    const isUse =
      /(^|[^.\w])nextState\b/.test(stripped) &&
      !/^\s*(const|let|var)\s+nextState\b/.test(stripped) &&
      !/nextState\s*:/.test(stripped)

    if (isUse && !isComment(raw) && !inScope()) {
      offenders.push(`L${i + 1}: ${raw.trim().slice(0, 72)}`)
    }

    for (const ch of stripped) {
      if (ch === '{') frames.push({ declared: false })
      else if (ch === '}') { if (frames.length > 1) frames.pop() }
    }
  })

  ok(`${name} has no out-of-scope nextState`, offenders.length === 0,
    offenders.join('  |  '))
}

console.log('\nthe regression that caused it')
const receipt = fs.readFileSync(path.join(DIR, 'receipt.controller.js'), 'utf8')
// This handler is the odd one out: its promise resolves to
// { id, nextState, auditChanges }, so `result` is the correct source here.
ok('the receipt state handler still reads result.nextState',
  /STATE UPDATE:[^\n]*result\.nextState/.test(receipt),
  'its promise resolves to an object, unlike the other thirteen bulk blocks')
ok('its notification reads result, not the requested row',
  /title: `Receipt \$\{result\.id\}[^`]*\$\{result\.nextState\}`/.test(receipt))
ok('it keeps the audit changes the promise computed',
  /changes: result\.auditChanges \|\|/.test(receipt))
ok('the response reports what the promise resolved',
  /updates: results\.map\(\(result\) => \(\{\s*id: result\.id,\s*nextState: result\.nextState/.test(receipt))
ok('and the misleading comment about raw execute results is gone',
  !/Same reason as the notification ids above: `results` are raw/.test(receipt))

console.log(failed ? `\n  ${failed} failed` : '\n  every nextState reference is in scope')
process.exit(failed ? 1 : 0)