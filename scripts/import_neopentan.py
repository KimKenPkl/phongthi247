# -*- coding: utf-8 -*-
"""import_neopentan.py – Chuyển kho «Hỏi–Đáp» Neopentan thành ngân hàng câu hỏi cho Phong Thi 24/7.

Nguồn: D:/NGAN_HANG_SOL_DE_CAC_NUOC/06_VIETNAM/NEOPENTAN/hoi_dap  (pages/*.md + images/)
Xuất : data/bank/neopentan.json + data/bank/index.json

Chuẩn đầu ra: câu Phần I (4 phương án A/B/C/D). Đáp án xác định ưu tiên:
1) Khối lời giải «X. Đúng, ...» có duy nhất 1 ý Đúng;
2) Regex «Đáp án ... X» / «Chọn X» trên trang (chỉ nhận khi ALL câu khớp ra chung 1 chữ).
Trang tự luận («xác định chất A, B, C...») sẽ bị loại và thống kê riêng.

Chạy: python scripts/import_neopentan.py
"""
import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

SRC = Path('D:/NGAN_HANG_SOL_DE_CAC_NUOC/06_VIETNAM/NEOPENTAN/hoi_dap')
ROOT = Path(__file__).resolve().parents[1]          # thư mục repo (D:/phongthi247)
OUT = ROOT / 'data' / 'bank'

JUNK = {
    'neo pentan', 'đã giải', 'hoạt động', 'mới nhất', 'cũ nhất', 'hóa học hữu cơ',
    'bình luận', 'trả lời', 'đăng ký', 'đăng nhập', 'search', 'skip to content',
    'học hóa cùng neopentan', 'chuyên trang đề thi, ôn thi, giải bài tập hóa học',
    'trang chủ', 'đặt câu hỏi', 'menu', 'đã đăng',
}
OPT_RE = re.compile(r'^([A-Da-d])[.)]\s*(.*)$')
SPLIT_IN = re.compile(r'\s(?=[B-D][.)])')               # tách «A. x B. y C. z D. w» viết liền 1 dòng
DA_RE = re.compile(r'Đáp\s*án[^A-Za-zÀ-ỹ0-9]{0,20}([A-D])\b', re.IGNORECASE)
CHON_RE = re.compile(r'(?:Chọn|Lựa chọn\s*đáp\s*án|câu\s*trả\s*lời\s*đúng)\s*[:\-]?\s*([A-D])\b', re.IGNORECASE)


def collect_entries(text):
    """Danh sách mục chữ: (line_idx, 'A'..'D', text).  – gộp cả phương án viết liền."""
    entries = []
    for i, ln in enumerate(text.splitlines()):
        s = ln.strip()
        if not s:
            continue
        m = OPT_RE.match(s)
        if not m:
            continue
        L = m.group(1).upper()
        txt = m.group(2).strip()
        segs = SPLIT_IN.split(txt)
        if len(segs) >= 4 and all(segs):
            base = 'ABCD'.find(L)
            if 0 <= base <= 0:                       # chỉ tách khi dòng bắt đầu bằng A
                for k, part in enumerate(segs[:4]):
                    entries.append((i, 'ABCD'[k], part.strip()))
                continue
        entries.append((i, L, txt))
    return entries


def parse_md(text):
    lines = [l.strip() for l in text.splitlines()]
    entries = collect_entries(text)

    # 1) tìm cửa sổ A-B-C-D đầu tiên == phương án
    block = None
    ki = -1
    for k in range(len(entries) - 3):
        w = entries[k:k + 4]
        if [w[j][1] for j in range(4)] == ['A', 'B', 'C', 'D'] and all(w[j][2] for j in range(4)):
            block = w
            ki = k
            break
    if block is None:
        return None, 'no-option'
    opt_line = block[0][0]
    options = [b[2] for b in block]

    # 2) lời giải: các mục chữ sau options với text bắt đầu Đúng/Sai (A→D theo thứ tự)
    ans = None
    expl = []
    seen = set()
    for ent in entries[ki + 4:]:
        _, L, txt = ent
        if L in seen or not txt:
            continue
        if txt.startswith(('Đúng', 'Sai')):
            seen.add(L)
            expl.append('%s. %s' % (L, txt))
            if txt.startswith('Đúng'):
                if ans is not None:
                    ans = None                      # >1 ý Đúng → không xác định
                ans = 'ABCD'.index(L)
    # 3) dự phòng: regex đáp án trên toàn trang
    if ans is None:
        letters = set(m.group(1).upper() for m in DA_RE.finditer(text))
        letters |= set(m.group(1).upper() for m in CHON_RE.finditer(text))
        if len(letters) == 1:
            ans = 'ABCD'.index(letters.pop())
    # 4) câu hỏi: dòng có nghĩa gần nhất phía trên phương án A
    q = ''
    for j in range(opt_line - 1, -1, -1):
        s = lines[j]
        if not s or s.startswith('#') or s == '---' or s.startswith('Source:'):
            continue
        if s.lower() in JUNK or re.fullmatch(r'\d+', s) or re.fullmatch(r'\d{2}/\d{2}/\d{4}', s):
            continue
        if s.endswith('– Học hóa cùng Neopentan'):
            continue
        q = s
        break
    if not q:
        # dự phòng: lấy tiêu đề H1
        for s in lines:
            if s.startswith('# '):
                q = s[2:].replace('[Đã giải]', '').strip()
                break
    if not q:
        return None, 'no-question'
    return q, options, ans, '\n'.join(expl)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    bank = []
    stats = {'no-option': 0, 'no-question': 0}
    for p in sorted((SRC / 'pages').glob('*.md')):
        try:
            text = p.read_text(encoding='utf-8', errors='replace')
        except OSError:
            stats['no-option'] += 1
            continue
        parsed = parse_md(text)
        if parsed[0] is None:
            stats[parsed[1]] += 1
            continue
        q, options, ans, expl = parsed
        item = {'part': 1, 'content': q, 'options': options, 'answerIndex': ans, 'explain': expl}
        bank.append(item)
    n_kept = len(bank)
    n_noans = sum(1 for it in bank if it['answerIndex'] is None)
    (OUT / 'neopentan.json').write_text(json.dumps({
        'schema': 1,
        'source': 'neopentan-hoi-dap',
        'count': n_kept,
        'questions': bank,
    }, ensure_ascii=False, indent=1), encoding='utf-8')
    (OUT / 'index.json').write_text(json.dumps({
        'files': [{'file': 'neopentan.json', 'title': 'Ngân hàng Neopentan – Hỏi&Đáp', 'count': n_kept}],
    }, ensure_ascii=False, indent=1), encoding='utf-8')
    print('Tổng trang md: %d | nhận %d câu trắc nghiệm | thiếu đáp án %d | loại tự luận %d | loại không có câu hỏi %d'
          % (n_kept + sum(stats.values()), n_kept, n_noans, stats['no-option'], stats['no-question']))


if __name__ == '__main__':
    main()
