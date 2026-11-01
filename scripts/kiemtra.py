# -*- coding: utf-8 -*-
"""Kiểm tra dữ liệu Phòng Thi 24/7 trước khi push.

Cách chạy (từ thư mục gốc repo hoặc bất kỳ đâu):
    python scripts/kiemtra.py

Chỉ ĐỌC, không sửa file nào. Kết thúc bằng mã 0 nếu không có LỖI,
mã 1 nếu có LỖI (GitHub Actions sẽ báo đỏ).
CẢNH BÁO thì không chặn, nhưng nên xem.

Những gì được kiểm tra:
  - data/config.json và data/exams.json đọc được (JSON hợp lệ)
  - mỗi mục trong exams.json: id không trùng, có title, category hợp lệ,
    file đề data/tests/<id>.json tồn tại (trừ mục có customUrl),
    count khớp số câu, các file docHsUrl / docKeyUrl / customUrl tồn tại
  - mỗi câu hỏi: Phần I có 4 phương án và answerIndex 0..3,
    Phần II có các ý với answer true/false, Phần III có answer
  - mọi ảnh <img src="data/img/..."> trong đề đều có file thật
  - file đề trong data/tests/ nhưng chưa khai báo trong exams.json
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATEGORIES = {"toan", "tieng-anh", "hoa", "ly", "sinh", "tin", "su", "gdqp", "van"}
IMG_RE = re.compile(r'src=["\']([^"\']+)["\']')

errors: list[str] = []
warnings: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def warn(msg: str) -> None:
    warnings.append(msg)


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        err(f"Thiếu file: {path.relative_to(ROOT)}")
    except json.JSONDecodeError as e:
        err(f"{path.relative_to(ROOT)}: JSON hỏng ở dòng {e.lineno}, cột {e.colno} ({e.msg})")
    return None


def exists_rel(rel: str) -> bool:
    rel = rel.split("?")[0].split("#")[0]
    return (ROOT / rel).exists()


def check_question(tag: str, q: dict) -> None:
    part = q.get("part")
    if not str(q.get("content", "")).strip():
        err(f"{tag}: thiếu nội dung câu hỏi (content)")
    if part == 1:
        opts = q.get("options")
        if not isinstance(opts, list) or len(opts) != 4:
            err(f"{tag}: Phần I phải có đúng 4 phương án (đang có {len(opts) if isinstance(opts, list) else 0})")
        ai = q.get("answerIndex")
        if not isinstance(ai, int) or isinstance(ai, bool) or not 0 <= ai <= 3:
            err(f"{tag}: answerIndex phải là 0, 1, 2 hoặc 3 (A=0, B=1, C=2, D=3), đang là {ai!r}")
    elif part == 2:
        sts = q.get("statements")
        if not isinstance(sts, list) or not sts:
            err(f"{tag}: Phần II thiếu các ý (statements)")
            return
        if len(sts) != 4:
            warn(f"{tag}: Phần II có {len(sts)} ý (thường là 4)")
        for j, s in enumerate(sts):
            if not isinstance(s.get("answer"), bool):
                err(f"{tag} ý {'abcd'[j] if j < 4 else j + 1}: answer phải là true/false, đang là {s.get('answer')!r}")
            if not str(s.get("text", "")).strip():
                err(f"{tag} ý {'abcd'[j] if j < 4 else j + 1}: thiếu nội dung ý")
    elif part == 3:
        a = q.get("answer")
        if a is None or str(a).strip() == "":
            err(f"{tag}: Phần III thiếu đáp án (answer)")
    else:
        err(f"{tag}: part phải là 1, 2 hoặc 3, đang là {part!r}")


SCHED_KEYS = ("openAt", "closeAt", "maxAttempts", "hideKeyUntilClose")
TIME_RE = re.compile(r"\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?(Z|[+-]\d{2}:?\d{2})?")


def parse_vn_time(s):
    """Giống parseVNTime() trong common.js: không ghi múi giờ thì hiểu là giờ Việt Nam."""
    from datetime import datetime, timedelta, timezone
    t = str(s).strip().replace(" ", "T")
    if len(t) == 10:
        t += "T00:00"
    t = t.replace("Z", "+00:00")
    try:
        d = datetime.fromisoformat(t)
    except ValueError:
        return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone(timedelta(hours=7)))
    return d


def check_schedule(tag: str, t: dict) -> None:
    times = {}
    for k in ("openAt", "closeAt"):
        v = t.get(k)
        if not v:
            continue
        if not isinstance(v, str) or not TIME_RE.fullmatch(v.strip()) or parse_vn_time(v) is None:
            err(f"{tag}: {k} phải có dạng \"2026-11-20T07:30\" (giờ Việt Nam), đang là {v!r}")
        else:
            times[k] = parse_vn_time(v)
    if len(times) == 2 and times["closeAt"] <= times["openAt"]:
        err(f"{tag}: closeAt phải sau openAt")
    m = t.get("maxAttempts")
    if m is not None and (not isinstance(m, int) or isinstance(m, bool) or m < 0):
        err(f"{tag}: maxAttempts phải là số nguyên ≥ 0 (0 = không giới hạn), đang là {m!r}")
    h = t.get("hideKeyUntilClose")
    if h is not None and not isinstance(h, bool):
        err(f"{tag}: hideKeyUntilClose phải là true hoặc false, đang là {h!r}")
    if h and "closeAt" not in times:
        warn(f"{tag}: hideKeyUntilClose = true nhưng chưa có closeAt, học sinh sẽ không bao giờ thấy đáp án")


def check_images(tag: str, raw: str) -> None:
    missing = sorted({s for s in IMG_RE.findall(raw.replace('\\"', '"'))
                      if not s.startswith(("http://", "https://", "data:")) and not exists_rel(s)})
    for s in missing[:10]:
        err(f"{tag}: ảnh không tồn tại: {s}")
    if len(missing) > 10:
        err(f"{tag}: ... và {len(missing) - 10} ảnh khác cũng thiếu")


def main() -> int:
    load_json(ROOT / "data" / "config.json")
    idx = load_json(ROOT / "data" / "exams.json")
    if idx is None:
        return report()
    exams = idx.get("exams")
    if not isinstance(exams, list):
        err("data/exams.json: thiếu mảng \"exams\"")
        return report()

    seen: set[str] = set()
    for i, e in enumerate(exams, 1):
        eid = e.get("id") or ""
        tag = f"exams.json mục {i} ({eid or 'không có id'})"
        if not eid:
            err(f"{tag}: thiếu id")
            continue
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", eid):
            err(f"{tag}: id chỉ dùng chữ thường không dấu, số và dấu gạch ngang")
        if eid in seen:
            err(f"{tag}: id bị trùng")
        seen.add(eid)
        if not str(e.get("title", "")).strip():
            err(f"{tag}: thiếu title")
        cat = e.get("category")
        if cat not in CATEGORIES:
            err(f"{tag}: category phải là một trong {sorted(CATEGORIES)}, đang là {cat!r}")
        for key in ("docHsUrl", "docKeyUrl", "customUrl"):
            if e.get(key) and not exists_rel(e[key]):
                err(f"{tag}: {key} trỏ tới file không tồn tại: {e[key]}")
        if e.get("customUrl"):
            continue

        tpath = ROOT / "data" / "tests" / f"{eid}.json"
        if not tpath.exists():
            err(f"{tag}: không có file đề data/tests/{eid}.json")
            continue
        raw = tpath.read_text(encoding="utf-8")
        t = load_json(tpath)
        if t is None:
            continue
        ttag = f"data/tests/{eid}.json"
        if t.get("id") != eid:
            err(f"{ttag}: id bên trong file là {t.get('id')!r}, phải trùng tên file ({eid!r})")
        qs = t.get("questions") or []
        if not qs:
            err(f"{ttag}: không có câu hỏi nào")
        if e.get("count") != len(qs):
            err(f"{tag}: count = {e.get('count')} nhưng file đề có {len(qs)} câu")
        if not e.get("durationMin"):
            warn(f"{tag}: thiếu durationMin (số phút)")
        check_schedule(ttag, t)
        for k in SCHED_KEYS:
            if t.get(k) != e.get(k) and (t.get(k) or e.get(k)):
                warn(f"{tag}: {k} trong exams.json ({e.get(k)!r}) khác file đề ({t.get(k)!r}). "
                     "Trang thi dùng file đề; trang chủ dùng exams.json — nên sửa cho giống nhau")
        for k, q in enumerate(qs, 1):
            check_question(f"{ttag} câu {k} (Phần {q.get('part')})", q)
        check_images(ttag, raw)

    for f in sorted((ROOT / "data" / "tests").glob("*.json")):
        if f.stem not in seen:
            warn(f"data/tests/{f.name}: có file đề nhưng chưa khai báo trong exams.json (học sinh không thấy)")
    return report()


def report() -> int:
    for w in warnings:
        print(f"CẢNH BÁO  {w}")
    for x in errors:
        print(f"LỖI       {x}")
    print(f"\nKết quả: {len(errors)} lỗi, {len(warnings)} cảnh báo.")
    if errors:
        print("Sửa hết LỖI rồi mới push.")
        return 1
    print("Dữ liệu ổn, có thể push.")
    return 0


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass
    sys.exit(main())
