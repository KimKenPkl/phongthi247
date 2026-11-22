# Phòng Thi 24/7: ưu tiên để vận hành ổn định

Cập nhật: 22/11/2026. Phạm vi: một giáo viên, các lớp đang dạy; không bổ sung dịch vụ trả phí, tài khoản SaaS hay theo dõi hành vi ngoài nhu cầu dạy học.

## Bản giao lần này

- Camera mặc định bật, có thể tắt trước và trong bài. Không có camera hoặc từ chối quyền vẫn làm, tiếp tục và nộp được.
- Camera chỉ kiểm tra trạng thái luồng và độ sáng khung hình. Không nhận diện điện thoại, khuôn mặt hoặc kết luận gian lận.
- Mặc định chọn Thi thử xếp hạng; đề luyện tự do vẫn đổi được chế độ.
- Đề 5, lớp 12A7: chỉ mở **07:00–11:00 thứ Hai, 23/11/2026, giờ Việt Nam**. Tối đa 50 phút, luôn kết thúc chậm nhất lúc 11:00.
- Trang chủ và phòng thi có thông báo. Luồng vào mới, tiếp tục nháp, nháp tạo trước lịch và URL luyện tập đều được kiểm tra.
- Không dùng session cache cũ cho JSON đề; trước khi bắt đầu/tiếp tục và khi quay lại tab sẽ kiểm tra lại chính sách giao bài.
- Ẩn liên kết tải bản đề ngoài lịch trên giao diện và chặn nạp Đề 5 qua công cụ trộn ngoài lịch. Nội dung đã tải trước đó không thể thu hồi.
- CI chạy thêm bộ kiểm tra lịch, registry và kiểm thử nộp bài sẵn có; không cài thêm dependency.

### Nơi chỉnh lịch và lý do không đổi hash nội dung

`data/exams.json` là nguồn chính sách giao bài của đợt này: `openAt`, `closeAt`, `strictSchedule`, `hideKeyUntilClose`, `announcement`.

Phòng thi tính revision của JSON nội dung **trước** khi áp dụng chính sách từ danh mục. Đổi lịch không làm bài nộp hợp lệ bị backend đang chạy từ chối vì đổi hash. `node scripts/build_exam_registry.cjs` lấy lịch từ danh mục và giữ revision theo nội dung gốc.

## Giới hạn còn lại: cần phân biệt web với backend

**Push GitHub không triển khai Google Apps Script.** Máy hiện chưa có phiên OAuth Google/clasp. Registry trong source đã đồng bộ lịch; chưa xác nhận registry mới đã chạy trên endpoint live. `ping` trả `GS ready` chỉ xác nhận endpoint trả lời, không xác nhận chính sách hoặc luồng ghi Sheet.

Để chặn bài gửi ngoài lịch bằng **giờ máy chủ**, chủ sở hữu cần cập nhật deployment Apps Script hiện có với `Code.gs`, `Submission.gs`, `ExamRegistry.gs`, giữ đúng các Script Properties đang dùng; sau đó nghiệm thu bằng đề/dữ liệu thử riêng. Không thay endpoint hoặc khóa đọc một cách tùy tiện.

Trước nghiệm thu backend, không quảng bá đây là cơ chế chống lách tuyệt đối: JavaScript, đồng hồ máy và URL JSON/PDF/DOCX công khai không phải hàng rào bảo mật. Muốn bảo mật đề trước giờ thi cần nguồn nội dung riêng có kiểm soát truy cập; không thể đạt mục tiêu này chỉ bằng cách ẩn nút.

Backend source hiện từ chối bài mới đến từ giờ đóng trở đi, không có khoảng gia hạn. Bài tự nộp lúc 11:00 có thể đến trễ do mạng; phải giữ bài chờ để giáo viên đối soát, không tự đổi thời điểm hoặc revision để gửi lại.

## Thứ tự phát triển tiếp

| Ưu tiên | Việc cần làm | Tiêu chí nghiệm thu |
|---|---|---|
| P0 | Nghiệm thu xuyên suốt trình duyệt → Apps Script → Sheet → báo cáo trên deployment thật | Một bài thử có receipt; mất ACK rồi gửi lại không thêm dòng; sai mã/scope không đọc được dữ liệu; kiểm tra trên điện thoại thật |
| P0 | Mã học sinh ổn định và mã dự thi riêng gắn học sinh–đề | Trùng tên không nhập nhằng; đổi tên/lớp không vượt giới hạn lượt; backend kiểm tra, không chỉ trình duyệt |
| P1 | Xuất gói bài chờ và quy trình cứu bài cho giáo viên | Khôi phục đủ đáp án, attempt ID, revision và receipt; giữ bản gốc và lý do xử lý; không tạo bản nộp trùng |
| P1 | Báo cáo tóm tắt, phân trang và tải chi tiết riêng | Nhiều đề trong một học kỳ vẫn xem/xuất đủ; không vượt trần phản hồi hiện có |
| P1 | Sao lưu, thời hạn lưu và xóa dữ liệu học sinh | Có hướng dẫn phục hồi đã thử; giáo viên xuất/xóa được đúng hồ sơ, không chỉ xóa phần hiển thị |

Đã có roster, giao bài bằng link/QR, thống kê từng câu, danh sách chưa nộp, hàng đợi bền và xác nhận nộp. Ưu tiên nghiệm thu các luồng này trước khi xây thêm giao diện tương tự.

## Lệnh kiểm chứng

```powershell
python scripts/kiemtra.py
node scripts/build_exam_registry.cjs --check
node scripts/test_exam_schedule.cjs
node scripts/test_submission_hardening.cjs
node scripts/test_submission_client.cjs
node scripts/lan10/camera-mode.cjs
node scripts/lan10/browser.cjs
```

Hai bộ browser dùng Chrome và Playwright đã có trên máy; không gửi bài hoặc dữ liệu học sinh thật lên Apps Script. Chế độ `--live` kiểm tra web đã phát hành nhưng vẫn chặn các request Apps Script. Các kiểm thử cục bộ không thay thế nghiệm thu backend thật.
