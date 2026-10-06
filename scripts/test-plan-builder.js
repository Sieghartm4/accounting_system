'use strict'

/**
 * Exercises the plan builder endpoints' logic against the live admin database:
 * creating a plan with a seat cap and a module set, refusing invalid module
 * lists, refusing to delete a plan in use, and confirming that editing a plan
 * re-syncs the seat snapshot for the companies on it.
 *
 * Uses a scratch plan that is always removed, so no real plan is disturbed.
 *
 * Run: node scripts/test-plan-builder.js
 */

const path = require('path')
const ROOT = path.resolve(__dirname, '..')

require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env') })

const mysql = require(path.join(ROOT, 'node_modules/mysql2/promise'))
const CONFIG = require(path.join(ROOT, 'subscription/src/database/config/config'))
const catalog = require(path.join(ROOT, 'subscription/src/constants/moduleCatalog'))

const controller = require(
  path.join(ROOT, 'subscription/src/controller/subscription.controller'),
)

const pool = mysql.createPool({
  host: CONFIG[process.env.NODE_ENV].host,
  user: CONFIG[process.env.NODE_ENV].username,
  password: CONFIG[process.env.NODE_ENV].password,
  database: CONFIG[process.env.NODE_ENV].database,
  multipleStatements: true,
  charset: 'utf8mb4',
})

const SCRATCH_CODE = 'ZZ_TEST_PLAN'
const SCRATCH_DB = 'zz_plan_builder_test_company'

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

/** Call a controller handler with a stub req/res and capture what it returned. */
const call = async (handler, { method = 'POST', body = {}, params = {} } = {}) => {
  let status = null
  let payload = null
  const res = {
    status(s) { status = s; return this },
    json(b) { payload = b; return this },
    send() { return this },
  }
  await handler({ method, body, params, query: {}, headers: {} }, res, () => {})
  return { status, payload }
}

const cleanup = async () => {
  await pool.query('DELETE FROM master_company_subscription WHERE mcs_db_name = ?', [SCRATCH_DB])
  const [rows] = await pool.query('SELECT sp_id FROM subscription_plans WHERE sp_code = ?', [SCRATCH_CODE])
  for (const r of rows) {
    await pool.query('DELETE FROM plan_modules WHERE pm_plan_id = ?', [r.sp_id])
    await pool.query('DELETE FROM subscription_plan_items WHERE spi_subscription_plan_id = ?', [r.sp_id])
    await pool.query('DELETE FROM subscription_plans WHERE sp_id = ?', [r.sp_id])
  }
}

const main = async () => {
  await cleanup()

  const [planRows] = await pool.query(
    'SELECT sp_id, sp_code, sp_max_users FROM subscription_plans WHERE sp_code = ?',
    ['PRO'],
  )
  const proPlanId = planRows[0].sp_id

  /* ---------------- create with a seat cap and modules ---------------- */
  section('creating a plan with limits and modules')

  const modules = catalog.defaultModuleTemplate()
  const created = await call(controller.createSubscriptionPlan, {
    body: {
      sp_code: SCRATCH_CODE,
      sp_name: 'Test Retail Plan',
      sp_description: 'created by scripts/test-plan-builder.js',
      sp_status: 'PUBLIC',
      sp_max_users: 3,
      sp_trial_days: 14,
      sp_billing_days: 30,
      sp_price: 2499.5,
    },
  })
  ok('returns 201', created.status === 201, created.payload)
  const planId = created.payload?.data?.id
  ok('reports the new id', !!planId, planId)
  ok('echoes the seat cap', created.payload?.data?.sp_max_users === 3, created.payload?.data)
  ok('echoes the trial length', created.payload?.data?.sp_trial_days === 14, created.payload?.data)
  ok(
    'converts pesos to centavos',
    created.payload?.data?.sp_price_minor === 249950,
    created.payload?.data?.sp_price_minor,
  )
  ok('flags the plan as a trial', created.payload?.data?.sp_is_trial === 1, created.payload?.data)

  const [stored] = await pool.query(
    'SELECT sp_max_users, sp_trial_days, sp_billing_days, sp_price_minor FROM subscription_plans WHERE sp_id = ?',
    [planId],
  )
  ok('the cap was persisted', Number(stored[0].sp_max_users) === 3, stored[0])
  ok('the trial length was persisted', Number(stored[0].sp_trial_days) === 14, stored[0])

  const [granted] = await pool.query(
    'SELECT pm_module FROM plan_modules WHERE pm_plan_id = ? ORDER BY pm_module',
    [planId],
  )
  ok('the default template was granted', granted.length === modules.length, {
    expected: modules.length,
    actual: granted.length,
  })
  ok(
    'tax was not granted by default',
    !granted.some((g) => g.pm_module === 'tax_compliance'),
  )

  /* ---------------- validation ---------------- */
  section('validation')

  const noName = await call(controller.createSubscriptionPlan, {
    body: { sp_code: 'ZZ_NO_NAME', sp_max_users: 1 },
  })
  ok('a plan needs a code and a name', noName.status === 400, noName.status)

  const zeroUsers = await call(controller.createSubscriptionPlan, {
    body: { sp_code: 'ZZ_ZERO', sp_name: 'Zero', sp_max_users: 0 },
  })
  ok('a seat cap below 1 is refused', zeroUsers.status === 400, zeroUsers.status)

  const emptyModules = await call(controller.createSubscriptionPlan, {
    body: {
      sp_code: 'ZZ_EMPTY',
      sp_name: 'Empty',
      sp_max_users: 1,
      modules: [],
    },
  })
  ok(
    'an explicitly empty module list falls back to the template rather than erroring',
    emptyModules.status === 201,
    { status: emptyModules.status, body: emptyModules.payload?.errors },
  )
  if (emptyModules.payload?.data?.id) {
    const eid = emptyModules.payload.data.id
    const [eg] = await pool.query('SELECT COUNT(*) AS n FROM plan_modules WHERE pm_plan_id = ?', [eid])
    ok('the fallback template was stored', Number(eg[0].n) === modules.length, eg[0])
    await pool.query('DELETE FROM plan_modules WHERE pm_plan_id = ?', [eid])
    await pool.query('DELETE FROM subscription_plans WHERE sp_id = ?', [eid])
  }

  const badModule = await call(controller.updateSubscriptionPlan, {
    method: 'PUT',
    params: { id: planId },
    body: { sp_max_users: 3, modules: [...modules, 'not_a_real_module'] },
  })
  ok('an unknown module is refused', badModule.status === 400, badModule.status)
  ok(
    'the refusal names the offending module',
    JSON.stringify(badModule.payload?.errors || '').includes('not_a_real_module'),
    badModule.payload?.errors,
  )

  const droppedRequired = await call(controller.updateSubscriptionPlan, {
    method: 'PUT',
    params: { id: planId },
    body: { sp_max_users: 3, modules: modules.filter((m) => m !== 'dashboard') },
  })
  ok('dropping a required module is refused', droppedRequired.status === 400, droppedRequired.status)

  const [stillThere] = await pool.query(
    'SELECT COUNT(*) AS n FROM plan_modules WHERE pm_plan_id = ?',
    [planId],
  )
  ok(
    'a refused update left the module list untouched',
    Number(stillThere[0].n) === modules.length,
    stillThere[0],
  )

  const taxVariant = await call(controller.updateSubscriptionPlan, {
    method: 'PUT',
    params: { id: planId },
    body: {
      sp_max_users: 3,
      modules: [...modules, 'tax_compliance'],
    },
  })
  ok('adding tax to a plan is accepted', taxVariant.status === 200, taxVariant.payload)
  const [withTax] = await pool.query(
    'SELECT COUNT(*) AS n FROM plan_modules WHERE pm_plan_id = ? AND pm_module = ?',
    [planId, 'tax_compliance'],
  )
  ok('tax was persisted', Number(withTax[0].n) === 1, withTax[0])

  /* ---------------- deleting a plan in use ---------------- */
  section('deleting a plan')

  const inUseDelete = await call(controller.deleteSubscriptionPlan, {
    method: 'DELETE',
    params: { id: proPlanId },
  })
  ok('a plan with companies on it cannot be deleted', inUseDelete.status === 409, inUseDelete.status)
  ok('the refusal says why', inUseDelete.payload?.code === 'PLAN_IN_USE', inUseDelete.payload)

  const unusedDelete = await call(controller.deleteSubscriptionPlan, {
    method: 'DELETE',
    params: { id: planId },
  })
  ok('an unused plan can be deleted', unusedDelete.status === 200, unusedDelete.status)
  const [gone] = await pool.query('SELECT COUNT(*) AS n FROM subscription_plans WHERE sp_id = ?', [planId])
  ok('the plan row is gone', Number(gone[0].n) === 0, gone[0])
  const [modulesGone] = await pool.query('SELECT COUNT(*) AS n FROM plan_modules WHERE pm_plan_id = ?', [planId])
  ok('its module grants cascaded', Number(modulesGone[0].n) === 0, modulesGone[0])

  /* ---------------- snapshot re-sync on edit ---------------- */
  section('snapshot re-sync on edit')

  // Recreate the scratch plan: the delete test above removed it.
  await cleanup()
  const recreated = await call(controller.createSubscriptionPlan, {
    body: {
      sp_code: SCRATCH_CODE,
      sp_name: 'Test Retail Plan',
      sp_status: 'PUBLIC',
      sp_max_users: 1,
      sp_billing_days: 30,
      sp_price: 2499.5,
    },
  })
  ok('the scratch plan was recreated', recreated.status === 201, recreated.payload)
  const editId = recreated.payload?.data?.id
  ok('the recreated plan has an id', !!editId, editId)

  await pool.query(
    `INSERT INTO master_company_subscription
       (mcs_db_name, mcs_plan_id, mcs_status, mcs_max_users, mcs_current_users)
     VALUES (?, ?, 'active', 1, 3)`,
    [SCRATCH_DB, editId],
  )

  const bumped = await call(controller.updateSubscriptionPlan, {
    method: 'PUT',
    params: { id: editId },
    body: { sp_name: 'Test Retail Plan', sp_max_users: 10 },
  })
  ok('the update succeeded', bumped.status === 200, bumped.payload)
  ok(
    'it reports how many companies were re-synced',
    bumped.payload?.data?.companiesResynced === 1,
    bumped.payload?.data,
  )
  const [afterSnap] = await pool.query(
    'SELECT mcs_max_users FROM master_company_subscription WHERE mcs_db_name = ?',
    [SCRATCH_DB],
  )
  ok('the snapshot took the new cap', Number(afterSnap[0].mcs_max_users) === 10, afterSnap[0])

  const partial = await call(controller.updateSubscriptionPlan, {
    method: 'PUT',
    params: { id: editId },
    body: { sp_description: 'only the description' },
  })
  ok('a partial update succeeds', partial.status === 200, partial.status)
  const [afterPartial] = await pool.query(
    'SELECT sp_max_users, sp_billing_days FROM subscription_plans WHERE sp_id = ?',
    [editId],
  )
  ok(
    'a partial update does not reset the seat cap',
    Number(afterPartial[0].sp_max_users) === 10,
    afterPartial[0],
  )

  /* ---------------- catalog endpoint ---------------- */
  section('module catalog endpoint')
  {
    const r = await call(controller.getModuleCatalog, { method: 'GET' })
    ok('returns the required set', r.status === 200 && r.payload.data.required.length > 0)
    ok(
      'required modules are a subset of all modules',
      r.payload.data.required.every((m) => r.payload.data.all.includes(m)),
    )
    ok(
      'required and default-off do not overlap',
      !r.payload.data.required.some((m) => r.payload.data.defaultOff.includes(m)),
    )
    ok(
      'the default template is the union of required and default-on',
      r.payload.data.defaultTemplate.length ===
        r.payload.data.required.length + r.payload.data.defaultOn.length,
      {
        template: r.payload.data.defaultTemplate.length,
        required: r.payload.data.required.length,
        defaultOn: r.payload.data.defaultOn.length,
      },
    )
  }

  await cleanup()
  await pool.end()

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch(async (error) => {
  console.error('\nTEST CRASHED:', error)
  try {
    await cleanup()
    await pool.end()
  } catch (e) {
    /* best effort */
  }
  process.exit(2)
})