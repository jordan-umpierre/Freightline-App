const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = 'test-secret'

function auth(role, userId = `${role}-1`) {
  return `Bearer ${jwt.sign({ user_id: userId, role }, process.env.JWT_SECRET)}`
}

function tokenFor(userId, role) {
  return jwt.sign({ user_id: userId, role }, process.env.JWT_SECRET)
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

function mockTransaction(pool, responses) {
  const client = {
    query: jest.fn((sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return Promise.resolve({ rows: [] })
      }

      return Promise.resolve(responses.shift() || { rows: [] })
    }),
    release: jest.fn(),
  }

  pool.connect.mockResolvedValueOnce(client)
  return client
}

module.exports = {
  assignedLoad,
  auth,
  mockTransaction,
  tokenFor,
}
