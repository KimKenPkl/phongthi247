import zipfile
from pathlib import Path
import re

down = Path(r"C:\Users\LENOVO\Downloads")
target = None
for f in sorted(down.iterdir()):
    if f.is_file() and "ĐỀ CƯƠNG" in f.name and "HS" in f.name:
        target = f
        break
if target is None:
    for f in sorted(down.iterdir()):
        if f.is_file() and f.name.startswith("DE_CUONG"):
            target = f
            break
print("TARGET:", target, "size:", target.stat().st_size)

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

with open("D:/phongthi247/scripts/hs_de_dump.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(f"{i}: {p[:400]}" for i, p in enumerate(paras)))
print("DUMPED:", len(paras), "paras")
