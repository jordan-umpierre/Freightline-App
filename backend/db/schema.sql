CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('shipper', 'driver')),
  drivers_license VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id UUID NOT NULL REFERENCES users(id),
  driver_id UUID REFERENCES users(id),
  status VARCHAR(50) NOT NULL CHECK (status IN ('available', 'in_transit', 'out_of_service')),
  capacity_lbs INTEGER NOT NULL,
  oversized BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipper_id UUID NOT NULL REFERENCES users(id),
  vehicle_id UUID REFERENCES vehicles(id),
  origin_address TEXT NOT NULL,
  destination_address TEXT NOT NULL,
  weight_lbs INTEGER NOT NULL,
  rate_cents INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('posted', 'assigned', 'in_transit', 'delivered', 'cancelled')),
  oversized BOOLEAN NOT NULL DEFAULT FALSE,
  origin_lat NUMERIC(9,6),
  origin_lng NUMERIC(9,6),
  destination_lat NUMERIC(9,6),
  destination_lng NUMERIC(9,6),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS load_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id UUID NOT NULL REFERENCES loads(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id),
  event_type VARCHAR(30) NOT NULL CHECK (
    event_type IN (
      'created', 'updated', 'assigned', 'status_changed',
      'cancelled', 'location_ping', 'pod_uploaded'
    )
  ),
  status VARCHAR(50) CHECK (
    status IN ('posted', 'assigned', 'in_transit', 'delivered', 'cancelled')
  ),
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_load_events_load_id_created_at
  ON load_events(load_id, created_at);

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
