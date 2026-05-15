# Resume Bullets - Freightline

These are the canonical resume bullets for the Freightline portfolio project. Update this file whenever the project gains or loses a feature so the resume copy stays in sync with the codebase and live demo.

**Last updated:** 2026-05-12
**Last verified against repo and live deployment:** 2026-05-12

---

## Two-Bullet Form

> Built and deployed Freightline ([freightline-app.vercel.app](https://freightline-app.vercel.app)), a full-stack freight operations platform modeled on Ryan/ProTransport-style logistics workflows: React (Vite), Node/Express, Postgres, MongoDB, AWS S3, and WebSockets, with role-based JWT auth, vehicle eligibility checks, transaction-safe load status transitions, S3 presigned proof-of-delivery uploads, and live GPS tracking with off-route exception alerts.

> Designed a polyglot persistence model that separates transactional freight records in Postgres from append-heavy GPS pings in MongoDB, then verified the workflow with 46 Jest/Supertest backend tests, 19 Vitest + React Testing Library frontend tests, and GitHub Actions CI on every push.

## One-Bullet Form

> Built and deployed Freightline ([freightline-app.vercel.app](https://freightline-app.vercel.app)), a full-stack freight operations platform using React (Vite), Node/Express, Postgres, MongoDB, AWS S3, and WebSockets, with JWT role-based auth, transaction-safe load workflows, S3 presigned proof-of-delivery uploads, live GPS/off-route tracking, and CI-backed Jest + React Testing Library coverage.

## Plain-Text ATS Version

Built and deployed Freightline (freightline-app.vercel.app), a full-stack freight operations platform modeled on Ryan/ProTransport-style logistics workflows using React (Vite), Node/Express, Postgres, MongoDB, AWS S3, and WebSockets, with role-based JWT auth, vehicle eligibility checks, transaction-safe load status transitions, S3 presigned proof-of-delivery uploads, and live GPS tracking with off-route exception alerts.

Designed a polyglot persistence model that separates transactional freight records in Postgres from append-heavy GPS pings in MongoDB, then verified the workflow with 46 Jest/Supertest backend tests, 19 Vitest and React Testing Library frontend tests, and GitHub Actions CI on every push.

---

## Verification Snapshot

- Live frontend: `https://freightline-app.vercel.app` returned HTTP 200.
- Live backend: `https://freightline-app-production.up.railway.app` returned HTTP 200.
- Production POD upload path was verified end to end with a real PNG upload to S3 and a shipper-side signed download URL.
- Backend test suite: 46 passing tests.
- Frontend test suite: 19 passing tests.
- Latest GitHub Actions CI run checked during Phase 5: `25711615403`, success.
- Short production GPS simulator run produced an `off_route` exception.

## Why These Words

- **Built and deployed** - falsifiable, because the live demo link works.
- **Modeled on Ryan/ProTransport-style logistics workflows** - signals the target logistics domain without claiming affiliation.
- **Transaction-safe load status transitions** - points to actual backend transaction handling and legal state guards.
- **S3 presigned proof-of-delivery uploads** - describes the production pattern accurately: the browser uploads directly to S3, while the API controls authorization and metadata.
- **Polyglot persistence** - defensible because Postgres owns relational freight records and MongoDB owns GPS pings.

## Deliberately Not Claimed

- Fake user counts, shipment volumes, or revenue impact.
- AWS Lambda, queues, malware scanning, or CDN distribution. Those are scale-next ideas, not current features.
- "Production-ready security" as a blanket claim. The app has JWT auth and role checks, but it does not yet have auth rate limiting, refresh-token rotation, or malware scanning for uploaded documents.
