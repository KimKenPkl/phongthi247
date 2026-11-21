"""Idempotently publish only the four new papers; keep old papers hidden."""
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[2]
path=ROOT/"data/exams.json"
catalog=json.loads(path.read_text(encoding="utf-8"))
old=[x for x in catalog["exams"] if not x["id"].startswith("on-tap-lan10-de-")]
assert len(old)==21 and all(x.get("hidden") for x in old)
new=[]
for i in range(1,5):
    id_=f"on-tap-lan10-de-{i}"
    exam=json.loads((ROOT/f"data/tests/{id_}.json").read_text(encoding="utf-8"))
    new.append({
        "id":id_, "title":exam["title"],"category":"hoa",
        "subject":exam["subject"],"count":28,"durationMin":50,
        "code":exam["code"],"hasPassword":False,"hidden":False,
        "contentVersion":exam["contentVersion"],
        "docHsUrl":f"data/docs/{id_}-hs.docx",
        "docKeyUrl":f"data/docs/{id_}-dap-an.docx",
        "desc":"18 câu lựa chọn, 4 câu đúng/sai và 6 câu trả lời ngắn. Có hình trích từ đề gốc và bài toán vận dụng thực tế. "+exam["focus"]+"."
    })
catalog["exams"]=new+old
catalog["updated"]="2026-11-21"
path.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("Catalog: 4 visible new papers; 21 old papers remain hidden.")
