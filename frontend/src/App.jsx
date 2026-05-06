import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const TOKEN_KEY = 'freightline_token'

const DEMO_LANES = [
  {
    label: 'Kansas City to Dallas',
    origin_address: 'Kansas City, MO',
    destination_address: 'Dallas, TX',
    origin_lat: 39.099724,
    origin_lng: -94.578331,
    destination_lat: 32.776665,
    destination_lng: -96.796989,
    weight_lbs: 18000,
    rate_cents: 240000,
  },
  {
    label: 'Overland Park to Nashville',
    origin_address: 'Overland Park, KS',
    destination_address: 'Nashville, TN',
    origin_lat: 38.982228,
    origin_lng: -94.670792,
    destination_lat: 36.162663,
    destination_lng: -86.781601,
    weight_lbs: 22000,
    rate_cents: 275000,
  },
  {
    label: 'Chicago to Atlanta',
    origin_address: 'Chicago, IL',
    destination_address: 'Atlanta, GA',
    origin_lat: 41.878113,
    origin_lng: -87.629799,
    destination_lat: 33.749001,
    destination_lng: -84.387978,
    weight_lbs: 26000,
    rate_cents: 315000,
  },
]

const STATUS_FLOW = {
  posted: 'Posted',
  assigned: 'Assigned',
  in_transit: 'In transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

async function apiRequest(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : {}

  if (!response.ok) {
    throw new Error(data.error || 'Request failed')
  }

  return data
}

function formatMoney(cents) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(cents || 0) / 100)
}

function formatWeight(weight) {
  return `${Number(weight || 0).toLocaleString()} lb`
}

function formatTime(value) {
  if (!value) return 'No ping yet'

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

function buildLiveUrl(token) {
  const url = new URL(API_BASE)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = '/live'
  url.search = `?token=${encodeURIComponent(token)}`
  return url.toString()
}

function midpoint(load) {
  const originLat = Number(load.origin_lat)
  const originLng = Number(load.origin_lng)
  const destinationLat = Number(load.destination_lat)
  const destinationLng = Number(load.destination_lng)

  if (load.status === 'delivered') return [destinationLat, destinationLng]
  if (load.status === 'posted' || load.status === 'assigned') return [originLat, originLng]
  return [(originLat + destinationLat) / 2, (originLng + destinationLng) / 2]
}

function hasCoordinates(load) {
  return [
    load.origin_lat,
    load.origin_lng,
    load.destination_lat,
    load.destination_lng,
  ].every((value) => Number.isFinite(Number(value)))
}

function livePointForLoad(load, liveState) {
  const ping = liveState?.latest_ping
  if (ping && Number.isFinite(Number(ping.latitude)) && Number.isFinite(Number(ping.longitude))) {
    return [Number(ping.latitude), Number(ping.longitude)]
  }

  return midpoint(load)
}

function exceptionTone(exceptions = []) {
  if (exceptions.some((exception) => exception.severity === 'critical')) return '#b4502a'
  if (exceptions.length > 0) return '#d69a1c'
  return '#2e8f6d'
}

function MapBoard({ loads, liveStatesByLoadId, selectedLoadId, onSelect }) {
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
        .bindTooltip(`${load.origin_address} -> ${load.destination_address}<br />Last ping: ${formatTime(liveState?.latest_ping?.recorded_at)}`)
        .on('click', () => onSelect(load.id))
        .addTo(layer.current)
    })

    if (bounds.length > 0) {
      map.current.fitBounds(bounds, { padding: [28, 28], maxZoom: 7 })
    }
  }, [loads, liveStatesByLoadId, selectedLoadId, onSelect])

  return <div className="map-canvas" ref={mapEl} />
}

function AuthScreen({ onToken }) {
  const [mode, setMode] = useState('login')
  const [role, setRole] = useState('shipper')
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submitAuth(event) {
    event.preventDefault()
    setError('')
    setBusy(true)

    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register'
      const body = mode === 'login'
        ? { email: form.email, password: form.password }
        : { ...form, role }
      const data = await apiRequest(path, { method: 'POST', body })

      localStorage.setItem(TOKEN_KEY, data.token)
      onToken(data.token)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-copy">
        <p className="eyebrow">Freightline Ops</p>
        <h1>Load visibility for the work between shipper and driver.</h1>
        <p>
          Post freight, assign the right truck, and track active work from one
          operational board.
        </p>
      </section>

      <form className="auth-panel" onSubmit={submitAuth}>
        <div className="segmented">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            Login
          </button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
            Register
          </button>
        </div>

        {mode === 'register' && (
          <>
            <div className="two-col">
              <label>
                First name
                <input
                  value={form.first_name}
                  onChange={(event) => setForm({ ...form, first_name: event.target.value })}
                  required
                />
              </label>
              <label>
                Last name
                <input
                  value={form.last_name}
                  onChange={(event) => setForm({ ...form, last_name: event.target.value })}
                  required
                />
              </label>
            </div>
            <label>
              Role
              <select value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="shipper">Shipper</option>
                <option value="driver">Driver</option>
              </select>
            </label>
          </>
        )}

        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button className="primary-action" disabled={busy}>
          {busy ? 'Working...' : mode === 'login' ? 'Enter dashboard' : 'Create account'}
        </button>
      </form>
    </main>
  )
}

function LoadForm({ token, onCreated }) {
  const [laneIndex, setLaneIndex] = useState(0)
  const [oversized, setOversized] = useState(false)
  const [weight, setWeight] = useState(DEMO_LANES[0].weight_lbs)
  const [rate, setRate] = useState(DEMO_LANES[0].rate_cents / 100)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const lane = DEMO_LANES[laneIndex]

  function changeLane(nextIndex) {
    const nextLane = DEMO_LANES[nextIndex]
    setLaneIndex(nextIndex)
    setWeight(nextLane.weight_lbs)
    setRate(nextLane.rate_cents / 100)
  }

  async function createLoad(event) {
    event.preventDefault()
    setError('')
    setBusy(true)

    try {
      await apiRequest('/loads', {
        method: 'POST',
        token,
        body: {
          ...lane,
          weight_lbs: Number(weight),
          rate_cents: Math.round(Number(rate) * 100),
          oversized,
        },
      })
      setOversized(false)
      await onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="workspace-panel stack" onSubmit={createLoad}>
      <div>
        <p className="eyebrow">Shipper desk</p>
        <h2>Post a load</h2>
      </div>

      <label>
        Lane
        <select value={laneIndex} onChange={(event) => changeLane(Number(event.target.value))}>
          {DEMO_LANES.map((option, index) => (
            <option key={option.label} value={index}>{option.label}</option>
          ))}
        </select>
      </label>

      <div className="two-col">
        <label>
          Weight
          <input type="number" min="1" value={weight} onChange={(event) => setWeight(event.target.value)} />
        </label>
        <label>
          Rate
          <input type="number" min="1" value={rate} onChange={(event) => setRate(event.target.value)} />
        </label>
      </div>

      <label className="checkbox-row">
        <input type="checkbox" checked={oversized} onChange={(event) => setOversized(event.target.checked)} />
        Oversized
      </label>

      {error && <p className="form-error">{error}</p>}

      <button className="primary-action" disabled={busy}>{busy ? 'Posting...' : 'Post load'}</button>
    </form>
  )
}

function VehiclePanel({ token, vehicles, onCreated }) {
  const [capacity, setCapacity] = useState(45000)
  const [oversized, setOversized] = useState(true)
  const [status, setStatus] = useState('available')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function createVehicle(event) {
    event.preventDefault()
    setError('')
    setBusy(true)

    try {
      await apiRequest('/vehicles', {
        method: 'POST',
        token,
        body: {
          capacity_lbs: Number(capacity),
          oversized,
          status,
        },
      })
      await onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="workspace-panel stack">
      <div>
        <p className="eyebrow">Driver desk</p>
        <h2>Vehicle readiness</h2>
      </div>

      <form className="stack" onSubmit={createVehicle}>
        <div className="two-col">
          <label>
            Capacity
            <input type="number" min="1" value={capacity} onChange={(event) => setCapacity(event.target.value)} />
          </label>
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="available">Available</option>
              <option value="out_of_service">Out of service</option>
            </select>
          </label>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={oversized} onChange={(event) => setOversized(event.target.checked)} />
          Oversized capable
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-action" disabled={busy}>{busy ? 'Saving...' : 'Register truck'}</button>
      </form>

      <div className="compact-list">
        {vehicles.map((vehicle) => (
          <div className="compact-row" key={vehicle.id}>
            <span>{formatWeight(vehicle.capacity_lbs)}</span>
            <span className={`status-pill ${vehicle.status}`}>{vehicle.status.replaceAll('_', ' ')}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function LoadList({ title, loads, selectedLoadId, onSelect, actions }) {
  return (
    <section className="workspace-panel load-list">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Board</p>
          <h2>{title}</h2>
        </div>
        <span className="count">{loads.length}</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Lane</th>
              <th>Status</th>
              <th>Weight</th>
              <th>Rate</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loads.map((load) => (
              <tr
                key={load.id}
                className={load.id === selectedLoadId ? 'selected-row' : ''}
                onClick={() => onSelect(load.id)}
              >
                <td>
                  <strong>{load.origin_address}</strong>
                  <span>{load.destination_address}</span>
                </td>
                <td><span className={`status-pill ${load.status}`}>{STATUS_FLOW[load.status]}</span></td>
                <td>{formatWeight(load.weight_lbs)}</td>
                <td>{formatMoney(load.rate_cents)}</td>
                <td>{actions?.(load)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function LiveBadge({ status }) {
  return <span className={`live-badge ${status}`}>{status.replace('_', ' ')}</span>
}

function ExceptionRail({ exceptions }) {
  return (
    <section className="workspace-panel stack">
      <div>
        <p className="eyebrow">Exceptions</p>
        <h2>Live alerts</h2>
      </div>

      {exceptions.length === 0 ? (
        <p className="empty-state">No active tracking exceptions.</p>
      ) : (
        <div className="exception-list">
          {exceptions.map((item) => (
            <button
              className={`exception-item ${item.exception.severity}`}
              key={`${item.load.id}-${item.exception.type}`}
              onClick={() => item.onSelect(item.load.id)}
            >
              <strong>{item.exception.type.replaceAll('_', ' ')}</strong>
              <span>{item.load.origin_address} to {item.load.destination_address}</span>
              <p>{item.exception.message}</p>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function SimulatorCard() {
  return (
    <section className="workspace-panel stack">
      <div>
        <p className="eyebrow">Demo driver</p>
        <h2>Simulator command</h2>
      </div>
      <code className="command-block">cd backend && npm run simulate:pings</code>
      <code className="command-block">cd backend && npm run simulate:pings -- --off-route</code>
    </section>
  )
}

function DetailPanel({ user, token, load, events, pings, onChanged }) {
  const [rate, setRate] = useState(load ? String(Number(load.rate_cents) / 100) : '')
  const [error, setError] = useState('')
  const canEdit = user?.role === 'shipper' && load?.status === 'posted'

  if (!load) {
    return (
      <section className="workspace-panel stack">
        <p className="empty-state">Select a load to inspect the timeline.</p>
      </section>
    )
  }

  async function updateRate(event) {
    event.preventDefault()
    setError('')

    try {
      await apiRequest(`/loads/${load.id}`, {
        method: 'PATCH',
        token,
        body: { rate_cents: Math.round(Number(rate) * 100) },
      })
      await onChanged()
    } catch (err) {
      setError(err.message)
    }
  }

  async function cancelLoad() {
    setError('')

    try {
      await apiRequest(`/loads/${load.id}`, {
        method: 'PATCH',
        token,
        body: { status: 'cancelled' },
      })
      await onChanged()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="workspace-panel stack">
      <div>
        <p className="eyebrow">Load detail</p>
        <h2>{load.origin_address} to {load.destination_address}</h2>
      </div>

      <div className="metric-grid">
        <div>
          <span>Status</span>
          <strong>{STATUS_FLOW[load.status]}</strong>
        </div>
        <div>
          <span>Weight</span>
          <strong>{formatWeight(load.weight_lbs)}</strong>
        </div>
        <div>
          <span>Rate</span>
          <strong>{formatMoney(load.rate_cents)}</strong>
        </div>
        <div>
          <span>Oversized</span>
          <strong>{load.oversized ? 'Yes' : 'No'}</strong>
        </div>
      </div>

      {canEdit && (
        <form className="inline-edit" onSubmit={updateRate}>
          <label>
            Rate
            <input type="number" min="1" value={rate} onChange={(event) => setRate(event.target.value)} />
          </label>
          <button>Save rate</button>
          <button type="button" className="danger-action" onClick={cancelLoad}>Cancel load</button>
        </form>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="timeline">
        {events.map((event) => (
          <div className="timeline-row" key={event.id}>
            <span></span>
            <div>
              <strong>{event.note || event.event_type.replaceAll('_', ' ')}</strong>
              <p>{event.status ? STATUS_FLOW[event.status] : 'Event'} · {event.role || 'system'}</p>
            </div>
          </div>
        ))}
      </div>

      <div>
        <p className="eyebrow">GPS pings</p>
        <div className="ping-list">
          {pings.length === 0 ? (
            <p className="empty-state">No GPS pings for this load yet.</p>
          ) : pings.map((ping) => (
            <div className="ping-row" key={ping.id || `${ping.latitude}-${ping.recorded_at}`}>
              <strong>{Number(ping.latitude).toFixed(4)}, {Number(ping.longitude).toFixed(4)}</strong>
              <span>{formatTime(ping.recorded_at)} · {Number(ping.speed_mph || 0).toFixed(0)} mph · {ping.source || 'driver'}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(null)
  const [loads, setLoads] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [events, setEvents] = useState([])
  const [pings, setPings] = useState([])
  const [liveStates, setLiveStates] = useState([])
  const [liveStatus, setLiveStatus] = useState('offline')
  const [selectedLoadId, setSelectedLoadId] = useState('')
  const [banner, setBanner] = useState('')
  const [loading, setLoading] = useState(Boolean(token))
  const selectedLoadIdRef = useRef('')
  const loadsRef = useRef([])

  const selectedLoad = useMemo(
    () => loads.find((load) => load.id === selectedLoadId),
    [loads, selectedLoadId]
  )
  const liveStatesByLoadId = useMemo(
    () => Object.fromEntries(liveStates.map((state) => [state.load_id, state])),
    [liveStates]
  )
  const exceptionItems = useMemo(
    () => liveStates.flatMap((state) => (
      state.exceptions.map((exception) => ({
        exception,
        load: state.load,
        onSelect: setSelectedLoadId,
      }))
    )),
    [liveStates]
  )

  async function refreshLiveState(currentToken = token) {
    if (!currentToken) return
    const data = await apiRequest('/loads/live-state', { token: currentToken })
    setLiveStates(data.live_states)
  }

  async function refreshWorkspace(currentToken = token, currentUser = user) {
    if (!currentToken || !currentUser) return

    const loadData = await apiRequest('/loads', { token: currentToken })
    setLoads(loadData.loads)

    if (!selectedLoadId && loadData.loads.length > 0) {
      setSelectedLoadId(loadData.loads[0].id)
    }

    if (currentUser.role === 'driver') {
      const vehicleData = await apiRequest('/vehicles/me', { token: currentToken })
      setVehicles(vehicleData.vehicles)
    } else {
      setVehicles([])
    }

    try {
      await refreshLiveState(currentToken)
    } catch (err) {
      setLiveStatus('offline')
      setBanner(err.message)
    }
  }

  useEffect(() => {
    selectedLoadIdRef.current = selectedLoadId
  }, [selectedLoadId])

  useEffect(() => {
    loadsRef.current = loads
  }, [loads])

  useEffect(() => {
    if (!token) return

    let ignore = false

    async function loadSession() {
      setLoading(true)
      setBanner('')

      try {
        const profile = await apiRequest('/auth/me', { token })
        if (ignore) return

        setUser(profile.user)
        const loadData = await apiRequest('/loads', { token })
        if (ignore) return

        setLoads(loadData.loads)
        setSelectedLoadId((current) => current || loadData.loads[0]?.id || '')

        if (profile.user.role === 'driver') {
          const vehicleData = await apiRequest('/vehicles/me', { token })
          if (!ignore) setVehicles(vehicleData.vehicles)
        }

        try {
          const liveData = await apiRequest('/loads/live-state', { token })
          if (!ignore) setLiveStates(liveData.live_states)
        } catch (liveErr) {
          if (!ignore) {
            setLiveStatus('offline')
            setLiveStates([])
            setBanner(liveErr.message)
          }
        }
      } catch (err) {
        localStorage.removeItem(TOKEN_KEY)
        if (!ignore) {
          setToken(null)
          setBanner(err.message)
          setLiveStatus('offline')
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadSession()

    return () => {
      ignore = true
    }
  }, [token])

  useEffect(() => {
    if (!token || !selectedLoadId) return

    let ignore = false

    async function loadEvents() {
      try {
        const data = await apiRequest(`/loads/${selectedLoadId}/events`, { token })
        if (!ignore) setEvents(data.events)
      } catch {
        if (!ignore) setEvents([])
      }
    }

    loadEvents()

    return () => {
      ignore = true
    }
  }, [token, selectedLoadId])

  useEffect(() => {
    if (!token || !selectedLoadId) return

    let ignore = false

    async function loadPings() {
      try {
        const data = await apiRequest(`/loads/${selectedLoadId}/pings?limit=12`, { token })
        if (!ignore) setPings(data.pings)
      } catch {
        if (!ignore) setPings([])
      }
    }

    loadPings()

    return () => {
      ignore = true
    }
  }, [token, selectedLoadId])

  useEffect(() => {
    if (!token) return

    let stopped = false
    let socket
    let reconnectTimer

    function connect() {
      if (stopped) return

      setLiveStatus('reconnecting')
      socket = new WebSocket(buildLiveUrl(token))

      socket.onopen = () => setLiveStatus('connected')
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data)

        if (message.type === 'load_ping') {
          setLiveStates((current) => {
            const withoutLoad = current.filter((state) => state.load_id !== message.load_id)
            const existing = current.find((state) => state.load_id === message.load_id)
            const nextState = existing || {
              load_id: message.load_id,
              load: loadsRef.current.find((load) => load.id === message.load_id),
              exceptions: [],
            }

            if (!nextState.load) return current

            return [
              ...withoutLoad,
              {
                ...nextState,
                latest_ping: message.ping,
                exceptions: message.exceptions || [],
              },
            ]
          })

          if (selectedLoadIdRef.current === message.load_id) {
            setPings((current) => [
              message.ping,
              ...current.filter((ping) => ping.id !== message.ping.id),
            ].slice(0, 12))
          }
        }

        if (message.type === 'load_exception') {
          setLiveStates((current) => current.map((state) => (
            state.load_id === message.load_id
              ? { ...state, exceptions: message.exceptions }
              : state
          )))
        }
      }
      socket.onclose = () => {
        if (stopped) return
        setLiveStatus('reconnecting')
        reconnectTimer = setTimeout(connect, 1500)
      }
      socket.onerror = () => {
        setLiveStatus('offline')
        socket.close()
      }
    }

    reconnectTimer = setTimeout(connect, 0)

    return () => {
      stopped = true
      clearTimeout(reconnectTimer)
      if (socket) socket.close()
    }
  }, [token])

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
    setLoads([])
    setVehicles([])
    setEvents([])
    setPings([])
    setLiveStates([])
    setSelectedLoadId('')
    setLiveStatus('offline')
    setLoading(false)
  }

  async function reloadAndEvents() {
    await refreshWorkspace()
    if (selectedLoadId) {
      const data = await apiRequest(`/loads/${selectedLoadId}/events`, { token })
      setEvents(data.events)
      try {
        const pingData = await apiRequest(`/loads/${selectedLoadId}/pings?limit=12`, { token })
        setPings(pingData.pings)
      } catch {
        setPings([])
      }
    }
  }

  async function assignLoad(load) {
    setBanner('')

    try {
      const availableVehicle = vehicles.find((vehicle) => vehicle.status === 'available')

      await apiRequest(`/loads/${load.id}/assign`, {
        method: 'POST',
        token,
        body: availableVehicle?.id ? { vehicle_id: availableVehicle.id } : {},
      })
      setSelectedLoadId(load.id)
      await reloadAndEvents()
    } catch (err) {
      setBanner(err.message)
    }
  }

  async function advanceLoad(load) {
    const nextStatus = load.status === 'assigned' ? 'in_transit' : 'delivered'
    setBanner('')

    try {
      await apiRequest(`/loads/${load.id}/status`, {
        method: 'PATCH',
        token,
        body: { status: nextStatus },
      })
      setSelectedLoadId(load.id)
      await reloadAndEvents()
    } catch (err) {
      setBanner(err.message)
    }
  }

  if (!token) return <AuthScreen onToken={setToken} />

  if (loading) {
    return (
      <main className="loading-screen">
        <div className="loader"></div>
        <p>Loading workspace...</p>
      </main>
    )
  }

  const availableLoads = user?.role === 'driver'
    ? loads.filter((load) => load.status === 'posted')
    : loads
  const activeLoads = loads.filter((load) => !['delivered', 'cancelled'].includes(load.status))

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Freightline Ops</p>
          <h1>{user?.role === 'shipper' ? 'Shipper operations' : 'Driver operations'}</h1>
        </div>
        <div className="account-strip">
          <LiveBadge status={liveStatus} />
          <span>{user?.first_name} {user?.last_name}</span>
          <span className="role-chip">{user?.role}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </header>

      {banner && <p className="banner">{banner}</p>}

      <section className="map-section">
        <div className="map-copy">
          <p className="eyebrow">Live board</p>
          <h2>{activeLoads.length} active loads</h2>
          <span>{exceptionItems.length} exceptions</span>
        </div>
        <MapBoard
          loads={loads}
          liveStatesByLoadId={liveStatesByLoadId}
          selectedLoadId={selectedLoadId}
          onSelect={setSelectedLoadId}
        />
      </section>

      <section className="workspace-grid">
        <div className="left-rail">
          {user?.role === 'shipper' ? (
            <>
              <LoadForm token={token} onCreated={reloadAndEvents} />
              <ExceptionRail exceptions={exceptionItems} />
            </>
          ) : (
            <>
              <VehiclePanel token={token} vehicles={vehicles} onCreated={reloadAndEvents} />
              <SimulatorCard />
              <ExceptionRail exceptions={exceptionItems} />
            </>
          )}
        </div>

        <LoadList
          title={user?.role === 'driver' ? 'Available and assigned freight' : 'Posted freight'}
          loads={availableLoads}
          selectedLoadId={selectedLoadId}
          onSelect={setSelectedLoadId}
          actions={(load) => {
            if (user?.role === 'driver' && load.status === 'posted') {
              return <button className="table-action" onClick={(event) => { event.stopPropagation(); assignLoad(load) }}>Accept</button>
            }

            if (user?.role === 'driver' && ['assigned', 'in_transit'].includes(load.status)) {
              return <button className="table-action" onClick={(event) => { event.stopPropagation(); advanceLoad(load) }}>{load.status === 'assigned' ? 'Start' : 'Deliver'}</button>
            }

            return null
          }}
        />

        <DetailPanel
          key={selectedLoad?.id || 'empty'}
          user={user}
          token={token}
          load={selectedLoad}
          events={events}
          pings={pings}
          onChanged={reloadAndEvents}
        />
      </section>
    </main>
  )
}

export default App
