-- Additive: retain all existing products, trade references and timestamps.
ALTER TABLE products ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;
