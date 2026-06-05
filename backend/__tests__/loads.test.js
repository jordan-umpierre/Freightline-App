const request = require('supertest')
const { auth, mockTransaction: mockTransactionWithPool } = require('../testHelpers')

jest.mock('../db/pool', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}))

const pool = require('../db/pool')
const app = require('../app')

function mockTransaction(responses) {
  return mockTransactionWithPool(pool, responses)
}

function assignLoadRequest() {
  return request(app)
    .post('/loads/load-1/assign')
    .set('Authorization', auth('driver'))
    .send({ vehicle_id: 'vehicle-1' })
}

beforeEach(() => {
  jest.clearAllMocks()
})

test('drivers cannot create shipper loads', async () => {
  const response = await request(app)
    .post('/loads')
    .set('Authorization', auth('driver'))
    .send({})

  expect(response.status).toBe(403)
  expect(response.body.error).toBe('Forbidden')
})

test('shippers cannot assign loads', async () => {
  const response = await request(app)
    .post('/loads/load-1/assign')
    .set('Authorization', auth('shipper'))
    .send({})

  expect(response.status).toBe(403)
  expect(response.body.error).toBe('Forbidden')
})

test('shippers can post a valid load and create an event', async () => {
  const load = {
    id: 'load-1',
    shipper_id: 'shipper-1',
    origin_address: 'Kansas City, MO',
    destination_address: 'Dallas, TX',
    weight_lbs: 18000,
    rate_cents: 240000,
    status: 'posted',
    oversized: false,
    origin_lat: 39.099724,
    origin_lng: -94.578331,
    destination_lat: 32.776665,
    destination_lng: -96.796989,
  }

  const client = mockTransaction([{ rows: [load] }, { rows: [] }])

  const response = await request(app)
    .post('/loads')
    .set('Authorization', auth('shipper'))
    .send({
      origin_address: load.origin_address,
      destination_address: load.destination_address,
      weight_lbs: load.weight_lbs,
      rate_cents: load.rate_cents,
      oversized: false,
      origin_lat: load.origin_lat,
      origin_lng: load.origin_lng,
      destination_lat: load.destination_lat,
      destination_lng: load.destination_lng,
    })

  expect(response.status).toBe(201)
  expect(response.body.load).toMatchObject({ id: load.id, status: 'posted' })
  expect(client.query).toHaveBeenCalledWith('BEGIN')
  expect(client.query).toHaveBeenCalledWith('COMMIT')
  expect(client.release).toHaveBeenCalled()
})

test('assignment rejects a vehicle that cannot carry the load', async () => {
  mockTransaction([
    {
      rows: [{
        id: 'load-1',
        status: 'posted',
        weight_lbs: 42000,
        oversized: false,
      }],
    },
    {
      rows: [{
        id: 'vehicle-1',
        driver_id: 'driver-1',
        status: 'available',
        capacity_lbs: 30000,
        oversized: false,
      }],
    },
  ])

  const response = await assignLoadRequest()

  expect(response.status).toBe(409)
  expect(response.body.error).toBe('Vehicle capacity is too low for this load')
})

test('drivers can accept an eligible posted load', async () => {
  const acceptedLoad = {
    id: 'load-1',
    status: 'assigned',
    vehicle_id: 'vehicle-1',
  }

  mockTransaction([
    {
      rows: [{
        id: 'load-1',
        status: 'posted',
        weight_lbs: 18000,
        oversized: true,
        origin_lat: 39.099724,
        origin_lng: -94.578331,
      }],
    },
    {
      rows: [{
        id: 'vehicle-1',
        driver_id: 'driver-1',
        status: 'available',
        capacity_lbs: 45000,
        oversized: true,
      }],
    },
    { rows: [acceptedLoad] },
    { rows: [] },
    { rows: [] },
  ])

  const response = await assignLoadRequest()

  expect(response.status).toBe(200)
  expect(response.body.load).toMatchObject(acceptedLoad)
})

test('assignment locks load and vehicle rows before assigning', async () => {
  const client = mockTransaction([
    {
      rows: [{
        id: 'load-1',
        status: 'posted',
        weight_lbs: 18000,
        oversized: false,
        origin_lat: 39.099724,
        origin_lng: -94.578331,
      }],
    },
    {
      rows: [{
        id: 'vehicle-1',
        driver_id: 'driver-1',
        status: 'available',
        capacity_lbs: 45000,
        oversized: false,
      }],
    },
    { rows: [{ id: 'load-1', status: 'assigned' }] },
    { rows: [] },
    { rows: [] },
  ])

  const response = await assignLoadRequest()

  expect(response.status).toBe(200)
  expect(client.query.mock.calls[1][0]).toMatch(/FOR UPDATE/i)
  expect(client.query.mock.calls[2][0]).toMatch(/FOR UPDATE/i)
})

test('GET /loads applies LIMIT and OFFSET when page and limit params are provided', async () => {
  pool.query.mockResolvedValueOnce({ rows: [] })

  await request(app)
    .get('/loads?limit=10&page=2')
    .set('Authorization', auth('shipper'))

  const sql = pool.query.mock.calls[0][0]
  expect(sql).toMatch(/LIMIT/i)
  expect(sql).toMatch(/OFFSET/i)
})

test('drivers cannot skip status transitions', async () => {
  mockTransaction([
    {
      rows: [{
        id: 'load-1',
        status: 'assigned',
        vehicle_id: 'vehicle-1',
        driver_id: 'driver-1',
      }],
    },
  ])

  const response = await request(app)
    .patch('/loads/load-1/status')
    .set('Authorization', auth('driver'))
    .send({ status: 'delivered' })

  expect(response.status).toBe(409)
  expect(response.body.error).toBe('Cannot move load from assigned to delivered')
})

test('drivers can move their assigned load into transit', async () => {
  const updatedLoad = {
    id: 'load-1',
    status: 'in_transit',
    vehicle_id: 'vehicle-1',
  }

  mockTransaction([
    {
      rows: [{
        id: 'load-1',
        status: 'assigned',
        vehicle_id: 'vehicle-1',
        driver_id: 'driver-1',
        origin_lat: 39.099724,
        origin_lng: -94.578331,
      }],
    },
    { rows: [updatedLoad] },
    { rows: [] },
  ])

  const response = await request(app)
    .patch('/loads/load-1/status')
    .set('Authorization', auth('driver'))
    .send({ status: 'in_transit' })

  expect(response.status).toBe(200)
  expect(response.body.load).toMatchObject(updatedLoad)
})
