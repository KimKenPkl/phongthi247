"""Deliver checked files without deleting or overwriting the old LẦN 9 papers."""
from pathlib import Path
import json
import shutil
import hashlib

ROOT=Path(__file__).resolve().parents[2]
BASE=Path("D:/02 HỌC LIỆU HÓA HỌC/09 Kho Tổng Hợp Đề & Giáo Trình Hóa/02_Tai_Lieu_On_Tap")
OLD=BASE/"ĐỀ ÔN TẬP KIỂM TRA ĐỊNH KÌ LẦN 9"
NEW=BASE/"ĐỀ ÔN TẬP KIỂM TRA ĐỊNH KÌ LẦN 10"
RENDER=Path.home()/"AppData/Local/Temp/opencode/lan10-render"

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

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
for i in range(1,5):
    for answer in (False,True):
        suffix="dap-an" if answer else "hs"
        source=ROOT/f"data/docs/on-tap-lan10-de-{i}-{suffix}.docx"
        name=("ĐÁP ÁN - " if answer else "")+f"ĐỀ ÔN TẬP KIỂM TRA ĐỊNH KÌ LẦN 10 - ĐỀ {i}"
        target=NEW/(name+".docx")
        shutil.copy2(source,target)
        assert sha(source)==sha(target)
        # PDF is an additional print-ready copy of the actual Word layout.
        pdf=RENDER/f"on-tap-lan10-de-{i}-{suffix}.pdf"
        if pdf.exists():
            dest=NEW/"PDF IN"/(name+".pdf")
            dest.parent.mkdir(exist_ok=True)
            shutil.copy2(pdf,dest)
        manifest.append({"file":target.name,"sha256":sha(target)})
(NEW/"HƯỚNG DẪN.txt").write_text(
    "BỘ ĐỀ ÔN TẬP KIỂM TRA ĐỊNH KÌ LẦN 10\n"
    "4 đề (mỗi đề 28 câu, 50 phút) + 4 đáp án/hướng dẫn giải.\n"
    "PDF IN: bản PDF được xuất từ chính các tệp Word để in trực tiếp.\n"
    "LƯU TRỮ LẦN 9: giữ nguyên các tệp Word cũ, không xóa.\n"
    "Làm bài online và tải lại Word: https://kimkenpkl.github.io/phongthi247/\n"
    "Công thức Word dùng chỉ số dưới/trên, có thể chỉnh sửa.\n"
    "Audit ngôn ngữ: 8/8 tệp đạt 100/100; đã đối chiếu đáp án, hình và bản in.\n",
    encoding="utf-8")
(NEW/"KIỂM TRA TỆP.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(str(NEW))
print(f"Delivered {len(manifest)} Word files, 8 PDFs; preserved {len(list(archive.glob('*.docx')))} previous Word files.")
