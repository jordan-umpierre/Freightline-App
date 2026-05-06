ALTER TABLE loads
  ADD COLUMN IF NOT EXISTS origin_lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS origin_lng NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS destination_lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS destination_lng NUMERIC(9,6);

CREATE TABLE IF NOT EXISTS load_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id UUID NOT NULL REFERENCES loads(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id),
  event_type VARCHAR(30) NOT NULL CHECK (
    event_type IN ('created', 'updated', 'assigned', 'status_changed', 'cancelled', 'location_ping')
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
