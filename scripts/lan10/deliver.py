"""Deliver checked files without deleting or overwriting the old LẦN 9 papers."""
from pathlib import Path
import json
import shutil
import hashlib

from content import PAPER_COUNT

ROOT=Path(__file__).resolve().parents[2]
BASE=Path("D:/02 HỌC LIỆU HÓA HỌC/09 Kho Tổng Hợp Đề & Giáo Trình Hóa/02_Tai_Lieu_On_Tap")
OLD=BASE/"ĐỀ ÔN TẬP KIỂM TRA ĐỊNH KÌ LẦN 9"
NEW=BASE/"ĐỀ ÔN TẬP KIỂM TRA ĐỊNH KÌ LẦN 10"
DOCS=ROOT/"data/docs"

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

for i in range(1, PAPER_COUNT + 1):
    for suffix in ("hs", "dap-an"):
        for ext in ("docx", "pdf"):
            p=DOCS/f"on-tap-lan10-de-{i}-{suffix}.{ext}"
            assert p.is_file() and p.stat().st_size > 0, p

if OLD.exists():
    if NEW.exists():
        raise RuntimeError("Both LẦN 9 and LẦN 10 exist. Refusing to merge or overwrite.")
    OLD.rename(NEW)
assert NEW.is_dir()
archive=NEW/"LƯU TRỮ LẦN 9"
archive.mkdir(exist_ok=True)
for p in list(NEW.glob("*.docx")):
    if not p.name.startswith("~$") and "LẦN 9" in p.name:
        target=archive/p.name
        if target.exists():
            assert sha(target)==sha(p)
        else:
            p.rename(target)
manifest=[]
for i in range(1, PAPER_COUNT + 1):
    for answer in (False,True):
        suffix="dap-an" if answer else "hs"
        source=DOCS/f"on-tap-lan10-de-{i}-{suffix}.docx"
        name=("ĐÁP ÁN - " if answer else "")+f"ĐỀ ÔN TẬP KIỂM TRA ĐỊNH KÌ LẦN 10 - ĐỀ {i}"
        target=NEW/(name+".docx")
        shutil.copy2(source,target)
        assert sha(source)==sha(target)
        # PDF is an additional print-ready copy of the actual Word layout.
        pdf=source.with_suffix(".pdf")
        dest=NEW/"PDF IN"/(name+".pdf")
        dest.parent.mkdir(exist_ok=True)
        shutil.copy2(pdf,dest)
        assert sha(pdf)==sha(dest)
        manifest.append({"file":target.name,"sha256":sha(target),"pdfSha256":sha(dest)})
shutil.copy2(ROOT/"reports/lan10/tin-nhan-hoc-sinh.md", NEW/"TIN NHẮN GỬI HỌC SINH.md")
(NEW/"HƯỚNG DẪN.txt").write_text(
    "BỘ ĐỀ ÔN TẬP KIỂM TRA ĐỊNH KÌ LẦN 10\n"
    f"{PAPER_COUNT} đề (mỗi đề 28 câu, 50 phút) và {PAPER_COUNT} bản hướng dẫn giải.\n"
    "Mở thư mục PDF IN để in đề và đáp án.\n"
    "Các tệp Word cũ nằm trong thư mục LƯU TRỮ LẦN 9.\n"
    "Làm bài trực tuyến hoặc tải Word tại https://kimkenpkl.github.io/phongthi247/\n"
    "Công thức Word dùng chỉ số dưới/trên, có thể chỉnh sửa.\n"
    f"Cả {len(manifest)} tệp Word đạt 100/100 ở kiểm định ngôn ngữ.\n",
    encoding="utf-8")
(NEW/"KIỂM TRA TỆP.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(str(NEW))
print(f"Delivered {len(manifest)} Word files and {len(manifest)} PDFs. Archive contains {len(list(archive.glob('*.docx')))} previous Word files.")
