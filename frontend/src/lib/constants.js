export const STATUS_FLOW = {
  posted: 'Posted',
  assigned: 'Assigned',
  in_transit: 'In transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export const DEMO_LANES = [
  {
    label: 'Kansas City to Dallas',
    origin_address: 'Kansas City, MO',
    destination_address: 'Dallas, TX',
    origin_lat: 39.099724,
    origin_lng: -94.578331,
    destination_lat: 32.776665,
    destination_lng: -96.796989,
    weight_lbs: 18000,
    rate_cents: 240000,
  },
  {
    label: 'Overland Park to Nashville',
    origin_address: 'Overland Park, KS',
    destination_address: 'Nashville, TN',
    origin_lat: 38.982228,
    origin_lng: -94.670792,
    destination_lat: 36.162663,
    destination_lng: -86.781601,
    weight_lbs: 22000,
    rate_cents: 275000,
  },
  {
    label: 'Chicago to Atlanta',
    origin_address: 'Chicago, IL',
    destination_address: 'Atlanta, GA',
    origin_lat: 41.878113,
    origin_lng: -87.629799,
    destination_lat: 33.749001,
    destination_lng: -84.387978,
    weight_lbs: 26000,
    rate_cents: 315000,
  },
]
