const request = require('supertest')
const app = require('../app')

describe('security headers', () => {
  test('sets X-Content-Type-Options to nosniff', async () => {
    const response = await request(app).get('/')
    expect(response.headers['x-content-type-options']).toBe('nosniff')
  })

  test('sets X-Frame-Options to deny cross-origin framing', async () => {
    const response = await request(app).get('/')
    expect(response.headers['x-frame-options']).toBeDefined()
  })
})

describe('CORS policy', () => {
  const originalCorsOrigins = process.env.CORS_ORIGINS

  afterEach(() => {
    process.env.CORS_ORIGINS = originalCorsOrigins
    jest.resetModules()
  })

  test('allows the configured frontend origin', async () => {
    process.env.CORS_ORIGINS = 'https://freightline-app.vercel.app'
    jest.resetModules()
    const app = require('../app')

    const response = await request(app)
      .get('/')
      .set('Origin', 'https://freightline-app.vercel.app')

    expect(response.headers['access-control-allow-origin']).toBe('https://freightline-app.vercel.app')
  })

  test('does not allow unconfigured origins', async () => {
    process.env.CORS_ORIGINS = 'https://freightline-app.vercel.app'
    jest.resetModules()
    const app = require('../app')

    const response = await request(app)
      .get('/')
      .set('Origin', 'https://evil.example')

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })
})
