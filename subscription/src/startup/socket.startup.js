const { WebSocketServer } = require('ws')
const { logger } = require('../util/logger.util')
let wss = null

/**
 * Initialize WebSocket Server
 * @param {http.Server} server - The raw HTTP server instance
 */
const initWebSocket = (server) => {
  wss = new WebSocketServer({ server })

  wss.on('connection', (ws) => {
    // console.log('🔌 Client connected to WebSocket')

    ws.on('close', () => {
      // console.log('🔌 Client disconnected from WebSocket')
    })
  })
}

/**
 * Broadcast data to all connected clients
 * @param {Object} data - The data object to send
 * @param {String} type - The type of event (default: ROOM_UPDATE)
 */
const broadcastUpdates = (data, type) => {
  if (!wss) {
    console.warn('⚠️ WebSocket not initialized, skipping broadcast.')
    return
  }

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type, data }))
    }
  })
}

module.exports = { initWebSocket, broadcastUpdates }
