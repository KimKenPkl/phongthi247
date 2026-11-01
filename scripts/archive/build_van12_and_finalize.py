# -*- coding: utf-8 -*-
"""1) Kiểm tra QA toàn bộ ảnh & câu hỏi của các đề JSON mới.
2) Sinh trang ôn tập tương tác van12.html từ 'ĐỀ CƯƠNG GIỮA KÌ I VĂN 12 (2).docx'.
3) Copy bộ file đề cương PDF/DOCX của các môn vào data/docs/ để học sinh tải về nếu cần.
4) Cập nhật data/exams.json với đầy đủ các môn GK1 2026-2027.
"""
from html import escape
from pathlib import Path
import json
import re
import shutil

from docx import Document
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
TMP_MULTI = Path(__file__).resolve().parent / '_tmp_multi'
W = lambda k: qn('w:' + k)


def verify_all_json():
    print('=== 1. VERIFY ALL JSON EXAMS ===')
    tests_dir = ROOT / 'data' / 'tests'
    for jf in sorted(tests_dir.glob('*.json')):
        ex = json.loads(jf.read_text(encoding='utf-8'))
        qs = ex['questions']
        imgs = []
        for q in qs:
            imgs.extend(re.findall(r'src="([^"]+)"', str(q.get('content', ''))))
            for o in q.get('options', []):
                imgs.extend(re.findall(r'src="([^"]+)"', str(o)))
            for s in q.get('statements', []):
                imgs.extend(re.findall(r'src="([^"]+)"', str(s.get('text', ''))))
        missing = [im for im in set(imgs) if not (ROOT / im).exists() or (ROOT / im).stat().st_size == 0]
        print(f"  {jf.name:28s}: {len(qs):3d} câu | img_tags={len(imgs):3d} (unique={len(set(imgs)):3d}) | missing={len(missing)}")
        if missing:
            print('    MISSING:', missing[:10])


def copy_docs():
    print('=== 2. COPY DOCS TO data/docs/ ===')
    docs_dir = ROOT / 'data' / 'docs'
    docs_dir.mkdir(parents=True, exist_ok=True)
    pairs = [
        (Path(r'C:\Users\LENOVO\Downloads\Hóa 12 - ĐỀ CƯƠNG GIỮA KÌ 1 (2026 - 2027) - Đáp án (1).docx'), 'de-cuong-hoa12-gk1-dap-an.docx'),
        (TMP_MULTI / 'ĐỀ CƯƠNG ÔN TẬP GIỮA HKI-VẬT LÍ 12' / 'VẬT LÍ 12-GKI-HS.pdf', 'de-cuong-ly12-gk1-hs.pdf'),
        (TMP_MULTI / 'ĐỀ CƯƠNG ÔN TẬP GIỮA HKI-VẬT LÍ 12' / 'VẬT LÍ 12-GKI-GV.pdf', 'de-cuong-ly12-gk1-dap-an.pdf'),
        (Path(r'C:\Users\LENOVO\Downloads\Đề cương ôn tập GK 1-HS (1).pdf'), 'de-cuong-sinh12-gk1-hs.pdf'),
        (Path(r'C:\Users\LENOVO\Downloads\Đề cương ôn tập GK 1-Đáp án (1).docx'), 'de-cuong-sinh12-gk1-dap-an.docx'),
        (Path(r'C:\Users\LENOVO\Downloads\DeCuongOnTap_KTGK_K12_HS.docx'), 'de-cuong-tin12-gk1-hs.docx'),
        (Path(r'C:\Users\LENOVO\Downloads\DeCuongOnTap_KTGK_K12_GV.docx'), 'de-cuong-tin12-gk1-dap-an.docx'),
        (Path(r'C:\Users\LENOVO\Downloads\S12-TÀI LIỆU ÔN TẬP GIỮA HKI (HS).pdf'), 'de-cuong-su12-gk1-hs.pdf'),
        (Path(r'C:\Users\LENOVO\Downloads\GV-LS12-TÀI LIỆU ÔN TẬP GIỮA HKI.docx'), 'de-cuong-su12-gk1-dap-an.docx'),
        (Path(r'C:\Users\LENOVO\Downloads\DE_CUONG_12_KHÔNG ĐÁP ÁN.docx'), 'de-cuong-gdqp12-gk1-hs.docx'),
        (Path(r'C:\Users\LENOVO\Downloads\DE_CUONG_12_CÓ ĐÁP ÁN.docx'), 'de-cuong-gdqp12-gk1-dap-an.docx'),
        (Path(r'C:\Users\LENOVO\Downloads\ĐỀ CƯƠNG GIỮA KÌ I VĂN 12 (2).docx'), 'de-cuong-van12-gk1.docx'),
    ]
    for src, dst_name in pairs:
        if src.exists():
            dst = docs_dir / dst_name
            shutil.copy2(src, dst)
            print(f'  Copied: {dst_name} ({dst.stat().st_size / 1024:.1f} KB)')
        else:
            print(f'  WARN missing source: {src}')


def build_van12_html():
    print('=== 3. BUILD van12.html FROM DOCX ===')
    van_docx = Path(r'C:\Users\LENOVO\Downloads\ĐỀ CƯƠNG GIỮA KÌ I VĂN 12 (2).docx')
    doc = Document(str(van_docx))

    sections = []
    cur_sec = {'title': 'TỔNG QUAN & PHẦN 1: TIỂU THUYẾT HIỆN ĐẠI', 'id': 'phan-1', 'items': []}

    def para_to_html(p_el):
        chunks = []
        for r in p_el.iter(W('r')):
            rPr = r.find(W('rPr'))
            b = rPr is not None and rPr.find(W('b')) is not None and rPr.find(W('b')).get(W('val')) not in ('0', 'false')
            i = rPr is not None and rPr.find(W('i')) is not None and rPr.find(W('i')).get(W('val')) not in ('0', 'false')
            u = rPr is not None and rPr.find(W('u')) is not None and rPr.find(W('u')).get(W('val')) not in ('none', '0', 'false')
            txt = ''.join((n.text or '') for n in r.iter(W('t'))).replace('\xa0', ' ')
            if not txt:
                continue
            t = escape(txt)
            if u:
                t = f'<u>{t}</u>'
            if i:
                t = f'<em>{t}</em>'
            if b:
                t = f'<strong>{t}</strong>'
            chunks.append(t)
        return ''.join(chunks).strip()

    def tbl_to_html(tbl_el):
        rows = []
        for r_i, tr in enumerate(tbl_el.findall(W('tr'))):
            cells = []
            for tc in tr.findall(W('tc')):
                ps = [para_to_html(p) for p in tc.findall(W('p'))]
                ps = [x for x in ps if x]
                cells.append('<br>'.join(ps))
            if any(c.strip() for c in cells):
                tag = 'th' if r_i == 0 else 'td'
                tds = ''.join(f'<{tag}>{c}</{tag}>' for c in cells)
                rows.append(f'<tr>{tds}</tr>')
        return f'<div style="overflow-x:auto;margin:12px 0"><table>{"".join(rows)}</table></div>' if rows else ''

    sec_idx = 1
    for ch in doc.element.body.iterchildren():
        if ch.tag == W('p'):
            raw = ''.join((n.text or '') for n in ch.iter(W('t'))).replace('\xa0', ' ').strip()
            if not raw:
                continue
            # Nhận diện PHẦN 1..6 lớn
            if re.match(r'^PHẦN\s*(?:1|2|3|4|5|6|HAI|BA|BỐN|NĂM|SÁU)\s*[:.]', raw, re.I):
                if cur_sec['items']:
                    sections.append(cur_sec)
                sec_idx = len(sections) + 1
                cur_sec = {'title': raw, 'id': f'phan-{sec_idx}', 'items': []}
                continue
            h = para_to_html(ch)
            if not h:
                continue
            if re.match(r'^(?:Dạng\s*\d+|I\.\s*|II\.\s*|III\.\s*|ĐỀ\s*SỐ\s*\d+|BÀI\s*LÀM\s*THAM\s*KHẢO|HƯỚNG\s*DẪN\s*TRẢ\s*LỜI|GỢI\s*Ý)', raw, re.I):
                cur_sec['items'].append(f'<h3 class="van-subhead">{h}</h3>')
            elif re.match(r'^(?:Câu\s*\d+|[1-9]\.\s+[A-ZÀ-Ỹ]|[a-e]\.\s+)', raw):
                cur_sec['items'].append(f'<p class="van-lead">{h}</p>')
            else:
                cur_sec['items'].append(f'<p class="van-p">{h}</p>')
        elif ch.tag == W('tbl'):
            th = tbl_to_html(ch)
            if th:
                cur_sec['items'].append(th)

    if cur_sec['items']:
        sections.append(cur_sec)

    nav_btns = ''.join(
        f'<a class="btn" href="#{s["id"]}" style="font-size:13.5px;padding:7px 13px">{escape(s["title"])}</a>'
        for s in sections
    )
    sec_cards = []
    for s in sections:
        body_html = '\n'.join(s['items'])
        sec_cards.append(
            f'<section class="card van-sec" id="{s["id"]}">'
            f'<h2 style="color:var(--primary-ink);border-bottom:2px solid var(--line);padding-bottom:8px;margin-bottom:14px">{escape(s["title"])}</h2>'
            f'<div class="van-body">{body_html}</div>'
            f'</section>'
        )

    html = f"""<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Đề cương ôn tập Giữa kì 1 – Ngữ văn 12 (2026–2027) · Phòng Thi 24/7</title>
<meta name="theme-color" content="#6D28D9">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="assets/app.css?v=3">
<style>
  .van-subhead {{ margin: 18px 0 8px; padding: 8px 12px; background: var(--primary-soft); border-left: 4px solid var(--primary); border-radius: 8px; color: var(--primary-ink); font-size: 16.5px; }}
  .van-lead {{ margin: 10px 0 6px; font-weight: 600; color: #1E293B; }}
  .van-p {{ margin: 6px 0; line-height: 1.72; color: #1E293B; }}
  mark.hl {{ background: #FEF08A; padding: 0 2px; border-radius: 3px; }}
  .sticky-bar {{ position: sticky; top: 0; z-index: 25; background: rgba(250, 247, 254, 0.94); backdrop-filter: blur(6px); padding: 10px 0; border-bottom: 1.5px solid var(--line); margin-bottom: 14px; }}
</style>
</head>
<body>
<div class="site-head">
  <div class="container row">
    <div>
      <div class="brand">📚 Đề cương Giữa kì 1 – Ngữ văn 12 (2026–2027)</div>
      <div class="sub">Hệ thống kiến thức · Dàn ý Nghị luận văn học 200 chữ &amp; NLXH 600 chữ · Đề luyện Đọc hiểu &amp; Viết có hướng dẫn</div>
    </div>
    <div class="spacer"></div>
    <a class="btn" href="data/docs/de-cuong-van12-gk1.docx" download>⬇ Tải file Word (.docx)</a>
    <a class="btn btn-ghost" href="index.html" style="color:#fff;border-color:rgba(255,255,255,.35)">← Về trang chủ</a>
  </div>
</div>

<div class="container">
  <div class="sticky-bar">
    <div class="row" style="margin-bottom:8px">
      <input type="text" id="inpSearch" placeholder="🔍 Tìm nhanh dạng đề, tác phẩm, dàn ý, câu hỏi đọc hiểu..." style="flex:1;min-width:240px">
      <span class="badge" id="searchStat">{len(sections)} phần chuyên đề</span>
    </div>
    <div class="row" style="gap:6px">{nav_btns}</div>
  </div>

  <div id="vanContent">
    {''.join(sec_cards)}
  </div>
</div>

<footer>
  Phòng Thi 24/7 – Hệ thống ôn tập Giữa kì 1 Lớp 12 (2026–2027) · <a href="index.html">Quay về danh sách môn học</a>
</footer>

<script>
(function() {{
  const inp = document.getElementById('inpSearch');
  const secs = Array.from(document.querySelectorAll('.van-sec'));
  const stat = document.getElementById('searchStat');
  inp.addEventListener('input', () => {{
    const q = inp.value.trim().toLowerCase();
    let visibleCount = 0;
    secs.forEach(sec => {{
      const ps = Array.from(sec.querySelectorAll('.van-subhead, .van-lead, .van-p, tr'));
      if (!q) {{
        sec.style.display = '';
        ps.forEach(p => {{ p.style.display = ''; }});
        visibleCount++;
        return;
      }}
      let hitSec = false;
      ps.forEach(p => {{
        const match = p.textContent.toLowerCase().includes(q);
        p.style.display = match ? '' : 'none';
        if (match) hitSec = true;
      }});
      sec.style.display = hitSec ? '' : 'none';
      if (hitSec) visibleCount++;
    }});
    stat.textContent = q ? ('Tìm thấy trong ' + visibleCount + '/' + secs.length + ' phần') : (secs.length + ' phần chuyên đề');
  }});
}})();
</script>
</body>
</html>
"""
    out_van = ROOT / 'van12.html'
    out_van.write_text(html, encoding='utf-8')
    print(f'  Created: {out_van} ({len(sections)} sections, {out_van.stat().st_size / 1024:.1f} KB)')


def update_exams_json():
    print('=== 4. UPDATE data/exams.json ===')
    exams_data = {
        '_doc': 'Danh sach cac de thi site phat hanh. Admin tao de xong, them dong vao day de hoc sinh thay tren trang chu.',
        'updated': '2026-10-27',
        'exams': [
            {
                'id': 'de-cuong-gk1-2627',
                'title': 'Đề cương ôn tập giữa kì 1 – Hóa học 12 (2026–2027)',
                'subject': 'Hóa học 12 · Ester – Lipid, Carbohydrate, Amine – Amino acid – Protein',
                'count': 105,
                'durationMin': 120,
                'code': 'GK1',
                'hasPassword': False,
                'docKeyUrl': 'data/docs/de-cuong-hoa12-gk1-dap-an.docx',
                'desc': '105 câu: Phần I (75 câu TN, 0,25 đ/câu) – Phần II (15 câu Đ/S theo QĐ 764) – Phần III (15 câu trả lời ngắn, 0,25 đ/câu).',
            },
            {
                'id': 'de-cuong-ly12-gk1',
                'title': 'Đề cương ôn tập giữa kì 1 – Vật lí 12 (2026–2027)',
                'subject': 'Vật lí 12 · Vật lí nhiệt (Chuyển thể, Nội năng, Định luật I NĐLH, Nhiệt dung riêng, Nhiệt hóa hơi)',
                'count': 90,
                'durationMin': 90,
                'code': 'LY12',
                'hasPassword': False,
                'docHsUrl': 'data/docs/de-cuong-ly12-gk1-hs.pdf',
                'docKeyUrl': 'data/docs/de-cuong-ly12-gk1-dap-an.pdf',
                'desc': '90 câu có đầy đủ hình vẽ & công thức: Phần I (58 câu TN) – Phần II (13 câu Đ/S) – Phần III (19 câu trả lời ngắn).',
            },
            {
                'id': 'de-cuong-sinh12-gk1',
                'title': 'Đề cương ôn tập giữa kì 1 – Sinh học 12 (2026–2027)',
                'subject': 'Sinh học 12 · DNA, Phiên mã & Dịch mã, Điều hòa gene, Đột biến gene, Công nghệ gene, Quy luật Mendel',
                'count': 83,
                'durationMin': 90,
                'code': 'SINH12',
                'hasPassword': False,
                'docHsUrl': 'data/docs/de-cuong-sinh12-gk1-hs.pdf',
                'docKeyUrl': 'data/docs/de-cuong-sinh12-gk1-dap-an.docx',
                'desc': '83 câu: Phần I (58 câu TN nhiều lựa chọn) – Phần II (13 câu Đ/S) – Phần III (12 câu trả lời ngắn).',
            },
            {
                'id': 'de-cuong-tin12-gk1',
                'title': 'Đề cương ôn tập giữa kì 1 – Tin học 12 (2026–2027)',
                'subject': 'Tin học 12 · Bài 13 → Bài 17: Khái niệm CSS, Định dạng văn bản, Màu sắc, Khung & Độ ưu tiên bộ chọn',
                'count': 110,
                'durationMin': 90,
                'code': 'TIN12',
                'hasPassword': False,
                'docHsUrl': 'data/docs/de-cuong-tin12-gk1-hs.docx',
                'docKeyUrl': 'data/docs/de-cuong-tin12-gk1-dap-an.docx',
                'desc': '110 câu theo từng bài (Bài 13 đến Bài 17): Phần I (87 câu TN nhiều lựa chọn) – Phần II (23 câu Đ/S).',
            },
            {
                'id': 'de-cuong-su12-gk1',
                'title': 'Đề cương ôn tập giữa kì 1 – Lịch sử 12 (2026–2027)',
                'subject': 'Lịch sử 12 · Chủ đề 1 (Liên hợp quốc, Trật tự thế giới trong & sau Chiến tranh lạnh) & Chủ đề 2 (ASEAN)',
                'count': 76,
                'durationMin': 90,
                'code': 'SU12',
                'hasPassword': False,
                'docHsUrl': 'data/docs/de-cuong-su12-gk1-hs.pdf',
                'docKeyUrl': 'data/docs/de-cuong-su12-gk1-dap-an.docx',
                'desc': '76 câu theo 5 bài học: Phần I (61 câu TN nhiều lựa chọn) – Phần II (15 câu Đ/S đọc hiểu tư liệu lịch sử).',
            },
            {
                'id': 'de-cuong-gdqp12-gk1',
                'title': 'Đề cương ôn tập giữa kì 1 – GDQP & AN 12 (2026–2027)',
                'subject': 'GDQP & AN 12 · Bài 1 (Bảo vệ Tổ quốc), Bài 2 (Tổ chức QĐND & CAND), Bài 3 (Tuyển sinh & Đào tạo)',
                'count': 67,
                'durationMin': 60,
                'code': 'GDQP12',
                'hasPassword': False,
                'docHsUrl': 'data/docs/de-cuong-gdqp12-gk1-hs.docx',
                'docKeyUrl': 'data/docs/de-cuong-gdqp12-gk1-dap-an.docx',
                'desc': '67 câu theo 3 bài: Phần I (60 câu TN nhiều lựa chọn) – Phần II (7 câu Đ/S tình huống & tư liệu).',
            },
            {
                'id': 'de-cuong-van12-gk1',
                'title': 'Đề cương ôn tập giữa kì 1 – Ngữ văn 12 (2026–2027)',
                'subject': 'Ngữ văn 12 · Tiểu thuyết hiện đại, Truyện ngắn, Thơ trữ tình, Tiếng Việt, NLXH 600 chữ & Đề luyện Đọc hiểu',
                'count': 6,
                'countLabel': '6 chuyên đề & đề luyện',
                'durationMin': 90,
                'code': 'VAN12',
                'hasPassword': False,
                'customUrl': 'van12.html',
                'docKeyUrl': 'data/docs/de-cuong-van12-gk1.docx',
                'desc': 'Cẩm nang ôn tập tự luận tương tác: Lý thuyết trọng tâm, dàn ý các dạng đoạn văn 200 chữ, bài văn NLXH 600 chữ & đề luyện Đọc hiểu có hướng dẫn.',
            },
            {
                'id': 'de-cuong-hoa12-hk1',
                'title': 'Đề cương ôn tập HK1 Hóa học 12 (Đề mẫu 28 câu)',
                'subject': 'Hóa học 12 – Este, Cacbonhidrat, Amin/Amino axit/Protein, Polyme',
                'count': 28,
                'durationMin': 45,
                'code': 'HOA12',
                'hasPassword': False,
                'desc': '28 câu: Phần I (18 câu, 0,25 đ/câu) – Phần II (4 câu đúng/sai) – Phần III (6 câu trả lời ngắn, 0,25 đ/câu).',
            },
        ],
    }
    out_p = ROOT / 'data' / 'exams.json'
    out_p.write_text(json.dumps(exams_data, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'  Updated: {out_p} ({len(exams_data["exams"])} entries)')


if __name__ == '__main__':
    verify_all_json()
    copy_docs()
    build_van12_html()
    update_exams_json()
