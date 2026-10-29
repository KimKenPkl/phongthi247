# -*- coding: utf-8 -*-
"""Audit toan bo de cuong: chi DOC, khong sua bat ky file du lieu nao.

Xuat: reports/audit-de-cuong-<date>.md + .json
"""
from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import date
from html import unescape
from pathlib import Path

ROOT = Path(r"D:\phongthi247")
TESTS = ROOT / "data" / "tests"
REPORTS = ROOT / "reports"

TAG_RE = re.compile(r"<[^>]+>")


def plain(s: str) -> str:
    if not s:
        return ""
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    s = TAG_RE.sub(" ", s)
    s = unescape(s)
    s = s.replace("\xa0", " ")
    return re.sub(r"\s+", " ", s).strip()


def norm(s: str) -> str:
    s = plain(s).lower()
    s = unicodedata.normalize("NFC", s)
    s = re.sub(r"[\s]+", " ", s)
    return s.strip()


def sig(s: str) -> str:
    """Chữ ký so sánh: văn bản + danh sách ảnh (để phương án chỉ có ảnh không bị coi là rỗng/trùng)."""
    txt = norm(s)
    imgs = tuple(sorted(image_refs(s)))
    if not imgs:
        return txt
    return txt + " || " + " | ".join(imgs)


def tag_balance(s: str) -> list[str]:
    issues = []
    if not s:
        return issues
    for tag in ("sub", "sup", "strong", "em", "span", "table", "tr", "td", "th"):
        opens = len(re.findall(rf"<{tag}\b[^>]*>", s, re.I))
        closes = len(re.findall(rf"</{tag}\s*>", s, re.I))
        if opens != closes:
            issues.append(f"<{tag}> {opens}/{closes}")
    return issues


def image_refs(s: str) -> list[str]:
    if not s:
        return []
    return re.findall(r'<img[^>]+src="([^"]+)"', s, re.I)


def is_number_answer(a) -> bool:
    if isinstance(a, bool):
        return False
    if isinstance(a, (int, float)):
        return True
    if not isinstance(a, str):
        return False
    t = a.strip().replace(" ", "")
    if not t:
        return False
    t = t.replace(",", ".")
    return bool(re.fullmatch(r"-?\d+(\.\d+)?", t))


def audit_file(p: Path) -> dict:
    d = json.loads(p.read_text(encoding="utf-8"))
    qs = d.get("questions", [])
    title = d.get("title", p.stem)
    issues: list[dict] = []
    img_checked: set[str] = set()

    def add(qidx, part, code, msg, qnum=None):
        issues.append({
            "question_index": qidx,
            "question_number": qnum,
            "part": part,
            "code": code,
            "message": msg,
        })

    def check_images(qidx, part, qnum, *fields):
        for label, val in fields:
            for src in image_refs(val):
                if src in img_checked:
                    continue
                img_checked.add(src)
                fp = ROOT / src.replace("/", "\\")
                if not fp.exists():
                    add(qidx, part, "IMG_MISSING", f"Ảnh không tồn tại: {src} (trong {label})", qnum)

    # numbering maps
    counters = defaultdict(int)
    seen_content: dict[tuple, list[int]] = {}

    for qi, q in enumerate(qs):
        part = q.get("part")
        counters[part] += 1
        qnum = counters[part]

        raw_content = q.get("content", "") or ""
        content = plain(raw_content)
        if not content and not image_refs(raw_content):
            add(qi, part, "CONTENT_EMPTY", "Nội dung câu hỏi rỗng", qnum)

        bal = tag_balance(raw_content)
        if bal:
            add(qi, part, "HTML_UNBALANCED", "Thẻ HTML lệch: " + ", ".join(bal), qnum)

        # numbering declared in content (bỏ qua đề đánh số theo từng Bài)
        plain_content = plain(raw_content)
        m = re.search(r"\bCâu\s*(\d+)\b", plain_content)
        if m and m.group(1).isdigit():
            declared = int(m.group(1))
            prefix = plain_content[: m.start()].lower()
            if "bài" not in prefix and declared != qnum:
                add(qi, part, "NUMBERING", f"Nội dung ghi 'Câu {declared}' nhưng là câu thứ {qnum} của phần {part}", qnum)

        check_images(qi, part, qnum, ("content", raw_content))

        if part == 1:
            dup_key = (part, sig(raw_content), tuple(sig(o) for o in (q.get("options") or [])))
        elif part == 2:
            dup_key = (part, sig(raw_content), tuple(sig(s.get("text", "")) for s in (q.get("statements") or [])))
        else:
            dup_key = (part, sig(raw_content), str(q.get("answer")))
        if len(dup_key[1]) >= 25:
            seen_content.setdefault(dup_key, []).append(qi)

        if part == 1:
            opts = q.get("options") or []
            if len(opts) != 4:
                add(qi, 1, "P1_OPT_COUNT", f"Có {len(opts)} phương án (cần 4)", qnum)
            for oi, o in enumerate(opts):
                lab = "ABCD"[oi] if oi < 4 else f"#{oi+1}"
                if not plain(o) and not image_refs(o):
                    add(qi, 1, "P1_OPT_EMPTY", f"Phương án {lab} rỗng", qnum)
                b = tag_balance(o)
                if b:
                    add(qi, 1, "HTML_UNBALANCED", f"Phương án {lab} lệch thẻ: " + ", ".join(b), qnum)
                for src in image_refs(o):
                    if src not in img_checked:
                        img_checked.add(src)
                        if not (ROOT / src.replace("/", "\\")).exists():
                            add(qi, 1, "IMG_MISSING", f"Ảnh không tồn tại: {src} (phương án {lab})", qnum)
                    if o.strip().startswith(("A.", "B.", "C.", "D.")):
                        add(qi, 1, "P1_OPT_LABEL", f"Phương án {lab} còn sót nhãn đầu dòng", qnum)
            norm_opts = [sig(o) for o in opts]
            for a in range(len(norm_opts)):
                for b in range(a + 1, len(norm_opts)):
                    if norm_opts[a] and norm_opts[a] == norm_opts[b]:
                        add(qi, 1, "P1_OPT_DUP",
                            f"Phương án {'ABCD'[a]} và {'ABCD'[b]} trùng nhau: “{plain(opts[a])[:70]}”", qnum)
            ai = q.get("answerIndex")
            if not isinstance(ai, int) or isinstance(ai, bool) or not (0 <= ai < max(1, len(opts))):
                add(qi, 1, "P1_ANSWER_RANGE", f"answerIndex={ai!r} không hợp lệ (0..{len(opts)-1})", qnum)
            elif sig(opts[ai]) and any(
                sig(opts[ai]) == sig(opts[k]) for k in range(len(opts)) if k != ai
            ):
                add(qi, 1, "P1_ANSWER_AMBIGUOUS", f"Đáp án { 'ABCD'[ai] } trùng nội dung với phương án khác", qnum)

        elif part == 2:
            sts = q.get("statements") or []
            if len(sts) != 4:
                add(qi, 2, "P2_STMT_COUNT", f"Có {len(sts)} ý (cần 4: a,b,c,d)", qnum)
            truths = []
            norm_sts = []
            for si, st in enumerate(sts):
                lab = "abcd"[si] if si < 4 else f"#{si+1}"
                txt = st.get("text", "") or ""
                if not plain(txt) and not image_refs(txt):
                    add(qi, 2, "P2_STMT_EMPTY", f"Ý {lab}) rỗng", qnum)
                b = tag_balance(txt)
                if b:
                    add(qi, 2, "HTML_UNBALANCED", f"Ý {lab}) lệch thẻ: " + ", ".join(b), qnum)
                for src in image_refs(txt):
                    if src not in img_checked:
                        img_checked.add(src)
                        if not (ROOT / src.replace("/", "\\")).exists():
                            add(qi, 2, "IMG_MISSING", f"Ảnh không tồn tại: {src} (ý {lab})", qnum)
                ans = st.get("answer")
                if not isinstance(ans, bool):
                    add(qi, 2, "P2_ANSWER_TYPE", f"Ý {lab}) answer={ans!r} không phải true/false", qnum)
                    truths.append(None)
                else:
                    truths.append(ans)
                norm_sts.append(sig(txt))
            if len(set(norm_sts)) < len([x for x in norm_sts if x]):
                add(qi, 2, "P2_STMT_DUP", "Có các ý trùng nội dung nhau", qnum)
            if len(sts) == 4 and all(t is not None for t in truths):
                if all(truths):
                    add(qi, 2, "P2_ALL_TRUE", "Cả 4 ý đều ĐÚNG (đáng kiểm tra lại)", qnum)
                elif not any(truths):
                    add(qi, 2, "P2_ALL_FALSE", "Cả 4 ý đều SAI (đáng kiểm tra lại)", qnum)

        elif part == 3:
            ans = q.get("answer")
            if ans is None or (isinstance(ans, str) and not ans.strip()):
                add(qi, 3, "P3_ANSWER_EMPTY", "Thiếu đáp án", qnum)
            elif not is_number_answer(ans):
                add(qi, 3, "P3_ANSWER_TEXT", f"Đáp án không phải số thuần: {ans!r}", qnum)
            else:
                # comma decimal / >2 decimals / negative
                s = str(ans).strip()
                if "," in s:
                    add(qi, 3, "P3_ANSWER_COMMA", f"Đáp án dùng dấu phẩy thập phân: {s!r}", qnum)

    # duplicates across questions
    for (part, txt, _sig), idxs in seen_content.items():
        if len(idxs) > 1:
            for qi in idxs[1:]:
                add(qi, part, "DUP_CONTENT",
                    f"Trùng nội dung với câu index {idxs[0]} (cùng phần {part})", None)

    # distribution P1
    p1 = [q for q in qs if q.get("part") == 1]
    dist = Counter("ABCD"[q["answerIndex"]] for q in p1
                   if isinstance(q.get("answerIndex"), int) and 0 <= q["answerIndex"] < 4)
    dist_issues = []
    if p1:
        for lab in "ABCD":
            share = dist.get(lab, 0) / len(p1)
            if share == 0:
                dist_issues.append(f"Không có đáp án {lab}")
            elif share > 0.40:
                dist_issues.append(f"Đáp án {lab} chiếm {share:.0%} ({dist[lab]}/{len(p1)})")

    return {
        "file": p.name,
        "id": d.get("id"),
        "title": title,
        "count": len(qs),
        "parts": dict(Counter(q.get("part") for q in qs)),
        "issues": issues,
        "answer_distribution": dict(dist),
        "distribution_issues": dist_issues,
    }


def main():
    REPORTS.mkdir(exist_ok=True)
    results = [audit_file(p) for p in sorted(TESTS.glob("de-cuong-*.json"))]
    # bo file ngan hang (khong phai de cuong) — glob da gioi han
    out_json = REPORTS / f"audit-de-cuong-{date.today().isoformat()}.json"
    out_json.write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")

    lines = [f"# Báo cáo rà soát đề cương — {date.today().strftime('%d/%m/%Y')}", ""]
    lines.append("Chỉ đọc dữ liệu, **không sửa đáp án**. Mục đích: liệt kê câu cần giáo viên bộ môn kiểm tra lại.")
    lines.append("")
    total = Counter()
    for r in results:
        code_counts = Counter(i["code"] for i in r["issues"])
        total.update(code_counts)
        lines.append(f"## {r['title']}")
        lines.append(f"- File: `{r['file']}` — {r['count']} câu (P1: {r['parts'].get(1,0)}, P2: {r['parts'].get(2,0)}, P3: {r['parts'].get(3,0)})")
        lines.append(f"- Phân bố đáp án P1: {r['answer_distribution']}")
        if r["distribution_issues"]:
            lines.append("- ⚠ Phân bố bất thường: " + "; ".join(r["distribution_issues"]))
        if not r["issues"]:
            lines.append("- ✅ Không phát hiện lỗi cấu trúc.")
        else:
            lines.append(f"- Tổng {len(r['issues'])} cảnh báo:")
            lines.append("")
            lines.append("| Phần | Câu | Mã | Nội dung |")
            lines.append("|---|---|---|---|")
            for it in r["issues"]:
                qn = it["question_number"] if it["question_number"] is not None else f"idx {it['question_index']}"
                msg = it["message"].replace("|", "\\|")
                lines.append(f"| {it['part']} | {qn} | `{it['code']}` | {msg} |")
        lines.append("")
    lines.append("## Tổng hợp theo mã lỗi")
    lines.append("")
    lines.append("| Mã | Số lượng |")
    lines.append("|---|---|")
    for k, v in total.most_common():
        lines.append(f"| `{k}` | {v} |")

    out_md = REPORTS / f"audit-de-cuong-{date.today().isoformat()}.md"
    out_md.write_text("\n".join(lines), encoding="utf-8")
    print("WROTE", out_md)
    print("WROTE", out_json)
    print()
    for r in results:
        cc = Counter(i["code"] for i in r["issues"])
        print(f"{r['file']}: {r['count']} câu, {len(r['issues'])} cảnh báo {dict(cc)}")
    print("\nTOTAL:", dict(total))


if __name__ == "__main__":
    main()
