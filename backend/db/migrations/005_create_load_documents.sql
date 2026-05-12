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
