const express = require('express')
const pool = require('../db/pool')
const { authenticate, authorize } = require('../middleware/auth')
const { buildExceptions } = require('../services/geo')
const { getPingsForLoad, insertPing } = require('../services/pingStore')
const {
  buildLiveStatesForLoads,
  getLiveLoadsForUser,
  getPingTargetLoad,
  getTrackingLoadForUser,
} = require('../services/liveState')

const router = express.Router()

const EDITABLE_FIELDS = [
  'origin_address',
  'destination_address',
  'origin_lat',
  'origin_lng',
  'destination_lat',
  'destination_lng',
  'weight_lbs',
  'rate_cents',
  'oversized',
]

function toPositiveInteger(value) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function toCoordinate(value, min, max) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null
  return parsed
}

function toNonNegativeNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

function requireLoadInput(body) {
  const requiredStrings = ['origin_address', 'destination_address']
  for (const field of requiredStrings) {
    if (!body[field] || typeof body[field] !== 'string') {
      return `${field} is required`
    }
  }

  if (!toPositiveInteger(body.weight_lbs)) return 'weight_lbs must be a positive integer'
  if (!toPositiveInteger(body.rate_cents)) return 'rate_cents must be a positive integer'
  if (toCoordinate(body.origin_lat, -90, 90) === null) return 'origin_lat must be a valid latitude'
  if (toCoordinate(body.origin_lng, -180, 180) === null) return 'origin_lng must be a valid longitude'
  if (toCoordinate(body.destination_lat, -90, 90) === null) return 'destination_lat must be a valid latitude'
  if (toCoordinate(body.destination_lng, -180, 180) === null) return 'destination_lng must be a valid longitude'

  return null
}

async function withTransaction(callback) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function loadVisibleToUser(loadId, user) {
  const result = await pool.query(
    `SELECT l.*, v.driver_id
     FROM loads l
     LEFT JOIN vehicles v ON v.id = l.vehicle_id
     WHERE l.id = $1`,
    [loadId]
  )

  const load = result.rows[0]
  if (!load) return null

  const isShipperOwner = user.role === 'shipper' && load.shipper_id === user.user_id
  const isPostedForDriver = user.role === 'driver' && load.status === 'posted'
  const isAssignedDriver = user.role === 'driver' && load.driver_id === user.user_id

  return isShipperOwner || isPostedForDriver || isAssignedDriver ? load : false
}

router.use(authenticate)

router.get('/', async (req, res) => {
  try {
    if (req.user.role === 'shipper') {
      const result = await pool.query(
        `SELECT l.*
         FROM loads l
         WHERE l.shipper_id = $1
         ORDER BY l.created_at DESC`,
        [req.user.user_id]
      )

      return res.json({ loads: result.rows })
    }

    if (req.user.role === 'driver') {
      const result = await pool.query(
        `SELECT l.*
         FROM loads l
         LEFT JOIN vehicles v ON v.id = l.vehicle_id
         WHERE l.status = 'posted' OR v.driver_id = $1
         ORDER BY l.created_at DESC`,
        [req.user.user_id]
      )

      return res.json({ loads: result.rows })
    }

    res.status(403).json({ error: 'Forbidden' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not load loads' })
  }
})

router.get('/live-state', async (req, res) => {
  try {
    const loads = await getLiveLoadsForUser(req.user)
    const liveStates = await buildLiveStatesForLoads(loads)

    res.json({ live_states: liveStates })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not load live state' })
  }
})

router.post('/', authorize(['shipper']), async (req, res) => {
  const inputError = requireLoadInput(req.body)
  if (inputError) return res.status(400).json({ error: inputError })

  try {
    const load = await withTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO loads (
          shipper_id, origin_address, destination_address, weight_lbs, rate_cents,
          status, oversized, origin_lat, origin_lng, destination_lat, destination_lng
        )
        VALUES ($1, $2, $3, $4, $5, 'posted', $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          req.user.user_id,
          req.body.origin_address.trim(),
          req.body.destination_address.trim(),
          toPositiveInteger(req.body.weight_lbs),
          toPositiveInteger(req.body.rate_cents),
          Boolean(req.body.oversized),
          toCoordinate(req.body.origin_lat, -90, 90),
          toCoordinate(req.body.origin_lng, -180, 180),
          toCoordinate(req.body.destination_lat, -90, 90),
          toCoordinate(req.body.destination_lng, -180, 180),
        ]
      )

      const createdLoad = result.rows[0]

      await client.query(
        `INSERT INTO load_events (load_id, actor_id, event_type, status, latitude, longitude, note)
         VALUES ($1, $2, 'created', 'posted', $3, $4, $5)`,
        [
          createdLoad.id,
          req.user.user_id,
          createdLoad.origin_lat,
          createdLoad.origin_lng,
          'Load posted by shipper',
        ]
      )

      return createdLoad
    })

    res.status(201).json({ load })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not create load' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const load = await loadVisibleToUser(req.params.id, req.user)
    if (load === null) return res.status(404).json({ error: 'Load not found' })
    if (load === false) return res.status(403).json({ error: 'Forbidden' })

    res.json({ load })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not load load' })
  }
})

router.post('/:id/pings', authorize(['driver']), async (req, res) => {
  const latitude = toCoordinate(req.body.latitude, -90, 90)
  const longitude = toCoordinate(req.body.longitude, -180, 180)
  const speedMph = toNonNegativeNumber(req.body.speed_mph, 0)
  const headingDegrees = toNonNegativeNumber(req.body.heading_degrees, 0)
  const recordedAt = req.body.recorded_at ? new Date(req.body.recorded_at) : new Date()

  if (latitude === null) return res.status(400).json({ error: 'latitude must be a valid latitude' })
  if (longitude === null) return res.status(400).json({ error: 'longitude must be a valid longitude' })
  if (speedMph === null) return res.status(400).json({ error: 'speed_mph must be a non-negative number' })
  if (headingDegrees === null || headingDegrees > 360) {
    return res.status(400).json({ error: 'heading_degrees must be between 0 and 360' })
  }
  if (Number.isNaN(recordedAt.getTime())) {
    return res.status(400).json({ error: 'recorded_at must be a valid date' })
  }

  try {
    const load = await getPingTargetLoad(req.params.id, req.user)

    if (load === null) return res.status(404).json({ error: 'Load not found' })
    if (load === false) return res.status(403).json({ error: 'Forbidden' })
    if (load.not_trackable) {
      return res.status(409).json({ error: 'Only assigned or in-transit loads can receive pings' })
    }

    const ping = await insertPing({
      load_id: load.id,
      vehicle_id: load.vehicle_id,
      driver_id: req.user.user_id,
      shipper_id: load.shipper_id,
      latitude,
      longitude,
      speed_mph: speedMph,
      heading_degrees: headingDegrees,
      recorded_at: recordedAt,
      source: req.body.source || 'driver_api',
    })
    const exceptions = buildExceptions(load, ping)
    const liveHub = req.app.get('liveHub')

    if (liveHub) liveHub.broadcastLoadPing(load, ping, exceptions)

    res.status(201).json({ ping, exceptions })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not record ping' })
  }
})

router.get('/:id/pings', async (req, res) => {
  try {
    const load = await getTrackingLoadForUser(req.params.id, req.user)

    if (load === null) return res.status(404).json({ error: 'Load not found' })
    if (load === false) return res.status(403).json({ error: 'Forbidden' })

    const pings = await getPingsForLoad(req.params.id, req.query.limit)
    res.json({ pings })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not load pings' })
  }
})

router.patch('/:id', authorize(['shipper']), async (req, res) => {
  try {
    const existing = await pool.query(
      'SELECT * FROM loads WHERE id = $1 AND shipper_id = $2',
      [req.params.id, req.user.user_id]
    )

    const load = existing.rows[0]
    if (!load) return res.status(404).json({ error: 'Load not found' })
    if (load.status !== 'posted') {
      return res.status(409).json({ error: 'Only posted loads can be edited or cancelled' })
    }

    if (req.body.status && req.body.status !== 'cancelled' && req.body.status !== 'posted') {
      return res.status(400).json({ error: 'Shippers can only cancel posted loads' })
    }

    const updates = []
    const values = []

    for (const field of EDITABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        let value = req.body[field]

        if (field === 'weight_lbs' || field === 'rate_cents') {
          value = toPositiveInteger(value)
          if (!value) return res.status(400).json({ error: `${field} must be a positive integer` })
        }

        if (field.endsWith('_lat')) {
          value = toCoordinate(value, -90, 90)
          if (value === null) return res.status(400).json({ error: `${field} must be a valid latitude` })
        }

        if (field.endsWith('_lng')) {
          value = toCoordinate(value, -180, 180)
          if (value === null) return res.status(400).json({ error: `${field} must be a valid longitude` })
        }

        if (typeof value === 'string') value = value.trim()
        // Boolean(value) would coerce the string "false" to true, so compare explicitly
        if (field === 'oversized') value = value === true || value === 'true'

        values.push(value)
        updates.push(`${field} = $${values.length}`)
      }
    }

    if (req.body.status === 'cancelled') {
      values.push('cancelled')
      updates.push(`status = $${values.length}`)
    }

    if (updates.length === 0) return res.json({ load })

    values.push(req.params.id, req.user.user_id)

    const updated = await withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE loads
         SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $${values.length - 1} AND shipper_id = $${values.length}
         RETURNING *`,
        values
      )

      const updatedLoad = result.rows[0]
      const eventType = updatedLoad.status === 'cancelled' ? 'cancelled' : 'updated'

      await client.query(
        `INSERT INTO load_events (load_id, actor_id, event_type, status, note)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          updatedLoad.id,
          req.user.user_id,
          eventType,
          updatedLoad.status,
          eventType === 'cancelled' ? 'Load cancelled by shipper' : 'Load details updated by shipper',
        ]
      )

      return updatedLoad
    })

    res.json({ load: updated })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not update load' })
  }
})

router.post('/:id/assign', authorize(['driver']), async (req, res) => {
  try {
    const assigned = await withTransaction(async (client) => {
      const loadResult = await client.query(
        'SELECT * FROM loads WHERE id = $1 FOR UPDATE',
        [req.params.id]
      )
      const load = loadResult.rows[0]

      if (!load) return { status: 404, body: { error: 'Load not found' } }
      if (load.status !== 'posted') {
        return { status: 409, body: { error: 'Only posted loads can be assigned' } }
      }

      const vehicleParams = req.body.vehicle_id
        ? [req.body.vehicle_id, req.user.user_id]
        : [req.user.user_id]

      const vehicleSql = req.body.vehicle_id
        ? `SELECT * FROM vehicles WHERE id = $1 AND driver_id = $2 FOR UPDATE`
        : `SELECT * FROM vehicles
           WHERE driver_id = $1 AND status = 'available'
           ORDER BY created_at DESC
           LIMIT 1
           FOR UPDATE`

      const vehicleResult = await client.query(vehicleSql, vehicleParams)
      const vehicle = vehicleResult.rows[0]

      if (!vehicle) return { status: 404, body: { error: 'Available vehicle not found' } }
      if (vehicle.status !== 'available') {
        return { status: 409, body: { error: 'Vehicle is not available' } }
      }
      if (vehicle.capacity_lbs < load.weight_lbs) {
        return { status: 409, body: { error: 'Vehicle capacity is too low for this load' } }
      }
      if (load.oversized && !vehicle.oversized) {
        return { status: 409, body: { error: 'Oversized load requires an oversized-capable vehicle' } }
      }

      const updateResult = await client.query(
        `UPDATE loads
         SET vehicle_id = $1, status = 'assigned', updated_at = NOW()
         WHERE id = $2 AND status = 'posted'
         RETURNING *`,
        [vehicle.id, load.id]
      )

      if (updateResult.rowCount === 0) {
        return { status: 409, body: { error: 'Only posted loads can be assigned' } }
      }

      await client.query(
        `UPDATE vehicles
         SET status = 'in_transit', updated_at = NOW()
         WHERE id = $1`,
        [vehicle.id]
      )

      await client.query(
        `INSERT INTO load_events (load_id, actor_id, event_type, status, latitude, longitude, note)
         VALUES ($1, $2, 'assigned', 'assigned', $3, $4, $5)`,
        [
          load.id,
          req.user.user_id,
          load.origin_lat,
          load.origin_lng,
          'Load accepted by driver',
        ]
      )

      return { status: 200, body: { load: updateResult.rows[0] } }
    })

    res.status(assigned.status).json(assigned.body)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not assign load' })
  }
})

router.patch('/:id/status', authorize(['driver']), async (req, res) => {
  const nextStatus = req.body.status
  const allowedNext = {
    assigned: 'in_transit',
    in_transit: 'delivered',
  }

  if (!['in_transit', 'delivered'].includes(nextStatus)) {
    return res.status(400).json({ error: 'Invalid status update' })
  }

  try {
    const updated = await withTransaction(async (client) => {
      const loadResult = await client.query(
        `SELECT l.*, v.driver_id
         FROM loads l
         JOIN vehicles v ON v.id = l.vehicle_id
         WHERE l.id = $1`,
        [req.params.id]
      )

      const load = loadResult.rows[0]
      if (!load) return { status: 404, body: { error: 'Load not found' } }
      if (load.driver_id !== req.user.user_id) {
        return { status: 403, body: { error: 'Forbidden' } }
      }
      if (allowedNext[load.status] !== nextStatus) {
        return { status: 409, body: { error: `Cannot move load from ${load.status} to ${nextStatus}` } }
      }

      const result = await client.query(
        `UPDATE loads
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [nextStatus, load.id]
      )

      if (nextStatus === 'delivered') {
        await client.query(
          `UPDATE vehicles
           SET status = 'available', updated_at = NOW()
           WHERE id = $1`,
          [load.vehicle_id]
        )
      }

      const latitude = nextStatus === 'delivered' ? load.destination_lat : load.origin_lat
      const longitude = nextStatus === 'delivered' ? load.destination_lng : load.origin_lng

      await client.query(
        `INSERT INTO load_events (load_id, actor_id, event_type, status, latitude, longitude, note)
         VALUES ($1, $2, 'status_changed', $3, $4, $5, $6)`,
        [
          load.id,
          req.user.user_id,
          nextStatus,
          latitude,
          longitude,
          nextStatus === 'delivered' ? 'Load delivered by driver' : 'Driver started transit',
        ]
      )

      return { status: 200, body: { load: result.rows[0] } }
    })

    res.status(updated.status).json(updated.body)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not update load status' })
  }
})

router.get('/:id/events', async (req, res) => {
  try {
    const load = await loadVisibleToUser(req.params.id, req.user)
    if (load === null) return res.status(404).json({ error: 'Load not found' })
    if (load === false) return res.status(403).json({ error: 'Forbidden' })

    const result = await pool.query(
      `SELECT e.*, u.first_name, u.last_name, u.role
       FROM load_events e
       LEFT JOIN users u ON u.id = e.actor_id
       WHERE e.load_id = $1
       ORDER BY e.created_at ASC`,
      [req.params.id]
    )

    res.json({ events: result.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not load events' })
  }
})

module.exports = router
