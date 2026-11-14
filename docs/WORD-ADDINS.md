# Word: kiểm tra add-in và khôi phục

Đã khảo sát tệp/cấu hình add-in cài trên máy, không chạy macro để sao chép chức năng. Một cấu hình có thể nạp nhiều template trùng, hoặc VSTO trỏ đến tệp không còn tồn tại. Điều này là dấu hiệu cần kiểm tra; **chưa mở lại Word để xác nhận lỗi ban đầu đã hết**.

Script `scripts/word-addin-profile.ps1` có ba chế độ. Mặc định Audit chỉ liệt kê tệp và hash:

```powershell
pwsh -NoProfile -File scripts/word-addin-profile.ps1 -Mode Audit
```

Apply yêu cầu đóng Word bình thường, sao lưu và kiểm tra hash trước khi đổi tên template cũ/trùng đã nhận diện; chỉ tắt `TracNghiem_2025` khi manifest trỏ đến tệp không tồn tại. URL `file:` được giải mã bằng `System.Uri.LocalPath`, kể cả dấu cách và Unicode. Không thực thi add-in, chỉnh VBA hay xóa bản gốc.

```powershell
pwsh -NoProfile -File scripts/word-addin-profile.ps1 -Mode Apply
```

Máy đang làm việc đã chạy Apply ở phiên trước; có backup tại `%LOCALAPPDATA%\PhongThi247\WordAddinBackup\20261115-004331-328\state.json`. Không chạy Apply lặp lại chỉ để kiểm thử. Khởi động Word và thử chính tài liệu gặp lỗi để xác nhận. Nếu cần trả cấu hình:

```powershell
pwsh -NoProfile -File scripts/word-addin-profile.ps1 -Mode Restore -BackupPath "$env:LOCALAPPDATA\PhongThi247\WordAddinBackup\20261115-004331-328"
```

Restore kiểm tra thư mục backup, state và hash; không ép đóng Word hay ghi đè tệp nguồn đang khác. Lưu tài liệu và đóng Word trước khi dùng. Template, binary của nhà cung cấp, license và bản sao lưu cá nhân không nằm trong repo/APK.
