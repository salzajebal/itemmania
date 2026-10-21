BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS admin_deleted_at timestamptz;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS admin_deleted_by text;
COMMIT;
