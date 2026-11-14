'use strict';
// Real Edge/CDP integration; no npm dependencies. Fixtures remain outside the repo.
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(process.env.LOCALAPPDATA,'Temp','opencode');
const fixtures=process.env.PTW_XLSX_FIXTURES||path.join(out,'tnmaker-reference');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const server=spawn('python',['-m','http.server','8767','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
  const browser=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--remote-debugging-port=9337',`--user-data-dir=${path.join(out,'teacher-edge-'+Date.now())}`,'about:blank'],{stdio:'ignore'});
  let ws,id=0;const pending=new Map(),errors=[];
  const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
  const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  const wait=async expression=>{for(let i=0;i<80;i++){if(await ev(expression).catch(()=>false))return;await delay(100);}throw Error('Timed out: '+expression);};
  const open=async page=>{await send('Page.navigate',{url:'http://127.0.0.1:8767/'+page});await wait(`document.readyState==='complete'&&!!document.querySelector('main')`);};
  const file=async(selector,name)=>{const {root}=await send('DOM.getDocument');const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector});await send('DOM.setFileInputFiles',{nodeId,files:[name]});};
  const ok=(value,message)=>{assert.ok(value,message);console.log('PASS '+message);};
  try{
    let target;for(let i=0;i<60&&!target;i++){try{target=(await(await fetch('http://127.0.0.1:9337/json/list')).json()).find(x=>x.type==='page');}catch{}if(!target)await delay(150);}
    ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
    ws.onmessage=({data})=>{const d=JSON.parse(data);if(d.id){const p=pending.get(d.id);if(p){pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}}else if(d.method==='Runtime.exceptionThrown')errors.push(d.params.exceptionDetails.exception?.description||d.params.exceptionDetails.text);};
    await send('Page.enable');await send('Runtime.enable');await send('DOM.enable');
    await send('Page.addScriptToEvaluateOnNewDocument',{source:"window.confirm=()=>true;window.addEventListener('beforeunload',e=>e.stopImmediatePropagation(),true);"});
    await open('qr.html');
    const padded=path.join(out,'teacher-padded-test.xlsx');
    const generated=spawnSync('python',['-c',`import sys,zipfile
with zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('xl/workbook.xml','<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Test" r:id="r1"/></sheets></workbook>')
 z.writestr('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>')
 z.writestr('xl/styles.xml','<styleSheet><numFmts><numFmt numFmtId="164" formatCode="000"/></numFmts><cellXfs><xf/><xf numFmtId="164"/></cellXfs></styleSheet>')
 z.writestr('xl/worksheets/sheet1.xml','<worksheet><sheetData><row><c r="A1" s="1"><v>1</v></c><c r="B1"><v>-2.5</v></c></row></sheetData></worksheet>')
`,padded],{encoding:'utf8'});assert.equal(generated.status,0,generated.stderr);
    const xlsxBytes=fs.readFileSync(padded).toString('base64');
    ok(await ev(`(async()=>{const b=Uint8Array.from(atob(${JSON.stringify(xlsxBytes)}),c=>c.charCodeAt(0));const s=await PTWData.xlsx(b.buffer);return s[0].rows[0][0]==='001'&&s[0].rows[0][1]==='-2.5';})()`),'XLSX custom zero-padding preserves identifiers and negative values');
    for(const [format,name,expected] of [['tnmaker','TNMaker-2025.xlsx',[12,4,6]],['youngmix','YoungMix-2025.xlsx',[18,4,6]],['smarttest','SmartTest-2025.xlsx',[12,5,4]]]){
      await file('#qr-file',path.join(fixtures,name));await wait(`document.querySelector('#qr-sheet').options.length>0&&!document.querySelector('#qr-generate').disabled`);
      const result=await ev(`(()=>{const f=document.getElementById('qr-format');f.value=${JSON.stringify(format)};f.dispatchEvent(new Event('input'));document.getElementById('qr-form').requestSubmit();return {status:document.getElementById('qr-status').textContent,error:document.getElementById('qr-status').classList.contains('error'),counts:[...document.querySelectorAll('#qr-preview tbody tr:first-child td')].map(x=>x.textContent),canvases:document.querySelectorAll('#qr-output canvas').length};})()`);
      ok(!result.error&&result.canvases>0,name+' renders QR: '+result.status);
      assert.deepEqual(result.counts.slice(1).map(Number),expected);
    }
    await ev(`document.getElementById('qr-key').click()`);await wait(`location.pathname.endsWith('cham-bai.html')&&!!window.PTWGrading`);
    ok(await ev(`document.getElementById('grade-status').textContent.includes('Đã nhận')`),'QR key handoff consumed by grading');
    const key=path.join(out,'teacher-key-test.csv'),answers=path.join(out,'teacher-answers-test.csv'),results=path.join(out,'teacher-results-test.csv');
    fs.writeFileSync(key,'code,part,question,answer\n001,1,1,A|C\n001,2,1,DSD*\n001,3,1,2.5');
    fs.writeFileSync(answers,'id,name,class,code,I.1,II.1,III.1\n007,Học sinh mẫu,12A,001,C,DSDS,2.50');
    await file('#key-file',key);await file('#answers-file',answers);await ev(`document.getElementById('grade-form').requestSubmit()`);await wait(`document.querySelectorAll('#grade-output tbody tr').length===1`);
    ok(await ev(`document.querySelector('#grade-output tbody tr').cells[6].textContent==='10.00'`),'CSV UI grades alternatives, TF and decimals');
    const invalid=path.join(out,'teacher-invalid-test.csv');fs.writeFileSync(invalid,'id,name\n1,Invalid');
    await file('#answers-file',invalid);await ev(`document.getElementById('grade-form').requestSubmit()`);await wait(`document.getElementById('grade-status').classList.contains('error')`);
    ok(await ev(`document.querySelector('#grade-output tbody tr').cells[6].textContent==='10.00'`),'Failed grading preserves previous marks');
    await ev(`window.__downloads=[];PTWData.download=(name,content,type)=>__downloads.push({name,content,type});document.getElementById('answers-template').click()`);
    await wait(`__downloads.length===1`);
    ok(await ev(`PTWData.csv(__downloads[0].content)[0].join(',')==='id,name,class,code,I.1,II.1,III.1'`),'Answer template matches the active key');
    await ev(`document.getElementById('grade-subject').value='Hóa học';document.getElementById('grade-to-results').click()`);
    ok(await ev(`document.querySelector('#results-output tbody tr').cells[4].textContent==='10.0000'`),'Grading transfers directly to subject aggregation');
    await ev(`window.print=()=>{window.__printed=true};document.getElementById('grade-print').click()`);
    ok(await ev(`__printed&&document.querySelectorAll('#return-sheets tbody tr').length===3&&document.querySelector('#return-sheets tbody tr').cells[2].textContent==='A | C'`),'Return sheets contain per-question expected answers and scores');
    await ev(`window.dispatchEvent(new Event('afterprint'))`);
    ok(await ev(`!document.body.classList.contains('printing-returns')&&!document.querySelector('#return-sheets').textContent`),'Printing cleans up its page state and sensitive contents');
    fs.writeFileSync(results,'id,name,class,subject,score,max\n1,<img src=x onerror=alert(1)>,A,X,8,10\n1,<img src=x onerror=alert(1)>,A,Y,7,10\n2,Thiếu điểm,A,X,8,10');
    await file('#results-file',results);await ev(`document.getElementById('results-load').click()`);await wait(`document.querySelectorAll('#subjects input').length===2`);
    await ev(`document.getElementById('results-form').requestSubmit()`);
    ok(await ev(`document.querySelectorAll('#results-output tbody tr').length===2&&!document.querySelector('#results-output img')`),'Aggregation renders untrusted names as text and shows missing marks');
    await ev(`window.__downloads=[];PTWData.download=(name,content,type)=>__downloads.push({name,content,type});document.getElementById('backup').click();document.getElementById('results-csv').click()`);
    ok(await ev(`JSON.parse(__downloads[0].content).rows.length===3&&__downloads[1].name.endsWith('.csv')`),'JSON backup and CSV export contain complete rows');
    const backup=path.join(out,'teacher-backup-test.json');fs.writeFileSync(backup,await ev(`__downloads[0].content`));
    await file('#results-file',invalid);await ev(`document.getElementById('results-load').click()`);await wait(`document.getElementById('results-status').classList.contains('error')`);
    ok(await ev(`document.querySelectorAll('#subjects input').length===2&&document.querySelectorAll('#results-output tbody tr').length===2`),'Failed results import preserves subjects and marks');
    await ev(`document.getElementById('clear-results').click()`);await file('#restore',backup);await wait(`document.querySelectorAll('#subjects input').length===2`);
    await ev(`document.getElementById('results-form').requestSubmit()`);
    ok(await ev(`document.querySelectorAll('#results-output tbody tr').length===2`),'JSON restore recovers complete and missing-score rows');
    await ev(`window.confirm=()=>false`);await file('#restore',backup);await delay(100);
    ok(await ev(`document.getElementById('restore').value===''&&document.querySelectorAll('#results-output tbody tr').length===2`),'Cancelled restore preserves existing results');
    await ev(`window.confirm=()=>true;document.getElementById('grade-demo').click()`);
    ok(await ev(`document.querySelector('#grade-output tbody tr').cells[6].textContent==='10.00'`),'In-page sample grades all three question types');
    await open('soan-de.html');
    await ev(`document.getElementById('editor-source').value='Câu 1. Nội dung câu mẫu\\nA. Một\\nB. Hai\\nC. Ba\\nD. Bốn';document.getElementById('editor-form').requestSubmit();document.getElementById('editor-to-mix').click()`);
    await wait(`location.pathname.endsWith('tronde.html')&&!!document.querySelector('#paperPreview .paper-q-block')`);
    ok(await ev(`document.getElementById('paperPreview').textContent.includes('Nội dung câu mẫu')`),'Editor text reaches mixer preview');
    ok(await ev(`(()=>{const dirty='<svg/onload=alert(1)><a href="javascript:alert(2)">x</a><img src=x onerror=alert(3)><b>safe</b>';const host=document.createElement('div');host.innerHTML=sanitizeHTML(dirty);return !host.querySelector('svg,[onload],[onerror],[href^="javascript:"]')&&!!host.querySelector('b');})()`),'HTML sanitizer rejects event-handler and namespace bypasses while keeping formatting');
    await ev(`document.getElementById('btnDownloadTNMakerCol').click();document.getElementById('btnTNMakerQR').click()`);
    ok(await ev(`document.getElementById('mixStatus').textContent.includes('Chưa xuất đáp án')&&!document.querySelector('#tnmQrWrap canvas')`),'Unresolved imported answers cannot generate CSV or QR keys');
    await ev(`window.__nativeSaved=[];window.PTWExport={save:(name,type,data)=>__nativeSaved.push({name,type,data}),printPage:()=>{}};const fetchOriginal=window.fetch.bind(window);window.fetch=(url,options)=>fetchOriginal(String(url).replace('/assets/assets/mau/','/assets/mau/'),options);`);
    await ev(fs.readFileSync(path.join(root,'android','native-downloads.js'),'utf8'));
    await ev(`(()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['native csv'],{type:'text/csv'}));a.download='test.csv';a.click();})()`);await wait(`__nativeSaved.length===1`);
    ok(await ev(`__nativeSaved[0].name==='test.csv'&&atob(__nativeSaved[0].data)==='native csv'`),'Android JS bridge exports generated Blob bytes');
    await ev(`(()=>{const a=document.createElement('a');a.href=location.origin+'/assets/assets/mau/mau-hoa-hoc.docx';a.setAttribute('download','');a.click();})()`);await wait(`__nativeSaved.length===2`);
    ok(await ev(`__nativeSaved[1].name==='mau-hoa-hoc.docx'&&atob(__nativeSaved[1].data).startsWith('PK')`),'Android JS bridge exports packaged Word template with empty download attribute');
    for(const page of ['giao-vien.html','qr.html','cham-bai.html','soan-de.html']){
      await send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});await open(page);
      ok(await ev(`document.documentElement.scrollWidth<=innerWidth+1`),page+' has no 375px horizontal overflow');
      const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'teacher-'+page+'.png'),Buffer.from(shot.data,'base64'));
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
      ok(await ev(`document.activeElement.tagName==='A'`),page+' keyboard navigation reaches first link');
    }
    ok(errors.length===0,'No uncaught browser exceptions: '+errors.join(' | '));
  }finally{if(ws)ws.close();browser.kill();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
