/**
 * GET /company/single response shape.
 *
 * The endpoint is a single-resource read, but it answered with
 * `data: [company]`. Three of its four consumers read `data.company_name`, so
 * every company field arrived undefined: the sidebar logo and name went blank
 * and the company profile form rendered empty even though the API returned 200
 * with the right row.
 *
 * A 200 with an unusable shape is why this looked like "not being fetched".
 * These checks pin the shape for all four consumers at once.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const CLIENT = path.join(ROOT, 'client/src')
const SRV = path.join(ROOT, 'server/src')
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

let failed = 0
const ok = (label, pass, detail) => {
  if (!pass) failed++
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + label + (detail && !pass ? '  -> ' + detail : ''))
}

const controller = read(path.join(SRV, 'controller/company.controller.js'))
const routes = read(path.join(SRV, 'routes/company.routes.js'))
const useCompany = read(path.join(CLIENT, 'pages/company/useCompany.js'))
const sidebar = read(path.join(CLIENT, 'components/layout/Sidebar.jsx'))
const hook = read(path.join(CLIENT, 'hooks/useNotifications.js'))
const tax = fs
  .readdirSync(path.join(CLIENT, 'pages/tax_compliance'))
  .map((f) => read(path.join(CLIENT, 'pages/tax_compliance', f)))
  .join('\n')

console.log('\nthe single-company endpoint answers with an object')
ok('data is the company, not an array',
  /data: company,/.test(controller) && !/data: company \? \[company\] : \[\]/.test(controller),
  'an array here is what left every consumer reading undefined')
ok('the row is still LIMIT 1',
  /build\(\) \+ ' LIMIT 1'/.test(controller))
ok('the list endpoint is untouched',
  /companyRouter\.get\('\/', getAllCompanies\)/.test(routes))
ok('the single route is registered', /companyRouter\.get\('\/single', getCompany\)/.test(routes))

console.log('\nno consumer is left assuming a shape that does not come back')
// Each of these read `result.data.<field>`, which is only meaningful when data
// is an object.
for (const [name, src] of [['useCompany', useCompany], ['Sidebar', sidebar], ['TaxCompliance', tax]]) {
  ok(`${name} reads the company fields directly off data`,
    /result\.data\.(company_id|company_name)/.test(src) || /setCompany\(result\.data\)/.test(src))
}
ok('useCompany assigns the response straight to state',
  /setCompany\(result\.data\)/.test(useCompany))
ok('the sidebar reads company_name and logo off the company',
  /company\.company_name/.test(sidebar) && /company\.logo/.test(sidebar))
ok('TaxCompliance maps the profile fields off data',
  /id: result\.data\.company_id/.test(tax) && /name: result\.data\.company_name/.test(tax))

console.log('\nthe one consumer that coped with the array still works')
// The notification hook is the only place that had unwrapped data[0], so it is
// the one place that would have broken when the server shape was corrected.
ok('it unwraps both shapes',
  /Array\.isArray\(json\?\.data\) \? json\.data\[0\] : json\?\.data/.test(hook))
ok('and still reads the id off either form',
  /company\?\.company_id \?\? company\?\.mc_company_id/.test(hook))
ok('it rejects an empty company rather than defaulting to 1',
  /throw new Error\('No company is available for this account'\)/.test(hook))

console.log(failed ? `\n  ${failed} failed` : '\n  the company payload reaches every consumer')
process.exit(failed ? 1 : 0)