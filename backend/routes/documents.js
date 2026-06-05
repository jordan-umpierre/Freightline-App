const express = require('express')
const pool = require('../db/pool')
const { authenticate, authorize } = require('../middleware/auth')
const {
  MAX_POD_BYTES,
  isAllowedContentType,
  presignDocumentDownload,
  presignPodUpload,
  verifyUploadedDocument,
} = require('../services/s3')

const router = express.Router({ mergeParams: true })

router.use(authenticate)

async function loadById(loadId) {
  const result = await pool.query(
    `SELECT l.*, v.driver_id
     FROM loads l
     LEFT JOIN vehicles v ON v.id = l.vehicle_id
     WHERE l.id = $1`,
    [loadId]
  )

  return result.rows[0] || null
}

function userCanViewLoadDocuments(user, load) {
  const isShipperOwner = user.role === 'shipper' && load.shipper_id === user.user_id
  const isAssignedDriver = user.role === 'driver' && load.driver_id === user.user_id
  return isShipperOwner || isAssignedDriver
}

router.get('/', async (req, res) => {
  try {
    const load = await loadById(req.params.id)
    if (!load) return res.status(404).json({ error: 'Load not found' })
    if (!userCanViewLoadDocuments(req.user, load)) return res.status(403).json({ error: 'Forbidden' })

    const docsResult = await pool.query(
      `SELECT id, kind, s3_bucket, s3_key, content_type, size_bytes, uploaded_at, status
       FROM load_documents
       WHERE load_id = $1 AND status = 'uploaded'
       ORDER BY uploaded_at DESC`,
      [load.id]
    )

    const documents = await Promise.all(
      docsResult.rows.map(async (doc) => ({
        ...doc,
        download_url: await presignDocumentDownload({
          s3_bucket: doc.s3_bucket,
          s3_key: doc.s3_key,
        }),
      }))
    )

    res.json({ documents })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not load documents' })
  }
})

router.post('/pod-upload-url', authorize(['driver']), async (req, res) => {
  const { content_type, size_bytes } = req.body

  try {
    const load = await loadById(req.params.id)
    if (!load) return res.status(404).json({ error: 'Load not found' })
    if (load.driver_id !== req.user.user_id) return res.status(403).json({ error: 'Forbidden' })
    if (!['in_transit', 'delivered'].includes(load.status)) {
      return res.status(409).json({ error: 'POD can only be uploaded for in_transit or delivered loads' })
    }

    if (!isAllowedContentType(content_type)) {
      return res.status(400).json({ error: 'content_type must be image/jpeg, image/png, or application/pdf' })
    }
    if (!Number.isInteger(size_bytes) || size_bytes <= 0 || size_bytes > MAX_POD_BYTES) {
      return res.status(400).json({ error: `size_bytes must be a positive integer up to ${MAX_POD_BYTES}` })
    }

    const presigned = await presignPodUpload({
      load_id: load.id,
      content_type,
      size_bytes,
    })

    const insertResult = await pool.query(
      `INSERT INTO load_documents (
         load_id, uploaded_by, kind, s3_bucket, s3_key,
         content_type, size_bytes, status
       )
       VALUES ($1, $2, 'pod', $3, $4, $5, $6, 'pending')
       RETURNING id`,
      [
        load.id,
        req.user.user_id,
        presigned.s3_bucket,
        presigned.s3_key,
        content_type,
        size_bytes,
      ]
    )

    res.status(201).json({
      document_id: insertResult.rows[0].id,
      upload_url: presigned.upload_url,
      s3_key: presigned.s3_key,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not create POD upload URL' })
  }
})

router.post('/:doc_id/confirm', authorize(['driver']), async (req, res) => {
  try {
    const docResult = await pool.query(
      'SELECT * FROM load_documents WHERE id = $1 AND load_id = $2',
      [req.params.doc_id, req.params.id]
    )
    const doc = docResult.rows[0]

    if (!doc) return res.status(404).json({ error: 'Document not found' })
    if (doc.uploaded_by !== req.user.user_id) return res.status(403).json({ error: 'Forbidden' })

    if (doc.status === 'uploaded') return res.json({ document: doc })

    const uploadMatchesRequest = await verifyUploadedDocument({
      s3_bucket: doc.s3_bucket,
      s3_key: doc.s3_key,
      content_type: doc.content_type,
      size_bytes: doc.size_bytes,
    })

    if (!uploadMatchesRequest) {
      return res.status(409).json({
        error: 'Uploaded document metadata does not match the requested upload',
      })
    }

    const updateResult = await pool.query(
      `UPDATE load_documents
       SET status = 'uploaded', uploaded_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [doc.id]
    )

    await pool.query(
      `INSERT INTO load_events (load_id, actor_id, event_type, status, note)
       VALUES ($1, $2, 'pod_uploaded', NULL, $3)`,
      [doc.load_id, req.user.user_id, 'POD uploaded']
    )

    res.json({ document: updateResult.rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not confirm POD upload' })
  }
})

module.exports = router
