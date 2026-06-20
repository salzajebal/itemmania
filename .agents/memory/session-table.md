---
name: connect-pg-simple bundling quirk
description: createTableIfMissing fails in esbuild bundles because table.sql is not copied to dist/
---

## Rule
Do NOT use `createTableIfMissing: true` with connect-pg-simple when the server is bundled with esbuild. Pre-create the `user_sessions` table via executeSql instead.

**Why:** connect-pg-simple reads `table.sql` from its package directory at runtime. esbuild bundles to `dist/index.mjs` but doesn't copy the SQL file, so the path `/home/runner/workspace/artifacts/api-server/dist/table.sql` doesn't exist.

**How to apply:**
- Run this once via executeSql (already done):
  ```sql
  CREATE TABLE IF NOT EXISTS user_sessions (
    sid varchar NOT NULL COLLATE "default",
    sess json NOT NULL,
    expire timestamp(6) NOT NULL
  ) WITH (OIDS=FALSE);
  ALTER TABLE user_sessions ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
  CREATE INDEX IF NOT EXISTS IDX_session_expire ON user_sessions (expire);
  ```
- In app.ts use: `store: new PgSession({ pool, tableName: "user_sessions" })` (no createTableIfMissing).
