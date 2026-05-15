# Contributor Guide

Freightline is a full-stack freight operations platform for load posting, driver assignment, proof-of-delivery uploads, and live shipment tracking.

## Project Context

The app models a shipper and driver workflow:

- Shippers post loads with origin, destination, weight, rate, and coordinates.
- Drivers register vehicles and accept freight when their truck is eligible.
- The backend guards role permissions and legal load status transitions.
- Drivers can submit GPS pings and upload proof-of-delivery documents.
- The dashboard shows active loads, live map state, tracking exceptions, and load timelines.

## Stack

- Frontend: React, Vite, Leaflet, Vitest, React Testing Library
- Backend: Node.js, Express, Jest, Supertest
- Datastores: PostgreSQL for transactional freight records, MongoDB for GPS pings
- Storage: AWS S3 with presigned proof-of-delivery uploads
- Realtime: WebSockets for live load and GPS updates
- Deployment: Vercel frontend, Railway API, GitHub Actions CI

## Working Guidelines

- Keep changes small and focused.
- Preserve existing demo credentials, screenshots, and setup instructions unless the implementation changes them.
- Add comments only where they explain a non-obvious design tradeoff.
- Keep public documentation neutral and project-focused.
- Run the relevant backend or frontend checks before publishing changes.

## Useful Commands

```bash
cd backend && npm test
cd frontend && npm run lint
cd frontend && npm test
cd frontend && npm run build
```
