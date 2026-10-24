# Phòng Thi 24/7 – Thầy Hóa Gia Lai

> Repo: [KimKenPkl/phongthi247](https://github.com/KimKenPkl/phongthi247) · **Bản chạy thử:** <https://kimkenpkl.github.io/phongthi247/>

Web thi trắc nghiệm online cho học sinh THPT, chạy trên **GitHub Pages**, lưu điểm về **Google Sheet** qua Apps Script. Định dạng đề theo chuẩn **TN THPT 2025**; Phần II (Đúng/Sai) chấm theo **QĐ 764/QĐ-BGDĐT 2024**.

## Tính năng

- **Phòng thi** (`thi.html`): nhập tên/lớp/SBD/mã phòng → fullscreen + đồng hồ tự nộp → chấm tự động ngay trên máy → hiện điểm và giải thích từng câu (tuỳ đề).
- **Chấm chuẩn QĐ 764:** Phần I 0,25 đ/câu · Phần II: 1 ý 0,10 → 2 ý 0,25 → 3 ý 0,50 → đủ 4 ý 1,00; **chọn sai bất kỳ ý nào → câu đó 0 điểm** (mặc định nghiêm ngặt; muốn tính theo số ý đúng thì đặt `scoring.strictPart2: false`) · Phần III 0,25 đ/câu (môn Toán đổi `scoring.part3` = 0,5 nếu muốn).
- **Chống gian lận cơ bản:** bắt fullscreen, đếm số lần rời tab / thoát fullscreen và ghi log, chặn copy + chuột phải, trộn câu/phương án theo seed của từng lượt thi.
- **Lưu bài dở:** đóng trang giữa chừng, quay lại vẫn có nút tiếp tục bài cũ (localStorage).
- **Phím tắt phòng thi:** `1–4` / `A–D` chọn phương án Phần I, `←/→` chuyển câu, `F` đánh dấu câu xem lại.
- **Chặn in / Ctrl+P khi đang làm bài** (in ra chỉ thấy cảnh báo) — nộp xong mới in được, và có nút tải bài làm dạng JSON.
- **Trang GV — soạn đề** (`/admin/`): soạn 3 loại câu, thêm từ ngân hàng, kiểm tra hợp lệ rồi xuất JSON vào `data/tests/`.
- **Trang GV — báo cáo** (`/report/`): thống kê, biểu đồ, bảng điểm từng bài, xuất CSV (mở bằng Google Sheet/Excel).
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
data/config.json           Cấu hình site (appsScriptUrl…)
data/exams.json            Danh sách đề
data/tests/*.json          Các đề thi
data/bank/*.json           Ngân hàng câu hỏi (import từ Neopentan)
scripts/import_neopentan.py Chuyển kho Hỏi–Đáp Neopentan → bank
apps-script/Code.gs        Backend Google Sheet (POST điểm, JSONP báo cáo)
```

---
© Thầy Hóa Gia Lai (Nguyễn Tuấn Minh) — Pleiku, Gia Lai.
