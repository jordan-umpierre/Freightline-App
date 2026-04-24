CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carrier_id UUID NOT NULL REFERENCES users(id),
    driver_id UUID REFERENCES users(id),
    status VARCHAR(50) NOT NULL CHECK (status IN ('available', 'in_transit', 'out_of_service')),
    capacity_lbs INTEGER NOT NULL,
    oversized BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
