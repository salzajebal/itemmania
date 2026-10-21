-- Additive external VPS migration. Run before replacing the API dist.
-- No recovery/backfill of existing password hashes.
CREATE TABLE IF NOT EXISTS public.member_password_originals (
  user_id integer PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  password text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
