import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import AuthScreen from '../components/AuthScreen'

describe('AuthScreen', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  test('renders login form by default', () => {
    render(<AuthScreen onToken={vi.fn()} />)

    expect(screen.getByRole('button', { name: /enter dashboard/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument()
  })

  test('switches to register mode and shows account fields', async () => {
    const user = userEvent.setup()
    render(<AuthScreen onToken={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /^register$/i }))

    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument()
  })

  test('surfaces server error on failed login', async () => {
    const user = userEvent.setup()
    fetch.mockResolvedValueOnce({
      ok: false,
      text: async () => JSON.stringify({ error: 'Invalid credentials' }),
    })

    render(<AuthScreen onToken={vi.fn()} />)

    await user.type(screen.getByLabelText(/email/i), 'demo@test.com')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /enter dashboard/i }))

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument()
  })

  test('stores token and calls onToken on successful login', async () => {
    const onToken = vi.fn()
    const user = userEvent.setup()
    fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ token: 'abc.def.ghi' }),
    })

    render(<AuthScreen onToken={onToken} />)

    await user.type(screen.getByLabelText(/email/i), 'demo@test.com')
    await user.type(screen.getByLabelText(/password/i), 'secret123')
    await user.click(screen.getByRole('button', { name: /enter dashboard/i }))

    await waitFor(() => expect(onToken).toHaveBeenCalledWith('abc.def.ghi'))
    expect(localStorage.getItem('freightline_token')).toBe('abc.def.ghi')
  })
})
