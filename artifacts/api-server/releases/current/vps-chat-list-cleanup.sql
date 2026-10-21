-- Additive admin-only visibility metadata; no conversation/finance mutation.
SET LOCAL lock_timeout = '5s';
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS admin_hidden_at timestamptz;
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS admin_hidden_by text;
