export function midpoint(load) {
  const originLat = Number(load.origin_lat)
  const originLng = Number(load.origin_lng)
  const destinationLat = Number(load.destination_lat)
  const destinationLng = Number(load.destination_lng)

  if (load.status === 'delivered') return [destinationLat, destinationLng]
  if (load.status === 'posted' || load.status === 'assigned') return [originLat, originLng]
  return [(originLat + destinationLat) / 2, (originLng + destinationLng) / 2]
}

export function hasCoordinates(load) {
  return [
    load.origin_lat,
    load.origin_lng,
    load.destination_lat,
    load.destination_lng,
  ].every((value) => Number.isFinite(Number(value)))
}

export function livePointForLoad(load, liveState) {
  const ping = liveState?.latest_ping
  if (ping && Number.isFinite(Number(ping.latitude)) && Number.isFinite(Number(ping.longitude))) {
    return [Number(ping.latitude), Number(ping.longitude)]
  }

  return midpoint(load)
}
