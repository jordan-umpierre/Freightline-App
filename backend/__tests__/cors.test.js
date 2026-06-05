const request = require('supertest')

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
