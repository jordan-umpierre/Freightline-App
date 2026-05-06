INSERT INTO users (id, first_name, last_name, email, password_hash, role)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Demo',
    'Shipper',
    'demo.shipper@freightline.local',
    '$2b$10$B9zcb36oNEczx/SZtalgAug6e5u1sZnhLos47YQi9B5xNWwCeTh46',
    'shipper'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Demo',
    'Driver',
    'demo.driver@freightline.local',
    '$2b$10$B9zcb36oNEczx/SZtalgAug6e5u1sZnhLos47YQi9B5xNWwCeTh46',
    'driver'
  )
ON CONFLICT (email) DO NOTHING;

INSERT INTO vehicles (id, carrier_id, driver_id, status, capacity_lbs, oversized)
VALUES
  (
    '33333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    'in_transit',
    45000,
    true
  ),
  (
    '99999999-9999-9999-9999-999999999999',
    '22222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    'available',
    45000,
    true
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO loads (
  id,
  shipper_id,
  vehicle_id,
  origin_address,
  destination_address,
  weight_lbs,
  rate_cents,
  status,
  oversized,
  origin_lat,
  origin_lng,
  destination_lat,
  destination_lng
)
VALUES
  (
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    null,
    'Kansas City, MO',
    'Dallas, TX',
    18000,
    240000,
    'posted',
    false,
    39.099724,
    -94.578331,
    32.776665,
    -96.796989
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    'Chicago, IL',
    'Atlanta, GA',
    26000,
    315000,
    'assigned',
    true,
    41.878113,
    -87.629799,
    33.749001,
    -84.387978
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO load_events (id, load_id, actor_id, event_type, status, latitude, longitude, note)
VALUES
  (
    '66666666-6666-6666-6666-666666666666',
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'created',
    'posted',
    39.099724,
    -94.578331,
    'Load posted by shipper'
  ),
  (
    '77777777-7777-7777-7777-777777777777',
    '55555555-5555-5555-5555-555555555555',
    '11111111-1111-1111-1111-111111111111',
    'created',
    'posted',
    41.878113,
    -87.629799,
    'Load posted by shipper'
  ),
  (
    '88888888-8888-8888-8888-888888888888',
    '55555555-5555-5555-5555-555555555555',
    '22222222-2222-2222-2222-222222222222',
    'assigned',
    'assigned',
    41.878113,
    -87.629799,
    'Load accepted by driver'
  )
ON CONFLICT (id) DO NOTHING;
