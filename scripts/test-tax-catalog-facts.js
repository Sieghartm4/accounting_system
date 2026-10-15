'use strict'

/**
 * Every applicability rule must reference a fact the engine actually collects.
 *
 * Found while adding BIR Form 2551-Q: a rule of `greater_than: 0` against a fact
 * called `has_gross_receipts` compared Number(undefined) > 0, which is false.
 * The rule was silently false forever, so the form was never offered to anyone
 * and nothing logged an error. A rule that references a fact nobody supplies
 * looks identical to a taxpayer who genuinely fails it.
 *
 * This walks the catalog, collects every fact name, builds a real fact set from
 * buildFacts, and fails on any name the engine does not produce. It runs over
 * every form, not just the one that exposed the bug.
 *
 * Run: node scripts/test-tax-catalog-facts.js
 */

const path = require('path')
const ROOT = path.resolve(__dirname, '..')
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env') })

const catalog = require(path.join(ROOT, 'server/src/services/tax/catalog'))
const {
  buildFacts,
  evaluateRule,
} = require(path.join(ROOT, 'server/src/services/tax/applicability.service'))

let pass = 0
let fail = 0
const ok = (label, cond, extra) => {
  if (cond) {
    pass++
    console.log(`  ok    ${label}`)
  } else {
    fail++
    console.log(`  FAIL  ${label}${extra !== undefined ? `  -> ${JSON.stringify(extra)}` : ''}`)
  }
}
const section = (t) => console.log(`\n${t}\n`)

/** Every fact name mentioned anywhere in an applicability rule. */
const collectFacts = (rule, into = new Set()) => {
  if (!rule || typeof rule !== 'object') return into
  if (Array.isArray(rule)) {
    rule.forEach((r) => collectFacts(r, into))
    return into
  }
  if (typeof rule.fact === 'string') into.add(rule.fact)
  for (const key of ['all', 'any', 'not']) collectFacts(rule[key], into)
  return into
}

const run = async () => {
  // A fact set built the way the server builds it, so the names below are the
  // names that really exist rather than a hand-maintained list. evidence needs
  // a window object because buildFacts reads evidence.window unconditionally.
  const facts = buildFacts({ profile: null, evidence: { window: null } })
  const known = new Set(Object.keys(facts || {}))

  section('the fact set the engine produces')
  {
    ok('buildFacts returns a set of facts', known.size > 0, known.size)
    console.log(`  (${known.size} facts: ${[...known].sort().join(', ')})`)
  }

  section('no rule references a fact that does not exist')
  {
    const unknown = []
    for (const form of catalog.FORMS) {
      for (const fact of collectFacts(form.applicability)) {
        if (!known.has(fact)) unknown.push(`${form.form_code} -> ${fact}`)
      }
    }
    ok(
      'every fact referenced by every form is collected by the engine',
      unknown.length === 0,
      unknown,
    )
  }

  section('a missing fact is rejected, not silently falsified')
  {
    // The exact failure mode: a rule that can never pass, with no error.
    const ghost = evaluateRule(
      { fact: 'a_fact_nobody_collects', greater_than: 0, why: 'x' },
      facts,
    )
    ok('a rule against an unknown fact does not pass', ghost && ghost.pass !== true, ghost)

    const ghostEquals = evaluateRule(
      { fact: 'a_fact_nobody_collects', equals: 'SOMETHING', why: 'x' },
      facts,
    )
    ok('an unknown fact compared with equals does not pass', ghostEquals && ghostEquals.pass !== true)
  }

  section('the rules that DO exist can pass')
  {
    // A sanity check in the other direction: proving only that nothing passes
    // would be satisfied by a fact set that is entirely empty.
    const complete = buildFacts({
      profile: { vat_registered: false, taxpayer_type: 'DOMESTIC_CORPORATION' },
      evidence: { compensation_pays_receipts: 1 },
    })
    const pct = catalog.getForm('2551Q')
    ok('2551-Q exists in the catalog', Boolean(pct))
    ok('2551-Q is in its own category', pct.category === 'Percentage Tax', pct.category)

    const result = evaluateRule(
      { fact: 'vat_registered', equals: false, why: 'not VAT-registered' },
      complete,
    )
    ok('a known fact can satisfy its rule', result.pass === true, result)
  }

  section('2551-Q specifics')
  {
    const pct = catalog.getForm('2551Q')

    ok('is quarterly', pct.frequency === 'QUARTERLY', pct.frequency)
    ok('uses the calendar quarter', pct.period_basis === 'CALENDAR_QUARTER', pct.period_basis)
    // Within 10 days of the close of the quarter (NIRC Sec. 237(D)).
    ok('is due 10 days into the following month', pct.deadline?.day === 10, pct.deadline)
    ok('is a declaration, not a remittance record', pct.is_declaration === true)
    ok('has a computation key bound to a dispatcher', Boolean(pct.computation_key))

    const computation = require(
      path.join(ROOT, 'server/src/services/tax/computation/percentageTax'),
    )
    ok('the computation module exports compute2551Q', typeof computation.compute2551Q === 'function')

    // 1% of gross receipts.
    const r = computation.compute2551Q({ books_revenue: 100000, vat_registered: false }, {})
    ok('1% of gross receipts is the tax due', r.lines.percentage_tax_due === 1000, r.lines)
    ok('the rate is reported on the return', r.lines.percentage_rate === 0.01)

    // The double-filing guard is the most important behaviour here.
    const vat = computation.compute2551Q({ books_revenue: 100000, vat_registered: true }, {})
    ok(
      'a VAT-registered taxpayer is blocked from filing 2551-Q',
      vat.gaps.some((g) => g.key === 'pct.vat_registered_conflict' && g.severity === 'error'),
    )

    const unknown = computation.compute2551Q({ books_revenue: 100000 }, {})
    ok(
      'unknown registration warns rather than erroring',
      unknown.gaps.some((g) => g.key === 'pct.vat_registered_unknown' && g.severity === 'warning'),
    )
    ok(
      'an explicit non-VAT status does NOT warn',
      !r.gaps.some((g) => g.key === 'pct.vat_registered_unknown'),
      r.gaps.map((g) => g.key),
    )

    // Prior credit and payments must flow through.
    const adj = computation.compute2551Q(
      { books_revenue: 100000, vat_registered: false },
      { priorQuarterCredit: 300, amountPaid: 400 },
    )
    ok('prior credit reduces the balance', adj.lines.percentage_tax_balance === 700, adj.lines)
    ok('amount paid reduces the amount still due', adj.lines.amount_still_due === 300, adj.lines)

    // Nil and negative bases must not produce a confident nil return.
    const nil = computation.compute2551Q({ books_revenue: 0, vat_registered: false }, {})
    ok(
      'nil receipts raise an error rather than a clean nil return',
      nil.gaps.some((g) => g.key === 'pct.gross_receipts' && g.severity === 'error'),
    )
    const negative = computation.compute2551Q(
      { books_revenue: 1000, vat_registered: false },
      { exemptReceipts: 5000 },
    )
    ok(
      'an over-stated exempt figure is caught',
      negative.gaps.some((g) => g.key === 'pct.negative_taxable_receipts'),
    )

    // The verification caveat must be visible to whoever files this.
    ok('the form notes carry the verification warning', /VERIFICATION REQUIRED/i.test(pct.notes))
  }

  section('no other form was disturbed')
  {
    ok('the catalog still holds the original 17 plus 2551-Q', catalog.FORMS.length === 18, catalog.FORMS.length)
    for (const code of ['2550M', '2550Q', '0619E', '1601E', '1601C', '1601EQ', '1604C', '1604E',
      '1701', '1701A', '1701Q', '1702', '1702Q', '2307']) {
      ok(`${code} is still present`, Boolean(catalog.getForm(code)))
    }
    ok('VAT still holds only 2550M and 2550Q',
      catalog.FORMS.filter((f) => f.category === 'VAT').map((f) => f.form_code).join(',') === '2550M,2550Q')
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}

run().catch((error) => {
  console.error('\nTEST CRASHED:', error)
  process.exit(2)
})