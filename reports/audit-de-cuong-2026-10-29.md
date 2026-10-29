# Báo cáo rà soát đề cương — 29/10/2026

Chỉ đọc dữ liệu, **không sửa đáp án**. Mục đích: liệt kê câu cần giáo viên bộ môn kiểm tra lại.

## Đề cương ôn tập giữa kì 1 – GDQP & AN 12 (2026–2027)
- File: `de-cuong-gdqp12-gk1.json` — 67 câu (P1: 60, P2: 7, P3: 0)
- Phân bố đáp án P1: {'C': 15, 'A': 15, 'B': 15, 'D': 15}
- ✅ Không phát hiện lỗi cấu trúc.

## Đề cương ôn tập giữa kì 1 – Hóa học 12 (2026–2027)
- File: `de-cuong-gk1-2627.json` — 105 câu (P1: 75, P2: 15, P3: 15)
- Phân bố đáp án P1: {'A': 18, 'C': 24, 'B': 16, 'D': 17}
- ✅ Không phát hiện lỗi cấu trúc.

## Đề cương ôn tập HK1 Hóa học 12
- File: `de-cuong-hoa12-hk1.json` — 28 câu (P1: 18, P2: 4, P3: 6)
- Phân bố đáp án P1: {'A': 17, 'B': 1}
- ⚠ Phân bố bất thường: Đáp án A chiếm 94% (17/18); Không có đáp án C; Không có đáp án D
- ✅ Không phát hiện lỗi cấu trúc.

## Đề cương ôn tập giữa kì 1 – Vật lí 12 (2026–2027)
- File: `de-cuong-ly12-gk1.json` — 90 câu (P1: 58, P2: 13, P3: 19)
- Phân bố đáp án P1: {'B': 12, 'A': 13, 'D': 17, 'C': 16}
- ✅ Không phát hiện lỗi cấu trúc.

## Đề cương ôn tập giữa kì 1 – Sinh học 12 (2026–2027)
- File: `de-cuong-sinh12-gk1.json` — 83 câu (P1: 58, P2: 13, P3: 12)
- Phân bố đáp án P1: {'A': 15, 'B': 19, 'C': 14, 'D': 10}
- Tổng 2 cảnh báo:

| Phần | Câu | Mã | Nội dung |
|---|---|---|---|
| 1 | idx 32 | `DUP_CONTENT` | Trùng nội dung với câu index 2 (cùng phần 1) |
| 1 | idx 54 | `DUP_CONTENT` | Trùng nội dung với câu index 16 (cùng phần 1) |

## Đề cương ôn tập giữa kì 1 – Lịch sử 12 (2026–2027)
- File: `de-cuong-su12-gk1.json` — 76 câu (P1: 61, P2: 15, P3: 0)
- Phân bố đáp án P1: {'B': 16, 'A': 20, 'D': 17, 'C': 8}
- Tổng 1 cảnh báo:

| Phần | Câu | Mã | Nội dung |
|---|---|---|---|
| 2 | 7 | `HTML_UNBALANCED` | Thẻ HTML lệch: <strong> 0/1 |

## Đề cương ôn tập giữa kì 1 – Tiếng Anh 12 (2026–2027)
- File: `de-cuong-ta12-gk1.json` — 120 câu (P1: 120, P2: 0, P3: 0)
- Phân bố đáp án P1: {'B': 26, 'C': 38, 'D': 26, 'A': 30}
- ✅ Không phát hiện lỗi cấu trúc.

## Đề cương ôn tập giữa kì 1 – Tin học 12 (2026–2027)
- File: `de-cuong-tin12-gk1.json` — 110 câu (P1: 87, P2: 23, P3: 0)
- Phân bố đáp án P1: {'A': 13, 'C': 29, 'B': 32, 'D': 13}
- Tổng 3 cảnh báo:

| Phần | Câu | Mã | Nội dung |
|---|---|---|---|
| 1 | 8 | `P1_OPT_DUP` | Phương án A và D trùng nhau: “h1 h2 h3 {color: red;}” |
| 2 | 3 | `P2_ALL_FALSE` | Cả 4 ý đều SAI (đáng kiểm tra lại) |
| 2 | 15 | `P2_ALL_FALSE` | Cả 4 ý đều SAI (đáng kiểm tra lại) |

## Đề cương ôn tập giữa kì 1 – Toán 12 (2026–2027)
- File: `de-cuong-toan12-gk1.json` — 90 câu (P1: 60, P2: 10, P3: 20)
- Phân bố đáp án P1: {'A': 14, 'C': 18, 'D': 16, 'B': 12}
- ✅ Không phát hiện lỗi cấu trúc.

## Tổng hợp theo mã lỗi

| Mã | Số lượng |
|---|---|
| `DUP_CONTENT` | 2 |
| `P2_ALL_FALSE` | 2 |
| `HTML_UNBALANCED` | 1 |
| `P1_OPT_DUP` | 1 |