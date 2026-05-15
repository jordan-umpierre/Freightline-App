I'm a junior developer building a portfolio project called Freightline — a
simplified freight/load tracking platform — to land a role at Shamrock Trading
Corp (Kansas City logistics company). Target stack: React (Vite) + Node/Express
+ Postgres + MongoDB + AWS.

## How I want you to work with me

Write code for me directly. When I ask for something, implement it.

When I ask how to do something:
1. Explain the concept briefly
2. Implement it

When I paste an error:
1. Explain what it means in plain English
2. Fix it

When I'm about to make an architectural decision (schema design, folder
structure, which library to pick):
1. Lay out 2–3 options with tradeoffs
2. Tell me which you'd pick and why
3. Implement whichever I choose

When you write code:
- Keep it minimal — no premature abstraction
- Add comments explaining the "why," not the "what"
- Point out anything I should understand deeply before moving on

## Project context

Domain: freight logistics. Shippers post loads (origin, destination, weight,
rate). Carriers get assigned. Trucks send GPS pings. Drivers upload proof-of-
delivery documents. Dashboard shows active loads on a map.

Why this stack serves the domain:
- Postgres: relational data (users, carriers, shippers, loads, assignments,
  invoices) — lots of foreign keys
- MongoDB: high-volume flexible data (GPS pings, event logs, inspection
  reports) — append-heavy, schema varies
- AWS S3: document uploads via presigned URLs
- React + Leaflet: map view with live truck positions

## The plan (6–8 weeks)

Week 1: Scaffold + deploy empty app publicly (deploy pipeline before features)
Weeks 2–3: Postgres, JWT auth, loads CRUD, React pages
Week 4: Mongo ping ingestion + live map view with Leaflet
Week 5: S3 presigned URL uploads for BOL/POD docs
Week 6: Tests (Jest + Supertest, React Testing Library), CI via GitHub Actions,
        README with architecture diagram and "what I'd do differently at scale"
Weeks 7–8 (stretch): WebSockets for live updates, invoice PDF gen, admin
                     analytics

Stretch side project: a small C++ "truck device simulator" that posts pings
to my ingestion endpoint — bridges this work toward Garmin SE1 roles.

## Ground rules I'm holding myself to

- Commit frequently with meaningful messages (the git log is part of the
  portfolio)
- Deploy early, keep it live

## Where I am right now

- All core features complete and deployed. Backend live on Railway, frontend on Vercel.
- Postgres + MongoDB + S3 + WebSockets all wired up and tested.
- CI via GitHub Actions runs backend tests, frontend lint, frontend tests, and build.
