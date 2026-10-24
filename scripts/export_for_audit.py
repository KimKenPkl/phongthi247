# -*- coding: utf-8 -*-
"""Xuất đề de-cuong-gk1-2627 (JSON phongthi247) ra file văn bản chuẩn dạng
đề + đáp án để chạy audit_de_hoa.py (skill soan-de-hoa-chuan-bgd).
Nội dung câu hỏi bóc nguyên văn từ JSON (đã KHÔNG sửa chữ của thầy);
HTML chỉ được quy đổi về text (br -> xuống dòng, bảng -> dòng, ảnh -> [hình])."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'data' / 'tests' / 'de-cuong-gk1-2627.json'
OUT = Path(__file__).resolve().parent / '_decuong_gk1_qa_export.md'

ENTS = [
    ('&nbsp;', ' '),
    ('&#x27;', "'"),
    ('&#39;', "'"),
    ('&quot;', '"'),
    ('&gt;', '>'),
    ('&lt;', '<'),
    ('&amp;', '&'),
]


def html_to_text(s: str) -> str:
    s = re.sub(r'<br\s*/?>', '\n', s)
    s = re.sub(r'</tr\s*>', '\n', s)
    s = re.sub(r'<tr[^>]*>', '', s)
    s = re.sub(r'<td[^>]*>', ' ', s)
    s = re.sub(r'</td\s*>', ' ', s)
    s = re.sub(r'<t[hd][^>]*>|</t[hd]\s*>', ' ', s)
    s = re.sub(r'</?table[^>]*>|</?thead[^>]*>|</?tbody[^>]*>', '\n', s)
    s = re.sub(r'<img[^>]+>', '[hình]', s)
    s = re.sub(r'<[^>]+>', '', s)
    for _ in range(2):  # chạy 2 vòng để xử lý cả '&amp;nbsp;'
        for a, b in ENTS:
            s = s.replace(a, b)
    lines = []
    for ln in s.split('\n'):
        ln = re.sub(r'[ \t]+', ' ', ln).strip()
        if ln:
            lines.append(ln)
    return '\n'.join(lines)


exam = json.loads(SRC.read_text(encoding='utf-8'))
qs = exam['questions']
out = []
out.append('MÔN: HÓA HỌC 12 - ĐỀ CƯƠNG ÔN TẬP GIỮA KÌ 1 (2026 - 2027)')
out.append('Nền tảng phongthi247 - mã đề de-cuong-gk1-2627 - thời gian 120 phút - 105 câu')
out.append('')
out.append('Phần I. Trắc nghiệm nhiều phương án lựa chọn (từ câu 1 đến câu 75)')
out.append('')
n = 0
p1 = [q for q in qs if q['part'] == 1]
for q in p1:
    n += 1
    out.append(f'Câu {n}. {html_to_text(q["content"])}')
    for j, opt in enumerate(q['options']):
        out.append(f'{"ABCD"[j]}. {html_to_text(opt)}')
    ai = q.get('answerIndex')
    out.append(f'Đáp án: {"ABCD"[ai]}.' if ai is not None else 'Đáp án: (thêm ở trang admin)')
    out.append('')

out.append('Phần II. Đúng - Sai (từ câu 76 đến câu 90)')
out.append('')
for q in [q for q in qs if q['part'] == 2]:
    n += 1
    out.append(f'Câu {n}. {html_to_text(q["content"])}')
    for j, st in enumerate(q['statements']):
        mark = 'Đ' if st.get('answer') else 'S'
        out.append(f'{"abcd"[j]}) {html_to_text(st.get("text", ""))} ({mark})')
    out.append('')

out.append('Phần III. Trả lời ngắn (từ câu 91 đến câu 105)')
out.append('')
for q in [q for q in qs if q['part'] == 3]:
    n += 1
    out.append(f'Câu {n}. {html_to_text(q["content"])}')
    a = q.get('answer')
    out.append(f'Đáp số: {a}.' if a is not None else 'Đáp số: (thêm ở trang admin)')
    out.append('')

OUT.write_text('\n'.join(out) + '\n', encoding='utf-8')
print('export:', OUT)
print('cau da xuat:', n, '(ky vong 105)')
