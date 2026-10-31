import sys, zipfile, re
from pathlib import Path

def dump(path, out):
    p = Path(path)
    with zipfile.ZipFile(p) as z:
        xml = z.read("word/document.xml").decode("utf-8", errors="replace")
    # split body into blocks: paragraphs and tables
    lines = []
    idx = 0
    for m in re.finditer(r'<w:p\b[^>]*>.*?</w:p>|<w:tbl>.*?</w:tbl>', xml, re.S):
        block = m.group(0)
        if block.startswith('<w:tbl'):
            rows = []
            for tr in re.finditer(r'<w:tr\b[^>]*>(.*?)</w:tr>', block, re.S):
                cells = []
                for tc in re.finditer(r'<w:tc\b[^>]*>(.*?)</w:tc>', tr.group(1), re.S):
                    t = "".join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', tc.group(1), re.S))
                    cells.append(re.sub(r'<[^>]+>', '', t).strip())
                rows.append(" | ".join(cells))
            lines.append(f"[TABLE] " + " ;; ".join(rows))
        else:
            txt = "".join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', block, re.S))
            txt = re.sub(r'<[^>]+>', '', txt).strip()
            has_img = '<w:drawing' in block or '<w:pict' in block
            if txt or has_img:
                lines.append(f"{idx}: {txt}" + ("  <<IMG>>" if has_img else ""))
        idx += 1
    Path(out).write_text("\n".join(lines), encoding="utf-8")
    print(f"WROTE {out} ({len(lines)} blocks)")

if __name__ == "__main__":
    dump(sys.argv[1], sys.argv[2])
