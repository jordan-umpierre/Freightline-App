import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { exceptionTone } from '../lib/exceptionTone'
import { createLoadTooltipContent } from '../lib/loadVisibility'
import { hasCoordinates, livePointForLoad } from '../lib/mapHelpers'

export default function MapBoard({ loads, liveStatesByLoadId, selectedLoadId, onSelect }) {
  const mapEl = useRef(null)
  const map = useRef(null)
  const layer = useRef(null)

  useEffect(() => {
    if (!mapEl.current || map.current) return

    map.current = L.map(mapEl.current, {
      zoomControl: false,
      scrollWheelZoom: false,
    }).setView([37.8, -92.5], 5)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map.current)

    L.control.zoom({ position: 'bottomright' }).addTo(map.current)
    layer.current = L.layerGroup().addTo(map.current)

    return () => {
      map.current.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    if (!map.current || !layer.current) return

    layer.current.clearLayers()
    const bounds = []

    loads.filter(hasCoordinates).forEach((load) => {
      const origin = [Number(load.origin_lat), Number(load.origin_lng)]
      const destination = [Number(load.destination_lat), Number(load.destination_lng)]
      const liveState = liveStatesByLoadId[load.id]
      const activePoint = livePointForLoad(load, liveState)
      const isSelected = load.id === selectedLoadId

      bounds.push(origin, destination, activePoint)

      L.polyline([origin, destination], {
        color: isSelected ? '#1f7a5c' : '#586474',
        weight: isSelected ? 4 : 2,
        opacity: isSelected ? 0.95 : 0.5,
      })
        .on('click', () => onSelect(load.id))
        .addTo(layer.current)

      L.circleMarker(origin, {
        radius: 5,
        color: '#1f7a5c',
        fillColor: '#1f7a5c',
        fillOpacity: 0.85,
      }).addTo(layer.current)

      L.circleMarker(destination, {
        radius: 5,
        color: '#b4502a',
        fillColor: '#b4502a',
        fillOpacity: 0.85,
      }).addTo(layer.current)

      L.circleMarker(activePoint, {
        radius: isSelected ? 10 : 8,
        color: '#10231e',
        weight: 2,
        fillColor: liveState?.latest_ping ? exceptionTone(liveState.exceptions) : '#f7c948',
        fillOpacity: 0.95,
      })
        .bindTooltip(createLoadTooltipContent(load, liveState))
        .on('click', () => onSelect(load.id))
        .addTo(layer.current)
    })

    if (bounds.length > 0) {
      map.current.fitBounds(bounds, { padding: [28, 28], maxZoom: 7 })
    }
  }, [loads, liveStatesByLoadId, selectedLoadId, onSelect])

  return <div className="map-canvas" ref={mapEl} />
}
