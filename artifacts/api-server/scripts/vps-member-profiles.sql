SET LOCAL lock_timeout = '5s';
CREATE TABLE IF NOT EXISTS member_profiles (
  user_id integer PRIMARY KEY REFERENCES users(id),
  bank_name text,
  bank_account_number text,
  bank_account_holder text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
