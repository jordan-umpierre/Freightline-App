const jwt = require('jsonwebtoken')
const request = require('supertest')

jest.mock('../db/pool', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}))

jest.mock('../services/pingStore', () => ({
  getLatestPingsByLoadIds: jest.fn(),
  getPingsForLoad: jest.fn(),
  insertPing: jest.fn(),
}))

process.env.JWT_SECRET = 'test-secret'

const pool = require('../db/pool')
const pingStore = require('../services/pingStore')
const app = require('../app')

function auth(role, userId = `${role}-1`) {
  return `Bearer ${jwt.sign({ user_id: userId, role }, process.env.JWT_SECRET)}`
}

function assignedLoad(overrides = {}) {
  return {
    id: 'load-1',
    shipper_id: 'shipper-1',
    vehicle_id: 'vehicle-1',
    driver_id: 'driver-1',
    status: 'in_transit',
    origin_lat: 39.099724,
    origin_lng: -94.578331,
    destination_lat: 32.776665,
    destination_lng: -96.796989,
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  app.set('liveHub', { broadcastLoadPing: jest.fn() })
})

test('ping endpoint requires a token', async () => {
  const response = await request(app)
    .post('/loads/load-1/pings')
    .send({ latitude: 39, longitude: -94 })

  expect(response.status).toBe(401)
  expect(response.body.error).toBe('No token provided')
})

test('ping endpoint rejects a bad token', async () => {
  const response = await request(app)
    .post('/loads/load-1/pings')
    .set('Authorization', 'Bearer nope')
    .send({ latitude: 39, longitude: -94 })

  expect(response.status).toBe(401)
  expect(response.body.error).toBe('Invalid token')
})

test('shippers cannot post GPS pings', async () => {
  const response = await request(app)
    .post('/loads/load-1/pings')
    .set('Authorization', auth('shipper'))
    .send({ latitude: 39, longitude: -94 })

  expect(response.status).toBe(403)
  expect(response.body.error).toBe('Forbidden')
})

test('drivers cannot post pings for unassigned loads', async () => {
  pool.query.mockResolvedValueOnce({
    rows: [assignedLoad({ driver_id: 'other-driver' })],
  })

  const response = await request(app)
    .post('/loads/load-1/pings')
    .set('Authorization', auth('driver'))
    .send({ latitude: 39, longitude: -94 })

  expect(response.status).toBe(403)
  expect(response.body.error).toBe('Forbidden')
})

test('assigned drivers can post a valid GPS ping', async () => {
  const load = assignedLoad()
  const ping = {
    id: 'ping-1',
    load_id: load.id,
    vehicle_id: load.vehicle_id,
    driver_id: load.driver_id,
    shipper_id: load.shipper_id,
    latitude: 38.5,
    longitude: -95,
    speed_mph: 62,
    heading_degrees: 190,
    recorded_at: '2026-05-06T12:00:00.000Z',
    created_at: '2026-05-06T12:00:00.000Z',
    source: 'test',
  }

  pool.query.mockResolvedValueOnce({ rows: [load] })
  pingStore.insertPing.mockResolvedValueOnce(ping)

  const response = await request(app)
    .post('/loads/load-1/pings')
    .set('Authorization', auth('driver'))
    .send({
      latitude: ping.latitude,
      longitude: ping.longitude,
      speed_mph: ping.speed_mph,
      heading_degrees: ping.heading_degrees,
      recorded_at: ping.recorded_at,
      source: ping.source,
    })

  expect(response.status).toBe(201)
  expect(response.body.ping).toMatchObject({ id: 'ping-1', load_id: load.id })
  expect(pingStore.insertPing).toHaveBeenCalledWith(expect.objectContaining({
    load_id: load.id,
    driver_id: 'driver-1',
    source: 'test',
  }))
  expect(app.get('liveHub').broadcastLoadPing).toHaveBeenCalledWith(load, ping, expect.any(Array))
})

test('shippers can read pings for their loads', async () => {
  const ping = { id: 'ping-1', load_id: 'load-1', latitude: 39, longitude: -94 }

  pool.query.mockResolvedValueOnce({ rows: [assignedLoad()] })
  pingStore.getPingsForLoad.mockResolvedValueOnce([ping])

  const response = await request(app)
    .get('/loads/load-1/pings')
    .set('Authorization', auth('shipper'))

  expect(response.status).toBe(200)
  expect(response.body.pings).toEqual([ping])
})

test('unrelated users cannot read private pings', async () => {
  pool.query.mockResolvedValueOnce({
    rows: [assignedLoad({ shipper_id: 'shipper-1' })],
  })

  const response = await request(app)
    .get('/loads/load-1/pings')
    .set('Authorization', auth('shipper', 'shipper-2'))

  expect(response.status).toBe(403)
  expect(response.body.error).toBe('Forbidden')
})

test('live-state returns latest ping and exceptions for visible active loads', async () => {
  const load = assignedLoad()
  const latestPing = {
    load_id: load.id,
    latitude: 39.739236,
    longitude: -104.990251,
    recorded_at: '2026-05-06T12:00:00.000Z',
  }

  pool.query.mockResolvedValueOnce({ rows: [load] })
  pingStore.getLatestPingsByLoadIds.mockResolvedValueOnce(new Map([[load.id, latestPing]]))

  const response = await request(app)
    .get('/loads/live-state')
    .set('Authorization', auth('shipper'))

  expect(response.status).toBe(200)
  expect(response.body.live_states[0]).toMatchObject({
    load_id: load.id,
    latest_ping: latestPing,
  })
  expect(response.body.live_states[0].exceptions).toEqual(
    expect.arrayContaining([expect.objectContaining({ type: 'off_route' })])
  )
})
