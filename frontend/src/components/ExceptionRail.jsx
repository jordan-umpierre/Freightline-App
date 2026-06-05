export default function ExceptionRail({ exceptions }) {
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
