# Bộ đề ôn tập kiểm tra định kì LẦN 10

## Bản phát hành

- 4 đề, mã L10-101 đến L10-104; mỗi đề 28 câu, 50 phút.
- Phần I: 18 câu × 0,25 điểm.
- Phần II: 4 câu, mỗi câu 4 ý; đúng 1/2/3/4 ý được 0,10/0,25/0,50/1,00 điểm.
- Phần III: 6 câu × 0,25 điểm. Tổng điểm tối đa: 10.
- Trọng tâm Hóa 12, có câu tích hợp Hóa 10–11. Có câu ứng dụng, dữ kiện không đủ để kết luận, so sánh quy trình và đọc đồ thị.
- 8 hình gốc, sử dụng trong 10 câu. Đồ thị và sơ đồ được vẽ bằng mã, không dùng hình sinh bởi mô hình tạo ảnh.
- 8 tệp Word: 4 đề học sinh, 4 đáp án có hướng dẫn giải. Công thức dùng chỉ số dưới/trên chỉnh sửa được, không dùng ảnh thay công thức.
- 21 đề cũ tiếp tục tạm ẩn; chỉ 4 đề mới được mở công khai.

## Kiểm tra

`qa.json` lưu kết quả kiểm tra cấu trúc, công thức OOXML, audit ngôn ngữ và tính độc lập 24 đáp số phần III bằng Decimal/ROUND_HALF_UP.

`browser-local.json` và `browser-live.json` ghi kiểm thử Chrome: toàn bộ 112 màn câu hỏi, hình, công thức, màn hình 390 px, chế độ tối, tải Word, chấm 10 điểm và các mức điểm phần II. Không gửi kết quả kiểm thử lên Apps Script.

Audit 100/100 là điểm của **bộ lọc ngôn ngữ**, không thay cho thẩm định khoa học. Nội dung cũng được kiểm tra bằng luồng đọc độc lập: 72 câu lựa chọn, 64 mệnh đề đúng/sai và 24 câu trả lời ngắn. Các điểm thiếu giả thiết đã được bổ sung: Cu(II) trong bài mạ đồng, loại trừ tâm nhận proton khác trong bài amino acid và bỏ qua khí chlorine hòa tan khi dùng độ giảm khối lượng dung dịch.

## Nguồn tham khảo và quyền tác giả nội dung

Nội dung được biên soạn lại theo dạng bài trong kho cục bộ `D:\NGAN_HANG_SOL_DE_CAC_NUOC\06_VIETNAM`; không sao chép nguyên văn hoặc lấy lại hình từ nguồn. Số liệu, phương án, tình huống và hình được thiết kế cho bộ đề mới. Mẫu LẦN 9 được dùng để đối chiếu cấu trúc, thời lượng, nguyên tử khối và kiểu trình bày.

Một số nguồn đã đọc đối chiếu trong nhánh `NEOPENTAN/hoi_dap/pages/`:

- `hoi-dap_de-ma-dong-mot-vat-dung-kim-loai-co-tong-dien-tich-be-mat-la-10-cm_c2_b2.html`: lớp mạ, diện tích, khối lượng riêng, dòng điện và hiệu suất.
- `hoi-dap_dien-phan-dung-dich-nacl-co-mang-ban-tham-ngan-giua-anode-voi-cathode.html`: màng ngăn và sản phẩm điện phân.
- `hoi-dap_lap-thiet-bi-thi-nghiem-dien-phan-dung-dich-cuso4-nhu-hinh-ben-duoi.html`: khí điện phân ở nhiều thời điểm.
- `hoi-dap_khi-nghien-cuu-toc-do-phan-ung-len-men-glucose-tao-thanh-ethylic-alcohol.html`: đọc đồ thị lên men và hiệu suất.
- `hoi-dap_cac-polymer-nay-co-the-tai-che-duoc-cac-ki-hieu-nay-thuong-duoc-in-tren-bao-bi.html`: vật liệu polymer, phân loại và tái chế.
- `hoi-dap_diem-dang-dien-pi-la-gia-tri-ph-tai-do-mot-amino-acid-ton-tai-chu-yeu-duoi-dang-ion-luong-cuc.html`: điện di amino acid.
- `DVTIENICH/04_CHUYEN_DE_VA_BAI_TAP_PHAN_LOAI/docx/bai-tap-dien-phan-phan-7.docx`: chia giai đoạn khi đọc đồ thị khí.

## Dựng lại

Nguồn nội dung: `scripts/lan10/content.py`. Không chỉnh riêng JSON hoặc Word rồi bỏ qua nguồn này.

```powershell
# Công cụ Node chỉ dùng khi tạo tệp và kiểm thử, không thêm dependency web.
npm install --prefix "$env:LOCALAPPDATA\Temp\opencode\lan10-tools" --no-audit --no-fund docx@9.5.1 playwright-core@1.56.1
$env:PYTHONIOENCODING = 'utf-8'
python scripts/lan10/build.py
node scripts/lan10/word.cjs
python scripts/lan10/qa.py
python scripts/lan10/catalog.py
node scripts/lan10/browser.cjs
```

`render-word.ps1` mở **chỉ các Word do bộ dựng tạo**, ở chế độ chỉ đọc, bằng một phiên Word automation; xuất PDF để kiểm tra dàn trang, rồi đóng tài liệu đó. Không sửa hay đóng tài liệu người dùng đang mở. Tệp PDF/PNG kiểm tra lưu ngoài repo tại `%LOCALAPPDATA%\Temp\opencode\lan10-render`.

Sau khi xuất PDF:

```powershell
pwsh -NoProfile -File scripts/lan10/render-word.ps1
python scripts/lan10/qa.py --pdf
node scripts/lan10/browser.cjs --live
```

Khi sửa hình mới, giữ `imageWidth`, `imageHeight`, `imageAlt` đồng bộ. Renderer dùng kích thước nội tại để dành chỗ cho hình; CSS sẵn có giữ `max-width: 100%; height: auto` để không tràn điện thoại.
