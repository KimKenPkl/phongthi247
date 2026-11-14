# Android 0.1 — bản thử nghiệm

[Tải phongthi247-trial.apk](../downloads/phongthi247-trial.apk) · package `vn.phongthi247.teacher` · versionCode 1 · Android 8+ (API 26), target API 35.

## Cài thử

1. Tải APK từ repo hoặc website dự án vào điện thoại Android.
2. Mở tệp, cho phép trình duyệt/trình quản lý tệp đó cài ứng dụng khi Android hỏi. Sau khi cài có thể tắt lại quyền cài từ nguồn này.
3. Mở **Phòng Thi 24/7 · Thử nghiệm**, vào **Chấm bài → Chấm thử dữ liệu mẫu**; đối chiếu điểm tối đa 1,5 và quy về 10 là 10.
4. Tạo mẫu, chọn vị trí lưu bằng Android Documents, kiểm tra tệp xuất; nhập lại một CSV/XLSX của mình trên bản sao. Thử Hủy chọn/lưu tệp, in rồi quay lại, chuyển trang và cảnh báo chưa lưu.
5. Để gỡ, dùng Cài đặt Android → Ứng dụng. Tệp đã xuất không bị xóa khi gỡ.

## Đã kiểm chứng và giới hạn

Build thành công với JDK 17, Android SDK 35; `apksigner verify --verbose` xác nhận chữ ký v2/v3; `aapt` xác nhận manifest và launcher. APK không khai báo quyền Internet, camera hoặc lưu trữ. Chưa có thiết bị ADB: **chưa xác nhận cài thành công, WebView, SAF, bàn phím, in/PDF hoặc vòng đời trên thiết bị thật**. Đây không phải bản Play Store hay bản thương mại.

WebView phục vụ tài nguyên đóng gói ở origin HTTPS `appassets.androidplatform.net`, chặn tài nguyên mạng và file URL. Chỉ có công cụ, thư viện frontend và mẫu Word công khai; không kèm ngân hàng đề, hồ sơ học sinh, khóa ký hay add-in Word. Trang chỉ dành cho web được mở bằng trình duyệt ngoài khi người dùng xác nhận, không hoạt động ngoại tuyến trong APK.

Nhập bằng `ACTION_OPEN_DOCUMENT`; xuất bằng `ACTION_CREATE_DOCUMENT`, giới hạn 24 MB mỗi lần, một lần lưu đang chờ. Ghi tệp chạy ở worker thread. Phần sửa đề/rà soát chạy tại thiết bị; điểm chưa xuất chỉ ở bộ nhớ trang và có thể mất nếu hệ điều hành đóng ứng dụng. Không quảng cáo khả năng khôi phục sau khi bị kill, xoay màn hình trên mọi máy hoặc lưu trữ tự động. Print adapter gửi `afterprint` khi hoàn tất/hủy để xóa bản in ẩn; cần xác nhận tiếp trên Android thật.

## Build lại trên Windows

```powershell
pwsh -NoProfile -File scripts/build-android.ps1
```

Tools mặc định ở `%LOCALAPPDATA%\PhongThi247\AndroidBuild`: `jdk\<jdk-17>`, `sdk\build-tools\35.0.0`, `sdk\platforms\android-35`. Script không tự cài SDK và không tải dependency lúc build. Thư mục build và khóa thử nghiệm `teacher-trial.p12` nằm ngoài repo. Khóa dùng mật khẩu thử nghiệm, không dùng cho phát hành thương mại; giữ nguyên key nếu muốn cập nhật đè bản đã cài. Mất key phải gỡ bản cũ rồi cài mới.

SHA256 của APK hiện được ghi trong [phongthi247-trial.sha256](../downloads/phongthi247-trial.sha256). Build lại có thể thay checksum; luôn cập nhật checksum và chạy lại kiểm thử trước khi phát hành.
