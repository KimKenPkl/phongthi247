# -*- coding: utf-8 -*-
"""Kiểm tra kỹ data/tests/de-cuong-gk1-2627.json sinh ra từ import_decuong_gk1.py."""
from collections import Counter
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
J = ROOT / "data" / "tests" / "de-cuong-gk1-2627.json"
exam = json.loads(J.read_text(encoding="utf-8"))
qs = exam["questions"]

print("meta:", exam["id"], "| code", exam["code"], "| dur", exam["durationMin"])
print("parts:", Counter(q["part"] for q in qs))
p1 = [q for q in qs if q["part"] == 1]
p2 = [q for q in qs if q["part"] == 2]
p3 = [q for q in qs if q["part"] == 3]
print("P1 đáp án ABCD:", Counter("ABCD"[q["answerIndex"]] for q in p1 if q["answerIndex"] is not None))
print("P2 đáp Đ/S tổng:", Counter([s["answer"] for q in p2 for s in q["statements"]]))

bad = []
for i, q in enumerate(qs, 1):
    part = q["part"]
    if part == 1:
        if len(q.get("options", [])) != 4:
            bad.append((i, "options≠4", len(q.get("options", []))))
        if not str(q.get("content", "")).strip():
            bad.append((i, "content rỗng"))
        if any(not str(o).strip() for o in q.get("options", [])):
            bad.append((i, "option rỗng"))
        if re.search(r"không tải được|img_error", str(q.get("content", ""))):
            bad.append((i, "ảnh lỗi trong content"))
        if q.get("answerIndex") is None:
            bad.append((i, "thiếu đáp án"))
    elif part == 2:
        sts = q.get("statements", [])
        if len(sts) != 4:
            bad.append((i, "số ý≠4", len(sts)))
        for j, s in enumerate(sts):
            if len(str(s.get("text", "")).strip()) < 6:
                bad.append((i, f"ý{j+1} quá ngắn", str(s.get("text", ""))[:60]))
        if all(s["answer"] is True for s in sts):
            bad.append((i, "cả 4 ý đều ĐÚNG (đáng ngờ)"))
        if all(s["answer"] is False for s in sts):
            bad.append((i, "cả 4 ý đều SAI (đáng ngờ)"))
        if not str(q.get("content", "")).strip():
            bad.append((i, "content rỗng"))
    elif part == 3:
        if q.get("answer") is None:
            bad.append((i, "thiếu Đáp số"))
        if not str(q.get("content", "")).strip():
            bad.append((i, "content rỗng"))

print(f"\nBAD = {len(bad)} mục:")
for b in bad[:40]:
    print("   ", b)

print("\n--- P1: dòng đầu mỗi câu + đáp án ---")
for i, q in enumerate(p1, 1):
    head = re.sub(r"<[^>]+>", " ", str(q["content"])).strip()[:70]
    print(f"{i:02d} ['ABCD'[q['answerIndex']]] {head}")

print("\n--- P2: chi tiet tung y (soi mat doan dau) ---")
for i, q in enumerate(p2, 1):
    head = re.sub(r"<[^>]+>", " ", str(q["content"])).strip()[:70]
    print(f"Q{i:02d} {head}")
    for j, s in enumerate(q["statements"]):
        mark = "D" if s["answer"] else "S"
        st = re.sub(r"<[^>]+>", " ", str(s["text"])).strip()
        print(f"    {mark}) {st[:110]}")

print("\n--- P3: đáp số ---")
for i, q in enumerate(p3, 1):
    print(f"{i:02d} [{q['answer']}] {re.sub(r'<[^>]+>', ' ', str(q['content'])).strip()[:60]}")

# ảnh tham chiếu
imgs = set()
for q in qs:
    imgs.update(re.findall(r"data/img/de-cuong-gk1-2627/[\w.]+", str(q.get("content", ""))))
print("\nảnh tham chiếu:", len(imgs))
missing = []
for ref in sorted(imgs):
    p = ROOT / ref
    if not p.exists() or p.stat().st_size == 0:
        missing.append(ref)
print("file ảnh thiếu/rỗng:", missing if missing else "không")
sizes = []
imgdir = ROOT / "data" / "img" / "de-cuong-gk1-2627"
for f in sorted(imgdir.iterdir()):
    sizes.append((f.name, f.stat().st_size))
print("tổng file ảnh trong thư mục:", len(sizes))
for name, sz in sizes:
    print(f"   {name}: {sz/1024:.1f} KB")
