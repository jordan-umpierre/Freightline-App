const EARTH_RADIUS_MILES = 3958.8
const STALE_LOCATION_MINUTES = 10
const OFF_ROUTE_MILES = 75

function toRadians(value) {
  return Number(value) * (Math.PI / 180)
}

function pointFrom(value) {
  return {
    latitude: Number(value.latitude ?? value.lat),
    longitude: Number(value.longitude ?? value.lng),
  }
}

function haversineMiles(a, b) {
  const pointA = pointFrom(a)
  const pointB = pointFrom(b)
  const deltaLat = toRadians(pointB.latitude - pointA.latitude)
  const deltaLng = toRadians(pointB.longitude - pointA.longitude)
  const latA = toRadians(pointA.latitude)
  const latB = toRadians(pointB.latitude)

  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLng / 2) ** 2

  return 2 * EARTH_RADIUS_MILES * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function projectToMiles(point, referenceLat) {
  const latitude = Number(point.latitude)
  const longitude = Number(point.longitude)

  return {
    x: longitude * 69.172 * Math.cos(toRadians(referenceLat)),
    y: latitude * 69,
  }
}

function distancePointToRouteMiles(pointValue, originValue, destinationValue) {
  const point = pointFrom(pointValue)
  const origin = pointFrom(originValue)
  const destination = pointFrom(destinationValue)
  const referenceLat = (origin.latitude + destination.latitude) / 2

  const p = projectToMiles(point, referenceLat)
  const a = projectToMiles(origin, referenceLat)
  const b = projectToMiles(destination, referenceLat)
  const segmentX = b.x - a.x
  const segmentY = b.y - a.y
  const segmentLengthSquared = segmentX ** 2 + segmentY ** 2

  if (segmentLengthSquared === 0) return haversineMiles(point, origin)

  const rawProjection = ((p.x - a.x) * segmentX + (p.y - a.y) * segmentY) / segmentLengthSquared
  const projection = Math.max(0, Math.min(1, rawProjection))
  const closest = {
    x: a.x + projection * segmentX,
    y: a.y + projection * segmentY,
  }

  return Math.sqrt((p.x - closest.x) ** 2 + (p.y - closest.y) ** 2)
}

function isTrackableLoad(load) {
  return ['assigned', 'in_transit'].includes(load.status)
}

function buildExceptions(load, latestPing, now = new Date()) {
  if (!isTrackableLoad(load)) return []

  const exceptions = []
  const origin = { latitude: load.origin_lat, longitude: load.origin_lng }
  const destination = { latitude: load.destination_lat, longitude: load.destination_lng }

  if (!latestPing) {
    return [{
      type: 'stale_location',
      severity: 'warning',
      message: 'No location update has been received for this active load.',
      minutes_since_ping: null,
    }]
  }

  const recordedAt = new Date(latestPing.recorded_at)
  const minutesSincePing = Math.floor((now.getTime() - recordedAt.getTime()) / 60000)

  if (minutesSincePing > STALE_LOCATION_MINUTES) {
    exceptions.push({
      type: 'stale_location',
      severity: 'warning',
      message: `No location update in ${minutesSincePing} minutes.`,
      minutes_since_ping: minutesSincePing,
    })
  }

  const offRouteMiles = distancePointToRouteMiles(latestPing, origin, destination)

  if (offRouteMiles > OFF_ROUTE_MILES) {
    exceptions.push({
      type: 'off_route',
      severity: 'critical',
      message: `Truck is ${Math.round(offRouteMiles)} miles away from the expected route corridor.`,
      distance_miles: Number(offRouteMiles.toFixed(1)),
    })
  }

  return exceptions
}

module.exports = {
  buildExceptions,
  distancePointToRouteMiles,
}
