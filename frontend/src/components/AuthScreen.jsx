import { useState } from 'react'
import { apiRequest, TOKEN_KEY } from '../lib/api'
import { BusyButton, FormError } from './FormControls'

export default function AuthScreen({ onToken }) {
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

        <FormError message={error} />

        <BusyButton
          busy={busy}
          busyLabel="Working..."
          label={mode === 'login' ? 'Enter dashboard' : 'Create account'}
        />
      </form>
    </main>
  )
}
