"""Đúng/sai và trả lời ngắn của L10-105."""


def add_hard_rest(tf, short):
    tf('dien-phan',
       'Một bể điện phân dung dịch NaCl dùng màng ngăn chỉ cho ion [[Na^+]] đi qua như hình. Ban đầu ngăn dương chứa 0,500 mol NaCl. Truyền 19300 C qua bể. Mỗi điện cực chỉ tạo khí như hình và bỏ qua khí hòa tan. Sau điện phân, thu hồi được 90,0% lượng NaOH đã tạo thành.',
       ['Còn 0,300 mol ion [[Cl^-]] trong ngăn dương.',
        'Khối lượng NaOH thu hồi được là 8,00 gam.',
        'Thể tích [[H2]] bằng hai lần thể tích [[Cl2]] khi đo ở cùng nhiệt độ và áp suất.',
        'Có 0,200 mol ion [[Na^+]] đi qua màng từ ngăn dương sang ngăn âm.'],
       [True, False, False, True],
       'a) Đúng. Có 0,200 mol electron đi qua mạch. Mỗi mol [[Cl^-]] nhường một mol electron nên ngăn dương còn 0,300 mol [[Cl^-]]. b) Sai. Tạo 0,200 mol NaOH nhưng chỉ thu hồi 0,180 mol, tức 7,20 gam. c) Sai. Cả hai khí đều ứng với hai mol electron trên một mol khí. d) Đúng. Mỗi mol [[Cl^-]] bị oxi hóa tương ứng một mol [[Na^+]] chuyển sang ngăn âm để duy trì trung hòa điện.',
       level='van-dung-cao')
    tf('dien-phan',
       'Một xưởng mạ huy chương bằng bể trong hình. Bể chứa 250 mL dung dịch [[CuSO4]] 0,500 mol/L. Khi truyền 9650 C, 90,0% điện lượng tại anode dùng để hòa tan Cu, phần còn lại tạo [[O2]]. Tại cathode, 80,0% điện lượng dùng để tạo Cu, phần còn lại tạo [[H2]]. Bỏ qua khí hòa tan và sự thay đổi thể tích dung dịch.',
       ['Thanh đồng giảm 2,88 gam.',
        'Sau khi mạ, nồng độ [[Cu^2+]] trong bể là 0,480 mol/L.',
        'Thể tích [[H2]] bằng bốn lần thể tích [[O2]] khi đo ở cùng nhiệt độ và áp suất.',
        'Khối lượng Cu bám trên huy chương bằng 90,0% khối lượng Cu hòa tan từ thanh đồng.'],
       [True, False, True, False],
       'a) Đúng. Có 0,100 mol electron đi qua mạch, ứng với 0,0450 mol Cu tan, tức 2,88 gam. b) Sai. Lượng Cu bám là 0,0400 mol. Nồng độ [[Cu^2+]] tăng thêm (0,0450 − 0,0400)/0,250 = 0,020 mol/L, đạt 0,520 mol/L. c) Đúng. Tạo 0,020/2 = 0,010 mol [[H2]] và 0,010/4 = 0,0025 mol [[O2]]. d) Sai. Tỉ số hai khối lượng bằng 0,0400/0,0450, khoảng 88,9%.',
       level='van-dung-cao')
    tf('polymer',
       'Một lô phế liệu khô nặng 12,0 kg chỉ gồm PET và polyethylene. Thủy phân hoàn toàn PET bằng NaOH dư, còn polyethylene không phản ứng và được tách hết. Sau khi acid hóa và tinh chế, thu được 8,00 kg sản phẩm rắn chứa 83,0% terephthalic acid. Lượng terephthalic acid thu hồi bằng 80,0% lượng lí thuyết. Lượng ethylene glycol thu hồi bằng 70,0% lượng lí thuyết. Bỏ qua nhóm cuối mạch.',
       ['Lượng terephthalic acid tính theo lí thuyết là 8,30 kg.',
        'PET chiếm 80,0% khối lượng phế liệu ban đầu.',
        'Khối lượng ethylene glycol thu hồi được là 3,10 kg.',
        'Khối lượng polyethylene tách được là 2,40 kg.'],
       [True, True, False, True],
       'a) Đúng. Khối lượng terephthalic acid theo lí thuyết bằng 8,00 × 0,830/0,800 = 8,30 kg. b) Đúng. 8,30 kg acid tương ứng 50,0 mol mắt xích PET. Mỗi mol mắt xích nặng 192 gam nên có 9,60 kg PET, bằng 80,0% khối lượng lô phế liệu. c) Sai. Khối lượng glycol thu hồi là 50,0 × 62 × 0,700 = 2170 gam. d) Đúng. Khối lượng polyethylene bằng 12,0 − 9,60 = 2,40 kg.',
       level='van-dung-cao')
    tf('carbohydrate',
       'Một mẫu dịch đường chứa 0,100 mol maltose có cấu tạo như hình và 0,060 mol glucose. Thủy phân 60,0% lượng maltose rồi lên men dịch thu được. Trong điều kiện khảo sát chỉ glucose lên men. Hiệu suất tạo ethanol tính theo lượng glucose đưa vào lên men là 80,0%.',
       ['Thủy phân một mol maltose tạo một mol glucose và một mol fructose.',
        'Có 0,180 mol glucose trong dịch đưa vào lên men.',
        'Khối lượng ethanol thu được lớn hơn 15,0 gam.',
        'Nếu thủy phân hết maltose trước khi lên men, với cùng hiệu suất tạo ethanol, khối lượng ethanol thu được tăng khoảng 5,89 gam.'],
       [False, True, False, True],
       'a) Sai. Hình cho thấy maltose gồm hai gốc glucose. b) Đúng. Lượng glucose đã có và mới tạo là 0,060 + 2 × 0,100 × 0,600 = 0,180 mol. c) Sai. Khối lượng ethanol là 0,180 × 2 × 0,800 × 46 = 13,248 gam. d) Đúng. Thủy phân 0,040 mol maltose còn lại tạo thêm 0,080 mol glucose, cho thêm 0,080 × 2 × 0,800 × 46 = 5,888 gam ethanol.',
       level='van-dung-cao')

    short('dien-phan',
          'Điện phân 200 mL dung dịch chứa [[AgNO3]] và [[Cu(NO3)2]] bằng điện cực trơ với dòng điện 4,825 A trong 1800 giây. Tại cathode, [[Ag^+]], [[Cu^2+]] rồi nước lần lượt bị khử, chất sau chỉ bị khử khi ion trước đã hết. Anode chỉ tạo [[O2]]. Bỏ qua khí hòa tan. Kết thúc, thu được 2,36 gam kim loại ở cathode và tổng cộng 0,0425 mol khí. Nồng độ ban đầu của [[Cu(NO3)2]] là bao nhiêu mol/L? Làm tròn đến hàng phần trăm.',
          0.1, 'mol/L',
          'Có 4,825 × 1800/96500 = 0,0900 mol electron. Anode tạo 0,0225 mol [[O2]], nên cathode tạo 0,0200 mol [[H2]]. Vậy hai ion kim loại dùng 0,0500 mol electron và đã bị khử hết. Gọi a, b là số mol Ag, Cu. Giải a + 2b = 0,0500 và 108a + 64b = 2,36 được a = 0,0100, b = 0,0200. Nồng độ ban đầu bằng 0,0200/0,200 = 0,10 mol/L.',
          decimals=2)
    short('dien-phan',
          'Mỗi tấm cần mạ một lớp đồng dày 20,0 micromet trên tổng diện tích 240 cm². Bỏ qua phần mép. Lấy khối lượng riêng của Cu bằng 8,96 g/cm³. Bể chứa dung dịch [[CuSO4]] dư, chạy với dòng điện 23,5 A trong tối đa 90,0 phút. Hiệu suất dòng điện tạo Cu là 80,0%. Trong thời gian đó, có thể mạ tối đa bao nhiêu tấm đạt yêu cầu?',
          7, 'tấm',
          '20,0 micromet bằng 0,00200 cm. Một tấm cần 240 × 0,00200 × 8,96 = 4,3008 gam Cu, tương ứng điện lượng 4,3008 × 2 × 96500/(64 × 0,800) = 16212 C. Trong 90 phút bể có 23,5 × 5400 = 126900 C, đủ mạ 7 tấm hoàn chỉnh.')
    short('ester',
          'X chứa ethyl acetate và ethyl acrylate. Xà phòng hóa hoàn toàn 18,56 gam X cần 0,200 mol NaOH. Từ một mẫu X khác có cùng thành phần và khối lượng, người ta tách được 90,0% lượng ethyl acrylate dưới dạng tinh khiết. Trùng hợp phần tách được với hiệu suất 85,0%. Bỏ qua khối lượng nhóm cuối mạch. Tính khối lượng polymer thu được theo gam, làm tròn đến hàng phần trăm.',
          6.12, 'gam',
          'Hai ester đều dùng một mol NaOH trên một mol ester. Nếu toàn bộ 0,200 mol là ethyl acetate thì khối lượng bằng 17,60 gam. Ethyl acrylate nặng hơn 12 gam trên một mol, nên có (18,56 − 17,60)/12 = 0,080 mol ethyl acrylate, tức 8,00 gam. Khối lượng polymer là 8,00 × 0,900 × 0,850 = 6,12 gam.',
          decimals=2)
    short('hoa-11',
          'Một mẫu nước chỉ chứa hai chất tan [[Na2CO3]] và [[NaHCO3]]. Chuẩn độ 100,0 mL mẫu với HCl 0,100 mol/L. Khi toàn bộ [[CO3^2-]] vừa chuyển thành [[HCO3^-]], thể tích HCl đã dùng là 15,00 mL. Tiếp tục chuẩn độ đến khi lượng [[HCO3^-]] phản ứng hết, tổng thể tích HCl đã dùng là 38,00 mL. Trong 1,00 L mẫu có bao nhiêu gam chất tan? Làm tròn đến hàng phần trăm.',
          2.26, 'gam',
          '100,0 mL mẫu có 0,001500 mol [[Na2CO3]]. Mỗi mol muối này dùng tổng cộng hai mol HCl, nên [[NaHCO3]] ban đầu dùng 0,003800 − 2 × 0,001500 = 0,000800 mol HCl. Trong 1,00 L có 10 × (0,001500 × 106 + 0,000800 × 84) = 2,262 gam chất tan.',
          decimals=2)
    short('amino',
          'Hỗn hợp khô nặng 7,59 gam gồm glycine và một tripeptide mạch hở chỉ tạo glycine, alanine khi thủy phân. Hàm lượng nhóm carboxyl tự do trong hỗn hợp tương ứng 0,050 mol. Sau khi thủy phân hoàn toàn, thu được 0,110 mol amino acid. Alanine chiếm bao nhiêu phần trăm tổng số mol amino acid thu được? Làm tròn đến hàng phần mười.',
          27.3, '%',
          'Gọi x, y lần lượt là số mol tripeptide và glycine tự do. Từ x + y = 0,050 và 3x + y = 0,110, suy ra x = 0,030 và y = 0,020. Khối lượng mol của tripeptide bằng (7,59 − 0,020 × 75)/0,030 = 203 gam/mol. Tripeptide chứa một gốc Ala và hai gốc Gly vì 2 × 75 + 89 − 2 × 18 = 203. Tỉ lệ mol alanine là 0,030/0,110 × 100% ≈ 27,3%.',
          decimals=1)
    short('pin',
          'Một pin Zn–Ag có 0,035 mol Zn có thể bị oxi hóa và 0,080 mol [[Ag^+]] có thể bị khử. Coi hai quá trình điện cực xảy ra đến khi hết chất giới hạn. Điện áp pin khi phóng điện là 1,20 V. Bộ chuyển đổi truyền 75,0% điện năng do pin cung cấp đến bóng đèn có công suất không đổi 0,750 W. Bóng đèn sáng trong bao nhiêu phút? Làm tròn đến hàng đơn vị.',
          135, 'phút',
          'Zn nhường tối đa 0,070 mol electron, ít hơn lượng [[Ag^+]] có thể nhận. Pin cung cấp điện năng 0,070 × 96500 × 1,20 J. Thời gian sáng là 0,070 × 96500 × 1,20 × 0,750/(0,750 × 60) = 135,1 phút, làm tròn 135 phút.')
