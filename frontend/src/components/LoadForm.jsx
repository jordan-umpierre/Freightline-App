import { useState } from 'react'
import { apiRequest } from '../lib/api'
import { DEMO_LANES } from '../lib/constants'
import { BusyButton, FormError } from './FormControls'

export default function LoadForm({ token, onCreated }) {
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

      <FormError message={error} />
      <BusyButton busy={busy} busyLabel="Posting..." label="Post load" />
    </form>
  )
}
