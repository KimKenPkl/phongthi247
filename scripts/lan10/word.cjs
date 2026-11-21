// Build editable Word formula runs, not screenshots or LaTeX source.
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const req = createRequire(path.join(process.env.LOCALAPPDATA,
  'Temp/opencode/lan10-tools/package.json'));
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  WidthType, AlignmentType, VerticalAlign, BorderStyle, Footer, PageNumber,
  ShadingType
} = req('docx');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'data/docs');
const REPORT = path.join(ROOT, 'reports/lan10');
const exams = JSON.parse(fs.readFileSync(path.join(REPORT, 'word-model.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true });
const PAGE_WIDTH = 11906, PAGE_HEIGHT = 16838, MARGIN = 720;
const WIDTH = PAGE_WIDTH - 2 * MARGIN;
const INK = '000000';
const borders = { top:{style:BorderStyle.SINGLE,size:4,color:'777777'},
  bottom:{style:BorderStyle.SINGLE,size:4,color:'777777'},
  left:{style:BorderStyle.SINGLE,size:4,color:'777777'},
  right:{style:BorderStyle.SINGLE,size:4,color:'777777'} };

function decode(s) {
  return s.replace(/&(?:amp|lt|gt|quot|apos);/g, x =>
    ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[x]))
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n));
}
function runs(markup, overrides={}) {
  const parts=markup.split(/(<[^>]+>)/g), result=[];
  let sub=false,sup=false,bold=false,italic=false;
  for(const part of parts) {
    if(!part) continue;
    if(part.startsWith('<')) {
      const t=part.toLowerCase();
      if(t==='<sub>')sub=true; else if(t==='</sub>')sub=false;
      else if(t==='<sup>')sup=true; else if(t==='</sup>')sup=false;
      else if(t==='<b>'||t==='<strong>')bold=true;
      else if(t==='</b>'||t==='</strong>')bold=false;
      else if(t==='<i>'||t==='<em>')italic=true;
      else if(t==='</i>'||t==='</em>')italic=false;
      else if(/^<br/.test(t)) result.push(new TextRun({break:1}));
      continue;
    }
    result.push(new TextRun({text:decode(part),font:'Times New Roman',size:24,
      color:INK,subScript:sub,superScript:sup,bold,italics:italic,...overrides}));
  }
  return result;
}
function p(text, opts={}) {
  const { bold=false, size=24, ...paragraph }=opts;
  return new Paragraph({children:runs(text,{bold,size}),spacing:{before:0,after:55,line:255},
    widowControl:true,...paragraph});
}
function title(e,key) {
  const cell=(w,texts)=>new TableCell({
    width:{size:w,type:WidthType.DXA},verticalAlign:VerticalAlign.CENTER,
    borders:{top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},
      left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE}},
    children:texts.map(s=>p(s,{alignment:AlignmentType.CENTER,bold:true,spacing:{after:30}}))
  });
  return new Table({width:{size:WIDTH,type:WidthType.DXA},columnWidths:[3350,WIDTH-3350],
    rows:[new TableRow({children:[
      cell(3350,['THẦY HÓA GIA LAI','LỚP HÓA 10 – 11 – 12','————————']),
      cell(WIDTH-3350,[
        key?'ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM':'ĐỀ ÔN TẬP KIỂM TRA ĐỊNH KÌ LẦN 10',
        'NĂM HỌC 2026 – 2027',
        `MÔN: HÓA HỌC – LỚP 12 · ĐỀ ${e.code.slice(-1)}`,
        key?`Mã đề: ${e.code}`:`Thời gian: 50 phút · Mã đề: ${e.code}`
      ])
    ]})]});
}
function image(q) {
  const scale = Math.min(650 / q.imageWidth, 200 / q.imageHeight, 1.35);
  return new Paragraph({
    alignment:AlignmentType.CENTER,keepNext:true,
    spacing:{before:30,after:45},
    children:[new ImageRun({type:'png',data:fs.readFileSync(path.join(ROOT,q.image)),
       transformation:{width:Math.round(q.imageWidth * scale),height:Math.round(q.imageHeight * scale)},
      altText:{title:q.imageAlt,description:q.imageAlt,name:path.basename(q.image)}})]
  });
}
function heading(part) {
  return p([
    '', 'PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN (4,5 điểm)',
    'PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG SAI (4,0 điểm)',
    'PHẦN III. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN (1,5 điểm)'
  ][part],{bold:true,keepNext:true,spacing:{before:130,after:50}});
}
function optionTable(options) {
  // Use two columns only for short options, four for compact numbers.
  const lengths=options.map(s=>decode(s.replace(/<[^>]+>/g,'')).length);
  let cols=Math.max(...lengths)<=15?4:Math.max(...lengths)<=42?2:1;
  let widths=Array(cols).fill(Math.floor(WIDTH/cols));
  widths[cols-1]=WIDTH-widths.slice(0,-1).reduce((a,b)=>a+b,0);
  const rows=[];
  for(let r=0;r<4/cols;r++) {
    const cells=[];
    for(let c=0;c<cols;c++) {
      const i=r*cols+c;
      cells.push(new TableCell({
        width:{size:widths[c],type:WidthType.DXA},
        margins:{top:0,bottom:0,left:40,right:40},
        borders:{top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},
          left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE}},
        children:[new Paragraph({children:[
          new TextRun({text:'ABCD'[i]+'. ',bold:true}),...runs(options[i])],
          keepNext:r<4/cols-1,spacing:{before:0,after:40,line:250},widowControl:true})]
      }));
    }
    rows.push(new TableRow({cantSplit:true,children:cells}));
  }
  return new Table({width:{size:WIDTH,type:WidthType.DXA},columnWidths:widths,rows});
}
function answerGrid(rows) {
  const cols=rows[0].length;
  let widths=Array(cols).fill(Math.floor(WIDTH/cols));
  widths[cols-1]=WIDTH-widths.slice(0,-1).reduce((a,b)=>a+b,0);
  return new Table({width:{size:WIDTH,type:WidthType.DXA},columnWidths:widths,
    rows:rows.map((row,i)=>new TableRow({cantSplit:true,children:row.map((text,j)=>
      new TableCell({width:{size:widths[j],type:WidthType.DXA},borders,
        shading:i===0?{type:ShadingType.CLEAR,fill:'EEEEEE'}:undefined,
        margins:{top:50,bottom:50,left:40,right:40},
        children:[p(String(text),{bold:i===0||j===0,alignment:AlignmentType.CENTER,
          spacing:{after:0,line:240}})]}))}))});
}
function body(e,key) {
  const children=[title(e,key)];
  if(!key) children.push(p('Họ và tên: ..............................................................  Lớp: ............  Số báo danh: ............',
    {spacing:{before:100,after:100}}));
  const constants=e.instructions;
  children.push(p(constants,{size:22,spacing:{before:60,after:80,line:240}}));
  if(key) {
    children.push(p('Thang điểm: Phần I: 0,25 điểm/câu; Phần II: đúng 1, 2, 3, 4 ý lần lượt được 0,10; 0,25; 0,50; 1,00 điểm; Phần III: 0,25 điểm/câu. Tổng điểm: 10,00.',
      {spacing:{after:110}}));
    const part1=e.questions.filter(q=>q.part===1);
    children.push(heading(1));
    children.push(answerGrid([['Câu',...Array.from({length:9},(_,i)=>i+1)],
      ['Đáp án',...part1.slice(0,9).map(q=>'ABCD'[q.answerIndex])],
      ['Câu',...Array.from({length:9},(_,i)=>i+10)],
      ['Đáp án',...part1.slice(9).map(q=>'ABCD'[q.answerIndex])]]));
    children.push(heading(2));
    const part2=e.questions.filter(q=>q.part===2);
    children.push(answerGrid([['Ý / Câu','1','2','3','4'],
      ...[0,1,2,3].map(i=>['abcd'[i]+')',...part2.map(q=>q.statements[i].answer?'Đ':'S')])]));
    children.push(heading(3));
    children.push(answerGrid([['Câu','1','2','3','4','5','6'],
      ['Đáp số',...e.questions.filter(q=>q.part===3).map(q=>String(q.answer).replace('.',','))]]));
    children.push(p('HƯỚNG DẪN GIẢI VÀ LƯU Ý CHẤM',{bold:true,
      spacing:{before:180,after:80},keepNext:true}));
  }
  let lastPart=0, no=0;
  for(const q of e.questions) {
    if(q.part!==lastPart) {
      lastPart=q.part;no=0;
      children.push(heading(q.part));
      if(!key)children.push(p(e.parts.find(x=>x.part===q.part).hint,
        {keepNext:true,size:22,spacing:{after:80}}));
    }
    no++;
    const content=q.content.replace(/^<p class="exam-constants">.*?<\/p>/,'');
    if(key) {
      const answer=q.part===1?'ABCD'[q.answerIndex]:
        q.part===2?q.statements.map((st,i)=>'abcd'[i]+') '+(st.answer?'Đúng':'Sai')).join('; '):
        String(q.answer).replace('.',',')+(q.unit?' '+q.unit:'');
      children.push(p(`Câu ${no}. ${answer}`,{bold:true,keepNext:true,spacing:{before:65,after:40}}));
      children.push(p(q.explain));
    } else {
      children.push(new Paragraph({children:[new TextRun({text:`Câu ${no}. `,bold:true}),
        ...runs(content)],keepNext:!!q.image||q.part!==3,
        widowControl:true,spacing:{before:65,after:45,line:255}}));
      if(q.image)children.push(image(q));
      if(q.part===1) children.push(optionTable(q.options));
      if(q.part===2) q.statements.forEach((st,i)=>
        children.push(p(`${'abcd'[i]}) ${st.text}`,{keepNext:i<3,
          indent:{left:100},spacing:{after:50,line:255}})));
      if(q.part===3) children.push(p('Đáp số: ................................',{spacing:{after:60}}));
    }
  }
  children.push(p('———————— HẾT ————————',{alignment:AlignmentType.CENTER,bold:true,
    spacing:{before:100,after:70}}));
  return children;
}
async function main() {
  const manifest=[];
  for(const e of exams) {
    for(const key of [false,true]) {
      const name=e.id+(key?'-dap-an':'-hs')+'.docx';
      const doc=new Document({
        creator:'Thầy Hóa Gia Lai',title:(key?'Đáp án – ':'')+e.title,
        description:'Đề ôn tập 18 câu lựa chọn, 4 câu đúng sai, 6 câu trả lời ngắn. Công thức Word dùng subscript/superscript chỉnh sửa được.',
        styles:{default:{document:{run:{font:'Times New Roman',size:24,color:INK},
          paragraph:{spacing:{line:255,after:50}}}}},
        sections:[{
          properties:{page:{size:{width:PAGE_WIDTH,height:PAGE_HEIGHT},
            margin:{top:MARGIN,bottom:MARGIN,left:MARGIN,right:MARGIN,footer:350,header:350}}},
          footers:{default:new Footer({children:[new Paragraph({
            alignment:AlignmentType.RIGHT,children:[
              new TextRun({text:e.code+' · Trang ',size:20}),
              new TextRun({children:[PageNumber.CURRENT],size:20}),
              new TextRun({text:' / ',size:20}),
              new TextRun({children:[PageNumber.TOTAL_PAGES],size:20})
            ]})]})},children:body(e,key)}]
      });
      const buffer=await Packer.toBuffer(doc);
      fs.writeFileSync(path.join(OUT,name),buffer);
      manifest.push({exam:e.id,type:key?'answer':'student',file:'data/docs/'+name,bytes:buffer.length});
    }
  }
  fs.writeFileSync(path.join(REPORT,'documents.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log('Created 8 editable DOCX files in '+OUT);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
