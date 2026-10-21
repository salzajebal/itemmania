-- Future inserts only. Never bulk-update existing member grades.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE users ALTER COLUMN grade SET DEFAULT 'gold';
COMMIT;
