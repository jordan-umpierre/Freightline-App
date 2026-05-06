const {
  buildExceptions,
  distancePointToRouteMiles,
} = require('../services/geo')
const { selectLatestPingByLoadId } = require('../services/pingStore')

const load = {
  id: 'load-1',
  status: 'in_transit',
  origin_lat: 39.099724,
  origin_lng: -94.578331,
  destination_lat: 32.776665,
  destination_lng: -96.796989,
}

test('stale-location detection flags active loads without pings', () => {
  const exceptions = buildExceptions(load, null)

  expect(exceptions).toEqual([
    expect.objectContaining({ type: 'stale_location' }),
  ])
})

test('stale-location detection flags old pings', () => {
  const now = new Date('2026-05-06T12:30:00.000Z')
  const exceptions = buildExceptions(load, {
    latitude: 38,
    longitude: -95,
    recorded_at: '2026-05-06T12:00:00.000Z',
  }, now)

  expect(exceptions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: 'stale_location', minutes_since_ping: 30 }),
    ])
  )
})

test('off-route detection measures distance from route corridor', () => {
  const nearRoute = distancePointToRouteMiles(
    { latitude: 36, longitude: -95.7 },
    { latitude: load.origin_lat, longitude: load.origin_lng },
    { latitude: load.destination_lat, longitude: load.destination_lng }
  )
  const farFromRoute = distancePointToRouteMiles(
    { latitude: 39.739236, longitude: -104.990251 },
    { latitude: load.origin_lat, longitude: load.origin_lng },
    { latitude: load.destination_lat, longitude: load.destination_lng }
  )

  expect(nearRoute).toBeLessThan(75)
  expect(farFromRoute).toBeGreaterThan(75)
})

test('latest-ping selection keeps the newest ping per load', () => {
  const latest = selectLatestPingByLoadId([
    { load_id: 'load-1', recorded_at: '2026-05-06T12:00:00.000Z', latitude: 1 },
    { load_id: 'load-2', recorded_at: '2026-05-06T12:02:00.000Z', latitude: 2 },
    { load_id: 'load-1', recorded_at: '2026-05-06T12:05:00.000Z', latitude: 3 },
  ])

  expect(latest.get('load-1')).toMatchObject({ latitude: 3 })
  expect(latest.get('load-2')).toMatchObject({ latitude: 2 })
})
