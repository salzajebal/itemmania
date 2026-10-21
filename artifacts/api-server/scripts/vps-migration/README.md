# External VPS migration safety

These scripts prepare a private staging copy. They do **not** change DNS or
finish the cutover. Run them only on independently identified servers.

## Preparation

- Pin the source SSH fingerprint against the established operating-server key.
- Keep passwords in workspace Secrets; use `sshpass -e`, never command arguments.
- Install matching PostgreSQL major version and preserve the active Node binary.
- Run `export.mjs` through systemd with the existing service EnvironmentFile.
  Never source that file as shell code.
- Pass an independently verified `EXPECTED_RUNTIME` and a root-private
  `MIGRATION_DIRECTORY` matching `/root/itemmania-migration/snapshot-*`.
- The source export keeps one repeatable-read transaction open, gives its
  exported snapshot to `pg_dump`, and hashes every application table inside the
  same snapshot. Application writes continue on the origin at this stage.
- Transfer the private archive directly between encrypted SSH connections.
  Never place production DB dumps, environment settings or TLS private keys in
  the workspace, Git, public storage or chat.
- Verify SHA256SUMS before extracting. `stage.sh` refuses an existing target
  application, keeps ingress restricted to loopback, disables certificate
  renewal and automatic collection, and leaves the app disabled at boot.
- `restore.mjs` refuses existing DB/role names. Its `verify-only` argument
  performs no restoration and never drops or rewrites an existing DB.
- Verify every restored table count/hash **before** starting the app. Normal
  acceptance checks later create only verifier sessions and listing-view counts.
- Preserve actual service ownership and compare file contents, not numeric UID
  equality across independently installed Linux systems.

## Timezone

Match the verified origin OS and PostgreSQL defaults on the destination.
PostgreSQL's default timezone may be chosen from the new VPS installer's region.
Content fingerprints explicitly use UTC / ISO dates / stable float formatting
because timestamptz JSON output is otherwise timezone-dependent.

## Final cutover — separate approval required

Do not promote the initial staging DB. The origin remains authoritative while
it accepts writes.

1. Establish DNS access and independently record the original A/AAAA/CNAME
   routes. Only change approved application records, not mail or unrelated names.
2. Obtain approval for the write-stop window.
3. Block incoming application writes and stop the origin app/crawler. Wait for
   existing writers to finish. Keep private pre-change configs and backups.
4. Export a **new** consistent final DB plus both upload locations. Copy and
   validate it before continuing.
5. Restore into a **new target database**; retain the initial staging DB and
   original environment privately. Never reset the operating source database.
6. Point only the destination application at the final target DB. Verify final
   row/content fingerprints, sequence state, uploads, auth and business evidence.
7. Keep the old app/crawler stopped. Use a controlled old-origin proxy to the
   new origin if needed during DNS convergence; never allow two writable DBs.
8. Remove destination staging ingress restrictions, enable the app and its
   scheduler exactly once, switch approved DNS records, and enable certificate
   renewal on the destination. Test HTTPS through the public domain.
9. Keep the original server and backups until the user approves retirement.
   Once the new DB accepts real writes, never point users back at the stale
   old DB as a rollback.

Never automatically execute this checklist merely because staging checks pass.

## Prepared final tools

- `prepare-cutover.py source|target` creates private alternate Nginx configs and
  syntax-checks them. It never installs or reloads them. Source config forwards
  to the destination over certificate-verified HTTPS; destination config trusts
  the migration peer header only from the exact old origin address.
- Set `MIGRATION_QUIESCED=1` and `MIGRATION_FINAL_APPROVED=1` for a final export
  only after explicit approval and stopping the source app. The export refuses
  an active service or other source-DB connections. It also records sequences.
- `final-restore.mjs` requires that approved quiesced manifest, a stopped target
  service, and `snapshot-final-*`. It creates a fresh database instead of
  deleting staging data. It verifies all rows and sequence state, stages uploads
  and creates a root-private final environment file. It does not activate them.
- Prepared configs contain their private validation directory in include paths.
  Before installing them, translate those include paths back to `/etc/nginx/`,
  preserve live configs privately, run `nginx -t` on installed files, and only
  then reload. Do not copy a private validation include path into live config.
- `cutover-control.py` implements explicit approved phases: `maintenance`,
  `target-files`, `target-open`, `source-proxy`. These are not a single automatic
  command. Perform final data restoration and acceptance between the phases.
  Once `target-open` has run, the new DB is authoritative; no stale-source rollback.
- Nginx upstream TLS requires a suitable verification depth, not just a CA
  bundle. The bridge uses depth4 with verification enabled. The guarded
  `source-tls-depth` correction mode exists for a bridge prepared without it.
  Always verify actual old-IP traffic before describing forwarding as ready.
