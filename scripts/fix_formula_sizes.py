# -*- coding: utf-8 -*-
"""Đọc kích thước thực (width/height pt) của từng đối tượng công thức/ảnh trong Word XML
của Vật lí 12 và Hóa học 12, đồng thời cập nhật lại thẻ <img> trong JSON để công thức inline
hiển thị đúng bằng cỡ chữ văn bản bên cạnh (không bị phóng to khổng lồ)."""
import io
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def extract_rid_dimensions(docx_bytes: bytes):
    """Trả về dict: filename (vd 'image15.png') -> (width_pt, height_pt, is_vml)"""
    with zipfile.ZipFile(io.BytesIO(docx_bytes)) as z:
        rels_xml = z.read('word/_rels/document.xml.rels').decode('utf-8')
        doc_xml = z.read('word/document.xml').decode('utf-8')

    rid_to_file = {}
    for m in re.finditer(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels_xml):
        rid = m.group(1)
        base = Path(m.group(2)).name
        stem = Path(base).stem
        ext = Path(base).suffix.lower()
        served = f'{stem}.png' if ext in ('.wmf', '.emf') else base
        rid_to_file[rid] = served

    file_dims = {}

    # 1. Tìm tất cả <v:shape ... style="...">...<v:imagedata r:id="rIdX"/>
    for m in re.finditer(r'<v:shape\b([^>]*)>([\s\S]*?)</v:shape>', doc_xml):
        attrs, inner = m.group(1), m.group(2)
        rm = re.search(r'r:id="(rId\d+)"', inner)
        if not rm:
            continue
        rid = rm.group(1)
        fname = rid_to_file.get(rid)
        if not fname:
            continue
        sm = re.search(r'style="([^"]+)"', attrs)
        if sm:
            st = sm.group(1)
            wm = re.search(r'width\s*:\s*([\d.]+)\s*(pt|in|cm|mm|px)', st)
            hm = re.search(r'height\s*:\s*([\d.]+)\s*(pt|in|cm|mm|px)', st)
            if hm:
                val = float(hm.group(1))
                unit = hm.group(2)
                h_pt = val * 72 if unit == 'in' else (val * 28.35 if unit == 'cm' else (val * 2.835 if unit == 'mm' else (val * 0.75 if unit == 'px' else val)))
                w_pt = float(wm.group(1)) if wm else 0
                file_dims[fname] = (w_pt, round(h_pt, 2), True)

    # 2. Tìm tất cả <wp:inline> / <wp:anchor> chứa <wp:extent cx="..." cy="..."/> và <a:blip r:embed="rIdX"/>
    for m in re.finditer(r'<wp:(?:inline|anchor)\b[^>]*>([\s\S]*?)</wp:(?:inline|anchor)>', doc_xml):
        inner = m.group(1)
        rm = re.search(r'r:embed="(rId\d+)"', inner)
        em = re.search(r'<wp:extent\s+cx="(\d+)"\s+cy="(\d+)"', inner)
        if rm and em:
            rid = rm.group(1)
            fname = rid_to_file.get(rid)
            if fname and fname not in file_dims:
                # 1 pt = 12700 EMUs
                w_pt = round(int(em.group(1)) / 12700.0, 2)
                h_pt = round(int(em.group(2)) / 12700.0, 2)
                file_dims[fname] = (w_pt, h_pt, False)

    return file_dims


def extract_wmf_texts(docx_bytes: bytes):
    """Trích xuất chuỗi text ASCII/Unicode nằm trong các bản ghi META_EXTTEXTOUT / META_TEXTOUT của file .wmf Equation."""
    out = {}
    with zipfile.ZipFile(io.BytesIO(docx_bytes)) as z:
        for info in z.infolist():
            if not info.filename.startswith('word/media/') or not info.filename.lower().endswith(('.wmf', '.emf')):
                continue
            stem = Path(info.filename).stem
            data = z.read(info.filename)
            # Tìm chuỗi ký tự in được trong WMF (bỏ font names như Times New Roman, Symbol, MT Extra)
            strings = re.findall(rb'[\x20-\x7e]{1,40}', data)
            cleaned = []
            skip_fonts = {'times new roman', 'symbol', 'mt extra', 'courier new', 'arial', 'calibri', 'cambria math', 'euclid'}
            for s in strings:
                txt = s.decode('latin1', errors='ignore').strip()
                if not txt or txt.lower() in skip_fonts:
                    continue
                if any(f in txt.lower() for f in skip_fonts):
                    continue
                cleaned.append(txt)
            out[f'{stem}.png'] = ' '.join(cleaned)
    return out


def fix_json_img_styles(json_path: Path, file_dims: dict):
    ex = json.loads(json_path.read_text(encoding='utf-8'))
    replaced = 0

    def repl_img(html_str: str) -> str:
        nonlocal replaced
        if not html_str or '<img' not in html_str:
            return html_str

        def _cb(m):
            nonlocal replaced
            full_tag = m.group(0)
            src_m = re.search(r'src="([^"]+)"', full_tag)
            if not src_m:
                return full_tag
            src = src_m.group(1)
            fname = Path(src).name
            dims = file_dims.get(fname)
            if not dims:
                return full_tag
            w_pt, h_pt, is_vml = dims
            replaced += 1
            if is_vml or h_pt <= 36:
                # Công thức inline: dùng chiều cao đúng theo pt trong Word (quy đổi sang px: 1pt ≈ 1.33px, căn giữa dòng chữ)
                h_px = max(16, round(h_pt * 1.28, 1))
                v_align = '-0.28em' if h_pt <= 18 else 'middle'
                return (
                    f'<img class="qimg-inline" src="{src}" '
                    f'style="height:{h_px}px;width:auto;vertical-align:{v_align};margin:0 2px;display:inline-block" '
                    f'loading="lazy" decoding="async" alt="công thức">'
                )
            else:
                # Hình vẽ minh họa lớn (đồ thị, sơ đồ thí nghiệm)
                w_px = min(460, max(120, round(w_pt * 1.33)))
                return (
                    f'<img class="qimg" src="{src}" '
                    f'style="width:{w_px}px;max-width:100%;height:auto;display:block;margin:8px 0;border-radius:6px" '
                    f'loading="lazy" decoding="async" alt="hình câu hỏi">'
                )

        return re.sub(r'<img\b[^>]*>', _cb, html_str)

    for q in ex.get('questions', []):
        q['content'] = repl_img(q.get('content', ''))
        if 'options' in q:
            q['options'] = [repl_img(o) for o in q['options']]
        if 'statements' in q:
            for st in q['statements']:
                st['text'] = repl_img(st.get('text', ''))

    json_path.write_text(json.dumps(ex, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'Fixed {json_path.name}: {replaced} <img> tags resized to exact Word pt dimensions!')


# 1. Vật lí 12
with zipfile.ZipFile(r'C:\Users\LENOVO\Downloads\ĐỀ CƯƠNG ÔN TẬP GIỮA HKI-VẬT LÍ 12 (1).zip') as z:
    ly_bytes = z.read('ĐỀ CƯƠNG ÔN TẬP GIỮA HKI-VẬT LÍ 12/VẬT LÍ 12-GKI-GV.docx')
ly_dims = extract_rid_dimensions(ly_bytes)
print('LY12 dims count:', len(ly_dims), 'Sample:', list(ly_dims.items())[:8])
fix_json_img_styles(ROOT / 'data' / 'tests' / 'de-cuong-ly12-gk1.json', ly_dims)

# 2. Hóa học 12
hoa_bytes = Path(r'C:\Users\LENOVO\Downloads\Hóa 12 - ĐỀ CƯƠNG GIỮA KÌ 1 (2026 - 2027) - Đáp án (1).docx').read_bytes()
hoa_dims = extract_rid_dimensions(hoa_bytes)
print('HOA12 dims count:', len(hoa_dims), 'Sample:', list(hoa_dims.items())[:8])
fix_json_img_styles(ROOT / 'data' / 'tests' / 'de-cuong-gk1-2627.json', hoa_dims)

# 3. Sinh học 12 & Tin học 12
sinh_bytes = Path(r'C:\Users\LENOVO\Downloads\Đề cương ôn tập GK 1-Đáp án (1).docx').read_bytes()
fix_json_img_styles(ROOT / 'data' / 'tests' / 'de-cuong-sinh12-gk1.json', extract_rid_dimensions(sinh_bytes))

tin_bytes = Path(r'C:\Users\LENOVO\Downloads\DeCuongOnTap_KTGK_K12_GV.docx').read_bytes()
fix_json_img_styles(ROOT / 'data' / 'tests' / 'de-cuong-tin12-gk1.json', extract_rid_dimensions(tin_bytes))
