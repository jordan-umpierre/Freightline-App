# Technical Notes - Freightline

This document summarizes the main engineering decisions behind Freightline. It is written for contributors and reviewers who want more context than the root README provides.

## System Overview

Freightline models a freight operations workflow where shippers post loads, drivers register vehicles, and the backend enforces role permissions, vehicle capacity, oversized freight eligibility, and legal load status transitions. The frontend provides role-specific dashboards, live map state, proof-of-delivery upload flows, and WebSocket-backed tracking updates.

## Data Boundaries

- PostgreSQL stores transactional records: users, vehicles, loads, load events, and proof-of-delivery document metadata.
- MongoDB stores append-heavy GPS pings so tracking data can scale separately from the relational workflow.
- S3 stores proof-of-delivery documents through short-lived presigned URLs.

## Notable Decisions

- Load status changes are guarded by backend rules so clients cannot skip lifecycle states.
- GPS pings are kept out of PostgreSQL to avoid mixing high-volume location writes with core transactional tables.
- Proof-of-delivery uploads use presigned URLs so the API does not proxy file bytes.
- The frontend receives live updates over WebSockets and invalidates local views when relevant events arrive.

## Operational Notes

- Railway free-tier cold starts can delay the first API request after an idle period.
- Demo accounts use seeded credentials documented in the root README.
- The GPS simulator can target the deployed API with `API_URL=https://freightline-app-production.up.railway.app npm run simulate:pings -- --off-route`.

## Extension Points

- Add carrier organizations and membership roles.
- Move GPS ingestion behind a message queue or streaming ingestion service.
- Add malware scanning for proof-of-delivery documents before signed download links become available.
- Add a geocoding provider interface for dynamic lanes.
