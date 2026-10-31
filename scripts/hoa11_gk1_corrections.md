# Hiệu chỉnh ĐỀ CƯƠNG HÓA 11 GK1 (de-cuong-hoa11-gk1)

> Ngày: 2026-10-31 · Người thực hiện: RAKAZO (opencode) · Nguồn: `ĐỀ CƯƠNG HÓA 11 GK1 - FULL GỐC TRỘN.docx` + `ĐÁP ÁN ĐỀ GK1 HÓA 11.docx`

File đề gốc của thầy có **5 chỗ đáp án sai** (gạch chân/đáp số không đúng với hóa học) và **một số lỗi chính tả**. Bản web đã hiệu chỉnh; file Word đáp án gốc (`data/docs/de-cuong-hoa11-gk1-dap-an.docx`) giữ nguyên để thầy đối chiếu.

## A. Sửa đáp án (5 chỗ — đã có căn cứ)

| Vị trí | Gốc (gạch chân/key) | Web đã sửa | Căn cứ |
|---|---|---|---|
| P2 – Câu 5, ý a | ĐÚNG | **SAI** | Chỉ thị acid–base (giấy quỳ, phenolphthalein) chỉ cho pH **xấp xỉ**. Xác định pH **chính xác** phải dùng pH kế/máy đo pH. |
| P2 – Câu 10, ý c | ĐÚNG | **SAI** | SO₂ + O₂ → SO₃: S(+4) → (+6), SO₂ **bị oxi hóa** → đóng vai trò **chất khử**, không phải "tính oxi hóa". |
| P3 – Câu 1 | 2 | **3** | Ảnh WMF (image13/14/15) chứa ΔH = **−115, −198, −92 kJ** (tỏa nhiệt) cho (1),(2),(3); image16/17: **+130, +178 kJ** (thu nhiệt) cho (4),(5). Giảm nhiệt độ → 3 cân bằng (1),(2),(3) chuyển dịch theo chiều thuận. |
| P3 – Câu 14 | 31 | **28** | 40 kg S = 1250 mol → 1250 mol SO₂. Ở **đkc** (0 °C, 1 atm; Vm = 22,4 L/mol) → 28 m³. Key gốc 31 khớp với Vm = 24,5 L/mol (25 °C) – sai so với chữ "đkc". |
| P3 – Câu 9 | 5 | **5 (giữ nguyên)** ⚠️ | Theo Brønsted–Lowry, acid = chất cho proton: NH₄⁺, HCl, HCO₃⁻, HS⁻ → **4**. Key gốc ghi 5 (có thể tính Cu²⁺ theo Lewis). **Cần thầy xác nhận** – web tạm giữ 5 theo file gốc. |

## B. Sửa chính tả (giữ nguyên nội dung, chỉ sửa lỗi đánh máy)

| Vị trí | Lỗi | Sửa |
|---|---|---|
| P1 – Câu 9 | "sự điên li" | sự **điện** li |
| P2 – Câu 2 | "2SO₂(g) + **3**O₂(g)" | 2SO₂(g) + **O₂**(g) (phản ứng: 2SO₂ + O₂ ⇄ 2SO₃) |
| P2 – Câu 5 | "thay đồi" | thay **đ**ổi |
| P2 – Câu 6 | "burrette" | **burette** |
| P2 – Câu 9 ý d | "Dung dịchHNO₃" | Dung dịch ** **HNO₃ (thiếu dấu cách) |
| P2 – Câu 10 ý c | "oxygene" | **oxygen** |
| P3 – Câu 14 | "làng nghê", "((kết quả" | làng **nghề**, "**(kết quả" |

## C. Lỗi render đã sửa ở importer (không đổi đáp án)

1. **Mũi tên cân bằng mất ở câu 23 (phương án B) và câu 26 (A, B)**: importer cũ dedup `rid` ảnh trong cùng paragraph → phương án thứ hai dùng chung ảnh `image8.png` bị bỏ. Đã bỏ dedup.
2. **groupChr (điều kiện "to" trên mũi tên)**: câu 23 (C, D), câu 26 (C) — nay render `→` bên dưới, chữ "to" cỡ nhỏ phía trên, đúng như Word.
3. **Thẻ `<g>` lọt vào câu 40** + `<strong> </strong>` rỗng đầu phương án: đã lọc.
4. **ΔH dạng OMML groupChr**: nay giữ nguyên dấu (ảnh WMF giữ nguyên dấu −/+, đã đọc trực tiếp byte WMF để xác minh).

## D. Đối chiếu chéo (validated)

- Trích gạch chân nguồn (P1: 40/40, P2: 40/40 ý, P3: 15/15) khớp 100% với JSON.
- File `ĐÁP ÁN ĐỀ GK1 HÓA 11.docx` là key của **đề thi GK1 thật** (16 câu TN + 2 Đ/S + 2 TLN), có chú thích "(Câu N Đề cương)". Đối chiếu:
  - "Câu 1 (Câu 1 Đề cương): a) Sai – b) Đúng – c) Sai – d) Sai" → khớp P2 Q1 của web.
  - "Câu 2 (Câu 7 Đề cương): a) Đúng – b) Đúng – c) Sai – d) Đúng" → khớp P2 Q7.
  - "P3 Câu 1 (Đề cương câu 3): A. 5", "Câu 2 (Đề cương câu 12): A. 12" → khớp P3 Q3, P3 Q12.
  → Phương pháp trích đáp án (gạch chân) đã được xác thực ngoài ý muốn.

## E. Cấu hình web

- `id`: de-cuong-hoa11-gk1 · `code`: HOA11 · 90 phút · trộn câu + trộn phương án
- Điểm: P1 0,25/câu · P2 theo QĐ 764 (0,1/0,25/0,5/1,0, strict) · P3 0,25/câu
- 30 ảnh (7 PNG gốc + 24 WMF→PNG), 4 biểu thức phân số OMML, 26 mũi tên/điều kiện groupChr
- Phần IV tự luận (3 câu) chỉ có trong file Word đáp án, không đưa vào bài thi tương tác.
