import { STATUS_FLOW } from '../lib/constants'
import { formatMoney, formatWeight } from '../lib/formatters'

export default function LoadList({ title, loads, selectedLoadId, onSelect, actions }) {
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
