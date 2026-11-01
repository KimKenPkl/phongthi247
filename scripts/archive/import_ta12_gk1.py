# -*- coding: utf-8 -*-
"""Import 'ĐỀ CƯƠNG ÔN TẬP GK1_TA12_GV.docx' -> data/tests/de-cuong-ta12-gk1.json

- 3 practice test x 40 cau trac nghiem (khong co anh).
- Dap an lay tu doan duoc to sang (highlight) trong ban GV.
- Ap 2 dieu chinh cua giao vien:
    Practice Test 3 - Question  9 -> A (Another)
    Practice Test 3 - Question 31 -> C (III)  [dong thoi sua option B tu [III] -> [II])
"""
from __future__ import annotations

import json
import re
from html import escape
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "scripts" / "_ta_extract" / "ĐỀ CƯƠNG ÔN TẬP GK1_TA12_GV.docx"
TEST_OUT = ROOT / "data" / "tests" / "de-cuong-ta12-gk1.json"
EXAMS_JSON = ROOT / "data" / "exams.json"
EXAM_ID = "de-cuong-ta12-gk1"

W = lambda t: qn("w:" + t)

# (test, question) -> answerIndex ; 0=A 1=B 2=C 3=D
OVERRIDES = {
    (3, 9): 0,
    (3, 31): 2,
}
# sua loi go sai phuong an: (test, question, optionIndex) -> text
OPTION_FIXES = {
    (3, 31, 1): "[II]",
}

OPT_RE = re.compile(r"(?:^|(?<=[\s]))([A-D])\.\s")


# ------------------------------------------------------------------ docx -> blocks
def para_segments(p_el):
    """[(text, highlighted)] theo dung thu tu."""
    segs = []
    for r in p_el.iter(W("r")):
        rPr = r.find(W("rPr"))
        hl = False
        if rPr is not None:
            h = rPr.find(W("highlight"))
            if h is not None and (h.get(W("val")) or "").lower() not in ("none", ""):
                hl = True
        for node in r:
            if node.tag == W("t"):
                segs.append((node.text or "", hl))
            elif node.tag == W("tab"):
                segs.append(("\t", hl))
            elif node.tag == W("br"):
                segs.append((" ", hl))
    return segs


def build_blocks(path: Path):
    doc = Document(path)
    blocks = []
    for child in list(doc.element.body):
        if child.tag.split("}")[-1] != "p":
            continue
        segs = para_segments(child)
        text = "".join(s for s, _ in segs)
        if not text.strip():
            continue
        hl_ranges = []
        pos = 0
        for s, hl in segs:
            if hl and s.strip():
                hl_ranges.append((pos, pos + len(s)))
            pos += len(s)
        blocks.append({"text": text, "hl": hl_ranges})
    return blocks


# ------------------------------------------------------------------ helpers
def clean(s: str) -> str:
    s = s.replace("\xa0", " ")
    s = re.sub(r"[ \t]{2,}", " ", s)
    return s.strip()


def htmlize(s: str) -> str:
    s = clean(s)
    parts = [escape(x) for x in s.split("\n")]
    return "<br>".join(p for p in parts if p.strip())


def is_question_start(t: str) -> re.Match | None:
    return re.match(r"\s*Question\s+(\d+)\s*:\s*", t)


def is_section_start(t: str) -> bool:
    t = t.strip()
    return t.startswith("Read the following") or t.startswith("Mark the letter")


# ------------------------------------------------------------------ parse
def split_options(block):
    text = block["text"]
    picked, wi = [], 0
    for m in OPT_RE.finditer(text):
        if wi < 4 and m.group(1) == "ABCD"[wi]:
            picked.append((m.group(1), m.start(), m.end()))
            wi += 1
    if len(picked) != 4:
        return None

    def hl_in(a, b):
        return any(s < b and e > a for s, e in block["hl"])

    opts, keys = [], []
    for i in range(4):
        start = picked[i][1]          # gồm cả nhãn "B." (đôi khi nhãn được tô màu)
        body_start = picked[i][2]
        end = picked[i + 1][1] if i < 3 else len(text)
        opts.append(htmlize(text[body_start:end]))
        keys.append(hl_in(start, end))
    stem = text[: picked[0][1]]
    return stem, opts, keys


def parse():
    blocks = build_blocks(SRC)

    # tach theo PRACTICE TEST
    tests, cur = [], None
    for b in blocks:
        m = re.match(r"\s*PRACTICE TEST\s+(\d+)\s*$", b["text"].strip(), re.I)
        if m:
            cur = {"no": int(m.group(1)), "blocks": []}
            tests.append(cur)
            continue
        if cur is not None:
            cur["blocks"].append(b)

    all_questions, report = [], []
    for t in tests:
        tno = t["no"]
        section = {"instr": "", "passage": []}
        qblocks, cur_q = [], None

        def flush_q():
            nonlocal cur_q
            if cur_q is not None:
                qblocks.append(cur_q)
                cur_q = None

        for b in t["blocks"]:
            txt = b["text"]
            if is_question_start(txt):
                flush_q()
                m = is_question_start(txt)
                cur_q = {"no": int(m.group(1)), "blocks": [b], "section": dict(section)}
            elif is_section_start(txt):
                flush_q()
                section = {"instr": clean(txt), "passage": []}
            elif cur_q is not None:
                cur_q["blocks"].append(b)
            else:
                section["passage"].append(b)
        flush_q()

        for q in qblocks:
            combined = {
                "text": "\n".join(x["text"] for x in q["blocks"]),
                "hl": [],
            }
            # offset lai hl ranges
            off = 0
            for x in q["blocks"]:
                for s, e in x["hl"]:
                    combined["hl"].append((s + off, e + off))
                off += len(x["text"]) + 1

            res = split_options(combined)
            if res is None:
                report.append((tno, q["no"], "NO_OPTIONS", combined["text"][:90]))
                opts = ["", "", "", ""]
                key = -1
                stem = combined["text"]
            else:
                stem, opts, hls = res
                idxs = [i for i, v in enumerate(hls) if v]
                key = idxs[0] if len(idxs) == 1 else (-1 if not idxs else idxs[0])
                if len(idxs) != 1:
                    report.append((tno, q["no"], f"HL_COUNT={len(idxs)}", str(idxs)))

            if (tno, q["no"]) in OVERRIDES:
                new = OVERRIDES[(tno, q["no"])]
                report.append((tno, q["no"], f"OVERRIDE {key}->{new}", ""))
                key = new
            for oi, new_text in OPTION_FIXES.items():
                if oi[0] == tno and oi[1] == q["no"]:
                    report.append((tno, q["no"], f"OPTION_FIX {oi[2]}", opts[oi[2]] + " -> " + new_text))
                    opts[oi[2]] = new_text

            # bo "Question N:" o dau stem
            stem = re.sub(r"^\s*Question\s+\d+\s*:\s*", "", stem)

            # gop passage
            pblocks = q["section"]["passage"]
            pas_html = ""
            if pblocks:
                inner = "<br>".join(htmlize(x["text"]) for x in pblocks)
                instr = q["section"]["instr"]
                pas_html = (
                    '<div style="background:#f7f5ff;border-left:3px solid #7c6bd6;'
                    'padding:8px 12px;margin:6px 0 8px;border-radius:6px;font-size:0.96em">'
                    + (f'<em style="color:#5b5b6b">{escape(instr)}</em><br>' if instr else "")
                    + inner
                    + "</div>"
                )

            # cau truc sap xep a./b./c.: tach dong
            stem = re.sub(r"(?<=[.!?])\s+(?=[b-e]\.\s)", "<br>", htmlize(stem))

            badge = (
                f'<span class="badge" style="margin-bottom:4px">'
                f"PRACTICE TEST {tno} · CÂU {q['no']}</span>"
            )
            content = badge + "<br>" + pas_html + stem

            all_questions.append({
                "part": 1,
                "content": content,
                "options": opts,
                "answerIndex": key,
            })

    return all_questions, report


def main():
    qs, report = parse()
    print("questions:", len(qs))
    print("report:")
    for r in report:
        print("   ", r)

    bad = [i for i, q in enumerate(qs, 1)
           if len(q["options"]) != 4 or any(not o.strip() for o in q["options"]) or q["answerIndex"] < 0]
    print("cau loi:", bad)

    exam = {
        "schema": 1,
        "id": EXAM_ID,
        "title": "Đề cương ôn tập giữa kì 1 – Tiếng Anh 12 (2026–2027)",
        "subject": "Tiếng Anh 12 – 3 Practice Tests (Global Success)",
        "code": "TA12",
        "hasPassword": False,
        "durationMin": 180,
        "shuffleQuestions": False,
        "shuffleOptions": False,
        "showAnswersAfterSubmit": True,
        "scoring": {"strictPart2": True, "part1": 0.25,
                    "part2": [0.1, 0.25, 0.5, 1.0], "part3": 0.25},
        "parts": [
            {"part": 1,
             "label": "PHẦN I – TRẮC NGHIỆM NHIỀU LỰA CHỌN",
             "hint": "120 câu (3 practice test × 40 câu). Mỗi câu có 4 phương án, chọn 1 đáp án đúng.",
             "points": "0,25 điểm/câu"},
        ],
        "questions": qs,
    }
    TEST_OUT.write_text(json.dumps(exam, ensure_ascii=False, indent=1), encoding="utf-8")
    print("WROTE", TEST_OUT)

    data = json.loads(EXAMS_JSON.read_text(encoding="utf-8"))
    lst = data["exams"]
    lst[:] = [e for e in lst if e.get("id") != EXAM_ID]
    entry = {
        "id": EXAM_ID,
        "title": exam["title"],
        "subject": exam["subject"],
        "count": len(qs),
        "durationMin": 180,
        "code": "TA12",
        "hasPassword": False,
        "desc": "120 câu trắc nghiệm: 3 practice test × 40 câu (đọc hiểu, điền khuyết, sắp xếp câu, từ vựng – ngữ pháp).",
    }
    idx = next((k for k, e in enumerate(lst) if e.get("id") == "de-cuong-toan12-gk1"), None)
    if idx is None:
        lst.append(entry)
    else:
        lst.insert(idx + 1, entry)
    data["updated"] = "2026-10-29"
    EXAMS_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print("UPDATED exams.json")


if __name__ == "__main__":
    main()
