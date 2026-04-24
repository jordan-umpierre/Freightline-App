CREATE TABLE loads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipper_id UUID NOT NULL REFERENCES users(id),
    vehicle_id UUID REFERENCES vehicles(id),
    origin_address TEXT NOT NULL,
    destination_address TEXT NOT NULL,
    weight_lbs INTEGER NOT NULL,
    rate_cents INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('posted', 'assigned', 'in_transit', 'delivered', 'cancelled')),
    oversized BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
