ALTER TABLE load_events DROP CONSTRAINT load_events_event_type_check;

ALTER TABLE load_events ADD CONSTRAINT load_events_event_type_check
  CHECK (event_type IN (
    'created', 'updated', 'assigned', 'status_changed',
    'cancelled', 'location_ping', 'pod_uploaded'
  ));
