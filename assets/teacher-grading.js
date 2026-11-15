(function(root){
  'use strict';
  const t=v=>String(v??'').normalize('NFC').trim();
  const need=(ok,msg)=>{if(!ok)throw new Error(msg);};
  const tf=v=>t(v).toUpperCase().replace(/Đ/g,'D').replace(/\s/g,'');
  function number(v,label){const s=t(v).replace(',','.');need(/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(s)&&Number.isFinite(Number(s)),`${label}: cần số hợp lệ.`);return Number(s);}
  function records(rows,required){
    need(Array.isArray(rows)&&rows.length>1,'Chưa có dòng dữ liệu.');const head=rows[0].map(v=>t(v));
    need(new Set(head).size===head.length&&head.every(Boolean),'Tên cột trùng hoặc trống.');
    required.forEach(k=>need(head.includes(k),`Thiếu cột ${k}.`));
    return rows.slice(1).map((r,i)=>{need(r.length<=head.length,`Dòng ${i+2} nhiều ô hơn tiêu đề.`);return Object.fromEntries(head.map((h,k)=>[h,t(r[k])]));});
  }
  function keys(rows){
    const rec=records(rows,['code','part','question','answer']),out=new Map();
    rec.forEach((r,i)=>{
      need(/^\d{1,8}$/.test(r.code)&&/^[123]$/.test(r.part)&&/^[1-9]\d{0,2}$/.test(r.question),`Đáp án dòng ${i+2}: mã đề / phần / câu không hợp lệ.`);
      const part=Number(r.part),question=Number(r.question),id=`${['','I','II','III'][part]}.${question}`;
      const answers=r.answer.split('|').map(t);need(answers.every(Boolean),'Đáp án không được trống.');
      if(part===1)need(answers.every(a=>/^[A-D]$/.test(a.toUpperCase())),`${id}: cần A–D, có thể dùng A|C.`);
      if(part===2)need(answers.length===1&&/^[DS*]{4}$/.test(tf(answers[0])),`${id}: cần 4 ý Đ/S, dùng * cho ý chấp nhận cả hai.`);
      if(part===3)need(answers.every(a=>a.length<=100),`${id}: đáp án quá dài.`);
      if(!out.has(r.code))out.set(r.code,new Map());const map=out.get(r.code);need(!map.has(id),`${r.code}: trùng ${id}.`);map.set(id,{id,part,question,answers});
    });
    const first=[...out.values()][0];
    for(const [code,map] of out){need(map.size===first.size&&[...first.keys()].every(k=>map.has(k)),`Mã ${code}: bộ câu không khớp mã đầu tiên.`);}
    return out;
  }
  function fromVersions(versions){
    need(Array.isArray(versions)&&versions.length>0&&versions.length<=27,'Bộ mã đề không hợp lệ.');
    const rows=[['code','part','question','answer']];
    versions.forEach(v=>{need(v&&['p1','p2','p3'].every(k=>Array.isArray(v[k])&&v[k].length<=40),'Cấu trúc mã đề không hợp lệ.');need(![...v.p1,...v.p2,...v.p3].some(x=>x.q?.needsReview),'Đáp án còn cảnh báo cần rà soát trong đề gốc.');v.p1.forEach((x,i)=>rows.push([v.code,1,i+1,x.ansLetter]));v.p2.forEach((x,i)=>{need(Array.isArray(x.ansArr)&&x.ansArr.length===4&&x.ansArr.every(b=>typeof b==='boolean'),'Đáp án đúng/sai không hợp lệ.');rows.push([v.code,2,i+1,x.ansArr.map(b=>b?'D':'S').join('')]);});v.p3.forEach((x,i)=>rows.push([v.code,3,i+1,x.ansVal]));});
    keys(rows);return rows;
  }
  function grade(keyRows,studentRows,options={}){
    const key=keys(keyRows),weights={p1:options.p1??.25,p3:options.p3??.25};
    Object.values(weights).forEach(v=>need(typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=100,'Trọng số phải lớn hơn 0 và không quá 100.'));
    const students=records(studentRows,['id','name','class','code']),seen=new Set();
    const headers=studentRows[0].map(t),expected=[...[...key.values()][0].keys()];
    need(expected.every(k=>headers.includes(k)),'Thiếu cột câu trả lời: '+expected.filter(k=>!headers.includes(k)).join(', '));
    need(headers.every(h=>['id','name','class','code'].includes(h)||expected.includes(h)),'Có cột không được nhận diện. Kiểm tra lại mẫu CSV.');
    return students.map((s,row)=>{
      need(s.id&&s.name&&s.class&&s.id.length<=40&&s.name.length<=100&&s.class.length<=40,`Dòng ${row+2}: cần mã học sinh, họ tên và lớp.`);
      const studentId=JSON.stringify([s.class,s.id]);need(!seen.has(studentId),`Trùng mã ${s.id} trong lớp ${s.class}.`);seen.add(studentId);
      const map=key.get(s.code);need(map,`Dòng ${row+2}: mã đề ${s.code} chưa có đáp án.`);
      let score=0,max=0;const detail=[];
      for(const q of map.values()){
        const answer=t(s[q.id]);let got=0,cap=weights[q.part===1?'p1':'p3'];
        if(q.part===1){need(!answer||/^[A-D]$/i.test(answer),`${s.id} ${q.id}: câu trả lời phải là A–D hoặc bỏ trống.`);got=q.answers.some(a=>a.toUpperCase()===answer.toUpperCase())?cap:0;}
        if(q.part===2){
          cap=1;const picked=tf(answer),correct=tf(q.answers[0]);need(!picked||/^[DS?\-]{4}$/.test(picked),`${s.id} ${q.id}: cần 4 ký tự Đ/S; dùng ? cho ý bỏ trống.`);
          let n=0;for(let i=0;i<4;i++)if(/[DS]/.test(picked[i]||'!')&&(correct[i]==='*'||picked[i]===correct[i]))n++;
          got=[0,.1,.25,.5,1][n];
        }
        if(q.part===3&&answer){need(answer.length<=100,`${s.id} ${q.id}: câu trả lời quá dài.`);const numeric=a=>/^-?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(a);got=q.answers.some(a=>numeric(a)&&numeric(answer)?Math.abs(Number(a.replace(',','.'))-Number(answer.replace(',','.')))<=1e-9:t(a).toLocaleLowerCase('vi')===answer.toLocaleLowerCase('vi'))?cap:0;}
        score+=got;max+=cap;detail.push({question:q.id,answer,expected:q.answers.join(' | '),got,max:cap});
      }
      return {id:s.id,name:s.name,class:s.class,code:s.code,score:Math.round(score*1e6)/1e6,max,normalized10:score/max*10,detail};
    });
  }
  function results(rows){
    const list=records(rows,['id','name','class','subject','score','max']),seen=new Set(),identities=new Map();
    return list.map((r,i)=>{
      need(r.id&&r.name&&r.class&&r.subject&&r.id.length<=40&&r.name.length<=100&&r.class.length<=40&&r.subject.length<=80,`Dòng ${i+2}: thiếu hoặc quá dài thông tin học sinh / môn.`);
      const score=number(r.score,`Dòng ${i+2} điểm`),max=number(r.max,`Dòng ${i+2} tối đa`);need(max>0&&max<=10000&&score>=0&&score<=max,`Dòng ${i+2}: điểm phải nằm trong 0–tối đa.`);
      const identity=JSON.stringify([r.class,r.id]),k=JSON.stringify([r.class,r.id,r.subject]);need(!seen.has(k),`Trùng kết quả ${r.id} / ${r.subject}. Chỉ giữ một lượt trước khi nhập.`);seen.add(k);
      need(!identities.has(identity)||identities.get(identity)===r.name,`Mã ${r.id} có hai họ tên khác nhau.`);identities.set(identity,r.name);
      return {id:r.id,name:r.name,class:r.class,subject:r.subject,score,max};
    });
  }
  function aggregate(list,subjects){
    need(Array.isArray(subjects)&&subjects.length>0,'Chọn ít nhất một môn.');const groups=new Map();
    list.forEach(r=>{const k=JSON.stringify([r.class,r.id]);if(!groups.has(k))groups.set(k,{id:r.id,name:r.name,class:r.class,bySubject:new Map()});groups.get(k).bySubject.set(r.subject,r.score/r.max*10);});
    const all=[...groups.values()].map(s=>{const missing=subjects.filter(x=>!s.bySubject.has(x));return {...s,missing,total:missing.length?null:subjects.reduce((n,x)=>n+s.bySubject.get(x),0)};});
    const complete=all.filter(s=>!s.missing.length).sort((a,b)=>b.total-a.total||a.id.localeCompare(b.id));
    complete.forEach((r,i)=>{r.rank=i&&Math.abs(r.total-complete[i-1].total)<1e-9?complete[i-1].rank:i+1;});return {complete,incomplete:all.filter(s=>s.missing.length)};
  }
  function restore(source){
    need(source&&source.app==='phongthi247-results'&&source.schemaVersion===1&&Array.isArray(source.rows)&&source.rows.length<=10000,'Tệp sao lưu không đúng định dạng.');
    return results([['id','name','class','subject','score','max'],...source.rows.map(r=>[r.id,r.name,r.class,r.subject,r.score,r.max])]);
  }
  const API={keys,grade,results,aggregate,restore,fromVersions};root.PTWGrading=API;if(typeof module!=='undefined')module.exports=API;
  if(typeof document==='undefined'||!document.getElementById('grade-form'))return;
  const $=id=>document.getElementById(id);let graded=[],imported=[],keyRows=null,dirty=false;
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  const status=(id,msg,error=false)=>{$(id).textContent=msg;$(id).classList.toggle('error',error);if(error)$(id).focus();};
  function table(id,head,rows){const host=$(id);host.replaceChildren();const el=document.createElement('table');el.className='tools-table';el.createCaption().textContent=`${rows.length} dòng`;const tr=el.createTHead().insertRow();head.forEach(x=>{const th=document.createElement('th');th.scope='col';th.textContent=x;tr.append(th);});const body=el.createTBody();rows.slice(0,500).forEach(r=>{const tr=body.insertRow();r.forEach(v=>{tr.insertCell().textContent=v;});});host.append(el);if(rows.length>500){const p=document.createElement('p');p.textContent='Hiển thị 500 dòng đầu; tệp tải xuống chứa đủ dữ liệu.';host.append(p);}}
  const read=async id=>{const f=$(id).files[0];need(f,'Chọn tệp '+$(id).labels[0].textContent);const sheets=await PTWData.readFile(f);const data=sheets.filter(s=>s.rows.length>1);need(data.length===1,'Cần tệp chỉ có một sheet dữ liệu (hoặc lưu sheet cần dùng thành CSV).');return data[0].rows;};
  function showGrade(){table('grade-output',['Mã HS','Họ tên','Lớp','Mã đề','Điểm','Tối đa','Quy về 10'],graded.map(r=>[r.id,r.name,r.class,r.code,r.score,r.max,r.normalized10.toFixed(2)]));$('grade-export').hidden=false;dirty=true;status('grade-status',`Đã chấm ${graded.length} bài. Đúng/sai theo bậc 0 / 0,1 / 0,25 / 0,5 / 1. Tải bảng điểm hoặc chuyển sang tổng hợp trước khi đóng trang.`);}
  $('grade-form').addEventListener('submit',async e=>{e.preventDefault();const btn=$('grade-submit');btn.disabled=true;try{const k=$('key-file').files.length?await read('key-file'):keyRows;need(k,'Chọn tệp đáp án hoặc chuyển từ trang QR.');const next=grade(k,await read('answers-file'),{p1:Number($('weight1').value),p3:Number($('weight3').value)});graded=next;keyRows=k;showGrade();}catch(err){status('grade-status',err.message+(graded.length?' Bảng điểm trước vẫn được giữ.':''),true);}finally{btn.disabled=false;}});
  $('grade-csv').addEventListener('click',()=>PTWData.download('ket-qua-cham.csv',PTWData.csvOut([['id','name','class','code','score','max','normalized10'],...graded.map(r=>[r.id,r.name,r.class,r.code,r.score,r.max,r.normalized10.toFixed(4)])]),'text/csv;charset=utf-8'));
  $('grade-detail').addEventListener('click',()=>PTWData.download('chi-tiet-cham.csv',PTWData.csvOut([['id','class','code','question','answer','got','max'],...graded.flatMap(r=>r.detail.map(d=>[r.id,r.class,r.code,d.question,d.answer,d.got,d.max]))]),'text/csv;charset=utf-8'));
  function paintSubjects(){const host=$('subjects');host.replaceChildren();[...new Set(imported.map(r=>r.subject))].sort().forEach((s,i)=>{const line=document.createElement('div'),input=document.createElement('input'),label=document.createElement('label');input.type='checkbox';input.name='subject';input.value=s;input.id='subject-'+i;input.checked=true;label.htmlFor=input.id;label.className='inline-label';label.textContent=s;line.append(input,label);host.append(line);});$('results-actions').hidden=!imported.length;}
  $('results-load').addEventListener('click',async()=>{const btn=$('results-load');btn.disabled=true;try{const next=results(await read('results-file'));if(imported.length&&!window.confirm('Thay bảng tổng hợp hiện tại bằng tệp mới? Tải sao lưu trước nếu cần giữ.'))return;imported=next;dirty=true;paintSubjects();$('results-output').replaceChildren();status('results-status',`Đã kiểm tra ${imported.length} kết quả. Chọn môn rồi bấm Tổng hợp.`);}catch(e){status('results-status',e.message+(imported.length?' Bảng trước vẫn được giữ.':''),true);}finally{btn.disabled=false;}});
  function summarize(){const selected=[...document.querySelectorAll('#subjects input:checked')].map(x=>x.value);const r=aggregate(imported,selected);const rows=[...r.complete.map(s=>[s.rank,s.id,s.name,s.class,s.total.toFixed(4),'Đủ điểm']),...r.incomplete.map(s=>['—',s.id,s.name,s.class,'—','Thiếu: '+s.missing.join(', ')])];table('results-output',['Hạng','Mã HS','Họ tên','Lớp','Tổng (mỗi môn /10)','Trạng thái'],rows);status('results-status',`${r.complete.length} học sinh đủ điểm, ${r.incomplete.length} chưa đủ. Hạng tính chung các lớp trong tệp.`);return rows;}
  $('results-form').addEventListener('submit',e=>{e.preventDefault();try{summarize();}catch(err){status('results-status',err.message,true);}});
  $('results-csv').addEventListener('click',()=>{try{const rows=summarize();PTWData.download('tong-hop-diem.csv',PTWData.csvOut([['rank','id','name','class','total','status'],...rows]),'text/csv;charset=utf-8');}catch(e){status('results-status',e.message,true);}});
  $('backup').addEventListener('click',()=>{PTWData.download('sao-luu-bang-diem.json',JSON.stringify({app:'phongthi247-results',schemaVersion:1,rows:imported},null,2),'application/json');status('results-status','Đã yêu cầu tải sao lưu. Kiểm tra tệp đã lưu trên thiết bị trước khi đóng trang.');});
  $('restore').addEventListener('change',async()=>{try{const f=$('restore').files[0];need(f&&f.size<=5e6,'Chọn JSON dưới 5 MB.');const next=restore(JSON.parse(await f.text()));if(imported.length&&!window.confirm('Khôi phục sẽ thay bảng điểm hiện tại. Đã tải sao lưu cần giữ?'))return;imported=next;dirty=true;paintSubjects();$('results-output').replaceChildren();status('results-status','Đã khôi phục bảng điểm. Chọn môn để tổng hợp lại.');}catch(e){status('results-status',e.message,true);}finally{$('restore').value='';}});
  $('clear-results').addEventListener('click',()=>{if((imported.length||graded.length)&&!window.confirm('Xóa bài chấm và bảng điểm trong phiên? Tệp đã tải xuống vẫn được giữ.'))return;imported=[];graded=[];keyRows=null;dirty=false;$('grade-output').replaceChildren();$('results-output').replaceChildren();$('grade-export').hidden=true;paintSubjects();$('grade-form').reset();$('results-form').reset();$('restore').value='';status('results-status','Đã xóa dữ liệu trong phiên này. Tệp đã tải xuống vẫn nằm trên thiết bị.');status('grade-status','Đã xóa bộ đáp án và bài chấm.');});
  const samples={key:[['code','part','question','answer'],['101','1','1','A|C'],['101','2','1','DSD*'],['101','3','1','2.5|2,50']],answers:[['id','name','class','code','I.1','II.1','III.1'],['001','Học sinh mẫu','Lớp mẫu','101','C','DSDS','2.5']],results:[['id','name','class','subject','score','max'],['001','Học sinh mẫu','Lớp mẫu','Môn A','8','10'],['001','Học sinh mẫu','Lớp mẫu','Môn B','7','10']]};
  document.querySelectorAll('[data-sample]').forEach(b=>b.addEventListener('click',()=>PTWData.download(b.dataset.sample+'-mau.csv',PTWData.csvOut(samples[b.dataset.sample]),'text/csv;charset=utf-8')));
  $('grade-demo').addEventListener('click',()=>{try{if(graded.length&&!window.confirm('Thay bài chấm hiện tại bằng dữ liệu mẫu?'))return;graded=grade(samples.key,samples.answers);keyRows=samples.key;$('grade-form').reset();showGrade();}catch(e){status('grade-status',e.message,true);}});
  $('answers-template').addEventListener('click',async()=>{try{const rows=$('key-file').files.length?await read('key-file'):keyRows;need(rows,'Chọn tệp đáp án hoặc chuyển từ QR trước khi tạo mẫu khớp đề.');const k=keys(rows);keyRows=rows;PTWData.download('cau-tra-loi-theo-de.csv',PTWData.csvOut([['id','name','class','code',...[...k.values()][0].keys()],...Array.from(k.keys(),code=>['','','',code,...Array(k.values().next().value.size).fill('')])]),'text/csv;charset=utf-8');status('grade-status','Đã tạo mẫu câu trả lời đúng số câu. Điền mã học sinh, tên, lớp và đáp án; nhân bản dòng để thêm bài.');}catch(e){status('grade-status',e.message,true);}});
  $('grade-to-results').addEventListener('click',()=>{try{need(graded.length,'Chấm bài trước.');const subject=t($('grade-subject').value);need(subject&&subject.length<=80,'Nhập tên môn (tối đa 80 ký tự).');const head=['id','name','class','subject','score','max'];const merged=results([head,...imported.map(r=>head.map(h=>r[h])),...graded.map(r=>[r.id,r.name,r.class,subject,r.score,r.max])]);imported=merged;dirty=true;paintSubjects();summarize();$('results-heading').scrollIntoView({behavior:'smooth'});}catch(e){status('grade-status',e.message,true);}});
  $('grade-print').addEventListener('click',()=>{
    let host=document.getElementById('return-sheets');if(!host){host=document.createElement('div');host.id='return-sheets';document.body.append(host);}host.replaceChildren();
    graded.forEach(r=>{const page=document.createElement('section');page.className='return-sheet';const h=document.createElement('h1');h.textContent='Phiếu kết quả · '+r.name;const info=document.createElement('p');info.textContent=`Mã HS: ${r.id} · Lớp: ${r.class} · Mã đề: ${r.code} · Điểm: ${r.score}/${r.max} · Quy về 10: ${r.normalized10.toFixed(2)}`;page.append(h,info);const table=document.createElement('table');table.className='tools-table';const tr=table.createTHead().insertRow();['Câu','Đã trả lời','Đáp án','Điểm','Kết quả'].forEach(x=>{const th=document.createElement('th');th.textContent=x;tr.append(th);});const body=table.createTBody();r.detail.forEach(d=>{const row=body.insertRow();[d.question,d.answer||'Bỏ trống',d.expected,d.got+'/'+d.max,d.got===d.max?'Đúng':d.got?'Đúng một phần':'Sai / bỏ trống'].forEach(x=>row.insertCell().textContent=x);});page.append(table);host.append(page);});document.body.classList.add('printing-returns');window.print();
  });
  function clearPrint(){document.body.classList.remove('printing-returns');document.getElementById('return-sheets')?.replaceChildren();}
  window.addEventListener('afterprint',clearPrint);
  $('clear-results').addEventListener('click',()=>{if(!graded.length&&!imported.length)clearPrint();});
  window.addEventListener('message',e=>{
    if(e.origin!==location.origin||e.source!==window.opener||e.data?.type!=='ptw-camera-results')return;
    try{need(Array.isArray(e.data.rows)&&e.data.rows.length<=10001,'Bảng điểm camera quá lớn.');const next=results(e.data.rows);const h=['id','name','class','subject','score','max'];
      const combined=results([h,...imported.map(r=>h.map(k=>r[k])),...next.map(r=>h.map(k=>r[k]))]);imported=combined;dirty=true;paintSubjects();summarize();status('results-status',`Đã nhận ${next.length} bài đã duyệt từ camera. Tải sao lưu trước khi đóng trang.`);
    }catch(err){status('results-status',err.message+' Bảng trước được giữ.',true);}
  });
  if(location.hash==='#camera'&&window.opener)window.opener.postMessage({type:'ptw-results-ready'},location.origin);
  try{const raw=sessionStorage.getItem('ptw_teacher_key_v1');sessionStorage.removeItem('ptw_teacher_key_v1');if(raw){need(raw.length<=1e6,'Bộ đáp án quá lớn.');const data=JSON.parse(raw);need(data.schemaVersion===1,'Phiên bản đáp án không được hỗ trợ.');keyRows=fromVersions(data.versions);status('grade-status','Đã nhận đáp án từ QR. Chọn CSV câu trả lời để chấm.');}}catch(e){status('grade-status',e.message,true);}
})(typeof window!=='undefined'?window:globalThis);
