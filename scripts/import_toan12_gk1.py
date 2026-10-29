# -*- coding: utf-8 -*-
"""Import 'ĐỀ CƯƠNG_F_HS.docx' (Toán 12 GK1) -> data/tests/de-cuong-toan12-gk1.json
+ ảnh công thức (WMF -> PNG) vào data/img/de-cuong-toan12-gk1/.

Cấu trúc nguồn:
- PHẦN I  : 60 câu TN, câu bắt đầu bằng paragraph có numPr; phương án trong paragraph
            chứa marker 'A.' 'B.' 'C.' 'D.' (có thể trải trên 2 paragraph).
- PHẦN II : 10 câu Đ/S — câu dẫn là paragraph numPr, 4 ý a) b) c) d) nằm trong <w:tbl>.
- PHẦN III: 20 câu trả lời ngắn — mỗi câu 1 paragraph numPr.
Đáp án lấy từ 'ĐÁP ÁN ĐỀ CƯƠNG GHKI_K12_26-27.docx' (hard-code bên dưới).
"""
from __future__ import annotations

import json
import re
import subprocess
import zipfile
from html import escape
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn

SRC = Path(r"D:\phongthi247\scripts\_toan_src.docx")
ROOT = Path(__file__).resolve().parents[1]
IMG_ID = "de-cuong-toan12-gk1"
IMG_OUT = ROOT / "data" / "img" / IMG_ID
TEST_OUT = ROOT / "data" / "tests" / f"{IMG_ID}.json"
EXAMS_JSON = ROOT / "data" / "exams.json"

VML = "{urn:schemas-microsoft-com:vml}imagedata"

# ---------------- ĐÁP ÁN (từ file ĐÁP ÁN ĐỀ CƯƠNG GHKI_K12_26-27.docx) ----------------
KEY_P1 = "A C C A D B C D A A B B A B B D D D A A D A B B D C C C D D C B C C C B A C D C D B D A D B C C C C B C A D C D A D A A".split()
KEY_P2 = [
    [False, True, True, False],
    [True, True, False, True],
    [True, True, False, True],
    [True, True, False, False],
    [True, False, True, True],
    [True, True, True, False],
    [True, False, False, True],
    [True, False, False, True],
    [True, False, True, True],
    [True, False, False, True],
]
KEY_P3 = ["5", "21", "3,2", "2", "173", "122", "10,3", "205", "3", "48",
          "1,9", "-21", "50", "9", "100", "3,50", "10", "9", "33", "10"]

assert len(KEY_P1) == 60, len(KEY_P1)


def W(tag):
    return qn("w:" + tag)


def load_relmap():
    with zipfile.ZipFile(SRC) as z:
        rels = z.read("word/_rels/document.xml.rels").decode("utf-8")
    relmap = {}
    for m in re.finditer(r"<Relationship\b[^>]*>", rels):
        tag = m.group(0)
        mid = re.search(r'Id="([^"]+)"', tag)
        mtg = re.search(r'Target="([^"]+)"', tag)
        if mid and mtg:
            relmap[mid.group(1)] = mtg.group(1)
    return relmap


REL_MAP = load_relmap()

PS_CONVERT = r"""
Add-Type -AssemblyName System.Drawing
$manifest = $args[0]
foreach ($line in [System.IO.File]::ReadAllLines($manifest, [System.Text.Encoding]::UTF8)) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $pair = $line -split '\|'
  $src = $pair[0]; $dst = $pair[1]
  try {
    $img = [System.Drawing.Image]::FromFile($src)
    $w = [int][math]::Round($img.Width * 3.0)
    $h = [int][math]::Round($img.Height * 3.0)
    if ($w -lt 10) { $w = 10 }
    if ($h -lt 10) { $h = 10 }
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear([System.Drawing.Color]::White)
    $g.DrawImage($img, 0, 0, $w, $h)
    $bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose(); $img.Dispose()
    Write-Output ("OK|" + (Split-Path -Leaf $dst))
  } catch {
    Write-Output ("ERR|" + (Split-Path -Leaf $dst))
  }
}
"""


def prep_images():
    IMG_OUT.mkdir(parents=True, exist_ok=True)
    tmp = ROOT / "scripts" / "_toan_tmp_media"
    tmp.mkdir(parents=True, exist_ok=True)
    media_map = {}
    conv = {}
    with zipfile.ZipFile(SRC) as z:
        members = set(z.namelist())
        for rid, tgt in REL_MAP.items():
            if not tgt:
                continue
            t = tgt.strip().lstrip("/")
            if t.lower().startswith("media/"):
                member = "word/" + t
            elif t.lower().startswith("word/media/"):
                member = t
            else:
                continue
            if member not in members:
                continue
            name = Path(member).name
            ext = Path(name).suffix.lower()
            if ext in (".png", ".jpg", ".jpeg", ".gif"):
                out = IMG_OUT / name
                if not out.exists():
                    out.write_bytes(z.read(member))
                media_map[name] = name
            elif ext in (".wmf", ".emf") and member not in conv:
                out_final = IMG_OUT / (name[:-4] + ".png")
                if out_final.exists() and out_final.stat().st_size > 0:
                    media_map[name] = out_final.name
                    continue
                src_file = tmp / name
                src_file.write_bytes(z.read(member))
                conv[member] = (str(src_file), str(out_final), name, out_final.name)
    stats = {"copy": len(media_map), "conv_ok": 0, "conv_fail": []}
    if conv:
        ps1 = ROOT / "scripts" / "_wmf2png.ps1"
        ps1.write_text(PS_CONVERT.strip(), encoding="utf-8")
        manifest = ROOT / "scripts" / "_toan_wmf_manifest.txt"
        manifest.write_text(
            "\n".join(f"{s}|{d}" for (s, d, _, _) in conv.values()),
            encoding="utf-8",
        )
        args = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass",
                "-File", str(ps1), str(manifest)]
        p = subprocess.run(args, capture_output=True, text=True,
                           encoding="utf-8", errors="replace")
        ok = set()
        for line in (p.stdout or "").splitlines():
            if line.startswith("OK|"):
                ok.add(line.split("|")[1])
        for (_, _, src_name, dest_name) in conv.values():
            if dest_name in ok and (IMG_OUT / dest_name).exists():
                media_map[src_name] = dest_name
                stats["conv_ok"] += 1
            else:
                media_map[src_name] = None
                stats["conv_fail"].append(src_name)
    stats["conv_total"] = len(conv)
    return media_map, stats


MEDIA = {}


def img_html(served, h_px=None):
    if not served:
        return ""
    style = "vertical-align:middle;margin:0 2px;max-width:100%"
    if h_px:
        h = max(10, min(h_px, 220))
        style = f"height:{h:.1f}px;width:auto;" + style
    else:
        style = "height:auto;max-height:220px;" + style
    return (f'<img class="qimg-inline" src="data/img/{IMG_ID}/{served}" style="{style}" '
            f'loading="lazy" decoding="async" alt="công thức">')


def run_flags(r_el):
    f = {"b": False, "i": False, "u": False, "sub": False, "sup": False}
    rPr = r_el.find(W("rPr"))
    if rPr is None:
        return f

    def _on(el, bad):
        if el is None:
            return False
        v = el.get(W("val"))
        if v is None:
            return True
        return v not in bad

    f["b"] = _on(rPr.find(W("b")), ("0", "false"))
    f["i"] = _on(rPr.find(W("i")), ("0", "false"))
    f["u"] = _on(rPr.find(W("u")), ("none",))
    va = rPr.find(W("vertAlign"))
    if va is not None:
        v = va.get(W("val"))
        f["sub"] = v == "subscript"
        f["sup"] = v == "superscript"
    return f


def size_of_image(container_xml, rid):
    """Trả về chiều cao hiển thị (px) của ảnh theo Word."""
    # DrawingML: <wp:extent cx cy/>
    m = re.search(r'<wp:extent cx="(\d+)" cy="(\d+)"', container_xml)
    if m:
        return int(m.group(2)) / 9525.0
    # VML: style="...height:18.5pt..."
    m = re.search(r"height:\s*([\d.]+)\s*pt", container_xml)
    if m:
        return float(m.group(1)) * 96.0 / 72.0
    return None


def para_pieces(p_el):
    """Trả về list piece theo đúng thứ tự tài liệu: text (có flags) hoặc img."""
    pieces = []
    seen = set()
    for r in p_el.iter(W("r")):
        fl = run_flags(r)
        rxml = r.xml
        for node in r.iter():
            if node is r:
                continue
            tag = node.tag
            if tag == W("t"):
                txt = (node.text or "").replace("\xa0", " ")
                if txt:
                    pieces.append({"kind": "text", "text": txt, "flags": fl})
            elif tag == W("br"):
                pieces.append({"kind": "br"})
            elif tag == W("tab"):
                pieces.append({"kind": "text", "text": " ", "flags": {}})
            elif tag == qn("a:blip"):
                rid = node.get(qn("r:embed"))
                if not rid or rid in seen:
                    continue
                seen.add(rid)
                tgt = REL_MAP.get(rid) or ""
                served = MEDIA.get(Path(tgt).name)
                pieces.append({"kind": "img", "html": img_html(served, size_of_image(rxml, rid)), "ok": bool(served)})
            elif tag == VML:
                rid = node.get(qn("r:id")) or node.get(qn("r:embed"))
                if not rid or rid in seen:
                    continue
                seen.add(rid)
                tgt = REL_MAP.get(rid) or ""
                served = MEDIA.get(Path(tgt).name)
                pieces.append({"kind": "img", "html": img_html(served, size_of_image(rxml, rid)), "ok": bool(served)})
    return pieces


def piece_text_html(p):
    t = escape(p["text"])
    fl = p["flags"]
    if fl.get("sub"):
        t = f"<sub>{t}</sub>"
    if fl.get("sup"):
        t = f"<sup>{t}</sup>"
    if fl.get("b"):
        t = f"<strong>{t}</strong>"
    if fl.get("i"):
        t = f"<em>{t}</em>"
    return t


def pieces_to_html(pieces, clean_spaces=True):
    out = []
    for p in pieces:
        if p["kind"] == "img":
            out.append(p["html"])
        elif p["kind"] == "br":
            out.append("<br>")
        else:
            out.append(piece_text_html(p))
    s = "".join(out)
    if clean_spaces:
        s = re.sub(r"[ \t]{2,}", " ", s)
    return s.strip()


def para_html(p_el):
    return pieces_to_html(para_pieces(p_el))


# ---------------- tách phương án A/B/C/D ----------------
OPT_RE = re.compile(r"(?:^|(?<=\s))([ABCD])\.\s*")


def split_options(pieces, want_stem=False):
    """Tách danh sách paragraph thành 4 phương án, giữ nguyên ảnh đúng vị trí."""
    # Gộp tất cả pieces (giữ ranh giới paragraph = space)
    flat = []
    for i, pcs in enumerate(pieces):
        if i:
            flat.append({"kind": "text", "text": " ", "flags": {}})
        flat.extend(pcs)

    # Đánh dấu vị trí marker trong chuỗi text
    marks = []
    text_buf = []
    pos = 0
    posmap = []  # (flat_index, char_start, char_end)
    for idx, p in enumerate(flat):
        if p["kind"] == "text":
            s = p["text"]
            posmap.append((idx, pos, pos + len(s)))
            text_buf.append(s)
            pos += len(s)
        elif p["kind"] == "br":
            posmap.append((idx, pos, pos))
            text_buf.append("\n")
            pos += 1
        else:
            posmap.append((idx, pos, pos))
            text_buf.append("\x00")
            pos += 1
    full = "".join(text_buf)

    for m in OPT_RE.finditer(full):
        marks.append((m.group(1), m.start(), m.end()))

    if len(marks) < 4:
        return None

    # Giữ 4 marker đầu tiên theo thứ tự A,B,C,D
    picked = []
    want = "ABCD"
    wi = 0
    for lab, s, e in marks:
        if wi < 4 and lab == want[wi]:
            picked.append((lab, s, e))
            wi += 1
    if len(picked) != 4:
        return None

    def render_range(a, b):
        """Render pieces trong khoảng char [a,b)."""
        out = []
        for idx, cs, ce in posmap:
            if ce < a or cs >= b:
                continue
            p = flat[idx]
            if p["kind"] == "text":
                seg = p["text"][max(a - cs, 0): max(0, min(b - cs, len(p["text"])))]
                if seg:
                    out.append(piece_text_html({"kind": "text", "text": seg, "flags": p["flags"]}))
            elif p["kind"] == "img":
                out.append(p["html"])
        return re.sub(r"[ \t]{2,}", " ", "".join(out)).strip()

    opts = []
    for i in range(4):
        start = picked[i][2]
        end = picked[i + 1][1] if i < 3 else len(full)
        opts.append(render_range(start, end))
    if want_stem:
        return render_range(0, picked[0][1]), opts
    return opts


# ---------------- duyệt body ----------------
def body_blocks(doc):
    out = []
    for child in doc.element.body.iterchildren():
        tag = child.tag.split("}")[-1]
        if tag == "p":
            pPr = child.find(W("pPr"))
            num = pPr is not None and pPr.find(W("numPr")) is not None
            out.append(("p", child, para_html(child), num))
        elif tag == "tbl":
            out.append(("tbl", child, "", False))
    return out


def table_rows(tbl_el):
    rows = []
    for tr in tbl_el.findall(W("tr")):
        cells = []
        for tc in tr.findall(W("tc")):
            htmls = []
            for p in tc.findall(W("p")):
                h = para_html(p)
                if h:
                    htmls.append(h)
            cells.append("<br>".join(htmls).strip())
        rows.append(cells)
    return rows


def main():
    global MEDIA
    MEDIA, st = prep_images()
    print("IMAGES:", st)

    doc = Document(SRC)
    blocks = body_blocks(doc)

    # tìm mốc phần
    i1 = i2 = i3 = None
    for i, (kind, el, html, num) in enumerate(blocks):
        txt = re.sub(r"<[^>]+>", "", html)
        if txt.startswith("PHẦN I") and i1 is None:
            i1 = i
        elif txt.startswith("PHẦN II") and i2 is None:
            i2 = i
        elif txt.startswith("PHẦN III") and i3 is None:
            i3 = i
    print("marks:", i1, i2, i3, "blocks:", len(blocks))

    # ---------- PHẦN I ----------
    starts = [i for i in range(i1 + 1, i2) if blocks[i][0] == "p" and blocks[i][3]]
    print("P1 questions:", len(starts))
    p1 = []
    for qi, s in enumerate(starts):
        e = starts[qi + 1] if qi + 1 < len(starts) else i2
        stem_parts, opt_paras = [], []
        for j in range(s, e):
            kind, el, html, num = blocks[j]
            if kind != "p":
                continue
            plain = re.sub(r"<[^>]+>", "", html)
            if re.search(r"(?:^|\s)A\.\s", " " + plain) and "B." in plain:
                opt_paras.append(el)
            else:
                if html.strip():
                    stem_parts.append(html)
        stem = "<br>".join(stem_parts)
        stem = re.sub(r"^<strong>Câu\s*\d+\.?\s*</strong>\s*", "", stem)
        opts = split_options([para_pieces(el) for el in opt_paras]) if opt_paras else None
        if not opts or len(opts) != 4 or any(not o.strip() for o in opts):
            # fallback: quét marker A./B./C./D. trên toàn bộ paragraph của câu
            all_pcs = [para_pieces(el) for (kind, el, _h, _n) in blocks[s:e] if kind == "p"]
            res = split_options(all_pcs, want_stem=True)
            if res:
                stem2, opts2 = res
                if len(opts2) == 4 and all(o.strip() for o in opts2):
                    stem, opts = stem2, opts2
        if not opts or len(opts) != 4:
            print("  !! Q", qi + 1, "options failed:", [re.sub(r"<[^>]+>", "", x)[:60] for x in (opts or [])])
            opts = (opts or []) + [""] * (4 - len(opts or []))
            opts = opts[:4]
        ans = "ABCD".index(KEY_P1[qi]) if qi < len(KEY_P1) else 0
        p1.append({"part": 1, "content": stem, "options": opts, "answerIndex": ans})

    # ---------- PHẦN II ----------
    p2 = []
    j = i2 + 1
    cur_stem = None
    while j < i3:
        kind, el, html, num = blocks[j]
        if kind == "p" and num:
            cur_stem = re.sub(r"^<strong>Câu\s*\d+\.?\s*</strong>\s*", "", html)
        elif kind == "tbl" and cur_stem is not None:
            rows = table_rows(el)
            stmts = []
            for row in rows:
                if not row:
                    continue
                lab = re.sub(r"<[^>]+>", "", row[0]).strip().lower()
                if lab in ("a)", "b)", "c)", "d)"):
                    stmts.append(row[1] if len(row) > 1 else "")
            if len(stmts) == 4:
                answers = KEY_P2[len(p2)] if len(p2) < len(KEY_P2) else [False] * 4
                p2.append({
                    "part": 2,
                    "content": cur_stem,
                    "statements": [{"text": t, "answer": answers[k]} for k, t in enumerate(stmts)],
                })
            else:
                print("  !! P2 table skipped, stmts:", len(stmts))
            cur_stem = None
        j += 1
    print("P2 questions:", len(p2))

    # ---------- PHẦN III ----------
    starts3 = [i for i in range(i3 + 1, len(blocks)) if blocks[i][0] == "p" and blocks[i][3]]
    print("P3 questions:", len(starts3))
    p3 = []
    for qi, s in enumerate(starts3):
        e = starts3[qi + 1] if qi + 1 < len(starts3) else len(blocks)
        parts = []
        for j in range(s, e):
            kind, el, html, num = blocks[j]
            if kind == "p" and html.strip():
                parts.append(html)
        txt = "<br>".join(parts)
        txt = re.sub(r"^<strong>Câu\s*\d+\.?\s*</strong>\s*", "", txt)
        p3.append({"part": 3, "content": txt, "answer": KEY_P3[qi] if qi < len(KEY_P3) else ""})

    exam = {
        "schema": 1,
        "id": IMG_ID,
        "title": "Đề cương ôn tập giữa kì 1 – Toán 12 (2026–2027)",
        "subject": "Toán 12 · Ứng dụng đạo hàm, Vectơ & Hệ trục toạ độ Oxyz",
        "code": "TOAN12",
        "hasPassword": False,
        "durationMin": 90,
        "shuffleQuestions": False,
        "shuffleOptions": False,
        "showAnswersAfterSubmit": True,
        "scoring": {"strictPart2": True, "part1": 0.25, "part2": [0.1, 0.25, 0.5, 1.0], "part3": 0.25},
        "parts": [
            {"part": 1, "label": "PHẦN I – TRẮC NGHIỆM NHIỀU LỰA CHỌN",
             "hint": "60 câu. Mỗi câu có 4 phương án, chỉ chọn 1 đáp án đúng.",
             "points": "0,25 điểm/câu"},
            {"part": 2, "label": "PHẦN II – TRẮC NGHIỆM ĐÚNG SAI",
             "hint": "10 câu. Mỗi câu có 4 ý a, b, c, d – tại mỗi ý em chọn Đúng hoặc Sai.",
             "points": "1 ý đúng 0,10 – 2 ý 0,25 – 3 ý 0,50 – đủ 4 ý 1,00 (QĐ 764/QĐ-BGDĐT 2024)."},
            {"part": 3, "label": "PHẦN III – TRẢ LỜI NGẮN",
             "hint": "20 câu. Điền đáp số (số nguyên hoặc số thập phân).",
             "points": "0,25 điểm/câu"},
        ],
        "questions": p1 + p2 + p3,
    }

    TEST_OUT.write_text(json.dumps(exam, ensure_ascii=False, indent=1), encoding="utf-8")
    print("WROTE", TEST_OUT, "questions:", len(exam["questions"]))

    # cập nhật exams.json
    data = json.loads(EXAMS_JSON.read_text(encoding="utf-8"))
    lst = data["exams"]
    lst[:] = [e for e in lst if e.get("id") != IMG_ID]
    entry = {
        "id": IMG_ID,
        "title": exam["title"],
        "subject": exam["subject"],
        "count": len(exam["questions"]),
        "durationMin": 90,
        "code": "TOAN12",
        "hasPassword": False,
        "desc": "90 câu: Phần I (60 câu TN, 0,25 đ/câu) – Phần II (10 câu Đ/S theo QĐ 764) – Phần III (20 câu trả lời ngắn, 0,25 đ/câu).",
    }
    # chèn sau đề Lý nếu có
    idx = next((k for k, e in enumerate(lst) if e.get("id") == "de-cuong-ly12-gk1"), None)
    if idx is None:
        lst.append(entry)
    else:
        lst.insert(idx + 1, entry)
    data["updated"] = "2026-10-29"
    EXAMS_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print("UPDATED exams.json")


if __name__ == "__main__":
    main()
