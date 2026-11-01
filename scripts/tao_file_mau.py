# -*- coding: utf-8 -*-
"""Tạo file Word mẫu cho trang Trộn đề (assets/mau/mau-<môn>.docx).

Cấu trúc theo đề minh họa TN THPT từ năm 2025 (CT GDPT 2018). Mỗi file chỉ có vài câu ví dụ
cho từng phần để thầy cô thay bằng câu của mình. Câu hỏi do Phong Thi 24/7 tự soạn.

Chạy:  python scripts/tao_file_mau.py
Cần:   pip install python-docx
Kèm theo: ghi đáp án mong đợi ra assets/mau/_dap_an_mau.json để test bộ đọc Word.
"""
import json
import os
import re

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'mau')
RED = RGBColor(0xC0, 0x00, 0x00)
GRAY = RGBColor(0x59, 0x59, 0x59)

# Cú pháp trong dữ liệu: {_2} chỉ số dưới, {^2+} chỉ số trên.
TOKEN = re.compile(r'\{([_^])([^}]*)\}')


def rich(p, text, bold=False, italic=False, red=False, under=False, color=None):
    pos = 0
    for m in list(TOKEN.finditer(text)) + [None]:
        chunk = text[pos:m.start()] if m else text[pos:]
        parts = [(chunk, None)]
        if m:
            parts.append((m.group(2), m.group(1)))
        for t, kind in parts:
            if not t:
                continue
            r = p.add_run(t)
            r.bold, r.italic = bold, italic
            if red:
                r.font.color.rgb = RED
            elif color is not None:
                r.font.color.rgb = color
            if under:
                r.underline = True
            if kind == '_':
                r.font.subscript = True
            elif kind == '^':
                r.font.superscript = True
        if not m:
            break
        pos = m.end()
    return p


def para(doc, text='', align=None, **kw):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    if align:
        p.alignment = align
    if text:
        rich(p, text, **kw)
    return p


def no_borders(tbl):
    tblPr = tbl._tbl.tblPr
    b = OxmlElement('w:tblBorders')
    for side in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        e = OxmlElement('w:' + side)
        e.set(qn('w:val'), 'nil')
        b.append(e)
    tblPr.append(b)


def shade(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    s = OxmlElement('w:shd')
    s.set(qn('w:val'), 'clear')
    s.set(qn('w:color'), 'auto')
    s.set(qn('w:fill'), fill)
    tcPr.append(s)


def cell_lines(cell, lines):
    cell.paragraphs[0].text = ''
    for k, (t, kw) in enumerate(lines):
        p = cell.paragraphs[0] if k == 0 else cell.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(0)
        rich(p, t, **kw)


HUONG_DAN = [
    'HƯỚNG DẪN SOẠN THEO MẪU (xóa khung này trước khi in):',
    '• Mỗi câu bắt đầu bằng "Câu 1.", "Câu 2."… Mỗi phần bắt đầu bằng dòng "PHẦN I", "PHẦN II", "PHẦN III".',
    '• Ở Phần I: mỗi phương án A. B. C. D. một dòng; phương án đúng tô đỏ hoặc gạch chân. Ghi "#D." để phương án D đứng yên khi trộn.',
    '• Ở Phần II: ý đúng tô đỏ hoặc gạch chân, ý sai để màu đen.',
    '• Ở Phần III: ghi đáp số trên dòng riêng ngay dưới câu hỏi, dạng "A. 2,48" (tối đa 4 ký tự).',
    '• Câu dùng chung đoạn dẫn: đặt dòng <g> trước và </g> sau nhóm câu để nhóm luôn đi liền nhau.',
    '• Hình chèn kiểu In Line with Text. Công thức gõ bằng Equation của Word (Alt + =), không dùng MathType.',
    '• Soạn xong: lưu .docx, mở trang Trộn đề của Phong Thi 24/7 và tải file lên.',
]
HUONG_DAN_ANH = [
    'HƯỚNG DẪN SOẠN THEO MẪU (xóa khung này trước khi in):',
    '• Mỗi câu bắt đầu bằng "Question 1.", "Question 2."… Mỗi phương án A. B. C. D. một dòng.',
    '• Phương án đúng tô đỏ hoặc gạch chân. Ghi "#D." để phương án D đứng yên khi trộn.',
    '• Bài đọc dùng chung cho nhiều câu: đặt dòng <g> trước bài đọc và </g> sau câu cuối của nhóm.',
    '• Soạn xong: lưu .docx, mở trang Trộn đề của Phong Thi 24/7 và tải file lên.',
]

HEAD = {
    1: 'PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn. Thí sinh trả lời từ câu 1 đến câu {n}. Mỗi câu hỏi thí sinh chỉ chọn một phương án.',
    2: 'PHẦN II. Câu trắc nghiệm đúng sai. Thí sinh trả lời từ câu 1 đến câu {n}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.',
    3: 'PHẦN III. Câu trắc nghiệm trả lời ngắn. Thí sinh trả lời từ câu 1 đến câu {n}.',
}

# ---------- Dữ liệu mẫu ----------
# p1: (câu dẫn, [A, B, C, D], chỉ số đúng, 'red'|'under', chỉ số cố định hoặc None)
# p2: (câu dẫn, [a, b, c, d], 'ĐSĐS')   ý đúng tô đỏ (hoặc gạch chân nếu p2mark='under')
# p3: (câu dẫn, đáp số, lời giải hoặc '')
# grp: (đoạn dẫn, [câu kiểu p1]) – nhóm câu dùng chung đoạn dẫn, bọc bằng <g> … </g>
SUBJECTS = [
  dict(slug='hoa-hoc', mon='HÓA HỌC', time=50, n=(18, 4, 6),
       extra='Cho biết nguyên tử khối: H = 1; C = 12; O = 16; Mg = 24; Cl = 35,5.',
       p1=[('Chất nào sau đây là chất điện li mạnh?', ['C{_2}H{_5}OH.', 'NaCl.', 'C{_12}H{_22}O{_11}.', 'CH{_3}COOH.'], 1, 'red', None),
           ('Công thức của ethyl acetate là', ['HCOOC{_2}H{_5}.', 'CH{_3}COOCH{_3}.', 'CH{_3}COOC{_2}H{_5}.', 'C{_2}H{_5}COOCH{_3}.'], 2, 'under', None),
           ('Trong các kim loại sau, kim loại có tính khử mạnh nhất là', ['Mg.', 'Fe.', 'Cu.', 'Ag.'], 0, 'red', None)],
       p2=[('Tiến hành thí nghiệm điều chế ester theo các bước sau:\nBước 1: Cho 2 mL ethanol, 2 mL acetic acid và vài giọt dung dịch H{_2}SO{_4} đặc vào ống nghiệm khô.\nBước 2: Lắc đều, đun cách thủy ống nghiệm ở 65 – 70 °C trong khoảng 5 phút.\nBước 3: Làm lạnh rồi rót thêm 2 mL dung dịch NaCl bão hòa vào ống nghiệm.',
            ['H{_2}SO{_4} đặc đóng vai trò chất xúc tác cho phản ứng ester hóa.', 'Sau bước 3, chất lỏng trong ống nghiệm đồng nhất, không phân lớp.', 'Dung dịch NaCl bão hòa giúp lớp ester tách ra rõ hơn.', 'Sản phẩm hữu cơ thu được là methyl acetate.'], 'ĐSĐS'),
           ('Một pin điện hóa được ghép từ điện cực Zn nhúng trong dung dịch ZnSO{_4} 1 M và điện cực Cu nhúng trong dung dịch CuSO{_4} 1 M. Biết thế điện cực chuẩn của cặp Zn{^2+}/Zn là −0,76 V và của cặp Cu{^2+}/Cu là +0,34 V.',
            ['Ở anode, Zn bị oxi hóa thành Zn{^2+}.', 'Sức điện động chuẩn của pin là 0,42 V.', 'Ở mạch ngoài, electron di chuyển từ điện cực Zn sang điện cực Cu.', 'Trong quá trình pin hoạt động, khối lượng điện cực Cu giảm dần.'], 'ĐSĐS')],
       p3=[('Hòa tan hoàn toàn 0,1 mol Mg trong dung dịch HCl dư, thu được V lít khí H{_2} ở điều kiện chuẩn (1 mol khí chiếm 24,79 lít). Giá trị của V là bao nhiêu? (Làm tròn kết quả đến hàng phần trăm.)', '2,48', 'Mg + 2HCl → MgCl{_2} + H{_2}; số mol H{_2} bằng 0,1 mol nên V = 0,1 × 24,79 ≈ 2,48.'),
           ('Đốt cháy hoàn toàn 0,1 mol ethanol cần vừa đủ V lít khí O{_2} ở điều kiện chuẩn (1 mol khí chiếm 24,79 lít). Giá trị của V là bao nhiêu? (Làm tròn kết quả đến hàng phần trăm.)', '7,44', ''),
           ('Cho các chất: glucose, saccharose, tinh bột, cellulose, fructose. Có bao nhiêu chất thuộc loại polysaccharide?', '2', '')]),
  dict(slug='toan', mon='TOÁN', time=90, n=(12, 4, 6), p2mark='under',
       p1=[('Nghiệm của phương trình 2{^x} = 8 là', ['x = 2.', 'x = 3.', 'x = 4.', 'x = 6.'], 1, 'red', None),
           ('Cho cấp số cộng (u{_n}) có u{_1} = 2 và công sai d = 3. Giá trị của u{_5} là', ['11.', '12.', '14.', '17.'], 2, 'under', None),
           ('Đạo hàm của hàm số y = x{^3} − 3x là', ["y' = x{^2} − 3.", "y' = 3x{^2}.", "y' = 3x − 3.", "y' = 3x{^2} − 3."], 3, 'red', None)],
       p2=[('Cho hàm số f(x) = x{^3} − 3x + 1.', ["f'(x) = 3x{^2} − 3.", 'Hàm số đồng biến trên khoảng (1; +∞).', 'Giá trị cực đại của hàm số bằng −1.', 'f(0) = 1.'], 'ĐĐSĐ'),
           ('Một hộp có 4 quả bóng đỏ và 6 quả bóng xanh. Lấy ngẫu nhiên đồng thời 2 quả bóng.', ['Số cách lấy là 45.', 'Xác suất lấy được 2 quả bóng đỏ là 1/5.', 'Xác suất lấy được 2 quả bóng cùng màu là 1/3.', 'Xác suất lấy được ít nhất 1 quả bóng xanh là 13/15.'], 'ĐSSĐ')],
       p3=[('Tính tích phân của hàm số f(x) = 2x + 1 trên đoạn [0; 2].', '6', ''),
           ('Trong không gian Oxyz, tính khoảng cách từ điểm M(1; 2; 3) đến mặt phẳng (P): x + 2y + 2z − 2 = 0.', '3', ''),
           ('Một xạ thủ bắn 2 viên đạn độc lập vào bia, xác suất trúng bia của mỗi viên là 0,8. Tính xác suất cả 2 viên đều trúng bia.', '0,64', '')]),
  dict(slug='vat-li', mon='VẬT LÍ', time=50, n=(18, 4, 6),
       p1=[('Ở áp suất tiêu chuẩn, nước sôi ở 100 °C. Nhiệt độ này trong thang Kelvin là', ['273 K.', '373 K.', '100 K.', '212 K.'], 1, 'red', None),
           ('Đơn vị đo cảm ứng từ là', ['tesla (T).', 'weber (Wb).', 'henry (H).', 'vôn (V).'], 0, 'under', None),
           ('Hạt nhân {^14}{_6}C có số neutron là', ['6.', '14.', '20.', '8.'], 3, 'red', None)],
       p2=[('Một lượng khí lí tưởng ở 27 °C có thể tích 4 lít và áp suất 1 atm.', ['Nén đẳng nhiệt đến thể tích 2 lít thì áp suất khí là 2 atm.', 'Trong quá trình đẳng nhiệt, tích pV không đổi.', 'Sau khi nén, giữ thể tích 2 lít và nung nóng đến 127 °C thì áp suất khí là 4 atm.', 'Trong quá trình đẳng tích, áp suất tỉ lệ thuận với nhiệt độ tuyệt đối.'], 'ĐĐSĐ'),
           ('Một đoạn dây dẫn thẳng dài 20 cm mang dòng điện 5 A, đặt vuông góc với các đường sức của từ trường đều có cảm ứng từ 0,1 T.', ['Lực từ tác dụng lên đoạn dây có độ lớn 0,1 N.', 'Tăng cường độ dòng điện lên gấp đôi thì lực từ tăng gấp đôi.', 'Đặt đoạn dây song song với đường sức từ thì lực từ có độ lớn lớn nhất.', 'Giảm chiều dài đoạn dây còn 10 cm thì lực từ có độ lớn 0,2 N.'], 'ĐĐSS')],
       p3=[('Biết nhiệt dung riêng của nước là 4200 J/(kg.K). Nhiệt lượng cần cung cấp để 2 kg nước tăng từ 20 °C lên 30 °C là bao nhiêu kJ?', '84', ''),
           ('Một chất phóng xạ có chu kì bán rã 8 ngày. Sau 24 ngày, lượng chất còn lại bằng bao nhiêu phần trăm lượng ban đầu?', '12,5', '')]),
  dict(slug='sinh-hoc', mon='SINH HỌC', time=50, n=(18, 4, 6),
       p1=[('Enzyme tham gia trực tiếp vào quá trình phiên mã là', ['DNA polymerase.', 'RNA polymerase.', 'ligase.', 'restrictase.'], 1, 'red', None),
           ('Bộ ba nào sau đây trên mRNA là bộ ba kết thúc?', ['UAA.', 'AUG.', 'UUU.', 'GGG.'], 0, 'under', None),
           ('Kiểu gene nào sau đây dị hợp về 2 cặp gene?', ['AABB.', 'aabb.', 'AAbb.', 'AaBb.'], 3, 'red', None)],
       p2=[('Ở đậu Hà Lan, allele A quy định hạt vàng trội hoàn toàn so với allele a quy định hạt xanh. Cho cây Aa tự thụ phấn, thu được F{_1}.', ['F{_1} có 3 loại kiểu gene.', 'Tỉ lệ kiểu hình ở F{_1} là 3 hạt vàng : 1 hạt xanh.', 'Trong số cây hạt vàng ở F{_1}, cây đồng hợp chiếm tỉ lệ 1/2.', 'Cây hạt xanh ở F{_1} có kiểu gene aa.'], 'ĐĐSĐ'),
           ('Một phân tử DNA có tổng số 3000 nucleotide, trong đó số nucleotide loại A là 600.', ['Số nucleotide loại T là 600.', 'Số nucleotide loại G là 900.', 'Tổng số liên kết hydrogen của phân tử là 3600.', 'Chiều dài của phân tử là 1020 nm.'], 'ĐĐSS')],
       p3=[('Một gene có tổng số 3000 nucleotide. Gene này có bao nhiêu chu kì xoắn?', '150', ''),
           ('Cho phép lai AaBb × AaBb, các gene phân li độc lập. Đời con có tối đa bao nhiêu loại kiểu gene?', '9', '')]),
  dict(slug='dia-li', mon='ĐỊA LÍ', time=50, n=(18, 4, 6),
       p1=[('Việt Nam nằm ở phía đông của bán đảo', ['Đông Dương.', 'Mã Lai.', 'Triều Tiên.', 'Ấn Độ.'], 0, 'red', None),
           ('Sông nào sau đây bồi đắp phù sa chủ yếu cho Đồng bằng sông Cửu Long?', ['Sông Hồng.', 'Sông Đồng Nai.', 'Sông Mê Công.', 'Sông Thái Bình.'], 2, 'under', None),
           ('Gió mùa Đông Bắc ảnh hưởng mạnh nhất đến vùng nào của nước ta?', ['Tây Nguyên.', 'Nam Bộ.', 'Duyên hải Nam Trung Bộ.', 'Miền Bắc.'], 3, 'red', None)],
       p2=[('Cho bảng số liệu: nhiệt độ trung bình tháng 1 và tháng 7 của Hà Nội lần lượt là 16,4 °C và 28,9 °C; của TP. Hồ Chí Minh lần lượt là 25,8 °C và 27,1 °C.', ['Biên độ nhiệt giữa tháng 7 và tháng 1 của Hà Nội lớn hơn TP. Hồ Chí Minh.', 'Nhiệt độ tháng 1 của TP. Hồ Chí Minh cao hơn Hà Nội 9,4 °C.', 'Nhiệt độ tháng 7 của TP. Hồ Chí Minh cao hơn Hà Nội.', 'Mùa đông lạnh ở Hà Nội chủ yếu do tác động của gió mùa Đông Bắc.'], 'ĐĐSĐ'),
           ('Khí hậu Việt Nam mang tính chất nhiệt đới ẩm gió mùa.', ['Nước ta có khí hậu nhiệt đới ẩm gió mùa.', 'Nhiệt độ trung bình năm trên cả nước đều dưới 15 °C.', 'Lượng mưa lớn tạo điều kiện cho sinh vật phát triển quanh năm.', 'Khí hậu đồng nhất trên toàn lãnh thổ.'], 'ĐSĐS')],
       p3=[('Nhiệt độ trung bình tháng 1 của Hà Nội là 16,4 °C, tháng 7 là 28,9 °C. Tính biên độ nhiệt giữa hai tháng này (đơn vị: °C).', '12,5', ''),
           ('Một tỉnh có diện tích 15 000 km{^2} và dân số 2 250 000 người. Tính mật độ dân số của tỉnh (đơn vị: người/km{^2}).', '150', '')]),
  dict(slug='lich-su', mon='LỊCH SỬ', time=50, n=(24, 4, 0),
       p1=[('Tổ chức Liên hợp quốc được thành lập vào năm nào?', ['1939.', '1941.', '1945.', '1949.'], 2, 'red', None),
           ('Hiệp hội các quốc gia Đông Nam Á (ASEAN) được thành lập vào năm', ['1945.', '1967.', '1975.', '1995.'], 1, 'under', None),
           ('Chiến thắng nào buộc thực dân Pháp phải kí Hiệp định Giơ-ne-vơ năm 1954?', ['Điện Biên Phủ.', 'Việt Bắc.', 'Biên giới.', 'Hòa Bình.'], 0, 'red', None)],
       p2=[('Ngày 8-8-1967, Hiệp hội các quốc gia Đông Nam Á (ASEAN) được thành lập.', ['ASEAN được thành lập tại Băng Cốc (Thái Lan).', 'Việt Nam là một trong 5 nước sáng lập ASEAN.', 'Việt Nam gia nhập ASEAN năm 1995.', 'Lào là một trong các nước sáng lập ASEAN.'], 'ĐSĐS'),
           ('Ngày 2-9-1945, Chủ tịch Hồ Chí Minh đọc bản Tuyên ngôn Độc lập.', ['Sự kiện diễn ra tại Quảng trường Ba Đình, Hà Nội.', 'Bản Tuyên ngôn khai sinh nước Việt Nam Dân chủ Cộng hòa.', 'Sự kiện diễn ra vào năm 1954.', 'Sự kiện diễn ra sau thắng lợi của Cách mạng tháng Tám.'], 'ĐĐSĐ')],
       p3=[]),
  dict(slug='gdktpl', mon='GIÁO DỤC KINH TẾ VÀ PHÁP LUẬT', time=50, n=(24, 4, 0),
       p1=[('Thuế thu nhập cá nhân thuộc loại thuế nào sau đây?', ['Thuế gián thu.', 'Thuế trực thu.', 'Thuế tiêu thụ đặc biệt.', 'Thuế xuất khẩu.'], 1, 'red', None),
           ('Lạm phát là tình trạng mức giá chung của nền kinh tế', ['giảm liên tục trong một thời gian.', 'đứng yên trong một thời gian.', 'tăng liên tục trong một thời gian.', 'biến động trong một ngày.'], 2, 'under', None),
           ('Theo Hiến pháp năm 2013, công dân có quyền nào sau đây?', ['Bầu cử và ứng cử.', 'Tự do kinh doanh.', 'Tự do ngôn luận.', 'Cả A, B và C.'], 3, 'red', 3)],
       p2=[('Anh K đăng kí kinh doanh cửa hàng tạp hóa và nộp thuế đầy đủ. Để tăng thu nhập, anh K bán thêm thuốc lá nhập lậu.', ['Việc anh K đăng kí kinh doanh là thực hiện quyền tự do kinh doanh.', 'Anh K đã thực hiện nghĩa vụ nộp thuế.', 'Có giấy phép kinh doanh thì anh K được bán mọi loại hàng hóa.', 'Việc bán thuốc lá nhập lậu là vi phạm pháp luật.'], 'ĐĐSĐ'),
           ('Chị M ghi chép thu chi hằng tháng và để dành 20% thu nhập.', ['Chị M đang lập kế hoạch tài chính cá nhân.', 'Chỉ người có thu nhập cao mới cần lập kế hoạch tài chính.', 'Khoản tiết kiệm giúp chị M ứng phó với chi tiêu bất ngờ.', 'Ghi chép thu chi giúp kiểm soát chi tiêu.'], 'ĐSĐĐ')],
       p3=[]),
  dict(slug='tin-hoc', mon='TIN HỌC', time=50, n=(24, 4, 0),
       p1=[('1 KB bằng bao nhiêu byte?', ['1000 byte.', '100 byte.', '512 byte.', '1024 byte.'], 3, 'red', None),
           ('Trong Python, biểu thức 2 ** 3 có giá trị là', ['8.', '6.', '9.', '5.'], 0, 'under', None),
           ('Thiết bị nào sau đây dùng để chuyển gói tin giữa các mạng khác nhau?', ['Switch.', 'Router.', 'Hub.', 'Modem.'], 1, 'red', None)],
       p2=[('Trong Python, cho x = 7 và y = x // 2 + x % 2.', ['x // 2 có giá trị là 3.', 'x % 2 có giá trị là 0.', 'y có giá trị là 4.', 'Biến y có kiểu số thực (float).'], 'ĐSĐS'),
           ('Bạn H nhận được email báo trúng thưởng, yêu cầu bấm vào đường link để đăng nhập tài khoản ngân hàng.', ['Đây có thể là hình thức lừa đảo trực tuyến.', 'H nên bấm vào link và đăng nhập ngay để nhận thưởng.', 'H nên kiểm tra kĩ địa chỉ người gửi.', 'Xác thực hai lớp giúp tài khoản an toàn hơn.'], 'ĐSĐĐ')],
       p3=[]),
  dict(slug='cong-nghe', mon='CÔNG NGHỆ', time=50, n=(24, 4, 0),
       p1=[('Đơn vị đo điện trở là', ['vôn.', 'ampe.', 'ôm.', 'oát.'], 2, 'red', None),
           ('Trong mạch điện ba pha nối hình sao cân bằng, điện áp dây U{_d} và điện áp pha U{_p} có quan hệ', ['U{_d} = U{_p}.', 'U{_d} = √3U{_p}.', 'U{_d} = 3U{_p}.', 'U{_p} = √3U{_d}.'], 1, 'under', None),
           ('Linh kiện nào sau đây chỉ cho dòng điện đi qua theo một chiều?', ['Điện trở.', 'Tụ điện.', 'Cuộn cảm.', 'Diode.'], 3, 'red', None)],
       p2=[('Một bóng đèn ghi 220 V – 100 W được mắc vào mạng điện 220 V.', ['Đèn sáng bình thường.', 'Điện trở của đèn là 22 Ω.', 'Cường độ dòng điện qua đèn khoảng 0,45 A.', 'Điện năng đèn tiêu thụ trong 10 giờ là 1 kWh.'], 'ĐSĐĐ'),
           ('Hệ thống điện quốc gia gồm nguồn điện, lưới điện và các hộ tiêu thụ điện.', ['Nhà máy thủy điện thuộc nguồn điện.', 'Lưới điện truyền tải có điện áp thấp hơn lưới điện phân phối.', 'Trạm biến áp thuộc lưới điện.', 'Hộ gia đình là hộ tiêu thụ điện.'], 'ĐSĐĐ')],
       p3=[]),
]

ANH = dict(slug='tieng-anh', mon='TIẾNG ANH', time=50, n=(40, 0, 0),
    p1=[('My family ______ in this city since 2015.', ['live', 'has lived', 'is living', 'lived'], 1, 'red', None),
        ('If I ______ more free time, I would learn to play the guitar.', ['had', 'have', 'will have', 'am having'], 0, 'under', None),
        ('Choose the word whose underlined part differs from the other three in pronunciation: c(a)t, h(a)t, m(a)p, c(a)ke.', ['cat', 'hat', 'map', 'cake'], 3, 'red', None)],
    grp=('Read the passage and choose the correct answer for each blank.\nLast summer, our class joined a volunteer project at a village school. We helped the teachers (1) ______ the classrooms and painted the walls. The students became (2) ______ confident each day.',
         [('Blank (1):', ['clean', 'cleaning', 'cleaned', 'to cleaning'], 0, 'red', None),
          ('Blank (2):', ['much', 'more', 'most', 'many'], 1, 'red', None)]))


# ---------- Dựng file ----------
def build(s, english=False):
    doc = Document()
    st = doc.styles['Normal']
    st.font.name = 'Times New Roman'
    st.font.size = Pt(12)
    st.element.rPr.rFonts.set(qn('w:eastAsia'), 'Times New Roman')
    n1, n2, n3 = s['n']
    tot = n1 + n2 + n3
    t = doc.add_table(rows=1, cols=2)
    no_borders(t)
    cell_lines(t.rows[0].cells[0], [('SỞ GIÁO DỤC VÀ ĐÀO TẠO ……', {}), ('TRƯỜNG ……', dict(bold=True)), ('(Đề thi có … trang)', dict(italic=True))])
    cell_lines(t.rows[0].cells[1], [('KỲ THI …… NĂM HỌC 20… – 20…', dict(bold=True)), ('Môn: ' + s['mon'], dict(bold=True)),
                                    (f"Thời gian làm bài: {s['time']} phút, không kể thời gian phát đề", dict(italic=True)),
                                    (f'(Cấu trúc đề thật: {tot} câu)', dict(italic=True))])
    para(doc, 'Họ, tên thí sinh: ………………………………………   Số báo danh: …………')
    if s.get('extra'):
        para(doc, s['extra'], italic=True)
    box = doc.add_table(rows=1, cols=1)
    box.style = 'Table Grid'
    c = box.rows[0].cells[0]
    shade(c, 'FFF6D5')
    for k, line in enumerate(HUONG_DAN_ANH if english else HUONG_DAN):
        p = c.paragraphs[0] if k == 0 else c.add_paragraph()
        p.paragraph_format.space_after = Pt(0)
        rich(p, line, bold=(k == 0), color=GRAY if k else None)
    para(doc)
    exp = []
    word = 'Question' if english else 'Câu'

    def p1_item(no, stem, opts, ans, how, fix):
        p = para(doc)
        rich(p, f'{word} {no}. ', bold=True)
        rich(p, stem)
        for k, o in enumerate(opts):
            q = para(doc)
            q.paragraph_format.left_indent = Pt(18)
            ok = k == ans
            rich(q, ('#' if fix == k else '') + 'ABCD'[k] + '. ', bold=True, red=ok and how == 'red', under=ok and how == 'under')
            rich(q, o, red=ok and how == 'red', under=ok and how == 'under')
        exp.append(dict(part=1, ans=ans, fixed=[fix] if fix is not None else []))

    if english:
        no = 0
        for it in s['p1']:
            no += 1
            p1_item(no, *it)
        para(doc, '<g>')
        for k, line in enumerate(s['grp'][0].split('\n')):
            para(doc, line, italic=(k == 0))
        for it in s['grp'][1]:
            no += 1
            p1_item(no, *it)
            exp[-1]['group'] = True
        para(doc, '</g>')
    else:
        if s['p1']:
            para(doc, HEAD[1].format(n=n1), bold=True)
            para(doc, f"(File mẫu có {len(s['p1'])} câu ví dụ; đề thật có {n1} câu.)", italic=True, color=GRAY)
            for no, it in enumerate(s['p1'], 1):
                p1_item(no, *it)
        if s['p2']:
            para(doc, HEAD[2].format(n=n2), bold=True)
            mk = s.get('p2mark', 'red')
            for no, (stem, sts, key) in enumerate(s['p2'], 1):
                lines = stem.split('\n')
                p = para(doc)
                rich(p, f'Câu {no}. ', bold=True)
                rich(p, lines[0])
                for ln in lines[1:]:
                    para(doc, ln)
                for k, txt in enumerate(sts):
                    q = para(doc)
                    q.paragraph_format.left_indent = Pt(18)
                    ok = key[k] == 'Đ'
                    rich(q, 'abcd'[k] + ') ', bold=True, red=ok and mk == 'red', under=ok and mk == 'under')
                    rich(q, txt, red=ok and mk == 'red', under=ok and mk == 'under')
                exp.append(dict(part=2, ans=key))
        if s['p3']:
            para(doc, HEAD[3].format(n=n3), bold=True)
            for no, (stem, ans, sol) in enumerate(s['p3'], 1):
                p = para(doc)
                rich(p, f'Câu {no}. ', bold=True)
                rich(p, stem)
                para(doc, 'A. ' + ans, bold=True, red=True)
                if sol:
                    para(doc, 'Lời giải: ' + sol, italic=True)
                exp.append(dict(part=3, ans=ans))
    para(doc, '------ HẾT ------', align=WD_ALIGN_PARAGRAPH.CENTER, bold=True)
    doc.core_properties.author = 'Phong Thi 24/7'
    doc.core_properties.title = 'File mẫu ' + s['mon']
    path = os.path.join(OUT, f"mau-{s['slug']}.docx")
    doc.save(path)
    return path, exp


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    expect = {}
    for s in SUBJECTS:
        path, e = build(s)
        expect[s['slug']] = e
        print('OK', os.path.relpath(path, ROOT), len(e), 'câu')
    path, e = build(ANH, english=True)
    expect[ANH['slug']] = e
    print('OK', os.path.relpath(path, ROOT), len(e), 'câu')
    with open(os.path.join(ROOT, 'scripts', '_dap_an_mau.json'), 'w', encoding='utf-8') as f:
        json.dump(expect, f, ensure_ascii=False, indent=1)
