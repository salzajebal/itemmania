#!/usr/bin/env bash
set -Eeuo pipefail

# Manual release for the separate Hostinger VPS. No initialization, full schema
# push, source rebuild, environment-file edit, or upload deletion.
APP_ROOT=/opt/itemmania
API_ROOT="$APP_ROOT/artifacts/api-server"
DIST="$API_ROOT/dist"
ENV_FILE=/etc/itemmania.env
SERVICE=itemmania
DOMAIN=ltemmania.com
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
STAGED=""
SERVICE_STOPPED=0

fail() { printf 'STOP: %s\n' "$*" >&2; exit 1; }
cleanup() {
  if [[ -n "$STAGED" && "$STAGED" == "$API_ROOT"/.release-dist-* ]]; then
    rm -rf -- "$STAGED"
  fi
}
trap cleanup EXIT
on_error() {
  local result=$?
  trap - ERR
  if [[ "$SERVICE_STOPPED" == 1 ]]; then
    # Atomic replacement leaves either the original or the verified new bundle,
    # never partially copied files. Try to restore service availability.
    systemctl start "$SERVICE" || echo "URGENT: service start failed; inspect itemmania logs." >&2
  fi
  echo "Release failed. Do not enable database initialization or rebuild the old VPS source." >&2
  return "$result"
}
trap on_error ERR

[[ $EUID -eq 0 ]] || fail "Run this script as root."
for command in systemctl systemd-run node python3 curl sha256sum cp mktemp runuser; do
  command -v "$command" >/dev/null || fail "Required command missing: $command"
done
[[ -n "${EXPECTED_CURRENT_SHA256:-}" ]] ||
  fail "Provide the independently verified active runtime hash. Do not overwrite an unknown release."
[[ "$(sha256sum "$DIST/index.mjs" | cut -d' ' -f1)" == "$EXPECTED_CURRENT_SHA256" ]] ||
  fail "The active release changed after review; stop rather than overwrite newer work."
[[ -f "$ENV_FILE" && -f "$DIST/index.mjs" && -f "$APP_ROOT/lib/db/package.json" ]] ||
  fail "Expected Itemmania installation/environment was not found. No deployment performed."
[[ -f "$HERE/SHA256SUMS" && -f "$HERE/dist/index.mjs" &&
   -f "$HERE/registration-settings.sql" && -f "$HERE/db-setup.mjs" &&
   -d "$DIST" && ! -L "$DIST" ]] ||
  fail "Extract the entire release archive first."
for required in dist/index.mjs db-setup.mjs registration-settings.sql trade-character-names.sql admin-sessions.sql member-removal.sql support-chat.sql product-views.sql registered-character-privacy.sql member-password-originals.sql vps-release-backup.mjs deploy.sh; do
  grep -Eq "^[[:xdigit:]]{64}  ${required//./\\.}$" "$HERE/SHA256SUMS" ||
    fail "Release manifest is missing a required file."
done
(cd "$HERE" && sha256sum --check --quiet SHA256SUMS)
systemctl is-active --quiet "$SERVICE" || fail "The existing Itemmania service is not active."
SERVICE_ENV="$(systemctl show "$SERVICE" --property=EnvironmentFiles --value)"
[[ "$SERVICE_ENV" == *"$ENV_FILE"* ]] ||
  fail "The running service does not use the expected environment file."
WORKDIR="$(systemctl show "$SERVICE" --property=WorkingDirectory --value)"
[[ "$WORKDIR" == "$APP_ROOT" || "$WORKDIR" == "$API_ROOT" ]] ||
  fail "Unexpected service working directory. Check the target VPS before releasing."
EXEC_START="$(systemctl show "$SERVICE" --property=ExecStart --value)"
RELATIVE_ENTRY="${DIST#"$WORKDIR"/}/index.mjs"
[[ "$EXEC_START" == *"$DIST/index.mjs"* || "$EXEC_START" == *"$RELATIVE_ENTRY"* ]] ||
  fail "Service does not execute the expected dist/index.mjs. No deployment performed."

# HTTPS with the real hostname preserves TLS/SNI. This does not call Cloudflare.
HEALTH_URL="https://$DOMAIN/api/healthz"
curl -fsS --max-time 10 --resolve "$DOMAIN:443:127.0.0.1" \
  "$HEALTH_URL" -o /dev/null ||
  fail "This VPS does not serve the expected healthy domain over local Nginx HTTPS."

NODE="$(command -v node)"
run_db() {
  local mode="$1"
  local flags field
  local -a environment_flags=()
  flags="$(APP_ROOT="$APP_ROOT" "$NODE" "$HERE/db-setup.mjs" flags)"
  while IFS= read -r field; do
    if [[ -n "$field" ]]; then environment_flags+=("--setenv=$field"); fi
  done <<< "$flags"
  systemd-run --quiet --wait --pipe --collect \
    --unit="itemmania-release-${mode}-$(date +%s)-$$" \
    --property="EnvironmentFile=$ENV_FILE" \
    --property="WorkingDirectory=$APP_ROOT" \
    "${environment_flags[@]}" \
    --setenv="APP_ROOT=$APP_ROOT" \
    --setenv="REGISTRATION_DDL=$HERE/registration-settings.sql" \
    --setenv="TRADE_CHARACTER_DDL=$HERE/trade-character-names.sql" \
    --setenv="ADMIN_SESSION_DDL=$HERE/admin-sessions.sql" \
    --setenv="MEMBER_REMOVAL_DDL=$HERE/member-removal.sql" \
    --setenv="SUPPORT_CHAT_DDL=$HERE/support-chat.sql" \
    --setenv="PRODUCT_VIEWS_DDL=$HERE/product-views.sql" \
    --setenv="REGISTERED_CHARACTER_PRIVACY_DDL=$HERE/registered-character-privacy.sql" \
    --setenv="MEMBER_PASSWORD_ORIGINALS_DDL=$HERE/member-password-originals.sql" \
    "$NODE" "$HERE/db-setup.mjs" "$mode"
}
run_db check
run_db backup

# Stage and verify the compiled files before stopping the existing process.
STAGED="$(mktemp -d "$API_ROOT/.release-dist-XXXXXXXX")"
cp -R "$HERE/dist/." "$STAGED/"
chmod --reference="$DIST" "$STAGED"
chown --reference="$DIST" "$STAGED"
# Extraction may use root's restrictive umask; the service is unprivileged.
# Only public compiled code is readable here. Secret/config backups stay 0600.
find "$STAGED" -type d -exec chmod 755 {} +
find "$STAGED" -type f -exec chmod 644 {} +
SERVICE_USER="$(systemctl show "$SERVICE" --property=User --value)"
runuser -u "${SERVICE_USER:-root}" -- "$NODE" --check "$STAGED/index.mjs"
(
  cd "$STAGED"
  sed -n 's|  dist/|  |p' "$HERE/SHA256SUMS" | sha256sum --check --quiet -
)
run_db apply
[[ "$(sha256sum "$DIST/index.mjs" | cut -d' ' -f1)" == "$EXPECTED_CURRENT_SHA256" ]] ||
  fail "The runtime changed during preparation; deployment stopped with the live release intact."

echo "Replacing compiled API files; the service will briefly stop."
systemctl stop "$SERVICE"
SERVICE_STOPPED=1
# Linux atomic directory exchange: no partial live bundle and no backup archive.
# The old compiled directory is discarded immediately after a successful swap.
python3 - "$STAGED" "$DIST" <<'PY'
import ctypes, os, sys
libc = ctypes.CDLL(None, use_errno=True)
rename = libc.renameat2
rename.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
rename.restype = ctypes.c_int
if rename(-100, os.fsencode(sys.argv[1]), -100, os.fsencode(sys.argv[2]), 2) != 0:
    error = ctypes.get_errno()
    raise OSError(error, os.strerror(error))
PY
rm -rf -- "$STAGED"
STAGED=""
systemctl start "$SERVICE"
SERVICE_STOPPED=0

# Captured snapshots take time to load; an immediate 502 is not a release failure.
for ((attempt=1; attempt<=40; attempt++)); do
  if systemctl is-active --quiet "$SERVICE" &&
     curl -fsS --max-time 3 --resolve "$DOMAIN:443:127.0.0.1" \
       "$HEALTH_URL" -o /dev/null 2>/dev/null; then
    echo "Release successful: local HTTPS health check passed."
    echo "Member password originals are ready for administrator reauthenticated lookup."
    exit 0
  fi
  sleep 2
done
fail "Health did not recover. Inspect: journalctl -u itemmania -n 50 --no-pager"