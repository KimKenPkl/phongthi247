import zipfile, re, sys
from pathlib import Path

path = Path(r"D:\phongthi247\scripts\_sinh_src.docx")
with zipfile.ZipFile(path) as z:
    xml = z.read("word/document.xml").decode("utf-8", errors="replace")

# Walk paragraphs, show runs with color/highlight/bold when in D/S section
paras = re.findall(r'<w:p\b[^>]*>.*?</w:p>', xml, re.S)
start = None
for i, p in enumerate(paras):
    txt = "".join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', p, re.S))
    if "PHẦN II" in txt:
        start = i
        break
print("PHAN II paragraph index:", start, "total paras:", len(paras))

for i in range(start, min(start + 130, len(paras))):
    p = paras[i]
    runs = []
    for rm in re.finditer(r'<w:r\b[^>]*>(.*?)</w:r>', p, re.S):
        r = rm.group(1)
        t = "".join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', r, re.S))
        if not t.strip():
            continue
        col = re.search(r'<w:color w:val="([0-9A-Fa-f]+)"', r)
        hl = re.search(r'<w:highlight w:val="([a-z]+)"', r)
        b = "<w:b/>" in r or "<w:b " in r
        marks = []
        if col: marks.append("color=" + col.group(1))
        if hl: marks.append("hl=" + hl.group(1))
        if b: marks.append("bold")
        runs.append((t, marks))
    if runs:
        line = " || ".join(f"{t}{('[' + ','.join(m) + ']') if m else ''}" for t, m in runs)
        print(f"--- p{i}: {line[:600]}")
