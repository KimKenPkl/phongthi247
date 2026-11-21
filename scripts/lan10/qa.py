"""Release checks: independent arithmetic, Word OOXML, language and PDF layout."""
from pathlib import Path
from decimal import Decimal as D, ROUND_HALF_UP
from collections import Counter
import html
import hashlib
import importlib.util
import io
import contextlib
import json
import re
import zipfile
import xml.etree.ElementTree as ET

from content import PAPER_COUNT

ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT/"reports/lan10"
RENDER = Path.home()/"AppData/Local/Temp/opencode/lan10-render"
F=D(96500)
EXPECTED = [
    [
        (D(100)*D(".001")*D("8.96")/64*2*F/2/D(".8")/60,1),
        (D(".100")*D(".20")/2*D("24.79"),2),
        (D(".05")*(55*12+98+6*16)/(4*2)/10*100,1),
        (D("16.2")*92/162*D(".80")*D(".75"),2),
        (D("3.28")+22*D(".040"),2),
        (D(".100")*(166+62-36),1),
    ],
    [
        (D("2.16")/108*F/D(".500")/D(".90")/60,1),
        (D(".010")*108+D(".020")*64+(D(".010")+2*D(".020"))/4*32,2),
        (D("8.90")/890*3*306,2),
        (D("3.456")/108/4/(D("3.42")/342)*100,0),
        (D("7.50")/75*97,1),
        ((D(".50")*890+D(".50")*286)*D(".70"),0),
    ],
    [
        (min(D(4700)/(56+31+4*16),D(1100)/(7+6*12))*F/(3600*45),1),
        (D(".050")/2+(D("4.60")-(D(".050")*64+D(".050")/2*32))/18*D("1.5"),2),
        (D(".020")*3*2,2),
        (D("16.2")/162*2*108,1),
        ((D(".250")-2*D(".100"))*89,2),
        (D("11.6")*1000/116*226/1000*D(".80"),1),
    ],
    [
        (D("6.40")/64*2*F/4/D(".95")/60,1),
        (D("2.70")/(64+71)*64,2),
        (D("7.40")/74*32*D(".85"),2),
        (D("8.10")*92/162*D(".80")/D(".20"),1),
        (D(".050")*(2*75+89-2*18),1),
        (D(10)*(3*12+6+16)/((5*12+8+2*16)*D(".925")),2),
    ],
    [
        ((108*(D("4.825")*1800/F - 2*(D(".0425")-D("4.825")*1800/F/4))-D("2.36"))/152/D(".200"),2),
        (D(23.5)*90*60*D(".80")*64//(2*F*240*D(".002")*D("8.96")),0),
        ((D("18.56")-D(".20")*88)/12*100*D(".90")*D(".85"),2),
        ((D(15)*106+(38-2*15)*84)*D(".001"),2),
        ((D("7.59")-D(".05")*75-(D(".110")-D(".050"))/2*(3*75-36-75))/14/D(".110")*100,1),
        (min(D(".035")*2,D(".080"))*F*D("1.20")*D(".75")/(D(".750")*60),0),
    ],
]

def round_vn(value, places):
    return value.quantize(D(1).scaleb(-places),rounding=ROUND_HALF_UP)

def main():
    spec=importlib.util.spec_from_file_location("audit",Path("D:/skills/soan-de-hoa-chuan-bgd/scripts/audit_de_hoa.py"))
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    w="{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    a="{http://schemas.openxmlformats.org/drawingml/2006/main}"
    records=[]
    assert len(EXPECTED) == PAPER_COUNT
    for i in range(1, PAPER_COUNT + 1):
        exam=json.loads((ROOT/f"data/tests/on-tap-lan10-de-{i}.json").read_text(encoding="utf-8"))
        qs=exam["questions"]
        for q in qs:
            if 'image' in q:
                assert hashlib.sha256((ROOT/q['image']).read_bytes()).hexdigest() == q['sourceFigure']['sha256']
        assert Counter(q["part"] for q in qs)=={1:18,2:4,3:6}
        keys=Counter(q["answerIndex"] for q in qs if q["part"]==1)
        assert min(keys.values())>=4 and max(keys.values())<=5
        assert exam["scoring"]["strictPart2"] is False
        patterns=[tuple(s["answer"] for s in q["statements"]) for q in qs if q["part"]==2]
        assert len(set(patterns))>=3,patterns
        for j,(q,(raw,places)) in enumerate(zip([q for q in qs if q["part"]==3],EXPECTED[i-1]),1):
            expected=round_vn(raw,places)
            assert D(str(q["answer"]))==expected,(i,j,expected,q["answer"])
            assert len(str(q["answer"]).replace(".",","))<=4
        for key in (False,True):
            stem=exam["id"]+("-dap-an" if key else "-hs")
            file=ROOT/f"data/docs/{stem}.docx"
            with zipfile.ZipFile(file) as z:
                assert z.testzip() is None
                for name in z.namelist():
                    if name.endswith(".xml"):
                        ET.fromstring(z.read(name))
                doc=ET.fromstring(z.read("word/document.xml"))
                txt=" ".join(t.text or "" for t in doc.iter(w+"t"))
                vals=[x.attrib.get(w+"val") for x in doc.iter(w+"vertAlign")]
                assert vals.count("subscript")>15
                assert vals.count("superscript")>=2
                assert not re.search(r"<sub>|<sup>|\\ce\{|\[\[|�|CÃ¢u",txt)
                if not key:
                    assert "HƯỚNG DẪN GIẢI" not in txt
                    assert len(list(doc.iter(a+"blip")))==sum("image" in q for q in qs)
                    media_hashes = {hashlib.sha256(z.read(p)).hexdigest() for p in z.namelist() if p.startswith('word/media/') and not p.endswith('/')}
                    assert media_hashes == {q['sourceFigure']['sha256'] for q in qs if 'image' in q}
                else:
                    assert "HƯỚNG DẪN GIẢI VÀ LƯU Ý CHẤM" in txt
            log=io.StringIO()
            with contextlib.redirect_stdout(log):
                score,errors,warnings=mod.audit_exam(str(file))
            assert (score,errors,warnings)==(100,0,0),log.getvalue()
            (REPORT/f"{stem}-audit.txt").write_text(log.getvalue(),encoding="utf-8")
            records.append({"file":file.name,"languageScore":score,
                            "subscriptRuns":vals.count("subscript"),
                            "superscriptRuns":vals.count("superscript")})
    (REPORT/"qa.json").write_text(json.dumps({
        "papers":PAPER_COUNT,"questions":PAPER_COUNT*28,"independentlyRecalculatedShortAnswers":PAPER_COUNT*6,
        "languageAudit":f"{len(records)} DOCX × 100/100", "documents":records
    },ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"PASS: {PAPER_COUNT*28} questions; {PAPER_COUNT*6} independently recalculated answers; "
          f"{len(records)} DOCX valid and 100/100.")

def pdf_previews():
    import fitz
    from PIL import Image, ImageOps, ImageDraw
    for i in range(1, PAPER_COUNT + 1):
        pdf=fitz.open(RENDER/f"on-tap-lan10-de-{i}-hs.pdf")
        pages=[]
        for j,page in enumerate(pdf):
            text=page.get_text()
            assert "�" not in text
            # No content outside the page printable area (footer excepted).
            for x0,y0,x1,y1,word,*_ in page.get_text("words"):
                assert -1<=x0<x1<=page.rect.width+1,(i,j,word)
                assert -1<=y0<y1<=page.rect.height+1,(i,j,word)
            pm=page.get_pixmap(matrix=fitz.Matrix(1.25,1.25),alpha=False)
            image=Image.frombytes("RGB",[pm.width,pm.height],pm.samples)
            image.save(RENDER/f"de{i}-page{j+1}.png")
            thumb=ImageOps.contain(image,(600,850))
            pages.append(thumb)
        sheet=Image.new("RGB",(1200,900*((len(pages)+1)//2)),"#e5e7eb")
        draw=ImageDraw.Draw(sheet)
        for j,image in enumerate(pages):
            x=(j%2)*600;y=(j//2)*900
            sheet.paste(image,(x,y+30))
            draw.text((x+15,y+8),f"De {i} - Trang {j+1}",fill="black")
        sheet.save(RENDER/f"de{i}-contact.png")
        print(f"PDF layout: paper {i}, {len(pdf)} pages; contact sheet saved.")

if __name__=="__main__":
    main()
    if "--pdf" in __import__("sys").argv:
        pdf_previews()
