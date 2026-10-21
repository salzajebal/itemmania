#!/usr/bin/env python3
"""Prepare and syntax-check cutover configs without changing active ingress.

No service stop/reload, database writes, DNS changes or promotion happen here.
The prepared configuration is private until the write-stop window is approved.
"""
from pathlib import Path
import hashlib
import json
import re
import shutil
import subprocess
import sys

EXPECTED_RUNTIME = "48892b90cc780ef9dc36ded528c3008f7b2e7e04bd3ddd6fe429064c978ad133"
DESTINATION = "85.11.190.63"
ORIGIN = "72.62.126.67"
ROOT = Path("/root/itemmania-migration/cutover-ready")
mode = sys.argv[1] if len(sys.argv) == 2 else ""
if mode not in ("source", "target"):
    raise SystemExit("Specify source or target")
expected_ip = ORIGIN if mode == "source" else DESTINATION
if expected_ip not in subprocess.check_output(["hostname", "-I"], text=True).split():
    raise SystemExit("Wrong server identity")
runtime = Path("/opt/itemmania/artifacts/api-server/dist/index.mjs")
if hashlib.sha256(runtime.read_bytes()).hexdigest() != EXPECTED_RUNTIME:
    raise SystemExit("Runtime changed; re-review before preparing cutover")
if ROOT.exists():
    raise SystemExit("Prepared config already exists; inspect instead of replacing it")
ROOT.mkdir(mode=0o700, parents=True)
nginx = ROOT / "nginx"
# Resolve links while taking the private copy, so validation cannot accidentally
# read live sites-enabled targets in place of prepared virtual hosts.
shutil.copytree("/etc/nginx", nginx, symlinks=False)

sites = list((nginx / "sites-enabled").iterdir())
if not any("ltemmania.com" in f.read_text() for f in sites if f.is_file()):
    raise SystemExit("Operating domain was not found")

if mode == "source":
    replacements = 0
    for file in sites:
        if not file.is_file():
            continue
        text = file.read_text()
        text, n = re.subn(
            r"proxy_pass\s+http://127[.]0[.]0[.]1:8080\s*;",
            """proxy_pass https://85.11.190.63;
        proxy_ssl_server_name on;
        proxy_ssl_name $host;
        proxy_ssl_verify on;
        proxy_ssl_verify_depth 4;
        proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
        proxy_set_header X-IM-Forwarded-Peer $remote_addr;
        proxy_buffering off;""",
            text,
        )
        file.write_text(text)
        replacements += n
    if replacements != 1:
        raise SystemExit("Unexpected number of old application upstreams")
else:
    conf = nginx / "conf.d"
    (conf / "itemmania-bridge-peer.conf").write_text(
        """# Only the old origin can supply this migration forwarding header.
map $http_x_im_forwarded_peer $im_forwarded_peer {
    "" $remote_addr;
    default $http_x_im_forwarded_peer;
}
map $realip_remote_addr $im_client_peer {
    default $remote_addr;
    72.62.126.67 $im_forwarded_peer;
}
"""
    )
    # Public ingress becomes available only when this prepared tree is activated
    # AFTER final DB restoration. The active staging tree stays blocked.
    (conf / "itemmania-staging.conf").unlink()
    replacements = 0
    for file in sites:
        if not file.is_file():
            continue
        text = file.read_text()
        text = re.sub(
            r"(?m)^\s*if \(\$itemmania_staging_allowed = 0\) \{ return 503; \}\s*$",
            "",
            text,
        )
        text, n = re.subn(
            r"proxy_set_header\s+X-Real-IP\s+\$remote_addr\s*;",
            "proxy_set_header X-Real-IP $im_client_peer;\n"
            "        proxy_buffering off;",
            text,
        )
        text = re.sub(
            r"(?m)^(\s*)server\s*\{",
            r'\1server {\n    add_header X-Itemmania-Origin "new-vps" always;',
            text,
        )
        file.write_text(text)
        replacements += n
    if replacements != 1:
        raise SystemExit("Unexpected number of destination application upstreams")

# Use this copy for nginx -t. TLS certs and CA store retain their real paths.
# Rewrite only Nginx include paths, not public URLs or application paths.
for file in nginx.rglob("*"):
    if not file.is_file():
        continue
    text = file.read_text()
    file.write_text(text.replace("/etc/nginx/", str(nginx) + "/"))
subprocess.run(
    ["nginx", "-t", "-c", str(nginx / "nginx.conf")], check=True,
    stdout=subprocess.DEVNULL,
)
(ROOT / "readiness.json").write_text(json.dumps({
    "role": mode, "runtime": EXPECTED_RUNTIME,
    "nginxSyntaxChecked": True, "activated": False,
    "writeStopApproved": False, "dnsChanged": False,
}, indent=2))
print(f"CUTOVER_CONFIG_PREPARED role={mode} syntax_ok=true activated=false")
