(function(root){
  'use strict';
  const t=v=>String(v??'').normalize('NFC').trim();
  function need(ok,msg){if(!ok)throw new Error(msg);}
  const tf=v=>t(v).toUpperCase().replace(/Đ/g,'D').replace(/\s/g,'');
  function parse(rows,format='tnmaker'){
    need(Array.isArray(rows)&&rows.length>1,'Sheet chưa có đáp án.');
    const versions=[];
    if(format==='youngmix'){
      need(t(rows[0][41]).toLowerCase()==='1a','YoungMix cần cột 1–40, 1a–8d rồi các câu trả lời ngắn.');
      rows.slice(1).forEach((r,i)=>{
        if(!r.some(v=>t(v)))return;
        const p1=r.slice(1,41).map(t), p2=[],p3=r.slice(73).map(t);
        while(p1.length&&!p1.at(-1))p1.pop();
        for(let j=0;j<8;j++)p2.push(Array.from({length:4},(_,k)=>t(r[41+j*4+k])).join(''));
        while(p2.length&&!p2.at(-1))p2.pop();
        while(p3.length&&!p3.at(-1))p3.pop();
        versions.push(version(r[0],p1,p2,p3,`Dòng ${i+2}`));
      });
    }else{
      need(['tnmaker','smarttest'].includes(format),'Định dạng không hợp lệ.');
      const data=rows.slice(1).filter(r=>r.some(v=>t(v)));
      // Detect part boundaries from the entire row, then validate every code against that layout.
      let stage=1; const layout=[];
      for(const r of data){
        const cells=r.slice(1).map(t).filter(Boolean);
        need(cells.length>0,'Có dòng câu hỏi không có đáp án; hãy điền đủ trước khi tạo QR.');
        const part=cells.every(v=>/^[A-D]$/i.test(v))?1:cells.every(v=>/^[DS]{4}$/.test(tf(v)))?2:3;
        need(part>=stage,'Thứ tự phải là phần I, II rồi III. Kiểm tra ô đáp án khác loại.');stage=part;layout.push(part);
      }
      let previousPart=0,previousNumber=0;
      data.forEach((r,i)=>{
        const number=Number(t(r[0])),part=layout[i];
        const expected=part===previousPart?previousNumber+1:(format==='smarttest'?previousNumber+1:1);
        need(/^[1-9]\d*$/.test(t(r[0]))&&number===expected,`Dòng ${i+2}: số câu phải là ${expected}; không được thiếu, trùng hoặc đảo thứ tự.`);
        previousPart=part;previousNumber=number;
      });
      const n=Math.max(...rows.map(r=>r.length));
      for(let c=1;c<n;c++){
        const vals=data.map(r=>t(r[c]));
        if(!t(rows[0][c])&&!vals.some(Boolean))continue;
        versions.push(version(rows[0][c],vals.filter((_,i)=>layout[i]===1),vals.filter((_,i)=>layout[i]===2),vals.filter((_,i)=>layout[i]===3),`Cột ${c+1}`));
      }
    }
    need(versions.length>0&&versions.length<=27,'Cần từ 1 đến 27 mã đề.');
    const codes=new Set(); const first=versions[0];
    versions.forEach(v=>{need(!codes.has(v.code),`Mã đề ${v.code} bị trùng.`);codes.add(v.code);need(['p1','p2','p3'].every(k=>v[k].length===first[k].length),'Các mã đề phải có cùng số câu mỗi phần.');});
    return versions;
  }
  function version(code,p1,p2,p3,where){
    code=t(code);need(/^\d{1,8}$/.test(code),`${where}: mã đề phải có 1–8 chữ số; giữ nguyên số 0 đầu.`);
    need(p1.length<=40&&p2.length<=8&&p3.length<=8,`${where}: giới hạn 40/8/8 câu.`);
    need(p1.length+p2.length+p3.length>0,`${where}: chưa có đáp án.`);
    p1=p1.map((v,i)=>{v=t(v).toUpperCase();need(/^[A-D]$/.test(v),`${where}, I.${i+1}: cần A, B, C hoặc D.`);return {ansLetter:v};});
    p2=p2.map((v,i)=>{v=tf(v);need(/^[DS]{4}$/.test(v),`${where}, II.${i+1}: cần đủ 4 ý Đ/S.`);return {ansArr:[...v].map(x=>x==='D')};});
    p3=p3.map((v,i)=>{v=t(v).replace(',','.');need(/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(v)&&Number.isFinite(Number(v)),`${where}, III.${i+1}: cần một số hợp lệ.`);return {ansVal:v};});
    return {code,p1,p2,p3};
  }
  function roster(rows){
    need(rows.length>1&&['id','name','class'].every((k,i)=>t(rows[0][i]).toLowerCase()===k),'Danh sách cần các cột id,name,class.');
    const seen=new Set();return rows.slice(1).map((r,i)=>{const id=t(r[0]),name=t(r[1]),cls=t(r[2]);need(id&&name&&cls&&id.length<=40&&name.length<=100&&cls.length<=40,`Dòng ${i+2}: thiếu hoặc quá dài mã, tên, lớp.`);need(!seen.has(id),`Mã học sinh ${id} bị trùng.`);seen.add(id);return {id,name,class:cls};});
  }
  const API={parse,version,roster};root.PTWQR=API;if(typeof module!=='undefined')module.exports=API;
  if(typeof document==='undefined')return;
  const $=id=>document.getElementById(id);let sheets=[],versions=[],payloads=[],busy=false;
  const status=(msg,error=false)=>{$('qr-status').textContent=msg;$('qr-status').classList.toggle('error',error);};
  function clear(){versions=[];payloads=[];$('qr-preview').replaceChildren();$('qr-output').replaceChildren();$('qr-export').hidden=true;}
  function preview(headers,rows){const table=document.createElement('table');table.className='tools-table';const cap=table.createCaption();cap.textContent=`${rows.length} mục đã kiểm tra`;const tr=table.createTHead().insertRow();headers.forEach(h=>{const th=document.createElement('th');th.scope='col';th.textContent=h;tr.append(th);});const body=table.createTBody();rows.slice(0,100).forEach(r=>{const tr=body.insertRow();r.forEach(v=>{tr.insertCell().textContent=v;});});$('qr-preview').append(table);}
  function draw(payloads){
    qrcode.stringToBytes=qrcode.stringToBytesFuncs['UTF-8'];
    const cards=[];
    payloads.forEach((payload,i)=>{
      const qr=qrcode(0,'M');try{qr.addData(payload);qr.make();}catch(_){throw new Error(`QR ${i+1} quá nhiều dữ liệu. Giảm số dòng hoặc độ dài tên.`);}
      const section=document.createElement('section');section.className='qr-sheet';const h=document.createElement('h3');h.textContent=`QR ${i+1}/${payloads.length}`;
      const canvas=document.createElement('canvas'),n=qr.getModuleCount(),scale=6,quiet=4;canvas.width=canvas.height=(n+quiet*2)*scale;
      canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`QR ${i+1}. Có thể tải nội dung JSON thay cho quét.`);
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(qr.isDark(r,c))ctx.fillRect((c+quiet)*scale,(r+quiet)*scale,scale,scale);
      const a=document.createElement('a');a.textContent='Tải PNG';a.className='btn no-print';a.download=`phongthi247-qr-${i+1}.png`;a.href=canvas.toDataURL('image/png');section.append(h,canvas,document.createElement('br'),a);cards.push(section);
    });$('qr-output').append(...cards);
  }
  $('qr-file').addEventListener('change',async()=>{
    if(busy)return;clear();sheets=[];$('qr-sheet').replaceChildren();const file=$('qr-file').files[0];if(!file)return;busy=true;$('qr-generate').disabled=true;
    try{sheets=await PTWData.readFile(file);sheets.forEach((s,i)=>{const o=new Option(`${s.name} · ${s.rows.length} dòng`,String(i));$('qr-sheet').add(o);});$('qr-sheet').value=String(Math.max(0,sheets.findIndex(s=>s.rows.length>1)));status('Đã đọc tệp. Chọn sheet và định dạng, rồi kiểm tra / tạo QR.');}catch(e){status(e.message,true);}finally{busy=false;$('qr-generate').disabled=false;}
  });
  $('qr-form').addEventListener('submit',e=>{
    e.preventDefault();clear();try{
      const rows=$('qr-text').value.trim()?PTWData.csv($('qr-text').value):sheets[Number($('qr-sheet').value)]?.rows;
      need(rows?.length,'Chọn tệp hoặc dán CSV trước.');const format=$('qr-format').value;
      if(format==='roster'){
        const list=roster(rows);need(list.length<=1000,'Tối đa 1.000 học sinh; chia nhỏ tệp nếu nhiều hơn.');
        for(let i=0;i<list.length;i+=12)payloads.push(JSON.stringify({app:'phongthi247',schemaVersion:1,type:'roster',part:Math.floor(i/12)+1,total:Math.ceil(list.length/12),students:list.slice(i,i+12)}));
        preview(['Mã','Họ tên','Lớp'],list.map(x=>[x.id,x.name,x.class]));status('QR danh sách nội bộ Phòng Thi 24/7. Chưa xác nhận tương thích TNMaker hoặc ChấmPro.');
      }else{
        versions=parse(rows,format);const result=TNMakerQR.build(versions);need(result.ok,result.err);payloads=result.payloads;
        preview(['Mã đề','Phần I','Phần II','Phần III'],versions.map(v=>[v.code,v.p1.length,v.p2.length,v.p3.length]));status(`Đã kiểm tra ${versions.length} mã đề. Mã QR dùng payload TNMaker type 6; cần quét thử trên phiên bản ứng dụng của thầy.`);
      }
      draw(payloads);$('qr-export').hidden=false;
    }catch(err){clear();status(err.message,true);$('qr-status').focus();}
  });
  for(const id of ['qr-format','qr-sheet','qr-text'])$(id).addEventListener('input',()=>{clear();status('Dữ liệu đã đổi. Bấm Kiểm tra và tạo QR để cập nhật.');});
  $('qr-json').addEventListener('click',()=>PTWData.download('qr-payloads.json',JSON.stringify(payloads.map(x=>JSON.parse(x)),null,2),'application/json'));
  $('qr-print').addEventListener('click',()=>window.print());
  $('qr-key').addEventListener('click',()=>{try{need(versions.length,'Chỉ chuyển được bộ đáp án.');sessionStorage.setItem('ptw_teacher_key_v1',JSON.stringify({schemaVersion:1,versions}));location.href='cham-bai.html';}catch(e){status(e.message,true);}});
  $('qr-camera').addEventListener('click',()=>{try{need(versions.length,'Chỉ chuyển được bộ đáp án.');need(versions.every(v=>/^\d{1,4}$/.test(v.code)),'Camera cần mã đề 1–4 chữ số.');sessionStorage.setItem('ptw_teacher_key_v1',JSON.stringify({schemaVersion:1,versions}));location.href='quet-bai.html';}catch(e){status(e.message,true);}});
  $('qr-sample').addEventListener('click',()=>PTWData.download('dap-an-mau.csv',PTWData.csvOut([['Câu\\Mã đề','101','102'],['1','A','B'],['2','C','D'],['1','ĐSĐS','SSĐĐ'],['1','2.5','-1']]),'text/csv;charset=utf-8'));
})(typeof window!=='undefined'?window:globalThis);
