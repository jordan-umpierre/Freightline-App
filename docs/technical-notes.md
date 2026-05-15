# Interview Prep - Freightline

Personal cheat sheet for interviews where Freightline comes up. This file is committed for your prep, but it is intentionally not linked from the public README.

**Maintainer:** Jordan Umpierre
**Last verified:** 2026-05-12

---

## 90-Second Walkthrough

Freightline is a freight operations platform modeled on Ryan/ProTransport-style logistics workflows. Shippers post loads, drivers register trucks, and the backend enforces constraints a real broker would care about: vehicle capacity, oversized freight eligibility, role-based permissions, and legal load status transitions.

The live dashboard shows posted and active freight on a map. Drivers can accept eligible loads, move them from `assigned` to `in_transit` to `delivered`, send GPS pings, and upload proof-of-delivery documents directly to AWS S3 through presigned URLs. Shippers see live GPS updates, off-route exceptions, load timelines, and uploaded POD documents through signed download links.

The stack is React/Vite on the frontend, Node/Express on the backend, Postgres for transactional freight records, MongoDB for GPS pings, WebSockets for live tracking, AWS S3 for POD storage, Railway for the API, Vercel for the frontend, and GitHub Actions for CI.

## Why Two Databases?

Postgres owns the transactional workflow: users, vehicles, loads, status transitions, and audit events. Foreign keys and transactions matter when accepting a load because the app updates both the load and the vehicle inside one transaction.

MongoDB owns GPS pings because those are append-heavy, time-series-shaped writes. A ping does not need a relational join at write time; it needs fast inserts and indexed reads by `load_id` or `driver_id` over time. The tradeoff is operational complexity: two databases, two SDKs, and two failure modes. For a small production team, Postgres with TimescaleDB or table partitioning could be a reasonable alternative.

## Why JWT?

JWT keeps the API stateless. Railway can restart or scale the API without sticky sessions or shared session storage. The tradeoff is revocation: a stolen access token remains valid until expiry. For a production freight app, add refresh-token rotation, a server-side revocation list, and tighter token lifetimes.

## Why Presigned S3 Uploads?

POD images and PDFs can be several megabytes. Proxying those uploads through Express would waste API bandwidth and memory. Presigned URLs let the browser upload directly to S3 while the backend still makes the authorization decision: this driver, this load, this content type, this max size.

The backend uses a two-step flow:

1. Driver asks the API for a presigned upload URL.
2. API validates role, load assignment, load status, content type, and file size.
3. API creates a `pending` `load_documents` row.
4. Browser uploads directly to S3.
5. Driver confirms the upload.
6. API flips the row to `uploaded` and emits a `pod_uploaded` event.

That `pending -> uploaded` pattern gives you a reconciliation point if the browser crashes after uploading to S3 but before confirming.

## Why Validate Content Type and Size in the API?

Defense in depth. S3/IAM should restrict where the object can be written, but the app still validates `image/jpeg`, `image/png`, and `application/pdf` plus a 10 MB size cap before it creates a presigned URL. Postgres also has a `size_bytes` CHECK constraint so a future route bug cannot silently persist oversized metadata.

## What Was Hardest?

The hardest tradeoff was the storage split. One database would be simpler to operate, and a single Postgres deployment might be the right answer for an early real business. I used MongoDB for GPS pings because the write pattern is meaningfully different from the freight workflow: frequent append-only location records, indexed by time and load, with no need to join on every write.

The next hardest part was keeping the demo credible. A broken live link or stale README would hurt more than a missing feature, so the project now has CI, screenshots, working demo credentials, production S3 uploads, and a README that names the known scale gaps instead of hiding them.

## Weak Points To Volunteer

- No auth rate limiting yet. Add `express-rate-limit` to `/auth/login` and `/auth/register`.
- Backend tests mock Postgres instead of running against a real test database. A CI job with disposable Postgres would catch SQL-specific regressions.
- GPS pings currently hit the API directly. At larger scale, move ingestion behind SQS, Kafka, MQTT, or a dedicated device-ingestion service.
- POD uploads are not virus-scanned. A production version should trigger an S3 object-created scan before exposing a document as clean.
- Driver and carrier are collapsed into one role in V1. A real broker would model carrier companies, multiple drivers, insurance, billing, and permissions separately.

## How To Scale It

- Move GPS ingestion behind a queue or broker so reconnect storms do not hammer Express directly.
- Batch GPS writes and process exception detection asynchronously.
- Add Postgres read replicas for dashboard-heavy read traffic.
- Introduce carrier/company tables and permission overlays for broker-grade multi-user accounts.
- Add malware scanning and lifecycle policies for S3 documents.
- Add observability: structured logs, request IDs, latency metrics, and alerting around failed uploads and stale tracking.

## Demo Notes

- Railway can cold-start; hit the API URL before the interview.
- Vercel frontend URL: `https://freightline-app.vercel.app`
- API URL: `https://freightline-app-production.up.railway.app`
- Demo shipper: `demo.shipper@freightline.local` / `secret123`
- Demo driver: `demo.driver@freightline.local` / `secret123`
- For a live off-route demo, run:

```bash
cd backend
API_URL=https://freightline-app-production.up.railway.app npm run simulate:pings -- --off-route
```

## Key File Paths

- JWT auth and role middleware: `backend/middleware/auth.js:5`, `backend/middleware/auth.js:33`
- Vehicle capacity and oversized eligibility checks: `backend/routes/loads.js:395`, `backend/routes/loads.js:398`
- Transaction-safe load assignment: `backend/routes/loads.js:368`
- Load status state guard: `backend/routes/loads.js:441`
- GPS ping insert and WebSocket broadcast: `backend/routes/loads.js:237`, `backend/routes/loads.js:252`
- Off-route exception detection: `backend/services/geo.js:69`, `backend/services/geo.js:99`
- WebSocket auth and event fanout: `backend/services/liveHub.js:62`, `backend/services/liveHub.js:43`
- Mongo GPS ping indexes: `backend/services/pingStore.js:37`
- S3 presigning and validation: `backend/services/s3.js:34`
- POD document authorization and pending row insert: `backend/routes/documents.js:64`, `backend/routes/documents.js:88`
- POD confirm and `pod_uploaded` event: `backend/routes/documents.js:116`, `backend/routes/documents.js:137`
- POD upload UI: `frontend/src/components/PodUpload.jsx:32`, `frontend/src/components/PodUpload.jsx:45`, `frontend/src/components/PodUpload.jsx:54`

## Three Questions To Practice Out Loud

1. "Why did you use both Postgres and MongoDB?"
2. "Why does the browser upload directly to S3 instead of to your API?"
3. "What is the first thing you would improve before real production use?"

Good answers should sound like tradeoff analysis, not memorized buzzwords.
