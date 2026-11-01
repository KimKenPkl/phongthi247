import json
from pathlib import Path

p = Path(r"D:\phongthi247\data\tests\de-cuong-sinh12-gk1.json")
ex = json.loads(p.read_text(encoding="utf-8"))
qs = ex["questions"]

ds_idx = [i for i, q in enumerate(qs) if q["part"] == 2]
p3_idx = [i for i, q in enumerate(qs) if q["part"] == 3]

# --- Câu 1 Đ/S: ý d) "Mỗi mạch polynucleotide luôn có A = T và G = C" -> SAI
q1 = qs[ds_idx[0]]
assert q1["statements"][3]["text"].startswith("Mỗi mạch polynucleotide")
q1["statements"][3]["answer"] = False

# --- Câu 12 Đ/S: ý c) "Một số DNA tái tổ hợp có thể xâm nhập ... không cần làm dãn màng" -> ĐÚNG
q12 = qs[ds_idx[11]]
assert q12["statements"][2]["text"].startswith("Một số DNA tái tổ hợp")
q12["statements"][2]["answer"] = True
# Sửa luôn tiêu đề câu 12 đang bị lỗi "<strong>:</strong>" ở đầu
if q12["content"].startswith("<strong>:</strong>"):
    q12["content"] = "<strong>Câu 12.</strong>" + q12["content"][len("<strong>:</strong>"):]

# --- Câu 6 P3: cập nhật đúng câu dẫn theo file đáp án
q6 = qs[p3_idx[5]]
q6["content"] = (
    "<strong>Câu 6.</strong> Gene D có 1560 liên kết hydrogen trong số các nucleotide loại G = 1,5A. "
    "Gene D bị đột biến điểm thành gene d làm cho gene d nhiều hơn gene D một liên kết hydrogen. "
    "Gene d nhân đôi 3 lần liên tiếp, số nucleotide loại Adenine mà môi trường cung cấp cho quá trình trên là bao nhiêu?"
)
q6["answer"] = 1673

p.write_text(json.dumps(ex, ensure_ascii=False, indent=1), encoding="utf-8")
print("Q1 D/S:", [s["answer"] for s in q1["statements"]])
print("Q12 D/S:", [s["answer"] for s in q12["statements"]])
print("Q12 title:", q12["content"][:60])
print("P3 Q6:", q6["content"][:90], "-> answer", q6["answer"])
print("Saved", p)
