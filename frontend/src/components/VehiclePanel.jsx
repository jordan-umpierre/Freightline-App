import { useState } from 'react'
import { apiRequest } from '../lib/api'
import { formatWeight } from '../lib/formatters'
import { BusyButton, FormError } from './FormControls'

export default function VehiclePanel({ token, vehicles, onCreated }) {
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
        <FormError message={error} />
        <BusyButton busy={busy} busyLabel="Saving..." label="Register truck" />
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
