const {
  listForUser,
  unreadCount,
  unreadCountByModule,
  markRead,
  markModuleRead,
  markAllRead,
} = require('../services/notification/notification.service')
const { Query } = require('../database/util/queries.util')

/**
 * HTTP surface for notifications.
 *
 * Read state is always derived from the caller's own identity - there is no user
 * id in the request that could be substituted, so one user cannot mark another's
 * notifications read. Both the company and the user come from the verified
 * session, with companyId as a parameter only because a tenant database can hold
 * more than one company in `master_company`; it is checked against the tenant
 * rather than trusted.
 */

/**
 * Resolve the acting user from req.context.
 *
 * Fails closed, copied from tax.controller.js. The development bypass token
 * carries no userId, and defaulting it to 1 would let any user read and clear
 * another user's notifications.
 */
const resolveUser = (req) => {
  const ctx = req.context || {}
  const userId = ctx.userId
  if (userId === null || userId === undefined) {
    const error = new Error('Authenticated user id missing from the request context')
    error.code = 'USER_REQUIRED'
    error.status = 401
    throw error
  }
  const numeric = Number(userId)
  if (!Number.isInteger(numeric) || numeric <= 0) {
    const error = new Error('Authenticated user id is not valid')
    error.code = 'USER_REQUIRED'
    error.status = 401
    throw error
  }
  return { userId: numeric, username: ctx.username || null, dbName: ctx.dbName || null }
}

/**
 * Verify the company belongs to this tenant.
 *
 * The same shape as tax.controller's resolveCompany: a missing company and an
 * unknown one produce the same response, so this cannot be used to probe which
 * company ids exist.
 */
const resolveCompany = async (req, explicitId) => {
  const raw = explicitId ?? req.query?.companyId ?? req.body?.companyId
  if (raw === null || raw === undefined || raw === '') {
    const error = new Error(
      'companyId is required. The authenticated token does not identify a company.',
    )
    error.code = 'COMPANY_REQUIRED'
    error.status = 400
    throw error
  }
  const companyId = Number(raw)
  if (!Number.isInteger(companyId) || companyId <= 0) {
    const error = new Error('companyId must be a positive integer')
    error.code = 'COMPANY_REQUIRED'
    error.status = 400
    throw error
  }

  const rows = await Query(
    `SELECT mc_company_id FROM master_company WHERE mc_company_id = ? LIMIT 1`,
    [companyId],
    null,
    null,
    req.context?.dbName,
  )
  if (!rows || rows.length === 0) {
    const error = new Error('Unknown company for this account')
    error.code = 'COMPANY_NOT_FOUND'
    error.status = 404
    throw error
  }
  return companyId
}

/** Anything already carrying a status is a deliberate error; the rest are 500s. */
const handle = (res, error) => {
  const status = error?.status || 500
  if (status >= 500) {
    console.error('[notifications]', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to process the notification request',
    })
  }
  return res.status(status).json({
    success: false,
    code: error.code || 'ERROR',
    message: error.message,
  })
}

/** GET /notifications */
const getNotifications = async (req, res) => {
  try {
    const user = resolveUser(req)
    const companyId = await resolveCompany(req)
    const filter = String(req.query.filter || 'all')
    const limit = req.query.limit

    const [items, unread] = await Promise.all([
      listForUser({ companyId, userId: user.userId, filter, limit, dbName: user.dbName }),
      unreadCount({ companyId, userId: user.userId, dbName: user.dbName }),
    ])

    return res.status(200).json({
      success: true,
      data: { items, unreadCount: unread, filter },
    })
  } catch (error) {
    return handle(res, error)
  }
}

/** GET /notifications/unread-count */
const getUnreadCount = async (req, res) => {
  try {
    const user = resolveUser(req)
    const companyId = await resolveCompany(req)
    const unread = await unreadCount({ companyId, userId: user.userId, dbName: user.dbName })
    return res.status(200).json({ success: true, data: { unreadCount: unread } })
  } catch (error) {
    return handle(res, error)
  }
}

/** GET /notifications/unread-by-module */
const getUnreadByModule = async (req, res) => {
  try {
    const user = resolveUser(req)
    const companyId = await resolveCompany(req)
    const counts = await unreadCountByModule({ companyId, userId: user.userId, dbName: user.dbName })
    return res.status(200).json({ success: true, data: { unreadByModule: counts } })
  } catch (error) {
    return handle(res, error)
  }
}

/**
 * POST /notifications/:id/read
 *
 * No userId in the body. The reader is whoever is authenticated, which is what
 * makes read state per person rather than per request.
 */
const postMarkRead = async (req, res) => {
  try {
    const user = resolveUser(req)
    const companyId = await resolveCompany(req)
    const result = await markRead({
      companyId,
      userId: user.userId,
      notificationId: req.params.id,
      dbName: user.dbName,
    })
    const unread = await unreadCount({ companyId, userId: user.userId, dbName: user.dbName })
    return res.status(200).json({
      success: true,
      data: { ...result, unreadCount: unread },
    })
  } catch (error) {
    return handle(res, error)
  }
}

/** POST /notifications/read-by-module?module=receipts */
const postMarkModuleRead = async (req, res) => {
  try {
    const user = resolveUser(req)
    const companyId = await resolveCompany(req)
    const result = await markModuleRead({
      companyId,
      userId: user.userId,
      module: req.query?.module ?? req.body?.module,
      dbName: user.dbName,
    })
    // Both counts come back so the badge on the sidebar and the badge in the
    // header are corrected together; the client cannot fix one without the other.
    const [unread, byModule] = await Promise.all([
      unreadCount({ companyId, userId: user.userId, dbName: user.dbName }),
      unreadCountByModule({ companyId, userId: user.userId, dbName: user.dbName }),
    ])
    return res.status(200).json({
      success: true,
      data: { ...result, unreadCount: unread, unreadByModule: byModule },
    })
  } catch (error) {
    return handle(res, error)
  }
}

/** POST /notifications/read-all */
const postMarkAllRead = async (req, res) => {
  try {
    const user = resolveUser(req)
    const companyId = await resolveCompany(req)
    await markAllRead({ companyId, userId: user.userId, dbName: user.dbName })
    // Marking all read also clears every per-module badge, otherwise the
    // sidebar would keep showing counts the header says are gone.
    const byModule = await unreadCountByModule({
      companyId,
      userId: user.userId,
      dbName: user.dbName,
    })
    return res.status(200).json({
      success: true,
      data: { unreadCount: 0, unreadByModule: byModule },
    })
  } catch (error) {
    return handle(res, error)
  }
}

module.exports = {
  getNotifications,
  getUnreadCount,
  getUnreadByModule,
  postMarkRead,
  postMarkModuleRead,
  postMarkAllRead,
}