# -*- coding: utf-8 -*-
"""Bộ chuyển đổi tổng hợp 5 đề cương trắc nghiệm lớp 12 (GK1 2026-2027) sang phongthi247:
1. Vật lí 12 (de-cuong-ly12-gk1)
2. Sinh học 12 (de-cuong-sinh12-gk1)
3. Tin học 12 (de-cuong-tin12-gk1)
4. Lịch sử 12 (de-cuong-su12-gk1)
5. GDQP & AN 12 (de-cuong-gdqp12-gk1)
Sử dụng U+FFFC (Object Replacement Character) cho mọi ảnh inline để bảo toàn tuyệt đối vị trí công thức trong cả câu dẫn lẫn phương án A/B/C/D.
"""
from html import escape
from pathlib import Path
import json
import re
import shutil
import subprocess
import zipfile

from docx import Document
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
TMP_MULTI = Path(__file__).resolve().parent / '_tmp_multi'

W = lambda k: qn('w:' + k)
VML = '{urn:schemas-microsoft-com:vml}imagedata'
MATH_NS = '{http://schemas.openxmlformats.org/officeDocument/2006/math}'

SUBJECT_CONFIGS = [
    {
        'id': 'de-cuong-ly12-gk1',
        'code': 'LY12',
        'title': 'Đề cương ôn tập giữa kì 1 – Vật lí 12 (2026–2027)',
        'subject': 'Vật lí 12 – Vật lí nhiệt (Chuyển thể, Nội năng, Định luật I NĐLH, Nhiệt dung riêng, Nhiệt nóng chảy & Hóa hơi)',
        'durationMin': 90,
        'docx': TMP_MULTI / 'ĐỀ CƯƠNG ÔN TẬP GIỮA HKI-VẬT LÍ 12' / 'VẬT LÍ 12-GKI-GV.docx',
        'mode': 'ly12',
    },
    {
        'id': 'de-cuong-sinh12-gk1',
        'code': 'SINH12',
        'title': 'Đề cương ôn tập giữa kì 1 – Sinh học 12 (2026–2027)',
        'subject': 'Sinh học 12 – DNA, Phiên mã & Dịch mã, Điều hòa biểu hiện gene, Đột biến gene, Công nghệ gene, Quy luật Mendel',
        'durationMin': 90,
        'docx': Path(r'C:\Users\LENOVO\Downloads\Đề cương ôn tập GK 1-Đáp án (1).docx'),
        'mode': 'sinh12',
    },
    {
        'id': 'de-cuong-tin12-gk1',
        'code': 'TIN12',
        'title': 'Đề cương ôn tập giữa kì 1 – Tin học 12 (2026–2027)',
        'subject': 'Tin học 12 – Bài 13 đến Bài 17: Khái niệm CSS, Định dạng văn bản, Màu sắc, Khung & Mức ưu tiên bộ chọn',
        'durationMin': 90,
        'docx': Path(r'C:\Users\LENOVO\Downloads\DeCuongOnTap_KTGK_K12_GV.docx'),
        'mode': 'tin12',
    },
    {
        'id': 'de-cuong-su12-gk1',
        'code': 'SU12',
        'title': 'Đề cương ôn tập giữa kì 1 – Lịch sử 12 (2026–2027)',
        'subject': 'Lịch sử 12 – Chủ đề 1 (Liên hợp quốc, Trật tự thế giới trong & sau Chiến tranh lạnh) & Chủ đề 2 (ASEAN)',
        'durationMin': 90,
        'docx': Path(r'C:\Users\LENOVO\Downloads\GV-LS12-TÀI LIỆU ÔN TẬP GIỮA HKI.docx'),
        'mode': 'su12',
    },
    {
        'id': 'de-cuong-gdqp12-gk1',
        'code': 'GDQP12',
        'title': 'Đề cương ôn tập giữa kì 1 – GDQP & AN 12 (2026–2027)',
        'subject': 'GDQP & AN 12 – Bài 1 (Bảo vệ Tổ quốc sau 1975), Bài 2 (Tổ chức QĐND & CAND), Bài 3 (Tuyển sinh & Đào tạo)',
        'durationMin': 60,
        'docx': Path(r'C:\Users\LENOVO\Downloads\DE_CUONG_12_CÓ ĐÁP ÁN.docx'),
        'mode': 'gdqp12',
    },
]


def load_rel_map(docx_path: Path):
    with zipfile.ZipFile(docx_path) as z:
        rels = z.read('word/_rels/document.xml.rels').decode('utf-8')
    out = {}
    for m in re.finditer(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels):
        out[m.group(1)] = m.group(2)
    return out


def prep_images_for(docx_path: Path, slug: str):
    img_dir = ROOT / 'data' / 'img' / slug
    img_dir.mkdir(parents=True, exist_ok=True)
    tmp_dir = TMP_MULTI / f'media_{slug}'
    tmp_dir.mkdir(parents=True, exist_ok=True)

    mapping = {}
    stats = {'copy': 0, 'conv_total': 0, 'conv_ok': 0, 'conv_fail': []}
    to_convert = []

    with zipfile.ZipFile(docx_path) as z:
        for info in z.infolist():
            if not info.filename.startswith('word/media/') or info.is_dir():
                continue
            base = Path(info.filename).name
            stem, ext = Path(base).stem, Path(base).suffix.lower()
            data = z.read(info.filename)
            if ext in ('.png', '.jpg', '.jpeg', '.gif', '.webp'):
                out = img_dir / base
                out.write_bytes(data)
                mapping[base] = out.name
                stats['copy'] += 1
            elif ext in ('.wmf', '.emf'):
                src_f = tmp_dir / base
                src_f.write_bytes(data)
                out = img_dir / f'{stem}.png'
                to_convert.append((base, src_f, out))

    stats['conv_total'] = len(to_convert)
    if to_convert:
        lines = [
            'Add-Type -AssemblyName System.Drawing',
            '$ErrorActionPreference = "Stop"',
        ]
        for base, src_f, out in to_convert:
            s_src = str(src_f).replace("'", "''")
            s_out = str(out).replace("'", "''")
            lines.append(
                f"try {{ "
                f"$mf = New-Object System.Drawing.Imaging.Metafile('{s_src}'); "
                f"$w = [Math]::Max(36, [int]($mf.Width * 2.5)); "
                f"$h = [Math]::Max(20, [int]($mf.Height * 2.5)); "
                f"if ($w -gt 1600) {{ $r = 1600.0 / $w; $w = 1600; $h = [Math]::Max(20, [int]($h * $r)); }} "
                f"$bmp = New-Object System.Drawing.Bitmap($w, $h); "
                f"$g = [System.Drawing.Graphics]::FromImage($bmp); "
                f"$g.Clear([System.Drawing.Color]::White); "
                f"$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias; "
                f"$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic; "
                f"$g.DrawImage($mf, 0, 0, $w, $h); "
                f"$bmp.Save('{s_out}', [System.Drawing.Imaging.ImageFormat]::Png); "
                f"$g.Dispose(); $bmp.Dispose(); $mf.Dispose() "
                f"}} catch {{ Write-Output ('ERR:' + '{base}' + ':' + $_.Exception.Message) }}"
            )
        ps_file = TMP_MULTI / f'_wmf2png_{slug}.ps1'
        ps_file.write_text('\n'.join(lines), encoding='utf-8')
        proc = subprocess.run(
            ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(ps_file)],
            capture_output=True, text=True, timeout=300
        )
        errs = [ln for ln in (proc.stdout or '').splitlines() if ln.startswith('ERR:')]
        for base, _, out in to_convert:
            if out.exists() and out.stat().st_size > 0:
                mapping[base] = out.name
                stats['conv_ok'] += 1
            else:
                stats['conv_fail'].append(base)
        for e in errs:
            stats['conv_fail'].append(e)

    shutil.rmtree(tmp_dir, ignore_errors=True)
    return mapping, stats


def run_flags(r_el):
    f = {'b': False, 'i': False, 'u': False, 'sub': False, 'sup': False, 'red': False}
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

    f['b'] = _on(rPr.find(W('b')), ('0', 'false'))
    f['i'] = _on(rPr.find(W('i')), ('0', 'false'))
    f['u'] = _on(rPr.find(W('u')), ('none', '0', 'false'))
    va = rPr.find(W('vertAlign'))
    if va is not None:
        v = va.get(W('val'))
        f['sub'] = (v == 'subscript')
        f['sup'] = (v == 'superscript')
    c = rPr.find(W('color'))
    if c is not None:
        cv = (c.get(W('val')) or '').upper()
        if cv in ('FF0000', 'C00000', 'EE0000', 'E00000'):
            f['red'] = True
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


def make_img_html(slug: str, filename: str, inline: bool = True):
    src = f'data/img/{slug}/{filename}'
    if inline:
        return (
            f'<img class="qimg-inline" src="{escape(src)}" '
            f'style="vertical-align:middle;max-height:140px;max-width:min(100%,520px);height:auto;background:#fff;padding:2px 4px;border-radius:6px" '
            f'alt="công thức/hình">'
        )
    return (
        f'<img class="qimg" src="{escape(src)}" '
        f'style="max-width:min(100%,520px);height:auto;border-radius:10px;background:#fff;padding:6px" '
        f'alt="hình câu hỏi">'
    )


def parse_para(p_el, rel_map, media_map, slug):
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
                    is_vml = False
                else:
                    rid = node.get(qn('r:id')) or node.get(qn('r:embed'))
                    is_vml = True
                if not rid or rid in seen:
                    continue
                seen.add(rid)
                tgt = rel_map.get(rid) or ''
                base = Path(tgt).name if tgt else None
                served = media_map.get(base) if base else None
                if served:
                    h = make_img_html(slug, served, inline=is_vml)
                    pieces.append({'kind': 'img', 'text': '\ufffc', 'html': h, 'flags': fl, 'start': pos, 'end': pos + 1})
                else:
                    pieces.append({'kind': 'img_error', 'text': '\ufffc', 'name': base or rid, 'flags': fl, 'start': pos, 'end': pos + 1})
                pos += 1

    lines = []
    cur = []
    cur_off = 0

    def close_line(endpos):
        nonlocal cur, cur_off
        raw = ''.join(p['text'] for p in cur)
        has_img = any(p['kind'] == 'img' for p in cur)
        lines.append({'raw': raw, 'pieces': cur, 'offset': cur_off, 'has_img': has_img})
        cur = []
        cur_off = endpos

    for p in pieces:
        if p['kind'] == 'text' and p['text'] == '\n':
            close_line(p['start'] + 1)
        else:
            cur.append(p)
    close_line(pos)
    return {'lines': lines}


def slice_line_html(line, s_rel: int, e_rel: int) -> str:
    """Trích xuất HTML (bao gồm sub/sup/b/i, escape HTML và ảnh inline) từ vị trí s_rel đến e_rel trên line."""
    out = []
    for p in line['pieces']:
        rs = p['start'] - line['offset']
        re_ = p['end'] - line['offset']
        if re_ <= s_rel or rs >= e_rel:
            continue
        if p['kind'] == 'img':
            out.append(p['html'])
        elif p['kind'] == 'img_error':
            out.append(f"<em>(ảnh {escape(str(p['name']))})</em>")
        else:
            sub_s = max(0, s_rel - rs)
            sub_e = min(len(p['text']), e_rel - rs)
            sub_p = {**p, 'text': p['text'][sub_s:sub_e]}
            out.append(text_piece_html(sub_p))
    res = ''.join(out).strip()
    return res


def line_html(line):
    return slice_line_html(line, 0, len(line['raw']))


def strip_trailing_dot_html(s: str) -> str:
    s = s.strip()
    # Chỉ bỏ dấu chấm cuối nếu không phải thẻ đóng và không phải kiểu '...'
    if s.endswith('.') and not s.endswith('..'):
        return s[:-1].strip()
    return s


def label_und_or_red(line, s_rel: int, e_rel: int, check_red_in_span=None) -> bool:
    for p in line['pieces']:
        if p['kind'] != 'text':
            continue
        rs = p['start'] - line['offset']
        re_ = p['end'] - line['offset']
        if re_ > s_rel and rs < e_rel:
            sub = p['text'][max(0, s_rel - rs):min(len(p['text']), e_rel - rs)]
            if sub.strip() and (p['flags'].get('u') or p['flags'].get('red')):
                return True
    if check_red_in_span is not None:
        cs, ce = check_red_in_span
        for p in line['pieces']:
            if p['kind'] != 'text':
                continue
            rs = p['start'] - line['offset']
            re_ = p['end'] - line['offset']
            if re_ > cs and rs < ce and p['text'].strip() and p['flags'].get('red'):
                return True
    return False


def table_html(tbl_el, rel_map, media_map, slug, is_code_box=False):
    rows_data = []
    for r_i, tr in enumerate(tbl_el.findall(W('tr'))):
        cells = []
        for tc in tr.findall(W('tc')):
            cell_lines = []
            for p in tc.findall(W('p')):
                res = parse_para(p, rel_map, media_map, slug)
                for ln in res['lines']:
                    h = line_html(ln)
                    if h:
                        cell_lines.append(h)
            cells.append('<br>'.join(cell_lines))
        if any(c.strip() for c in cells):
            rows_data.append(cells)
    if not rows_data:
        return ''
    if is_code_box or (len(rows_data) == 1 and len(rows_data[0]) == 1):
        return (
            '<div style="background:#1E293B;color:#F8FAFC;padding:10px 14px;border-radius:10px;'
            'font-family:Consolas,monospace;font-size:14px;margin:8px 0;line-height:1.55">'
            f'{rows_data[0][0]}</div>'
        )
    rows_html = []
    for r_i, cells in enumerate(rows_data):
        tag = 'th' if r_i == 0 else 'td'
        style = 'border:1px solid #C9BCF2;padding:5px 10px;vertical-align:top'
        if r_i == 0:
            style += ';background:#F3E8FF;font-weight:600'
        tds = [f'<{tag} style="{style}">{c}</{tag}>' for c in cells]
        rows_html.append('<tr>' + ''.join(tds) + '</tr>')
    return '<table style="border-collapse:collapse;margin:8px 0;font-size:14.5px">' + ''.join(rows_html) + '</table>'


RE_OPT = re.compile(r'(?:^|[\t ]+)([A-D])\s*\.\s*')
RE_STM = re.compile(r'^\s*([a-d])\s*[).]\s*')
RE_STM_INLINE = re.compile(r'(?:^|[\t ]+)([a-d])\s*[).]\s*')
RE_CAU_PREFIX = re.compile(r'^\s*<\s*strong\s*>\s*Câu\s*\d+\s*[.:]?\s*<\s*/\s*strong\s*>\s*|^\s*Câu\s*\d+\s*[.:]?\s*', re.I)


def clean_cau_prefix(html_str: str) -> str:
    # Bỏ chữ "Câu X." ở đầu câu dẫn để tránh lặp "Câu 1. Câu 1."
    s = html_str.strip()
    s = re.sub(r'^(?:<strong>\s*)?Câu\s*\d+\s*[.:]?\s*(?:</strong>\s*)?', '', s, flags=re.I)
    s = re.sub(r'^<strong>\s*\d+\s*[.:]?\s*</strong>\s*', '', s)
    s = re.sub(r'^\[(?:NB|TH|VD|VDC)\]\s*', '', s, flags=re.I)
    s = re.sub(r'^<strong>\s*\[(?:NB|TH|VD|VDC)\]\s*</strong>\s*', '', s, flags=re.I)
    return s.strip()


def is_option_table_4(tbl_el):
    """Kiểm tra bảng 1x4 chứa 4 phương án A., B., C., D. (như Bài 17 Tin học 12)."""
    tcs = list(tbl_el.iter(W('tc')))
    if len(tcs) != 4:
        return False
    texts = [''.join(n.text or '' for n in tc.iter(W('t'))).strip() for tc in tcs]
    return all(re.match(rf'^{L}\s*\.', texts[i]) for i, L in enumerate('ABCD'))


def parse_option_table_4(tbl_el, rel_map, media_map, slug):
    tcs = list(tbl_el.iter(W('tc')))
    opts = []
    marked = []
    for i, tc in enumerate(tcs):
        cell_lines = []
        is_marked = False
        for p in tc.findall(W('p')):
            res = parse_para(p, rel_map, media_map, slug)
            for ln in res['lines']:
                if not ln['raw'].strip():
                    continue
                m = re.match(r'^\s*([A-D])\s*\.\s*', ln['raw'])
                if m:
                    if label_und_or_red(ln, m.start(), m.end(), (m.end(), len(ln['raw']))):
                        is_marked = True
                    cell_lines.append(slice_line_html(ln, m.end(), len(ln['raw'])))
                else:
                    cell_lines.append(line_html(ln))
        opts.append(strip_trailing_dot_html('<br>'.join(c for c in cell_lines if c)))
        if is_marked:
            marked.append(i)
    return opts, marked


def find_sequential_options(raw_line: str, start_idx: int):
    """Tìm tuần tự các nhãn phương án đúng theo thứ tự ABCD (start_idx = 0..3) trên raw_line.
    Tránh bắt nhầm 'G - C.' hay 'T - A.' ở cuối phương án Sinh/Hóa."""
    found = []
    pos = 0
    cur_idx = start_idx
    while cur_idx < 4 and pos < len(raw_line):
        target = 'ABCD'[cur_idx]
        # Tìm target + '.' từ vị trí pos
        pat = re.compile(rf'(?:^|[\t ]+)({target})\s*\.\s*')
        matched = None
        search_from = pos
        while search_from < len(raw_line):
            m = pat.search(raw_line, search_from)
            if not m:
                break
            # Kiểm tra phía sau m.end() có thực sự còn nội dung phương án không
            # (tránh 'G - C.\tB.' hoặc 'G - C. ' ở cuối dòng khi m.start() > 0)
            rest = raw_line[m.end():].strip()
            if m.start() > 0 and not rest:
                search_from = m.end()
                continue
            if cur_idx + 1 < 4:
                nxt_L = 'ABCD'[cur_idx + 1]
                # Nếu ngay sau 'C.' lại là '\tB.' hoặc '\tD.' mà giữa chúng rỗng -> giả
                if re.match(rf'^[A-D]\s*\.', rest):
                    search_from = m.end()
                    continue
            matched = m
            break
        if not matched:
            break
        found.append((target, matched))
        pos = matched.end()
        cur_idx += 1
    return found


def build_p1_question(g, rel_map, media_map, slug, warn, lesson_badge=''):
    content = []
    labels = []  # (letter, ln, m, end_pos)
    tbl_opts = None
    tbl_marked = []

    for kind, el in g:
        if kind == 't':
            if is_option_table_4(el):
                tbl_opts, tbl_marked = parse_option_table_4(el, rel_map, media_map, slug)
            else:
                content.append(table_html(el, rel_map, media_map, slug))
            continue
        res = parse_para(el, rel_map, media_map, slug)
        for ln in res['lines']:
            if not ln['raw'].strip():
                continue
            ms = find_sequential_options(ln['raw'], len(labels))
            if ms:
                first = ms[0][1].start()
                if first > 0 and not labels:
                    pre = slice_line_html(ln, 0, first)
                    if pre:
                        content.append(pre)
                for idx_m, (L, m) in enumerate(ms):
                    end_pos = ms[idx_m + 1][1].start() if idx_m + 1 < len(ms) else len(ln['raw'])
                    labels.append((L, ln, m, end_pos))
            else:
                if labels:
                    # Dòng tiếp nối của phương án trước đó
                    prev_L, prev_ln, prev_m, prev_end = labels[-1][:4]
                    prev_extra = labels[-1][4] if len(labels[-1]) > 4 else ''
                    content_extra = line_html(ln)
                    comb = (prev_extra + ' ' + content_extra).strip() if prev_extra else content_extra
                    labels[-1] = (prev_L, prev_ln, prev_m, prev_end, comb)
                else:
                    content.append(line_html(ln))

    if tbl_opts is not None:
        opts = tbl_opts
        marked = tbl_marked
    else:
        letters = [L for L, *_ in labels]
        if letters != ['A', 'B', 'C', 'D']:
            warn.append(f"P1 nhãn {letters} != ABCD (câu: {content[0][:60] if content else ''})")
        opts = []
        marked = []
        for i, item in enumerate(labels):
            L, ln, m, end_pos = item[:4]
            extra = item[4] if len(item) > 4 else ''
            opt_h = slice_line_html(ln, m.end(), end_pos)
            if extra:
                opt_h = (opt_h + ' ' + extra).strip()
            opts.append(strip_trailing_dot_html(opt_h))
            if label_und_or_red(ln, m.start(), m.end(), (m.end(), end_pos)):
                marked.append(i)

    while len(opts) < 4:
        opts.append('')
    opts = opts[:4]
    ai = marked[0] if len(marked) == 1 else (marked[0] if marked else None)
    if content:
        content[0] = clean_cau_prefix(content[0])
    stem_plain = re.sub(r'<[^>]+>', ' ', ' '.join(content)).strip()
    if ai is None and slug == 'de-cuong-ly12-gk1':
        if 'hóa hơi hoàn toàn ở nhiệt độ không đổi' in stem_plain or 'làm biến đổi nội năng của vật không' in stem_plain:
            ai = 0
            marked = [0]
    if len(marked) != 1:
        warn.append(f"P1 đáp án gạch chân={marked} (câu: {content[0][:60] if content else ''})")

    stem = '<br>'.join(c for c in content if c)
    if lesson_badge:
        stem = f'<span class="badge" style="margin-bottom:4px">{escape(lesson_badge)}</span><br>{stem}'
    return {'part': 1, 'content': stem, 'options': opts, 'answerIndex': ai}


def build_p2_question(g, rel_map, media_map, slug, warn, lesson_badge=''):
    content = []
    statements = []
    for kind, el in g:
        if kind == 't':
            content.append(table_html(el, rel_map, media_map, slug))
            continue
        res = parse_para(el, rel_map, media_map, slug)
        for ln in res['lines']:
            if not ln['raw'].strip():
                continue
            m = RE_STM.match(ln['raw'])
            if m:
                e0, s0 = m.end(), m.start(1)
                st_html = slice_line_html(ln, e0, len(ln['raw']))
                ans = bool(label_und_or_red(ln, s0, e0))
                statements.append({'text': st_html, 'answer': ans})
            else:
                content.append(line_html(ln))
    if len(statements) != 4:
        warn.append(f"P2 số ý={len(statements)} != 4 (câu: {content[0][:60] if content else ''})")
    if content:
        content[0] = clean_cau_prefix(content[0])
    stem = '<br>'.join(c for c in content if c)
    if lesson_badge:
        stem = f'<span class="badge" style="margin-bottom:4px">{escape(lesson_badge)}</span><br>{stem}'
    return {'part': 2, 'content': stem, 'statements': statements}


def build_p3_question(g, rel_map, media_map, slug, warn, lesson_badge=''):
    content = []
    answer = None
    for kind, el in g:
        if kind == 't':
            content.append(table_html(el, rel_map, media_map, slug))
            continue
        res = parse_para(el, rel_map, media_map, slug)
        for ln in res['lines']:
            raw_s = ln['raw'].strip()
            if not raw_s:
                continue
            m_ans = re.match(r'^(?:A\.|ĐS\.?|Đáp\s*(?:án|số)\s*[:.]?)\s*([-+]?\d+(?:[.,]\d+)?)\s*$', raw_s, re.I)
            if m_ans:
                num_str = m_ans.group(1).replace(',', '.')
                val = float(num_str)
                answer = int(val) if val.is_integer() else val
            else:
                content.append(line_html(ln))
    if answer is None:
        warn.append(f"P3 thiếu đáp số (câu: {content[0][:60] if content else ''})")
    if content:
        content[0] = clean_cau_prefix(content[0])
    stem = '<br>'.join(c for c in content if c)
    if lesson_badge:
        stem = f'<span class="badge" style="margin-bottom:4px">{escape(lesson_badge)}</span><br>{stem}'
    return {'part': 3, 'content': stem, 'answer': answer}


def parse_subject(cfg):
    slug = cfg['id']
    docx_path = cfg['docx']
    mode = cfg['mode']
    rel_map = load_rel_map(docx_path)
    media_map, img_stats = prep_images_for(docx_path, slug)

    doc = Document(str(docx_path))
    evs = []
    for ch in doc.element.body.iterchildren():
        if ch.tag == W('p'):
            evs.append(('p', ch))
        elif ch.tag == W('tbl'):
            evs.append(('t', ch))

    p1_qs, p2_qs, p3_qs = [], [], []
    warn = []

    cur_part = None
    cur_lesson = ''
    cur_group = []

    def flush_group():
        nonlocal cur_group
        if not cur_group or cur_part not in (1, 2, 3):
            cur_group = []
            return
        if cur_part == 1:
            p1_qs.append(build_p1_question(cur_group, rel_map, media_map, slug, warn, cur_lesson))
        elif cur_part == 2:
            p2_qs.append(build_p2_question(cur_group, rel_map, media_map, slug, warn, cur_lesson))
        elif cur_part == 3:
            p3_qs.append(build_p3_question(cur_group, rel_map, media_map, slug, warn, cur_lesson))
        cur_group = []

    for k, el in evs:
        if k == 'p':
            txt = ''.join(n.text or '' for n in el.iter(W('t'))).replace('\xa0', ' ').strip()
            has_img = (el.find('.//' + qn('a:blip')) is not None) or (el.find('.//' + VML) is not None)
            if not txt and not has_img:
                continue
            num = el.find('.//' + W('numPr')) is not None

            # Nhận diện tiêu đề Bài / Chủ đề
            m_bai = re.match(r'^(BÀI\s*\d+\s*[.:]\s*.+)$', txt, re.I)
            if m_bai and not num and len(txt) < 120:
                flush_group()
                cur_lesson = m_bai.group(1).strip()
                continue
            if re.match(r'^CHỦ\s*ĐỀ\s*\d+', txt, re.I) and not num:
                flush_group()
                continue
            if re.match(r'^\*?\s*Lưu ý\s*:', txt, re.I):
                flush_group()
                continue

            # Nhận diện chuyển Phần I / II / III
            if not num:
                if re.match(r'^(?:PHẦN\s*I\b|I\.\s*(?:TRẮC NGHIỆM|Câu hỏi)|A\.\s*TRẮC NGHIỆM NHIỀU)', txt, re.I):
                    flush_group()
                    cur_part = 1
                    continue
                if re.match(r'^(?:PHẦN\s*II\b|II\.\s*(?:TRẮC NGHIỆM|Câu hỏi|Phần trắc)|B\.\s*TRẮC NGHIỆM ĐÚNG)', txt, re.I):
                    flush_group()
                    cur_part = 2
                    continue
                if re.match(r'^(?:PHẦN\s*III\b|III\.\s*TRẮC NGHIỆM)', txt, re.I):
                    flush_group()
                    cur_part = 3
                    continue
                # Bỏ qua dòng hướng dẫn trong ngoặc đơn đầu phần
                if re.match(r'^\((?:Mỗi câu hỏi|Trong mỗi ý)', txt, re.I):
                    continue

            if cur_part is None:
                continue

            # Nhận diện bắt đầu câu hỏi mới
            is_new_q = False
            if mode in ('ly12', 'gdqp12'):
                is_new_q = num
            elif mode == 'sinh12':
                if cur_part == 1:
                    is_new_q = num
                else:
                    is_new_q = bool(re.match(r'^Câu\s*\d+\s*[.:]', txt, re.I))
            elif mode in ('tin12', 'su12'):
                is_new_q = bool(re.match(r'^Câu\s*\d+\b', txt, re.I))

            if is_new_q:
                flush_group()
                cur_group = [(k, el)]
            else:
                if cur_group:
                    cur_group.append((k, el))
        else:
            if cur_group:
                cur_group.append((k, el))

    flush_group()

    questions = p1_qs + p2_qs + p3_qs
    parts_meta = []
    if p1_qs:
        parts_meta.append({
            'part': 1,
            'label': 'PHẦN I – TRẮC NGHIỆM NHIỀU LỰA CHỌN',
            'hint': f'{len(p1_qs)} câu. Mỗi câu có 4 phương án, chỉ chọn 1 đáp án đúng.',
            'points': '0,25 điểm/câu',
        })
    if p2_qs:
        parts_meta.append({
            'part': 2,
            'label': 'PHẦN II – TRẮC NGHIỆM ĐÚNG SAI',
            'hint': f'{len(p2_qs)} câu. Mỗi câu có 4 ý a, b, c, d – tại mỗi ý em chọn Đúng hoặc Sai.',
            'points': '1 ý đúng 0,10 – 2 ý 0,25 – 3 ý 0,50 – đủ 4 ý 1,00 (QĐ 764/QĐ-BGDĐT 2024). Có ý chọn sai ở bất kỳ ý nào thì câu đó 0 điểm.',
        })
    if p3_qs:
        parts_meta.append({
            'part': 3,
            'label': 'PHẦN III – TRẮC NGHIỆM TRẢ LỜI NGẮN',
            'hint': f'{len(p3_qs)} câu. Em điền kết quả (chỉ nhập số).',
            'points': '0,25 điểm/câu',
        })

    exam_obj = {
        'schema': 1,
        'id': slug,
        'title': cfg['title'],
        'subject': cfg['subject'],
        'code': cfg['code'],
        'hasPassword': False,
        'durationMin': cfg['durationMin'],
        'shuffleQuestions': True,
        'shuffleOptions': True,
        'showAnswersAfterSubmit': True,
        'scoring': {
            'strictPart2': True,
            'part1': 0.25,
            'part2': [0.1, 0.25, 0.5, 1.0],
            'part3': 0.25,
        },
        'parts': parts_meta,
        'questions': questions,
    }
    out_json = ROOT / 'data' / 'tests' / f'{slug}.json'
    out_json.write_text(json.dumps(exam_obj, ensure_ascii=False, indent=1), encoding='utf-8')

    print(f"[{cfg['code']}] P1={len(p1_qs)} P2={len(p2_qs)} P3={len(p3_qs)} TONG={len(questions)} | img_copy={img_stats['copy']} wmf={img_stats['conv_ok']}/{img_stats['conv_total']} | warn={len(warn)} -> {out_json.name}")
    for w in warn[:10]:
        print('   WARN:', w)
    return {
        'cfg': cfg,
        'p1': p1_qs,
        'p2': p2_qs,
        'p3': p3_qs,
        'questions': questions,
        'warn': warn,
        'img_stats': img_stats,
    }


if __name__ == '__main__':
    for c in SUBJECT_CONFIGS:
        parse_subject(c)
