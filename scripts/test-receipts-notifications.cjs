/**
 * Phase 3: the receipts pilot.
 *
 * Receipts is the first instrumented module, so these checks exist to stop the
 * specific mistakes that this module's shape invites:
 *
 *   - updateReceipt has two exits. The safe-edit path returns early for approved
 *     documents, so hooking only the end misses every edit to a posted receipt -
 *     which is the case a reviewer cares about most.
 *   - the state endpoints take a bulk `updates` array, so one call can move many
 *     receipts and a single notification would name only one of them.
 *   - the actor must come from the verified session. The document's
 *     `r_created_by` column is populated from req.body.created_by, which the
 *     client controls.
 *   - a notification must never be able to fail the document write.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const ctrl = fs.readFileSync(
  path.join(ROOT, 'server/src/controller/receipt.controller.js'), 'utf8').replace(/\r\n/g, '\n')
const helper = fs.readFileSync(
  path.join(ROOT, 'server/src/services/notification/notifyFromController.js'), 'utf8').replace(/\r\n/g, '\n')

let failed = 0
const ok = (label, pass, detail) => {
  if (!pass) failed++
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + label + (detail && !pass ? '  -> ' + detail : ''))
}
const section = (t) => console.log('\n' + t)

// Anchored on the full definition text. Using the bare name matches an earlier
// forward reference, which silently shortened the slice under test.
const between = (from, to) => ctrl.slice(ctrl.indexOf(from), ctrl.indexOf(to))
const create = between('const createReceipts = async', 'const updateReceipt = async')
const update = between('const updateReceipt = async', 'const updateReceiptState = async')
const state = between('const updateReceiptState = async', 'const cancelReceiptState = async')
const cancel = ctrl.slice(ctrl.indexOf('const cancelReceiptState = async'))

// Only the argument blocks of the five calls, not the surrounding handlers.
const notifyBlocks = [...ctrl.matchAll(/notifyFromController\(req, \{[\s\S]*?\n\s*\}\)/g)].map((m) => m[0])

section('all five sites are instrumented')
ok('create is notified', /notifyFromController\(req/.test(create))
ok('the safe-edit exit is notified', /notifyFromController\(req/.test(update.slice(0, update.indexOf('assertEditableDocument'))))
ok('the normal update exit is notified',
  (update.match(/notifyFromController\(req/g) || []).length === 2,
  String((update.match(/notifyFromController\(req/g) || []).length))
ok('the state change is notified', /notifyFromController\(req/.test(state))
ok('cancellation is notified', /notifyFromController\(req/.test(cancel))

section('the types distinguish what happened')
const types = [...ctrl.matchAll(/type: '([A-Z_]+)'/g)].map((m) => m[1])
ok('a created event', types.includes('DOCUMENT_CREATED'), types.join(','))
ok('an updated event', types.includes('DOCUMENT_UPDATED'))
ok('a status change', types.includes('STATUS_CHANGED'))
ok('a cancellation', types.includes('CANCELLED'))
ok('every site names its module', (ctrl.match(/module: 'receipts'/g) || []).length === 5,
  String((ctrl.match(/module: 'receipts'/g) || []).length))
ok('every site deep links', (ctrl.match(/link: '\/receipts'/g) || []).length === 5)
ok('every site names its entity',
  (ctrl.match(/entityType: 'receipt'/g) || []).length === 5)

section('the safe-edit diff is reused, not rebuilt')
ok('it passes the handler\'s own changedSafe list',
  /changes: postedSafeEdit\.changedSafe/.test(update))
ok('it says the journal was left alone',
  /journal entries were left untouched/i.test(update))

section('bulk changes notify per document')
// Anchored on the closing paren: an unanchored match also accepts
// `results.slice(0, 1)`, which is exactly the bug this guard exists to catch.
ok('the state change loops over every result',
  /for \(const result of results\) \{/.test(state))
ok('it is not truncated to a subset',
  !/results\.(slice|shift|splice)\(/.test(state))
ok('it finds the state each one came from', /updates\.find\(\(u\) => u\.id === result\.id\)/.test(state))
ok('cancellation loops over validUpdates', /for \(const u of validUpdates\)/.test(cancel))
ok('a skipped receipt is not announced',
  /Only the receipts that actually moved/.test(cancel) && !/invalidUpdates[\s\S]{0,80}notifyFromController/.test(cancel))

section('the diff is structured')
ok('the state change carries from and to',
    // Receipts is the exception among the seven instrumented controllers: its
    // bulk state handler's promise resolves to { id, nextState, auditChanges }
    // rather than the raw mysql2 execute result, so `result` is the right source.
    // Rewriting these to read from `updates` by position looked tidier and broke
    // the audit loop with a ReferenceError on every status change.
    /changes: result\.auditChanges \|\| \[\s*\n\s*\{ field: 'state', from, to: result\.nextState \}/.test(state),
    'the promise resolves to an object here, unlike the other bulk blocks')
ok('and it reads the id and next state off that object',
    /title: `Receipt \$\{result\.id\}[^`]*\$\{result\.nextState\}`/.test(state))
ok('and it keeps the audit changes the promise computed',
    /body:\s*\n\s*result\.auditChanges && result\.auditChanges\.length > 0/.test(state))
ok('cancellation records the state it moved to',
  /\{ field: 'state', from: u\.currentState \?\? null, to: 'CANCELLED' \}/.test(cancel))
ok('the full update reuses auditChanges', /changes: auditChanges/.test(update))

section('the actor is the verified session, not the document')
ok('the helper reads req.context.userId',
  /req\?\.context\?\.userId \? Number\(req\.context\.userId\) : null/.test(helper))
ok('the helper reads req.context.username', /req\?\.context\?\.username/.test(helper))
// Scoped to the call payloads. Searching the whole file would match the
// controllers' own created_by handling, which is unrelated and must stay.
ok('no call site reads a created_by column for the actor',
  notifyBlocks.length === 5 && !notifyBlocks.some((b) => /created_by/.test(b)))
ok('the tenant comes from the token, not from CONFIG',
  /req\?\.context\?\.dbName/.test(helper) && !/getTenantDbOverride/.test(helper))

section('a notification cannot fail the document write')
ok('the helper wraps everything in try/catch',
  /try \{[\s\S]*?\n\s*const actorUserId/.test(helper) && /catch \(err\) \{\s*\n\s*console\.error\('\[notify\] could not be queued:/.test(helper))
  // The message names the tenant, because the failure this guards against is
  // silent and a log line without a tenant cannot be acted on.
  ok('the queued call has its own catch',
    /\[notify\] failed for tenant \$\{dbName\}:/.test(helper))
ok('it runs after the response, not before it',
  /setImmediate\(async \(\) => \{/.test(helper))
ok('every call site is after the handler has answered',
  (() => {
    // Each notifyFromController call must precede its res.status in the source,
    // which is how "queued after the work" reads here.
    const sites = [...ctrl.matchAll(/notifyFromController\(req/g)].map((m) => m.index)
    const answers = [...ctrl.matchAll(/res\.status\(\d+\)\.json/g)].map((m) => m.index)
    return sites.length === 5 && sites.every((s) => answers.some((a) => a > s))
  })())
ok('a missing tenant is refused rather than guessed',
  /if \(!dbName\) \{[\s\S]{0,160}?return/.test(helper))
ok('no getTenantDbOverride fallback is used',
  !/getTenantDbOverride\(\)\s*\|\|/.test(helper))

console.log(failed ? '\n  ' + failed + ' failed' : '\n  all receipts pilot checks passed')
process.exit(failed ? 1 : 0)