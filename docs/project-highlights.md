# Project Highlights - Freightline

Freightline is a deployed full-stack freight operations platform with role-based dashboards, transactional load workflows, live tracking, and proof-of-delivery document handling.

## Highlights

- Built a React and Node/Express application with PostgreSQL for core freight records and MongoDB for GPS ping history.
- Implemented JWT authentication, shipper and driver roles, vehicle eligibility checks, and guarded load lifecycle transitions.
- Added S3 presigned proof-of-delivery uploads so drivers can attach JPEG, PNG, or PDF documents without proxying files through the API.
- Added WebSocket-backed live tracking with map updates and off-route exception detection.
- Covered backend and frontend contracts with Jest, Supertest, Vitest, React Testing Library, and GitHub Actions CI.

## Demo Surfaces

- Web app: https://freightline-app.vercel.app
- API: https://freightline-app-production.up.railway.app

## Useful Review Paths

- `backend/src/routes/loads.js` - load creation, assignment, and status transitions
- `backend/src/routes/documents.js` - proof-of-delivery upload and download flow
- `backend/src/simulatePings.js` - GPS simulator for live tracking demos
- `frontend/src/App.jsx` - role-specific dashboard flows
