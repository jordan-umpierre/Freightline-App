const DRIVER_BOARD_STATUSES = new Set(['posted', 'assigned', 'in_transit'])
const DRIVER_PRIVATE_DATA_STATUSES = new Set(['assigned', 'in_transit', 'delivered'])

export function formatTime(value) {
  if (!value) return 'No ping yet'

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

export function getBoardLoads(user, loads) {
  if (user?.role !== 'driver') return loads

  return loads.filter((load) => DRIVER_BOARD_STATUSES.has(load.status))
}

export function canFetchSelectedLoadData(user, load) {
  if (!user || !load) return false
  if (user.role === 'shipper') return true
  if (user.role !== 'driver') return false

  return DRIVER_PRIVATE_DATA_STATUSES.has(load.status)
}

export function createLoadTooltipContent(load, liveState) {
  const content = document.createElement('div')
  content.append(`${load.origin_address} -> ${load.destination_address}`)
  content.append(document.createElement('br'))
  content.append(`Last ping: ${formatTime(liveState?.latest_ping?.recorded_at)}`)
  return content
}
