-- Authorized, additive provisioning for the separate external VPS database.
-- Apply manually before replacing its API dist; not a startup/Publish hook.
-- No existing member/trade rows are changed. No policy row means blocking OFF.
CREATE TABLE IF NOT EXISTS registration_settings (
  key text PRIMARY KEY,
  blocked boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);