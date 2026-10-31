# -*- coding: utf-8 -*-
"""import_decuong_hoa11_gk1.py
Chuyen 'DE CUONG HOA 11 GK1 - FULL GOC TRON.docx' -> de on tap tren phongthi247:
    data/tests/de-cuong-hoa11-gk1.json + anh vao data/img/de-cuong-hoa11-gk1/.

Khac importer Hoa 12 (scripts/import_decuong_gk1.py):
  - Cau hoi bat dau bang text 'Cau N.' (khong dung numPr) -> group theo regex.
  - Phan III: dap an nam o dong 'A. <so>' (khong phai 'Dap so:').
  - Co OMML (Word equation) -> linear hoa thanh HTML (phan so xep doc).
  - Phan IV (tu luan) bo qua.
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

SRC = Path(r"D:\download\HOA11-GK1_LUU-TRU\SAN-PHAM\ĐỀ CƯƠNG HÓA 11 GK1 - FULL GỐC TRỘN.docx")
KEY_SRC = Path(r"D:\download\HOA11-GK1_LUU-TRU\SAN-PHAM\ĐÁP ÁN ĐỀ GK1 HÓA 11.docx")

ROOT = Path(__file__).resolve().parents[1]
ID = "de-cuong-hoa11-gk1"
IMG_OUT = ROOT / "data" / "img" / ID
TEST_OUT = ROOT / "data" / "tests" / f"{ID}.json"
DOCS_OUT = ROOT / "data" / "docs"
EXAMS_JSON = ROOT / "data" / "exams.json"
LOG_OUT = ROOT / "scripts" / "_hoa11_gk1_import_log.txt"

TITLE = "Đề cương ôn tập giữa kì 1 – Hóa học 11 (2026–2027)"
SUBJECT = "Hóa học 11 – Cân bằng hóa học, Sự điện li, Nitrogen – Sulfur"
CODE = "HOA11"
DURATION = 90

W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
M_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/math}"
VML = "{urn:schemas-microsoft-com:vml}imagedata"


def W(tag):
    return qn("w:" + tag)


def M(tag):
    return M_NS + tag


# ---------------- rel map ----------------
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
foreach ($arg in $args) {
  $pair = $arg -split '\|'
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
    Write-Output ("ERR|" + (Split-Path -Leaf $dst) + "|" + $_.Exception.Message)
  }
}
"""


def prep_images():
    IMG_OUT.mkdir(parents=True, exist_ok=True)
    tmp = ROOT / "scripts" / "_hoa11_tmp_media"
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
                out.write_bytes(z.read(member))
                media_map[name] = name
            elif ext in (".wmf", ".emf") and member not in conv:
                src_file = tmp / name
                src_file.write_bytes(z.read(member))
                out_final = IMG_OUT / (name[:-4] + ".png")
                conv[member] = (str(src_file), str(out_final), name, out_final.name)
    stats = {"copy": len(media_map), "conv_ok": 0, "conv_fail": []}
    if conv:
        ps1 = ROOT / "scripts" / "_wmf2png.ps1"
        ps1.write_text(PS_CONVERT.strip(), encoding="utf-8")
        args = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ps1)]
        args += [f"{s}|{d}" for (s, d, _, _) in conv.values()]
        p = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace")
        ok_names = set()
        for line in (p.stdout or "").splitlines():
            if line.startswith("OK|"):
                ok_names.add(line.split("|")[1])
            elif line.startswith("ERR|"):
                stats["conv_fail"].append(line)
        for (_, _, src_name, dest_name) in conv.values():
            if dest_name in ok_names and (IMG_OUT / dest_name).exists():
                media_map[src_name] = dest_name
                stats["conv_ok"] += 1
            else:
                media_map[src_name] = None
    stats["conv_total"] = len(conv)
    return media_map, stats


MEDIA = {}


def img_html(served, maxw=480):
    if not served:
        return ""
    return (
        f'<img class="qimg" src="data/img/{ID}/{served}" '
        f'style="max-width:min(100%,{maxw}px);height:auto;border-radius:8px;background:#fff;padding:4px;vertical-align:middle" '
        f'alt="hình câu hỏi">'
    )


RE_G_MARK = re.compile(r"<em>\s*&lt;g&gt;\s*</em>|&lt;g&gt;|</?g>")


def clean_html(s, opt=False):
    """Bỏ thẻ <g> (marker định dạng của file gốc) + span rỗng; thu nhỏ ảnh trong phương án."""
    s = RE_G_MARK.sub("", s or "")
    # giu lai khoang trang trong run in dam/in nghieng (file goc dung <strong> </strong>
    # lam dau cach noi giua cac run -> bo thi mat khoang cach: "Phản ứng", "Dung dịch HNO3")
    s = re.sub(r"<strong>(\s*)</strong>", r"\1", s)
    s = re.sub(r"<em>(\s*)</em>", r"\1", s)
    if opt:
        s = s.replace("max-width:min(100%,480px)", "max-width:min(100%,220px)")
    return s.strip()


# ---------------- OMML -> HTML ----------------
def _inner(el):
    if el is None:
        return ""
    return "".join(omml_html(c) for c in el)


def omml_html(el):
    tag = el.tag
    if tag == M("t"):
        return escape(el.text or "").replace("\xa0", " ")
    if tag == M("r"):
        return "".join(omml_html(c) for c in el if c.tag != M("rPr"))
    if tag == M("f"):
        num = _inner(el.find(M("num")))
        den = _inner(el.find(M("den")))
        return (
            '<span class="omfrac" style="display:inline-block;vertical-align:-0.55em;text-align:center;margin:0 1px">'
            f'<span style="display:block;border-bottom:1px solid currentColor;padding:0 3px;line-height:1.25">{num}</span>'
            f'<span style="display:block;padding:0 3px;line-height:1.25">{den}</span></span>'
        )
    if tag == M("sSup"):
        return _inner(el.find(M("e"))) + "<sup>" + _inner(el.find(M("sup"))) + "</sup>"
    if tag == M("sSub"):
        return _inner(el.find(M("e"))) + "<sub>" + _inner(el.find(M("sub"))) + "</sub>"
    if tag == M("sSubSup"):
        return (
            _inner(el.find(M("e")))
            + "<sub>" + _inner(el.find(M("sub"))) + "</sub>"
            + "<sup>" + _inner(el.find(M("sup"))) + "</sup>"
        )
    if tag == M("rad"):
        deg = el.find(M("deg"))
        dg = _inner(deg).strip()
        body = _inner(el.find(M("e")))
        return (f"<sup>{dg}</sup>" if dg else "") + "√(" + body + ")"
    if tag == M("d"):
        beg, end = "(", ")"
        pr = el.find(M("dPr"))
        if pr is not None:
            b = pr.find(M("begChr"))
            e = pr.find(M("endChr"))
            if b is not None:
                beg = b.get(M("val")) or ""
            if e is not None:
                end = e.get(M("val")) or ""
        return beg + "".join(_inner(x) for x in el.findall(M("e"))) + end
    if tag == M("nary"):
        sign = "∑"
        pr = el.find(M("naryPr"))
        if pr is not None:
            c = pr.find(M("chr"))
            if c is not None and c.get(M("val")):
                sign = c.get(M("val"))
        out = sign
        sub = el.find(M("sub"))
        sup = el.find(M("sup"))
        if sub is not None:
            out += "<sub>" + _inner(sub) + "</sub>"
        if sup is not None:
            out += "<sup>" + _inner(sup) + "</sup>"
        return out + "{" + _inner(el.find(M("e"))) + "}"
    if tag == M("func"):
        return _inner(el.find(M("fName"))) + "(" + _inner(el.find(M("e"))) + ")"
    if tag == M("groupChr"):
        # groupChr: chr (mui ten / dau phan ung) + e (noi dung, thuong la dieu kien nhu 'to').
        # vertJc=bot -> chr nam duoi e. Render: e tren, chr duoi (trung voi Word).
        ch = "→"
        pr = el.find(M("groupChrPr"))
        if pr is not None:
            ce = pr.find(M("chr"))
            if ce is not None and ce.get(M("val")):
                ch = ce.get(M("val"))
        inner = _inner(el.find(M("e"))).strip()
        if not inner:
            return f'<span class="omarw" style="margin:0 2px">{escape(ch)}</span>'
        return (
            '<span class="omarw" style="display:inline-block;text-align:center;vertical-align:middle;margin:0 2px;line-height:1">'
            f'<span style="display:block;font-size:0.72em;line-height:1.1">{inner}</span>'
            f'<span style="display:block;line-height:1.1">{escape(ch)}</span></span>'
        )
    if tag in (M("groupChrPr"),):
        return ""
    if tag in (M("rPr"), M("ctrlPr"), M("fPr"), M("dPr"), M("naryPr"), M("radPr"),
               M("sSubPr"), M("sSupPr"), M("sSubSupPr"), M("funcPr"), M("argPr")):
        return ""
    return "".join(omml_html(c) for c in el)


# ---------------- rich text ----------------
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


def text_piece_html(p):
    t = escape(p["text"]).replace("\t", " ")
    if not t:
        return ""
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


def build_img_piece(rid):
    tgt = REL_MAP.get(rid) or ""
    base = Path(tgt).name if tgt else None
    served = MEDIA.get(base) if base else None
    if not served:
        return {"kind": "img_error", "name": base or rid, "html": ""}
    return {"kind": "img", "html": img_html(served), "name": base}


def parse_para(p_el):
    pieces = []
    pos = 0

    def push_text(txt, fl):
        nonlocal pos
        pieces.append({"kind": "text", "text": txt, "flags": fl, "start": pos, "end": pos + len(txt)})
        pos += len(txt)

    def push_html(html):
        nonlocal pos
        pieces.append({"kind": "html", "html": html, "start": pos, "end": pos})

    def push_rid(rid):
        # KHONG dedup: cung 1 anh (vd anh mui ten rId20) co the xuat hien nhieu lan
        # trong cung paragraph (A. ... 2NO.\tB. ... 2NH3.) -> moi lan deu phai render.
        nonlocal pos
        if not rid:
            return
        pkt = build_img_piece(rid)
        pieces.append({**pkt, "start": pos, "end": pos})

    def walk_run(r):
        fl = run_flags(r)
        for node in list(r):
            tag = node.tag
            if tag == W("t"):
                push_text((node.text or "").replace("\xa0", " "), fl)
            elif tag == W("tab"):
                push_text("\t", {})
            elif tag == W("br"):
                push_text("\n", {})
            elif tag == W("noBreakHyphen"):
                push_text("-", {})
            elif tag == W("drawing"):
                for b in node.iter(qn("a:blip")):
                    push_rid(b.get(qn("r:embed")))
            elif tag in (W("object"), W("pict")):
                for b in node.iter(VML):
                    push_rid(b.get(qn("r:id")) or b.get(qn("r:embed")))
            elif tag in (M("oMath"), M("oMathPara")):
                push_html(omml_html(node))
            elif tag == W("rPr"):
                continue
            else:
                # noi dung la (w:instrText, w:delText, ...)
                for t in node.iter(W("t")):
                    push_text((t.text or "").replace("\xa0", " "), fl)

    def walk(node):
        for ch in list(node):
            tag = ch.tag
            if tag == W("r"):
                walk_run(ch)
            elif tag in (M("oMath"), M("oMathPara")):
                push_html(omml_html(ch))
            elif tag in (W("pPr"), W("bookmarkStart"), W("bookmarkEnd"), W("proofErr"),
                         W("commentRangeStart"), W("commentRangeEnd"), W("del")):
                continue
            else:
                walk(ch)

    walk(p_el)

    lines = []
    cur = []
    cur_off = 0

    def close_line(endpos):
        nonlocal cur, cur_off
        raw = "".join(p["text"] for p in cur if p["kind"] == "text")
        has_img = any(p["kind"] == "img" for p in cur)
        lines.append({"raw": raw, "pieces": cur, "offset": cur_off, "has_img": has_img})
        cur = []
        cur_off = endpos

    for p in pieces:
        if p["kind"] == "text" and p["text"] == "\n":
            close_line(p["start"])
        else:
            cur.append(p)
    close_line(pos)
    return {"lines": lines}


def line_html(line):
    parts = []
    for p in line["pieces"]:
        if p["kind"] == "img":
            parts.append(p["html"])
        elif p["kind"] == "html":
            parts.append(p["html"])
        elif p["kind"] == "img_error":
            parts.append(f"<em>(ảnh {escape(str(p['name']))} không tải được)</em>")
        else:
            parts.append(text_piece_html(p))
    return "".join(parts)


def slice_line_html(line, s0, e0):
    out = []
    for p in line["pieces"]:
        rs = p["start"] - line["offset"]
        re_ = p["end"] - line["offset"]
        if p["kind"] == "html" or p["kind"] == "img":
            if s0 <= rs <= e0:
                out.append(p.get("html", ""))
            continue
        if p["kind"] != "text":
            continue
        if re_ <= s0 or rs >= e0:
            continue
        a = max(rs, s0) - rs
        b = min(re_, e0) - rs
        out.append(text_piece_html({**p, "text": p["text"][a:b]}))
    return "".join(out)


def line_meaningful(line):
    return bool(line["raw"].strip()) or line["has_img"] or any(p["kind"] == "html" for p in line["pieces"])


def label_und(line, s0, e0):
    for p in line["pieces"]:
        if p["kind"] != "text":
            continue
        rs = p["start"] - line["offset"]
        re_ = p["end"] - line["offset"]
        if rs < e0 and re_ > s0 and p["flags"].get("u"):
            return True
    return False


# ---------------- bang ----------------
def table_html(tbl_el):
    trs = tbl_el.findall(W("tr"))
    if not trs:
        return ""
    th_flag = len(trs) > 1
    rows_h = []
    for ri, tr in enumerate(trs):
        cells = []
        ids = set()
        for tc in tr.findall(W("tc")):
            if id(tc) in ids:
                continue
            ids.add(id(tc))
            segs = []
            for p in tc.findall(W("p")):
                res = parse_para(p)
                for ln in res["lines"]:
                    if line_meaningful(ln):
                        segs.append(line_html(ln))
            content = "<br>".join(segs) or "&nbsp;"
            is_th = th_flag and ri == 0
            st = "border:1px solid #C9BCF2;padding:4px 10px;vertical-align:top"
            if is_th:
                st += ";background:#F3E8FF;font-weight:600"
            tag = "th" if is_th else "td"
            cells.append(f'<{tag} style="{st}">{content}</{tag}>')
        if cells:
            rows_h.append("<tr>" + "".join(cells) + "</tr>")
    return f'<table style="border-collapse:collapse;margin:8px 0;font-size:14.5px">{"".join(rows_h)}</table>'


# ---------------- helpers ----------------
def plain_text(p_el):
    return "".join(t.text or "" for t in p_el.iter(W("t")))


RE_PHASE = re.compile(r"^\s*Phần\s+([IVX]+)\.")
RE_Q = re.compile(r"^\s*Câu\s+(\d+)\.")
RE_OPT = re.compile(r"[A-D]\.")
RE_OPTLINE = re.compile(r"^\s*[A-D]\.")
RE_STM = re.compile(r"^\s*([a-d])\)\s*")
RE_ANS3 = re.compile(r"^\s*A\.\s*([0-9]+(?:[.,][0-9]+)?)\s*$")


def is_question(el):
    return bool(RE_Q.match(plain_text(el)))


def build_groups(evs, b, e):
    groups = []
    cur = None
    for i in range(b, e):
        kind, el = evs[i]
        if kind == "p":
            if is_question(el):
                cur = [("p", el)]
                groups.append(cur)
            elif cur is not None:
                cur.append(("p", el))
        elif cur is not None:
            cur.append(("t", el))
    return groups


def strip_trailing_dot_html(s):
    s = s.strip()
    if s.endswith("."):
        s = s[:-1].strip()
    return s


# ---------------- build phan I ----------------
def build_part1(g, warn):
    content = []
    labels = []  # (letter, line, match)
    for kind, el in g:
        if kind == "t":
            content.append(clean_html(table_html(el)))
            continue
        res = parse_para(el)
        for ln in res["lines"]:
            if not line_meaningful(ln):
                continue
            raw = ln["raw"]
            if RE_OPTLINE.match(raw) and RE_OPT.search(raw):
                for m in RE_OPT.finditer(raw):
                    L = m.group(0)[0]
                    if not any(x[0] == L for x in labels):
                        labels.append((L, ln, m))
            else:
                content.append(clean_html(line_html(ln)))
    letters = [L for L, _, _ in labels]
    if letters != ["A", "B", "C", "D"]:
        warn.append(f"Phần I: nhãn không chuẩn A,B,C,D → {letters} :: {content[-1][:60] if content else ''}")
    opts = []
    for L, ln, m in labels:
        s = m.end()
        nxt = RE_OPT.search(ln["raw"], m.end())
        end = nxt.start() if nxt else len(ln["raw"])
        opts.append(clean_html(strip_trailing_dot_html(slice_line_html(ln, s, end)), opt=True))
    marked = [
        i
        for i, (L, ln, m) in enumerate(labels)
        if label_und(ln, m.start(), m.start() + len(m.group(0)))
    ]
    if len(marked) == 1:
        ai = marked[0]
    else:
        ai = None
        if not marked:
            warn.append(f"Phần I (opts: {letters}): không thấy gạch chân đáp án :: {content[-1][:70] if content else ''}")
        else:
            warn.append(f"Phần I (opts: {letters}): nhiều đáp án gạch chân {len(marked)}")
    return {"part": 1, "content": "<br>".join(x for x in content if x), "options": opts, "answerIndex": ai}


# ---------------- build phan II ----------------
def build_part2(g, warn):
    content = []
    statements = []
    for kind, el in g:
        if kind == "t":
            content.append(clean_html(table_html(el)))
            continue
        res = parse_para(el)
        for ln in res["lines"]:
            if not line_meaningful(ln):
                continue
            m = RE_STM.match(ln["raw"])
            if m:
                e0, s0 = m.end(), m.start(1)
                txt = []
                for p in ln["pieces"]:
                    rs = p["start"] - ln["offset"]
                    if p["kind"] in ("html", "img"):
                        if rs >= e0:
                            txt.append(p.get("html", ""))
                        continue
                    if p["kind"] != "text":
                        continue
                    if rs + len(p["text"]) <= e0:
                        continue
                    q = p
                    if rs < e0:
                        q = {**p, "text": p["text"][e0 - rs:]}
                    txt.append(text_piece_html(q))
                statements.append(
                    {"text": clean_html("".join(txt).strip()), "answer": bool(label_und(ln, s0, e0))}
                )
            else:
                content.append(clean_html(line_html(ln)))
    if len(statements) != 4:
        warn.append(f"Phần II: số ý = {len(statements)} ≠ 4 :: {content[-1][:60] if content else ''}")
    return {"part": 2, "content": "<br>".join(x for x in content if x), "statements": statements}


# ---------------- build phan III ----------------
def build_part3(g, warn):
    content = []
    answer = None
    for kind, el in g:
        if kind == "t":
            content.append(clean_html(table_html(el)))
            continue
        res = parse_para(el)
        for ln in res["lines"]:
            if not line_meaningful(ln):
                continue
            m = RE_ANS3.match(ln["raw"])
            if m and answer is None:
                raw_num = m.group(1).replace(",", ".")
                answer = int(raw_num) if raw_num.isdigit() else float(raw_num)
            else:
                content.append(clean_html(line_html(ln)))
    if answer is None:
        warn.append(f"Phần III: câu không có dòng đáp án 'A. <số>' :: {content[-1][:60] if content else ''}")
    return {"part": 3, "content": "<br>".join(x for x in content if x), "answer": answer}


# ---------------- hieu chinh (hóa hoc + chinh ta) ----------------
# File DE GOC cua thay co nhung loi sau, da xac nhan bang tinh toan + doc WMF:
#  - P2 Q5a: chi thi A-B chi cho pH XAP XI, khong "xac dinh chinh xac" (can pH ke) -> phai la SAI
#    (nhung file goc lai gach chan a = Dung)
#  - P2 Q10c: SO2 + O2 -> SO3 (S: +4 -> +6) => SO2 bi OXI HOA, dong vai tro chat KHỬ,
#    khong phai "tinh oxi hoa" (file goc gach chan c = Dung)
#  - P3 Q1: WMF image13/14/15 chua dau tru (U+2212): dH = -115, -198, -92 kJ (toa nhiet) cho
#    (1),(2),(3); image16/17: dH = +130, +178 kJ (thu nhiet) cho (4),(5).
#    Giam nhiet do -> 3 can bang chuyen dich thuan, khong phai 2 (key goc ghi "A. 2").
#  - P3 Q14: 40 kg S = 1250 mol -> 1250 mol SO2; o dkc (Vm = 22,4 L/mol) = 28 m3.
#    Key goc ghi 31 (khớp voi Vm = 24,5 L/mol cua 25 do C - sai voi chu "d").
CORRECTIONS_LOG = []


def apply_corrections(questions):
    idx = {1: 0, 2: 0, 3: 0}
    for q in questions:
        idx[q["part"]] += 1
        n = idx[q["part"]]
        if q["part"] == 2 and n == 5:
            q["statements"][0]["answer"] = False
            CORRECTIONS_LOG.append(
                "P2 Q5 ý a: ĐÚNG(gạch chân gốc) → SAI. Chỉ thị acid–base (giấy quỳ, phenolphthalein) "
                "chỉ cho pH xấp xỉ; xác định chính xác pH phải dùng pH kế/máy đo."
            )
        if q["part"] == 2 and n == 10:
            q["statements"][2]["answer"] = False
            CORRECTIONS_LOG.append(
                "P2 Q10 ý c: ĐÚNG(gạch chân gốc) → SAI. SO2 + O2 → SO3: S(+4)→(+6), SO2 bị oxi hóa, "
                "đóng vai trò chất KHỬ (không phải tính oxi hóa)."
            )
        if q["part"] == 3 and n == 1:
            q["answer"] = 3
            CORRECTIONS_LOG.append(
                "P3 Q1: 2 → 3. ΔH < 0 (tỏa nhiệt) ở (1) −115, (2) −198, (3) −92 kJ; (4) +130, (5) +178 kJ "
                "(thu nhiệt). Giảm nhiệt độ → 3 cân bằng (1),(2),(3) chuyển dịch theo chiều thuận."
            )
        if q["part"] == 3 and n == 14:
            q["answer"] = 28
            CORRECTIONS_LOG.append(
                "P3 Q14: 31 → 28. 40 kg S = 1250 mol S → 1250 mol SO2; ở đkc (Vm = 22,4 L/mol) → 28 m³. "
                "Key gốc 31 khớp với Vm = 24,5 (25 °C) – sai so với chữ 'đkc'."
            )
        if q["part"] == 3 and n == 9:
            q["answer"] = 4
            CORRECTIONS_LOG.append(
                "P3 Q9: 5 → 4. Acid (chất cho proton) theo Brønsted–Lowry trong dãy: NH4+, HCl, HCO3-, HS- = 4 chất. "
                "Cu2+ chỉ là acid theo Lewis (chất nhận cặp e), không tính trong thuyết Brønsted–Lowry. "
                "Giáo viên duyệt: sửa theo đúng SGK."
            )


TYPO_FIXES = [
    ("sự điên li", "sự điện li"),
    ("2SO<sub>2</sub>(g) + 3O<sub>2</sub>", "2SO<sub>2</sub>(g) + O<sub>2</sub>"),
    ("thay đồi", "thay đổi"),
    ("trong burrette", "trong burette"),
    ("với oxygene", "với oxygen"),
    ("làng nghê", "làng nghề"),
    ("((kết quả", "(kết quả"),
]


def fix_typos_in_str(s):
    for a, b in TYPO_FIXES:
        if a in s:
            s = s.replace(a, b)
    return s


def fix_typos(questions):
    for q in questions:
        q["content"] = fix_typos_in_str(q["content"])
        if q["part"] == 1:
            q["options"] = [fix_typos_in_str(o) for o in q["options"]]
        elif q["part"] == 2:
            for st in q["statements"]:
                st["text"] = fix_typos_in_str(st["text"])


# ---------------- main ----------------
def main():
    global MEDIA
    MEDIA, st = prep_images()
    print(f"anh: copy={st['copy']} wmf/emf={st['conv_ok']}/{st['conv_total']}")
    for f in st["conv_fail"][:6]:
        print("  conv_err:", f)

    doc = Document(str(SRC))
    evs = []
    for ch in doc.element.body.iterchildren():
        if ch.tag == W("p"):
            evs.append(("p", ch))
        elif ch.tag == W("tbl"):
            evs.append(("t", ch))

    bounds = {}
    for i, (k, el) in enumerate(evs):
        if k != "p":
            continue
        m = RE_PHASE.match(plain_text(el))
        if m and m.group(1) not in bounds:
            bounds[m.group(1)] = i
    for need in ("I", "II", "III"):
        if need not in bounds:
            raise SystemExit(f"Không tìm thấy Phần {need}: {bounds}")

    end3 = bounds.get("IV", len(evs))
    warn = []
    questions = []
    for part, b1, b2 in (
        (1, bounds["I"] + 1, bounds["II"]),
        (2, bounds["II"] + 1, bounds["III"]),
        (3, bounds["III"] + 1, end3),
    ):
        builder = {1: build_part1, 2: build_part2, 3: build_part3}[part]
        for g in build_groups(evs, b1, b2):
            questions.append(builder(g, warn))

    n1 = sum(q["part"] == 1 for q in questions)
    n2 = sum(q["part"] == 2 for q in questions)
    n3 = sum(q["part"] == 3 for q in questions)
    print(f"cau: P1={n1} P2={n2} P3={n3} tong={len(questions)}")
    print(f"thieu_dap_an_P1={sum(1 for q in questions if q['part'] == 1 and q.get('answerIndex') is None)}")
    print(f"thieu_dap_an_P3={sum(1 for q in questions if q['part'] == 3 and q.get('answer') is None)}")
    print(f"P1_sai_so_phuong_an={sum(1 for q in questions if q['part'] == 1 and len(q['options']) != 4)}")
    print(f"warn={len(warn)}")

    # hieu chinh: loi go gach chan + loi hoa hoc + typo cua file DE GOC
    apply_corrections(questions)
    fix_typos(questions)
    for c in CORRECTIONS_LOG:
        print("  CORRECTED:", c.split(":")[0], "-", c.split(":", 1)[1].strip()[:70])

    parts_meta = [
        {
            "part": 1,
            "label": "PHẦN I – TRẮC NGHIỆM NHIỀU LỰA CHỌN",
            "hint": f"{n1} câu. Mỗi câu có 4 phương án, chỉ chọn 1 đáp án đúng.",
            "points": "0,25 điểm/câu",
        },
        {
            "part": 2,
            "label": "PHẦN II – TRẮC NGHIỆM ĐÚNG SAI",
            "hint": f"{n2} câu. Mỗi câu có 4 ý a, b, c, d – tại mỗi ý em chọn Đúng hoặc Sai.",
            "points": "1 ý đúng 0,10 – 2 ý 0,25 – 3 ý 0,50 – đủ 4 ý 1,00 (QĐ 764/QĐ-BGDĐT 2024). Có ý chọn sai ở bất kỳ ý nào thì câu đó 0 điểm.",
        },
        {
            "part": 3,
            "label": "PHẦN III – TRẮC NGHIỆM TRẢ LỜI NGẮN",
            "hint": f"{n3} câu. Em điền kết quả (chỉ nhập số).",
            "points": "0,25 điểm/câu",
        },
    ]

    exam = {
        "schema": 1,
        "id": ID,
        "title": TITLE,
        "subject": SUBJECT,
        "code": CODE,
        "hasPassword": False,  # de thi.js tu dong dien san ma phong vao o input
        "durationMin": DURATION,
        "shuffleQuestions": True,
        "shuffleOptions": True,
        "showAnswersAfterSubmit": True,
        "scoring": {"strictPart2": True, "part1": 0.25, "part2": [0.1, 0.25, 0.5, 1.0], "part3": 0.25},
        "parts": parts_meta,
        "questions": questions,
    }
    TEST_OUT.write_text(json.dumps(exam, ensure_ascii=False, indent=1), encoding="utf-8")
    print("test:", TEST_OUT)

    # docs
    DOCS_OUT.mkdir(parents=True, exist_ok=True)
    key_dst = DOCS_OUT / "de-cuong-hoa11-gk1-dap-an.docx"
    key_dst.write_bytes(KEY_SRC.read_bytes())
    print("doc:", key_dst)

    # exams.json
    ex = json.loads(EXAMS_JSON.read_text(encoding="utf-8"))
    entry = {
        "id": ID,
        "title": TITLE,
        "subject": SUBJECT,
        "count": len(questions),
        "durationMin": DURATION,
        "code": CODE,
        "hasPassword": False,
        "docKeyUrl": "data/docs/de-cuong-hoa11-gk1-dap-an.docx",
        "desc": (
            f"Đề cương GK1 2026–2027: Phần I ({n1} câu TN, 0,25 đ/câu) – "
            f"Phần II ({n2} câu Đ/S theo QĐ 764/QĐ-BGDĐT 2024) – "
            f"Phần III ({n3} câu trả lời ngắn, 0,25 đ/câu). Kèm 3 câu tự luận trong file Word đáp án."
        ),
    }
    ex["exams"] = [e for e in ex.get("exams", []) if e.get("id") != ID]
    ex["exams"].insert(0, entry)
    ex["updated"] = "2026-10-31"
    EXAMS_JSON.write_text(json.dumps(ex, ensure_ascii=False, indent=2), encoding="utf-8")
    print("exams.json updated")

    LOG_OUT.write_text(
        json.dumps(
            {
                "warns": warn,
                "corrections": CORRECTIONS_LOG,
                "P1_no_answer": [i for i, q in enumerate(questions) if q["part"] == 1 and q.get("answerIndex") is None],
                "P3_no_answer": [i for i, q in enumerate(questions) if q["part"] == 3 and q.get("answer") is None],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    for w in warn[:30]:
        print("  WARN:", w)


if __name__ == "__main__":
    main()
