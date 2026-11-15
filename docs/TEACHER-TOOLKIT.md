# Hướng dẫn bộ công cụ giáo viên

Đầu vào: [giao-vien.html](../giao-vien.html). Bản thử nghiệm xử lý tệp tại trình duyệt; bảng điểm chỉ tồn tại trong phiên mở trang. Website cần tải trang trước, chưa có service worker bảo đảm khởi động khi mất mạng. APK chứa các công cụ cục bộ riêng.

## Quy trình thực hành

1. **Soạn và kiểm tra:** dán văn bản vào `soan-de.html`, xem cảnh báo trùng câu và cấu trúc, chọn dọn dòng hoặc tách lời giải. Khi có bảng ĐÁP ÁN, công cụ từ chối đánh số lại để tránh đứt liên kết. Tải văn bản hoặc chuyển sang Trộn đề.
2. **Trộn Word:** tải mẫu trong `tronde.html` hoặc nhập DOCX. Xem báo cáo nhận dạng, công thức, ảnh, nhóm câu và đáp án. Câu có cảnh báo nhập liệu được đánh dấu cần rà soát; sửa nguồn rồi nhập lại trước khi xuất đáp án/QR/Word có đáp án hoặc chuyển sang chấm. Đánh dấu cần rà soát không phải giao diện sửa đáp án trực tiếp.
3. **Excel → QR:** chọn đúng TNMaker 2025, YoungMix 2025 hoặc SmartTest 2025 và sheet. Kiểm tra số câu, mã đề và bảng đáp án trước khi tạo. Số câu phải liên tục trong từng phần. QR dùng TNMaker type 6, Đ được mã hóa Unicode U+0110; cần quét thử với phiên bản app thực tế. QR danh sách học sinh là giao thức riêng, không mặc định tương thích app khác.
4. **Chấm:** thử nút dữ liệu mẫu trước. Chọn đáp án hoặc nhận từ QR/Trộn đề; tạo mẫu câu trả lời khớp bộ đề. Điền CSV/XLSX rồi chấm. Phần I nhận A–D, phần II bốn ký tự Đ/S (`D` được chấp nhận), phần III số hoặc văn bản ngắn.
5. **Tổng hợp:** nhập tên môn và thêm kết quả chấm, hoặc nhập bảng nhiều môn. Mỗi học sinh–lớp–môn chỉ có một dòng. Chỉ xếp hạng khi đủ môn được chọn; đồng điểm cùng hạng. Hạng tính chung các lớp trong tệp, không phải hạng riêng từng lớp. Môn được quy về 10 rồi cộng, không có trọng số môn.
6. **Bàn giao và lưu:** tải bảng điểm CSV, chi tiết từng câu, phiếu trả bài bằng In/Lưu PDF và bản sao lưu JSON. Kiểm tra tệp thực sự đã lưu trước khi đóng trang. Sao lưu JSON hiện chỉ chứa bảng tổng hợp, không chứa bộ đề hay toàn bộ chi tiết đợt chấm.
7. **Quét phiếu OMR:** mở `quet-bai.html`, nạp đáp án và danh sách nếu cần, rồi chụp/chọn ảnh hoặc PDF quét. Tệp PDF được raster từng trang tại thiết bị (tối đa 10 tệp, 50 trang, 50 MB tổng; mỗi tệp tối đa 25 MB). Kiểm tra nhận dạng, sửa ô chưa rõ và duyệt tường minh trước khi ghi vào đợt. Đây không phải nhận dạng PDF văn bản và chưa xác nhận tương thích với mẫu/app TNMaker. Chưa có đánh giá độ chính xác trên ảnh chụp điện thoại thật; đối chiếu thủ công trước khi dùng điểm chính thức.

## Mẫu dữ liệu

Đáp án, với mã để dạng Text trong Excel:

```csv
code,part,question,answer
001,1,1,A|C
001,2,1,ĐSĐ*
001,3,1,"2.5|2,50"
```

Câu trả lời:

```csv
id,name,class,code,I.1,II.1,III.1
007,Học sinh mẫu,12A,001,C,ĐSĐS,2.5
```

Bảng tổng hợp:

```csv
id,name,class,subject,score,max
007,Học sinh mẫu,12A,Hóa học,8,10
007,Học sinh mẫu,12A,Toán,7,10
```

`|` tách đáp án được chấp nhận; `*` chấp nhận cả Đ và S ở một ý phần II, nhưng ý bỏ trống vẫn không có điểm. Dùng `?` hoặc `-` cho ý chưa trả lời; cả ô trống nhận 0. Phần III chấp nhận dấu phẩy/chấm thập phân, số âm và so sánh số với sai số 1e-9; không có chấm tự luận hay dung sai tùy câu. Mỗi câu phần I/III mặc định 0,25 điểm, có thể đổi ở biểu mẫu. Phần II đúng 0–4 ý nhận lần lượt 0 / 0,1 / 0,25 / 0,5 / 1 điểm. Điểm quy về 10 được hiển thị riêng với điểm thô.

## Nhập, xuất và phục hồi

- CSV/TSV tối đa 5 MB, 10.000 dòng và 250 cột; XLSX đầu vào tối đa 8 MB, mỗi sheet tối đa 150.000 ô. Đọc OOXML, không chạy macro. Không hỗ trợ XLS/XLSM; lưu lại XLSX hoặc CSV.
- Sheet có công thức bị từ chối, kể cả có giá trị cache: sao chép → Dán giá trị vào bản sao trước khi nhập. Tệp chấm/tổng hợp cần đúng một sheet dữ liệu; trang QR cho chọn sheet.
- Giữ mã dưới dạng Text là tốt nhất. Reader hỗ trợ định dạng số 0 phổ biến `000`–12 chữ số; không mô phỏng toàn bộ định dạng Excel.
- Xuất CSV vô hiệu hóa chuỗi có nguy cơ công thức, giữ nguyên số âm hợp lệ. Không tự cấu hình định dạng cột khi Excel mở CSV; nhập CSV với cột mã dạng Text để giữ số 0 đầu.
- Nhập sai giữ kết quả trước. Khôi phục JSON được kiểm tra trước và yêu cầu xác nhận khi thay bảng đang có. JSON schema v1; không tự di trú phiên bản khác.
- In phiếu là bảng chi tiết đã chọn/đáp án/điểm, không vẽ đè lên ảnh phiếu gốc. Trình duyệt/hệ thống Android quyết định khả năng Lưu PDF.
- Không tự lưu tên và điểm vào localStorage; dữ liệu chuyển bộ đáp án dùng sessionStorage rồi được đọc/xóa một lần. Lưu ý ứng dụng hệ thống, print spooler và thư mục Downloads có thể giữ tệp do người dùng tạo.

## Chưa hỗ trợ và giới hạn

Chưa hỗ trợ tự nhận mọi mẫu phiếu, Google Drive, nhập một chạm vnEdu/SMAS, xuất bảng điểm XLSX và schema v2. Tiến độ Lab lưu cục bộ trên thiết bị, không đồng bộ đám mây; lịch sử cũ không có thời gian vẫn hiện “chưa rõ ngày”. Xếp hạng tuần/tháng chỉ dùng timestamp do Apps Script ghi khi nhận bài; cần chủ sở hữu cập nhật và triển khai `apps-script/Code.gs`. Lượt cũ không có timestamp máy chủ bị loại khỏi kỳ. Chưa đo tốc độ chấm/độ chính xác OMR trên ảnh thật; không có cam kết bảo mật tuyệt đối. Dùng dữ liệu mẫu và đối chiếu thủ công trước khi dùng điểm chính thức.
