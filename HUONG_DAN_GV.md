# Hướng dẫn vận hành Phòng Thi 24/7 (dành cho giáo viên)

Tài liệu này đủ để thầy cô tự vận hành trang mà không cần lập trình viên hay AI.
Mọi thao tác đều làm được trên **giao diện web GitHub** (github.com/KimKenPkl/phongthi247), không bắt buộc cài gì.

> Sau mỗi lần sửa và commit, GitHub Pages cần khoảng **1–3 phút** để cập nhật trang.
> Học sinh đang mở trang từ trước phải **đóng tab và mở lại**.

---

## 1. Các file thầy cô sẽ đụng tới

| File | Chứa gì |
|---|---|
| `data/exams.json` | Danh sách đề hiện trên trang chủ |
| `data/tests/<id>.json` | Nội dung và đáp án của từng đề |
| `data/config.json` | Cấu hình chung (link Google Sheet) |
| `data/docs/` | File Word/PDF cho học sinh tải về |
| `data/img/<id>/` | Ảnh trong đề |

Những file khác (`assets/`, `*.html`) là phần mềm, **không cần sửa** khi vận hành bình thường.

---

## 2. Thêm một đề mới

1. Mở `https://kimkenpkl.github.io/phongthi247/admin/`.
2. Điền tên đề, mã phòng, số phút, rồi thêm câu hỏi (Phần I, II, III). Đề có sẵn trong Word thì nhập thẳng file `.docx` (mục 13).
3. Bấm **Tải file** → máy tải về file `<id>.json`.
4. Bấm **Copy mục exams.json** → đoạn mô tả đề được chép vào bộ nhớ.
5. Trên GitHub, vào thư mục `data/tests/` → **Add file → Upload files** → chọn file `<id>.json` → **Commit changes**.
6. Mở `data/exams.json` → bấm biểu tượng bút chì (Edit) → dán đoạn vừa copy vào trong dấu `[ ... ]` của `"exams"`, **thêm dấu phẩy** ngăn cách với mục bên cạnh → **Commit changes**.
7. Kiểm tra trường `"category"` trong đoạn vừa dán (xem mục 6).

Nếu đề có ảnh: tạo thư mục `data/img/<id>/`, tải ảnh lên đó, trong nội dung câu hỏi ghi `<img src="data/img/<id>/ten-anh.png">`.

---

## 3. Sửa đáp án hoặc lỗi chính tả

1. Mở `data/tests/<id>.json` trên GitHub → bút chì (Edit).
2. Bấm `Ctrl+F` tìm đoạn chữ của câu cần sửa.
3. Sửa theo quy ước:

| Phần | Trường | Giá trị |
|---|---|---|
| I (4 phương án) | `"answerIndex"` | `0` = A, `1` = B, `2` = C, `3` = D |
| II (Đúng/Sai) | `"answer"` trong từng ý | `true` = Đúng, `false` = Sai |
| III (trả lời ngắn) | `"answer"` | số, ví dụ `4` hoặc `2.5` (dùng dấu **chấm**) |

4. **Commit changes**. Nên ghi lại thay đổi vào một file trong `reports/` (như `reports/hoa11_gk1_corrections.md`) để sau này đối chiếu.

---

## 4. Ẩn / hiện đề, đổi mã phòng

Trong `data/exams.json`, ở mục của đề đó:

- Ẩn đề: thêm `"hidden": true,` — học sinh không thấy nữa. Thầy cô vẫn xem được tại `.../phongthi247/?all=1`.
- Hiện lại: xoá dòng `"hidden": true,`.
- Đổi mã phòng: sửa `"code"` ở **cả hai** nơi: `data/exams.json` và `data/tests/<id>.json`.
- `"hasPassword": false` → trang tự điền mã phòng, học sinh chỉ nhập họ tên, lớp.
  `"hasPassword": true` → học sinh phải tự gõ mã phòng do thầy cô đọc.

---

## 5. Kiểm tra trước khi học sinh dùng

**Tự động:** mỗi lần commit, GitHub chạy `scripts/kiemtra.py`. Vào tab **Actions** của repo:
dấu ✅ xanh là ổn, dấu ❌ đỏ là có lỗi. Bấm vào dấu ❌ → mục *Chay scripts/kiemtra.py* để đọc
lỗi bằng tiếng Việt (ví dụ: "câu 12: answerIndex phải là 0, 1, 2 hoặc 3").

**Trên máy (nếu có Python):**

```powershell
cd D:\phongthi247
python scripts\kiemtra.py
```

Lưu ý: dấu ❌ **không chặn** trang cập nhật. Thấy đỏ thì sửa ngay.

**Lỗi JSON hay gặp:** thiếu dấu phẩy giữa hai mục, thừa dấu phẩy sau mục cuối cùng,
dùng dấu nháy cong `“ ”` thay vì nháy thẳng `" "`. `kiemtra.py` báo đúng số dòng bị hỏng.

---

## 6. Trường `category` (môn học)

Mỗi mục trong `exams.json` phải có `"category"` để hiện đúng nút lọc môn trên trang chủ:

| Giá trị | Môn |
|---|---|
| `toan` | Toán |
| `tieng-anh` | Tiếng Anh |
| `hoa` | Hóa học |
| `ly` | Vật lí |
| `sinh` | Sinh học |
| `tin` | Tin học |
| `su` | Lịch sử |
| `gdqp` | GDQP & AN |
| `van` | Ngữ văn |

---

## 7. Lưu điểm về Google Sheet (làm một lần, khoảng 5 phút)

Hiện điểm đang lưu tạm trên `api.restful-api.dev`, dịch vụ thử nghiệm miễn phí:
giới hạn khoảng 50 lượt/ngày và ai biết F12 cũng sửa được. Nên chuyển sang Google Sheet của thầy cô.

1. Đăng nhập Google → tạo Google Sheet mới, đặt tên `PhongThi_BaiLam`.
2. Trong Sheet: **Tiện ích mở rộng → Apps Script**.
3. Xoá hết code mẫu, dán toàn bộ nội dung file `apps-script/Code.gs` → bấm **Lưu**.
4. Bấm ⚙ **Cài đặt dự án** → **Thuộc tính tập lệnh** → thêm `REPORT_PASS` = mật khẩu xem điểm của thầy cô.
5. **Triển khai → Tùy chọn triển khai mới → Ứng dụng web**:
   *Thực thi với tư cách*: **Tôi** · *Ai có quyền truy cập*: **Bất kỳ ai** → **Triển khai** → cấp quyền.
6. Copy URL dạng `https://script.google.com/macros/s/..../exec`.
7. Trên GitHub, sửa `data/config.json`: dán URL vào `"appsScriptUrl": "..."` → **Commit changes**.

Từ lúc đó: bài nộp ghi vào Sheet, bảng xếp hạng đọc từ Sheet. Kiểm tra bằng cách mở
`<URL>?action=ping`, thấy `GS ready` là được.

**Khi sửa `Code.gs` sau này:** Apps Script → **Triển khai → Quản lý các lần triển khai** → bút chì →
*Phiên bản*: **Phiên bản mới** → **Triển khai**. Làm vậy thì URL giữ nguyên, không phải sửa `config.json`.

---

## 8. Xem điểm, xoá bài nộp

- Trang `report/`: chọn đề, nhập mật khẩu `REPORT_PASS` để xem đầy đủ và tải CSV.
- **Xoá bài rác / bài thử:** mở Google Sheet, xoá hàng đó. Bảng xếp hạng cập nhật sau tối đa 30 giây.
- **Làm lại bảng xếp hạng cho đợt mới:** đổi tên tab `BaiLam` thành `BaiLam_Dot1`; lần nộp tiếp theo hệ thống tự tạo tab `BaiLam` mới.
- Nút xoá trên trang `report/` chỉ tác động lên bảng xếp hạng tạm (`restful-api.dev`), không xoá dữ liệu trong Sheet.

---

## 9. Sao lưu

- Toàn bộ đề, đáp án, phần mềm: chính là repo GitHub. Tải bản sao: **Code → Download ZIP**, mỗi học kỳ một lần.
- Điểm: Google Sheet → **Tệp → Tải xuống → Excel (.xlsx)** sau mỗi đợt thi.

---

## 10. Khi sửa phần mềm (`assets/*.css`, `assets/*.js`)

Sau khi sửa, chạy:

```powershell
python scripts\bump_version.py
```

Script tăng số `?v=` trong các trang HTML để trình duyệt học sinh tải bản mới.
Không chạy thì học sinh có thể vẫn dùng bản cũ trong cache.

---

## 11. Xử lý sự cố

| Hiện tượng | Nguyên nhân hay gặp | Cách xử lý |
|---|---|---|
| Trang chủ báo "Không tải được danh sách đề" | `exams.json` hỏng (thiếu/thừa dấu phẩy) | Xem tab Actions hoặc chạy `kiemtra.py` để biết dòng lỗi |
| Đề mới không hiện | Chưa thêm vào `exams.json`, hoặc có `"hidden": true` | Thêm mục / xoá `hidden` |
| Đề hiện nhưng bấm vào báo lỗi | Tên file trong `data/tests/` khác `id` | Đổi tên file cho trùng `id` |
| Ảnh không hiện | Sai đường dẫn hoặc sai chữ hoa/thường trong tên ảnh | `kiemtra.py` liệt kê ảnh thiếu |
| Học sinh vẫn thấy đáp án cũ | Cache trình duyệt | Đóng tab, mở lại; chờ 3 phút sau commit |
| Bảng xếp hạng trống | Chưa cấu hình Sheet và dịch vụ tạm đã hết lượt trong ngày | Làm mục 7 |
| Muốn quay lại bản trước | Sửa nhầm | GitHub → file đó → **History** → chọn bản cũ → copy nội dung về |

---

## 12. Giới hạn cần biết

- Đáp án nằm trong file JSON công khai, học sinh biết F12 có thể xem được, kể cả khi bật
  "Ẩn đáp án đến giờ đóng đề" (tuỳ chọn này chỉ ẩn trên giao diện).
  Vì vậy trang dùng cho **ôn luyện, bài tập về nhà, kiểm tra 15 phút**, chưa dùng cho bài tính điểm chính thức.
- Giới hạn số lượt và giờ đóng đề được kiểm tra trên máy học sinh. Học sinh đổi máy hoặc xoá dữ liệu trình duyệt
  vẫn nộp thêm được; khi đó cột **Ghi chú** trên Google Sheet ghi "Vượt số lượt" để thầy cô biết.
- Mã phòng chỉ để vào phòng, không phải mật khẩu bảo mật.
- Chưa có: nộp ảnh bài tự luận, chấm phiếu tô trắc nghiệm bằng camera, tài khoản học sinh, chấm điểm trên máy chủ.

---

## 13. Nhập đề từ file Word

Trang `admin/` → thẻ **📥 Nhập đề từ Word / văn bản** → chọn file `.docx`
(hoặc bấm "Dán văn bản" để dán chữ). Trang hiện bản xem trước, câu nào thiếu dữ liệu được tô vàng kèm lý do.
Bấm **＋ Thêm vào cuối đề** hoặc **⟳ Thay toàn bộ**, sửa các câu tô vàng, rồi làm tiếp từ bước 3 mục 2.

File Word nên soạn theo mẫu:

```
PHẦN I. ...
Câu 1. Nội dung câu hỏi
A. ...   B. ...   C. ...   D. ...
PHẦN II. ...
Câu 1. Nội dung
a) Ý thứ nhất
b) ...  c) ...  d) ...
PHẦN III. ...
Câu 1. Nội dung
Đáp số: 2,5
```

Trang nhận đáp án theo một trong các cách sau (cách đứng trước được ưu tiên):

- Dòng `Đáp án: B` (Phần II: `Đáp án: ĐĐSS`; Phần III: `Đáp số: 2,5`) hoặc chữ `Chọn B` trong lời giải.
- Bảng đáp án cuối file, ví dụ `1-B 2-A 3-C`.
- Dấu `*` ở phương án đúng: `*B.` hoặc `B. *HCl`. Phần II: ghi `(Đ)` / `(S)` cuối ý.
- Phương án đúng được gạch chân, tô đỏ, tô nền hoặc in đậm trong Word.

Câu tự luận (Phần IV, câu không có phương án) bị bỏ qua và được đếm riêng.
Câu không tìm thấy đáp án vẫn được nhập nhưng có cảnh báo: Phần I tạm để A, Phần II tạm để toàn Sai, Phần III tạm để 0.
**Phải sửa các câu này trước khi phát hành.** Công thức MathType trong Word không đọc được, cần gõ lại.

---

## 14. Giao bài có giờ mở, giờ đóng, số lượt

Trong `admin/`, phần **📌 Giao bài**, hoặc sửa thẳng `data/tests/<id>.json`:

| Trường | Ví dụ | Ý nghĩa |
|---|---|---|
| `"openAt"` | `"2026-11-20T07:30"` | Trước giờ này học sinh không vào được (giờ Việt Nam) |
| `"closeAt"` | `"2026-11-20T09:00"` | Đến giờ này bài đang làm tự nộp; sau đó chỉ xem lại, không ghi điểm |
| `"maxAttempts"` | `1` | Số lần nộp tối đa (`0` hoặc bỏ trống = không giới hạn) |
| `"hideKeyUntilClose"` | `true` | Học sinh chỉ thấy điểm; đáp án và lời giải hiện sau giờ đóng |

- Ghi **các trường giống hệt** vào mục của đề trong `data/exams.json` (nút "Copy mục exams.json" đã làm sẵn).
  Trang chủ dùng `exams.json` để hiện nhãn "ĐANG MỞ / ĐÃ ĐÓNG"; trang thi dùng file đề.
  `kiemtra.py` cảnh báo nếu hai nơi ghi khác nhau.
- Đề có `maxAttempts` hoặc `hideKeyUntilClose` chỉ có chế độ **Thi** (không có Luyện, Rút 20 câu) và thời gian cố định theo đề.
- Muốn mở lại cho ôn luyện: xoá 4 trường trên ở cả hai nơi.
- **Giao link:** trang `report/` → chọn đề → **📤 Giao bài** → copy link, copy tin nhắn gửi nhóm Zalo, hoặc tải ảnh mã QR để chiếu lên bảng.

---

## 15. Thống kê từng câu, ai chưa nộp

Trang `report/`, chọn một đề, nhập mã GV (`REPORT_PASS`) rồi bấm tải kết quả:

- **📊 Thống kê từng câu:** % điểm mỗi câu, số học sinh chọn từng phương án (đáp án đúng có ngoặc vuông),
  % chọn đúng từng ý Phần II. Câu dưới 40% tô đỏ, nên chữa lại trên lớp. Có nút tải CSV.
  Chỉ tính bài nộp từ bản cập nhật tháng 11/2026 trở đi (bài cũ không lưu chi tiết từng câu).
- **👥 Danh sách lớp:** dán danh sách `Họ tên, Lớp` (copy 2 cột từ Excel được) → trang liệt kê ai chưa nộp
  và bài nộp nào có tên không khớp danh sách (thường do gõ sai tên).
  Danh sách chỉ lưu trên máy thầy cô. **Không đưa danh sách học sinh lên GitHub** vì repo công khai.
- Muốn dùng chung danh sách trên nhiều máy: trong Google Sheet tạo tab `DanhSach` (cột A Họ tên, cột B Lớp),
  rồi bấm **☁️ Lấy từ tab DanhSach trên Sheet**. Tính năng này cần `Code.gs` bản mới (triển khai lại theo cuối mục 7).
