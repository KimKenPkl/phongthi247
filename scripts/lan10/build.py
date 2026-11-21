"""Build figures, checked JSON and an editable Word intermediate model."""
from pathlib import Path
import html
import json
import re
import sys
import importlib.util
import xml.etree.ElementTree as ET
from collections import Counter

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyBboxPatch
from matplotlib.ticker import FuncFormatter
import numpy as np
from PIL import Image

from content import EXAMS, CONSTANTS, markup
from revision import revise

ROOT = Path(__file__).resolve().parents[2]
BUILD = ROOT / "reports" / "lan10"
IMAGES = ROOT / "data" / "images" / "lan10"
TESTS = ROOT / "data" / "tests"
for p in (BUILD, IMAGES, TESTS):
    p.mkdir(parents=True, exist_ok=True)

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 14,
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.labelsize": 15, "axes.titlesize": 17, "axes.titleweight": "bold",
    "savefig.facecolor": "white", "axes.facecolor": "white",
    "figure.facecolor": "white", "text.color": "#111827",
    "axes.edgecolor": "#111827", "axes.labelcolor": "#111827",
    "xtick.color": "#111827", "ytick.color": "#111827",
})

def fig_new():
    return plt.subplots(figsize=(10, 5), dpi=140, layout="constrained")

def save(fig, name):
    fig.savefig(IMAGES / f"{name}.png", dpi=140)
    plt.close(fig)
    with Image.open(IMAGES / f"{name}.png") as im:
        assert im.size == (1400, 700), (name, im.size)

def comma(x, pos):
    return f"{x:g}".replace(".", ",")

def line_graph(name, xs, ys, xlabel, ylabel, title):
    fig, ax = fig_new()
    ax.plot(xs, ys, "o-", color="#111827", lw=2.5, ms=8)
    for x, y in zip(xs[1:], ys[1:]):
        ax.vlines(x, 0, y, color="#6b7280", ls="--", lw=.8)
        ax.hlines(y, 0, x, color="#6b7280", ls="--", lw=.8)
    ax.set(xticks=xs, yticks=ys, xlabel=xlabel, ylabel=ylabel, title=title)
    ax.xaxis.set_major_formatter(FuncFormatter(comma))
    ax.yaxis.set_major_formatter(FuncFormatter(comma))
    ax.set_xlim(left=0)
    ax.set_ylim(bottom=0)
    ax.grid(alpha=.13)
    save(fig, name)

def beaker(ax, x, anode, cathode, title):
    ax.plot([x, x, x+3.4, x+3.4], [3.25, .5, .5, 3.25], color="#111827", lw=2)
    ax.add_patch(Rectangle((x+.02, .52), 3.36, 1.85, facecolor="#e5e7eb", ec="none"))
    for ex, text, fill in ((x+.6, anode, "#d1d5db"), (x+2.5, cathode, "white")):
        ax.add_patch(Rectangle((ex, 1), .35, 2.1, facecolor=fill, edgecolor="#111827", lw=2))
        ax.text(ex+.175, .82, text, ha="center", va="top", fontsize=12)
    ax.plot([x+.775, x+.775, x+1.5], [3.1, 4.05, 4.05], color="#111827", lw=2)
    ax.plot([x+2.675, x+2.675, x+2.1], [3.1, 4.05, 4.05], color="#111827", lw=2)
    ax.add_patch(FancyBboxPatch((x+1.5, 3.7), .6, .65, boxstyle="round,pad=.05",
                               facecolor="white", edgecolor="#111827", lw=1.5))
    ax.text(x+1.8, 4.02, "DC", ha="center", va="center", fontsize=11)
    ax.text(x+1.3, 4.1, "+", ha="center", fontsize=19)
    ax.text(x+2.32, 4.1, "−", ha="center", fontsize=19)
    ax.text(x+1.7, 1.7, r"$\mathrm{CuSO_4}$", ha="center", fontsize=17)
    ax.text(x+1.7, 4.7, title, ha="center", fontsize=17, weight="bold")

def figures():
    fig, ax = fig_new()
    ax.axis("off")
    ax.set(xlim=(-.2, 7.5), ylim=(-.3, 5.4))
    beaker(ax, 1.8, "Tấm đồng", "Thìa thép", "SƠ ĐỒ MẠ ĐỒNG")
    ax.text(3.5, -.1, "Nguồn điện một chiều; các điện cực không tiếp xúc nhau",
            ha="center", fontsize=12)
    save(fig, "de1-ma-dong")
    line_graph("de1-khoi-luong-dong", [0,1930,3860,5790], [0,.64,1.28,1.92],
               "Điện lượng Q (C)", "Khối lượng Cu (g)", "KHỐI LƯỢNG Cu Ở CATHODE")
    line_graph("de2-ma-bac", [0,965,1930,5790], [0,1.08,2.16,3.44],
               "Điện lượng Q (C)", "Khối lượng kim loại (g)", "ĐIỆN PHÂN HỖN HỢP HAI ION KIM LOẠI")
    fig, ax = fig_new()
    labels = [r"$\mathrm{Mg^{2+}/Mg}$", r"$\mathrm{Zn^{2+}/Zn}$",
              r"$\mathrm{Cu^{2+}/Cu}$", r"$\mathrm{Ag^+/Ag}$"]
    values = [-2.37,-.76,.34,.80]
    bars = ax.bar(labels, values, color=["#d1d5db", "#9ca3af", "#6b7280", "#374151"],
                  edgecolor="#111827", width=.55)
    for bar, val in zip(bars, values):
        ax.text(bar.get_x()+bar.get_width()/2, val+(.1 if val>=0 else -.12),
                ("+" if val>0 else "−") + f"{abs(val):.2f}".replace(".", ","),
                va="bottom" if val>=0 else "top", ha="center", weight="bold")
    ax.axhline(0, color="#111827", lw=1)
    ax.set(ylabel="Thế điện cực chuẩn E° (V)", ylim=(-2.9,1.3), title="BỐN CẶP OXI HÓA – KHỬ")
    ax.yaxis.set_major_formatter(FuncFormatter(comma))
    save(fig, "de2-the-dien-cuc")
    line_graph("de3-khi-dien-phan", [0,9650,19300], [0,.025,.100],
               "Điện lượng Q (C)", "Tổng số mol khí (mol)", "KHÍ THU ĐƯỢC Ở CẢ HAI ĐIỆN CỰC")
    fig, ax = fig_new()
    ax.axis("off")
    ax.set(xlim=(0,10), ylim=(0,5))
    ax.add_patch(Rectangle((1,1.8),8,1.4,facecolor="#f3f4f6",edgecolor="#111827",lw=1.5))
    for x, label in ((2,"A"),(5,"B"),(8,"C")):
        ax.plot(x,2.5,"o",ms=11,mfc="white",mec="#111827",mew=2)
        ax.text(x,2.95,label,ha="center",weight="bold",fontsize=19)
    ax.text(.55,2.5,"−",fontsize=35,ha="center",va="center")
    ax.text(9.45,2.5,"+",fontsize=35,ha="center",va="center")
    ax.text(1.7,.95,"Điện cực âm",ha="center",fontsize=15)
    ax.text(8.3,.95,"Điện cực dương",ha="center",fontsize=15)
    ax.annotate("Điểm đặt mẫu",xy=(5,2.3),xytext=(5,.7),ha="center",
                arrowprops={"arrowstyle":"->", "color":"#111827"},fontsize=14)
    ax.text(5,4.3,"CÁC VỊ TRÍ TRÊN GIẤY ĐIỆN DI",ha="center",weight="bold",fontsize=18)
    save(fig, "de3-dien-di")
    fig, ax = fig_new()
    ax.axis("off")
    ax.set(xlim=(-.2,9.1), ylim=(-.2,5.4))
    beaker(ax,.2,"Cu","Cu","BỂ X")
    beaker(ax,5,"Pt","Cu","BỂ Y")
    ax.text(4.5,-.05,"Hai bể dùng nguồn điện riêng, cùng điện lượng khảo sát",
            ha="center",fontsize=12)
    save(fig,"de4-tinh-che-dong")
    fig, ax = fig_new()
    time = np.linspace(0, 12, 49)
    a = .08 * np.minimum(time/4,1)
    b = .08 * np.minimum(time/10,1)
    ax.plot(time,a,color="#111827",lw=2.5,label="Mẫu A",ls="-")
    ax.plot(time,b,color="#4b5563",lw=2.5,label="Mẫu B",ls="--")
    ax.set(xlabel="Thời gian (giờ)",ylabel="Tổng số mol CO₂ (mol)",
           title="LƯỢNG CO₂ THU ĐƯỢC TRONG QUÁ TRÌNH LÊN MEN",
           xticks=[0,2,4,6,8,10,12],yticks=[0,.02,.04,.06,.08],ylim=(0,.095),xlim=(0,12))
    ax.yaxis.set_major_formatter(FuncFormatter(comma))
    ax.legend(loc="lower right", frameon=True)
    ax.grid(alpha=.2)
    save(fig,"de4-len-men")

class Plain:
    @staticmethod
    def text(s):
        return html.unescape(re.sub("<[^>]+>", "", s))

def text_fields(q):
    return [q["content"], *q.get("options", []),
            *(s["text"] for s in q.get("statements", [])), q["explain"]]

def validate():
    issues = []
    for e in EXAMS:
        assert Counter(q["part"] for q in e["questions"]) == {1:18,2:4,3:6}
        assert len(set(q["content"] for q in e["questions"])) == 28
        for i,q in enumerate(e["questions"],1):
            if q["part"]==1:
                assert len(q["options"])==4 and len(set(q["options"]))==4
                lengths=[len(Plain.text(x).rstrip(".")) for x in q["options"]]
                if max(lengths)/min(lengths)>1.8:
                    issues.append(f"{e['code']} Q{i} option length {lengths}")
            elif q["part"]==2:
                assert len(q["statements"])==4
            else:
                answer=str(q["answer"]).replace(".",",")
                assert len(answer)<=4, (e["code"],i,answer)
            if q.get("image"):
                assert (ROOT/q["image"]).is_file(),q["image"]
            for s in text_fields(q):
                assert not re.search(r"\[\[|\]\]|\\ce|\\frac|\$\$|�|CÃ¢u|Pháº",s), (e["code"],i,s)
                ET.fromstring("<root>"+s+"</root>")
    if issues:
        print("\n".join(issues))
    return issues

def write_json():
    model=[]
    for e in EXAMS:
        # Put constants in an actual question stem too: the existing runtime does
        # not render arbitrary top-level instructions.
        if not e["questions"][0]["content"].startswith("<p class="):
            e["questions"][0]["content"] = (
                '<p class="exam-constants"><small>'+CONSTANTS+"</small></p>"+
                e["questions"][0]["content"])
        (TESTS/f"{e['id']}.json").write_text(json.dumps(e,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        model.append(e)
        lines=[e["title"],CONSTANTS]
        part_numbers=Counter()
        for q in e["questions"]:
            part_numbers[q["part"]]+=1
            lines.append(f"Phần {q['part']} – Câu {part_numbers[q['part']]}. "+Plain.text(
                re.sub(r'^<p class="exam-constants">.*?</p>', '',q["content"])))
            for j, opt in enumerate(q.get("options", [])):
                lines.append("ABCD"[j]+". "+Plain.text(opt))
            for j, st in enumerate(q.get("statements", [])):
                lines.append("abcd"[j]+") "+Plain.text(st["text"]))
        (BUILD/f"{e['id']}-hs.txt").write_text("\n".join(lines)+"\n",encoding="utf-8")
    (BUILD/"word-model.json").write_text(json.dumps(model,ensure_ascii=False,indent=2),encoding="utf-8")

def audit():
    preferred=Path("D:/skills/soan-de-hoa-chuan-bgd/scripts/audit_de_hoa.py")
    spec=importlib.util.spec_from_file_location("audit_de_hoa",preferred)
    auditor=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(auditor)
    results=[]
    for e in EXAMS:
        result=auditor.audit_exam(str(BUILD/f"{e['id']}-hs.txt"))
        assert result==(100,0,0),result
        results.append({"exam":e["id"],"score":result[0],"errors":result[1],"warnings":result[2]})
    (BUILD/"language-audit.json").write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding="utf-8")

if __name__=="__main__":
    revise(EXAMS, markup, ROOT)
    for exam in EXAMS:
        exam['contentVersion'] = 'original-figures-1'
    assert all('sourceFigure' in q for e in EXAMS for q in e['questions'] if 'image' in q)
    issues=validate()
    write_json()
    audit()
    if issues:
        sys.exit(2)
    count = sum('image' in q for e in EXAMS for q in e['questions'])
    print(f"Built 4 papers, 112 questions, {count} original figures. Language audit: 4 × 100/100.")
