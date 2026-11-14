"""Check local APK allowlist, page links and checksum; no Android runtime claims."""
import hashlib
import json
import posixpath
import re
import zipfile
from pathlib import Path
from urllib.parse import unquote, urlsplit

repo = Path(__file__).resolve().parents[1]
apk = repo / "downloads/phongthi247-trial.apk"
digest = hashlib.sha256(apk.read_bytes()).hexdigest()
assert (repo / "downloads/phongthi247-trial.sha256").read_text().split()[0] == digest
with zipfile.ZipFile(apk) as package:
    names = set(package.namelist())
    assert not any(n.endswith((".p12", ".jks", ".dotm", ".xlsm")) for n in names)
    assert not any("/data/tests/" in n or "/data/bank/" in n for n in names)
    assert json.loads(package.read("assets/www/data/exams.json").decode("utf-8-sig")) == {"exams": []}
    pages = [n for n in names if n.startswith("assets/www/") and n.endswith(".html")]
    missing = []
    for page in pages:
        html = package.read(page).decode("utf-8-sig")
        for ref in re.findall(r'(?:href|src)="([^"]+)"', html):
            url = urlsplit(ref)
            if url.scheme or ref.startswith(("#", "//")):
                continue
            target = posixpath.normpath(posixpath.join(posixpath.dirname(page), unquote(url.path)))
            if target not in names:
                missing.append((page, ref))
    assert not missing, f"Missing bundled references: {missing}"
print(f"PASS APK: {len(pages)} pages, local references resolve, no keys/banks/vendor add-ins; SHA256 {digest}")
