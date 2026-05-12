# Phase 4 — S3 Proof-of-Delivery Uploads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drivers upload proof-of-delivery (POD) photos directly to S3 via short-lived presigned PUT URLs; shippers view them via presigned GET URLs. Server stores only the S3 key and metadata. Server-side validation enforces content type (`image/jpeg|image/png|application/pdf`) and size (≤10 MB) — bucket policy is defense-in-depth, not the boundary.

**Architecture:** Two-phase row pattern: API issues a presigned URL and inserts a `pending` row → driver PUTs to S3 directly → driver POSTs a `confirm` callback that flips the row to `uploaded` and emits a `pod_uploaded` load event. Shipper read endpoint returns presigned GET URLs scoped to 15 minutes. AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`).

**Tech Stack:** Express, Postgres (new table + new event type), AWS S3, AWS SDK v3.

**Spec reference:** `docs/superpowers/specs/2026-05-11-freightline-resume-polish-design.md` Phase 4.

**Prerequisite:** Phases 1, 2, 3 plans complete and CI green. AWS account access required.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/db/migrations/005_create_load_documents.sql` | Create | New `load_documents` table. |
| `backend/db/migrations/006_extend_load_events_pod_uploaded.sql` | Create | Add `pod_uploaded` to `load_events.event_type` CHECK constraint. |
| `backend/db/schema.sql` | Modify | Reflect new table + extended check constraint (so a fresh-clone schema dump matches migrations). |
| `backend/services/s3.js` | Create | Wraps AWS SDK; presigns PUT and GET URLs with content-type + size validation. |
| `backend/routes/documents.js` | Create | New router for `/loads/:id/documents/*` endpoints. |
| `backend/app.js` | Modify | Mount documents router on the `/loads` path. |
| `backend/.env.example` | Modify | Add AWS env vars. |
| `backend/__tests__/s3.test.js` | Create | Unit test for `presignPodUpload` validation. |
| `backend/__tests__/documents.test.js` | Create | Integration tests for the three new endpoints. |
| `backend/jest.setup.js` | Modify | Mock `services/s3` globally (parallel to mongo mock from Phase 1). |
| `frontend/src/components/PodUpload.jsx` | Create | Driver upload UI (button → file picker → fetch). |
| `frontend/src/components/DocumentList.jsx` | Create | Shipper-side document gallery. |
| `frontend/src/App.jsx` | Modify | Wire `PodUpload` and `DocumentList` into `DetailPanel`. |
| `frontend/src/__tests__/PodUpload.test.jsx` | Create | RTL test for the upload flow with mocked fetch. |
| `frontend/src/__tests__/DocumentList.test.jsx` | Create | RTL test for the document gallery. |
| `README.md` | Modify | Document the new endpoints + AWS env vars. |

---

## Task 1: AWS infrastructure setup (manual, one-time)

**Files:** None (AWS Console + CLI work, captured here so the steps are reproducible)

You need an AWS account. Free tier covers this comfortably for a portfolio demo.

- [ ] **Step 1: Create the S3 bucket**

In the AWS Console (or via CLI), create a bucket named `freightline-pod-dev` (or pick a globally-unique name and adjust env vars accordingly). Recommended region: `us-east-1` for lowest cost.

Settings:
- **Block all public access:** ON (we use presigned URLs, never public reads)
- **Versioning:** OFF (not needed for v1; would be on for prod)
- **Server-side encryption:** SSE-S3 (default, free)

- [ ] **Step 2: Configure CORS on the bucket**

In the bucket → Permissions → CORS, paste:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": [
      "https://freightline-app.vercel.app",
      "http://localhost:5173"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

`PUT` is for the presigned upload from the browser. `GET` is for image previews (browsers fetch image src cross-origin). The two origins are deployed Vercel + local Vite dev.

- [ ] **Step 3: Create an IAM user with least-privilege access**

In IAM → Users → Create user (name: `freightline-api`).

Attach an **inline policy** (not an AWS-managed one — too broad):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPodObjectAccess",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::freightline-pod-dev/pod/*"
    }
  ]
}
```

The `/pod/*` prefix means even if a key is malformed, the IAM user can't read or write outside that prefix. **This is the kind of detail that reads as senior in interview.**

- [ ] **Step 4: Create access keys for the IAM user**

IAM → freightline-api → Security credentials → Create access key (use case: "Application running outside AWS"). Save the access key ID and secret — you'll never see the secret again.

- [ ] **Step 5: Set a billing alarm**

CloudWatch → Billing → Create alarm at $5/month threshold with email notification. Free tier should cover this entirely, but a $5 ceiling is cheap insurance against a runaway bug.

- [ ] **Step 6: Note the values for env vars**

You'll need:
- `AWS_REGION=us-east-1`
- `AWS_S3_BUCKET=freightline-pod-dev`
- `AWS_ACCESS_KEY_ID=AKIA...`
- `AWS_SECRET_ACCESS_KEY=...`

Set these in `backend/.env` locally (do not commit). For Railway, set them via the Railway dashboard → Variables.

---

## Task 2: Install AWS SDK and add env-var stubs

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/.env.example`

- [ ] **Step 1: Install AWS SDK v3 packages**

Run from `backend/`:
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Verify:
```bash
grep "aws-sdk" package.json
```

Expected: two new dependencies listed.

- [ ] **Step 2: Update `.env.example`**

Open `backend/.env.example` and append:
```
AWS_REGION=us-east-1
AWS_S3_BUCKET=freightline-pod-dev
AWS_ACCESS_KEY_ID=replace-me
AWS_SECRET_ACCESS_KEY=replace-me
```

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/.env.example
git commit -m "chore(backend): add aws-sdk v3 deps and env stubs for s3 pod uploads"
```

---

## Task 3: Migration 005 — `load_documents` table

**Files:**
- Create: `backend/db/migrations/005_create_load_documents.sql`
- Modify: `backend/db/schema.sql`

- [ ] **Step 1: Write the migration**

Create `backend/db/migrations/005_create_load_documents.sql`:
```sql
CREATE TABLE IF NOT EXISTS load_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id UUID NOT NULL REFERENCES loads(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('pod', 'bol')),
  s3_bucket TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'uploaded')),
  created_at TIMESTAMP DEFAULT NOW(),
  uploaded_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_load_documents_load_id
  ON load_documents(load_id);
```

10 MB ceiling is enforced both in code (Task 5) and in the schema CHECK — defense in depth.

- [ ] **Step 2: Update `backend/db/schema.sql`**

Append the same `CREATE TABLE` and `CREATE INDEX` statements to the end of `backend/db/schema.sql` so a fresh-clone `psql -f schema.sql` matches the migration result.

- [ ] **Step 3: Apply the migration locally**

```bash
psql -d freightline -f backend/db/migrations/005_create_load_documents.sql
```

Verify:
```bash
psql -d freightline -c "\d load_documents"
```

Expected: a clean table description with all 10 columns.

- [ ] **Step 4: Commit**

```bash
git add backend/db/migrations/005_create_load_documents.sql backend/db/schema.sql
git commit -m "feat(db): add load_documents table for s3 pod uploads"
```

---

## Task 4: Migration 006 — extend `load_events.event_type`

**Files:**
- Create: `backend/db/migrations/006_extend_load_events_pod_uploaded.sql`
- Modify: `backend/db/schema.sql`

- [ ] **Step 1: Write the migration**

Postgres CHECK constraints can't be modified in place — must drop and re-add. Create `backend/db/migrations/006_extend_load_events_pod_uploaded.sql`:
```sql
ALTER TABLE load_events DROP CONSTRAINT load_events_event_type_check;

ALTER TABLE load_events ADD CONSTRAINT load_events_event_type_check
  CHECK (event_type IN (
    'created', 'updated', 'assigned', 'status_changed',
    'cancelled', 'location_ping', 'pod_uploaded'
  ));
```

- [ ] **Step 2: Update `backend/db/schema.sql`**

In `backend/db/schema.sql`, find the existing `event_type` CHECK and add `'pod_uploaded'` to the list. Keep the ordering consistent with the migration above.

- [ ] **Step 3: Apply locally**

```bash
psql -d freightline -f backend/db/migrations/006_extend_load_events_pod_uploaded.sql
```

Verify:
```bash
psql -d freightline -c "\d+ load_events" | grep -A 2 event_type
```

Expected: the CHECK constraint includes `pod_uploaded`.

- [ ] **Step 4: Commit**

```bash
git add backend/db/migrations/006_extend_load_events_pod_uploaded.sql backend/db/schema.sql
git commit -m "feat(db): allow pod_uploaded event type on load_events"
```

---

## Task 5: `services/s3.js` — presigning + validation (TDD)

**Files:**
- Create: `backend/__tests__/s3.test.js`
- Create: `backend/services/s3.js`

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/s3.test.js`:
```js
process.env.AWS_REGION = 'us-east-1'
process.env.AWS_S3_BUCKET = 'test-bucket'
process.env.AWS_ACCESS_KEY_ID = 'test-key'
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/upload'),
}))

const { presignPodUpload, isAllowedContentType, MAX_POD_BYTES } = require('../services/s3')

describe('s3 service validation', () => {
  test('isAllowedContentType accepts image/jpeg, image/png, application/pdf', () => {
    expect(isAllowedContentType('image/jpeg')).toBe(true)
    expect(isAllowedContentType('image/png')).toBe(true)
    expect(isAllowedContentType('application/pdf')).toBe(true)
  })

  test('isAllowedContentType rejects everything else', () => {
    expect(isAllowedContentType('image/gif')).toBe(false)
    expect(isAllowedContentType('text/html')).toBe(false)
    expect(isAllowedContentType('')).toBe(false)
    expect(isAllowedContentType(undefined)).toBe(false)
  })

  test('MAX_POD_BYTES is 10 MB', () => {
    expect(MAX_POD_BYTES).toBe(10 * 1024 * 1024)
  })

  test('presignPodUpload throws on disallowed content type', async () => {
    await expect(presignPodUpload({
      load_id: 'load-1',
      content_type: 'image/gif',
      size_bytes: 1000,
    })).rejects.toThrow(/content_type/)
  })

  test('presignPodUpload throws when size exceeds limit', async () => {
    await expect(presignPodUpload({
      load_id: 'load-1',
      content_type: 'image/jpeg',
      size_bytes: MAX_POD_BYTES + 1,
    })).rejects.toThrow(/size/)
  })

  test('presignPodUpload returns upload_url and s3_key on valid input', async () => {
    const result = await presignPodUpload({
      load_id: 'load-1',
      content_type: 'image/jpeg',
      size_bytes: 1024,
    })

    expect(result.upload_url).toBe('https://signed.example/upload')
    expect(result.s3_key).toMatch(/^pod\/load-1\//)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && npm test -- __tests__/s3.test.js
```

Expected: failure — `Cannot find module '../services/s3'`.

- [ ] **Step 3: Implement the service**

Create `backend/services/s3.js`:
```js
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const crypto = require('crypto')

const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf'])
const MAX_POD_BYTES = 10 * 1024 * 1024
const UPLOAD_URL_TTL_SECONDS = 5 * 60
const DOWNLOAD_URL_TTL_SECONDS = 15 * 60

let cachedClient

function getClient() {
  if (cachedClient) return cachedClient
  cachedClient = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  })
  return cachedClient
}

function isAllowedContentType(contentType) {
  return ALLOWED_CONTENT_TYPES.has(contentType)
}

function buildPodKey(loadId) {
  return `pod/${loadId}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}`
}

async function presignPodUpload({ load_id, content_type, size_bytes }) {
  if (!isAllowedContentType(content_type)) {
    throw new Error(`content_type ${content_type} is not allowed`)
  }

  if (!Number.isInteger(size_bytes) || size_bytes <= 0 || size_bytes > MAX_POD_BYTES) {
    throw new Error(`size_bytes must be 1..${MAX_POD_BYTES}`)
  }

  const bucket = process.env.AWS_S3_BUCKET
  const s3_key = buildPodKey(load_id)

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3_key,
    ContentType: content_type,
    ContentLength: size_bytes,
  })

  const upload_url = await getSignedUrl(getClient(), command, {
    expiresIn: UPLOAD_URL_TTL_SECONDS,
  })

  return { upload_url, s3_key, s3_bucket: bucket }
}

async function presignDocumentDownload({ s3_bucket, s3_key }) {
  const command = new GetObjectCommand({ Bucket: s3_bucket, Key: s3_key })
  return getSignedUrl(getClient(), command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS })
}

module.exports = {
  ALLOWED_CONTENT_TYPES,
  MAX_POD_BYTES,
  isAllowedContentType,
  presignPodUpload,
  presignDocumentDownload,
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd backend && npm test -- __tests__/s3.test.js
```

Expected: 6 tests pass.

- [ ] **Step 5: Add s3 mock to global jest setup**

Open `backend/jest.setup.js` (created in Phase 1). Append:
```js
jest.mock('./services/s3', () => ({
  ALLOWED_CONTENT_TYPES: new Set(['image/jpeg', 'image/png', 'application/pdf']),
  MAX_POD_BYTES: 10 * 1024 * 1024,
  isAllowedContentType: jest.requireActual('./services/s3').isAllowedContentType,
  presignPodUpload: jest.fn(),
  presignDocumentDownload: jest.fn(),
}))
```

This way `documents.test.js` (next task) can call the route handlers without ever hitting the real AWS SDK or env vars. The `s3.test.js` file already mocks `getSignedUrl` directly so it bypasses the global mock.

Wait — `jest.setup.js` runs *before* any test file, so the global mock will apply to `s3.test.js` too and break the test. Move this mock instead into a per-file setup or use `jest.unmock` in `s3.test.js`.

Cleaner fix: in `s3.test.js`, add at the very top (before the existing `jest.mock` for the presigner):
```js
jest.unmock('../services/s3')
```

This restores the real module for that test file only.

- [ ] **Step 6: Re-run all backend tests**

```bash
cd backend && npm test
```

Expected: all 32 tests pass (26 existing + 6 new).

- [ ] **Step 7: Commit**

```bash
git add backend/services/s3.js backend/__tests__/s3.test.js backend/jest.setup.js
git commit -m "feat(backend): s3 service with content-type and size validation

Wraps @aws-sdk/client-s3 + presigner. presignPodUpload validates
content_type against allow-list and size against 10 MB ceiling
before issuing a 5-minute PUT URL. presignDocumentDownload issues
a 15-minute GET URL. Bucket policy is defense in depth, not the
security boundary."
```

---

## Task 6: `routes/documents.js` — POST upload-url endpoint (TDD)

**Files:**
- Create: `backend/routes/documents.js`
- Modify: `backend/app.js` (mount router)
- Create: `backend/__tests__/documents.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/__tests__/documents.test.js`:
```js
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

  test('drivers cannot request POD URL for a posted (not-yet-assigned) load', async () => {
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
      .mockResolvedValueOnce({ rows: [assignedLoad()] })             // load fetch
      .mockResolvedValueOnce({ rows: [{ id: 'doc-1' }] })            // insert document

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
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend && npm test -- __tests__/documents.test.js
```

Expected: 6 failures — endpoint doesn't exist (404).

- [ ] **Step 3: Create the documents router**

Create `backend/routes/documents.js`:
```js
const express = require('express')
const pool = require('../db/pool')
const { authenticate, authorize } = require('../middleware/auth')
const {
  isAllowedContentType,
  MAX_POD_BYTES,
  presignPodUpload,
  presignDocumentDownload,
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

router.post('/pod-upload-url', authorize(['driver']), async (req, res) => {
  const { content_type, size_bytes } = req.body

  try {
    const load = await loadById(req.params.id)
    if (!load) return res.status(404).json({ error: 'Load not found' })
    if (load.driver_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    if (!['in_transit', 'delivered'].includes(load.status)) {
      return res.status(409).json({ error: 'POD can only be uploaded for in_transit or delivered loads' })
    }

    if (!isAllowedContentType(content_type)) {
      return res.status(400).json({ error: `content_type must be image/jpeg, image/png, or application/pdf` })
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

module.exports = router
```

- [ ] **Step 4: Mount the router in `backend/app.js`**

Open `backend/app.js`. After the existing `loadsRouter` import, add:
```js
const documentsRouter = require('./routes/documents')
```

After `app.use('/loads', loadsRouter)`, add:
```js
app.use('/loads/:id/documents', documentsRouter)
```

(The `mergeParams: true` in the router's constructor lets the handler read `req.params.id` from the parent route.)

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd backend && npm test -- __tests__/documents.test.js
```

Expected: all 6 tests in this `describe` block pass. (Tasks 7 and 8 will add more tests to this file.)

- [ ] **Step 6: Commit**

```bash
git add backend/routes/documents.js backend/app.js backend/__tests__/documents.test.js
git commit -m "feat(backend): POST /loads/:id/documents/pod-upload-url endpoint

Driver-only. Validates load ownership, status must be in_transit
or delivered, content_type allow-list, size_bytes ≤ 10 MB. Inserts
a pending load_documents row and returns the presigned upload URL."
```

---

## Task 7: POST `/confirm` endpoint + `pod_uploaded` event (TDD)

**Files:**
- Modify: `backend/routes/documents.js`
- Modify: `backend/__tests__/documents.test.js`

- [ ] **Step 1: Add failing tests**

Append to `backend/__tests__/documents.test.js`:
```js
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
      .mockResolvedValueOnce({                                              // doc fetch
        rows: [{ id: 'doc-1', uploaded_by: 'driver-1', status: 'pending', load_id: 'load-1' }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'doc-1', status: 'uploaded' }] }) // update
      .mockResolvedValueOnce({ rows: [] })                                  // event insert

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
    expect(eventCall[1]).toEqual(expect.arrayContaining(['load-1', 'driver-1', 'pod_uploaded']))
  })

  test('confirming an already-uploaded document is a no-op (idempotent)', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'doc-1', uploaded_by: 'driver-1', status: 'uploaded', load_id: 'load-1' }],
    })

    const response = await request(app)
      .post('/loads/load-1/documents/doc-1/confirm')
      .set('Authorization', auth('driver'))
      .send({})

    expect(response.status).toBe(200)
    expect(response.body.document.status).toBe('uploaded')
    expect(pool.query).toHaveBeenCalledTimes(1) // no UPDATE, no event
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend && npm test -- __tests__/documents.test.js
```

Expected: 4 new failures.

- [ ] **Step 3: Implement the endpoint**

In `backend/routes/documents.js`, add this route handler before `module.exports`:

```js
router.post('/:doc_id/confirm', authorize(['driver']), async (req, res) => {
  try {
    const docResult = await pool.query(
      'SELECT * FROM load_documents WHERE id = $1 AND load_id = $2',
      [req.params.doc_id, req.params.id]
    )
    const doc = docResult.rows[0]

    if (!doc) return res.status(404).json({ error: 'Document not found' })
    if (doc.uploaded_by !== req.user.user_id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    if (doc.status === 'uploaded') {
      return res.json({ document: doc })
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
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend && npm test -- __tests__/documents.test.js
```

Expected: 10 tests pass total in this file.

- [ ] **Step 5: Commit**

```bash
git add backend/routes/documents.js backend/__tests__/documents.test.js
git commit -m "feat(backend): POST /confirm endpoint flips pending->uploaded and emits event"
```

---

## Task 8: GET `/documents` endpoint (TDD)

**Files:**
- Modify: `backend/routes/documents.js`
- Modify: `backend/__tests__/documents.test.js`

- [ ] **Step 1: Add failing tests**

Append to `backend/__tests__/documents.test.js`:
```js
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

  test('only uploaded documents are returned (pending excluded)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [assignedLoad()] })
      .mockResolvedValueOnce({ rows: [] }) // SQL filters status='uploaded' so empty result is fine

    await request(app)
      .get('/loads/load-1/documents')
      .set('Authorization', auth('shipper'))

    const docsQuery = pool.query.mock.calls[1][0]
    expect(docsQuery).toMatch(/status = 'uploaded'/)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend && npm test -- __tests__/documents.test.js
```

Expected: 4 new failures.

- [ ] **Step 3: Implement the endpoint**

In `backend/routes/documents.js`, add before `module.exports`:

```js
router.get('/', async (req, res) => {
  try {
    const load = await loadById(req.params.id)
    if (!load) return res.status(404).json({ error: 'Load not found' })

    const isShipperOwner = req.user.role === 'shipper' && load.shipper_id === req.user.user_id
    const isAssignedDriver = req.user.role === 'driver' && load.driver_id === req.user.user_id

    if (!isShipperOwner && !isAssignedDriver) {
      return res.status(403).json({ error: 'Forbidden' })
    }

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
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend && npm test -- __tests__/documents.test.js
```

Expected: 14 tests pass in this file.

- [ ] **Step 5: Run the full backend suite**

```bash
cd backend && npm test
```

Expected: 40 tests pass (26 existing + 6 s3 + 14 documents).

- [ ] **Step 6: Commit**

```bash
git add backend/routes/documents.js backend/__tests__/documents.test.js
git commit -m "feat(backend): GET /loads/:id/documents with presigned download URLs"
```

---

## Task 9: Frontend `PodUpload` component (TDD)

**Files:**
- Create: `frontend/src/components/PodUpload.jsx`
- Create: `frontend/src/__tests__/PodUpload.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/__tests__/PodUpload.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import PodUpload from '../components/PodUpload'

describe('PodUpload', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
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

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          document_id: 'doc-1',
          upload_url: 'https://s3.example/upload',
          s3_key: 'pod/l1/abc',
        }),
      })
      .mockResolvedValueOnce({ ok: true })  // S3 PUT
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ document: { id: 'doc-1', status: 'uploaded' } }),
      })

    render(<PodUpload load={{ id: 'l1', status: 'in_transit' }} token="t" onUploaded={onUploaded} />)

    const file = new File(['hello'], 'pod.jpg', { type: 'image/jpeg' })
    const input = screen.getByLabelText(/upload pod/i)
    await user.upload(input, file)

    await vi.waitFor(() => expect(onUploaded).toHaveBeenCalled())

    expect(global.fetch).toHaveBeenCalledTimes(3)
    expect(global.fetch.mock.calls[1][0]).toBe('https://s3.example/upload')
    expect(global.fetch.mock.calls[1][1].method).toBe('PUT')
  })

  test('shows error message when upload-url request fails', async () => {
    const user = userEvent.setup()
    global.fetch.mockResolvedValueOnce({
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && npm test -- src/__tests__/PodUpload.test.jsx
```

Expected: failure — module not found.

- [ ] **Step 3: Implement the component**

Create `frontend/src/components/PodUpload.jsx`:
```jsx
import { useRef, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const ELIGIBLE_STATUSES = ['in_transit', 'delivered']

export default function PodUpload({ load, token, onUploaded }) {
  const inputRef = useRef(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!ELIGIBLE_STATUSES.includes(load.status)) return null

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')
    setBusy(true)

    try {
      const presignRes = await fetch(`${API_BASE}/loads/${load.id}/documents/pod-upload-url`, {
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

      const presignText = await presignRes.text()
      const presign = presignText ? JSON.parse(presignText) : {}
      if (!presignRes.ok) throw new Error(presign.error || 'Could not get upload URL')

      const putRes = await fetch(presign.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!putRes.ok) throw new Error('S3 upload failed')

      const confirmRes = await fetch(
        `${API_BASE}/loads/${load.id}/documents/${presign.document_id}/confirm`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      )
      if (!confirmRes.ok) throw new Error('Confirm step failed')

      onUploaded?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="pod-upload">
      <label className="primary-action" htmlFor="pod-upload-input">
        {busy ? 'Uploading...' : 'Upload POD'}
      </label>
      <input
        id="pod-upload-input"
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        onChange={handleFileChange}
        disabled={busy}
        style={{ display: 'none' }}
      />
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd frontend && npm test -- src/__tests__/PodUpload.test.jsx
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PodUpload.jsx frontend/src/__tests__/PodUpload.test.jsx
git commit -m "feat(frontend): PodUpload component with three-step upload flow"
```

---

## Task 10: Frontend `DocumentList` component (TDD)

**Files:**
- Create: `frontend/src/components/DocumentList.jsx`
- Create: `frontend/src/__tests__/DocumentList.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/__tests__/DocumentList.test.jsx`:
```jsx
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
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend && npm test -- src/__tests__/DocumentList.test.jsx
```

Expected: failure — module not found.

- [ ] **Step 3: Implement the component**

Create `frontend/src/components/DocumentList.jsx`:
```jsx
function isImage(contentType) {
  return contentType === 'image/jpeg' || contentType === 'image/png'
}

export default function DocumentList({ documents }) {
  if (!documents || documents.length === 0) {
    return <p className="empty-state">No documents uploaded yet.</p>
  }

  return (
    <div className="document-list">
      {documents.map((doc) => (
        <div className="document-item" key={doc.id}>
          {isImage(doc.content_type) ? (
            <img src={doc.download_url} alt={`${doc.kind.toUpperCase()} document`} />
          ) : (
            <a href={doc.download_url} target="_blank" rel="noreferrer">
              Open PDF
            </a>
          )}
          <span className="document-meta">
            {doc.kind.toUpperCase()} · {new Date(doc.uploaded_at).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd frontend && npm test -- src/__tests__/DocumentList.test.jsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/DocumentList.jsx frontend/src/__tests__/DocumentList.test.jsx
git commit -m "feat(frontend): DocumentList component for shipper-side POD viewing"
```

---

## Task 11: Wire `PodUpload` and `DocumentList` into `DetailPanel`

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Import the components**

At the top of `frontend/src/App.jsx`, add:
```js
import PodUpload from './components/PodUpload'
import DocumentList from './components/DocumentList'
```

- [ ] **Step 2: Add documents state to `App`**

In the `App` component (around line 690), add a new state hook with the others:
```js
const [documents, setDocuments] = useState([])
```

- [ ] **Step 3: Fetch documents when a load is selected**

Add a new `useEffect` near the existing pings-loading effect (around line 838):
```js
useEffect(() => {
  if (!token || !selectedLoadId) return

  let ignore = false

  async function loadDocuments() {
    try {
      const data = await apiRequest(`/loads/${selectedLoadId}/documents`, { token })
      if (!ignore) setDocuments(data.documents)
    } catch {
      if (!ignore) setDocuments([])
    }
  }

  loadDocuments()
  return () => {
    ignore = true
  }
}, [token, selectedLoadId])
```

- [ ] **Step 4: Pass `documents` and an `onUploaded` callback into `DetailPanel`**

Find where `<DetailPanel ... />` is rendered (around line 1078). Update it to:
```jsx
<DetailPanel
  key={selectedLoad?.id || 'empty'}
  user={user}
  token={token}
  load={selectedLoad}
  events={events}
  pings={pings}
  documents={documents}
  onChanged={reloadAndEvents}
  onDocumentsChanged={async () => {
    if (!selectedLoadId) return
    try {
      const data = await apiRequest(`/loads/${selectedLoadId}/documents`, { token })
      setDocuments(data.documents)
    } catch {
      setDocuments([])
    }
  }}
/>
```

- [ ] **Step 5: Update `DetailPanel` to use the new props**

In the `DetailPanel` function signature (around line 578), update:
```jsx
function DetailPanel({ user, token, load, events, pings, documents, onChanged, onDocumentsChanged }) {
```

Inside `DetailPanel`, after the existing `<div>` with `eyebrow="GPS pings"`, add:
```jsx
<div>
  <p className="eyebrow">Documents</p>
  {user?.role === 'driver' && (
    <PodUpload load={load} token={token} onUploaded={onDocumentsChanged} />
  )}
  <DocumentList documents={documents} />
</div>
```

- [ ] **Step 6: Run the full frontend test suite**

```bash
cd frontend && npm test
```

Expected: 19 tests pass (12 from Phase 3 + 7 from Phase 4).

- [ ] **Step 7: Verify the build still works**

```bash
cd frontend && npm run build
```

Expected: clean build.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat(frontend): integrate PodUpload and DocumentList into DetailPanel

Driver sees the upload button on in_transit/delivered loads;
shipper sees the document list. Documents reload when the user
selects a different load and after a successful upload."
```

---

## Task 12: Update README with new endpoints + env vars

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the API surface section**

In `README.md`, find the `## API Surface` section and add:
```
- `POST /loads/:id/documents/pod-upload-url`, `POST /loads/:id/documents/:doc_id/confirm`, `GET /loads/:id/documents`
```

- [ ] **Step 2: Add an environment-variables note**

Under the **Local Setup → Backend** subsection, add:
```
The backend reads AWS credentials and bucket name from `.env`. See `.env.example` — the four `AWS_*` keys are required for proof-of-delivery uploads.
```

- [ ] **Step 3: Update the "What I Would Build Next at Scale" section to reflect that POD uploads now exist**

Find the bullet that mentioned POD uploads and remove it (it ships now), or rewrite it as the spec suggests:
```
- **POD uploads are stored in S3 but not virus-scanned.** For prod I'd run a `s3:ObjectCreated` Lambda that hands the object to ClamAV before flipping the document `status` to `clean`.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add POD upload endpoints and AWS env vars to README"
```

---

## Task 13: Deploy and end-to-end verify

**Files:** None (deploy + manual test)

- [ ] **Step 1: Set Railway env vars**

In the Railway dashboard for the Freightline-App service, add the four new variables:
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Save and let the service redeploy.

- [ ] **Step 2: Apply migrations to the deployed Postgres**

```bash
railway run psql -d $DB_NAME -f backend/db/migrations/005_create_load_documents.sql
railway run psql -d $DB_NAME -f backend/db/migrations/006_extend_load_events_pod_uploaded.sql
```

(Adjust based on how Railway exposes the Postgres connection — may need `psql $DATABASE_URL -f ...` instead.)

- [ ] **Step 3: Push and let CI run**

```bash
git push origin main
```

Watch CI: https://github.com/jordan-umpierre/Freightline-App/actions. Both jobs must pass.

- [ ] **Step 4: Manual end-to-end test on the deployed app**

In the browser, on https://freightline-app.vercel.app:
1. Log in as `demo.shipper@freightline.local`, post a load on the Chicago→Atlanta lane
2. Log out, log in as `demo.driver@freightline.local`, register a truck if none exists
3. Click **Accept** on the new load, then **Start** to flip it to `in_transit`
4. Click **Upload POD**, pick a JPEG under 10 MB, wait for "Uploading..." to clear
5. The document should appear in the documents subsection of the load detail
6. Log out, log in as the shipper, select the same load — the POD image should render in the shipper's documents subsection

- [ ] **Step 5: Verify a rejection case**

Try uploading a `.gif` or a >10 MB file as the driver. Expected: the upload-url request returns 400 and the error message renders in the upload component.

- [ ] **Step 6: Re-take the live-tracking screenshot if it's missing the POD**

If you want screenshot 03 to also show the documents subsection, re-capture and replace `docs/screenshots/03-live-tracking.png` (then commit the updated PNG).

---

## Acceptance criteria (from spec)

- [x] Driver on in_transit/delivered load can upload a JPEG/PNG/PDF up to 10 MB and see it appear — Tasks 9, 11, 13
- [x] Shipper sees the document with a working preview/download link — Tasks 10, 11, 13
- [x] Direct API uploads of binary content are not possible — by design (no API endpoint accepts file bodies)
- [x] S3 bucket is private; reads via short-lived presigned GET URLs — Task 1 + Task 5
- [x] Server-side validates content_type allow-list and size_bytes ceiling — Task 5 + Task 6
- [x] New backend tests cover driver-only upload-url, content-type rejection, shipper read, unrelated-shipper rejection — Tasks 6–8

---

## Notes for the executor

- This phase will likely take longer than the estimate — AWS console clicking, IAM debugging, and CORS hiccups eat real time. Budget 3–5 evenings.
- If the S3 PUT fails from the browser with a CORS error, the bucket CORS config is wrong — re-check Task 1 Step 2. The `AllowedOrigins` must match the Vercel host *exactly* (with `https://`).
- If presigned PUTs return 403, the IAM user policy doesn't cover the key prefix you're trying to write to. Verify the policy resource ARN matches `pod/*`.
- The end-to-end test (Task 13 Step 4) is the only true verification. Mocked unit tests can pass while the real integration breaks on a misconfigured AWS detail.
- Keep an eye on the AWS billing dashboard the first day — easy to misconfigure something into a billing surprise. The $5 alarm from Task 1 Step 5 is your safety net.
