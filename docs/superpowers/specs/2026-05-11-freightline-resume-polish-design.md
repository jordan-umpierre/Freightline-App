# Freightline Resume & Interview Polish

**Date:** 2026-05-11
**Goal:** Make Freightline ([repo](https://github.com/jordan-umpierre/Freightline-App), [demo](https://freightline-app.vercel.app)) resume- and interview-ready as a portfolio project for junior full-stack roles, with a domain-depth focus on freight logistics (target employers: Shamrock Trading Corp, Ryan Transportation, ProTransport).
**Effort:** ~1–2 weeks of focused evenings.
**Story:** *Domain depth (logistics).* The repo should read as "this person actually understands freight workflows," not "this person can wire up a CRUD app."

---

## Current State Audit (2026-05-11)

**What works:**
- Backend deployed: `https://freightline-app-production.up.railway.app` — `GET /` returns 200 OK
- Frontend deployed: `https://freightline-app.vercel.app` — returns 200 OK
- Demo seed data is reasonable: 2 loads (`Kansas City → Dallas` posted, `Chicago → Atlanta` in_transit)
- Demo credentials work: `demo.shipper@freightline.local` / `demo.driver@freightline.local` (password `secret123`)
- 26 backend tests exist (Jest + Supertest), 25 pass
- GitHub Actions CI runs lint + build + test on every push/PR
- Architecture is real: JWT auth, transaction-safe load lifecycle, MongoDB GPS ingestion, WebSocket live updates with off-route exception detection
- Mermaid architecture diagram in README

**Resume-blocking issues:**
- README has **no link to the live demo** despite both deployments being live
- `frontend/README.md` is the **default Vite boilerplate** ("React + Vite")
- **No screenshots / GIFs** in the README
- **No `LICENSE` file** despite `package.json` declaring ISC
- **1 backend test fails locally** (`drivers cannot create shipper loads`, timeout); suite takes ~293s — likely an open MongoDB or WebSocket handle preventing Jest from exiting
- Stray `frontend/src/index 2.css` (untracked macOS Finder dupe)
- Modified `CLAUDE.md` uncommitted in working tree
- **No frontend tests** despite the original plan and README mentioning React Testing Library
- App.jsx is 1092 lines — defendable in interview as a deliberate single-file SPA, **not** in scope to refactor

---

## Phase 1 — Repo hygiene + bug fixes

**Goal:** "Everything works as intended." Nothing here is a feature; it's all credibility.

### Acceptance criteria
- `cd backend && npm test` passes all 26 tests in under 5 seconds
- `cd frontend && npm run lint && npm run build` succeeds (already does)
- Latest CI run on `main` is green
- `git status` is clean
- `LICENSE` file exists at repo root

### Work items
1. **Fix the slow / failing test suite.** Run `npm test -- --detectOpenHandles --forceExit` to identify the leaking handle. Almost certainly one of:
   - `loads.test.js` requires `loads.js`, which requires `pingStore.js`, which requires `mongo.js` → real MongoDB connection attempt. Fix: add a global `jest.setup.js` (or per-file mock) that mocks `../db/mongo`.
   - `liveHub.test.js` `afterEach` may not be awaiting `wss.close` correctly. Verify the `done` callback fires.
2. **Delete `frontend/src/index 2.css`** (untracked Finder dupe).
3. **Resolve modified `CLAUDE.md`** — either commit the changes or `git restore`.
4. **Update `.gitignore`** to add `.DS_Store`, `*.local`, and a pattern that catches Finder dupes (`* [0-9].*`).
5. **Add `LICENSE`** at repo root (MIT) and change `package.json` `license` field from `"ISC"` to `"MIT"` to match.
6. **Verify CI is green** in the GitHub Actions tab. If red, that's part of the bug-fix scope above — don't move on until it's green.

### Out of scope
- Refactoring App.jsx into smaller files
- Migrating tests from mock-only to a real test database
- Adding ESLint/Prettier config beyond what exists

---

## Phase 2 — README & demo polish

**Goal:** Make the first 30 seconds of a recruiter's visit unambiguously good.

### Acceptance criteria
- A recruiter landing on the repo can click a working demo link without scrolling
- Three screenshots show the product without the recruiter needing to log in
- The "what I'd scale next" section reads as engineering judgement, not a backlog
- `frontend/README.md` is no longer Vite boilerplate

### Work items
1. **Live demo block at the top of `README.md`** (above the architecture diagram):
   ```
   🚛 Live demo: https://freightline-app.vercel.app
   API:        https://freightline-app-production.up.railway.app
   Sign in as  demo.shipper@freightline.local / secret123  (post & cancel loads)
   or          demo.driver@freightline.local / secret123   (register a truck, accept a load)
   ```
2. **Three screenshots** in `docs/screenshots/`, embedded in the README under the demo block:
   - `01-shipper-dashboard.png` — shipper view with map, posted loads, exception rail
   - `02-driver-accept.png` — driver view with available loads and Accept/Start buttons
   - `03-live-tracking.png` — in-transit load with GPS marker and an off-route exception
   - **Optional:** a 20-second `04-live-tracking.gif` of the simulator running
3. **"Try it in 90 seconds" walkthrough** under the screenshots — numbered steps for shipper and driver flows.
4. **Rewrite "What I Would Scale Next"** as defensible engineering judgement. Each bullet pairs the current limitation with the pattern that would replace it and the *why*. Example:
   > GPS pings hit the API directly today. At >100 trucks I'd move to a device-authenticated MQTT or Kafka path with the API as a downstream consumer, because direct HTTP creates a write-amplification problem on the API's event loop.
5. **Add one sentence under the architecture diagram** explaining the polyglot-persistence choice: "Postgres owns transactional freight records (foreign keys, ACID-guarded state transitions); MongoDB stores append-heavy GPS pings so live tracking scales independently of the relational workflow."
6. **Replace `frontend/README.md`** with a 5-line pointer to the top-level README, or delete the file.

### Out of scope
- Redesigning the dashboard UI
- Changing the architecture diagram beyond the one-sentence caption

---

## Phase 3 — Frontend tests (React Testing Library)

**Goal:** Close the "no frontend tests" gap. Three or four targeted tests beat thirty shallow ones.

### Acceptance criteria
- `cd frontend && npm test` runs and passes
- CI's frontend job runs frontend tests after lint, before build
- At least three tests covering role-based UI logic (the heart of the freight workflow)

### Work items
1. **Add Vitest setup:**
   - Install: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`
   - Add `"test": "vitest run"` to `frontend/package.json`
   - Add `vitest.config.js` (or extend `vite.config.js`) with `environment: 'jsdom'` and a `setupFiles` entry that imports `@testing-library/jest-dom`
2. **Update `.github/workflows/ci.yml`** frontend job: `npm run lint` → `npm test` → `npm run build`
3. **Tests** (in `frontend/src/__tests__/`):
   - `AuthScreen.test.jsx` — typing into login fields, mocking `fetch` to return 401, asserting the error renders
   - `LoadList.test.jsx` — given a load with `status: 'posted'` and a driver user, the row renders an "Accept" button; for a shipper user, no action button
   - `exceptionTone.test.js` — pure unit test of the helper: critical exception → warning color, no exceptions → success color. (Falls back from a `MapBoard` integration test if Leaflet's DOM is hard to assert against.)

### Out of scope
- E2E tests with Playwright/Cypress
- Snapshot tests
- Refactoring `App.jsx` to make components individually importable beyond what's needed for these tests

---

## Phase 4 — S3 proof-of-delivery uploads

**Goal:** Add the freight-literacy stretch feature. When a driver delivers a load, they upload a photo of the signed Bill of Lading (the "POD" = proof of delivery), the API hands them a short-lived presigned PUT URL, the photo goes directly to S3, and the shipper sees the document in the load timeline.

### Why this feature
Every freight engineer knows what BOL/POD means. Implementing it correctly (presigned URLs, server-side content-type validation, two-phase pending→uploaded row) demonstrates real domain literacy plus a defensible cloud pattern.

### Acceptance criteria
- A driver on an `in_transit` or `delivered` load can click "Upload POD," pick a JPEG/PNG/PDF up to 10 MB, and see it appear in the document list within a few seconds
- The shipper sees the document in the load detail panel with a working preview/download link
- Direct API uploads of binary content are not possible — files always go S3 directly via presigned URL
- S3 bucket is private; reads happen via short-lived presigned GET URLs
- Server-side validates `content_type` allow-list and `size_bytes` ceiling — the bucket policy alone is not the security boundary
- New backend tests cover: driver-only upload-url endpoint, content-type rejection, shipper read access, unrelated-shipper rejection

### Backend changes
1. **Migration** `005_create_load_documents.sql`:
   ```sql
   CREATE TABLE load_documents (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     load_id UUID NOT NULL REFERENCES loads(id) ON DELETE CASCADE,
     uploaded_by UUID NOT NULL REFERENCES users(id),
     kind VARCHAR(20) NOT NULL CHECK (kind IN ('pod', 'bol')),
     s3_bucket TEXT NOT NULL,
     s3_key TEXT NOT NULL,
     content_type VARCHAR(100) NOT NULL,
     size_bytes INTEGER NOT NULL,
     status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'uploaded')),
     created_at TIMESTAMP DEFAULT NOW(),
     uploaded_at TIMESTAMP
   );
   CREATE INDEX idx_load_documents_load_id ON load_documents(load_id);
   ```
2. **New service `services/s3.js`** wrapping `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`:
   - `presignPodUpload({ load_id, content_type, size_bytes })` — returns `{ upload_url, s3_key }`. PUT URL expires in 5 minutes. Validates content-type allow-list (`image/jpeg`, `image/png`, `application/pdf`) and size ≤ 10 MB.
   - `presignDocumentDownload({ s3_key })` — returns a GET URL expiring in 15 minutes.
3. **New routes** mounted on the existing `loadsRouter`:
   - `POST /loads/:id/documents/pod-upload-url` — driver-only, must be the assigned driver, load must be `in_transit` or `delivered`. Inserts a `pending` row, returns `{ upload_url, document_id, s3_key }`.
   - `POST /loads/:id/documents/:doc_id/confirm` — driver-only. Flips the row to `uploaded`, sets `uploaded_at`. Inserts a `pod_uploaded` event into `load_events`.
   - `GET /loads/:id/documents` — shipper-owner or assigned-driver. Returns documents with presigned download URLs.
4. **`load_events`** — extend the `event_type` CHECK constraint to include `pod_uploaded` (migration `006_extend_load_events.sql`).

### Frontend changes
- **Driver `DetailPanel`** gains an "Upload POD" button when status is `in_transit` or `delivered`. Click → file input → POST to upload-url endpoint → `fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })` → POST to confirm endpoint → re-fetch documents.
- **Shipper `DetailPanel`** gains a "Documents" subsection: thumbnails for images (using the presigned GET URL), a download link for PDFs.
- A new test in Phase 3's RTL suite covering the role-based document UI.

### Infra setup
- New S3 bucket `freightline-pod-dev` (or per-environment). CORS allows PUT from the Vercel domain only. Public access blocked.
- IAM user with **least-privilege**: only `s3:PutObject` and `s3:GetObject` scoped to the bucket prefix.
- New env vars in `.env.example` and Railway: `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.
- Set an AWS billing alarm at $5 as a safety net.

### Out of scope (deliberately)
- BOL upload at pickup time — symmetric pattern to POD, no new learning
- Image thumbnailing or Lambda processing
- Virus scanning (mention as "what I'd add for prod" in the README)
- Automatic cleanup of orphaned `pending` documents (leave a TODO for a future cron)

### Defendable interview answers this gives you
- Why presigned URLs vs API proxying? Throughput, cost, and memory pressure — 10 MB photos shouldn't hit the Express event loop.
- Why are GET URLs presigned instead of a public bucket? Freight documents contain PII (signatures, addresses) and shipper rate information.
- Why a server-side content-type allow-list when the bucket policy could enforce it? Defense in depth — the bucket policy is a fallback, not the security boundary.
- Why the two-phase `pending → uploaded` row? Handles the case where the client crashes between the PUT and the confirm call; orphaned `pending` rows are sweepable.

---

## Phase 5 — Resume bullets + interview talking points

**Goal:** Produce the actual deliverable — defensible resume copy and interview prep notes.

### Acceptance criteria
- Two finalized resume bullets (one if user prefers tighter copy)
- An `docs/interview-prep.md` file (committed but not advertised in the README — for personal use)
- Bullets only claim things that exist in the merged codebase

### Resume bullets (draft, finalize after Phase 4 ships)

> **Built and deployed Freightline** ([freightline-app.vercel.app](https://freightline-app.vercel.app)), a full-stack freight operations platform modeled on Ryan/Shamrock-style logistics workflows: **React (Vite) + Node/Express + Postgres + MongoDB + AWS S3 + WebSockets**, with role-based JWT auth, vehicle eligibility checks (capacity + oversized), transaction-safe `posted → assigned → in_transit → delivered` load lifecycle, S3 presigned proof-of-delivery uploads, and live GPS tracking with WebSocket-pushed off-route exception alerts.

> **Used polyglot persistence to separate two distinct write patterns** — Postgres for transactional freight records (foreign keys, ACID-guarded state transitions) and MongoDB for append-heavy GPS pings (high write throughput with index-only reads) — verified end-to-end with a Jest/Supertest backend suite, React Testing Library frontend suite, and GitHub Actions CI on every push.

**One-bullet alternative** (if the resume is space-constrained): drop bullet 2 and append "verified by Jest + RTL test suites and GitHub Actions CI" to bullet 1.

### `docs/interview-prep.md` (sketch)
Sections to write:
- **Why two databases?** Throughput and pattern mismatch for GPS — sequential writes, time-series reads, no relations to maintain.
- **Why JWT not sessions?** Stateless API survives Railway restarts and would survive horizontal scaling without sticky sessions.
- **Why presigned URLs not API proxy?** Bandwidth, cost, memory pressure on Express.
- **Why server-side content-type allow-list?** Bucket policy is defense in depth, not the security boundary.
- **Why driver-as-carrier in v1?** Deliberate simplification; the README's "what I'd scale next" calls out the carrier/company entity split.
- **Weakest parts of the system** (volunteer these unprompted — reads as senior):
  - No rate limiting on auth endpoints
  - Mock-only test coverage means I haven't caught a Postgres-specific bug in the test suite
  - GPS ingestion is single-API-server — would move to a queue at scale
- **Demo failure modes to be ready for:**
  - Cold-start latency on Railway free tier
  - OpenStreetMap tile loading can be slow
  - Live tracking only looks interesting if `npm run simulate:pings` is running

### Out of scope
- A separate "blog post about the project" — out of effort budget
- Recording a video walkthrough — optional, not blocking

---

## Sequencing & deliverable shape

This spec intentionally bundles five phases under one design document because they share a single goal (resume readiness). For implementation, each phase should become its **own plan** (and own commit/PR), so the git log itself shows clean progress for an interviewer. Suggested order:
1. **Phase 1** (repo hygiene) — half a day, unblocks everything else
2. **Phase 2** (README + demo polish) — one evening; can be done before Phase 4 lands using current screenshots
3. **Phase 3** (frontend tests) — one evening
4. **Phase 4** (S3 POD) — bulk of the budget, ~3–5 evenings depending on AWS familiarity
5. **Phase 5** (resume bullets + interview prep) — final evening, after Phase 4 merges

---

## Risks & open questions

- **Railway free tier cold starts** can make the demo feel slow on first request. If this is bad, mention "first request takes ~10s as the API warms up" in the README's demo block.
- **MongoDB hosting on Railway** — confirm what's deployed; if MongoDB isn't actually deployed, live tracking only works locally and the README needs to caveat the demo flow.
- **AWS account** — assumes the user has or will create an AWS account for Phase 4. If not, that's a prerequisite step.
- **Demo data drift** — over time the demo loads will accumulate state from anyone who logs in. A "reset demo data" cron or a button on the demo accounts is *out of scope* for this spec but worth noting for a future polish pass.
