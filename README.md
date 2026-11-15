# Phòng Thi 24/7 – Kimkenpkl

> Repo: [KimKenPkl/phongthi247](https://github.com/KimKenPkl/phongthi247) · **Bản chạy thử:** <https://kimkenpkl.github.io/phongthi247/>

Web thi trắc nghiệm online cho học sinh THPT, chạy trên **GitHub Pages**, lưu điểm về **Google Sheet** qua Apps Script. Hỗ trợ ba phần câu hỏi TN THPT; kiểm tra cấu hình thang điểm từng đề trước khi giao bài.

> **Giáo viên vận hành hằng ngày:** đọc [HUONG_DAN_GV.md](HUONG_DAN_GV.md) (thêm đề, sửa đáp án, ẩn đề, nối Google Sheet, xử lý sự cố).
> Trước khi push luôn chạy `python scripts/kiemtra.py`; GitHub Actions cũng tự chạy mỗi lần push.

## Bộ công cụ giáo viên và Android thử nghiệm

Mở [Góc giáo viên](https://kimkenpkl.github.io/phongthi247/giao-vien.html) để đi theo luồng **soạn văn bản → trộn Word → Excel/QR → chấm bảng câu trả lời → tổng hợp môn → xuất và sao lưu**.

- [Tải APK Android 0.2-camera thử nghiệm](downloads/phongthi247-trial.apk) · Android 8 trở lên; [hướng dẫn cài và giới hạn kiểm chứng](docs/ANDROID-TRIAL.md).
- [Hướng dẫn công cụ, mẫu nhập và phục hồi](docs/TEACHER-TOOLKIT.md).
- [Kết quả kiểm thử và đánh giá mức sẵn sàng](docs/RELEASE-ASSESSMENT.md).
- [Đối chiếu TNMaker/TNMix/Conic và repo giáo viên](docs/TEACHER-REFERENCES.md).
- [Kiểm tra và khôi phục cấu hình add-in Word](docs/WORD-ADDINS.md).

Đây là **MVP thử nghiệm**, đã có OMR từ camera/ảnh và nhập PDF quét cục bộ, nhưng chưa có bộ ảnh điện thoại thật để đo độ chính xác và chưa đủ bằng chứng phát hành thương mại. Kết quả OMR chỉ ghi sau khi giáo viên duyệt. Không tự lưu bảng điểm mới vào trình duyệt: tải CSV/JSON trước khi rời trang. APK đã build và kiểm tra chữ ký, chưa được cài chạy trên thiết bị thật. 14 cảnh báo dữ liệu ngân hàng có sẵn vẫn được giữ để rà soát; không mở lại các ngân hàng đang ẩn.

Phần II của **công cụ chấm bảng câu trả lời mới** luôn tính theo số ý đúng: `0 / 0,1 / 0,25 / 0,5 / 1`. Phòng thi cũ bên dưới vẫn có cấu hình `strictPart2`; cần kiểm tra cấu hình từng đề, không dùng mô tả thang điểm của luồng này để suy ra luồng kia.

## Tính năng

- **Phòng thi** (`thi.html`): nhập tên/lớp/SBD/mã phòng → fullscreen + đồng hồ tự nộp → chấm tự động ngay trên máy → hiện điểm và giải thích từng câu (tuỳ đề).
- **Thang điểm phòng thi cũ:** Phần I mặc định 0,25 đ/câu; phần III mặc định 0,25 đ/câu, có thể cấu hình. Phần II có các bậc 0,10 / 0,25 / 0,50 / 1,00, nhưng mặc định cũ `strictPart2` cho 0 điểm cả câu nếu có ý chọn sai. Đặt `scoring.strictPart2: false` để tính theo số ý đúng. Không coi chế độ strict là thang điểm chính thức; công cụ chấm bảng câu trả lời mới luôn dùng bậc theo số ý đúng.
- **Chống gian lận cơ bản:** bắt fullscreen, đếm số lần rời tab / thoát fullscreen và ghi log, chặn copy + chuột phải, trộn câu/phương án theo seed của từng lượt thi.
- **Lưu bài dở:** đóng trang giữa chừng, quay lại vẫn có nút tiếp tục bài cũ (localStorage).
- **Phím tắt phòng thi:** `1–4` / `A–D` chọn phương án Phần I, `←/→` chuyển câu, `F` đánh dấu câu xem lại.
- **Chặn in / Ctrl+P khi đang làm bài** (in ra chỉ thấy cảnh báo) — nộp xong mới in được, và có nút tải bài làm dạng JSON.
- **Trang GV — soạn đề** (`/admin/`): soạn 3 loại câu, thêm từ ngân hàng, kiểm tra hợp lệ rồi xuất JSON vào `data/tests/`.
- **Trộn đề** (`tronde.html`): tải file Word `.docx` lên (file mẫu TN THPT 2025 cho 10 môn ở `assets/mau/`), trộn nhiều mã đề, giữ phương án `#A.` và nhóm câu `<g>`, xem trước đề trộn hoặc đề gốc kèm vị trí từng câu, xuất đáp án và QR TNMaker. Chi tiết: mục 16 trong `HUONG_DAN_GV.md`.
- **Trang GV — báo cáo** (`/report/`): thống kê, biểu đồ, bảng điểm từng bài, xuất CSV (mở bằng Google Sheet/Excel).
- **Quét phiếu OMR** (`quet-bai.html`): camera/ảnh và PDF nhiều trang xử lý cục bộ, duyệt/sửa trước khi ghi; PDF giới hạn số tệp/trang/kích thước. Tuần/tháng trong báo cáo cần chủ sở hữu triển khai lại Apps Script có cột thời điểm máy chủ nhận bài.
- **Ngân hàng câu hỏi:** `data/bank/` — import từ kho Neopentan (~1000 câu) bằng `scripts/import_neopentan.py`.

## Deploy của thầy (5 bước)

1. **Tạo repo + bật Pages:** push repo này lên GitHub → Settings → Pages → Branch `main` / `(root)`.
2. **Tạo Google Sheet** mới, ví dụ đặt tên `PhongThi_BaiLam`.
3. **Dán backend:** Sheet → Extensions → Apps Script → dán nội dung `apps-script/Code.gs` → Save.
4. **Deploy:** Deploy → New deployment → Web app → Execute as *Me*; Who has access *Anyone* → copy URL dạng `https://script.google.com/macros/s/xxx/exec`.
5. **Kết nối:**
   - Thay `appsScriptUrl` trong `data/config.json` bằng URL vừa copy → commit + push.
   - Đặt mã báo cáo: Apps Script → Project Settings → **Script Properties** → thêm `REPORT_PASS` = mã GV tùy ý (bảng `/report/` sẽ hỏi mã này). **Không** đặt mật khẩu trong repo.

## Cách tạo đề mới

1. Mở `/admin/` (không cần mật khẩu — quyền điều khiển website là quyền git push).
2. Điền thông tin đề, thêm câu (3 loại), có thể tick chọn từ ngân hàng câu hỏi.
3. Bấm **Tải file** → file `&lt;id&gt;.json` xuống máy → chép vào `data/tests/` → mở `data/exams.json`, dán mục snippet bấm COPY được vào mảng `exams` → git push.

## Import ngân hàng Neopantan

```powershell
python scripts/import_neopentan.py
```

Đọc `D:\NGAN_HANG_SOL_DE_CAC_NUOC\06_VIETNAM\NEOPENTAN\hoi_dap\pages\*.md`, nhận các câu có đủ 4 phương án A–D, tìm đáp án trong khối lời giải (`X. Đúng, ...`), copy ảnh liên quan sang `data/img/neopentan/`. Câu thiếu đáp án vẫn được giữ (`answerIndex: null`) để thầy bổ sung tay.

## Học hỏi từ các dự án mở

Cùng kiến trúc và một số tính năng đã tham khảo từ các repo tương tự trên GitHub:
- [Vijay263601/tsr_exams](https://github.com/Vijay263601/TSR_EXAMS) — cùng kiểu GitHub Pages + Apps Script + Google Sheet (fullscreen, đếm rời tab, chấm tự động, dashboard GV).
- [DEVOLOPER-1/QUANTA](https://github.com/DEVOLOPER-1/QUANTA) — flag câu, palette trạng thái, phím tắt, chặn in, xuất kết quả JSON.
- [the-sudipta/quizely](https://github.com/the-sudipta/quizely) · [Refloow/Exam-Quiz-Test](https://github.com/Refloow/Exam-Quiz-Test) — máy thi tĩnh 1 file, dark mode (lộ trình V2).

## Lưu ý bảo mật (quan trọng)

- Đây là bản **V1 tĩnh**: đáp án nằm trong file JSON công khai — học sinh biết F12 là xem được. Phù hợp **ôn tập / luyện đề**, chưa dùng để tính điểm kiểm tra chính thức.
- "Mã phòng thi" chỉ đóng cửa vào phòng theo giờ, không phải mã hóa.
- Mã báo cáo GV đặt trong **Script Properties** của Apps Script, không lưu trong repo.
- Lộ trình V2: server-held answers — Apps Script trả đáp án theo mã phòng lúc nộp bài.

## Cấu trúc thư mục

```
index.html                 Trang học sinh – chọn bài
thi.html + assets/exam.js  Phòng thi (anti-cheat, timer, chấm, gửi Sheet)
admin/ + assets/admin.js   Trang GV soạn đề + ngân hàng câu hỏi
report/ + assets/report.js Báo cáo điểm GV (JSONP, Chart.js, CSV)
assets/common.js           Engine chấm QĐ 764, utils dùng chung
assets/vendor/              Thư viện ngoài để sẵn trong repo (Chart.js 4.4.3, MIT)
data/config.json           Cấu hình site (appsScriptUrl…)
data/exams.json            Danh sách đề (mỗi mục có "category" = môn: toan, hoa, ly…)
data/tests/*.json          Các đề thi
data/bank/*.json           Ngân hàng câu hỏi (import từ Neopentan)
data/docs/                 File Word/PDF cho học sinh tải
reports/                   Báo cáo rà soát, nhật ký sửa đáp án
scripts/kiemtra.py         Kiểm tra dữ liệu đề (chạy trước khi push)
scripts/bump_version.py    Tăng ?v= sau khi sửa assets/ để xoá cache
scripts/audit_decuong.py   Rà nội dung đề, xuất báo cáo vào reports/
scripts/import_neopentan.py Chuyển kho Hỏi–Đáp Neopentan → bank
scripts/archive/           Script dùng một lần khi nhập đề GK1 2026–2027 (chỉ tham khảo)
apps-script/Code.gs        Backend Google Sheet (lưu điểm, bảng xếp hạng action=top, báo cáo GV)
.github/workflows/         GitHub Actions chạy kiemtra.py mỗi lần push
```

Lưu điểm: khi `data/config.json` có `appsScriptUrl`, bài nộp ghi vào Google Sheet và bảng xếp hạng đọc từ Sheet. Khi để trống, trang dùng bảng xếp hạng tạm trên `api.restful-api.dev` (giới hạn lượt gọi, không bảo mật).

---
© Phòng Thi 24/7 · Phát triển bởi **Kimkenpkl**.
