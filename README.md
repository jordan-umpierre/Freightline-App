# Freightline

Freightline is a freight operations portfolio project built with React, Node/Express, and Postgres. It models a Ryan/FLEX-style workflow: shippers post loads, drivers register trucks, drivers accept eligible freight, and both roles can inspect active work on a map/status board.

This project is inspired by public logistics workflows from Shamrock Trading Corporation brands such as [Ryan Transportation](https://www.ryantrans.com/) and [ProTransport](https://www.pro-transport.com/). It is not affiliated with, endorsed by, or branded as Shamrock Trading Corporation.

## Why This Exists

The goal is to show end-to-end product judgment for transportation software:

- Role-based JWT auth for shippers and drivers
- Relational freight data with clear ownership rules
- Guardrails around vehicle capacity, oversized freight, and load status transitions
- A React operations dashboard with map visibility
- Mongo-backed GPS pings with live WebSocket updates
- Tests and CI that prove the main API behaviors

## Architecture

```mermaid
flowchart LR
  User[Shipper or Driver] --> Web[React/Vite Dashboard]
  Web --> API[Express API]
  API --> Auth[JWT Auth Middleware]
  API --> PG[(Postgres)]
  API --> Mongo[(MongoDB)]
  API --> Live[WebSocket /live]
  PG --> Users[users]
  PG --> Vehicles[vehicles]
  PG --> Loads[loads]
  PG --> Events[load_events]
  Mongo --> Pings[gps_pings]
  Live --> Web
```

Postgres owns transactional freight records. MongoDB stores append-heavy GPS pings so live tracking can scale separately from relational load workflows.

## Current V1 Workflows

- `shipper` users can register, login, post loads, edit posted-load rates, cancel posted loads, and view their load timelines.
- `driver` users can register, login, register trucks, view posted freight, accept freight when their vehicle is eligible, and move assigned freight through `assigned -> in_transit -> delivered`.
- Assigned drivers can submit GPS pings; shippers and assigned drivers see live map markers and tracking exceptions.
- The frontend uses Leaflet and OpenStreetMap tiles with predefined demo lanes, so the app does not need a paid geocoding key.

## API Surface

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /vehicles`
- `GET /vehicles/me`
- `POST /loads`
- `GET /loads`
- `GET /loads/:id`
- `PATCH /loads/:id`
- `POST /loads/:id/assign`
- `PATCH /loads/:id/status`
- `GET /loads/:id/events`
- `POST /loads/:id/pings`
- `GET /loads/:id/pings?limit=50`
- `GET /loads/live-state`
- `WS /live?token=<jwt>`

## Local Setup

Backend:

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Run database migrations manually against your local Postgres database:

```bash
psql -d freightline -f backend/db/migrations/001_create_users.sql
psql -d freightline -f backend/db/migrations/002_create_vehicles.sql
psql -d freightline -f backend/db/migrations/003_create_loads.sql
psql -d freightline -f backend/db/migrations/004_add_load_coordinates_and_events.sql
```

MongoDB is required for live GPS pings. The backend defaults to:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=freightline
```

Seed demo data:

```bash
psql -d freightline -f backend/db/seed_demo.sql
```

Demo password for seeded users: `secret123`

- `demo.shipper@freightline.local`
- `demo.driver@freightline.local`

Run the live GPS simulator in another terminal:

```bash
cd backend
npm run simulate:pings
```

Trigger an off-route exception:

```bash
cd backend
npm run simulate:pings -- --off-route
```

## Quality Checks

```bash
cd backend && npm test
cd frontend && npm run lint
cd frontend && npm run build
```

## What I Would Scale Next

- Add S3 presigned upload flows for proof-of-delivery documents.
- Add real geocoding and route distance calculations behind a provider abstraction.
- Move GPS ingestion behind a device-authenticated API key flow or event stream.
- Add separate carrier/company entities once the v1 driver-as-carrier simplification is no longer enough.
