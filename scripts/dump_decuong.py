# -*- coding: utf-8 -*-
"""Dump cau truc DOCX de cuong GK1 de khao sat truoc khi parse.
Xuat: _decuong_gk1_dump.txt (text + table + anh) va _decuong_gk1_fmt.txt (run format)."""
import re
import zipfile
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph

SRC = Path(r"C:\Users\LENOVO\Downloads\Hóa 12 - ĐỀ CƯƠNG GIỮA KÌ 1 (2026 - 2027) - Đáp án (1).docx")
OUT_TEXT = Path(r"D:\phongthi247\scripts\_decuong_gk1_dump.txt")
OUT_FMT = Path(r"D:\phongthi247\scripts\_decuong_gk1_fmt.txt")

doc = Document(str(SRC))

KEY_like = re.compile(r"^\s*(Câu\s*\d+|[A-Da-d][.)]\s|PHẦN|Đáp án|đáp án|BẢNG|Bảng)")


def para_numpr(p_el):
    pPr = p_el.find(qn('w:pPr'))
    if pPr is None:
        return " "
    return "N" if pPr.find(qn('w:numPr')) is not None else " "


def blips(el):
    return [b.get(qn('r:embed')) for b in el.findall('.//' + qn('a:blip'))]


text_lines = []
fmt_lines = []
n_sub = n_sup = 0

body = doc.element.body
pidx = 0
tidx = 0
for child in body.iterchildren():
    tag = child.tag.split('}')[-1]
    if tag == 'p':
        p = Paragraph(child, doc)
        txt = p.text
        imgs = blips(child)
        imgtag = f"[img={','.join(imgs)}]" if imgs else ""
        text_lines.append(f"P{pidx:04d}{para_numpr(child)}{imgtag} {txt}")
        runs = p.runs
        has_sub = any(r.font.subscript for r in runs)
        has_sup = any(r.font.superscript for r in runs)
        if has_sub:
            n_sub += 1
        if has_sup:
            n_sup += 1
        marked = any(r.bold or r.underline for r in runs)
        if KEY_like.search(txt or "") or has_sub or has_sup or marked:
            parts = []
            for r in runs[:40]:
                fl = ('B' if r.bold else '') + ('U' if r.underline else '') + \
                     ('i' if r.italic else '') + ('b' if r.font.subscript else '') + \
                     ('p' if r.font.superscript else '')
                if not fl:
                    fl = '-'
                if r.text:
                    t = r.text if len(r.text) <= 45 else r.text[:42] + '…'
                    parts.append(f"{fl}'{t}'")
            if parts:
                fmt_lines.append(f"P{pidx:04d} :: " + " | ".join(parts))
        pidx += 1
    elif tag == 'tbl':
        t = Table(child, doc)
        for ri, row in enumerate(t.rows):
            cells = []
            for c in row.cells:
                cimg = blips(c._tc)
                ct = c.text.replace('\n', ' / ')
                if cimg:
                    ct = f"[img={','.join(cimg)}]" + ct
                cells.append(ct)
            text_lines.append(f"T{tidx:02d}R{ri:02d}: " + " | ".join(cells))
        tidx += 1

header = [
    f"SRC: {SRC}",
    f"paragraphs={pidx} tables={tidx} paras_has_sub={n_sub} paras_has_sup={n_sup}",
    "--- IMAGE RELS ---",
]
for rid, rel in doc.part.rels.items():
    if 'image' in rel.reltype:
        header.append(f"  {rid} -> {rel.target_ref}")

with zipfile.ZipFile(str(SRC)) as z:
    media = [n for n in z.namelist() if n.startswith('word/media/')]
header.append(f"--- MEDIA ({len(media)}) ---")
header.extend("  " + m for m in media)

OUT_TEXT.write_text("\n".join(header + [""] + text_lines), encoding="utf-8")
OUT_FMT.write_text("\n".join(fmt_lines), encoding="utf-8")

print(f"paragraphs={pidx} tables={tidx} media_files={len(media)} fmt_lines={len(fmt_lines)}")
