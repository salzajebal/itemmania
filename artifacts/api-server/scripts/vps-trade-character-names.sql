-- Administrator list deletion is independent of member visibility and finance.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_deleted_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_deleted_by text;
-- Second-stage list cleanup preserves the order and all linked evidence.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_hidden_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_hidden_by text;
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS admin_deleted_at timestamptz;
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS admin_deleted_by text;
-- Explicit second-stage admin list cleanup; retain participant conversations.
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS admin_hidden_at timestamptz;
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS admin_hidden_by text;
-- Closing a chat hides it only for that participant; preserve trade evidence.
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS buyer_dismissed_at timestamptz;
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS seller_dismissed_at timestamptz;
-- Additive columns. No existing account/trade rows are overwritten or deleted.
ALTER TABLE chat_rooms
  ADD COLUMN IF NOT EXISTS buyer_character_name text,
  ADD COLUMN IF NOT EXISTS seller_character_name text;