'use strict'

/**
 * The BIR Forms overview was added and then removed.
 *
 * ## History
 *
 * The tax page opened straight into whichever form the hook defaulted to,
 * behind a sidebar labelled with internal registry categories. A "BIR Forms"
 * front door was built to group the primary returns - Value Added Tax,
 * Percentage Tax, Income Tax, Withholding Tax, Other Tax - for someone who just
 * wants to file their quarter.
 *
 * That turned out to be the wrong call and was removed. The registry sidebar is
 * the single place forms are listed; a second, differently-grouped list is a
 * second thing to keep in step with the catalog, and the five-card view put a
 * curated subset in front of the authoritative one.
 *
 * This file therefore asserts two things:
 *
 *   1. the overview is gone and has not crept back
 *   2. what it was built on top of still holds - 2551-Q is a real form, it is
 *      reachable from the sidebar, and the rules that made it usable are intact
 *
 * Run: node scripts/test-bir-forms-focus.js
 */

const path = require('path')
const fs = require('fs')
const ROOT = path.resolve(__dirname, '..')
const CLIENT = path.join(ROOT, 'client/src')
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env') })

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

const read = (p) => fs.readFileSync(path.join(CLIENT, p), 'utf8')

const run = () => {
  const page = read('pages/tax_compliance/TaxRegistry.jsx')
  const hook = read('pages/tax_compliance/useTaxRegistry.js')
  const catalog = require(path.join(ROOT, 'server/src/services/tax/catalog'))

  section('the BIR Forms overview is removed')
  {
    ok('no overview component', !/BirFormsOverview/.test(page))
    ok('no group table', !/BIR_FORM_GROUPS/.test(page))
    ok('no view state', !/useState\('overview'\)/.test(page))
    ok('no overview branch', !/view === 'overview'/.test(page))
    ok('no "All forms" control', !/All forms \(/.test(page))
    ok('no breadcrumb back-link', !/setView\('overview'\)/.test(page))
    ok('none of the five card labels are defined', !/label: 'Value Added Tax'/.test(page))
    ok('no per-card blurb text', !/Does not apply if you file/.test(page))
  }

  section('selecting a form computes the current month')
  {
    // Clicking a form in the registry must show that form's figures straight
    // away. Compute stays as the button for a period the user picks by hand.
    ok('the hook exposes openForm', /openForm,/.test(hook))
    ok('openForm resets the start to the first of this month', /const start = currentMonthStart\(\)/.test(hook))
    ok('openForm resets the end to the last day of this month', /const end = currentMonthEnd\(\)/.test(hook))
    ok('openForm writes both dates back to state', /setStartDate\(start\)/.test(hook) && /setEndDate\(end\)/.test(hook))
    ok('openForm clears inputs carried from the previous form', /setInputs\(\{\}\)/.test(hook))
    // The form code and the dates must be passed in. Reading activeForm from
    // state would still hold the form the user just left, because setActiveForm
    // has not taken effect yet.
    ok('openForm computes the code it was given', /formCode: code/.test(hook))
    ok('openForm computes the dates it resolved', /startDate: start, endDate: end/.test(hook))
    ok('openForm does not save while previewing', /save: false/.test(hook))
  }

  section('the preview survives the click that opened the form')
  {
    // Opening a form computes it, and the effect that loads the form's metadata
    // runs afterwards. When that effect cleared the preview unconditionally the
    // figures were wiped a moment after arriving, so the user had to click the
    // form a second time to see them.
    ok('previews record which form they belong to', /previewFormRef/.test(hook))
    ok('the metadata effect does not clear the preview outright', !/setInputs\(\{\}\)\s*\n\s*setPreview\(null\)/.test(hook))
    ok('it clears the preview only for a different form', /previewFormRef\.current !== activeForm\) setPreview\(null\)/.test(hook))
    ok('openForm stamps its result with the form it computed', /previewFormRef\.current = code/.test(hook))
    ok('runPreview stamps its result too', /previewFormRef\.current = activeForm/.test(hook))
  }

  section('the toolbar still fits on one line')
  {
    // The filing picker is the widest control on the period line. Left on its
    // own width it pushed Export PDF onto a second row.
    const sel = page.match(/<select[\s\S]{0,400}?View a saved filing/);
    ok('the filing picker has a fixed width', !!sel && /w-\[\d+px\]/.test(sel[0]));
    ok('the filing picker does not grow past that width', !/max-w-\[\d+px\]/.test(page));
    ok('the date inputs are sized so the row holds together', (page.match(/type="date"[\s\S]{0,300}?w-\[\d+px\]/g) || []).length >= 2);
  }

  section('the saved-filing picker sits on the period line')
  {
    ok('there is exactly one filing picker', (page.match(/View a saved filing/g) || []).length === 1)
    // It belongs inside the period control: it selects a period, like the
    // two dates beside it, and it is the alternative to recomputing.
    const periodAt = page.indexOf('View a saved filing')
    const controlAt = page.lastIndexOf('bg-slate-100 border border-slate-200 rounded-lg', periodAt)
    const controlEnd = page.indexOf('</div>', page.indexOf('</select>', periodAt))
    ok('the picker is inside the period control', controlAt !== -1 && controlAt < periodAt && periodAt < controlEnd)
  }

  section('every report page opens on the current month')
  {
    // An empty start and end read as 'no filter', so each report used to load
    // the whole ledger on first paint while the period control sat there showing
    // nothing. They now open on the month the user is looking at.
    const reports = fs
      .readdirSync(path.join(CLIENT, 'pages/reports'))
      .filter((f) => f.endsWith('.jsx') && !f.startsWith('Bank'))
    for (const f of reports) {
      const src = read('pages/reports/' + f)
      ok(f + ' imports the shared period helper', /import \{ currentReportPeriod \} from '\.\.\/\.\.\/utils\/reportPeriod'/.test(src))
      ok(f + ' opens on the first of the current month', /useState\(\(\) => currentReportPeriod\(\)\.start\)/.test(src))
      ok(f + ' opens on the last day of the current month', /useState\(\(\) => currentReportPeriod\(\)\.end\)/.test(src))
      // A deep link carries an explicit period and must still win over the
      // default, otherwise drill-downs from one report to another break.
      ok(f + ' still lets a URL period override the default', !/setStartDate\(startDate\)/.test(src))
    }
  }

  section('the page opens on the form workspace, as before')
  {
    // The sidebar is the single list of forms. What must survive is the form
    // workspace itself, reached directly.
    ok('the registry sidebar still renders', /<RegistrySidebar/.test(page))
    ok('the sidebar still groups by category', /byCategory=\{byCategory\}/.test(page))
ok('selecting a form still resets the tab', /const handleOpenForm = \(code\)/.test(page))
      ok('openForm still forces the computation tab', /setTab\('computation'\)/.test(page))
      // Selecting a form now also resets the period to the current month and
      // computes, so the figures on screen belong to the form just clicked.
      ok('the sidebar routes through handleOpenForm', /onSelect=\{handleOpenForm\}/.test(page))
      ok('handleOpenForm delegates to the hook openForm', /openForm\(code\)/.test(page))
    ok('the breadcrumb still shows the active form', /\{activeForm\}/.test(page))
    ok('the BIR form badge is still shown', /BIR FORM \{formDetail\.form_code\}/.test(page))
  }

  section('every form stays reachable from the sidebar')
  {
    const orderMatch = page.match(/const CATEGORY_ORDER = \[([\s\S]*?)\]/)
    const order = orderMatch
      ? [...orderMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
      : []

    ok('the category order is populated', order.length > 0, order)
    ok(
      'Percentage Tax is in the sidebar order',
      order.includes('Percentage Tax'),
      order,
    )

    const iconMatch = page.match(/const CATEGORY_ICON = \{([\s\S]*?)\n\}/)
    const icons = iconMatch ? iconMatch[1] : ''
    ok('Percentage Tax has an icon', /'Percentage Tax':/.test(icons))

    // Every category a registry form can carry must appear, or that form silently
    // disappears from the list. This is the failure that removed the nav entry for
    // withholding tax before.
    const registryCategories = [...new Set(catalog.FORMS.map((f) => f.category))]
    const missing = registryCategories.filter((c) => !order.includes(c))
    ok(
      'every category in the registry appears in the sidebar order',
      missing.length === 0,
      missing,
    )
  }

  section('2551-Q is still a real form')
  {
    const form = catalog.getForm('2551Q')
    ok('2551-Q is in the catalog', Boolean(form))
    ok('its category is Percentage Tax', form.category === 'Percentage Tax', form.category)
    ok('quarterly on the calendar quarter', form.period_basis === 'CALENDAR_QUARTER')
    // Within 10 days of the close of the quarter, NIRC Sec. 237(D).
    ok('due 10 days into the following month', form.deadline?.day === 10, form.deadline)
    ok('bound to a computation', form.computation_key === 'PCT_2551Q')

    const dispatcher = fs.readFileSync(
      path.join(ROOT, 'server/src/services/tax/computation/index.js'),
      'utf8',
    )
    ok('the dispatcher binds it', /PCT_2551Q:\s*percentageTax\.compute2551Q/.test(dispatcher))

    ok('the verification caveat is on the form', /VERIFICATION REQUIRED/i.test(form.notes))
  }

  section('the 2551-Q rules that made it usable are intact')
  {
    const computation = require(path.join(ROOT, 'server/src/services/tax/computation/percentageTax'))

    const ordinary = computation.compute2551Q({ books_revenue: 100000, vat_registered: false }, {})
    ok('1% of gross receipts is the tax due', ordinary.lines.percentage_tax_due === 1000, ordinary.lines)
    ok('an explicit non-VAT status raises no uncertainty warning',
      !ordinary.gaps.some((g) => g.key === 'pct.vat_registered_unknown'),
      ordinary.gaps.map((g) => g.key))

    // Percentage tax substitutes for VAT; filing both is the mistake worth catching.
    const vatRegistered = computation.compute2551Q({ books_revenue: 100000, vat_registered: true }, {})
    ok(
      'a VAT-registered taxpayer is blocked from filing 2551-Q',
      vatRegistered.gaps.some((g) => g.key === 'pct.vat_registered_conflict' && g.severity === 'error'),
    )

    const adjusted = computation.compute2551Q(
      { books_revenue: 100000, vat_registered: false },
      { priorQuarterCredit: 300, amountPaid: 400 },
    )
    ok('prior credit reduces the balance', adjusted.lines.percentage_tax_balance === 700)
    ok('amount paid reduces the amount still due', adjusted.lines.amount_still_due === 300)
  }

  section('no rule references a fact the engine does not collect')
  {
    // Found while adding 2551-Q: a rule of `greater_than: 0` against a fact
    // nobody collects compares NaN, fails forever, and logs nothing. The form was
    // simply never offered to anyone.
    const { buildFacts } = require(path.join(ROOT, 'server/src/services/tax/applicability.service'))
    const known = new Set(Object.keys(buildFacts({ profile: null, evidence: { window: null } })))

    const collect = (rule, into = new Set()) => {
      if (!rule || typeof rule !== 'object') return into
      if (Array.isArray(rule)) {
        rule.forEach((r) => collect(r, into))
        return into
      }
      if (typeof rule.fact === 'string') into.add(rule.fact)
      for (const k of ['all', 'any', 'not']) collect(rule[k], into)
      return into
    }

    const unknown = []
    for (const form of catalog.FORMS) {
      for (const fact of collect(form.applicability)) {
        if (!known.has(fact)) unknown.push(`${form.form_code} -> ${fact}`)
      }
    }
    ok('every applicability fact is one the engine produces', unknown.length === 0, unknown)
    ok(
      '2551-Q has no uncollectable "has receipts" rule',
      ![...collect(catalog.getForm('2551Q').applicability)].includes('has_gross_receipts'),
    )
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}

run()