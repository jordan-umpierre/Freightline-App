const jwt = require('jsonwebtoken')
const request = require('supertest')

jest.mock('../db/pool', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}))

process.env.JWT_SECRET = 'test-secret'

const pool = require('../db/pool')
const s3 = require('../services/s3')
const app = require('../app')

function auth(role, userId = `${role}-1`) {
  return `Bearer ${jwt.sign({ user_id: userId, role }, process.env.JWT_SECRET)}`
}

function assignedLoad(overrides = {}) {
  return {
    id: 'load-1',
    shipper_id: 'shipper-1',
    vehicle_id: 'vehicle-1',
    driver_id: 'driver-1',
    status: 'in_transit',
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('POST /loads/:id/documents/pod-upload-url', () => {
  test('shippers cannot request a POD upload URL', async () => {
    const response = await request(app)
      .post('/loads/load-1/documents/pod-upload-url')
      .set('Authorization', auth('shipper'))
      .send({ content_type: 'image/jpeg', size_bytes: 100 })

    expect(response.status).toBe(403)
  })

  test('drivers not assigned to the load are rejected', async () => {
    pool.query.mockResolvedValueOnce({ rows: [assignedLoad({ driver_id: 'other-driver' })] })

    const response = await request(app)
      .post('/loads/load-1/documents/pod-upload-url')
      .set('Authorization', auth('driver'))
      .send({ content_type: 'image/jpeg', size_bytes: 100 })

    expect(response.status).toBe(403)
  })

  test('drivers cannot request POD URL for a posted load', async () => {
    pool.query.mockResolvedValueOnce({ rows: [assignedLoad({ status: 'posted' })] })

    const response = await request(app)
      .post('/loads/load-1/documents/pod-upload-url')
      .set('Authorization', auth('driver'))
      .send({ content_type: 'image/jpeg', size_bytes: 100 })

    expect(response.status).toBe(409)
    expect(response.body.error).toMatch(/in_transit or delivered/i)
  })

  test('rejects disallowed content types', async () => {
    pool.query.mockResolvedValueOnce({ rows: [assignedLoad()] })

    const response = await request(app)
      .post('/loads/load-1/documents/pod-upload-url')
      .set('Authorization', auth('driver'))
      .send({ content_type: 'image/gif', size_bytes: 100 })

    expect(response.status).toBe(400)
    expect(response.body.error).toMatch(/content_type/)
  })

  test('rejects size_bytes over the 10 MB limit', async () => {
    pool.query.mockResolvedValueOnce({ rows: [assignedLoad()] })

    const response = await request(app)
      .post('/loads/load-1/documents/pod-upload-url')
      .set('Authorization', auth('driver'))
      .send({ content_type: 'image/jpeg', size_bytes: 11 * 1024 * 1024 })

    expect(response.status).toBe(400)
    expect(response.body.error).toMatch(/size_bytes/)
  })

  test('returns upload_url and inserts a pending document row', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [assignedLoad()] })
      .mockResolvedValueOnce({ rows: [{ id: 'doc-1' }] })

    s3.presignPodUpload.mockResolvedValueOnce({
      upload_url: 'https://s3.example/upload',
      s3_key: 'pod/load-1/abc',
      s3_bucket: 'test-bucket',
    })

    const response = await request(app)
      .post('/loads/load-1/documents/pod-upload-url')
      .set('Authorization', auth('driver'))
      .send({ content_type: 'image/jpeg', size_bytes: 5000 })

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      upload_url: 'https://s3.example/upload',
      document_id: 'doc-1',
      s3_key: 'pod/load-1/abc',
    })
    expect(s3.presignPodUpload).toHaveBeenCalledWith({
      load_id: 'load-1',
      content_type: 'image/jpeg',
      size_bytes: 5000,
    })
  })
})

describe('POST /loads/:id/documents/:doc_id/confirm', () => {
  test('shippers cannot confirm uploads', async () => {
    const response = await request(app)
      .post('/loads/load-1/documents/doc-1/confirm')
      .set('Authorization', auth('shipper'))
      .send({})

    expect(response.status).toBe(403)
  })

  test('drivers can only confirm their own pending documents', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'doc-1', uploaded_by: 'other-driver', status: 'pending', load_id: 'load-1' }],
    })

    const response = await request(app)
      .post('/loads/load-1/documents/doc-1/confirm')
      .set('Authorization', auth('driver'))
      .send({})

    expect(response.status).toBe(403)
  })

  test('confirm flips the row to uploaded and inserts a pod_uploaded event', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 'doc-1', uploaded_by: 'driver-1', status: 'pending', load_id: 'load-1' }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'doc-1', status: 'uploaded' }] })
      .mockResolvedValueOnce({ rows: [] })

    const response = await request(app)
      .post('/loads/load-1/documents/doc-1/confirm')
      .set('Authorization', auth('driver'))
      .send({})

    expect(response.status).toBe(200)
    expect(response.body.document.status).toBe('uploaded')

    const updateCall = pool.query.mock.calls[1]
    expect(updateCall[0]).toMatch(/UPDATE load_documents/)
    expect(updateCall[0]).toMatch(/status = 'uploaded'/)

    const eventCall = pool.query.mock.calls[2]
    expect(eventCall[0]).toMatch(/INSERT INTO load_events/)
    expect(eventCall[1]).toEqual(expect.arrayContaining(['load-1', 'driver-1', 'POD uploaded']))
  })

  test('confirming an already-uploaded document is idempotent', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'doc-1', uploaded_by: 'driver-1', status: 'uploaded', load_id: 'load-1' }],
    })

    const response = await request(app)
      .post('/loads/load-1/documents/doc-1/confirm')
      .set('Authorization', auth('driver'))
      .send({})

    expect(response.status).toBe(200)
    expect(response.body.document.status).toBe('uploaded')
    expect(pool.query).toHaveBeenCalledTimes(1)
  })
})

describe('GET /loads/:id/documents', () => {
  test('shipper-owner can list documents with presigned download URLs', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [assignedLoad()] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'doc-1',
            kind: 'pod',
            s3_bucket: 'b',
            s3_key: 'pod/load-1/abc.jpg',
            content_type: 'image/jpeg',
            uploaded_at: '2026-05-08T00:00:00Z',
            status: 'uploaded',
          },
        ],
      })

    s3.presignDocumentDownload.mockResolvedValueOnce('https://signed.example/download')

    const response = await request(app)
      .get('/loads/load-1/documents')
      .set('Authorization', auth('shipper'))

    expect(response.status).toBe(200)
    expect(response.body.documents).toHaveLength(1)
    expect(response.body.documents[0]).toMatchObject({
      id: 'doc-1',
      content_type: 'image/jpeg',
      download_url: 'https://signed.example/download',
    })
  })

  test('assigned driver can list documents', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [assignedLoad()] })
      .mockResolvedValueOnce({ rows: [] })

    const response = await request(app)
      .get('/loads/load-1/documents')
      .set('Authorization', auth('driver'))

    expect(response.status).toBe(200)
    expect(response.body.documents).toEqual([])
  })

  test('unrelated users get 403', async () => {
    pool.query.mockResolvedValueOnce({ rows: [assignedLoad({ shipper_id: 'shipper-1' })] })

    const response = await request(app)
      .get('/loads/load-1/documents')
      .set('Authorization', auth('shipper', 'shipper-2'))

    expect(response.status).toBe(403)
  })

  test('only uploaded documents are returned', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [assignedLoad()] })
      .mockResolvedValueOnce({ rows: [] })

    await request(app)
      .get('/loads/load-1/documents')
      .set('Authorization', auth('shipper'))

    const docsQuery = pool.query.mock.calls[1][0]
    expect(docsQuery).toMatch(/status = 'uploaded'/)
  })
})
