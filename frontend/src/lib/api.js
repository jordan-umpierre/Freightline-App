export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'
export const TOKEN_KEY = 'freightline_token'

export async function apiRequest(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await response.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { error: 'Unexpected server response' }
  }

  if (!response.ok) {
    throw new Error(data.error || 'Request failed')
  }

  return data
}

export function buildLiveUrl(token) {
  const url = new URL(API_BASE)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = '/live'
  url.search = `?token=${encodeURIComponent(token)}`
  return url.toString()
}
