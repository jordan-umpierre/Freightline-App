import { useRef, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const ELIGIBLE_STATUSES = ['in_transit', 'delivered']

async function readJsonResponse(response, fallbackError) {
  const text = await response.text()
  const data = text ? JSON.parse(text) : {}

  if (!response.ok) {
    throw new Error(data.error || fallbackError)
  }

  return data
}

export default function PodUpload({ load, token, onUploaded }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!load || !ELIGIBLE_STATUSES.includes(load.status)) return null

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setBusy(true)
    setError('')

    try {
      const presignResponse = await fetch(`${API_BASE}/loads/${load.id}/documents/pod-upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content_type: file.type,
          size_bytes: file.size,
        }),
      })
      const presign = await readJsonResponse(presignResponse, 'Could not get upload URL')

      const uploadResponse = await fetch(presign.upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      })
      if (!uploadResponse.ok) throw new Error('S3 upload failed')

      const confirmResponse = await fetch(
        `${API_BASE}/loads/${load.id}/documents/${presign.document_id}/confirm`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      )
      await readJsonResponse(confirmResponse, 'Confirm step failed')

      await onUploaded?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="pod-upload">
      <button
        type="button"
        className="primary-action"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? 'Uploading...' : 'Upload POD'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        aria-label="Upload POD"
        disabled={busy}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
