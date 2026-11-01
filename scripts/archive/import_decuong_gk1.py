# -*- coding: utf-8 -*-
"""import_decuong_gk1.py
Chuyen 'Hóa 12 - ĐỀ CƯƠNG GIỮA KÌ 1 (2026 - 2027) - Đáp án (1).docx' thanh de on tap
tren phongthi247: data/tests/de-cuong-gk1-2627.json + anh vao data/img/de-cuong-gk1-2627/.

- Phan I  : TN nhieu lua chon, cau bat dau bang paragraph co numPrWord (cham so tu dong).
            Dap an = gach chan (underline) tren nhan A./B./C./D. dung.
- Phan II : 15 cau Dung/Sai, 4 y a) b) c) d); dap an = gach chan tren nhan y (Dung).
- Phan III: 15 cau tra loi ngan; dap an = dong co 'Dap so: <num>' (in dam).
- Bang    : render <table> inline trong content (sub/sup trong cell cung xu ly).
- Anh     : a:blip (DrawingML) + v:imagedata (VML/OLE) → map relId -> media;
            PNG/JPEG copy; WMF/EMF convert sang PNG qua PowerShell System.Drawing.
- sub/sup : run vertAlign -> <sub>/<sup>; bold -> <strong>; italic -> <em>.
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

SRC = Path(r"C:\Users\LENOVO\Downloads\Hóa 12 - ĐỀ CƯƠNG GIỮA KÌ 1 (2026 - 2027) - Đáp án (1).docx")
ROOT = Path(__file__).resolve().parents[1]
IMG_ID = "de-cuong-gk1-2627"
IMG_OUT = ROOT / "data" / "img" / IMG_ID
TEST_OUT = ROOT / "data" / "tests" / f"{IMG_ID}.json"
EXAMS_JSON = ROOT / "data" / "exams.json"
LOG_OUT = ROOT / "scripts" / "_decuong_gk1_import_log.txt"

ID = IMG_ID
TITLE = "Đề cương ôn tập giữa kì 1 – Hóa học 12 (2026–2027)"
SUBJECT = "Este, Chất béo – Xà phòng, Cacbonhidrat, Amin/Amino axit – Protein"
CODE = "GK1"
DURATION = 120
VML = '{urn:schemas-microsoft-com:vml}imagedata'


def W(tag):
    return qn('w:' + tag)


# ---------------- rel map + anh ----------------
def load_relmap():
    with zipfile.ZipFile(SRC) as z:
        rels = z.read('word/_rels/document.xml.rels').decode('utf-8')
    relmap = {}
    for m in re.finditer(r'<Relationship\b[^>]*>', rels):
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
    tmp = ROOT / 'scripts' / '_decuong_tmp_media'
    tmp.mkdir(parents=True, exist_ok=True)
    media_map = {}
    conv = {}
    with zipfile.ZipFile(SRC) as z:
        members = set(z.namelist())
        for rid, tgt in REL_MAP.items():
            if not tgt:
                continue
            t = tgt.strip().lstrip('/')
            if t.lower().startswith('media/'):
                member = 'word/' + t
            elif t.lower().startswith('word/media/'):
                member = t
            else:
                continue
            if member not in members:
                continue
            name = Path(member).name
            ext = Path(name).suffix.lower()
            if ext in ('.png', '.jpg', '.jpeg', '.gif'):
                out = IMG_OUT / name
                out.write_bytes(z.read(member))
                media_map[name] = name
            elif ext in ('.wmf', '.emf') and member not in conv:
                src_file = tmp / name
                src_file.write_bytes(z.read(member))
                out_final = IMG_OUT / (name[:-4] + '.png')
                conv[member] = (str(src_file), str(out_final), name, out_final.name)
    stats = {'copy': len(media_map), 'conv_ok': 0, 'conv_fail': []}
    if conv:
        ps1 = ROOT / 'scripts' / '_wmf2png.ps1'
        ps1.write_text(PS_CONVERT.strip(), encoding='utf-8')
        args = ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(ps1)]
        args += [f"{s}|{d}" for (s, d, _, _) in conv.values()]
        p = subprocess.run(args, capture_output=True, text=True, encoding='utf-8', errors='replace')
        ok_names = set()
        for line in (p.stdout or '').splitlines():
            if line.startswith('OK|'):
                ok_names.add(line.split('|')[1])
            elif line.startswith('ERR|'):
                stats['conv_fail'].append(line)
        for (_, _, src_name, dest_name) in conv.values():
            if dest_name in ok_names and (IMG_OUT / dest_name).exists():
                media_map[src_name] = dest_name
                stats['conv_ok'] += 1
            else:
                media_map[src_name] = None
    stats['conv_total'] = len(conv)
    return media_map, stats


def img_html(served):
    if not served:
        return ''
    return (f'<img class="qimg" src="data/img/{IMG_ID}/{served}" '
            f'style="max-width:min(100%,520px);height:auto;border-radius:10px;background:#fff;padding:6px" '
            f'alt="hình câu hỏi">')


# ---------------- rich text: runs -> pieces -> lines ----------------
def run_flags(r_el):
    f = {'b': False, 'i': False, 'u': False, 'sub': False, 'sup': False}
    rPr = r_el.find(W('rPr'))
    if rPr is None:
        return f

    def _on(el, bad):
        if el is None:
            return False
        v = el.get(W('val'))
        if v is None:
            return True
        return v not in bad

    e = rPr.find(W('b'))
    f['b'] = _on(e, ('0', 'false'))
    e = rPr.find(W('i'))
    f['i'] = _on(e, ('0', 'false'))
    e = rPr.find(W('u'))
    f['u'] = _on(e, ('none',))
    va = rPr.find(W('vertAlign'))
    if va is not None:
        v = va.get(W('val'))
        f['sub'] = (v == 'subscript')
        f['sup'] = (v == 'superscript')
    return f


def text_piece_html(p):
    t = escape(p['text']).replace('\t', ' ')
    if not t:
        return ''
    fl = p['flags']
    if fl.get('sub'):
        t = f'<sub>{t}</sub>'
    if fl.get('sup'):
        t = f'<sup>{t}</sup>'
    if fl.get('b'):
        t = f'<strong>{t}</strong>'
    if fl.get('i'):
        t = f'<em>{t}</em>'
    return t


MEDIA = {}


def build_img_piece(rid):
    tgt = REL_MAP.get(rid) or ''
    base = Path(tgt).name if tgt else None
    served = MEDIA.get(base) if base else None
    if not served:
        return {'kind': 'img_error', 'name': base or rid}
    return {'kind': 'img', 'html': img_html(served)}


def parse_para(p_el):
    pieces = []
    pos = 0
    seen = set()

    def push_text(txt, fl):
        nonlocal pos
        pieces.append({'kind': 'text', 'text': txt, 'flags': fl, 'start': pos, 'end': pos + len(txt)})
        pos += len(txt)

    for r in p_el.iter(W('r')):
        fl = run_flags(r)
        for node in r.iter():
            if node is r:
                continue
            tag = node.tag
            if tag == W('t'):
                txt = (node.text or '').replace('\xa0', ' ')
                if txt:
                    push_text(txt, fl)
            elif tag == W('br'):
                push_text('\n', {})
            elif tag == W('tab'):
                push_text('\t', {})
            elif tag == W('noBreakHyphen'):
                push_text('-', {})
            elif tag == qn('a:blip') or tag == VML:
                if tag == qn('a:blip'):
                    rid = node.get(qn('r:embed'))
                else:
                    rid = node.get(qn('r:id')) or node.get(qn('r:embed'))
                if not rid or rid in seen:
                    continue
                seen.add(rid)
                pkt = build_img_piece(rid)
                pieces.append({**pkt, 'start': pos, 'end': pos})

    lines = []
    cur = []
    cur_off = 0

    def close_line(endpos):
        nonlocal cur, cur_off
        raw = ''.join(p['text'] for p in cur if p['kind'] == 'text')
        has_img = any(p['kind'] == 'img' for p in cur)
        lines.append({'raw': raw, 'pieces': cur, 'offset': cur_off, 'has_img': has_img})
        cur = []
        cur_off = endpos

    for p in pieces:
        if p['kind'] == 'text' and p['text'] == '\n':
            close_line(p['start'])
        else:
            cur.append(p)
    close_line(pos)
    return {'lines': lines}


def line_html(line):
    parts = []
    for p in line['pieces']:
        if p['kind'] == 'img':
            parts.append(p['html'])
        elif p['kind'] == 'img_error':
            parts.append(f"<em>(ảnh {escape(str(p['name']))} không tải được)</em>")
        else:
            parts.append(text_piece_html(p))
    return ''.join(parts)


def line_meaningful(line):
    return bool(line['raw'].strip()) or line['has_img']


def label_und(line, s0, e0):
    for p in line['pieces']:
        if p['kind'] != 'text':
            continue
        rs = p['start'] - line['offset']
        re_ = p['end'] - line['offset']
        if rs < e0 and re_ > s0 and p['flags'].get('u'):
            return True
    return False


# ---------------- bang ----------------
def table_html(tbl_el):
    trs = tbl_el.findall(W('tr'))
    if not trs:
        return ''
    th_flag = len(trs) > 1
    rows_h = []
    for ri, tr in enumerate(trs):
        cells = []
        ids = set()
        for tc in tr.findall(W('tc')):
            if id(tc) in ids:
                continue
            ids.add(id(tc))
            segs = []
            for p in tc.findall(W('p')):
                res = parse_para(p)
                for ln in res['lines']:
                    if line_meaningful(ln):
                        segs.append(line_html(ln))
            content = '<br>'.join(segs) or '&nbsp;'
            is_th = th_flag and ri == 0
            st = 'border:1px solid #C9BCF2;padding:4px 10px;vertical-align:top'
            if is_th:
                st += ';background:#F3E8FF;font-weight:600'
            cells.append(f'<{"th" if is_th else "td"} style="{st}">{content}</{"th" if is_th else "td"}>')
        if cells:
            rows_h.append('<tr>' + ''.join(cells) + '</tr>')
    return f'<table style="border-collapse:collapse;margin:8px 0;font-size:14.5px">{"".join(rows_h)}</table>'


# ---------------- helpers ----------------
def has_numpr(p_el):
    pPr = p_el.find(W('pPr'))
    return pPr is not None and pPr.find(W('numPr')) is not None


def plain_text(p_el):
    return ''.join(t.text or '' for t in p_el.iter(W('t')))


RE_PHASE = re.compile(r'^\s*Phần\s+([IVX]+)\.')
RE_OPT = re.compile(r'[A-D]\.')
RE_STM = re.compile(r'^\s*([a-d])\)\s*')
RE_OPTLINE = re.compile(r'^\s*[A-D]\.')
RE_DAPSO = re.compile(r'^\s*Đáp\s*số')


def build_groups(evs, b, e):
    groups = []
    cur = None
    for i in range(b, e):
        kind, el = evs[i]
        if kind == 'p':
            if has_numpr(el):
                cur = [('p', el)]
                groups.append(cur)
            elif cur is not None:
                cur.append(('p', el))
        elif cur is not None:
            cur.append(('t', el))
    return groups


def strip_trailing_dot(s):
    s = s.strip()
    if s.endswith('.'):
        s = s[:-1].strip()
    return s


# ---------------- build phan I ----------------
def build_part1(g, warn):
    content = []
    labels = []          # (letter, line, match)
    for kind, el in g:
        if kind == 't':
            content.append(table_html(el))
            continue
        res = parse_para(el)
        for ln in res['lines']:
            if not line_meaningful(ln):
                continue
            if RE_OPTLINE.match(ln['raw']) and RE_OPT.search(ln['raw']):
                for m in RE_OPT.finditer(ln['raw']):
                    L = m.group(0)[0]
                    if not any(x[0] == L for x in labels):
                        labels.append((L, ln, m))
            else:
                content.append(line_html(ln))
    letters = [L for L, _, _ in labels]
    if letters != ['A', 'B', 'C', 'D']:
        warn.append(f"Phần I: nhãn không chuẩn A,B,C,D → {letters}")
    opts = []
    for L, ln, m in labels:
        s = m.end()
        nxt = RE_OPT.search(ln['raw'], m.end())
        end = nxt.start() if nxt else len(ln['raw'])
        opts.append(strip_trailing_dot(' '.join(ln['raw'][s:end].split())))
    marked = [i for i, (L, ln, m) in enumerate(labels)
              if label_und(ln, m.start(), m.start() + len(m.group(0)))]
    if len(marked) == 1:
        ai = marked[0]
    else:
        ai = None
        if not marked:
            warn.append(f"Phần I câu (opts: {letters}): không thấy gạch chân đáp án")
        else:
            warn.append(f"Phần I câu (opts: {letters}): nhiều đáp án gạch chân {len(marked)}")
    return {'part': 1, 'content': '<br>'.join(content), 'options': opts, 'answerIndex': ai}


# ---------------- build phan II ----------------
def build_part2(g, warn):
    content = []
    statements = []
    for kind, el in g:
        if kind == 't':
            content.append(table_html(el))
            continue
        res = parse_para(el)
        for ln in res['lines']:
            if not line_meaningful(ln):
                continue
            m = RE_STM.match(ln['raw'])
            if m:
                e0, s0 = m.end(), m.start(1)
                txt = []
                for p in ln['pieces']:
                    rs = p['start'] - ln['offset']
                    if p['kind'] != 'text':
                        if rs >= e0:
                            if p['kind'] == 'img':
                                txt.append(p['html'])
                            elif p['kind'] == 'img_error':
                                txt.append(f"<em>(ảnh {escape(str(p['name']))})</em>")
                        continue
                    # piece text bắt đầu trước e0 nhưng kéo dài qua e0
                    # (vd: label 'b)' và phần text cùng/tách run nhưng space đầu
                    #  của text bị regex \s* nuốt) -> chỉ cắt phần trước e0
                    if rs + len(p['text']) <= e0:
                        continue
                    if rs < e0:
                        p = {**p, 'text': p['text'][e0 - rs:]}
                    txt.append(text_piece_html(p))
                statements.append({
                    'text': ''.join(txt).strip(),
                    'answer': bool(label_und(ln, s0, e0)),
                })
            else:
                content.append(line_html(ln))
    if len(statements) != 4:
        warn.append(f"Phần II câu '...{content[-1][:60] if content else ''}': số ý = {len(statements)} ≠ 4")
    return {'part': 2, 'content': '<br>'.join(content), 'statements': statements}


# ---------------- build phan III ----------------
def build_part3(g, warn):
    content = []
    answer = None
    for kind, el in g:
        if kind == 't':
            content.append(table_html(el))
            continue
        res = parse_para(el)
        for ln in res['lines']:
            if not line_meaningful(ln):
                continue
            if RE_DAPSO.match(ln['raw']):
                m = re.search(r'([0-9]+(?:[.,][0-9]+)?)', ln['raw'])
                if m:
                    answer = int(float(m.group(1).replace(',', '.')))
                else:
                    warn.append(f"Phần III: đọc không ra số ở dòng '{ln['raw'][:40]}'")
            else:
                content.append(line_html(ln))
    if answer is None:
        warn.append('Phần III: câu không có Đáp số')
    return {'part': 3, 'content': '<br>'.join(content), 'answer': answer}


# ---------------- main ----------------
def main():
    global MEDIA
    MEDIA, img_stats = prep_images()
    print(f"anh: copy={img_stats['copy']} wmf/emf={img_stats['conv_ok']}/{img_stats['conv_total']}")
    if img_stats['conv_fail']:
        for f in img_stats['conv_fail'][:6]:
            print('  conv_err:', f)

    doc = Document(str(SRC))
    evs = []
    for ch in doc.element.body.iterchildren():
        if ch.tag == W('p'):
            evs.append(('p', ch))
        elif ch.tag == W('tbl'):
            evs.append(('t', ch))

    bounds = {}
    for i, (k, el) in enumerate(evs):
        if k != 'p':
            continue
        m = RE_PHASE.match(plain_text(el))
        if m and m.group(1) not in bounds:
            bounds[m.group(1)] = i
    for need in ('I', 'II', 'III'):
        if need not in bounds:
            raise SystemExit(f'Không tìm thấy Phần {need}: {bounds}')

    warn = []
    questions = []
    for part, b1, b2 in ((1, bounds['I'] + 1, bounds['II']),
                         (2, bounds['II'] + 1, bounds['III']),
                         (3, bounds['III'] + 1, len(evs))):
        builder = {1: build_part1, 2: build_part2, 3: build_part3}[part]
        for g in build_groups(evs, b1, b2):
            questions.append(builder(g, warn))

    n1 = sum(q['part'] == 1 for q in questions)
    n2 = sum(q['part'] == 2 for q in questions)
    n3 = sum(q['part'] == 3 for q in questions)
    print(f"cau: P1={n1} P2={n2} P3={n3} tong={len(questions)}")
    print(f"thieu_dap_an_P1={sum(1 for q in questions if q['part'] == 1 and q.get('answerIndex') is None)}")
    print(f"thieu_dap_an_P3={sum(1 for q in questions if q['part'] == 3 and q.get('answer') is None)}")
    print(f"warn={len(warn)}")

    parts_meta = [
        {"part": 1, "label": "PHẦN I – TRẮC NGHIỆM NHIỀU LỰA CHỌN",
         "hint": f"{n1} câu. Mỗi câu có 4 phương án, chỉ chọn 1 đáp án đúng.",
         "points": "0,25 điểm/câu"},
        {"part": 2, "label": "PHẦN II – TRẮC NGHIỆM ĐÚNG SAI",
         "hint": f"{n2} câu. Mỗi câu có 4 ý a, b, c, d – tại mỗi ý em chọn Đúng hoặc Sai.",
         "points": "1 ý đúng 0,10 – 2 ý 0,25 – 3 ý 0,50 – đủ 4 ý 1,00 (QĐ 764/QĐ-BGDĐT 2024). Có ý chọn sai ở bất kỳ ý nào thì câu đó 0 điểm."},
        {"part": 3, "label": "PHẦN III – TRẮC NGHIỆM TRẢ LỜI NGẮN",
         "hint": f"{n3} câu. Em điền kết quả (chỉ nhập số).",
         "points": "0,25 điểm/câu"},
    ]

    exam = {
        "schema": 1,
        "id": ID,
        "title": TITLE,
        "subject": SUBJECT,
        "code": CODE,
        "durationMin": DURATION,
        "shuffleQuestions": True,
        "shuffleOptions": True,
        "showAnswersAfterSubmit": True,
        "scoring": {"strictPart2": True, "part1": 0.25, "part2": [0.1, 0.25, 0.5, 1.0], "part3": 0.25},
        "parts": parts_meta,
        "questions": questions,
    }
    TEST_OUT.write_text(json.dumps(exam, ensure_ascii=False, indent=1), encoding='utf-8')
    print("test:", TEST_OUT)

    # exams.json
    ex = json.loads(EXAMS_JSON.read_text(encoding='utf-8'))
    entry = {
        "id": ID,
        "title": TITLE,
        "subject": SUBJECT,
        "count": len(questions),
        "durationMin": DURATION,
        "code": CODE,
        "hasPassword": False,
        "desc": f"Đề cương GK1 2026–2027: Phần I ({n1} câu, 0,25 đ/câu) – Phần II ({n2} câu Đ/S theo QĐ 764/QĐ-BGDĐT 2024) – Phần III ({n3} câu trả lời ngắn, 0,25 đ/câu).",
    }
    ex['exams'] = [e for e in ex.get('exams', []) if e.get('id') != ID]
    ex['exams'].insert(0, entry)
    ex['updated'] = '2026-10-24'
    EXAMS_JSON.write_text(json.dumps(ex, ensure_ascii=False, indent=2), encoding='utf-8')
    print("exams.json updated")

    log = {'warns': warn,
           'P1_no_answer': [i for i, q in enumerate(questions) if q['part'] == 1 and q.get('answerIndex') is None],
           'P3_no_answer': [i for i, q in enumerate(questions) if q['part'] == 3 and q.get('answer') is None]}
    LOG_OUT.write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding='utf-8')
    for w in warn[:25]:
        print('  WARN:', w)


if __name__ == '__main__':
    main()
