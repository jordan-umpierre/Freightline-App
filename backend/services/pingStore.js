const { getPingCollection } = require('../db/mongo')

let indexesReady = false

function serializePing(ping) {
  if (!ping) return null

  return {
    id: ping._id?.toString(),
    load_id: ping.load_id,
    vehicle_id: ping.vehicle_id,
    driver_id: ping.driver_id,
    shipper_id: ping.shipper_id,
    latitude: ping.latitude,
    longitude: ping.longitude,
    speed_mph: ping.speed_mph,
    heading_degrees: ping.heading_degrees,
    recorded_at: ping.recorded_at instanceof Date ? ping.recorded_at.toISOString() : ping.recorded_at,
    created_at: ping.created_at instanceof Date ? ping.created_at.toISOString() : ping.created_at,
    source: ping.source,
  }
}

function selectLatestPingByLoadId(pings) {
  const latest = new Map()

  for (const ping of pings) {
    const current = latest.get(ping.load_id)
    const currentRecordedAt = current ? new Date(current.recorded_at).getTime() : 0
    const nextRecordedAt = new Date(ping.recorded_at).getTime()

    if (!current || nextRecordedAt > currentRecordedAt) {
      latest.set(ping.load_id, ping)
    }
  }

  return latest
}

async function ensurePingIndexes() {
  if (indexesReady) return

  const collection = await getPingCollection()
  await collection.createIndexes([
    { key: { load_id: 1, recorded_at: -1 }, name: 'idx_load_recorded_at' },
    { key: { driver_id: 1, recorded_at: -1 }, name: 'idx_driver_recorded_at' },
  ])

  indexesReady = true
}

async function insertPing(input) {
  await ensurePingIndexes()
  const collection = await getPingCollection()
  const now = new Date()
  const recordedAt = input.recorded_at ? new Date(input.recorded_at) : now
  const doc = {
    load_id: input.load_id,
    vehicle_id: input.vehicle_id,
    driver_id: input.driver_id,
    shipper_id: input.shipper_id,
    latitude: Number(input.latitude),
    longitude: Number(input.longitude),
    speed_mph: Number(input.speed_mph ?? 0),
    heading_degrees: Number(input.heading_degrees ?? 0),
    recorded_at: recordedAt,
    created_at: now,
    source: input.source || 'driver_api',
  }

  const result = await collection.insertOne(doc)
  return serializePing({ ...doc, _id: result.insertedId })
}

async function getPingsForLoad(loadId, limit = 50) {
  await ensurePingIndexes()
  const collection = await getPingCollection()
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200)
  const pings = await collection
    .find({ load_id: loadId })
    .sort({ recorded_at: -1 })
    .limit(safeLimit)
    .toArray()

  return pings.map(serializePing)
}

async function getLatestPingsByLoadIds(loadIds) {
  if (loadIds.length === 0) return new Map()

  await ensurePingIndexes()
  const collection = await getPingCollection()
  const pings = await collection
    .find({ load_id: { $in: loadIds } })
    .sort({ recorded_at: -1 })
    .toArray()

  return selectLatestPingByLoadId(pings.map(serializePing))
}

module.exports = {
  getLatestPingsByLoadIds,
  getPingsForLoad,
  insertPing,
  selectLatestPingByLoadId,
}
