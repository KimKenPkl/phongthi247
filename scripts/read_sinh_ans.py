import zipfile
from pathlib import Path
import re

down = Path(r"C:\Users\LENOVO\Downloads")
target = None
for f in sorted(down.glob("*.docx")):
    if f.stat().st_size == 19752 and "GHKI" in f.name:
        target = f
        break
print("TARGET:", target)

with zipfile.ZipFile(target) as z:
    doc_xml = z.read("word/document.xml").decode("utf-8", errors="replace")

paras = []
for m in re.finditer(r'<w:p\b[^>]*>(.*?)</w:p>', doc_xml, re.S):
    block = m.group(1)
    txt = ""
    for rm in re.finditer(r'<w:t[^>]*>(.*?)</w:t>', block, re.S):
        txt += re.sub(r'<[^>]+>', '', rm.group(1))
    txt = txt.replace("\n", " ")
    if txt.strip():
        paras.append(txt.strip())

with open("D:/phongthi247/scripts/sinh_ans_dump.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(f"{i}: {p[:350]}" for i, p in enumerate(paras)))
print("DUMPED:", len(paras), "paras")
