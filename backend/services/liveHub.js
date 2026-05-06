const jwt = require('jsonwebtoken')
const { WebSocket, WebSocketServer } = require('ws')

function safeSend(ws, payload) {
  if (ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify(payload))
}

function attachLiveServer(server, { app } = {}) {
  const wss = new WebSocketServer({ server, path: '/live' })
  const socketsByUserId = new Map()

  function removeSocket(ws) {
    if (!ws.user) return

    const userId = ws.user.user_id
    const sockets = socketsByUserId.get(userId)
    if (!sockets) return

    sockets.delete(ws)
    if (sockets.size === 0) socketsByUserId.delete(userId)
  }

  function addSocket(ws, user) {
    ws.user = user

    const sockets = socketsByUserId.get(user.user_id) || new Set()
    sockets.add(ws)
    socketsByUserId.set(user.user_id, sockets)
  }

  function broadcastToUsers(userIds, payload) {
    for (const userId of new Set(userIds.filter(Boolean))) {
      const sockets = socketsByUserId.get(userId)
      if (!sockets) continue

      for (const socket of sockets) {
        safeSend(socket, payload)
      }
    }
  }

  function broadcastLoadPing(load, ping, exceptions = []) {
    const recipients = [load.shipper_id, load.driver_id]

    broadcastToUsers(recipients, {
      type: 'load_ping',
      load_id: load.id,
      ping,
      exceptions,
    })

    if (exceptions.length > 0) {
      broadcastToUsers(recipients, {
        type: 'load_exception',
        load_id: load.id,
        exceptions,
      })
    }
  }

  wss.on('connection', (ws, request) => {
    try {
      const url = new URL(request.url, 'http://localhost')
      const token = url.searchParams.get('token')
      const user = jwt.verify(token, process.env.JWT_SECRET)

      addSocket(ws, user)
      safeSend(ws, { type: 'live_ready' })
      ws.on('close', () => removeSocket(ws))
      ws.on('error', () => removeSocket(ws))
    } catch {
      ws.close(1008, 'Unauthorized')
    }
  })

  const hub = {
    broadcastLoadPing,
    broadcastToUsers,
    close: () => new Promise((resolve) => wss.close(resolve)),
    wss,
  }

  if (app) app.set('liveHub', hub)

  return hub
}

module.exports = {
  attachLiveServer,
}
