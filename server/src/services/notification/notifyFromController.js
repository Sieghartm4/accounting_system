const { createAndNotify, parseAuditChanges } = require('./notification.service')
const { Query } = require('../../database/util/queries.util')

/**
 * Fire a notification from inside a document controller without letting it
 * become the document controller's problem.
 *
 * Three rules, all learned the hard way:
 *
 *   1. It never throws. A notification failure must not turn a successful receipt
 *      save into a 500, or roll back a committed transaction. Everything is
 *      caught and logged.
 *   2. It runs after the response, via setImmediate, so notification latency
 *      never shows up in the save's response time.
 *   3. The actor is taken from req.context.userId, never from the document's
 *      `*_created_by` column. That column is populated from req.body.created_by,
 *      which the client controls, so using it would let a caller forge who they
 *      are and suppress their own notification.
 */

/**
 * Resolve companyId from the request context.
 *
 * A document event carries no companyId - the client never selects one when
 * saving a receipt - so it is looked up in the tenant's own master_company. The
 * tenant argument is not optional here: querying master_company without it
 * resolves the process-global default database, where the table is empty or
 * belongs to another company, and the notification is silently dropped.
 *
 * `ORDER BY mc_company_id` rather than a bare LIMIT 1 so the same tenant always
 * resolves to the same company instead of whichever row MySQL returns first.
 */
const resolveCompanyId = async (event, dbName) => {
  if (event.companyId && Number.isInteger(event.companyId) && event.companyId > 0) {
    return event.companyId
  }

  if (!dbName) return null

  try {
    const rows = await Query(
      `SELECT mc_company_id FROM master_company ORDER BY mc_company_id LIMIT 1`,
      [],
      null,
      null,
      dbName,
    )
    if (rows && rows.length > 0) {
      return rows[0].mc_company_id
    }
  } catch (err) {
    console.error('[notify] failed to resolve companyId:', err?.message || err)
  }

  return null
}

/**
 * @param {object} req the express request, for the verified identity
 * @param {object} event notification payload minus the identity fields
 */
const notifyFromController = (req, event) => {
  try {
    const actorUserId =
      event.actorUserId ?? (req?.context?.userId ? Number(req.context.userId) : null)
    const actorName = event.actorName ?? req?.context?.username ?? null
    // The tenant comes from the verified token, never from CONFIG, which is a
    // process-global that concurrent requests from different companies can race.
    const dbName = event.dbName ?? req?.context?.dbName ?? null

    if (!dbName) {
      console.warn('[notify] skipped: no tenant on the request context')
      return
    }

    // dbName and actorUserId are both consumed by createAndNotify - the first
    // to address the push, the second to exclude the actor - so they are passed
    // through rather than stripped.
    const payload = {
      ...event,
      actorUserId: Number.isInteger(actorUserId) && actorUserId > 0 ? actorUserId : null,
      actorName,
      dbName,
      changes: Array.isArray(event.changes) ? parseAuditChanges(event.changes) : event.changes ?? null,
    }

    setImmediate(async () => {
      try {
        const companyId = await resolveCompanyId(event, dbName)
        if (!companyId) {
          console.warn(
            `[notify] skipped: could not resolve companyId for tenant ${dbName}`,
          )
          return
        }
        payload.companyId = companyId
        await createAndNotify(payload)
      } catch (err) {
        console.error(`[notify] failed for tenant ${dbName}:`, err?.message || err)
      }
    })
  } catch (err) {
    console.error('[notify] could not be queued:', err?.message || err)
  }
}

module.exports = { notifyFromController }