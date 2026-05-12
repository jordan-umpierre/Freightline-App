# Phase 5 — Resume Bullets & Interview Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the actual deliverable — two finalized resume bullets the user can paste into their resume, and a `docs/interview-prep.md` cheat sheet for personal use during interview prep. Bullets only claim things that exist in the merged codebase.

**Architecture:** Pure documentation. No code. Most of the work is *verification* — confirming each claim in the bullets is true of the current repo before locking in the wording.

**Tech Stack:** Markdown, the deployed live demo, the spec.

**Spec reference:** `docs/superpowers/specs/2026-05-11-freightline-resume-polish-design.md` Phase 5.

**Prerequisite:** Phases 1, 2, 3, 4 plans complete. The deployed app should be in its final form before this phase starts.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `docs/interview-prep.md` | Create | Personal cheat sheet — answers to likely interview questions about this project. Committed to repo but not advertised in the README. |
| `docs/resume-bullets.md` | Create | The two finalized bullets in plain text, ready to paste into a resume. Committed for record-keeping. |

---

## Task 1: Verify every claim in the draft bullets

Before locking in wording, walk through each bullet and confirm the claim exists in the repo. Anything that doesn't survive verification gets cut.

**Files:** None (verification only)

- [ ] **Step 1: Verify "deployed"**

Run:
```bash
curl -s -o /dev/null -w "Frontend: %{http_code}\n" https://freightline-app.vercel.app
curl -s -o /dev/null -w "Backend:  %{http_code}\n" https://freightline-app-production.up.railway.app
```

Expected: both `200`. If either is non-200, fix the deployment before continuing.

- [ ] **Step 2: Verify "React (Vite) + Node/Express + Postgres + MongoDB + AWS S3 + WebSockets"**

Spot-check `frontend/package.json` (react, vite), `backend/package.json` (express, pg, mongodb, ws, @aws-sdk/client-s3). All six should be present.

- [ ] **Step 3: Verify "role-based JWT auth, vehicle eligibility checks, transaction-safe load lifecycle"**

Spot-check `backend/middleware/auth.js` (JWT + authorize), `backend/routes/loads.js` (vehicle capacity + oversized check on assign, status transition guards). All present.

- [ ] **Step 4: Verify "S3 presigned proof-of-delivery uploads"**

Confirm Phase 4 has shipped:
```bash
ls backend/services/s3.js backend/routes/documents.js frontend/src/components/PodUpload.jsx
```
Expected: all three files exist. If any are missing, finish Phase 4 first.

End-to-end test on the live demo:
1. Log in as driver, upload a POD on an in_transit load
2. Log in as shipper, see the document
3. If this works, the bullet's POD claim is defensible

- [ ] **Step 5: Verify "live GPS tracking with WebSocket-pushed off-route exception alerts"**

Run the simulator locally (`cd backend && npm run simulate:pings -- --off-route`) against either local or deployed backend. Confirm: WebSocket connects, marker turns warning color, exception rail populates.

- [ ] **Step 6: Verify "Jest/Supertest backend suite, React Testing Library frontend suite, GitHub Actions CI"**

Run:
```bash
(cd backend && npm test) && (cd frontend && npm test)
```
Expected: both pass. Total tests should be ~40 backend + ~19 frontend.

Check the latest CI run is green.

- [ ] **Step 7: Verify "polyglot persistence" framing**

Skim `backend/db/schema.sql` (relational tables with foreign keys) and `backend/services/pingStore.js` (Mongo, time-series-style append). The Postgres-vs-Mongo split is real.

If any verification fails, **either fix the gap or strike that phrase from the bullet.** Don't ship a bullet you can't defend.

---

## Task 2: Finalize the resume bullets

**Files:**
- Create: `docs/resume-bullets.md`

- [ ] **Step 1: Create `docs/resume-bullets.md`**

```markdown
# Resume bullets — Freightline

These are the canonical bullets for the Freightline portfolio project. Update them here whenever the project gains/loses a feature so the resume copy stays in sync.

**Last updated:** [TODAY'S DATE]
**Last verified against repo:** [TODAY'S DATE]

---

## Two-bullet form (preferred)

> **Built and deployed Freightline** ([freightline-app.vercel.app](https://freightline-app.vercel.app)), a full-stack freight operations platform modeled on Ryan/Shamrock-style logistics workflows: **React (Vite) + Node/Express + Postgres + MongoDB + AWS S3 + WebSockets**, with role-based JWT auth, vehicle eligibility checks (capacity + oversized), transaction-safe `posted → assigned → in_transit → delivered` load lifecycle, S3 presigned proof-of-delivery uploads, and live GPS tracking with WebSocket-pushed off-route exception alerts.

> **Used polyglot persistence to separate two distinct write patterns** — Postgres for transactional freight records (foreign keys, ACID-guarded state transitions) and MongoDB for append-heavy GPS pings (high write throughput with index-only reads) — verified end-to-end with a Jest/Supertest backend suite, React Testing Library frontend suite, and GitHub Actions CI on every push.

## One-bullet form (space-constrained)

> **Built and deployed Freightline** ([freightline-app.vercel.app](https://freightline-app.vercel.app)), a full-stack freight operations platform modeled on Ryan/Shamrock-style logistics workflows: **React (Vite) + Node/Express + Postgres + MongoDB + AWS S3 + WebSockets**, with role-based JWT auth, vehicle eligibility checks, transaction-safe load lifecycle, S3 presigned proof-of-delivery uploads, and live GPS tracking with off-route exception detection — verified by Jest + RTL test suites and GitHub Actions CI.

## Plain-text version (for ATS systems that strip formatting)

Built and deployed Freightline (freightline-app.vercel.app), a full-stack freight operations platform modeled on Ryan/Shamrock-style logistics workflows: React (Vite), Node/Express, Postgres, MongoDB, AWS S3, and WebSockets, with role-based JWT auth, vehicle eligibility checks, transaction-safe posted-to-assigned-to-in-transit-to-delivered load lifecycle, S3 presigned proof-of-delivery uploads, and live GPS tracking with WebSocket-pushed off-route exception alerts.

Used polyglot persistence to separate two distinct write patterns: Postgres for transactional freight records (foreign keys, ACID-guarded state transitions) and MongoDB for append-heavy GPS pings (high write throughput with index-only reads), verified end-to-end with a Jest/Supertest backend suite, React Testing Library frontend suite, and GitHub Actions CI on every push.

---

## Notes on word choice

- **"Built and deployed"** — past tense + the live link makes it falsifiable. Recruiters can click.
- **"modeled on Ryan/Shamrock-style"** — names the target employer's brand-family without claiming affiliation.
- **"polyglot persistence"** — actual term-of-art; a senior engineer reading this knows immediately what it means and that you understand why it matters.
- **"role-based JWT auth"** — the standard phrase; reads as "I implemented this correctly" rather than "I read about it."
- **"transaction-safe `posted → assigned → in_transit → delivered`"** — names the state machine explicitly; the arrow notation works in markdown and most ATS systems.
- **"WebSocket-pushed"** as a compound adjective — keeps "off-route exception alerts" as the noun, which reads better than "off-route exception alerts via WebSockets."

## What's deliberately *not* in the bullets

- **Specific test counts** ("40+ backend tests") — flaky number to commit to; "Jest/Supertest backend suite" is enough.
- **AWS Lambda / queue** — these don't exist. The "scale next" section in the README covers what you'd add.
- **Specific load volumes / users** — fake numbers; better to leave them out than to invent them.
- **Auth security details** beyond "JWT" — bcrypt cost factor, token TTL, refresh token logic. Save for interview.
```

Replace `[TODAY'S DATE]` with the actual date.

- [ ] **Step 2: Commit**

```bash
git add docs/resume-bullets.md
git commit -m "docs: finalize Freightline resume bullets and ATS-safe variants"
```

---

## Task 3: Write `docs/interview-prep.md`

**Files:**
- Create: `docs/interview-prep.md`

- [ ] **Step 1: Create the file**

```markdown
# Interview Prep — Freightline

Personal cheat sheet for interviews where Freightline comes up. Covers likely questions, defensible answers, and known weak points to volunteer (volunteering weakness reads as senior).

**Maintainer:** Jordan Umpierre
**Not advertised in the public README** — this file is for personal use.

---

## "Walk me through this project"

90-second elevator pitch:

> Freightline is a freight operations platform modeled on Ryan/ProTransport-style workflows. Shippers post loads, drivers register trucks, and the system enforces things a real broker cares about — vehicle capacity vs load weight, oversized constraints, status transitions only happening in legal directions. There's a live operations dashboard with a map of active freight, GPS tracking pushed over WebSockets, an off-route exception detector, and S3 proof-of-delivery uploads. Backend is Node/Express on top of Postgres for the transactional records and MongoDB for the high-volume GPS pings. Deployed on Railway and Vercel, with Jest + React Testing Library suites in CI.

## "Why two databases?"

> Postgres handles the transactional freight workflow — users, vehicles, loads, the state machine. Foreign keys and ACID transactions matter when you're moving a load from `assigned` to `in_transit` because you also need to mark the vehicle as `in_transit` atomically. MongoDB handles GPS pings — high-write, append-only, time-series-shaped, no relations to maintain. Trying to put 1 million pings/day into the same Postgres table would push hot rows around and contend with the freight workflow's locking. Different write patterns, different storage.

## "Why JWT instead of sessions?"

> Stateless. The API process can restart on Railway, or scale horizontally, without sticky-session config or shared session storage. The tradeoff is no instant logout — a stolen token is valid until expiry. For a real prod app I'd add a refresh-token rotation pattern and a server-side revocation list for the access tokens; here I traded that complexity for v1 simplicity.

## "Why presigned URLs for POD uploads instead of proxying through the API?"

> Three reasons. **Bandwidth** — a 10 MB photo doesn't need to flow through Express's event loop. **Cost** — Railway charges egress, S3 doesn't (within reason). **Memory** — Express buffers request bodies; a few concurrent uploads can OOM a small dyno. Presigned URLs let the file path go directly browser → S3, with the API only handling the auth decision (am I letting this driver upload to this load) and the metadata row.

## "Why a server-side content-type allow-list when the bucket policy could enforce it?"

> Defense in depth. The bucket policy is a fallback — if I screw it up, I want a second layer that catches the mistake. Same reason I have a `CHECK` constraint in Postgres on `size_bytes` even though the API rejects oversized requests: the constraint catches a future bug where someone forgets to validate.

## "Why a two-phase pending → uploaded row?"

> Handles the case where the client crashes between the PUT to S3 and the confirm callback. The S3 object exists but the API doesn't know about it yet — the row stays `pending`. A future cron sweeps `pending` rows older than an hour. Without the two-phase pattern, you either trust the client to call back (it might not) or you scan S3 to reconcile (expensive).

## "Why driver-as-carrier in v1?"

> Deliberate simplification. A real freight broker has carriers (the company), each with multiple drivers and vehicles, plus separate billing/insurance. Modeling that properly is a `carriers` table, a `users.carrier_id` foreign key, and a permission overlay on the existing role system — about a day of schema work and a multi-week UX change. For v1 I called this out in the README's "what I'd build at scale" section so it's a known tradeoff, not an oversight.

## "What's the weakest part of the system?"

(Volunteer this unprompted — it's a strong move.)

> A few. **No rate limiting on auth endpoints** — bcrypt is slow, so a brute-force attempt would take a while, but I should add `express-rate-limit` on `/auth/login` and `/auth/register`. **Mock-only test coverage** — the unit tests mock Postgres, so I haven't caught a real Postgres-specific bug like a missing index causing slow queries; an integration test against a real database in CI would catch those. **GPS ingestion is single-API-server** — at >100 trucks I'd move it behind a queue (the README says this, but it's worth saying out loud).

## "What's the hardest tradeoff you made?"

> Actually the GPS storage decision. The "pure" answer is one database — Postgres with TimescaleDB or just a partitioned table. Going polyglot is operational overhead: two backups, two failure modes, two SDKs. I went polyglot because the GPS write pattern *really is* different from the freight workflow — sequential time-series writes that I never need to JOIN against loads or users — and the demo is more interesting when I can talk about polyglot persistence as a real choice rather than a learned-it-in-a-blog-post phrase. If this were a real ops team of 5 engineers, single-database might be the right call.

## "How would you scale this to 100x more loads?"

> Three things. **GPS pings move behind a queue** (Kafka or SQS) so reconnect storms don't hammer the API. The API becomes a consumer that batches inserts. **Read replicas on Postgres** for the read-heavy `/loads/live-state` endpoint. **CDN-fronted presigned downloads** so frequently-accessed PODs don't pay full S3 egress every time.

## "Demo failure modes to be ready for"

If interviewing live and demoing:

- **Railway free tier cold-starts** — first request can take ~10 seconds. The README warns about this; warn the interviewer too.
- **OpenStreetMap tiles can be slow** — they're free and unmetered but not always quick. Don't panic if the map loads progressively.
- **Live tracking only looks interesting if the simulator is running** — make sure `npm run simulate:pings` is going *before* you start screen-sharing.
- **The JWT expires in ~10 hours** — if the interview is right after lunch, log in fresh before the demo.

## Key file paths to know cold

If an interviewer asks "show me where X happens":

- **JWT auth middleware:** `backend/middleware/auth.js`
- **Vehicle eligibility check on assign:** `backend/routes/loads.js:395` (capacity + oversized)
- **State machine guard:** `backend/routes/loads.js:441` (`allowedNext` map)
- **GPS ping insert + WebSocket broadcast:** `backend/routes/loads.js:228`
- **Off-route exception logic:** `backend/services/geo.js`
- **WebSocket connection auth:** `backend/services/liveHub.js:62`
- **S3 presigning + validation:** `backend/services/s3.js`
- **POD upload UI:** `frontend/src/components/PodUpload.jsx`

## Key architectural decisions documented in commits

```
git log --oneline | grep -E "feat|refactor"
```

Skim before any interview — the commit log itself is part of the portfolio.
```

- [ ] **Step 2: Verify the file paths in the "Key file paths" section are still accurate**

Run from the repo root for each path mentioned:
```bash
ls backend/middleware/auth.js
ls backend/routes/loads.js
ls backend/services/geo.js
ls backend/services/liveHub.js
ls backend/services/s3.js
ls frontend/src/components/PodUpload.jsx
```

If any are missing, fix the path or remove the line.

For the line-number references in `loads.js`, run:
```bash
grep -n "capacity_lbs <" backend/routes/loads.js
grep -n "allowedNext" backend/routes/loads.js
grep -n "broadcastLoadPing" backend/routes/loads.js
```

Update the line numbers in `interview-prep.md` to match what `grep` actually finds.

- [ ] **Step 3: Commit**

```bash
git add docs/interview-prep.md
git commit -m "docs: add interview prep cheat sheet (personal use)"
```

---

## Task 4: Final readthrough

**Files:** None

- [ ] **Step 1: Read the README from a recruiter's perspective**

Open https://github.com/jordan-umpierre/Freightline-App in a browser. Pretend you have 30 seconds. Ask yourself:
- Do I want to click the demo link?
- Do the screenshots make me curious?
- Does the architecture diagram look intentional?

If anything feels weak, iterate before declaring done.

- [ ] **Step 2: Read the resume bullets aloud**

Say each bullet out loud. If you stumble or run out of breath mid-sentence, the bullet's too long — trim. The plain-text version in `docs/resume-bullets.md` is the safer fallback for ATS systems.

- [ ] **Step 3: Mock-run an interview question**

Pick three questions from `docs/interview-prep.md`. Answer them out loud, without reading the cheat sheet. If you can't, the doc isn't yet a memory aid — it's a script. Iterate on the wording until each answer is something you'd say naturally.

- [ ] **Step 4: Push**

```bash
git push origin main
```

---

## Acceptance criteria (from spec)

- [x] Two finalized resume bullets — Task 2
- [x] `docs/interview-prep.md` exists, committed, not advertised in README — Task 3
- [x] Bullets only claim things in the merged codebase — Task 1 verification gate

---

## Notes for the executor

- This phase is short on commands and long on judgment. Don't rush — the bullets here are the actual product of the whole 5-phase effort.
- If you find while writing the interview-prep doc that you can't actually defend a claim from the bullets (e.g., "I don't really understand why I picked Mongo"), that's a signal to either (a) learn it deeply enough to defend, or (b) cut the claim from the bullet. Don't ship a bullet you'd fold on under questioning.
- Once committed, set a calendar reminder to re-verify the bullets every 3 months — projects rot, deployments expire, the bullet should match reality whenever you submit a resume.
