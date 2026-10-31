import zipfile, re, json
from pathlib import Path

# 1) raw XML of Sinh D/S Q1 + Q12 paragraphs
z = zipfile.ZipFile(r"D:\phongthi247\scripts\_sinh_src.docx")
xml = z.read("word/document.xml").decode("utf-8", errors="replace")
paras = re.findall(r'<w:p\b[^>]*>.*?</w:p>', xml, re.S)
print("=== RAW p189 ===")
print(paras[189][:1500])
print()
print("=== RAW p247 (Q12 a) ===")
print(paras[247][:1500])
print()
print("=== shd count in D/S range ===")
sec = "".join(paras[187:256])
for tag in ["w:shd", "w:highlight", "w:color", "w:u ", "w:em ", "w:vertAlign"]:
    print(tag, sec.count("<" + tag))
print()
print("=== tail blocks (last 20) ===")
with zipfile.ZipFile(r"D:\phongthi247\scripts\_sinh_src.docx") as zz:
    pass
