from docx import Document
from pathlib import Path
import glob, re

down = Path(r"C:\Users\LENOVO\Downloads")
# List all docx files with size under 500KB that might be the answer key
for f in sorted(down.glob("*.docx")):
    if f.stat().st_size < 500000:
        print("SIZE:", f.stat().st_size, "NAME:", repr(f.name))
