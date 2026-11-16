# Triển khai luồng nộp bài an toàn

Bản hardening này dùng một Google Sheet và một Apps Script deployment cho một đơn vị. Bản này chưa phải hệ thống tài khoản nhiều trường.

## Tệp phải triển khai cùng nhau

Trong Apps Script, dán cả ba tệp sau vào cùng một project:

1. `apps-script/Code.gs`
2. `apps-script/Submission.gs`
3. `apps-script/ExamRegistry.gs`

`ExamRegistry.gs` là tệp sinh tự động. Chạy lệnh sau ở thư mục dự án trước khi copy:

```powershell
node scripts/build_exam_registry.cjs
node scripts/build_exam_registry.cjs --check
```

Không chỉ copy `Code.gs`: các hàm xác thực, chấm lại, receipt và phạm vi đọc nằm trong `Submission.gs`, còn đáp án tin cậy nằm trong `ExamRegistry.gs`.

## Script Properties

Đặt các property trong Apps Script:

- `REPORT_PASS`: mã đọc toàn bộ báo cáo của đơn vị.
- `REPORT_READERS` (tuỳ chọn): JSON array cho mã đọc giới hạn. Ví dụ:

```json
[
  {"pass":"gv-12a","classes":["12A1","12A2"]},
  {"pass":"de-hoa","exams":["de-cuong-hoa12-hk1"]}
]
```

Reader chỉ có `exams` không được đọc danh sách lớp. Reader chỉ có `classes` chỉ nhận các dòng thuộc lớp được cấp. Không đặt mã trong URL hoặc trong `localStorage`/`sessionStorage` của trình duyệt.

`PUBLIC_RANKING` mặc định tắt. Chỉ đặt `PUBLIC_RANKING=true` khi đơn vị chấp nhận việc công khai bảng xếp hạng đã che tên. Khi tắt, trang học sinh không hiển thị ranking công khai.

## Web app

Triển khai Web app với:

- Execute as: **Me**
- Who has access: **Anyone**

Copy URL `/exec` vào `data/config.json`. URL phải có dạng `https://script.google.com/macros/s/.../exec`.

Sau khi đổi bất kỳ tệp nào, tạo deployment version mới. Trang report có nút copy đủ ba tệp để tránh bỏ sót dependency.

## Luồng nộp và giới hạn

Client gửi `revision`, `order`, đáp án canonical và receipt token. Server kiểm tra đề trong registry, mã phòng, subset, kiểu đáp án, lịch đề và số lượt; sau đó chấm lại từ đáp án server. Điểm, phần trăm và đáp án chi tiết do client gửi bị bỏ qua.

Server ghi `Server nhận (Asia/Ho_Chi_Minh)` và receipt hash dưới ScriptLock. Gửi lại cùng `attemptId` và cùng nội dung trả receipt cũ, không tạo thêm dòng. Cùng `attemptId` nhưng khác nội dung trả lỗi xung đột.

Client chỉ xoá item khỏi hàng đợi khi receipt trả về khớp `attemptId`, `examId`, `revision` và `receiptToken`. Mất mạng, lỗi CORS hoặc receipt không khớp giữ bài trong hàng đợi.

POST mang nonce ngẫu nhiên 256 bit trong body. Máy chủ cất phản hồi vào cache tối đa 60 giây, client đọc capability qua JSONP với nonce, không gửi mã GV trong URL. Thao tác đọc/xóa capability dùng ScriptLock; một capability chỉ được lấy một lần. CORS không đọc được phản hồi thì client thử POST `no-cors` cùng body, rồi đọc capability. Mỗi POST có timeout riêng. Cache có thể bị thu hồi sớm; mất capability không đồng nghĩa chưa ghi bài, nên bài vẫn chờ để gửi lại với cùng receipt và nội dung.

Phản hồi vượt 90.000 byte UTF-8 được thay bằng lỗi `response_too_large`. Hãy lọc đề/kỳ để giảm báo cáo; chưa có phân trang cho báo cáo lớn. Không chuyển sang đường đọc công khai khi báo cáo riêng bị lỗi. Không gửi ảnh/PDF lên backend.

Queue v2 gắn từng bài với URL deployment ban đầu, lưu một storage key riêng cho mỗi receipt để hai tab không ghi đè hàng đợi. Không tự gửi bài sang deployment khác. Queue legacy `ptw_pending` và script di chuyển dữ liệu cũ không được tự chạy hoặc tự chuyển đổi; cần đối chiếu thủ công, giữ nguyên backup.

Máy chủ từ chối bài mới nhận từ `closeAt` trở đi, không có khoảng gia hạn. Tự nộp lúc đóng đề vẫn có thể đến trễ do mạng; bài được giữ local để giáo viên đối chiếu. Retry bài đã ghi được dedupe trước kiểm tra lịch, nhưng revision hiện được kiểm tra trước dedupe: nếu registry đã đổi, retry trả `exam_revision`; không tự thay đáp án hoặc revision của bài chờ.

Bài luyện một phần vẫn có thể lưu vào Sheet nhưng cột `Bài đầy đủ` là false và bị loại khỏi ranking công khai. Bài legacy không có thời điểm server nhận không được tính vào ranking tuần/tháng.

## Kiểm tra trước khi triển khai

```powershell
node scripts/build_exam_registry.cjs --check
node scripts/test_submission_hardening.cjs
node scripts/test_submission_client.cjs
node scripts/test_submission_browser.cjs
node scripts/test_submission_mutations.cjs
node scripts/test_apps_script_period.cjs
node scripts/test_lab_progress.cjs
node scripts/test_omr.cjs
node scripts/test_teacher_tools.cjs
python scripts/kiemtra.py
```

Các test này chạy cục bộ, không gửi bài hoặc dữ liệu học sinh lên deployment live. Sau khi triển khai thật, cần nghiệm thu riêng bằng một bài kiểm tra không chứa dữ liệu học sinh thật và kiểm tra trực tiếp receipt trong Sheet.

## Trạng thái source và môi trường thật

Đợt hardening chỉ sửa source local, chưa commit/push/deploy. Kết quả VM và Edge với backend giả lập không xác nhận CORS/redirect/cache trên Apps Script thật. Endpoint `ping` phản hồi cũng chưa đủ để nghiệm thu luồng nộp và đọc báo cáo. Sau khi chủ sở hữu triển khai đủ ba tệp, kiểm tra dữ liệu mẫu: nộp, retry mất ACK không tăng số dòng, đổi mã đọc không lộ dữ liệu cũ, sai mã, scope lớp/đề, CSV và lịch đóng đề. Ranking kỳ live và camera/SAF/print/lifecycle Android thật vẫn chưa nghiệm thu.
