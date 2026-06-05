import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { apiRequest, buildLiveUrl, TOKEN_KEY } from './lib/api'
import { canFetchSelectedLoadData, getBoardLoads } from './lib/loadVisibility'
import { exceptionTone } from './lib/exceptionTone'
import AuthScreen from './components/AuthScreen'
import DetailPanel from './components/DetailPanel'
import ExceptionRail from './components/ExceptionRail'
import LiveBadge from './components/LiveBadge'
import LoadForm from './components/LoadForm'
import LoadList from './components/LoadList'
import MapBoard from './components/MapBoard'
import SimulatorCard from './components/SimulatorCard'
import VehiclePanel from './components/VehiclePanel'

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(null)
  const [loads, setLoads] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [events, setEvents] = useState([])
  const [pings, setPings] = useState([])
  const [documents, setDocuments] = useState([])
  const [documentsLoadId, setDocumentsLoadId] = useState('')
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

  async function refreshDocuments(loadId = selectedLoadId, currentToken = token, loadForAccess = selectedLoad) {
    if (!currentToken || !loadId) {
      setDocuments([])
      setDocumentsLoadId('')
      return
    }

    const loadToCheck = loadForAccess?.id === loadId
      ? loadForAccess
      : loads.find((load) => load.id === loadId)

    if (!canFetchSelectedLoadData(user, loadToCheck)) {
      setDocuments([])
      setDocumentsLoadId(loadId)
      return
    }

    try {
      const data = await apiRequest(`/loads/${loadId}/documents`, { token: currentToken })
      setDocuments(data.documents)
      setDocumentsLoadId(loadId)
    } catch {
      setDocuments([])
      setDocumentsLoadId(loadId)
    }
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

    return loadData.loads
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
    if (!token || !selectedLoadId || !canFetchSelectedLoadData(user, selectedLoad)) return

    let ignore = false

    async function loadDocuments() {
      try {
        const data = await apiRequest(`/loads/${selectedLoadId}/documents`, { token })
        if (!ignore) {
          setDocuments(data.documents)
          setDocumentsLoadId(selectedLoadId)
        }
      } catch {
        if (!ignore) {
          setDocuments([])
          setDocumentsLoadId(selectedLoadId)
        }
      }
    }

    loadDocuments()

    return () => {
      ignore = true
    }
  }, [token, selectedLoadId, selectedLoad, user])

  useEffect(() => {
    if (!token || !selectedLoadId || !canFetchSelectedLoadData(user, selectedLoad)) return

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
  }, [token, selectedLoadId, selectedLoad, user])

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
    setDocuments([])
    setDocumentsLoadId('')
    setLiveStates([])
    setSelectedLoadId('')
    setLiveStatus('offline')
    setLoading(false)
  }

  async function reloadAndEvents() {
    const refreshedLoads = await refreshWorkspace()
    if (selectedLoadId) {
      const data = await apiRequest(`/loads/${selectedLoadId}/events`, { token })
      setEvents(data.events)
      const refreshedLoad = refreshedLoads?.find((load) => load.id === selectedLoadId) || selectedLoad

      if (canFetchSelectedLoadData(user, refreshedLoad)) {
        try {
          const pingData = await apiRequest(`/loads/${selectedLoadId}/pings?limit=12`, { token })
          setPings(pingData.pings)
        } catch {
          setPings([])
        }
        await refreshDocuments(selectedLoadId, token, refreshedLoad)
      } else {
        setPings([])
        setDocuments([])
        setDocumentsLoadId(selectedLoadId)
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

  const boardLoads = getBoardLoads(user, loads)
  const activeLoads = loads.filter((load) => !['delivered', 'cancelled'].includes(load.status))
  const canShowSelectedPrivateData = canFetchSelectedLoadData(user, selectedLoad)
  const selectedDocuments = canShowSelectedPrivateData && documentsLoadId === selectedLoadId ? documents : []
  const selectedPings = canShowSelectedPrivateData ? pings : []

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
          loads={boardLoads}
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
          pings={selectedPings}
          documents={selectedDocuments}
          onChanged={reloadAndEvents}
          onDocumentsChanged={reloadAndEvents}
        />
      </section>
    </main>
  )
}

export default App
// Named re-exports keep existing test imports working
export { AuthScreen }
export { LoadList }
