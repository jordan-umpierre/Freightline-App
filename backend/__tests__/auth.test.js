const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const request = require('supertest')

jest.mock('../db/pool', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}))

process.env.JWT_SECRET = 'test-secret'

const pool = require('../db/pool')
const app = require('../app')

function tokenFor(userId, role) {
  return jwt.sign({ user_id: userId, role }, process.env.JWT_SECRET)
}

beforeEach(() => {
  jest.clearAllMocks()
})

test('register returns a token for a valid new user', async () => {
  pool.query.mockResolvedValueOnce({
    rows: [{ id: 'shipper-1', email: 'shipper@test.com', role: 'shipper' }],
  })

  const response = await request(app)
    .post('/auth/register')
    .send({
      first_name: 'Alice',
      last_name: 'Smith',
      email: 'SHIPPER@test.com',
      password: 'secret123',
      role: 'shipper',
    })

  expect(response.status).toBe(201)
  expect(response.body.token).toBeTruthy()
  expect(jwt.verify(response.body.token, process.env.JWT_SECRET)).toMatchObject({
    user_id: 'shipper-1',
    role: 'shipper',
  })
  expect(pool.query.mock.calls[0][1][2]).toBe('shipper@test.com')
})

test('register rejects duplicate email addresses', async () => {
  pool.query.mockRejectedValueOnce({ code: '23505' })

  const response = await request(app)
    .post('/auth/register')
    .send({
      first_name: 'Alice',
      last_name: 'Smith',
      email: 'alice@test.com',
      password: 'secret123',
      role: 'shipper',
    })

  expect(response.status).toBe(409)
  expect(response.body.error).toBe('Email already registered')
})

test('login rejects bad credentials', async () => {
  const password_hash = await bcrypt.hash('right-password', 10)

  pool.query.mockResolvedValueOnce({
    rows: [{ id: 'driver-1', email: 'driver@test.com', role: 'driver', password_hash }],
  })

  const response = await request(app)
    .post('/auth/login')
    .send({ email: 'driver@test.com', password: 'wrong-password' })

  expect(response.status).toBe(401)
  expect(response.body.error).toBe('Invalid credentials')
})

test('/auth/me requires a token', async () => {
  const response = await request(app).get('/auth/me')

  expect(response.status).toBe(401)
  expect(response.body.error).toBe('No token provided')
})

test('/auth/me returns the authenticated user profile', async () => {
  const user = {
    id: 'driver-1',
    first_name: 'Bob',
    last_name: 'Jones',
    email: 'driver@test.com',
    role: 'driver',
  }

  pool.query.mockResolvedValueOnce({ rows: [user] })

  const response = await request(app)
    .get('/auth/me')
    .set('Authorization', `Bearer ${tokenFor(user.id, user.role)}`)

  expect(response.status).toBe(200)
  expect(response.body.user).toMatchObject(user)
})
