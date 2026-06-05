import { vi } from 'vitest'
import { apiRequest } from '../lib/api'

describe('apiRequest', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  test('throws with a friendly message when server returns non-JSON (e.g. Railway 502)', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      text: async () => '<html><body>Bad Gateway</body></html>',
    })

    await expect(apiRequest('/loads')).rejects.toThrow('Unexpected server response')
  })

  test('throws the server error message on a well-formed error response', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: 'Invalid credentials' }),
    })

    await expect(apiRequest('/auth/login', { method: 'POST', body: {} })).rejects.toThrow('Invalid credentials')
  })

  test('returns parsed JSON on a successful response', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ loads: [] }),
    })

    const result = await apiRequest('/loads', { token: 'abc' })
    expect(result).toEqual({ loads: [] })
  })
})
