#!/usr/bin/env node

const DEFAULTS = {
  api: process.env.API_URL || 'http://localhost:3000',
  email: process.env.SIM_DRIVER_EMAIL || 'demo.driver@freightline.local',
  password: process.env.SIM_DRIVER_PASSWORD || 'secret123',
  intervalMs: Number(process.env.SIM_INTERVAL_MS || 1500),
  steps: Number(process.env.SIM_STEPS || 24),
}

function parseArgs(argv) {
  const options = { ...DEFAULTS, offRoute: false }
  const valueOptions = {
    '--api': 'api',
    '--email': 'email',
    '--password': 'password',
    '--interval-ms': 'intervalMs',
    '--steps': 'steps',
  }
  const numericOptions = new Set(['intervalMs', 'steps'])

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--off-route') {
      options.offRoute = true
      continue
    }

    const optionName = valueOptions[arg]
    if (!optionName) continue

    const value = argv[index += 1]
    options[optionName] = numericOptions.has(optionName) ? Number(value) : value
  }

  return options
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function apiRequest(apiBase, path, { method = 'GET', token, body } = {}) {
  let response
  try {
    response = await fetch(`${apiBase}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    // The simulator is often run from demo terminals, so explain setup instead of
    // surfacing Node's opaque "fetch failed" network error.
    throw new Error(
      `Could not reach API at ${apiBase}. ` +
      'Make sure the backend is running. Use --api to point at a running local or deployed backend. ' +
      'Example: npm run simulate:pings -- --api https://freightline-app-production.up.railway.app --off-route'
    )
  }

  const text = await response.text()
  const data = text ? JSON.parse(text) : {}

  if (!response.ok) {
    throw new Error(data.error || `${method} ${path} failed with ${response.status}`)
  }

  return data
}

function interpolate(start, end, progress) {
  return Number(start) + (Number(end) - Number(start)) * progress
}

function buildPing(load, step, steps, offRoute) {
  const progress = steps <= 1 ? 1 : step / (steps - 1)
  const midpointOffset = offRoute && progress > 0.35 && progress < 0.7 ? 3.2 : 0

  return {
    latitude: interpolate(load.origin_lat, load.destination_lat, progress) + midpointOffset,
    longitude: interpolate(load.origin_lng, load.destination_lng, progress) - midpointOffset,
    speed_mph: progress === 1 ? 0 : 62,
    heading_degrees: 185,
    recorded_at: new Date().toISOString(),
    source: offRoute ? 'simulator_off_route' : 'simulator',
  }
}

async function findOrAssignLoad(apiBase, token) {
  const loadData = await apiRequest(apiBase, '/loads', { token })
  const activeLoad = loadData.loads.find((load) => ['assigned', 'in_transit'].includes(load.status))

  if (activeLoad) return activeLoad

  const postedLoad = loadData.loads.find((load) => load.status === 'posted')
  if (!postedLoad) throw new Error('No assigned, in-transit, or posted loads found for the demo driver.')

  const vehicleData = await apiRequest(apiBase, '/vehicles/me', { token })
  const availableVehicle = vehicleData.vehicles.find((vehicle) => vehicle.status === 'available')
  if (!availableVehicle) throw new Error('No available vehicle found for assignment.')

  const assigned = await apiRequest(apiBase, `/loads/${postedLoad.id}/assign`, {
    method: 'POST',
    token,
    body: { vehicle_id: availableVehicle.id },
  })

  return assigned.load
}

function validateOptions(options) {
  if (!Number.isFinite(options.intervalMs) || options.intervalMs < 100) {
    throw new Error('--interval-ms must be at least 100')
  }
  if (!Number.isInteger(options.steps) || options.steps < 2) {
    throw new Error('--steps must be an integer greater than 1')
  }
}

async function loginDriver(options) {
  const result = await apiRequest(options.api, '/auth/login', {
    method: 'POST',
    body: {
      email: options.email,
      password: options.password,
    },
  })

  return result.token
}

async function ensureLoadInTransit(apiBase, token, load) {
  if (load.status === 'assigned') {
    const updated = await apiRequest(apiBase, `/loads/${load.id}/status`, {
      method: 'PATCH',
      token,
      body: { status: 'in_transit' },
    })
    return updated.load
  }

  return load
}

async function sendPingSequence(options, token, load) {
  console.log(`Simulating ${options.steps} pings for ${load.origin_address} -> ${load.destination_address}`)
  console.log(`Mode: ${options.offRoute ? 'off-route demo' : 'normal route'}`)

  for (let step = 0; step < options.steps; step += 1) {
    const ping = buildPing(load, step, options.steps, options.offRoute)
    const response = await apiRequest(options.api, `/loads/${load.id}/pings`, {
      method: 'POST',
      token,
      body: ping,
    })

    const exceptionText = response.exceptions.length > 0
      ? ` exceptions=${response.exceptions.map((exception) => exception.type).join(',')}`
      : ''

    console.log(
      `ping ${step + 1}/${options.steps}: ${ping.latitude.toFixed(5)}, ${ping.longitude.toFixed(5)}${exceptionText}`
    )

    if (step < options.steps - 1) await sleep(options.intervalMs)
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  validateOptions(options)

  const token = await loginDriver(options)
  const assignedLoad = await findOrAssignLoad(options.api, token)
  const load = await ensureLoadInTransit(options.api, token, assignedLoad)

  await sendPingSequence(options, token, load)
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}

module.exports = {
  apiRequest,
  buildPing,
  parseArgs,
  validateOptions,
}
