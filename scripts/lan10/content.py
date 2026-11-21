"""Source for the LẦN 10 papers; chemical spans are explicit.

Run build.py after editing. [[...]] is converted to upright HTML with real
sub/sup nodes, and the same nodes become editable Word sub/sup runs.
"""
import html
import re

from hard_mc import add_hard_mc
from hard_paper import add_hard_rest

PAPER_COUNT = 5
EXAMS = []
CURRENT = None
CONSTANTS = (
    "Cho nguyên tử khối: H = 1; C = 12; N = 14; O = 16; Na = 23; Mg = 24; "
    "Al = 27; S = 32; Cl = 35,5; K = 39; Ca = 40; Fe = 56; Cu = 64; "
    "Zn = 65; Br = 80; Ag = 108; I = 127. Hằng số Faraday F = 96500 C/mol. "
    "Ở 25 °C và 1 bar, thể tích mol của khí là 24,79 L/mol. "
    "Bỏ qua sự bay hơi nước và coi hiệu suất điện phân bằng 100% nếu không có chỉ dẫn khác."
)
SOURCE_DIR = "D:/NGAN_HANG_SOL_DE_CAC_NUOC/06_VIETNAM/DVTIENICH/04_CHUYEN_DE_VA_BAI_TAP_PHAN_LOAI/docx/"
SOURCES = {
    "ester": "bai-tap-este-co-ban-phan-1.docx",
    "lipid": "bai-tap-chat-beo-phan-1.docx",
    "carbohydrate": "bai-tap-cacbohidrat-phan-1.docx",
    "amino": "amin-amino-axit-peptit-phan-1.docx",
    "polymer": "bai-tap-polime-phan-1.docx",
    "pin": "bai-tap-dien-phan.docx",
    "dien-phan": "bai-tap-dien-phan-phan-2.docx",
}

def markup(text):
    def chemical(match):
        s = html.escape(match.group(1))
        # Protect charges before converting atom counts.
        charges = []
        def charge(m):
            charges.append(m.group(1).replace("-", "−"))
            return f"§{chr(65 + len(charges) - 1)}§"
        s = re.sub(r"\^(\d*[+-])", charge, s)
        s = re.sub(r"(?<=[A-Za-z)\]])(\d+)", r"<sub>\1</sub>", s)
        s = s.replace("_n", "<sub>n</sub>")
        for i, val in enumerate(charges):
            s = s.replace(f"§{chr(65+i)}§", f"<sup>{val}</sup>")
        return s
    return re.sub(r"\[\[(.*?)\]\]", chemical, text)

def exam(number, focus):
    global CURRENT
    CURRENT = {
        "schema": 1, "id": f"on-tap-lan10-de-{number}",
        "title": f"Ôn tập kiểm tra định kì LẦN 10 – Đề {number}",
        "subject": "Hóa học 12 · Ester – Lipid, Carbohydrate, Polymer, Amino acid, Pin điện và Điện phân · Tích hợp Hóa 10–11",
        "code": f"L10-{100+number}", "hasPassword": False, "durationMin": 50,
        "shuffleQuestions": False, "shuffleOptions": False,
        "showAnswersAfterSubmit": True, "instructions": CONSTANTS,
        "scoring": {"strictPart2": False, "part1": .25, "part2": [.1, .25, .5, 1], "part3": .25},
        "parts": [
            {"part": 1, "label": "PHẦN I – TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN", "hint": "18 câu. Mỗi câu chỉ chọn một phương án.", "points": "0,25 điểm/câu"},
            {"part": 2, "label": "PHẦN II – TRẮC NGHIỆM ĐÚNG SAI", "hint": "4 câu. Mỗi câu có 4 ý a), b), c), d). Chọn đúng hoặc sai ở từng ý.", "points": "Đúng 1 ý: 0,10; 2 ý: 0,25; 3 ý: 0,50; 4 ý: 1,00 điểm."},
            {"part": 3, "label": "PHẦN III – TRẮC NGHIỆM TRẢ LỜI NGẮN", "hint": "6 câu. Viết đáp số theo yêu cầu làm tròn của từng câu.", "points": "0,25 điểm/câu"}
        ],
        "focus": focus, "questions": []
    }
    EXAMS.append(CURRENT)

def add(q, topic, level, image=None):
    q.update(topic=topic, level=level)
    if topic in SOURCES:
        q["sourceNote"] = ("Biên soạn mới; tham khảo dạng bài trong " + SOURCE_DIR + SOURCES[topic] +
                           ". Không sao chép nguyên văn; số liệu và tình huống được thiết kế lại.")
    else:
        q["sourceNote"] = "Biên soạn mới để tích hợp kiến thức Hóa học 10–11; số liệu được thiết kế cho đề."
    if image:
        q["image"] = f"data/images/lan10/{image}.png"
        q["imageAlt"] = IMAGE_ALTS[image]
        q["imageWidth"] = 1400
        q["imageHeight"] = 700
    CURRENT["questions"].append(q)

def mc(topic, content, options, explain, level="van-dung", image=None):
    """Author gives the correct option first; distribute final keys evenly."""
    i = sum(q["part"] == 1 for q in CURRENT["questions"])
    position = (i + len(EXAMS)) % 4
    opts = [markup(x.rstrip(".") + ".") for x in options]
    correct = opts.pop(0)
    opts.insert(position, correct)
    add({"part": 1, "content": markup(content), "options": opts,
         "answerIndex": position, "explain": markup(explain)}, topic, level, image)

def tf(topic, content, statements, key, explain, level="van-dung", image=None):
    add({"part": 2, "content": markup(content),
         "statements": [{"text": markup(s), "answer": bool(k)} for s, k in zip(statements, key)],
         "explain": markup(explain)}, topic, level, image)

def short(topic, content, answer, unit, explain, decimals=0, level="van-dung-cao", image=None):
    add({"part": 3, "content": markup(content), "answer": answer, "unit": unit,
         "tolerance": 0 if decimals == 0 else 10**(-decimals)/2 - 1e-8,
         "explain": markup(explain)}, topic, level, image)

IMAGE_ALTS = {
    "de1-ma-dong": "Sơ đồ bể mạ đồng: điện cực đồng nối cực dương nguồn một chiều, thìa thép nối cực âm, cả hai nhúng trong dung dịch copper(II) sulfate.",
    "de1-khoi-luong-dong": "Đồ thị khối lượng đồng ở cathode theo điện lượng: (0 C; 0 g), (1930 C; 0,64 g), (3860 C; 1,28 g), (5790 C; 1,92 g).",
    "de2-ma-bac": "Đồ thị khối lượng kim loại ở cathode theo điện lượng: (0 C; 0 g), (965 C; 1,08 g), (1930 C; 2,16 g), (5790 C; 3,44 g); đồ thị đổi độ dốc tại 1930 C.",
    "de2-the-dien-cuc": "Thế điện cực chuẩn, đơn vị V: Mg2+/Mg −2,37; Zn2+/Zn −0,76; Cu2+/Cu +0,34; Ag+/Ag +0,80.",
    "de3-khi-dien-phan": "Đồ thị tổng số mol khí ở hai điện cực theo điện lượng: (0 C; 0 mol), (9650 C; 0,025 mol), (19300 C; 0,100 mol); đổi độ dốc tại 9650 C.",
    "de3-dien-di": "Ba vị trí trên giấy điện di: vị trí A ở phía điện cực âm, vị trí B tại điểm xuất phát, vị trí C ở phía điện cực dương.",
    "de4-tinh-che-dong": "Hai bể cùng chứa copper(II) sulfate: bể X có anode đồng, bể Y có anode platinum; cả hai cathode đều bằng đồng và nối cực âm của nguồn một chiều.",
    "de4-len-men": "Đồ thị tổng lượng CO2 thu được trong lên men theo thời gian: mẫu A tăng nhanh và dừng ở 0,080 mol; mẫu B tăng chậm hơn và cũng dừng ở 0,080 mol.",
}

# ---------------------------------------------------------------------------
# ĐỀ 1 — Mạ đồng, lựa chọn vật liệu và kiểm soát sản phẩm.
exam(1, "Mạ đồng – vật liệu – kiểm soát sản phẩm")
mc("ester", "Một dung môi X bị thủy phân hoàn toàn trong dung dịch NaOH, tạo sodium acetate và ethanol. Công thức cấu tạo thu gọn của X là",
   ["[[CH3COOC2H5]]", "[[HCOOC3H7]]", "[[C2H5COOCH3]]", "[[CH3COOCH3]]"],
   "[[CH3COOC2H5 + NaOH → CH3COONa + C2H5OH]]. X là ethyl acetate.", "thong-hieu")
mc("lipid", "Chỉ số iodine là số gam iodine phản ứng tối đa với 100 gam chất béo. Bốn mẫu A, B, C, D có chỉ số iodine lần lượt là 86; 41; 8; 62. Với cùng khối lượng, mẫu hấp thụ nhiều iodine nhất là",
   ["Mẫu A", "Mẫu B", "Mẫu C", "Mẫu D"], "Chỉ số iodine lớn nhất là 86, ứng với mẫu A; không suy ra trạng thái vật lí chỉ từ số liệu này.")
mc("carbohydrate", "Hai mẫu dung dịch không màu, cùng nồng độ mol, chứa riêng glucose và saccharose. Thuốc thử phân biệt trực tiếp hai mẫu ở điều kiện thường là",
   ["Nước bromine", "Dung dịch NaCl", "Dung dịch NaOH", "Dung dịch HCl"],
   "Glucose làm mất màu nước bromine; saccharose không có phản ứng này ở điều kiện thường.", "thong-hieu")
mc("carbohydrate", "Cho glucose vào ống nghiệm chứa kết tủa [[Cu(OH)2]] mới tạo ở nhiệt độ thường, lắc nhẹ thấy kết tủa tan, tạo dung dịch xanh lam. Hiện tượng này thể hiện tính chất của",
   ["Các nhóm –OH liền kề", "Một nhóm –CHO đầu mạch", "Một nhóm –COOH tự do", "Các liên kết C=C liên hợp"],
   "Các nhóm –OH liền kề của glucose tạo phức xanh lam với Cu(II). Phản ứng này không chứng minh riêng nhóm –CHO.")
mc("polymer", "Một cơ sở cần làm tay cầm nồi từ nhựa nhiệt rắn, có cấu trúc mạng không gian và không nóng chảy khi gia nhiệt thông thường. Vật liệu phù hợp là",
   ["Nhựa phenol–formaldehyde", "Nhựa polyethylene", "Nhựa poly(vinyl chloride)", "Nhựa polystyrene"],
   "Nhựa phenol–formaldehyde đã đóng rắn có mạng không gian; PE, PVC và PS là nhựa nhiệt dẻo.", "thong-hieu")
mc("polymer", "PET được tạo từ ethylene glycol và terephthalic acid. Khi thủy phân hoàn toàn PET trong dung dịch kiềm, loại liên kết bị cắt ở mạch chính là",
   ["Liên kết ester", "Liên kết amide", "Liên kết glycoside", "Liên kết peptide"],
   "Mạch PET chứa nhóm –COO–, liên kết ester bị thủy phân trong kiềm.", "thong-hieu")
mc("amino", "Ở trạng thái tinh thể, glycine chủ yếu tồn tại dưới dạng ion lưỡng cực. Công thức biểu diễn dạng này là",
   ["[[H3N^+–CH2–COO^-]]", "[[H2N–CH2–COOH]]", "[[H3N^+–CH2–COOH]]", "[[H2N–CH2–COO^-]]"],
   "Nhóm –NH2 nhận proton từ –COOH; dạng ion lưỡng cực có điện tích tổng bằng 0.", "thong-hieu")
mc("amino", "Thủy phân hoàn toàn 1 mol tripeptide mạch hở Gly–Ala–Gly bằng dung dịch NaOH vừa đủ. Số mol NaOH đã phản ứng là",
   ["3 mol", "1 mol", "2 mol", "4 mol"], "Hai liên kết peptide và một nhóm –COOH đầu C tiêu thụ tổng cộng 3 mol NaOH.")
mc("pin", "Pin Zn–Cu đang phát điện có Zn là anode và Cu là cathode. Trong dây dẫn ngoài, electron chuyển động",
   ["Từ Zn đến Cu", "Từ Cu đến Zn", "Từ Zn đến cầu muối", "Từ Cu đến cầu muối"],
   "Anode: [[Zn → Zn^2+ + 2e^-]]; electron đi trong dây dẫn từ Zn sang Cu.", "thong-hieu")
mc("pin", "Cho E°([[Zn^2+/Zn]]) = −0,76 V và E°([[Cu^2+/Cu]]) = +0,34 V. Sức điện động chuẩn của pin Zn–Cu là",
   ["1,10 V", "0,42 V", "0,76 V", "1,52 V"], "E°pin = E°cathode − E°anode = 0,34 − (−0,76) = 1,10 V.")
mc("dien-phan", "Một thìa thép được mạ đồng theo sơ đồ dưới đây. Phát biểu nào sau đây đúng về điện cực chứa thìa?",
   ["Là cathode, xảy ra sự khử", "Là anode, xảy ra sự oxi hóa", "Là cathode, xảy ra sự oxi hóa", "Là anode, xảy ra sự khử"],
   "Thìa nối cực âm, là cathode; [[Cu^2+ + 2e^- → Cu]] tạo lớp mạ trên thìa.", image="de1-ma-dong")
mc("dien-phan", "Điện phân dung dịch [[CuSO4]] với hai điện cực platinum. Khi [[Cu^2+]] vẫn còn, sản phẩm khí ở anode là",
   ["[[O2]]", "[[H2]]", "[[SO2]]", "[[H2S]]"],
   "Anode trơ: [[2H2O → O2 + 4H^+ + 4e^-]]. Ion sulfate không bị oxi hóa trong mô hình phổ thông.", "thong-hieu")
mc("dien-phan", "Trong công nghiệp, sodium kim loại được điều chế bằng điện phân nóng chảy thay vì điện phân dung dịch NaCl. Quá trình ưu tiên ở cathode khi điện phân dung dịch NaCl là",
   ["Khử nước tạo hydrogen", "Khử ion sodium thành kim loại", "Oxi hóa nước tạo oxygen", "Oxi hóa chloride tạo chlorine"],
   "Trong dung dịch: [[2H2O + 2e^- → H2 + 2OH^-]], không tạo sodium kim loại.")
mc("dien-phan", "Trong sản xuất NaOH bằng điện phân dung dịch NaCl có màng ngăn, mục đích chính của việc tách hai ngăn điện cực là",
   ["Hạn chế chlorine gặp dung dịch NaOH", "Hạn chế sodium bám lên điện cực âm", "Hạn chế chloride chuyển thành chlorine", "Hạn chế nước nhận electron ở cathode"],
   "Nếu không tách, chlorine có thể phản ứng với NaOH tạo chloride và hypochlorite, làm thay đổi sản phẩm.")
mc("dien-phan", "Điện phân dung dịch [[CuSO4]] dư với dòng điện 0,965 A trong 1000 s. Khối lượng Cu bám ở cathode là",
   ["0,32 gam", "0,64 gam", "0,16 gam", "0,48 gam"],
   "Q = It = 965 C; n(e) = 0,010 mol; n(Cu) = 0,005 mol; m = 0,32 gam.")
mc("dien-phan", "Điện phân dung dịch chứa [[Cu(NO3)2]] và [[NaNO3]] bằng điện cực trơ. Ở giai đoạn đầu, quá trình ở cathode là",
   ["[[Cu^2+ + 2e^- → Cu]]", "[[Na^+ + e^- → Na]]", "[[2H2O → O2 + 4H^+ + 4e^-]]", "[[Cu → Cu^2+ + 2e^-]]"],
   "Cu2+ bị khử thành Cu trước sự khử nước; Na+ không bị khử thành kim loại trong nước.")
mc("hoa11", "Pha loãng dung dịch HCl có pH = 2 bằng nước để thể tích tăng 10 lần ở 25 °C. Bỏ qua sự điện li của nước. pH của dung dịch sau pha loãng là",
   ["3,0", "1,0", "2,0", "4,0"], "Nồng độ H+ giảm từ 0,01 xuống 0,001 mol/L; pH = 3.")
mc("hoa10", "Thí nghiệm hòa tan [[CaCO3]] bằng dung dịch HCl được thực hiện ở cùng nhiệt độ. Cách thay đổi nào chỉ làm tăng tốc độ ban đầu mà không đổi số mol [[CO2]] cuối cùng khi HCl luôn dư?",
   ["Nghiền nhỏ cùng lượng đá vôi", "Giảm một nửa lượng đá vôi", "Tăng gấp đôi lượng đá vôi", "Thay đá vôi bằng nước cất"],
   "Nghiền nhỏ tăng diện tích tiếp xúc; số mol CaCO3 không đổi nên lượng CO2 cuối cùng không đổi.")
tf("lipid", "Một cơ sở dùng 8,84 kg triolein tinh khiết để sản xuất xà phòng. Chất béo có công thức [[(C17H33COO)3C3H5]], được xà phòng hóa hoàn toàn bằng NaOH dư.",
   ["Một phân tử triolein chứa sáu liên kết C=C.",
    "Hydrogen hóa hoàn toàn lượng triolein trên cần 30 mol [[H2]].",
    "Khối lượng glycerol thu được là 0,46 kg.",
    "Khối lượng sodium oleate khan thu được là 9,12 kg."],
   [0,1,0,1], "Một phân tử triolein có ba liên kết C=C. M(triolein) = 884 g/mol; n = 10 mol. Cần 30 mol H2. Thu 10 mol glycerol, tương ứng 0,92 kg; thu 30 mol sodium oleate (304 g/mol), tương ứng 9,12 kg.")
tf("carbohydrate", "Một nhóm học sinh thủy phân 17,1 gam saccharose trong môi trường acid. Hiệu suất thủy phân là 80%. Sau khi trung hòa, toàn bộ hỗn hợp được cho phản ứng hoàn toàn với thuốc thử Tollens dư.",
   ["Ban đầu có 0,050 mol saccharose.",
    "Sau thủy phân có 0,040 mol glucose và 0,040 mol fructose.",
    "Phần saccharose chưa thủy phân cũng tạo bạc với thuốc thử Tollens.",
    "Khối lượng bạc thu được là 17,28 gam."],
   [1,1,0,1], "n(saccharose ban đầu) = 17,1/342 = 0,05 mol; phản ứng 0,04 mol. Mỗi mol glucose hoặc fructose tạo 2 mol Ag trong thuốc thử Tollens; n(Ag)=0,16 mol, m=17,28 gam.")
tf("dien-phan", "Điện phân dung dịch [[CuSO4]] dư bằng hai điện cực platinum. Đồ thị biểu diễn khối lượng Cu ở cathode theo điện lượng. Bỏ qua các phản ứng phụ.",
   ["Khối lượng Cu bám tỉ lệ thuận với điện lượng trong khoảng khảo sát.",
    "Ở điện lượng 3860 C, số mol Cu bám là 0,020 mol.",
    "Ở điện lượng 3860 C, số mol [[O2]] tạo thành ở anode là 0,020 mol.",
    "Nếu thay anode trơ bằng Cu tinh khiết, lượng Cu tạo ra trên cathode ở cùng điện lượng giảm một nửa."],
   [1,1,0,0], "Q/F = 0,04 mol electron tại 3860 C; n(Cu)=0,02 mol; n(O2)=0,01 mol. Thay anode trơ bằng Cu không đổi số electron cần cho mỗi mol Cu ở cathode, nên lượng Cu bám không đổi.",
   image="de1-khoi-luong-dong")
tf("pin", "Hai điện cực chuẩn Zn và Cu được nối thành pin qua cầu muối [[KNO3]]. Khi pin phát điện, phản ứng tổng quát là [[Zn + Cu^2+ → Zn^2+ + Cu]].",
   ["Khối lượng điện cực Zn tăng trong quá trình phát điện.",
    "Ion [[K^+]] của cầu muối di chuyển chủ yếu về ngăn chứa điện cực Cu.",
    "Electron đi từ Zn sang Cu thông qua dung dịch trong cầu muối.",
    "Khi 0,010 mol Zn bị oxi hóa thì có 0,020 mol Cu được tạo thành."],
   [0,1,0,0], "Zn tan ở anode nên khối lượng giảm. Cu2+ bị tiêu thụ ở cathode nên cation K+ đi về ngăn Cu để duy trì trung hòa điện. Cầu muối dẫn ion, không dẫn electron. Tỉ lệ Zn:Cu là 1:1, nên tạo 0,010 mol Cu.")
short("dien-phan", "Mạ đồng từ dung dịch chứa [[Cu^2+]] để tạo lớp Cu dày 0,010 mm lên diện tích 100 cm² của một vật. Khối lượng riêng của Cu là 8,96 g/cm³. Dòng điện mạ có cường độ 2,00 A và hiệu suất tạo Cu là 80%. Thời gian mạ tối thiểu là bao nhiêu phút? (Làm tròn đến hàng phần mười.)",
      28.1, "phút", "Độ dày = 0,001 cm; V=0,1 cm³, m=0,896 gam, n(Cu)=0,014 mol. t=2×0,014×96500/(2×0,80)=1688,75 s = 28,1458 phút.", 1)
short("dien-phan", "Điện phân 100 mL dung dịch chứa [[CuSO4]] 0,20 mol/L và [[Na2SO4]] 0,10 mol/L bằng điện cực trơ. Khi vừa hết [[Cu^2+]], dừng điện phân. Thể tích khí ở anode, quy về 25 °C và 1 bar, là bao nhiêu lít? (Làm tròn đến hàng phần trăm.)",
      .25, "L", "n(Cu)=0,02 mol; n(e)=0,04 mol; n(O2)=0,01 mol. V=0,2479 L, làm tròn 0,25 L.", 2)
short("ester", "Hỗn hợp gồm ethyl acetate và methyl acetate có tổng khối lượng 8,10 gam, tác dụng vừa đủ với 0,100 mol NaOH. Khối lượng ethyl acetate trong hỗn hợp là bao nhiêu gam? (Làm tròn đến hàng phần mười.)",
      4.4, "gam", "Đặt x,y là số mol ethyl acetate và methyl acetate: x+y=0,10; 88x+74y=8,10. Suy ra x=0,05 mol; m=4,40 gam.", 1)
short("carbohydrate", "Một mẻ lên men sử dụng 16,2 kg tinh bột khan. Hiệu suất thủy phân thành glucose là 80%, hiệu suất lên men lượng glucose thu được thành ethanol là 75%. Khối lượng ethanol thu được là bao nhiêu kilôgam? (Làm tròn đến hàng phần trăm.)",
      5.52, "kg", "Một mol mắt xích C6H10O5 (162 gam) tạo tối đa 2 mol ethanol (92 gam). m=16,2×92/162×0,80×0,75=5,52 kg.", 2)
short("amino", "Hòa tan 3,28 gam hỗn hợp glycine và alanine trong nước. Dung dịch phản ứng vừa đủ với 40,0 mL NaOH 1,00 mol/L. Cô cạn dung dịch sau phản ứng, khối lượng muối khan thu được là bao nhiêu gam? (Làm tròn đến hàng phần trăm.)",
      4.16, "gam", "Tổng số mol amino acid = n(NaOH)=0,04 mol. Thay H trong COOH bằng Na, khối lượng tăng 22×0,04=0,88 gam; muối=4,16 gam.", 2)
short("polymer", "Trùng ngưng 0,100 mol terephthalic acid và 0,100 mol ethylene glycol để tạo PET. Coi các phân tử đều tham gia tạo mắt xích, bỏ qua nhóm cuối mạch. Khối lượng PET lí thuyết là bao nhiêu gam? (Làm tròn đến hàng phần mười.)",
      19.2, "gam", "Mỗi mol cặp monomer (166+62) tách 2 mol nước (36), tạo 192 gam mắt xích PET. m=0,100×192=19,2 gam.", 1)

# ---------------------------------------------------------------------------
# ĐỀ 2 — Mạ bạc, điện phân hỗn hợp và hiệu suất sản xuất.
exam(2, "Mạ bạc – điện phân hỗn hợp – hiệu suất sản xuất")
mc("ester", "Một ester no, đơn chức, mạch hở có công thức phân tử [[C4H8O2]]. Thủy phân ester trong NaOH thu được methanol. Ester đó là",
   ["[[C2H5COOCH3]]", "[[CH3COOC2H5]]", "[[HCOOCH2CH2CH3]]", "[[HCOOCH(CH3)2]]"],
   "Alcohol tạo thành là methanol nên gốc alcohol phải là –CH3; acid còn lại là propanoic acid.")
mc("lipid", "Một mẫu dầu chứa nhiều gốc acid béo không no được hydrogen hóa một phần bằng [[H2]], xúc tác Ni. Sau phản ứng, đại lượng chắc chắn giảm là",
   ["Số mol liên kết C=C", "Số mol liên kết ester", "Số mol nguyên tử carbon", "Số mol nguyên tử oxygen"],
   "Hydrogen cộng vào liên kết C=C; không cắt liên kết ester và không đổi lượng C, O.")
mc("carbohydrate", "Trong dung dịch kiềm của thuốc thử Tollens, fructose vẫn tạo bạc. Quá trình giải thích hiện tượng này là",
   ["Fructose chuyển hóa thành glucose", "Fructose thủy phân thành glucose", "Fructose trùng ngưng thành tinh bột", "Fructose tách nước thành cellulose"],
   "Trong môi trường kiềm fructose chuyển hóa qua dạng enediol thành aldose, trong đó có glucose; không phải phản ứng thủy phân.")
mc("carbohydrate", "Một mẫu sợi cotton được thủy phân hoàn toàn trong điều kiện thích hợp. Sản phẩm hữu cơ cuối cùng là",
   ["Glucose", "Fructose", "Saccharose", "Glycerol"], "Cotton chủ yếu là cellulose, thủy phân hoàn toàn tạo glucose.", "thong-hieu")
mc("polymer", "Một polymer được tạo từ [[CH2=CHCl]] bằng phản ứng trùng hợp. Polymer đó là",
   ["Poly(vinyl chloride)", "Poly(vinyl acetate)", "Poly(methyl acrylate)", "Poly(methyl methacrylate)"],
   "Monomer vinyl chloride tạo PVC, mắt xích –CH2–CHCl–.", "thong-hieu")
mc("polymer", "Khi so sánh tơ nylon-6,6 và tơ PET, liên kết đặc trưng trong mạch nylon-6,6 là",
   ["Liên kết amide", "Liên kết ester", "Liên kết glycoside", "Liên kết disulfide"],
   "Nylon-6,6 là polyamide, chứa nhóm –CO–NH– trong mạch chính.", "thong-hieu")
mc("amino", "Cho 0,010 mol glutamic acid, công thức [[HOOC–CH2–CH2–CH(NH2)–COOH]], phản ứng với NaOH vừa đủ. Số mol NaOH cần dùng là",
   ["0,020 mol", "0,010 mol", "0,030 mol", "0,040 mol"],
   "Glutamic acid có hai nhóm –COOH; mỗi nhóm phản ứng với 1 mol NaOH trên 1 mol chất.")
mc("amino", "Một dipeptide mạch hở tạo từ glycine và alanine có phân tử khối là",
   ["146", "164", "128", "150"],
   "M(dipeptide)=75+89−18=146; mỗi liên kết peptide hình thành loại một phân tử nước.")
mc("pin", "Từ biểu đồ thế điện cực chuẩn dưới đây, chọn hai điện cực kim loại để tạo pin có sức điện động chuẩn lớn nhất. Cặp điện cực là",
   ["Mg và Ag", "Zn và Ag", "Mg và Cu", "Zn và Cu"],
   "Cần chênh lệch E° lớn nhất: Ag là cathode và Mg là anode; E°pin=0,80−(−2,37)=3,17 V.", image="de2-the-dien-cuc")
mc("pin", "Pin Cu–Ag hoạt động ở điều kiện chuẩn; E°([[Cu^2+/Cu]]) = +0,34 V, E°([[Ag^+/Ag]]) = +0,80 V. Phản ứng xảy ra khi pin phát điện là",
   ["[[Cu + 2Ag^+ → Cu^2+ + 2Ag]]", "[[2Ag + Cu^2+ → 2Ag^+ + Cu]]", "[[Cu^2+ + 2Ag^+ → Cu + 2Ag]]", "[[Cu + 2Ag → Cu^2+ + 2Ag^+]]"],
   "Cu có E° thấp hơn nên bị oxi hóa; Ag+ bị khử. Tổng điện tích và nguyên tố được bảo toàn.")
mc("dien-phan", "Để mạ bạc lên một chiếc thìa, dùng dung dịch chứa phức bạc và anode bằng Ag tinh khiết. Cách nối thìa với nguồn điện một chiều là",
   ["Nối với cực âm, làm cathode", "Nối với cực dương, làm anode", "Nối với cực âm, làm anode", "Nối với cực dương, làm cathode"],
   "Vật cần mạ phải là cathode, nơi ion bạc nhận electron thành bạc kim loại.", "thong-hieu")
mc("dien-phan", "Điện phân dung dịch chứa [[AgNO3]] và [[Cu(NO3)2]] bằng điện cực trơ. Theo mô hình phóng điện tuần tự trong chương trình phổ thông, kim loại đầu tiên tạo ở cathode là",
   ["Ag", "Cu", "Na", "Al"], "Ag+ có tính oxi hóa mạnh hơn Cu2+ theo thế điện cực chuẩn; trong mô hình tuần tự Ag tạo trước.")
mc("dien-phan", "Điện phân dung dịch [[AgNO3]] dư bằng dòng điện có điện lượng 1930 C. Khối lượng Ag tối đa tạo ra là",
   ["2,16 gam", "1,08 gam", "4,32 gam", "0,54 gam"],
   "Ag+ + e− → Ag; n(Ag)=1930/96500=0,020 mol; m=2,16 gam.")
mc("dien-phan", "Trong điện phân dung dịch [[AgNO3]] với điện cực trơ, khi [[Ag^+]] chưa hết, pH của dung dịch có xu hướng",
   ["Giảm do tạo ion [[H^+]]", "Tăng do tạo ion [[OH^-]]", "Không đổi do chỉ tạo kim loại", "Tăng do tiêu thụ ion [[NO3^-]]"],
   "Anode trơ oxi hóa nước tạo O2 và H+; Ag+ bị loại ở cathode nên dung dịch acid hóa.")
mc("dien-phan", "Điện phân dung dịch [[CuSO4]] bằng anode Cu và cathode Cu, không có phản ứng phụ. Khi khối lượng cathode tăng 1,28 gam, khối lượng anode giảm là",
   ["1,28 gam", "0,64 gam", "2,56 gam", "0,32 gam"],
   "Anode: Cu → Cu2+ + 2e−; cathode: Cu2+ + 2e− → Cu. Cùng điện lượng nên số mol Cu hòa tan và bám bằng nhau.")
mc("dien-phan", "Điện phân nước có thêm một ít [[H2SO4]] để tăng độ dẫn điện, dùng điện cực trơ. Tỉ lệ thể tích khí [[H2]] ở cathode và [[O2]] ở anode, đo cùng điều kiện, là",
   ["2 : 1", "1 : 2", "1 : 1", "4 : 1"],
   "Phản ứng tổng quát 2H2O → 2H2 + O2 nên tỉ lệ thể tích H2:O2=2:1.", "thong-hieu")
mc("hoa11", "Xét cân bằng tổng hợp ammonia: [[N2(g) + 3H2(g) ⇌ 2NH3(g)]], phản ứng thuận tỏa nhiệt. Biện pháp làm tăng lượng [[NH3]] ở trạng thái cân bằng là",
   ["Tăng áp suất ở nhiệt độ không đổi", "Giảm áp suất ở nhiệt độ không đổi", "Tăng nhiệt độ ở áp suất không đổi", "Thêm xúc tác ở điều kiện không đổi"],
   "Chiều thuận giảm số mol khí từ 4 xuống 2; tăng áp suất thuận lợi. Xúc tác không đổi thành phần cân bằng.")
mc("hoa10", "Trong phản ứng [[Cl2 + 2NaOH → NaCl + NaClO + H2O]], vai trò của chlorine là",
   ["Vừa oxi hóa, vừa khử", "Chỉ là chất oxi hóa", "Chỉ là chất khử", "Chỉ là chất xúc tác"],
   "Cl có số oxi hóa 0 chuyển thành −1 trong NaCl và +1 trong NaClO, xảy ra tự oxi hóa–khử.")
tf("dien-phan", "Điện phân 100 mL dung dịch chứa [[AgNO3]] và [[Cu(NO3)2]] bằng điện cực trơ. Đồ thị cho tổng khối lượng kim loại ở cathode theo điện lượng. Áp dụng mô hình các ion phóng điện tuần tự; trong toàn bộ khoảng khảo sát chưa có [[H2]] ở cathode.",
   ["Ở đoạn đầu, Ag được tạo ra tại cathode.",
    "Số mol [[Ag^+]] ban đầu trong dung dịch là 0,020 mol.",
    "Tại điện lượng 5790 C, khối lượng Cu đã bám là 1,28 gam.",
    "Nồng độ [[Cu^2+]] ban đầu chắc chắn bằng 0,20 mol/L."],
   [1,1,1,0], "Điểm gãy tại Q=1930 C ứng với hết Ag+: n=0,020 mol, m=2,16 gam. Sau đó ΔQ=3860 C tạo 0,020 mol Cu=1,28 gam. Chỉ biết đã tiêu thụ 0,020 mol Cu2+; không biết Cu2+ đã hết nên không khẳng định nồng độ ban đầu.",
   image="de2-ma-bac")
tf("carbohydrate", "Một cơ sở lên men 9,00 kg glucose tinh khiết thành ethanol; hiệu suất chuyển glucose theo phản ứng lên men là 80%. Toàn bộ [[CO2]] sinh ra được thu hồi, không tính các quá trình phụ.",
   ["Phản ứng lên men tạo ethanol và [[CO2]] theo tỉ lệ mol 2 : 1.",
    "Khối lượng ethanol thu được là 3,68 kg.",
    "Số mol [[CO2]] thu được là 40 mol.",
    "Phần glucose chưa chuyển hóa có khối lượng 1,80 kg."],
   [0,1,0,1], "Ban đầu 9000/180=50 mol glucose, phản ứng 40 mol. C6H12O6 → 2C2H5OH + 2CO2: thu 80 mol ethanol=3,68 kg và 80 mol CO2. Tỉ lệ mol ethanol : CO2 là 1 : 1. Glucose còn 10 mol=1,80 kg.")
tf("polymer", "Một mẫu PET được coi là chỉ gồm các mắt xích tạo từ terephthalic acid [[HOOC–C6H4–COOH]] và ethylene glycol [[HO–CH2–CH2–OH]]. Bỏ qua nhóm cuối mạch.",
   ["PET thuộc loại polyester.",
    "Một mol mắt xích PET có khối lượng 228 gam.",
    "Thủy phân hoàn toàn một mol mắt xích PET trong NaOH cần một mol NaOH.",
    "Sản xuất 19,2 kg PET lí thuyết từ hai monomer trên đồng thời tạo 3,6 kg nước."],
   [1,0,0,1], "Mắt xích C10H8O4 có M=192. Mỗi mắt xích có hai liên kết ester nên cần 2 mol NaOH. 100 mol mắt xích ứng với 200 mol H2O=3,6 kg.")
tf("amino", "Dipeptide mạch hở Gly–Ala có cấu tạo [[H2N–CH2–CO–NH–CH(CH3)–COOH]]. Hai mẫu bằng nhau, mỗi mẫu 1,46 gam, được cho phản ứng riêng với NaOH dư và với HCl dư khi đun nóng để thủy phân hoàn toàn.",
   ["Phân tử Gly–Ala có hai liên kết peptide.",
    "Mẫu phản ứng với NaOH tiêu thụ 0,020 mol NaOH.",
    "Mẫu phản ứng với HCl tiêu thụ 0,010 mol HCl.",
    "Thủy phân bằng NaOH thu được số mol sodium glycinate gấp đôi số mol sodium alaninate."],
   [0,1,0,0], "Dipeptide có một liên kết peptide; M=146, mỗi mẫu 0,01 mol. Thủy phân kiềm cần 2 mol NaOH/mol dipeptide, tạo hai muối với số mol bằng nhau. Thủy phân acid hoàn toàn thu hai amino acid ở dạng muối hydrochloride nên cần 2 mol HCl/mol dipeptide, tức 0,02 mol.")
short("dien-phan", "Một chi tiết cần phủ 2,16 gam Ag. Dòng điện có cường độ 0,500 A; hiệu suất tạo bạc là 90%. Thời gian mạ tối thiểu là bao nhiêu phút? (Làm tròn đến hàng phần mười.)",
      71.5, "phút", "n(Ag)=0,020 mol; t=nF/(Iη)=1930/(0,5×0,90)=4288,8889 s =71,4815 phút.", 1)
short("dien-phan", "Điện phân dung dịch chứa 0,010 mol [[AgNO3]] và 0,020 mol [[Cu(NO3)2]] bằng điện cực trơ. Dừng ngay khi toàn bộ hai ion kim loại vừa bị khử hết. Khối lượng dung dịch giảm bao nhiêu gam? Bỏ qua bay hơi, khí hòa tan và sự bám dung dịch trên điện cực. (Làm tròn đến hàng phần trăm.)",
      2.76, "gam", "m(kim loại)=0,010×108+0,020×64=2,36 gam. n(e)=0,010+2×0,020=0,050 mol, n(O2)=0,0125 mol, m(O2)=0,40 gam. Dung dịch giảm 2,76 gam.", 2)
short("lipid", "Xà phòng hóa hoàn toàn 8,90 gam tristearin bằng NaOH vừa đủ. Khối lượng sodium stearate khan thu được là bao nhiêu gam? (Làm tròn đến hàng phần trăm.)",
      9.18, "gam", "M(tristearin)=890, n=0,010 mol. Thu 0,030 mol C17H35COONa (M=306), m=9,18 gam.", 2)
short("carbohydrate", "Thủy phân 3,42 gam saccharose với hiệu suất chưa biết. Sau trung hòa, toàn bộ sản phẩm phản ứng với thuốc thử Tollens dư, tạo 3,456 gam bạc. Hiệu suất thủy phân saccharose là bao nhiêu phần trăm?",
      80, "%", "n(Ag)=3,456/108=0,032 mol; saccharose đã thủy phân=0,032/4=0,008 mol. Ban đầu 0,010 mol; H=80%.")
short("amino", "Cho 7,50 gam glycine phản ứng với 100 mL dung dịch NaOH 1,00 mol/L. Cô cạn dung dịch sau phản ứng, khối lượng chất rắn khan thu được là bao nhiêu gam? (Làm tròn đến hàng phần mười.)",
      9.7, "gam", "n(glycine)=0,100 mol bằng n(NaOH). Muối H2NCH2COONa có M=97; m=9,70 gam.", 1)
short("hoa10", "Một mẻ nhiên liệu gồm 0,50 mol methane và 0,50 mol hydrogen được đốt cháy hoàn toàn. Nhiệt cháy lần lượt là 890 kJ/mol và 286 kJ/mol. Có 70% nhiệt tỏa ra được truyền cho nước. Nhiệt lượng nước nhận được là bao nhiêu kilôjun? (Làm tròn đến số nguyên.)",
      412, "kJ", "Q toàn phần=0,50×890+0,50×286=588 kJ; Q hữu ích=0,70×588=411,6 kJ, làm tròn 412.")

# ---------------------------------------------------------------------------
# ĐỀ 3 — Đọc đồ thị, điện di và bảo toàn lượng chất.
exam(3, "Đọc đồ thị điện phân – điện di – bảo toàn lượng chất")
mc("ester", "Đun nóng vinyl acetate [[CH3COOCH=CH2]] với dung dịch NaOH dư. Sản phẩm hữu cơ thu được là",
   ["Sodium acetate và ethanal", "Sodium acetate và ethanol", "Sodium formate và ethanal", "Sodium formate và ethanol"],
   "Thủy phân tạo CH3COONa và vinyl alcohol không bền; vinyl alcohol chuyển thành CH3CHO. Không giải thích cơ chế trong phương án.")
mc("lipid", "Một mẫu chất béo chỉ chứa triglyceride, không có acid béo tự do. Xà phòng hóa hoàn toàn một mol mẫu này luôn cần",
   ["3 mol NaOH", "1 mol NaOH", "2 mol NaOH", "4 mol NaOH"],
   "Mỗi phân tử triglyceride có ba nhóm ester nên cần ba mol NaOH.", "thong-hieu")
mc("carbohydrate", "Nhỏ dung dịch iodine vào một lát khoai tây sống, thấy xuất hiện màu xanh tím. Thành phần gây hiện tượng là",
   ["Tinh bột", "Cellulose", "Glucose", "Saccharose"],
   "Iodine tạo phức màu xanh tím với cấu trúc xoắn của amylose trong tinh bột.", "thong-hieu")
mc("carbohydrate", "Ở cùng khối lượng chất ban đầu, chất nào tạo lượng glucose lớn nhất khi thủy phân hoàn toàn? Coi các polysaccharide chỉ gồm mắt xích, bỏ qua nhóm cuối mạch.",
   ["Mẫu tinh bột", "Mẫu saccharose", "Mẫu maltose", "Mẫu ethyl acetate"],
   "Tinh bột cho tỉ lệ m(glucose)/m=180/162; maltose cho 360/342; saccharose chỉ cho 180/342 glucose. Ester không tạo glucose.")
mc("polymer", "Một sợi tơ bị thủy phân trong môi trường acid hoặc kiềm do mạch chính chứa nhiều liên kết –CO–NH–. Sợi tơ phù hợp là",
   ["Sợi tơ nylon-6", "Sợi tơ nitron", "Sợi tơ polyethylene", "Sợi tơ polypropylene"],
   "Nylon-6 là polyamide; nitron và các polymer còn lại có mạch chính carbon, không có liên kết amide.", "thong-hieu")
mc("polymer", "Một cơ sở thu gom chai PET, rửa sạch rồi nấu chảy để tạo hạt nhựa, không làm thay đổi cấu tạo hóa học của polymer. Quy trình này thuộc loại",
   ["Tái chế cơ học", "Tái chế hóa học", "Phản ứng trùng ngưng", "Phản ứng thủy phân"],
   "Rửa, nghiền, nóng chảy và tạo hạt mà không đổi cấu trúc phân tử là tái chế cơ học.", "thong-hieu")
mc("amino", "Một amino acid X có một nhóm –[[NH2]], một nhóm –COOH và không có nhóm chức hay tâm nhận proton nào khác. Cho 0,10 mol X phản ứng với HCl vừa đủ, khối lượng muối tăng so với X là",
   ["3,65 gam", "2,20 gam", "1,80 gam", "7,30 gam"],
   "Một nhóm amino nhận một proton; mỗi mol X kết hợp 1 mol HCl (36,5 gam), nên khối lượng tăng 3,65 gam.")
mc("amino", "Ở pH = 2, glycine chủ yếu có dạng [[H3N^+–CH2–COOH]]. Đặt mẫu tại B trong điện trường theo hình. Glycine dịch chuyển chủ yếu về",
   ["Vị trí A", "Vị trí B", "Vị trí C", "Cả A và C"],
   "Dạng cation mang điện dương nên chuyển về điện cực âm, phía A.", image="de3-dien-di")
mc("pin", "Một tấm thép được nối điện với một khối Zn và đặt trong nước biển. Trong mô hình bảo vệ điện hóa, nhận định đúng là",
   ["Zn là anode hi sinh", "Fe là anode hi sinh", "Zn là cathode trơ", "Fe bị oxi hóa ưu tiên"],
   "Zn có tính khử mạnh hơn Fe, bị oxi hóa trước và cấp electron bảo vệ thép.")
mc("pin", "Cầu muối trong pin Galvani thông thường giúp pin duy trì dòng điện chủ yếu nhờ",
   ["Sự di chuyển của các ion", "Sự di chuyển của electron", "Sự chuyển khối kim loại", "Sự khuếch tán của khí"],
   "Cầu muối dẫn ion để khép kín mạch và giữ trung hòa điện tích trong các ngăn.", "thong-hieu")
mc("dien-phan", "Điện phân nóng chảy [[MgCl2]] với điện cực trơ. Sản phẩm tại cathode và anode lần lượt là",
   ["[[Mg]] và [[Cl2]]", "[[H2]] và [[Cl2]]", "[[Mg]] và [[O2]]", "[[H2]] và [[O2]]"],
   "Trong chất nóng chảy không có nước: cathode Mg2+ nhận 2e tạo Mg; anode chloride bị oxi hóa thành Cl2.", "thong-hieu")
mc("dien-phan", "Điện phân dung dịch [[CuSO4]] bằng điện cực trơ. Sau khi toàn bộ [[Cu^2+]] vừa hết, tiếp tục điện phân. Theo mô hình phổ thông, khí mới bắt đầu tạo ra ở cathode là",
   ["[[H2]]", "[[O2]]", "[[SO2]]", "[[Cl2]]"],
   "Sau khi hết Cu2+, H+ hoặc nước bị khử, tạo hydrogen; anode vẫn tạo oxygen.")
mc("dien-phan", "Ở cùng điện lượng và hiệu suất 100%, điện phân hai dung dịch dư [[AgNO3]] và [[CuSO4]]. Tỉ lệ khối lượng kim loại Ag : Cu thu được là",
   ["27 : 8", "27 : 16", "8 : 27", "16 : 27"],
   "Khối lượng tỉ lệ M/z: Ag là108/1, Cu là64/2=32; 108:32=27:8.")
mc("dien-phan", "Điện phân dung dịch [[Na2SO4]] với điện cực trơ trong một bình không có màng ngăn, trộn đều sau phản ứng. Nếu chỉ nước bị điện phân thì nồng độ phần trăm của [[Na2SO4]]",
   ["Tăng do nước bị tiêu hao", "Giảm do nước được tạo ra", "Không đổi do muối không đổi", "Giảm do sulfate tạo khí"],
   "Lượng Na2SO4 không đổi, nước bị phân hủy và thoát thành khí nên khối lượng dung dịch giảm, nồng độ phần trăm tăng.")
mc("dien-phan", "Một bể điện phân dùng điện áp không đổi 5,0 V và dòng điện 2,0 A trong 30 phút. Điện năng tiêu thụ của bể là",
   ["18 kJ", "9,0 kJ", "36 kJ", "30 kJ"],
   "W=UIt=5×2×1800=18000 J=18 kJ.")
mc("dien-phan", "Điện phân 100 mL dung dịch [[CuSO4]] 0,50 mol/L bằng điện cực trơ. Điện lượng cần để khử hết [[Cu^2+]] là",
   ["9650 C", "4825 C", "1930 C", "19300 C"],
   "n(Cu2+)=0,050 mol; n(e)=0,100 mol; Q=0,100F=9650 C.")
mc("hoa10", "Một dung dịch hydrogen peroxide phân hủy tạo oxygen. Hai thí nghiệm dùng cùng lượng dung dịch ở cùng nhiệt độ, trong đó một thí nghiệm có thêm một ít [[MnO2]]. So với mẫu không xúc tác, mẫu có xúc tác",
   ["Tạo khí nhanh hơn, lượng cuối bằng nhau", "Tạo khí chậm hơn, lượng cuối bằng nhau", "Tạo khí nhanh hơn, lượng cuối lớn hơn", "Tạo khí chậm hơn, lượng cuối nhỏ hơn"],
   "Xúc tác tăng tốc độ, không thay đổi lượng H2O2 ban đầu và lượng O2 cuối cùng khi phản ứng hoàn toàn.")
mc("hoa11", "Một mẫu nước có nồng độ [[H^+]] bằng 10<sup>−5</sup> mol/L ở 25 °C. Nồng độ [[OH^-]] là",
   ["10<sup>−9</sup> mol/L", "10<sup>−5</sup> mol/L", "10<sup>−7</sup> mol/L", "10<sup>−14</sup> mol/L"],
   "Kw=10^−14 nên [OH−]=10^−14/10^−5=10^−9 mol/L.")
tf("dien-phan", "Điện phân một dung dịch chỉ chứa [[CuSO4]] bằng hai điện cực trơ. Đồ thị cho tổng số mol khí thoát khỏi hai điện cực theo điện lượng. Coi khí thoát hoàn toàn và sau khi hết [[Cu^2+]], chỉ nước tiếp tục bị điện phân.",
   ["Trước điểm gãy, khí thu được chỉ là [[O2]].",
    "Số mol [[CuSO4]] ban đầu là 0,050 mol.",
    "Tại 19300 C, đã tạo 0,050 mol [[H2]].",
    "Tại 19300 C, số mol [[O2]] bằng 0,025 mol."],
   [1,1,1,0], "Điểm gãy Q=9650 C=0,1F ứng với hết 0,05 mol Cu2+. Sau đó 0,1 mol e tạo 0,05 mol H2. Toàn quá trình anode tạo19300/(4F)=0,05 mol O2. Tổng khí tại cuối=0,10 mol.",
   image="de3-khi-dien-phan")
tf("amino", "Ba mẫu glycine được đặt trong các môi trường có pH khác nhau. Cho biết glycine chủ yếu có dạng cation ở pH = 2, ion lưỡng cực ở pH = 6 và anion ở pH = 12.",
   ["Ở pH = 2, glycine chủ yếu dịch chuyển về điện cực dương.",
    "Ở pH = 12, glycine chủ yếu có dạng [[H2N–CH2–COO^-]].",
    "Ở pH = 6, ion lưỡng cực có tổng điện tích bằng +1.",
    "Chiều dịch chuyển ưu tiên của glycine luôn không đổi khi thay đổi pH môi trường."],
   [0,1,0,0], "pH thấp tạo cation, pH cao tạo anion. Dạng H3N+–CH2–COO− có tổng điện tích 0; thay đổi pH có thể đảo dấu điện tích chủ yếu của chất.")
tf("ester", "Một mẫu ester X có công thức phân tử [[C4H8O2]]. Thủy phân hoàn toàn 8,80 gam X trong NaOH dư, thu được sodium acetate và một alcohol Y.",
   ["X là methyl propionate.",
    "Số mol NaOH phản ứng là 0,100 mol.",
    "Khối lượng alcohol Y thu được là 3,20 gam.",
    "Có thể điều chế X từ acetic acid và Y với xúc tác [[H2SO4]] đặc, đun nóng."],
   [0,1,0,1], "Tạo CH3COONa, công thức C4H8O2 nên X=CH3COOC2H5. n=8,8/88=0,1 mol; Y ethanol, m=4,6 gam. Ester hóa acetic acid với ethanol tạo X.")
tf("polymer", "Một nhà máy điều chế nylon-6,6 từ hexamethylenediamine [[H2N–(CH2)6–NH2]] và adipic acid [[HOOC–(CH2)4–COOH]]. Coi chỉ tạo polymer và nước, bỏ qua nhóm cuối mạch.",
   ["Nylon-6,6 được tạo bằng phản ứng trùng ngưng.",
    "Mỗi mol cặp monomer tạo một mol mắt xích và một mol nước.",
    "Phân tử khối của một mắt xích nylon-6,6 là 262.",
    "Thủy phân hoàn toàn nylon-6,6 trong điều kiện thích hợp có thể thu lại các hợp phần của monomer."],
   [1,0,0,1], "M(diamine)=116, M(adipic acid)=146. Một cặp monomer tạo một mắt xích và hai phân tử nước. M(mắt xích)=116+146−36=226, không phải262. Polyamide có thể thủy phân cắt liên kết amide.")
short("dien-phan", "Điện phân 200 mL dung dịch [[CuSO4]] bằng điện cực trơ. Khi vừa hết [[Cu^2+]], khí ở anode có thể tích 0,4958 L ở 25 °C và 1 bar. Nồng độ mol/L ban đầu của [[CuSO4]] là bao nhiêu? (Làm tròn đến hàng phần mười.)",
      .2, "mol/L", "n(O2)=0,4958/24,79=0,020 mol; n(Cu)=2n(O2)=0,040 mol; C=0,040/0,200=0,20 mol/L.", 1)
short("dien-phan", "Điện phân dung dịch chứa 0,050 mol [[CuSO4]] bằng điện cực trơ. Khi khối lượng dung dịch đã giảm 4,60 gam thì dừng. Bỏ qua khí hòa tan và sự bay hơi nước. Tổng số mol khí thoát ra khỏi hai điện cực là bao nhiêu? (Làm tròn đến hàng phần trăm.)",
      .08, "mol", "Khi hết [[Cu^2+]], dung dịch giảm 3,20 gam Cu và 0,80 gam [[O2]], tổng 4,00 gam; đã tạo 0,025 mol [[O2]]. Phần giảm thêm 0,60 gam là nước bị điện phân: n([[H2O]]) = 1/30 mol, tạo thêm 0,050 mol khí. Tổng lượng khí là 0,075 mol, làm tròn 0,08 mol.", 2)
short("lipid", "Một mẫu dầu chứa 0,020 mol triolein và 0,010 mol tripalmitin. Hydrogen hóa hoàn toàn các liên kết C=C trong mẫu cần bao nhiêu gam [[H2]]? (Làm tròn đến hàng phần trăm.)",
      .12, "gam", "Chỉ triolein có3liên kết C=C/phân tử. n(H2)=0,020×3=0,060mol; m=0,120gam.", 2)
short("carbohydrate", "Thủy phân hoàn toàn 16,2 gam tinh bột, sau đó cho toàn bộ glucose thu được phản ứng với thuốc thử Tollens dư. Hiệu suất của cả hai quá trình đều 100%. Khối lượng bạc tạo ra là bao nhiêu gam? (Làm tròn đến hàng phần mười.)",
      21.6, "gam", "n(mắt xích)=16,2/162=0,100mol; n(glucose)=0,100mol; n(Ag)=0,200mol; m=21,6gam.", 1)
short("amino", "Đốt cháy hoàn toàn 0,100 mol hỗn hợp gồm glycine và alanine, thu được 0,250 mol [[CO2]]. Khối lượng alanine trong hỗn hợp là bao nhiêu gam? (Làm tròn đến hàng phần trăm.)",
      4.45, "gam", "Đặt x,y là số mol Gly,Ala: x+y=0,1;2x+3y=0,25. y=0,05mol; m(Ala)=0,05×89=4,45gam.", 2)
short("polymer", "Một mẻ trùng ngưng dùng 11,6 kg hexamethylenediamine và 14,6 kg adipic acid. Hiệu suất tạo nylon-6,6 là 80%, bỏ qua nhóm cuối mạch. Khối lượng nylon-6,6 thu được là bao nhiêu kilôgam? (Làm tròn đến hàng phần mười.)",
      18.1, "kg", "Mỗi monomer có100mol. Mắt xích226gam/mol, polymer lí thuyết22,6kg. Thực tế22,6×0,80=18,08kg, làm tròn18,1kg.", 1)

# ---------------------------------------------------------------------------
# ĐỀ 4 — Tinh chế đồng, lựa chọn quy trình và phân tích thực nghiệm.
exam(4, "Tinh chế đồng – lựa chọn quy trình – phân tích thực nghiệm")
mc("ester", "Một ester đơn chức X thủy phân trong NaOH tạo sodium formate và methanol. Công thức của X là",
   ["[[HCOOCH3]]", "[[CH3COOCH3]]", "[[HCOOC2H5]]", "[[C2H5COOCH3]]"],
   "Gốc acid formate là HCOO–, gốc alcohol methyl là –CH3; X là methyl formate.", "thong-hieu")
mc("lipid", "Sau khi xà phòng hóa hoàn toàn một triglyceride, sản phẩm alcohol luôn là",
   ["Glycerol", "Ethanol", "Methanol", "Propan-1-ol"],
   "Triglyceride là triester của glycerol với các acid béo.", "thong-hieu")
mc("carbohydrate", "Cùng một lượng glucose được lên men ở hai điều kiện khác nhau. Biểu đồ cho tổng số mol [[CO2]] thu được theo thời gian. Hai mẫu có cùng lượng khí cuối nhưng khác thời gian đạt mức ổn định. Nhận xét phù hợp là",
   ["Mẫu A có tốc độ ban đầu lớn hơn", "Mẫu B có tốc độ ban đầu lớn hơn", "Mẫu A cho lượng khí cuối nhỏ hơn", "Mẫu B cho lượng khí cuối lớn hơn"],
   "Độ dốc ban đầu của đường A lớn hơn; hai đường cùng dừng tại0,080mol nên không kết luận khác nhau về lượng sản phẩm cuối.", image="de4-len-men")
mc("carbohydrate", "Trong sản xuất giấy, thành phần polymer tự nhiên tạo nên phần lớn khung sợi của giấy là",
   ["Cellulose", "Saccharose", "Glucose", "Fructose"],
   "Cellulose là polymer cấu trúc chủ yếu trong thành tế bào thực vật, được dùng làm giấy.", "thong-hieu")
mc("polymer", "Cao su buna được tạo bằng phản ứng trùng hợp monomer nào sau đây?",
   ["[[CH2=CH–CH=CH2]]", "[[CH2=C(CH3)–CH=CH2]]", "[[CH2=CH–C6H5]]", "[[CH2=C(CH3)–CN]]"],
   "Buna là polybutadiene, monomer buta-1,3-diene. Isoprene tạo polyisoprene.")
mc("polymer", "Lưu hóa cao su bằng sulfur làm tăng độ bền và độ đàn hồi trong khoảng sử dụng thích hợp chủ yếu nhờ",
   ["Tạo cầu nối giữa các mạch", "Cắt hết liên kết ở mạch chính", "Chuyển polymer thành monomer", "Loại hết nguyên tử hydrogen"],
   "Cầu nối sulfur liên kết các mạch polymer, hạn chế trượt mạch; không phải cắt mạch hoàn toàn.")
mc("amino", "Một amino acid X phản ứng với NaOH theo tỉ lệ mol 1 : 1 và với HCl theo tỉ lệ mol 1 : 2. X có thể có cấu tạo là",
   ["[[H2N–(CH2)4–CH(NH2)–COOH]]", "[[HOOC–(CH2)2–CH(NH2)–COOH]]", "[[H2N–CH(CH2–C6H5)–COOH]]", "[[H2N–CH(CH2–CH2–SCH3)–COOH]]"],
   "X cần một nhómCOOH và hai nhómNH2; cấu tạo đầu là lysine.")
mc("amino", "Thủy phân hoàn toàn một tetrapeptide mạch hở chỉ tạo glycine và alanine theo tỉ lệ mol 1 : 1. Số liên kết peptide trong một phân tử là",
   ["3", "2", "4", "5"], "Peptide mạch hở có4gốc amino acid thì có3liên kết peptide; tỉ lệ hai amino acid không đổi kết luận.")
mc("pin", "Pin nhiên liệu hydrogen sử dụng [[H2]] và [[O2]] để tạo điện. Nếu chỉ xét phản ứng điện cực lí tưởng thì sản phẩm tổng quát là",
   ["[[H2O]]", "[[H2O2]]", "[[CO2]]", "[[SO2]]"], "Phản ứng tổng quát 2H2+O2→2H2O.", "thong-hieu")
mc("pin", "Cho E°([[Fe^2+/Fe]]) = −0,44 V, E°([[Cu^2+/Cu]]) = +0,34 V. Trong pin Fe–Cu chuẩn đang phát điện, nhận xét đúng là",
   ["Fe bị oxi hóa, E°pin = 0,78 V", "Cu bị oxi hóa, E°pin = 0,78 V", "Fe bị khử, E°pin = 0,10 V", "Cu bị khử, E°pin = 0,10 V"],
   "Fe có E° nhỏ hơn nên là anode, bị oxi hóa; E°pin=0,34−(−0,44)=0,78V.")
mc("dien-phan", "Hai bể điện phân X và Y được mắc theo hình. Trong X, anode bằng Cu tinh khiết; trong Y, anode bằng Pt. Dung dịch [[CuSO4]] đều dư, bỏ qua phản ứng phụ. Ở cùng điện lượng, nhận xét đúng là",
   ["Lượng Cu ở hai cathode tăng bằng nhau", "Lượng Cu ở cathode X tăng gấp đôi Y", "Chỉ cathode X có Cu bám lên", "Chỉ cathode Y có Cu bám lên"],
   "Cả hai cathode đều xảy ra Cu2++2e−→Cu nên cùngQ tạo cùng lượngCu; khác biệt ở anode.", image="de4-tinh-che-dong")
mc("dien-phan", "Trong tinh chế đồng bằng điện phân, đồng thô có lẫn bạc được dùng làm anode. Theo mô hình phổ thông, bạc kim loại trong anode chủ yếu",
   ["Tách ra, tập trung trong bùn anode", "Hòa tan hết, tạo ion bạc trong nước", "Chuyển thành khí ở điện cực dương", "Bám trực tiếp lên điện cực âm"],
   "Ag khó bị oxi hóa hơn Cu; khi Cu hòa tan, Ag tách vào bùn anode thay vì trực tiếp bám cathode.")
mc("dien-phan", "Điện phân dung dịch [[CuSO4]] với anode Cu tinh khiết và cathode Cu. Nếu chỉ có phản ứng của cặp [[Cu^2+/Cu]] thì nồng độ [[Cu^2+]] trong dung dịch",
   ["Gần như không đổi", "Tăng liên tục", "Giảm liên tục", "Giảm ngay về không"],
   "Mỗi molCu2+bị khử ởcathode được bù bằng một molCu2+do anode hòa tan; thể tích coi không đổi.", "thong-hieu")
mc("dien-phan", "Điện phân nóng chảy [[Al2O3]] hòa tan trong cryolite. Vai trò của cryolite là",
   ["Hạ nhiệt độ nóng chảy của hỗn hợp", "Tạo khí hydrogen ở cathode", "Thay thế nguồn ion aluminium", "Ngăn hoàn toàn sự tiêu hao carbon"],
   "Cryolite tạo hỗn hợp có nhiệt độ nóng chảy thấp hơn Al2O3 nguyên chất; còn giúp tăng khả năng dẫn điện.")
mc("dien-phan", "Điện phân dung dịch [[CuCl2]] với điện cực trơ, trong điều kiện chỉ tạo Cu và [[Cl2]]. Khi cathode tăng 0,64 gam, khối lượng khí ở anode là",
   ["0,71 gam", "0,32 gam", "1,42 gam", "0,64 gam"],
   "n(Cu)=0,010mol, n(e)=0,020mol; n(Cl2)=0,010mol; m=0,71gam.")
mc("dien-phan", "Một bể điện phân đang vận hành ở dòng điện không đổi. Nếu tăng thời gian điện phân gấp đôi, trong khi ion kim loại vẫn dư và hiệu suất không đổi, khối lượng kim loại thu được",
   ["Tăng gấp đôi", "Giảm một nửa", "Không thay đổi", "Tăng gấp bốn"],
   "Theo định luật Faraday m=MItη/(zF); các yếu tố khác không đổi nên m tỉ lệ với t.", "thong-hieu")
mc("hoa10", "Trong phản ứng [[Zn + CuSO4 → ZnSO4 + Cu]], số electron mà một nguyên tử Zn nhường là",
   ["2", "1", "3", "4"], "Zn chuyển từ số oxi hóa0 lên+2, nhường2electron.", "thong-hieu")
mc("hoa11", "Đốt cháy hoàn toàn ethanol tinh khiết, thu được [[CO2]] và [[H2O]]. Tỉ lệ số mol [[CO2]] : [[H2O]] là",
   ["2 : 3", "1 : 1", "3 : 2", "1 : 3"],
   "C2H5OH+3O2→2CO2+3H2O, tỉ lệ2:3.", "thong-hieu")
tf("dien-phan", "Hai bể điện phân X và Y trong hình đều chứa 200 mL dung dịch [[CuSO4]] 1,00 mol/L. X dùng anode Cu tinh khiết, Y dùng anode Pt; cathode đều bằng Cu. Cho cùng điện lượng 19300 C qua từng bể. Coi thể tích dung dịch không đổi.",
   ["Khối lượng mỗi cathode tăng 6,40 gam.",
    "Khối lượng anode Cu trong X giảm 6,40 gam.",
    "Trong Y, nồng độ [[Cu^2+]] cuối bằng 1,00 mol/L.",
    "Cả hai bể đều tạo 0,050 mol [[O2]] ở anode."],
   [1,1,0,0], "n(e)=0,20mol, n(Cu)=0,10mol=6,40gam. X:anodeCu hòa tan0,10mol, không tạoO2. Y:Cu2+còn0,10mol/0,200L=0,50mol/L, anode tạo0,050molO2.",
   image="de4-tinh-che-dong")
tf("carbohydrate", "Một nhóm nghiên cứu dùng hai mẫu glucose tinh khiết có cùng khối lượng để lên men. Đường A và B trong hình biểu diễn tổng số mol [[CO2]] thu được. Giả thiết glucose chỉ tạo ethanol và [[CO2]], khí được thu hoàn toàn.",
   ["Trong khoảng đầu, tốc độ tạo [[CO2]] trung bình ở mẫu A nhỏ hơn ở mẫu B.",
    "Hai mẫu có cùng số mol glucose đã chuyển hóa khi phản ứng kết thúc.",
    "Mỗi mẫu tạo 0,040 mol ethanol khi phản ứng kết thúc.",
    "Khối lượng glucose đã chuyển hóa trong mỗi mẫu là 7,20 gam."],
   [0,1,0,1], "Cuối cùngmỗi mẫu0,080molCO2=0,080mol ethanol. Glucose chuyển hóa0,040mol=7,20gam; tốc độ được so bằng độ dốc đường lượngkhí–thờigian.",
   image="de4-len-men")
tf("lipid", "Một mẫu X chứa 8,84 gam triolein và 0,28 gam oleic acid. Cho toàn bộ mẫu phản ứng hoàn toàn với NaOH vừa đủ, thu glycerol và sodium oleate.",
   ["Trong X có 0,020 mol triolein.",
    "Tổng lượng NaOH cần dùng là 0,030 mol.",
    "Số mol glycerol thu được là 0,010 mol.",
    "Số mol sodium oleate thu được lớn hơn 0,030 mol."],
   [0,0,1,1], "M(oleic acid)=282; n=0,28/282≈0,000993mol. TổngNaOH=0,030+0,000993mol. Glycerol chỉ do triolein tạo,0,010mol; sodiumoleate gồm cả acidbéo tựdo nên lớn hơn0,030mol.")
tf("hoa11", "Một bình kín chứa cân bằng [[N2O4(g) ⇌ 2NO2(g)]]. Khí [[NO2]] có màu nâu đỏ, [[N2O4]] không màu. Chiều phân hủy [[N2O4]] là thu nhiệt. Coi thể tích bình không đổi khi thay đổi nhiệt độ.",
   ["Tăng nhiệt độ làm màu nâu đỏ đậm hơn khi cân bằng được thiết lập lại.",
    "Tăng áp suất bằng cách giảm thể tích ở nhiệt độ không đổi làm cân bằng chuyển về phía [[N2O4]].",
    "Thêm xúc tác làm tăng hằng số cân bằng ở cùng nhiệt độ.",
    "Ở trạng thái cân bằng, tốc độ phản ứng thuận bằng tốc độ phản ứng nghịch."],
   [1,1,0,1], "Tăng nhiệt độ ưu tiênchiều thunhiệt,tạoNO2. Nénkhí ưu tiênphía ítmolkhí làN2O4. Xúctác khôngđổiK; cân bằngđộng có vthuận=vnghịch.")
short("dien-phan", "Tinh chế đồng bằng điện phân cần thu 6,40 gam Cu ở cathode. Dùng dòng điện 4,00 A với hiệu suất tạo Cu là 95%. Thời gian cần thiết là bao nhiêu phút? (Làm tròn đến hàng phần mười.)",
      84.6, "phút", "n(Cu) = 0,100 mol; t = 2×0,100×96500/(4×0,95) = 5078,9474 s = 84,6491 phút, làm tròn 84,6 phút.", 1)
short("dien-phan", "Điện phân dung dịch [[CuCl2]] bằng điện cực trơ trong điều kiện chỉ tạo Cu và [[Cl2]]. Khi khối lượng dung dịch giảm 2,70 gam thì dừng. Bỏ qua khí hòa tan và sự bay hơi nước. Khối lượng Cu tạo ra là bao nhiêu gam? (Làm tròn đến hàng phần trăm.)",
      1.28, "gam", "PhảnứngCuCl2→Cu+Cl2. Mộtmol làm dungdịch giảm64+71=135gam. n=2,70/135=0,020mol; mCu=1,28gam.", 2)
short("ester", "Thủy phân hoàn toàn 7,40 gam methyl acetate bằng NaOH vừa đủ, thu sodium acetate và methanol. Nếu thu hồi được 85% lượng methanol tạo thành, khối lượng methanol thực tế thu được là bao nhiêu gam? (Làm tròn đến hàng phần trăm.)",
      2.72, "gam", "n(ester)=7,40/74=0,100mol; m(CH3OH)líthuyết=3,20gam; thực tế3,20×0,85=2,72gam.", 2)
short("carbohydrate", "Sản xuất ethanol từ 8,10 kg tinh bột khan với hiệu suất chung của cả quá trình là 80%. Toàn bộ ethanol dùng để pha dung dịch có nồng độ 20% theo khối lượng. Khối lượng dung dịch ethanol pha được là bao nhiêu kilôgam? (Làm tròn đến hàng phần mười.)",
      18.4, "kg", "m(ethanol)=8,10×92/162×0,80=3,68kg. Dungdịch20%khối lượng có m=3,68/0,20=18,4kg.", 1)
short("amino", "Một tripeptide mạch hở chỉ gồm hai gốc glycine và một gốc alanine. Khối lượng của 0,050 mol tripeptide đó là bao nhiêu gam? (Làm tròn đến hàng phần mười.)",
      10.2, "gam", "M=2×75+89−2×18=203; m=0,050×203=10,15gam, làm tròn10,2gam.", 1)
short("polymer", "Một xưởng tái chế 12,0 kg chai PET. Giai đoạn phân loại và rửa giữ lại 90% khối lượng; giai đoạn tạo hạt giữ lại 95% lượng PET đã rửa. Khối lượng hạt PET thu được là bao nhiêu kilôgam? (Làm tròn đến hàng phần mười.)",
      10.3, "kg", "Khối lượngcòn lại=12,0×0,90×0,95=10,26kg, làm tròn10,3kg.", 1)

# Editorial pass: complete prose, no telegraphic solution notes.
REVISIONS = {
    (2,25): "Khối lượng mol tristearin là 890 g/mol nên có 0,010 mol. Phản ứng tạo 0,030 mol sodium stearate [[C17H35COONa]], có khối lượng mol 306 g/mol. Khối lượng muối là 0,030×306 = 9,18 gam.",
    (3,1): "Thủy phân tạo [[CH3COONa]] và vinyl alcohol không bền; chất này chuyển thành [[CH3CHO]].",
    (3,19): "Điểm gãy Q = 9650 C ứng với 0,100 mol electron và vừa hết 0,050 mol [[Cu^2+]]. Phần điện lượng tiếp theo tạo 0,050 mol [[H2]]. Trong toàn quá trình, anode tạo 19300/(4F) = 0,050 mol [[O2]]. Tổng số mol khí cuối cùng là 0,100 mol.",
    (3,20): "Môi trường pH thấp tạo cation; pH cao tạo anion. Ion lưỡng cực [[H3N^+–CH2–COO^-]] có tổng điện tích bằng 0. Thay đổi pH có thể làm đổi dấu điện tích của dạng tồn tại chủ yếu.",
    (3,21): "Muối tạo thành là [[CH3COONa]] và X có công thức [[C4H8O2]], nên X là [[CH3COOC2H5]]. n(X) = 8,80/88 = 0,100 mol; Y là ethanol, có khối lượng 4,60 gam. Ester hóa acetic acid với ethanol có thể tạo X.",
    (3,23): "n([[O2]]) = 0,4958/24,79 = 0,020 mol; n(Cu) = 2n([[O2]]) = 0,040 mol. Nồng độ ban đầu bằng 0,040/0,200 = 0,20 mol/L.",
    (3,25): "Chỉ triolein có ba liên kết C=C trong mỗi phân tử. n([[H2]]) = 0,020×3 = 0,060 mol; m([[H2]]) = 0,120 gam.",
    (3,26): "n(mắt xích) = 16,2/162 = 0,100 mol, cũng là số mol glucose. n(Ag) = 2×0,100 = 0,200 mol; m(Ag) = 21,6 gam.",
    (3,27): "Đặt x, y lần lượt là số mol glycine, alanine: x + y = 0,100 và 2x + 3y = 0,250. Suy ra y = 0,050 mol; khối lượng alanine là 0,050×89 = 4,45 gam.",
    (3,28): "Mỗi monomer có 100 mol. Mỗi mol cặp monomer tạo 226 gam mắt xích, nên khối lượng lí thuyết là 22,6 kg. Khối lượng thực tế bằng 22,6×0,80 = 18,08 kg, làm tròn 18,1 kg.",
    (4,3): "Độ dốc ban đầu của đường A lớn hơn đường B. Cả hai đường cùng dừng ở 0,080 mol nên lượng khí cuối cùng bằng nhau.",
    (4,7): "Phân tử X cần có một nhóm –COOH và hai nhóm –[[NH2]]. Cấu tạo được chọn là lysine.",
    (4,8): "Một tetrapeptide mạch hở có bốn gốc amino acid và ba liên kết peptide. Tỉ lệ glycine : alanine không làm thay đổi số liên kết.",
    (4,9): "Phản ứng tổng quát của pin là [[2H2 + O2 → 2H2O]].",
    (4,10): "Fe có thế điện cực chuẩn thấp hơn nên là anode và bị oxi hóa. Sức điện động chuẩn: 0,34 − (−0,44) = 0,78 V.",
    (4,11): "Cả hai cathode đều có quá trình [[Cu^2+ + 2e^- → Cu]]. Cùng điện lượng và hiệu suất nên tạo cùng lượng Cu, dù phản ứng ở anode khác nhau.",
    (4,13): "Mỗi mol [[Cu^2+]] bị khử ở cathode được bù bằng một mol [[Cu^2+]] do anode hòa tan. Với thể tích không đổi, nồng độ gần như không đổi.",
    (4,14): "Cryolite tạo hỗn hợp có nhiệt độ nóng chảy thấp hơn [[Al2O3]] nguyên chất, đồng thời hỗ trợ độ dẫn điện của chất điện phân.",
    (4,15): "n(Cu) = 0,64/64 = 0,010 mol; n(e) = 0,020 mol. Ở anode có 0,010 mol [[Cl2]], khối lượng 0,71 gam.",
    (4,17): "Zn chuyển từ số oxi hóa 0 lên +2, nhường hai electron: [[Zn → Zn^2+ + 2e^-]].",
    (4,18): "Phương trình cháy: [[C2H5OH + 3O2 → 2CO2 + 3H2O]]. Tỉ lệ số mol [[CO2]] : [[H2O]] là 2 : 3.",
    (4,19): "n(e) = 0,200 mol nên mỗi cathode nhận 0,100 mol Cu, tương ứng 6,40 gam. Ở X, anode Cu hòa tan 0,100 mol, không tạo [[O2]]. Ở Y, [[Cu^2+]] còn 0,100 mol trong 0,200 L, nồng độ 0,50 mol/L; anode tạo 0,050 mol [[O2]].",
    (4,20): "Cuối cùng mỗi mẫu tạo 0,080 mol [[CO2]] và 0,080 mol ethanol. Glucose đã chuyển hóa là 0,040 mol, tương ứng 7,20 gam. Đường A có độ dốc ban đầu lớn hơn đường B nên mẫu A tạo khí nhanh hơn.",
    (4,21): "Triolein có khối lượng mol 884 g/mol nên có 0,010 mol. Oleic acid có khối lượng mol 282 g/mol nên có 0,28/282 ≈ 0,000993 mol. NaOH cần là 0,030 + 0,000993 mol. Chỉ triolein tạo glycerol, số mol 0,010; cả hai chất đều tạo sodium oleate nên số mol muối lớn hơn 0,030.",
    (4,22): "Tăng nhiệt độ ưu tiên chiều thu nhiệt, tạo thêm [[NO2]]. Nén khí ưu tiên phía ít mol khí hơn là [[N2O4]]. Xúc tác không làm đổi hằng số cân bằng ở cùng nhiệt độ. Ở cân bằng động, hai tốc độ bằng nhau.",
    (4,24): "Phản ứng tổng quát: [[CuCl2 → Cu + Cl2]]. Mỗi mol Cu tạo ra làm dung dịch giảm 64 + 71 = 135 gam. n(Cu) = 2,70/135 = 0,020 mol; m(Cu) = 1,28 gam.",
    (4,25): "n(ester) = 7,40/74 = 0,100 mol. Khối lượng [[CH3OH]] lí thuyết là 3,20 gam; lượng thu hồi thực tế bằng 3,20×0,85 = 2,72 gam.",
    (4,26): "Khối lượng ethanol là 8,10×92/162×0,80 = 3,68 kg. Dung dịch 20% theo khối lượng có khối lượng 3,68/0,20 = 18,4 kg.",
    (4,27): "Khối lượng mol tripeptide là 2×75 + 89 − 2×18 = 203 g/mol. Khối lượng mẫu là 0,050×203 = 10,15 gam, làm tròn 10,2 gam.",
    (4,28): "Khối lượng còn lại bằng 12,0×0,90×0,95 = 10,26 kg, làm tròn 10,3 kg."
}
for (paper, no), explanation in REVISIONS.items():
    EXAMS[paper-1]["questions"][no-1]["explain"] = markup(explanation)

exam(5, 'Vận dụng cao: cân bằng electron, phân tích số liệu và hiệu suất qua nhiều công đoạn')
add_hard_mc(mc)
add_hard_rest(tf, short)

# The early drafted solutions contain a small explicit vocabulary of formulas.
# Convert only exact tokens outside existing tags; never infer arbitrary digits.
FORMULAS = {
    "H3N+–CH2–COO−": "H3N^+–CH2–COO^-",
    "Cu2+": "Cu^2+", "Zn2+": "Zn^2+", "Mg2+": "Mg^2+",
    "Ag+": "Ag^+", "Na+": "Na^+", "H+": "H^+",
    "OH−": "OH^-", "e−": "e^-",
    "H2NCH2COONa": "H2NCH2COONa", "C17H35COONa": "C17H35COONa",
    "CH3COOC2H5": "CH3COOC2H5", "CH3COONa": "CH3COONa",
    "C6H10O5": "C6H10O5", "C6H12O6": "C6H12O6", "C10H8O4": "C10H8O4",
    "C2H5OH": "C2H5OH", "CH3CHO": "CH3CHO", "C4H8O2": "C4H8O2",
    "Na2SO4": "Na2SO4", "H2O2": "H2O2", "CaCO3": "CaCO3",
    "CO2": "CO2", "H2O": "H2O", "Cl2": "Cl2", "H2": "H2",
    "O2": "O2", "NH2": "NH2",
}
token_re = re.compile(r"(?<![A-Za-z0-9])("+"|".join(
    re.escape(x) for x in sorted(FORMULAS,key=len,reverse=True))+r")(?![A-Za-z0-9])")
def format_remaining_formulas(s):
    pieces = re.split(r"(<(?:sub|sup)>.*?</(?:sub|sup)>|<[^>]+>)", s)
    return "".join(p if p.startswith("<") else token_re.sub(
        lambda m: markup("[["+FORMULAS[m.group(1)]+"]]"), p) for p in pieces)
for paper in EXAMS:
    for question in paper["questions"]:
        question["explain"] = format_remaining_formulas(question["explain"])

# Balanced but non-periodic answer positions; independently permute statements
# and keys together. Explanations state the chemistry rather than referring to
# a/b/c/d, so their meaning is preserved after the permutation.
KEY_POSITIONS = [
    [2,0,3,1,1,3,0,2,3,0,1,0,2,1,3,2,0,1],
    [1,3,0,2,0,1,3,2,2,0,3,1,0,3,1,2,3,0],
    [3,1,2,0,2,3,1,0,1,2,0,3,2,0,3,1,2,1],
    [0,2,1,3,3,0,2,1,0,3,1,2,1,0,2,3,0,2],
    [1,3,2,1,0,2,3,0,0,2,1,3,1,2,3,1,0,2],
]
TF_PERMUTATIONS = [
    [(2,0,3,1),(0,2,1,3),(0,3,1,2),(0,1,2,3)],
    [(0,3,2,1),(0,1,3,2),(2,1,3,0),(3,0,2,1)],
    [(0,1,3,2),(2,0,1,3),(3,0,2,1),(0,2,1,3)],
    [(3,0,1,2),(0,2,1,3),(0,1,3,2),(0,1,2,3)],
    [(0,1,2,3)] * 4,
]
for pi, paper in enumerate(EXAMS):
    for i, question in enumerate(q for q in paper["questions"] if q["part"]==1):
        opts=question["options"]
        answer=opts.pop(question["answerIndex"])
        opts.insert(KEY_POSITIONS[pi][i],answer)
        question["answerIndex"]=KEY_POSITIONS[pi][i]
    for i, question in enumerate(q for q in paper["questions"] if q["part"]==2):
        old=question["statements"]
        question["statements"]=[old[j] for j in TF_PERMUTATIONS[pi][i]]
