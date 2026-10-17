const express = require('express')
const { issueTicket } = require('../startup/socket.startup')

/**
 * Issues the one-time ticket the WebSocket handshake presents.
 *
 * The socket used to authenticate purely from the session cookie, which works
 * only when the browser sends that cookie on the upgrade. It does not when the
 * page and the API are on different hosts - a cookie is host-scoped, and in
 * development the client is frequently reached at localhost while
 * VITE_SERVER_LINK points at a LAN address. The client cannot fall back to the
 * JWT, because the login response discards it on purpose and keeps
 * authentication on the httpOnly cookie.
 *
 * This runs over ordinary HTTP, where `credentials: 'include'` already works, so
 * it authenticates with exactly the same session the rest of the API uses. It
 * returns no tenant data - just a random string valid for one minute and one use.
 *
 * Mounted above requireSubscription for the same reason /entitlement is: a tenant
 * whose trial has lapsed still needs to receive notifications about that fact.
 */
const realtimeTicketRouter = express.Router()

realtimeTicketRouter.get('/ticket', (req, res) => {
  const ctx = req.context || {}

  const userId = Number(ctx.userId)
  const dbName = ctx.dbName || ctx.tenantDb

  // Fails closed for the same reason the tax controller does: the development
  // bypass token carries no userId, and a ticket with no tenant would be a
  // credential into every company's live feed.
  if (!Number.isFinite(userId) || userId <= 0 || !dbName) {
    return res.status(401).json({
      success: false,
      code: 'USER_REQUIRED',
      message: 'Authenticated user id and tenant are required for a realtime ticket',
    })
  }

  const ticket = issueTicket({ userId, username: ctx.username || null, dbName })

  return res.status(200).json({ success: true, ticket })
})

module.exports = { realtimeTicketRouter }