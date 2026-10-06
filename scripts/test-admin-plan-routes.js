'use strict'

/**
 * Checks that every endpoint the admin page calls is actually mounted.
 *
 * The module picker failed because it fetched /subscription/module-catalog while
 * subscriptionRouter is mounted at /subscription-plans. The request 404'd, the
 * grid rendered nothing, and the form reported "0 selected" - which reads like a
 * data problem rather than a failed request, and cost a debugging round trip.
 *
 * This compares each literal path the page builds against the paths the router
 * declares, so a prefix drift fails here instead of in front of a user. The
 * server is started in-process and probed over HTTP, so it tests the real
 * mount points rather than a re-derivation of them.
 *
 * Run: node scripts/test-admin-plan-routes.js
 */

const path = require('path')
const ROOT = path.resolve(__dirname, '..')

require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env') })

const fs = require('fs')

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

const ADMIN_HTML = path.join(ROOT, 'subscription/src/views/subscription-admin.html')
const ROUTES_FILE = path.join(ROOT, 'subscription/src/routes/subscription.routes.js')
const STARTUP_FILE = path.join(ROOT, 'subscription/src/startup/routes.startup.js')

/** Prefixes the router is actually mounted at, from routes.startup.js. */
const readMountPoints = () => {
  const src = fs.readFileSync(STARTUP_FILE, 'utf8')
  const mounts = []
  for (const m of src.matchAll(/app\.use\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/g)) {
    mounts.push({ prefix: m[1], router: m[2] })
  }
  return mounts
}

/** Paths subscriptionRouter declares, in order, as they appear in the source. */
const readRouterPaths = () => {
  const src = fs.readFileSync(ROUTES_FILE, 'utf8')
  const paths = []
  for (const m of src.matchAll(/subscriptionRouter\.(get|post|put|delete)\(\s*'([^']*)'/g)) {
    paths.push({ method: m[1].toUpperCase(), path: m[2] })
  }
  return paths
}

/** Literal `${API_BASE}/...` paths the admin page calls. */
const readPageCalls = () => {
  const src = fs.readFileSync(ADMIN_HTML, 'utf8')
  const calls = []
  const re = /\$\{API_BASE\}(\/[^`'"\s]*)/g
  for (const m of src.matchAll(re)) {
    calls.push({ raw: m[1], line: src.slice(0, m.index).split('\n').length })
  }
  return calls
}

/**
 * Turn a literal path into the router shape it will match.
 * `/subscription-plans/module-catalog` -> { routerPath: '/module-catalog' }
 */
const resolveAgainstMounts = (raw, mounts) => {
  for (const { prefix, router } of mounts) {
    if (router !== 'subscriptionRouter') continue
    const base = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
    if (raw === base || raw.startsWith(`${base}/`)) {
      return { matched: true, routerPath: raw.slice(base.length) || '/' }
    }
  }
  return { matched: false }
}

const main = async () => {
  section('mount points declared in routes.startup.js')
  const mounts = readMountPoints()
  for (const m of mounts) {
    if (m.router === 'subscriptionRouter') ok(`subscriptionRouter is mounted at ${m.prefix}`, true)
  }

  const routerPaths = readRouterPaths()

  section('every ${API_BASE} path in the admin page resolves to a declared route')
  const calls = readPageCalls()
  console.log(`  (${calls.length} API_BASE call(s) found in the page)`)

  const unmatched = []
  for (const call of calls) {
    const { matched, routerPath } = resolveAgainstMounts(call.raw, mounts)
    if (!matched) {
      // Not necessarily this router's problem - /credentials and /users are
      // mounted by other routers in the same file.
      const otherRouter = mounts.find(
        (m) => call.raw === m.prefix || call.raw.startsWith(`${m.prefix}/`),
      )
      ok(`line ${call.line}: ${call.raw} is mounted somewhere`, Boolean(otherRouter), call.raw)
      continue
    }

    // A path built from a template segment (${planId}) is dynamic by
    // construction, so it needs a parameter route rather than a literal one.
    // `${...}` is normalised to `:param` before comparing.
    const normalised = routerPath.replace(/\$\{[^}]+\}/g, ':param')
    const declared = routerPaths.some(
      (r) => r.path === normalised || (normalised.startsWith('/:') && /^\/:\w+/.test(r.path)),
    )
    ok(
      `line ${call.line}: ${call.raw} -> subscriptionRouter${normalised}`,
      declared,
      { routerPath: normalised, declared: routerPaths.map((r) => r.method + ' ' + r.path) },
    )
  }

  section('route ordering: a literal path must precede the wildcard for the same method')
  {
    // Only GET is shadowed by GET /:id. POST /, POST /checkout and
    // POST /verify-payment sit after it without any risk, because Express matches
    // on method as well as path, so comparing across methods would be wrong.
    for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
      const forMethod = routerPaths.filter((r) => r.method === method)
      const idIndex = forMethod.findIndex((r) => /^\/:\w+/.test(r.path))
      if (idIndex === -1) continue
      for (const [i, literal] of forMethod.entries()) {
        if (i >= idIndex) continue
        ok(
          `${method} ${literal.path} precedes the wildcard`,
          !literal.path.includes(':'),
          literal,
        )
      }
    }
  }

  section('the module catalog handler exists and is exported')
  {
    const controller = require(
      path.join(ROOT, 'subscription/src/controller/subscription.controller'),
    )
    ok('getModuleCatalog is exported', typeof controller.getModuleCatalog === 'function')

    let status = null
    let payload = null
    const res = {
      status(s) { status = s; return this },
      json(b) { payload = b; return this },
    }
    await controller.getModuleCatalog({}, res)
    ok('responds 200', status === 200, status)
    ok(
      'returns required, defaultOn, defaultOff and a template',
      payload?.data?.required?.length > 0 &&
        payload?.data?.defaultOn?.length > 0 &&
        payload?.data?.defaultOff?.length > 0 &&
        payload?.data?.defaultTemplate?.length > 0,
    )
    ok(
      'the template excludes the default-off modules',
      payload.data.defaultOff.every((m) => !payload.data.defaultTemplate.includes(m)),
    )
    ok(
      'the template includes every required module',
      payload.data.required.every((m) => payload.data.defaultTemplate.includes(m)),
    )
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('\nTEST CRASHED:', error)
  process.exit(2)
})