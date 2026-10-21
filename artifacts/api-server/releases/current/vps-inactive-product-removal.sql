BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE products ADD COLUMN IF NOT EXISTS admin_hidden_at timestamptz;
ALTER TABLE products ADD COLUMN IF NOT EXISTS admin_hidden_by text;
COMMIT;
