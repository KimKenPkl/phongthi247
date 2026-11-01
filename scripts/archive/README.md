# scripts/archive

Các script dùng **một lần** khi nhập đề cương GK1 năm 2026–2027 (Toán, Hóa 11, Hóa 12, Sinh, Tiếng Anh, Văn...).
Giữ lại để tham khảo cách đã làm, **không cần chạy** khi vận hành bình thường.

Lưu ý: các file này được viết cho đúng file Word gốc của từng môn, và nhiều file
ghi cứng đường dẫn `D:\...`. Muốn dùng lại phải đọc code và sửa đường dẫn trước.

Công cụ đang dùng nằm ở thư mục cha `scripts/`:

| File | Dùng để |
|---|---|
| `kiemtra.py` | Kiểm tra toàn bộ dữ liệu đề trước khi push (bắt buộc) |
| `bump_version.py` | Tăng số `?v=` để học sinh nhận bản CSS/JS mới |
| `audit_decuong.py` | Rà nội dung đề (trùng câu, lỗi chính tả hay gặp), xuất báo cáo vào `reports/` |
| `import_neopentan.py` | Nhập ngân hàng câu hỏi Neopentan vào `data/bank/` |
| `dump_docx.py` | In chữ trong file Word ra màn hình để đối chiếu |
| `_wmf2png.ps1` | Đổi ảnh WMF/EMF trong file Word sang PNG |
