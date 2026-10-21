#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# New, user-identified destination only. This script never contacts the origin,
# changes DNS, starts crawlers, or overwrites an existing Itemmania installation.
[[ "$(hostname -I)" == *"85.11.190.63"* ]] || { echo "STOP: wrong destination"; exit 1; }
SNAPSHOT=/root/itemmania-migration/snapshot-initial
[[ -d "$SNAPSHOT" && -f "$SNAPSHOT/SHA256SUMS" ]] || exit 1
[[ ! -e /opt/itemmania && ! -e /etc/itemmania.env ]] || {
  echo "STOP: destination already contains an application"; exit 1;
}
systemctl is-active --quiet postgresql
timedatectl set-timezone Etc/UTC
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 postgres \
  -c "ALTER SYSTEM SET timezone='Etc/UTC';" >/dev/null
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 postgres \
  -c "SELECT pg_reload_conf();" >/dev/null
systemctl stop nginx
systemctl disable --now certbot.timer >/dev/null 2>&1 || true
(cd "$SNAPSHOT" && sha256sum --check --quiet SHA256SUMS)
install -d -m 700 /root/itemmania-migration/pre-stage-config
tar -czf /root/itemmania-migration/pre-stage-config/nginx.tar.gz -C / etc/nginx

getent group itemmania >/dev/null || groupadd --system itemmania
id itemmania >/dev/null 2>&1 ||
  useradd --system --gid itemmania --home-dir /opt/itemmania --shell /usr/sbin/nologin itemmania
tar -xzf "$SNAPSHOT/application-and-config.private.tar.gz" -C /
chown -R itemmania:itemmania /opt/itemmania
chmod 600 /etc/itemmania.env
chown root:root /etc/itemmania.env
chmod 755 /usr/local/bin/node
runuser -u itemmania -- /usr/local/bin/node --check /opt/itemmania/artifacts/api-server/dist/index.mjs

install -d -m 755 /etc/systemd/system/itemmania.service.d
printf '[Service]\nEnvironmentFile=/etc/itemmania-staging.env\n' \
  > /etc/systemd/system/itemmania.service.d/staging.conf
printf 'AUTO_CRAWL_ENABLED=0\nALLOW_STARTUP_DB_SYNC=0\nBIND_HOST=127.0.0.1\n' \
  > /etc/itemmania-staging.env
chmod 600 /etc/itemmania-staging.env

# Block every copied virtual host. Test through local HTTPS / an SSH tunnel;
# an old user session must not reach this independent staging DB.
printf 'map $realip_remote_addr $itemmania_staging_allowed {\n  default 0;\n  127.0.0.1 1;\n  ::1 1;\n}\n' \
  > /etc/nginx/conf.d/itemmania-staging.conf
python3 - <<'PY'
from pathlib import Path
import re
visited = set()
count = 0
for enabled in Path("/etc/nginx/sites-enabled").iterdir():
    file = enabled.resolve()
    if file in visited or not file.is_file():
        continue
    visited.add(file)
    source = file.read_text()
    updated, matches = re.subn(
        r"(?m)^(\s*)server\s*\{",
        r"\1server {\n    if ($itemmania_staging_allowed = 0) { return 503; }",
        source,
    )
    if matches:
        file.write_text(updated)
        count += matches
if count < 2:
    raise SystemExit("STOP: did not guard all expected virtual hosts")
print(f"STAGING_GUARDED virtual_hosts={count}")
PY
nginx -t
systemctl daemon-reload
systemctl disable itemmania >/dev/null 2>&1 || true
echo "STAGE_EXTRACTED; restore and verify DB before starting application"
