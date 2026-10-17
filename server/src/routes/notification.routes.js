const express = require('express')
const {
  getNotifications,
  getUnreadCount,
  getUnreadByModule,
  postMarkRead,
  postMarkModuleRead,
  postMarkAllRead,
} = require('../controller/notification.controller')

/**
 * Notifications are cross-cutting: a receipt being approved matters to someone
 * whose plan does not include receipts. So this router carries no module gate of
 * its own, and is mounted in routes.startup.js above the per-module mounts rather
 * than inside ROUTE_MODULES. Every handler still resolves the caller's company
 * and user from the verified session.
 */
const notificationRouter = express.Router()

notificationRouter.get('/', getNotifications)
notificationRouter.get('/unread-count', getUnreadCount)
notificationRouter.get('/unread-by-module', getUnreadByModule)
notificationRouter.post('/read-all', postMarkAllRead)
// Clears a sidebar badge when the reader opens the screen the notifications
// belong to. Registered before /:id/read so "read-by-module" is not swallowed
// by that pattern as an id.
notificationRouter.post('/read-by-module', postMarkModuleRead)
notificationRouter.post('/:id/read', postMarkRead)

module.exports = { notificationRouter }