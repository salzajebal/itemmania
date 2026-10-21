"""Build lossless, unicode-ranged subsets of the captured public fonts.

Run with python3 scripts/build-font-subsets.py before the API build.
Original glyphs, metrics, hinting and layout tables are retained. No member
content is read; uncommon characters load an additional subset on demand.
"""
import base64
import hashlib
import io
import json
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT.parents[1] / "generated-artifacts" / "font-subsets"


def ranges(points):
    result = []
    for point in sorted(points):
        if result and point == result[-1][1] + 1:
            result[-1][1] = point
        else:
            result.append([point, point])
    return ",".join(f"U+{a:X}" if a == b else f"U+{a:X}-{b:X}" for a, b in result)


def standard_korean(point):
    try:
        return len(chr(point).encode("euc_kr")) == 2
    except UnicodeEncodeError:
        return False


def build():
    import re
    OUTPUT.mkdir(parents=True, exist_ok=True)
    originals = {}
    # Public CSS font bytes only, never captured images or customer records.
    for path in (ROOT / "src" / "static").glob("*.html"):
        for encoded in re.findall(r"data:font/woff2;base64,([A-Za-z0-9+/=]+)", path.read_text()):
            data = base64.b64decode(encoded)
            if data[:4] == b"wOF2":
                originals[hashlib.sha256(data).hexdigest()] = data
    manifest = {}
    for original_hash, data in originals.items():
        original = TTFont(io.BytesIO(data))
        cmap = original.getBestCmap()
        # Icon fonts are tiny already and must retain their original delivery.
        if len(data) < 100_000 or len(cmap) < 5000:
            continue
        common = {p for p in cmap if not 0xAC00 <= p <= 0xD7A3 or standard_korean(p)}
        rare = set(cmap) - common
        groups = [common] + [
            {p for p in rare if block <= p < block + 1024}
            for block in range(0xAC00, 0xD7A4, 1024)
        ]
        entries = []
        covered = set()
        for points in filter(None, groups):
            font = TTFont(io.BytesIO(data))
            options = subset.Options()
            options.layout_features = ["*"]
            options.name_IDs = ["*"]
            options.retain_gids = True
            worker = subset.Subsetter(options=options)
            worker.populate(unicodes=points)
            worker.subset(font)
            produced = font.getBestCmap()
            assert points <= set(produced), "Subset lost a requested character"
            for point in points:
                assert font["hmtx"][produced[point]] == original["hmtx"][cmap[point]], "Metrics changed"
            covered.update(points)
            output = io.BytesIO()
            font.flavor = "woff2"
            font.save(output)
            content = output.getvalue()
            digest = hashlib.sha256(content).hexdigest()
            (OUTPUT / f"{digest}.woff2").write_bytes(content)
            entries.append({"hash": digest, "range": ranges(points)})
        assert covered == set(cmap), "Unicode coverage changed"
        manifest[original_hash] = entries
        print(f"{original_hash[:12]}: {len(data)} bytes -> common {len((OUTPUT / (entries[0]['hash'] + '.woff2')).read_bytes())} bytes; full Unicode coverage retained", flush=True)
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest))


if __name__ == "__main__":
    build()
