const { execFile } = require('child_process')
const path = require('path')
const {
  apiRequest,
  buildPing,
  parseArgs,
  validateOptions,
} = require('../scripts/simulate-pings')

function runSimulator(args = []) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [path.join(__dirname, '..', 'scripts', 'simulate-pings.js'), ...args],
      {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, API_URL: '' },
      },
      (error, stdout, stderr) => {
        resolve({ error, stdout, stderr })
      }
    )
  })
}

afterEach(() => {
  jest.restoreAllMocks()
})

test('parseArgs applies simulator CLI options', () => {
  const options = parseArgs([
    '--api', 'https://api.example',
    '--email', 'driver@example.com',
    '--password', 'secret',
    '--interval-ms', '250',
    '--steps', '3',
    '--off-route',
  ])

  expect(options).toMatchObject({
    api: 'https://api.example',
    email: 'driver@example.com',
    password: 'secret',
    intervalMs: 250,
    steps: 3,
    offRoute: true,
  })
})

test('validateOptions rejects unsafe simulator pacing', () => {
  expect(() => validateOptions({ intervalMs: 99, steps: 2 })).toThrow('--interval-ms')
  expect(() => validateOptions({ intervalMs: 100, steps: 1 })).toThrow('--steps')
})

test('buildPing interpolates normal and off-route demo pings', () => {
  const load = {
    origin_lat: 39,
    origin_lng: -94,
    destination_lat: 33,
    destination_lng: -97,
  }

  expect(buildPing(load, 0, 3, false)).toMatchObject({
    latitude: 39,
    longitude: -94,
    speed_mph: 62,
    source: 'simulator',
  })
  expect(buildPing(load, 2, 3, false)).toMatchObject({
    latitude: 33,
    longitude: -97,
    speed_mph: 0,
  })
  expect(buildPing(load, 1, 3, true)).toMatchObject({
    latitude: 39.2,
    longitude: -98.7,
    source: 'simulator_off_route',
  })
})

test('apiRequest returns parsed JSON and sends bearer tokens', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: jest.fn().mockResolvedValue(JSON.stringify({ ok: true })),
  })

  const data = await apiRequest('https://api.example', '/loads', {
    method: 'POST',
    token: 'token-1',
    body: { hello: 'world' },
  })

  expect(data).toEqual({ ok: true })
  expect(global.fetch).toHaveBeenCalledWith('https://api.example/loads', expect.objectContaining({
    method: 'POST',
    headers: expect.objectContaining({ Authorization: 'Bearer token-1' }),
    body: JSON.stringify({ hello: 'world' }),
  }))
})

test('apiRequest surfaces API errors', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 409,
    text: jest.fn().mockResolvedValue(JSON.stringify({ error: 'No available vehicle found' })),
  })

  await expect(apiRequest('https://api.example', '/loads/load-1/assign'))
    .rejects
    .toThrow('No available vehicle found')
})

test('simulator explains API connection failures with the attempted base URL', async () => {
  const result = await runSimulator(['--api', 'http://127.0.0.1:1', '--steps', '2', '--interval-ms', '100'])

  expect(result.error).not.toBeNull()
  expect(result.stderr).toContain('Could not reach API at http://127.0.0.1:1')
  expect(result.stderr).toContain('Use --api to point at a running local or deployed backend')
})
