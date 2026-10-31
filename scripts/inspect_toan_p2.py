import re, zipfile
from docx import Document
from docx.oxml.ns import qn

d = Document(r"D:\phongthi247\scripts\_toan_src.docx")
ps = d.paragraphs

# section boundaries
sec = {}
for i, p in enumerate(ps):
    t = p.text.strip()
    if t.startswith("PHẦN"):
        sec[t[:8]] = i
print("SECTIONS:", sec)

def has_num(p):
    pPr = p._p.find(qn('w:pPr'))
    return pPr is not None and pPr.find(qn('w:numPr')) is not None

p1 = [i for i in range(sec['PHẦN I.'], sec['PHẦN II']) if has_num(ps[i])]
p2 = [i for i in range(sec['PHẦN II'], sec['PHẦN II'] + 20) if False]
p2 = [i for i in range(sec['PHẦN II'], sec['PHẦN II'] + 20)]
p2 = [i for i in p2 if i < len(ps) and has_num(ps[i])]
p3_start = [i for i, p in enumerate(ps) if p.text.strip().startswith('PHẦN III')][0]
p3 = [i for i in range(p3_start, len(ps)) if has_num(ps[i])]
print("P1 num paras:", len(p1))
print("P2 num paras:", len(p2), p2)
print("P3 num paras:", len(p3))

# tables?
print("TABLES:", len(d.tables))

# raw xml of paragraph 171..185 -> count drawings / tbl / sdt
xml = d.element.xml
print("sdt count:", xml.count("<w:sdt>"), "tbl count:", xml.count("<w:tbl>"))
for i in range(170, 186):
    x = ps[i]._p.xml
    print(i, "len", len(x), "draw", x.count("<w:drawing"), "pict", x.count("<w:pict"), "tbl", x.count("<w:tbl"), "|", ps[i].text[:60])
