const pool = require('../db/pool')
const { buildExceptions } = require('./geo')
const { getLatestPingsByLoadIds } = require('./pingStore')

const ACTIVE_LOAD_STATUSES = ['assigned', 'in_transit']

async function getLiveLoadsForUser(user) {
  if (user.role === 'shipper') {
    const result = await pool.query(
      `SELECT l.*, v.driver_id
       FROM loads l
       LEFT JOIN vehicles v ON v.id = l.vehicle_id
       WHERE l.shipper_id = $1 AND l.status = ANY($2)
       ORDER BY l.updated_at DESC`,
      [user.user_id, ACTIVE_LOAD_STATUSES]
    )

    return result.rows
  }

  if (user.role === 'driver') {
    const result = await pool.query(
      `SELECT l.*, v.driver_id
       FROM loads l
       JOIN vehicles v ON v.id = l.vehicle_id
       WHERE v.driver_id = $1 AND l.status = ANY($2)
       ORDER BY l.updated_at DESC`,
      [user.user_id, ACTIVE_LOAD_STATUSES]
    )

    return result.rows
  }

  return []
}

async function getTrackingLoadForUser(loadId, user) {
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
  const isAssignedDriver = user.role === 'driver' && load.driver_id === user.user_id

  return isShipperOwner || isAssignedDriver ? load : false
}

async function getPingTargetLoad(loadId, user) {
  const load = await getTrackingLoadForUser(loadId, user)
  if (!load || load === false) return load
  if (!ACTIVE_LOAD_STATUSES.includes(load.status)) return { ...load, not_trackable: true }
  return load
}

async function buildLiveStatesForLoads(loads, now = new Date()) {
  const latestByLoadId = await getLatestPingsByLoadIds(loads.map((load) => load.id))

  return loads.map((load) => {
    const latestPing = latestByLoadId.get(load.id) || null

    return {
      load_id: load.id,
      load,
      latest_ping: latestPing,
      exceptions: buildExceptions(load, latestPing, now),
    }
  })
}

module.exports = {
  ACTIVE_LOAD_STATUSES,
  buildLiveStatesForLoads,
  getLiveLoadsForUser,
  getPingTargetLoad,
  getTrackingLoadForUser,
}
