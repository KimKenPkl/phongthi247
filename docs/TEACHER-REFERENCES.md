# Phần mềm và repo tham khảo cho giáo viên

Phạm vi khảo sát: trang công khai và README/giấy phép, không đăng nhập gói trả phí, không chạy macro thương mại, không đo nhận diện OMR. Tính năng hãng mô tả không phải kết quả kiểm thử của dự án này. Không sao chép mã các repo OMR dưới đây vào ứng dụng.

## Quy trình phần mềm

| Nguồn | Quan sát công khai | Áp dụng trong MVP | Còn giới hạn |
|---|---|---|---|
| [TNMaker](https://tnmaker.net/huong-dan-dao-de-trac-nghiem/) | Quy trình đảo đề, Excel và QR đáp án | Kiểm thử ba mẫu Excel thật; payload type 6, ký tự Đ U+0110 | Chưa quét QR trong app TNMaker trên điện thoại |
| [TNMix](https://gioithieu.tnmix.com/) | Trộn di động offline, nhóm câu, cố định câu/phương án, nhớ thiết lập và QR | Giữ kiến trúc trộn hiện có, handoff đáp án có kiểm tra cảnh báo | Không tuyên bố đã có đầy đủ khả năng chỉnh đáp án/lưu thiết lập như TNMix |
| [mrhien.com / ChấmPro](https://mrhien.com/) | Bộ công cụ Word phục vụ soạn/chấm đề | Làm độc lập luồng dọn văn bản và kiểm tra trước khi trộn | Không nhúng macro hay giấy phép thương mại; chưa xác minh lỗi Word gốc |
| [Conic Scan](https://conic-chamthi.pages.dev/scan/) | Trang quét có camera/ảnh, chỉnh bốn góc, chế độ màu và xuất PDF | Học cách đưa kiểm tra đầu vào và phiếu trả bài vào quy trình | MVP chưa scan/OMR; bài quảng bá chấm mọi phiếu/1 giây/Drive chưa được kiểm chứng ở đây |

Các điểm đã sửa dựa trên lỗi tái hiện trong **phongthi247**, không phải kết luận các sản phẩm trên mắc lỗi: giữ mã có số 0 đầu, chặn xuất đáp án nhập lỗi, kiểm tra số câu và chống mất bảng điểm khi nhập tệp sai. Không sử dụng tuyên bố “mọi loại phiếu”, “bảo mật tuyệt đối” hoặc tốc độ chưa đo.

## Repo GitHub đáng tham khảo

| Repo | Giấy phép công bố | Giá trị cho giáo viên | Đánh giá tích hợp |
|---|---|---|---|
| [Udayraj123/OMRChecker](https://github.com/Udayraj123/OMRChecker) | MIT | Template phiếu, cấu hình vùng tô, xử lý ảnh quét/điện thoại bằng Python/OpenCV | Phù hợp thử nghiệm OMR trên máy tính với một mẫu phiếu cố định; không cắm trực tiếp vào web tĩnh. Con số độ chính xác README là tuyên bố tác giả, chưa đo lại |
| [sdaps/sdaps](https://github.com/sdaps/sdaps) | GPL, cần đọc điều khoản từng thành phần khi tái phân phối | Tạo phiếu, nhận dạng và duyệt/sửa thủ công những vùng nhận diện sai | Học quy trình duyệt thủ công và dấu định vị; không chuyển nguyên mã vào bản phân phối này |
| [venisprajapati/vps-auto-grading-software](https://github.com/venisprajapati/vps-auto-grading-software) | Apache-2.0 | Flask/OpenCV, chấm và báo cáo tại máy | Tham khảo tách nhận dạng với bảng điểm; cần backend Python nên để nhánh thử riêng |

Lộ trình hợp lý: chọn một mẫu phiếu, tạo tập ảnh có đáp án gốc được phép dùng, đo lỗi nhận vùng tô/mã đề/điểm riêng, thêm bước duyệt và sửa trước khi chốt điểm. Chỉ sau kiểm chứng mới mở rộng mẫu. Không đưa OMR chưa thử vào bản giao lần này.

## Thư viện bảo mật thực sự kèm bản này

[DOMPurify 3.4.18](https://github.com/cure53/DOMPurify/releases/tag/3.4.18), bản minified ghim tại `assets/vendor/purify-3.4.18.min.js`, giấy phép Apache-2.0 hoặc MPL-2.0 trong `DOMPurify-LICENSE`. Nguồn tải: npm distribution qua jsDelivr; SHA256 `8053ee2a6a09f9d50f7fcd6fb7f07072f52c7f3fa9aa12147cab4feaf65ee970`. Dùng profile HTML, chặn form/handler nguy hiểm; thiếu thư viện thì escape toàn bộ HTML. Đã đọc changelog chính thức và kiểm thử payload SVG/event-handler; không cài/chạy npm lifecycle scripts. Không thêm package manager chỉ cho vendor file. Mỗi lần cập nhật cần đọc advisory/changelog và hồi quy Word/hiển thị công thức.
