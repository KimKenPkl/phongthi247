# Bộ đề ôn tập kiểm tra định kì LẦN 10

## Bản phát hành

- 5 đề, mã L10-101 đến L10-105. Mỗi đề có 28 câu, làm trong 50 phút.
- Phần I: 18 câu × 0,25 điểm.
- Phần II: 4 câu, mỗi câu 4 ý; đúng 1/2/3/4 ý được 0,10/0,25/0,50/1,00 điểm.
- Phần III: 6 câu × 0,25 điểm. Tổng điểm tối đa: 10.
- Trọng tâm điện phân, có câu tích hợp Hóa 10–11. Các bài ứng dụng gồm mạ huy chương, phân tích số liệu điện phân, pin nhiên liệu, dung lượng pin lithium-ion và sản xuất polymer.
- 13 tệp hình gốc dùng trong 16 câu. Dữ liệu từng câu ghi nguồn, số câu, kích thước và SHA-256 của ảnh.
- Đề L10-101, Phần II câu 2, có bài điện phân vàng hồng 10K biên tập từ mã 049 của Sở GDĐT Hà Nội năm 2025. Khối lượng thanh đồng sau điện phân được điều chỉnh để phù hợp với giả thiết chỉ đồng tham gia phản ứng điện cực.
- Đề L10-105 tăng độ khó với bài toán điện phân qua nhiều giai đoạn, chuẩn độ có mẫu trắng, tái chế PET và phân tích hiệu suất thu hồi.
- Có 5 đề học sinh và 5 bản hướng dẫn giải ở mỗi định dạng Word và PDF A4. Công thức trong Word dùng chỉ số dưới và chỉ số trên, chỉnh sửa được.
- Danh mục công khai có 5 đề LẦN 10. 21 đề cũ vẫn tạm ẩn.

## Kiểm tra

`qa.json` lưu kết quả kiểm tra cấu trúc, công thức OOXML, kiểm định ngôn ngữ và đối chiếu độc lập 30 đáp số phần III bằng Decimal/ROUND_HALF_UP.

`browser-local.json` và `browser-live.json` ghi kết quả kiểm thử Chrome trên 140 màn câu hỏi, gồm hình, công thức, hiển thị ở 390 px và chế độ tối. Kiểm thử đối chiếu tệp Word và PDF, tải PDF bằng bàn phím, điểm tối đa và các mức điểm phần II. Việc ghi điểm lên Google Sheet cần được kiểm tra riêng.

Các bài dùng hình được đối chiếu với tài liệu nguồn. Các giả thiết được làm rõ khi biên tập gồm hình dạng huy chương sau khi mạ, điều kiện phóng điện tuần tự và dung lượng lí thuyết của pin. `qa.py` kiểm tra đáp số và đối chiếu ảnh nhúng trong tệp Word với ảnh trên web.

## Nguồn câu hỏi và hình

Các hình được trích từ đề hoặc ảnh lưu kèm đề trong `D:\NGAN_HANG_SOL_DE_CAC_NUOC\06_VIETNAM`, giữ nguyên tệp PNG và watermark sẵn có. Xem `sourceFigure` trong dữ liệu đề để tra tệp và câu nguồn. Câu dẫn, giả thiết và phương án được biên tập cho bộ đề. Mẫu LẦN 9 được dùng để đối chiếu cấu trúc, thời lượng, nguyên tử khối và kiểu trình bày.

Một số nguồn đã đọc đối chiếu trong nhánh `NEOPENTAN/hoi_dap/pages/`:

- `hoi-dap_de-ma-dong-mot-vat-dung-kim-loai-co-tong-dien-tich-be-mat-la-10-cm_c2_b2.html`: lớp mạ, diện tích, khối lượng riêng, dòng điện và hiệu suất.
- `hoi-dap_dien-phan-dung-dich-nacl-co-mang-ban-tham-ngan-giua-anode-voi-cathode.html`: màng ngăn và sản phẩm điện phân.
- `hoi-dap_lap-thiet-bi-thi-nghiem-dien-phan-dung-dich-cuso4-nhu-hinh-ben-duoi.html`: khí điện phân ở nhiều thời điểm.
- `hoi-dap_khi-nghien-cuu-toc-do-phan-ung-len-men-glucose-tao-thanh-ethylic-alcohol.html`: đọc đồ thị lên men và hiệu suất.
- `hoi-dap_cac-polymer-nay-co-the-tai-che-duoc-cac-ki-hieu-nay-thuong-duoc-in-tren-bao-bi.html`: vật liệu polymer, phân loại và tái chế.
- `hoi-dap_diem-dang-dien-pi-la-gia-tri-ph-tai-do-mot-amino-acid-ton-tai-chu-yeu-duoi-dang-ion-luong-cuc.html`: điện di amino acid.
- `DVTIENICH/04_CHUYEN_DE_VA_BAI_TAP_PHAN_LOAI/docx/bai-tap-dien-phan-phan-7.docx`: chia giai đoạn khi đọc đồ thị khí.

## Dựng lại

`scripts/lan10/content.py` tập hợp nội dung đề. `hard_mc.py` và `hard_paper.py` chứa câu hỏi Đề 5. `revision.py` gắn hình gốc và ghi nguồn.

```powershell
# Công cụ Node chỉ dùng khi tạo tệp và kiểm thử, không thêm dependency web.
npm install --prefix "$env:LOCALAPPDATA\Temp\opencode\lan10-tools" --no-audit --no-fund docx@9.5.1 playwright-core@1.56.1
$env:PYTHONIOENCODING = 'utf-8'
python scripts/lan10/build.py
node scripts/lan10/word.cjs
python scripts/lan10/qa.py
python scripts/lan10/catalog.py
node scripts/build_exam_registry.cjs
```

`render-word.ps1` mở **chỉ các Word do bộ dựng tạo**, ở chế độ chỉ đọc, bằng một phiên Word automation; xuất PDF để kiểm tra dàn trang, rồi đóng tài liệu đó. Không sửa hay đóng tài liệu người dùng đang mở. Tệp PDF/PNG kiểm tra lưu ngoài repo tại `%LOCALAPPDATA%\Temp\opencode\lan10-render`.

Sau khi xuất PDF, kiểm tra mã đề, khổ trang, bố cục và số hình. Chép các PDF đã kiểm tra vào `data/docs` để xuất bản cùng bản Word. Kiểm thử cục bộ trước khi push. Chạy lại với `--live` sau khi GitHub Pages triển khai.

```powershell
pwsh -NoProfile -File scripts/lan10/render-word.ps1
python scripts/lan10/qa.py --pdf
# Chép các bản in đã kiểm tra vào data/docs trước khi chạy Chrome.
node scripts/lan10/browser.cjs
```

Khi sửa hình mới, giữ `imageWidth`, `imageHeight`, `imageAlt` đồng bộ. Renderer dùng kích thước nội tại để dành chỗ cho hình; CSS sẵn có giữ `max-width: 100%; height: auto` để không tràn điện thoại.
