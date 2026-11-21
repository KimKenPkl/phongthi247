"""Revised questions and original figures for LẦN 10."""

from hashlib import sha256
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile


BANK = Path('D:/NGAN_HANG_SOL_DE_CAC_NUOC/06_VIETNAM')
NEO_IMAGES = 'NEOPENTAN/hoi_dap/images/'
DV_DOCX = 'DVTIENICH/01_DE_THI_THPT_THEO_NAM/'


def neo_figure(slug, alt, filename, question):
    return slug, alt, (NEO_IMAGES + filename, '', question)


def revise(exams, markup, root):
    from PIL import Image

    def replace(paper, number, topic, stem, explanation, *, options=None,
                statements=None, answer=None, unit='', decimals=0, figure=None, source_note=None):
        old = exams[paper - 1]['questions'][number - 1]
        part = old['part']
        q = dict(part=part, topic=topic, level='van-dung-cao', content=markup(stem),
                  explain=markup(explanation), sourceNote='Biên soạn theo chủ đề của bộ đề LẦN 10.')
        if source_note:
            q['sourceNote'] = source_note
        if part == 1:
            index = old['answerIndex']
            shuffled = list(options[1:])
            shuffled.insert(index, options[0])
            q.update(options=[markup(s.rstrip('.') + '.') for s in shuffled], answerIndex=index)
        elif part == 2:
            q['statements'] = [dict(text=markup(text), answer=key) for text, key in statements]
        else:
            q.update(answer=answer, unit=unit, tolerance=0 if decimals == 0 else 10**(-decimals)/2 - 1e-8)
        if figure:
            slug, alt, (source, member, label) = figure
            relative = f'data/images/lan10/{slug}.png'
            target = root / relative
            if (BANK / source).is_file():
                if member:
                    with ZipFile(BANK / source) as docx:
                        data = docx.read(member)
                else:
                    data = (BANK / source).read_bytes()
                target.write_bytes(data)
            else:
                data = target.read_bytes()
            with Image.open(BytesIO(data)) as im:
                width, height = im.size
                assert im.format == 'PNG', (source, member, im.format)
                im.verify()
            q.update(image=relative, imageAlt=alt, imageWidth=width, imageHeight=height,
                     sourceNote=f'Trích hình gốc từ kho đề 06_VIETNAM. {label}. Câu hỏi được biên tập dựa trên hình.',
                     sourceFigure=dict(document=source, member=member, question=label, sha256=sha256(data).hexdigest()))
        exams[paper - 1]['questions'][number - 1] = q

    # Turn basic recall into short deductions while retaining the topic spread.
    replace(1, 6, 'polymer',
            'Thủy phân hoàn toàn một mẫu PET bằng NaOH dư, bỏ qua nhóm cuối mạch. Sau khi acid hóa dung dịch muối, thu được 8,30 gam terephthalic acid. Khối lượng mẫu PET là',
            'n(terephthalic acid) = 8,30/166 = 0,050 mol, bằng số mol mắt xích. Mỗi mol mắt xích PET có khối lượng 166 + 62 − 2×18 = 192 gam. Khối lượng PET là 9,60 gam.',
            options=['9,60 gam', '8,30 gam', '11,40 gam', '19,20 gam'])
    replace(1, 16, 'dien-phan',
            'Điện phân dung dịch chứa 0,020 mol [[AgNO3]] và 0,030 mol [[Cu(NO3)2]] bằng điện cực trơ. Coi các ion kim loại phóng điện tuần tự, anode chỉ tạo [[O2]] và bỏ qua khí hòa tan. Dừng khi anode tạo 0,015 mol [[O2]]. Khối lượng kim loại ở cathode là',
            'Anode tạo 0,015 mol [[O2]] ứng với 0,060 mol electron. [[Ag^+]] dùng 0,020 mol electron để tạo 2,16 gam Ag. Phần còn lại tạo 0,020 mol Cu, tức 1,28 gam. Tổng là 3,44 gam.',
            options=['3,44 gam', '4,08 gam', '2,16 gam', '3,12 gam'])
    replace(2, 13, 'dien-phan',
            'Điện phân dung dịch [[AgNO3]] dư bằng điện cực trơ. Giả sử chỉ một phần điện lượng tạo bạc do cathode còn có phản ứng phụ. Sau khi truyền 2412,5 C, bạc bám ở cathode có khối lượng 2,16 gam. Phần trăm điện lượng dùng để tạo bạc là',
            'Có 2,16/108 = 0,020 mol Ag, cần 1930 C. Tỉ lệ điện lượng dùng để tạo bạc là 1930/2412,5 = 80%.',
            options=['80%', '75%', '85%', '90%'])
    replace(2, 8, 'amino',
            'Thủy phân hoàn toàn 4,06 gam tripeptide mạch hở X chỉ tạo glycine và alanine. Hỗn hợp amino acid thu được phản ứng vừa đủ với 60,0 mL dung dịch NaOH 1,00 mol/L. Số gốc alanine trong một phân tử X là',
            'Hỗn hợp có 0,060 mol amino acid, suy ra 0,020 mol tripeptide. Mỗi mol tripeptide có khối lượng 203 gam. Nếu có x gốc alanine thì khối lượng mol là 3×75 + 14×x − 2×18 = 203, nên x = 1.',
            options=['1', '0', '2', '3'])
    replace(3, 9, 'pin',
            'Xét hai pin độc lập: pin Zn–Fe và pin Fe–Cu. Cho thế điện cực chuẩn của các cặp [[Zn^2+/Zn]], [[Fe^2+/Fe]] và [[Cu^2+/Cu]] lần lượt là −0,76 V, −0,44 V và +0,34 V. Dấu của điện cực Fe trong hai pin theo thứ tự trên là',
            'Fe có thế điện cực chuẩn lớn hơn Zn nên là cathode, cực dương ở pin Zn–Fe. Fe có thế nhỏ hơn Cu nên là anode, cực âm ở pin Fe–Cu.',
            options=['Dương và âm', 'Âm và dương', 'Dương và dương', 'Âm và âm'])
    replace(3, 15, 'dien-phan',
            'Mạ đồng từ dung dịch [[CuSO4]] dư, hiệu suất tạo Cu là 80%. Điện áp bể không đổi và bằng 4,0 V. Khi thu được 1,28 gam Cu, điện năng bể đã tiêu thụ là',
            'Số mol Cu là 0,020 mol nên điện lượng có ích là 3860 C. Điện lượng đi qua bể bằng 3860/0,80 = 4825 C. Điện năng bằng 4,0×4825 = 19,3 kJ.',
            options=['19,3 kJ', '15,4 kJ', '30,9 kJ', '38,6 kJ'])
    replace(4, 6, 'polymer',
            'Một mẫu gồm polyethylene và poly(vinyl chloride), có hàm lượng chlorine là 28,4% theo khối lượng. Coi các polymer chỉ gồm mắt xích. Phần trăm khối lượng poly(vinyl chloride) trong mẫu là',
            'Chlorine chỉ có trong mắt xích PVC [[C2H3Cl]], chiếm 35,5/62,5 = 56,8% khối lượng PVC. Phần khối lượng PVC của mẫu là 28,4%/56,8% = 0,500.',
            options=['50,0%', '28,4%', '43,2%', '56,8%'])
    replace(4, 16, 'dien-phan',
            'Điện phân cùng một dung dịch [[CuSO4]] dư qua hai giai đoạn. Giai đoạn đầu dùng dòng 1,00 A trong 20 phút, hiệu suất tạo Cu là 90%. Giai đoạn sau dùng dòng 2,00 A trong 10 phút, hiệu suất tạo Cu là 75%. Khối lượng Cu thu được trong cả hai giai đoạn gần nhất với',
            'Điện lượng tạo Cu bằng 1,00×1200×0,90 + 2,00×600×0,75 = 1980 C. Khối lượng Cu bằng 1980×64/(2×96500) ≈ 0,657 gam.',
            options=['0,66 gam', '0,40 gam', '0,80 gam', '0,99 gam'])

    replace(1, 11, 'dien-phan',
            'Hình bên mô tả bể điện phân hỗn hợp nóng chảy [[MgCl2]] và KCl thu được sau khi loại nước khỏi quặng carnalite. Xét các phát biểu sau:<br/>(1) [[Mg^2+]] bị khử tại điện cực sắt.<br/>(2) Lớp Mg lỏng có khối lượng riêng nhỏ hơn hỗn hợp muối lỏng.<br/>(3) Có thể dùng [[N2]] thay khí trơ mà không xảy ra phản ứng với Mg nóng chảy.<br/>(4) Từ 1 tấn quặng chứa 43% [[KCl·MgCl2·6H2O]] theo khối lượng, với hiệu suất toàn quá trình 75%, thu được khoảng 27,9 kg Mg. Tạp chất trong quặng không chứa Mg.<br/>Có bao nhiêu phát biểu đúng?',
            'Đúng (1), (2), (4). Điện cực sắt là cathode và lớp Mg nổi trên lớp muối trong hình. [[N2]] có thể phản ứng với Mg nóng tạo [[Mg3N2]]. Mỗi mol [[KCl·MgCl2·6H2O]] có khối lượng 277,5 gam và chứa 24 gam Mg. Khối lượng Mg thu được là 1000 × 0,43 × 24/277,5 × 0,75 ≈ 27,9 kg.',
            options=['3', '1', '2', '4'],
            figure=neo_figure('goc-carnalite', 'Sơ đồ bể điện phân carnalite với điện cực sắt, điện cực than chì và hai lớp chất lỏng.',
                              'qa_eef18a0e233dc16e.png', 'Đề tham khảo HSG 12 Phú Thọ 2026–2027, mã 002-H12A, Phần I câu 9'))
    replace(1, 20, 'dien-phan',
            'Một cơ sở kim hoàn thử loại đồng khỏi mảnh nhẫn vàng hồng 10K bằng điện phân dung dịch [[CuSO4]]. Ban đầu mảnh nhẫn nặng 1,125 gam, chứa 41,7% Au, 20,0% Ag và 38,3% Cu theo khối lượng. Điện cực còn lại là thanh đồng tinh khiết nặng 2,255 gam. Sau điện phân, mảnh nhẫn nặng 0,515 gam và thanh đồng nặng 2,655 gam. Mỗi điện cực chỉ xảy ra một quá trình điện hóa giữa Cu và [[Cu^2+]]. Bỏ qua sự thay đổi thể tích dung dịch. Nếu có mảnh rắn tách ra, coi các mảnh đó không phản ứng tiếp.',
            'a) Đúng. Khối lượng mảnh nhẫn giảm 0,610 gam, trong khi chỉ có 0,400 gam Cu hòa tan theo phản ứng điện cực. Hiệu 0,210 gam là khối lượng phần rắn tách ra. b) Đúng. Cu trong mảnh nhẫn bị oxi hóa tại anode, nối với cực dương của nguồn điện. c) Sai. Số mol [[Cu^2+]] sinh ra tại anode bằng số mol [[Cu^2+]] bị khử tại cathode. Với thể tích không đổi, nồng độ [[Cu^2+]] không thay đổi. d) Sai. Ban đầu mảnh nhẫn chứa 1,125 × 0,383 ≈ 0,431 gam Cu, lớn hơn 0,400 gam Cu đã hòa tan. Phần Cu chênh lệch có thể còn trong mảnh nhẫn hoặc nằm trong phần rắn tách ra.',
            statements=[('Có 0,210 gam chất rắn tách khỏi mảnh nhẫn trong quá trình điện phân.', True),
                        ('Mảnh nhẫn được nối với cực dương của nguồn điện.', True),
                        ('Nồng độ ion [[Cu^2+]] trong dung dịch tăng trong quá trình điện phân.', False),
                        ('Toàn bộ lượng đồng có trong mảnh nhẫn ban đầu đã hòa tan vào dung dịch.', False)],
            source_note='Biên tập từ DVTIENICH, thi thử Sở GDĐT Hà Nội lần 1 năm 2025, mã 049, Phần II câu 19. Điều chỉnh khối lượng thanh đồng sau điện phân và nêu rõ giả thiết.')
    replace(1, 21, 'dien-phan',
            'Dùng hai điện cực than chì như hình để điện phân 40,0 mL dung dịch [[CuSO4]] 0,500 mol/L với dòng điện 9,65 A. Sau t giây, anode thoát ra 0,0075 mol khí. Coi các điện cực trơ. Tại cathode, chỉ khi [[Cu^2+]] đã hết mới bắt đầu tạo khí. Bỏ qua lượng khí hòa tan.',
            'a) Đúng. Than chì nối với cực dương là anode và tạo [[O2]]. b) Sai. 0,0075 mol [[O2]] ứng với 0,030 mol electron, nên t = 0,030 × 96500/9,65 = 300 giây. c) Đúng. Tại 1,2t đã truyền 0,036 mol electron, nhỏ hơn 0,040 mol cần để khử hết [[Cu^2+]]. d) Đúng. Tại 3t đã truyền 0,090 mol electron. Anode tạo 0,0225 mol [[O2]] và cathode tạo 0,020 mol Cu cùng 0,025 mol [[H2]]. Khối lượng dung dịch giảm 1,28 + 0,72 + 0,05 = 2,05 gam.',
            statements=[('Điện cực than chì nối với cực dương của nguồn tạo khí [[O2]].', True),
                        ('Giá trị của t là 150 giây.', False),
                        ('Tại thời điểm 1,2t, dung dịch vẫn còn ion [[Cu^2+]].', True),
                        ('Nếu điện phân trong 3t giây, khối lượng dung dịch giảm 2,05 gam.', True)],
            figure=neo_figure('goc-ong-chu-u', 'Sơ đồ ống chữ U với hai điện cực than chì và nguồn điện một chiều.',
                              'qa_0290c453839a0c0f.png', 'HSG 12 cụm chuyên môn số 3 Bắc Ninh 2025–2026, mã 035-H12A, Phần III câu 44'))

    replace(2, 9, 'pin',
            'Pin nhiên liệu trong hình sử dụng hydrogen và oxygen, hai điện cực được ngăn bởi màng trao đổi proton. Biết thế khử chuẩn của các cặp [[O2/H2O]] trong môi trường acid và [[H^+/H2]] lần lượt là +1,23 V và 0,00 V. Khi pin hoạt động ở điều kiện chuẩn, cho 0,060 mol [[H2]] và 0,025 mol [[O2]] đi vào các điện cực tương ứng. Điện lượng tối đa mà pin cung cấp và sức điện động chuẩn lần lượt là',
            'Theo hình, electron đi qua mạch ngoài từ điện cực hydrogen sang điện cực oxygen, còn [[H^+]] đi qua màng. Mỗi mol [[O2]] nhận 4 mol electron và cần 2 mol [[H2]]. [[O2]] là chất giới hạn, nên Q = 4 × 0,025 × 96500 = 9650 C. Sức điện động chuẩn bằng 1,23 − 0,00 = 1,23 V.',
            options=['9650 C và 1,23 V', '11580 C và 1,23 V', '9650 C và 2,46 V', '11580 C và 2,46 V'],
            figure=neo_figure('goc-pin-nhien-lieu', 'Sơ đồ pin nhiên liệu hydrogen–oxygen, có màng trao đổi proton và tải ở mạch ngoài.',
                              'qa_2cd575b9dfe65b9d.png', 'HSG 12 cụm trường Ninh Bình lần 1 năm học 2026–2027, mã 021-H12A, Phần I câu 7'))
    replace(2, 19, 'dien-phan',
            'Một huy chương hình trụ, bán kính 2,5 cm và cao 0,3 cm, được mạ đồng bằng thiết bị trong hình. Coi vật sau mạ vẫn là hình trụ, bán kính 2,6 cm và cao 0,5 cm. Dùng dung dịch [[CuSO4]] dư và dòng điện 2,00 A. Bỏ qua phản ứng phụ và coi toàn bộ Cu tạo ra đều bám lên huy chương. Lấy khối lượng riêng của Cu là 8,95 g/cm³ và π = 3,14.',
            'a) Đúng. Thanh đồng nối cực dương và tan tạo [[Cu^2+]]. b) Đúng. Huy chương nối cực âm để [[Cu^2+]] bị khử thành Cu. c) Đúng. Thể tích đồng là 3,14 × (2,6² × 0,5 − 2,5² × 0,3) = 4,7257 cm³, ứng với 42,295 gam. Thời gian mạ bằng 2 × 96500 × 42,295/(64 × 2,00) ≈ 63773 giây. d) Sai. Electron đi từ thanh đồng về cực dương nguồn và từ cực âm nguồn đến huy chương.',
            statements=[('Không có khí tạo ra trên thanh đồng trong quá trình mạ.', True),
                        ('Huy chương cần nối với cực âm của nguồn điện.', True),
                        ('Thời gian mạ là 63773 giây khi làm tròn đến hàng đơn vị.', True),
                        ('Trong dây dẫn nối với huy chương, electron đi từ huy chương về nguồn.', False)],
            figure=neo_figure('goc-ma-huy-chuong', 'Sơ đồ mạ đồng với thanh đồng và huy chương cùng nhúng trong bể dung dịch.',
                              'qa_4ed23ba857333a14.png', 'HSG 12 THPT Lê Quý Đôn, Ninh Bình 2026–2027, mã 010-H12A, Phần II câu 26'))

    replace(3, 8, 'amino',
            'Hình vẽ biểu diễn bốn dạng của tyrosine trong bốn môi trường pH khác nhau. Coi ở mỗi môi trường tyrosine chỉ tồn tại dưới dạng tương ứng trong hình. Có bao nhiêu phát biểu đúng?<br/>(1) Dạng (1) di chuyển về phía cực âm khi điện di.<br/>(2) Dạng (2) hầu như không dịch chuyển về phía các điện cực.<br/>(3) Dạng (3) và dạng (4) di chuyển về cùng một điện cực.<br/>(4) Dạng (4) có điện tích bằng −1.',
            'Từ các nhóm mang điện trong hình, điện tích của (1), (2), (3) và (4) lần lượt là +1, 0, −1 và −2. Dạng (1) về phía cực âm. Dạng (2) hầu như không dịch chuyển. Dạng (3) và (4) đều về phía cực dương. Có ba phát biểu đúng.',
            options=['3', '1', '2', '4'],
            figure=('goc-tyrosine', 'Bốn công thức cấu tạo của tyrosine, đánh số từ (1) đến (4), ứng với bốn môi trường pH.',
                    ('NEOPENTAN/docx/2025-2026-thi-hoc-sinh-gioi-lop-12-truong-quynh-tho-hung-yen-lan-2.docx',
                     'word/media/image2.png', 'HSG 12 THPT Quỳnh Thọ, Hưng Yên lần 2, mã 040-H12A, Phần I câu 5')))
    replace(3, 19, 'dien-phan',
            'Hình bên mô tả bình điện phân dung dịch NaCl bão hòa với các điện cực trơ và màng ngăn chỉ cho ion [[Na^+]] đi qua. Xét giai đoạn anode chỉ giải phóng [[Cl2]] và cathode chỉ giải phóng [[H2]]. Không bổ sung hay rút dung dịch trong khi điện phân và bỏ qua khí hòa tan.',
            'a) Sai. Ion [[Na^+]] chuyển ngăn nhưng không bị tiêu thụ. b) Đúng. Màng chỉ cho [[Na^+]] đi qua từ ngăn anode sang ngăn cathode. c) Sai. 1930 C ứng với 0,020 mol electron, nên cathode tạo 0,010 mol [[H2]]. d) Đúng. Với mỗi mol electron, cathode tạo một mol [[OH^-]] và anode tiêu thụ một mol [[Cl^-]].',
            statements=[('Tổng số mol ion [[Na^+]] trong cả hai ngăn giảm trong quá trình điện phân.', False),
                        ('Ion [[Na^+]] đi qua màng từ ngăn anode sang ngăn cathode.', True),
                        ('Khi điện lượng qua bình là 1930 C, cathode tạo 0,020 mol [[H2]].', False),
                        ('Số mol [[OH^-]] tạo ra tại cathode bằng số mol [[Cl^-]] đã bị oxi hóa ở anode.', True)],
            figure=neo_figure('goc-nacl-mang', 'Sơ đồ bình điện phân dung dịch NaCl có màng ngăn và hai đường thu khí.',
                              'qa_56e2c5cd10226ce9.png', 'Thi thử chuyên Lê Quý Đôn, Đà Nẵng 2026–2027, mã 001, Phần II câu 20'))

    replace(4, 3, 'carbohydrate',
            'Hình bên biểu diễn hai dạng cấu tạo (I) và (II) của maltose. Xét các phát biểu sau:<br/>(1) Dạng (I) có nhiều hơn dạng (II) một liên kết σ.<br/>(2) Liên kết nối hai gốc monosaccharide là liên kết β-1,4-glycoside.<br/>(3) Dạng (II) có nhóm aldehyde.<br/>(4) Thủy phân hoàn toàn maltose thu được glucose và fructose.<br/>Có bao nhiêu phát biểu đúng?',
            'Đúng (1) và (3). Dạng (I) có hai vòng còn dạng (II) có một vòng và một đầu mạch hở mang nhóm aldehyde. Hai dạng có cùng số nguyên tử, nên dạng có thêm một vòng có thêm một liên kết σ. Hai gốc glucose nối bằng liên kết α-1,4-glycoside. Thủy phân hoàn toàn maltose chỉ thu được glucose.',
            options=['2', '1', '3', '4'],
            figure=('goc-maltose', 'Cân bằng giữa hai cấu trúc của maltose, ký hiệu (I) và (II).',
                    ('NEOPENTAN/docx/2026-2027-thi-hoc-sinh-gioi-lop-12-truong-le-quy-don-ninh-binh.docx',
                     'word/media/image3.png', 'HSG 12 THPT Lê Quý Đôn, Ninh Bình, mã 010-H12A, Phần I câu 14')))
    lam_dong = DV_DOCX + '2025/docx/2025-thi-thu-tn-so-gddt-lam-dong.docx'
    replace(4, 11, 'dien-phan',
            'Một nhóm học sinh điện phân dung dịch [[H2SO4]] bằng hai điện cực đồng theo sơ đồ. Tại anode chỉ xảy ra hai quá trình: Cu tan thành [[Cu^2+]] và nước bị oxi hóa thành [[O2]]. Sau khi truyền 965 C, khối lượng anode giảm 0,256 gam. Bỏ qua lượng khí hòa tan. Thể tích khí thu được tại anode ở 25 °C và 1 bar gần nhất với',
            'Điện cực Cu nối cực dương là anode. Lượng Cu tan là 0,256/64 = 0,00400 mol, tương ứng 0,00800 mol electron. 965 C tương ứng 0,0100 mol electron. Phần còn lại tạo 0,00200/4 = 0,000500 mol [[O2]], tương ứng 12,395 mL.',
            options=['12,4 mL', '24,8 mL', '49,6 mL', '62,0 mL'],
            figure=('goc-dien-phan-acid', 'Sơ đồ hai điện cực đồng nối với nguồn điện một chiều và nhúng trong dung dịch sulfuric acid.',
                    (lam_dong, 'word/media/image6.png', 'Thi thử Sở GDĐT Lâm Đồng 2025, mã 113, Phần II câu 22, sơ đồ bình điện phân')))
    replace(4, 19, 'dien-phan',
            'Một nhóm học sinh điện phân dung dịch sulfuric acid bằng hai điện cực đồng. Tại anode, Cu bị oxi hóa thành [[Cu^2+]] và nước có thể bị oxi hóa tạo [[O2]]. Bảng cho điện lượng Q và độ giảm khối lượng anode Δm ở bốn thí nghiệm. Thể tích dung dịch của mỗi thí nghiệm là 200 mL. Để xử lý số liệu trong bảng, lấy nguyên tử khối của Cu bằng 63,55. Gọi hiệu suất hòa tan Cu là tỉ lệ phần trăm điện lượng dùng để oxi hóa Cu so với Q.',
            'a) Sai. Phản ứng phụ ở anode là oxi hóa nước thành [[O2]]. b) Đúng. Thí nghiệm 2 và 3 có cùng dòng điện. Pha loãng acid làm hiệu suất giảm từ khoảng 99,4% xuống 91,1%. c) Sai. Dùng biểu thức 2FΔm/(63,55Q) × 100%, hiệu suất ở các thí nghiệm 3, 4 và 5 lần lượt xấp xỉ 91,1%, 78,6% và 71,8%. d) Đúng. Thí nghiệm 2 có hiệu suất cao nhất trong bốn thí nghiệm.',
            statements=[('Khí sinh ra do phản ứng phụ tại anode là [[H2]].', False),
                        ('Kết quả thí nghiệm 2 và 3 cho thấy khi pha loãng acid, hiệu suất hòa tan Cu giảm ở cùng cường độ dòng điện.', True),
                        ('Hiệu suất hòa tan Cu ở thí nghiệm 5 cao hơn ở thí nghiệm 3.', False),
                        ('Trong bốn thí nghiệm, thí nghiệm 2 có hiệu suất hòa tan Cu cao nhất.', True)],
            figure=('goc-bang-so-lieu-dien-phan', 'Bảng số liệu 4 thí nghiệm điện phân, gồm dòng điện, điện lượng, thể tích dung dịch acid và nước, độ giảm khối lượng anode.',
                    (lam_dong, 'word/media/image5.png', 'Thi thử Sở GDĐT Lâm Đồng 2025, mã 113, Phần II câu 22, bảng số liệu')))
    replace(4, 20, 'carbohydrate',
            'Hyaluronic acid là một polysaccharide có trong dịch khớp. Hình vẽ biểu diễn đoạn mạch chứa hai gốc D-glucuronic acid và N-acetyl-D-glucosamine xen kẽ. Một cơ sở dùng 1,00 kg nguyên liệu chứa 2,50% sodium hyaluronate theo khối lượng để điều chế dung dịch chứa 0,100 gam muối này trong 100 mL. Hiệu suất thu hồi sodium hyaluronate là 80,0%. Dung dịch được đóng vào các lọ 10,0 mL.',
            'a) Sai. Khối lượng muối thu được là 1000 × 0,0250 × 0,800 = 20,0 gam. Mỗi lọ chứa 0,0100 gam nên đóng được 2000 lọ. b) Đúng. Nhóm carboxyl trong hình chủ yếu tồn tại ở dạng [[COO^-]] ở pH sinh lí. c) Sai. Hình có hai kiểu liên kết glycoside xen kẽ là β-1,3 và β-1,4. d) Đúng. Gốc phía phải trong hình có nhóm amide [[-NHCOCH3]].',
            statements=[('Lượng dung dịch điều chế được đủ để đóng 2500 lọ.', False),
                        ('Ở pH sinh lí khoảng 7,4, mạch hyaluronic acid mang điện tích âm.', True),
                        ('Hai kiểu gốc monosaccharide chỉ nối với nhau bằng liên kết β-1,4-glycoside.', False),
                        ('Gốc N-acetyl-D-glucosamine trong hình chứa nhóm amide.', True)],
            figure=('goc-hyaluronic-acid', 'Công thức cấu tạo đoạn mạch hyaluronic acid với hai loại gốc monosaccharide xen kẽ.',
                    (DV_DOCX + '2026/docx/2026-thi-thu-tn-chuyen-tran-phu-hai-phong-lan-2.docx',
                     'word/media/image7.png', 'Thi thử chuyên Trần Phú, Hải Phòng lần 2 năm 2026, mã 077, Phần II câu 21')))

    replace(1, 25, 'lipid',
            'Một cơ sở chế biến dầu thực vật hydrogen hóa hoàn toàn 10,00 kg hỗn hợp triglyceride. Hỗn hợp gồm chất béo X có cấu tạo như hình và các triglyceride không có liên kết C=C. Coi độ tăng khối lượng chỉ do hydrogen cộng vào liên kết C=C. Sau phản ứng, tổng khối lượng chất béo là 10,05 kg. X chiếm bao nhiêu phần trăm khối lượng hỗn hợp ban đầu? Làm tròn đến hàng phần mười.',
            'Từ hình, X có một gốc acyl không có liên kết C=C, một gốc có một và một gốc có ba liên kết C=C. Công thức phân tử của X là [[C55H98O6]], khối lượng mol bằng 854 gam/mol. Mỗi mol X cộng 4 mol [[H2]], tức 8 gam. Khối lượng X là (10,05 − 10,00) × 854/8 = 5,3375 kg, chiếm 53,4%.',
            answer=53.4, unit='%', decimals=1,
            figure=('goc-triglyceride', 'Công thức cấu tạo của triglyceride X với ba gốc acyl gắn trên khung glycerol.',
                    (DV_DOCX + '2025/docx/2025-thi-thu-tn-chuyen-khtn-ha-noi-lan-1.docx',
                     'word/media/image14.png', 'Thi thử chuyên KHTN Hà Nội lần 1 năm 2025, mã 020, Phần III câu 25')))
    replace(3, 23, 'pin',
            'Một bộ pin lithium-ion được mô tả trong hình. Khi phóng điện, ở hai ngăn xảy ra các quá trình sau:<br/>Ngăn 1: [[FePO4 + Li^+ + e^- → LiFePO4]].<br/>Ngăn 2: [[LiC6 → 6C + Li^+ + e^-]].<br/>Pin có 4,7 kg [[FePO4]] và 1,1 kg [[LiC6]] hoạt tính. Coi các chất phản ứng hoàn toàn theo hai quá trình trên. Một lần khởi động xe cần điện lượng 45 Ah. Biết Li = 7 và 1 Ah = 3600 C. Điện lượng tối đa của pin bằng bao nhiêu lần điện lượng cần cho một lần khởi động? Làm tròn đến hàng phần mười.',
            'Tỉ lệ phản ứng giữa [[FePO4]] và [[LiC6]] là 1 : 1. Có 4700/151 ≈ 31,13 mol [[FePO4]] và 1100/79 ≈ 13,92 mol [[LiC6]]. [[LiC6]] giới hạn. Mỗi mol [[LiC6]] giải phóng một mol electron. Tỉ số điện lượng bằng (1100/79) × 96500/(3600 × 45) ≈ 8,3.',
            answer=8.3, unit='lần', decimals=1,
            figure=neo_figure('goc-pin-lithium-ion', 'Sơ đồ pin lithium-ion trong quá trình phóng điện, với hai ngăn đánh số 1 và 2.',
                              'qa_35ff144663eacdfc.png', 'HSG 12 cụm chuyên môn số 3 Bắc Ninh 2025–2026, mã 035-H12A, Phần III câu 39'))
    replace(4, 28, 'polymer',
            'Một nhà máy sản xuất poly(methyl methacrylate) từ acetone theo sơ đồ trong hình. Các chất trung gian được thu hồi để đưa sang công đoạn kế tiếp. Tính theo lượng mắt xích của polymer, hiệu suất toàn quá trình là 92,5%. Bỏ qua nhóm cuối mạch. Để thu 10,0 tấn polymer, nhà máy cần bao nhiêu tấn acetone? Làm tròn đến hàng phần trăm.',
            'Theo sơ đồ, một mol acetone cho tối đa một mol methyl methacrylate, tương ứng một mol mắt xích. Khối lượng mol của acetone [[C3H6O]] là 58 gam/mol và của mắt xích [[C5H8O2]] là 100 gam/mol. Lượng acetone cần là 10,0 × 58/(100 × 0,925) ≈ 6,27 tấn.',
            answer=6.27, unit='tấn', decimals=2,
            figure=('goc-so-do-pmma', 'Sơ đồ phản ứng từ acetone qua các chất trung gian đến mắt xích của poly(methyl methacrylate).',
                    (DV_DOCX + '2026/docx/2026-thi-thu-tn-chuyen-khtn-ha-noi-lan-1.docx',
                      'word/media/image5.png', 'Thi thử chuyên KHTN Hà Nội lần 1 năm 2026, mã 029, Phần III câu 26')))

    # Reuse original figures with new quantitative scenarios in paper 5.
    for new_number, source_paper, source_number in ((19, 3, 19), (20, 2, 19), (22, 4, 3)):
        source = exams[source_paper - 1]['questions'][source_number - 1]
        target = exams[4]['questions'][new_number - 1]
        for key in ('image', 'imageAlt', 'imageWidth', 'imageHeight', 'sourceNote', 'sourceFigure'):
            target[key] = source[key]
