import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import PodUpload from '../components/PodUpload'

describe('PodUpload', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  test('does not render when load status is posted', () => {
    render(<PodUpload load={{ id: 'l1', status: 'posted' }} token="t" onUploaded={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /upload pod/i })).not.toBeInTheDocument()
  })

  test('renders upload button when load is in_transit', () => {
    render(<PodUpload load={{ id: 'l1', status: 'in_transit' }} token="t" onUploaded={vi.fn()} />)

    expect(screen.getByRole('button', { name: /upload pod/i })).toBeInTheDocument()
  })

  test('uploads a file via presigned URL and calls onUploaded', async () => {
    const onUploaded = vi.fn()
    const user = userEvent.setup()

    fetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          document_id: 'doc-1',
          upload_url: 'https://s3.example/upload',
          s3_key: 'pod/l1/abc',
        }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ document: { id: 'doc-1', status: 'uploaded' } }),
      })

    render(<PodUpload load={{ id: 'l1', status: 'in_transit' }} token="t" onUploaded={onUploaded} />)

    const file = new File(['hello'], 'pod.jpg', { type: 'image/jpeg' })
    const input = screen.getByLabelText(/upload pod/i)
    await user.upload(input, file)

    await waitFor(() => expect(onUploaded).toHaveBeenCalled())

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls[1][0]).toBe('https://s3.example/upload')
    expect(fetch.mock.calls[1][1].method).toBe('PUT')
  })

  test('shows error message when upload-url request fails', async () => {
    const user = userEvent.setup()
    fetch.mockResolvedValueOnce({
      ok: false,
      text: async () => JSON.stringify({ error: 'size_bytes too large' }),
    })

    render(<PodUpload load={{ id: 'l1', status: 'in_transit' }} token="t" onUploaded={vi.fn()} />)

    const file = new File(['x'.repeat(20)], 'pod.jpg', { type: 'image/jpeg' })
    const input = screen.getByLabelText(/upload pod/i)
    await user.upload(input, file)

    expect(await screen.findByText(/size_bytes too large/)).toBeInTheDocument()
  })
})
