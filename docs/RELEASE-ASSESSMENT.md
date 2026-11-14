# Đánh giá bản thử nghiệm công cụ giáo viên

## Kết luận

Đủ để giáo viên thử quy trình bằng dữ liệu mẫu và bản sao dữ liệu. **Chưa sẵn sàng bán thương mại hoặc dùng không giám sát cho kỳ thi chính thức.** Không có cơ sở cam kết ổn định tuyệt đối: thiếu kiểm thử Android thật, nhiều trình duyệt, nhiều dạng Word và phản hồi từ lớp học. Cài APK thành công cũng chưa được xác nhận.

## Bằng chứng trên bản mã hiện tại

| Kiểm tra | Kết quả | Giới hạn |
|---|---|---|
| `node --test scripts/test_teacher_tools.cjs` | 8/8 pass | CSV, QR, chấm, tổng hợp, backup, kiểm tra văn bản; không phải kiểm thử mọi nội dung giáo khoa |
| `node scripts/test_teacher_browser.cjs` | Pass Edge headless/CDP | Mẫu TNMaker 12/4/6, YoungMix 18/4/6, SmartTest 12/5/4; mẫu thật nằm ngoài repo, dùng `PTW_XLSX_FIXTURES` để đổi thư mục |
| Luồng trình duyệt mở rộng | Pass | QR→chấm, mẫu khớp đề, chuyển điểm, in, backup/restore, hủy restore, nhập lỗi giữ bảng cũ, tên không tin cậy, chặn xuất đáp án cần rà soát |
| `node scripts/_e2e_preview.js` | Pass | Mẫu Word, nhóm bài đọc, phương án cố định, tô đáp án, đề JSON; script có sẵn bị gitignore, kết quả chạy tại máy |
| Responsive/bàn phím | Không tràn ngang 375px; Tab đến liên kết đầu | Bốn trang công cụ; chưa thay thế kiểm tra screen reader/thiết bị thật |
| `python -B scripts/kiemtra.py` | 0 lỗi, 14 cảnh báo có sẵn | Câu đúng/sai một ý trong ngân hàng lớp 7/8/9; không tự sửa dữ kiện hay mở ngân hàng đang ẩn |
| APK build, `aapt`, `apksigner` | Build pass, chữ ký v2/v3, manifest không khai báo permission | Android 8+, target35; chưa cài hoặc chạy SAF/print trên Android thật |

Kiểm thử bổ sung xác nhận XLSX giữ mã `001` và số âm, cùng JavaScript bridge xuất Blob và mẫu Word có thuộc tính download rỗng. Bridge được kiểm tra bằng đối tượng native giả trong Edge; điều đó không thay thế thử SAF trên Android. Detector Impeccable đã chạy nhưng thiếu parser HTML/CSS nên chỉ kiểm tra regex và không báo phát hiện; không dùng kết quả này để tuyên bố đạt contrast hay accessibility đầy đủ. Script Word qua parse PowerShell và Audit chỉ đọc; không chạy lại Apply/Restore, chưa tái hiện lỗi Word ban đầu.

Đã sửa sáu lỗi toàn vẹn dữ liệu: chặn đánh số lại văn bản có bảng đáp án; đánh dấu và chặn đáp án fallback; xác minh số câu khi đọc Excel QR; giữ số âm khi xuất/tái nhập CSV; đọc định dạng 0 đầu phổ biến trong XLSX; giải mã URL manifest VSTO đúng. Lượt review bổ sung thay sanitizer regex bằng DOMPurify cục bộ, chặn mất điểm khi điều hướng Android, hoàn tất cleanup print, hỗ trợ tải mẫu Word qua SAF, loại điều hướng APK không được đóng gói và ghi tệp ngoài UI thread. Sửa nguồn Android đã qua build; hành vi native còn cần thiết bị kiểm chứng.

## Ma trận chức năng

| Luồng | Web | APK | Cần làm tiếp |
|---|---|---|---|
| Dọn văn bản/kiểm tra/trộn Word | Có; hồi quy mẫu pass | Đóng gói | Thử corpus Word thật của nhiều giáo viên |
| QR đáp án/Excel | Có; ba mẫu pass | Đóng gói | Quét QR bằng app đích trên điện thoại |
| Chấm bảng đã số hóa/tổng hợp | Có; logic và UI pass | Đóng gói | Kiểm tra chéo lớp thật có cho phép sử dụng dữ liệu |
| CSV, backup JSON, phiếu trả bài | Có | Bridge SAF/print đã build | Thử lưu, hủy, in, quay lại và kill app |
| OMR/camera/PDF | Chưa | Chưa | Nhánh riêng, tập ảnh được phép dùng và thống kê lỗi |
| Drive, Lab sync, xếp hạng kỳ | Chưa trong toolkit | Chưa | Thiết kế dữ liệu/backend khi có nhu cầu |

## Ưu tiên sau bản thử nghiệm

1. Thử cài và cập nhật đè trên ít nhất hai phiên bản Android, WebView mới; nhập CSV/XLSX/DOCX, hủy picker, xuất Word/PNG/JSON, in PDF, xoay và đóng/mở ứng dụng.
2. Giáo viên đối chiếu điểm thủ công, bộ đề thật, công thức/ảnh và mã có 0 đầu; sửa trước khi dùng chính thức.
3. Xử lý 14 cảnh báo ngân hàng bằng thẩm định nội dung riêng; giữ phạm vi công khai hiện tại.
4. Tách OMR thành thử nghiệm có kiểm định, không suy rộng độ chính xác từ README phần mềm khác. Trước phát hành thương mại cần kiểm thử độc lập, quy trình hỗ trợ và quản lý bản phát hành/khóa ký.
