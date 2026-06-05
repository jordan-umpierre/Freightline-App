// Set a tiny limit before any modules are required so the rate limiter
// created at module load time picks up the test values.
process.env.PING_RATE_LIMIT_MAX = '3'
process.env.PING_RATE_LIMIT_WINDOW_MS = '10000'

jest.mock('../db/pool', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}))

jest.mock('../services/pingStore', () => ({
  getLatestPingsByLoadIds: jest.fn(),
  getPingsForLoad: jest.fn(),
  insertPing: jest.fn(),
}))

const request = require('supertest')
const { assignedLoad, auth } = require('../testHelpers')
const pool = require('../db/pool')
const pingStore = require('../services/pingStore')
const app = require('../app')

const VALID_PING = { latitude: 39.1, longitude: -94.5, speed_mph: 55, heading_degrees: 180 }

function postPing() {
  return request(app)
    .post('/loads/load-1/pings')
    .set('Authorization', auth('driver'))
    .send(VALID_PING)
}

function setupSuccessfulPingMocks() {
  pool.query.mockResolvedValue({ rows: [assignedLoad()] })
  pingStore.insertPing.mockResolvedValue({
    id: 'ping-1', load_id: 'load-1', latitude: 39.1, longitude: -94.5,
  })
  app.set('liveHub', { broadcastLoadPing: jest.fn() })
}

beforeEach(() => {
  jest.clearAllMocks()
})

test('ping endpoint accepts requests up to the rate limit', async () => {
  setupSuccessfulPingMocks()
  pool.query.mockResolvedValue({ rows: [assignedLoad()] })
  pingStore.insertPing.mockResolvedValue({ id: 'ping-1', load_id: 'load-1', latitude: 39.1, longitude: -94.5 })

  const response = await postPing()
  expect(response.status).toBe(201)
})

test('ping endpoint returns 429 when rate limit is exceeded', async () => {
  app.set('liveHub', { broadcastLoadPing: jest.fn() })

  // Each call needs fresh mocks since we clear between each
  for (let i = 0; i < 3; i++) {
    pool.query.mockResolvedValueOnce({ rows: [assignedLoad()] })
    pingStore.insertPing.mockResolvedValueOnce({ id: `ping-${i}`, load_id: 'load-1', latitude: 39, longitude: -94 })
  }

  // Burn through the limit (PING_RATE_LIMIT_MAX=3 set above)
  await postPing()
  await postPing()
  await postPing()

  // The 4th request should be rate-limited
  const response = await postPing()
  expect(response.status).toBe(429)
  expect(response.body.error).toMatch(/too many/i)
})
