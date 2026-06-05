export function FormError({ message }) {
  return message ? <p className="form-error">{message}</p> : null
}

export function BusyButton({ busy, busyLabel, label }) {
  return (
    <button className="primary-action" disabled={busy}>
      {busy ? busyLabel : label}
    </button>
  )
}
