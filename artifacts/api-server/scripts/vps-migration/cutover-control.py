#!/usr/bin/env python3
"""Explicitly approved, phased VPS cutover. Never changes DNS or drops a DB."""
from pathlib import Path
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile

BASE = Path("/root/itemmania-migration")
RUNTIME = Path("/opt/itemmania/artifacts/api-server/dist/index.mjs")
EXPECTED = "48892b90cc780ef9dc36ded528c3008f7b2e7e04bd3ddd6fe429064c978ad133"
ORIGIN = "72.62.126.67"
TARGET = "85.11.190.63"
mode = sys.argv[1] if len(sys.argv) > 1 else ""
if mode not in ("maintenance", "target-files", "target-open", "source-proxy", "source-tls-depth"):
    raise SystemExit("Unknown cutover phase")
if os.environ.get("MIGRATION_FINAL_APPROVED") != "1":
    raise SystemExit("Explicit write-stop approval is required")
snapshot = Path(os.environ.get("MIGRATION_DIRECTORY", ""))
if not re.fullmatch(r"/root/itemmania-migration/snapshot-final-[A-Za-z0-9-]+", str(snapshot)):
    raise SystemExit("Explicit final snapshot directory required")
expected_ip = ORIGIN if mode in ("maintenance", "source-proxy", "source-tls-depth") else TARGET
if expected_ip not in subprocess.check_output(["hostname", "-I"], text=True).split():
    raise SystemExit("Wrong server")
if hashlib.sha256(RUNTIME.read_bytes()).hexdigest() != EXPECTED:
    raise SystemExit("Unknown runtime; do not overwrite newer work")
os.umask(0o077)


def run(*args):
    subprocess.run(args, check=True)


def inactive():
    state = subprocess.check_output(
        ["systemctl", "show", "itemmania", "-p", "ActiveState", "--value"], text=True
    ).strip()
    if state != "inactive":
        raise SystemExit("Application must be stopped")


def backup_nginx(label):
    destination = BASE / label
    destination.mkdir(mode=0o700, exist_ok=False)
    with tarfile.open(destination / "nginx.private.tar.gz", "w:gz") as archive:
        archive.add("/etc/nginx", arcname="etc/nginx")
    return destination


def install_prepared_nginx():
    root = BASE / "cutover-ready/nginx"
    changes = {}
    for prepared in (root / "sites-enabled").iterdir():
        if prepared.is_file():
            live = (Path("/etc/nginx/sites-enabled") / prepared.name).resolve()
            if not str(live).startswith("/etc/nginx/"):
                raise SystemExit("Unexpected active virtual-host target")
            changes[live] = prepared.read_text().replace(str(root) + "/", "/etc/nginx/")
    bridge = root / "conf.d/itemmania-bridge-peer.conf"
    if bridge.exists():
        changes[Path("/etc/nginx/conf.d/itemmania-bridge-peer.conf")] = bridge.read_text()
    staging = Path("/etc/nginx/conf.d/itemmania-staging.conf")
    previous = {file: file.read_bytes() if file.exists() else None for file in changes}
    staging_bytes = staging.read_bytes() if staging.exists() else None
    try:
        for file, contents in changes.items():
            file.write_text(contents)
            file.chmod(0o644)
        if mode == "target-open" and staging.exists():
            staging.unlink()
        run("nginx", "-t")
    except BaseException:
        # Only config bytes are reverted, before any Nginx reload or new writes.
        for file, contents in previous.items():
            if contents is None:
                file.unlink(missing_ok=True)
            else:
                file.write_bytes(contents)
        if staging_bytes is not None:
            staging.write_bytes(staging_bytes)
        raise
    run("systemctl", "reload", "nginx")


if mode == "maintenance":
    if Path("/etc/itemmania-migration-frozen").exists():
        raise SystemExit("Origin already frozen; inspect state instead of repeating")
    backup = backup_nginx("before-freeze")
    shutil.copy2("/etc/itemmania.env", backup / "environment.private")
    shutil.copy2("/etc/systemd/system/itemmania.service", backup / "service.private")
    sites = {p.resolve() for p in Path("/etc/nginx/sites-enabled").iterdir() if p.is_file()}
    saved = {file: file.read_text() for file in sites}
    try:
        for file, text in saved.items():
            text, n = re.subn(
                r"(?m)^(\s*)server\s*\{",
                r'\1server {\n    add_header Retry-After "60" always;\n'
                r'    add_header Cache-Control "no-store" always;\n    return 503;',
                text,
            )
            if n:
                file.write_text(text)
        run("nginx", "-t")
    except BaseException:
        for file, text in saved.items():
            file.write_text(text)
        raise
    run("systemctl", "reload", "nginx")
    Path("/etc/itemmania-migration-frozen").write_text("Final migration approved; old DB is frozen.\n")
    dropin = Path("/etc/systemd/system/itemmania.service.d")
    dropin.mkdir(mode=0o755, exist_ok=True)
    (dropin / "migration-freeze.conf").write_text(
        "[Unit]\nConditionPathExists=!/etc/itemmania-migration-frozen\n"
    )
    run("systemctl", "daemon-reload")
    run("systemctl", "disable", "--now", "itemmania")
    run("systemctl", "disable", "--now", "certbot.timer")
    inactive()
    (backup / "freeze.json").write_text(json.dumps({
        "snapshot": str(snapshot), "runtime": EXPECTED, "originFrozen": True,
        "approval": "User approved immediate temporary interruption and final synchronization",
    }, indent=2))
    print("ORIGIN_FROZEN; maintenance active; app and scheduler stopped")

elif mode == "target-files":
    inactive()
    report = json.loads((snapshot / "final-verification.json").read_text())
    if report.get("runtime") != EXPECTED or not report.get("dataMatches") or not report.get("sequencesMatch"):
        raise SystemExit("Unverified final DB")
    previous = snapshot / "previous-staging-uploads"
    previous.mkdir(mode=0o700, exist_ok=False)
    for index, relative in enumerate((
        "opt/itemmania/artifacts/uploads", "opt/itemmania/artifacts/api-server/uploads"
    )):
        final = snapshot / "files" / relative
        live = Path("/") / relative
        if not final.is_dir() or not live.is_dir():
            raise SystemExit("Expected both upload directories")
        live.rename(previous / str(index))
        final.rename(live)
        run("chown", "-R", "itemmania:itemmania", str(live))
    verified = 0
    with tarfile.open(snapshot / "application-and-config.private.tar.gz", "r|gz") as archive:
        prefixes = ("opt/itemmania/artifacts/uploads/", "opt/itemmania/artifacts/api-server/uploads/")
        for member in archive:
            if member.isfile() and member.name.startswith(prefixes):
                expected = hashlib.sha256(archive.extractfile(member).read()).digest()
                if hashlib.sha256((Path("/") / member.name).read_bytes()).digest() != expected:
                    raise SystemExit("Final upload contents differ")
                verified += 1
    shutil.copy2(snapshot / "environment-final.private", "/etc/itemmania.env")
    os.chmod("/etc/itemmania.env", 0o600)
    report["environmentInstalled"] = True
    report["uploadFileCount"] = verified
    (snapshot / "final-verification.json").write_text(json.dumps(report, indent=2))
    run("systemctl", "start", "itemmania")
    print(f"FINAL_FILES_INSTALLED uploads={verified}; still restricted to local acceptance checks")

elif mode == "target-open":
    report = json.loads((snapshot / "final-verification.json").read_text())
    if not report.get("environmentInstalled") or report.get("activated"):
        raise SystemExit("Final files not ready or target already promoted")
    backup = backup_nginx("before-target-open")
    dropin = Path("/etc/systemd/system/itemmania.service.d/staging.conf")
    shutil.copy2(dropin, backup / "staging-service.private")
    dropin.unlink()
    Path("/etc/itemmania-runtime.env").write_text("ALLOW_STARTUP_DB_SYNC=0\nBIND_HOST=127.0.0.1\n")
    Path("/etc/systemd/system/itemmania.service.d/migration-runtime.conf").write_text(
        "[Service]\nEnvironmentFile=/etc/itemmania-runtime.env\n"
    )
    run("systemctl", "daemon-reload")
    run("systemctl", "enable", "itemmania")
    run("systemctl", "restart", "itemmania")
    ready = subprocess.run([
        "curl", "-fsS", "--retry", "40", "--retry-all-errors", "--retry-delay", "2",
        "--max-time", "4", "--resolve", "ltemmania.com:443:127.0.0.1",
        "https://ltemmania.com/api/healthz", "-o", "/dev/null",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if ready.returncode:
        raise SystemExit("New production app is not ready; origin stays frozen")
    install_prepared_nginx()
    run("systemctl", "enable", "--now", "certbot.timer")
    report["activated"] = True
    report["authoritativeServer"] = TARGET
    (snapshot / "final-verification.json").write_text(json.dumps(report, indent=2))
    print("TARGET_OPEN; final DB authoritative; source DB must never be restarted for live traffic")

elif mode == "source-proxy":
    inactive()
    if not Path("/etc/itemmania-migration-frozen").exists():
        raise SystemExit("Old application is not frozen")
    response = subprocess.check_output([
        "curl", "-fsS", "--max-time", "15", "--resolve", f"ltemmania.com:443:{TARGET}",
        "-D", "-", "https://ltemmania.com/api/healthz",
    ], text=True)
    if "x-itemmania-origin: new-vps" not in response.lower() or '"ok"' not in response:
        raise SystemExit("Destination not ready")
    backup_nginx("before-source-proxy")
    install_prepared_nginx()
    print("SOURCE_PROXY_ACTIVE; old IP forwards HTTPS to new server; old app remains frozen")

elif mode == "source-tls-depth":
    inactive()
    file = Path("/etc/nginx/sites-enabled/ltemmania").resolve()
    contents = file.read_text()
    if "proxy_pass https://85.11.190.63;" not in contents or "proxy_ssl_verify on;" not in contents:
        raise SystemExit("Not the verified bridge configuration")
    if "proxy_ssl_verify_depth" in contents:
        raise SystemExit("Bridge depth already configured; inspect instead")
    shutil.copy2(file, BASE / "bridge-before-tls-depth.private")
    file.write_text(contents.replace(
        "proxy_ssl_verify on;", "proxy_ssl_verify on;\n        proxy_ssl_verify_depth 4;"
    ))
    run("nginx", "-t")
    run("systemctl", "reload", "nginx")
    print("BRIDGE_TLS_CHAIN_DEPTH_UPDATED; certificate verification remains required")
