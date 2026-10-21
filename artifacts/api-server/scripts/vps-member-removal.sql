-- Additive account removal; never erase wallets, escrow or conversations.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_by text;
