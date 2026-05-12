import { render, screen } from '@testing-library/react'
import DocumentList from '../components/DocumentList'

const imageDoc = {
  id: 'd1',
  kind: 'pod',
  content_type: 'image/jpeg',
  download_url: 'https://signed.example/abc.jpg',
  uploaded_at: '2026-05-08T00:00:00Z',
}

const pdfDoc = {
  id: 'd2',
  kind: 'pod',
  content_type: 'application/pdf',
  download_url: 'https://signed.example/abc.pdf',
  uploaded_at: '2026-05-08T01:00:00Z',
}

describe('DocumentList', () => {
  test('renders empty state when no documents', () => {
    render(<DocumentList documents={[]} />)

    expect(screen.getByText(/no documents/i)).toBeInTheDocument()
  })

  test('renders an image thumbnail for image documents', () => {
    render(<DocumentList documents={[imageDoc]} />)

    const img = screen.getByRole('img', { name: /pod/i })
    expect(img).toHaveAttribute('src', imageDoc.download_url)
  })

  test('renders a download link for PDF documents', () => {
    render(<DocumentList documents={[pdfDoc]} />)

    const link = screen.getByRole('link', { name: /open pdf/i })
    expect(link).toHaveAttribute('href', pdfDoc.download_url)
    expect(link).toHaveAttribute('target', '_blank')
  })
})
