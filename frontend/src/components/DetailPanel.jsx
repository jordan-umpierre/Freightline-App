import { useState } from 'react'
import { apiRequest } from '../lib/api'
import { STATUS_FLOW } from '../lib/constants'
import { formatMoney, formatWeight } from '../lib/formatters'
import { formatTime } from '../lib/loadVisibility'
import DocumentList from './DocumentList'
import PodUpload from './PodUpload'
import { FormError } from './FormControls'

export default function DetailPanel({ user, token, load, events, pings, documents, onChanged, onDocumentsChanged }) {
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

      <FormError message={error} />

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

      <div className="documents-section">
        <p className="eyebrow">Documents</p>
        {user?.role === 'driver' && (
          <PodUpload load={load} token={token} onUploaded={onDocumentsChanged} />
        )}
        <DocumentList documents={documents} />
      </div>
    </section>
  )
}
