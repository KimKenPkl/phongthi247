# -*- coding: utf-8 -*-
"""Tăng số phiên bản ?v=N cho CSS/JS để học sinh nhận bản mới (không dùng bản cũ trong cache).

Cách chạy, sau khi sửa bất kỳ file nào trong assets/:
    python scripts/bump_version.py

Script tìm số ?v= lớn nhất trong các trang HTML, cộng thêm 1,
rồi đặt mọi ?v= của file trong assets/ về số mới đó.
Không đụng tới link ngoài (Google Fonts...).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = sorted(list(ROOT.glob("*.html")) + list((ROOT / "admin").glob("*.html")) + list((ROOT / "report").glob("*.html")))
# chỉ bắt link tới assets/ nội bộ, ví dụ assets/app.css?v=12 hoặc ../assets/exam.js?v=13
REF = re.compile(r'((?:\.\./)?assets/[\w./-]+\.(?:css|js|svg))\?v=(\d+)')


def main() -> int:
    texts = {p: p.read_text(encoding="utf-8") for p in PAGES}
    found = [int(m.group(2)) for t in texts.values() for m in REF.finditer(t)]
    if not found:
        print("Không thấy ?v= nào trong các trang HTML.")
        return 1
    new = max(found) + 1
    changed = 0
    for p, t in texts.items():
        nt = REF.sub(lambda m: f"{m.group(1)}?v={new}", t)
        if nt != t:
            p.write_text(nt, encoding="utf-8", newline="")
            changed += 1
            print(f"  đã sửa {p.relative_to(ROOT)}")
    print(f"Xong: ?v= mới là {new} ({changed} trang). Nhớ commit và push.")
    return 0


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass
    sys.exit(main())
