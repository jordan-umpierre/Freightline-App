function isImageDocument(contentType) {
  return contentType === 'image/jpeg' || contentType === 'image/png'
}

function formatUploadedAt(value) {
  if (!value) return 'Uploaded'
  return new Date(value).toLocaleString()
}

export default function DocumentList({ documents }) {
  if (!documents || documents.length === 0) {
    return <p className="empty-state">No documents uploaded yet.</p>
  }

  return (
    <div className="document-list">
      {documents.map((doc) => (
        <div className="document-item" key={doc.id}>
          {isImageDocument(doc.content_type) ? (
            <a href={doc.download_url} target="_blank" rel="noreferrer">
              <img src={doc.download_url} alt={`${doc.kind.toUpperCase()} document`} />
            </a>
          ) : (
            <a className="document-file-link" href={doc.download_url} target="_blank" rel="noreferrer">
              Open PDF
            </a>
          )}
          <span className="document-meta">
            {doc.kind.toUpperCase()} - {formatUploadedAt(doc.uploaded_at)}
          </span>
        </div>
      ))}
    </div>
  )
}
