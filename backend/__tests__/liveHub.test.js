const http = require('http')
const jwt = require('jsonwebtoken')
const WebSocket = require('ws')
const app = require('../app')
const { attachLiveServer } = require('../services/liveHub')

process.env.JWT_SECRET = 'test-secret'

function token(userId, role) {
  return jwt.sign({ user_id: userId, role }, process.env.JWT_SECRET)
}

function waitForMessage(ws, type) {
  return new Promise((resolve) => {
    ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString())
      if (!type || message.type === type) resolve(message)
    })
  })
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

let server
let hub
let baseUrl

beforeEach((done) => {
  server = http.createServer(app)
  hub = attachLiveServer(server, { app })
  server.listen(0, () => {
    const { port } = server.address()
    baseUrl = `ws://127.0.0.1:${port}`
    done()
  })
})

afterEach((done) => {
  hub.close().then(() => server.close(done))
})

test('authenticated sockets receive ping broadcasts for visible loads', async () => {
  const ws = new WebSocket(`${baseUrl}/live?token=${token('shipper-1', 'shipper')}`)
  await waitForMessage(ws, 'live_ready')

  hub.broadcastLoadPing(
    { id: 'load-1', shipper_id: 'shipper-1', driver_id: 'driver-1' },
    { id: 'ping-1', load_id: 'load-1', latitude: 39, longitude: -94 },
    []
  )

  const message = await waitForMessage(ws, 'load_ping')
  expect(message).toMatchObject({
    type: 'load_ping',
    load_id: 'load-1',
    ping: { id: 'ping-1' },
  })

  ws.close()
})

test('unrelated sockets do not receive private load pings', async () => {
  const ws = new WebSocket(`${baseUrl}/live?token=${token('shipper-2', 'shipper')}`)
  const messages = []
  ws.on('message', (raw) => {
    messages.push(JSON.parse(raw.toString()))
  })
  await waitForMessage(ws, 'live_ready')

  hub.broadcastLoadPing(
    { id: 'load-1', shipper_id: 'shipper-1', driver_id: 'driver-1' },
    { id: 'ping-1', load_id: 'load-1', latitude: 39, longitude: -94 },
    []
  )
  await wait(75)

  expect(messages.some((message) => message.type === 'load_ping')).toBe(false)
  ws.close()
})
