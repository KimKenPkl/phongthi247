'use strict';
// Real Edge DOM/storage/JSONP execution; Apps Script is replaced by synthetic responses.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),temp=path.join(process.env.LOCALAPPDATA,'Temp','opencode');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const A='https://script.google.com/macros/s/unit_A/exec';
const reportFixture=`
window.alerts=[];window.alert=x=>alerts.push(String(x));
window.nativeFetch=window.fetch.bind(window);
window.fetch=async url=>{
 const pathname=new URL(url,location.href).pathname;
 if(pathname.endsWith('/data/config.json'))return {ok:true,text:async()=>JSON.stringify({appsScriptUrl:'${A}'})};
 if(pathname.endsWith('/data/exams.json'))return {ok:true,text:async()=>JSON.stringify({exams:[]})};
 throw Error('Unexpected fetch '+pathname);
};
window.requests=[];
PTW.sheet.post=(target,payload)=>new Promise((resolve,reject)=>requests.push({target,payload,resolve,reject}));
PTW.sheet.get=async()=>({ok:false,err:'ranking_private'});
PTW.ls.set('ptw_local_submissions',[{examId:'fixture',attemptId:'local',name:'Local Only',class:'12Z',score:1,max:10,pct:10}]);
sessionStorage.setItem('ptwRpPass','old-secret');
`;
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;
 if(name==='/test-tab.html'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<!doctype html><script src="/assets/common.js"></script>');return;}
 // Fixture phai la file cung origin: CSP script-src 'self' chan script inline.
 if(name==='/test-fixture.js'){res.setHeader('Content-Type','text/javascript;charset=utf-8');res.end(reportFixture);return;}
 if(name==='/report/index.html'){
   let html=fs.readFileSync(path.join(root,'report/index.html'),'utf8');
   html=html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g,tag=>{
     if(tag.includes('assets/common.js'))return tag;
     if(tag.includes('assets/report.js'))return `<script src="/test-fixture.js"></script>${tag}`;
     return '';
   });res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);return;
 }
 const filename=path.resolve(root,'.'+name);
 if(!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{const body=fs.readFileSync(filename);res.setHeader('Content-Type',filename.endsWith('.js')?'text/javascript;charset=utf-8':filename.endsWith('.css')?'text/css;charset=utf-8':'text/plain');res.end(body);}catch{res.writeHead(404).end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const profile=path.join(temp,'submission-edge-'+Date.now());
 const browser=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
 let ws,ws2,n=0,n2=0;const calls=new Map(),calls2=new Map(),errors=[];
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++n;calls.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const wait=async expression=>{for(let i=0;i<100;i++){if(await ev(expression).catch(()=>false))return;await pause(100);}throw Error('Timeout '+expression);};
 const waitUntil=async(fn,label)=>{for(let i=0;i<100;i++){if(await fn().catch(()=>false))return;await pause(100);}throw Error('Timeout '+label);};
 const ok=(value,msg)=>{assert.ok(value,msg);console.log('PASS '+msg);};
 const row=(name,cls='12A1')=>({ok:true,rows:[{'Họ tên':name,'Lớp':cls,examId:'fixture',attemptId:name,'Điểm':8,'Tối đa':10,'%':80,'Làm/giây':60}]});
 try{
   let port;
   for(let i=0;i<100&&!port;i++){try{port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);}catch{}if(!port)await pause(100);}
   assert.ok(port,'Edge started');
   const target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');
   ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
   ws.onmessage=({data})=>{const d=JSON.parse(data);if(d.id){const p=calls.get(d.id);if(p){calls.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}}else if(d.method==='Runtime.exceptionThrown')errors.push(d.params.exceptionDetails.exception?.description||d.params.exceptionDetails.text);};
   await send('Page.enable');await send('Runtime.enable');
   await send('Page.navigate',{url:base+'/report/index.html'});
   await wait(`document.readyState==='complete'&&window.requests&&document.getElementById('btnLoad').disabled===false`);
   ok(await ev(`sessionStorage.getItem('ptwRpPass')===null&&document.getElementById('inpPass').value===''`),'Legacy report password is cleared on boot');
   await ev(`document.getElementById('inpPass').value='teacher-A';document.getElementById('inpPass').dispatchEvent(new Event('input'));document.getElementById('btnLoad').click()`);
   await wait('requests.length===1');
   await ev(`document.getElementById('inpPass').value='teacher-B';document.getElementById('inpPass').dispatchEvent(new Event('input'));document.getElementById('btnLoad').click()`);
   await wait('requests.length===2');
   await ev(`requests[1].resolve(${JSON.stringify(row('Teacher B Student'))})`);
   await wait(`document.getElementById('tblWrap').textContent.includes('Teacher B Student')`);
   await ev(`requests[0].resolve(${JSON.stringify(row('Teacher A Student'))})`);
   ok(await ev(`!document.getElementById('tblWrap').textContent.includes('Teacher A Student')&&!document.getElementById('tblWrap').textContent.includes('Local Only')`),'Late response cannot replace new teacher scope or mix local history');
   ok(await ev(`![...Object.values(localStorage),...Object.values(sessionStorage)].some(v=>String(v).includes('teacher-A')||String(v).includes('teacher-B'))`),'Teacher credentials never enter persistent browser storage');
   await ev(`document.getElementById('selPeriod').value='week';document.getElementById('selPeriod').dispatchEvent(new Event('change'))`);
   await wait('requests.length===3');
   await ev(`document.getElementById('selPeriod').value='month';document.getElementById('selPeriod').dispatchEvent(new Event('change'))`);
   await wait('requests.length===4');
   await ev(`requests[3].resolve({...${JSON.stringify(row('Month Student'))},period:{type:'month',source:'server-received-at'}})`);
   await wait(`document.getElementById('tblWrap').textContent.includes('Month Student')`);
   await ev(`requests[2].resolve({...${JSON.stringify(row('Week Student'))},period:{type:'week',source:'server-received-at'}})`);
   ok(await ev(`document.getElementById('tblWrap').textContent.includes('Month Student')&&!document.getElementById('tblWrap').textContent.includes('Week Student')`),'Out-of-order period requests retain latest filter result');
   await ev(`document.getElementById('btnRosterSheet').click()`);await wait('requests.length===5');
   await ev(`document.getElementById('inpPass').value='temporary';document.getElementById('inpPass').dispatchEvent(new Event('input'));document.getElementById('inpPass').value='teacher-B';document.getElementById('inpPass').dispatchEvent(new Event('input'));requests[4].resolve({ok:true,rows:[{name:'Stale Roster',class:'12A1'}]})`);
   ok(await ev(`!document.getElementById('rosterText').value.includes('Stale Roster')`),'Roster response discarded even when credentials change away and back');
   await ev(`document.getElementById('selPeriod').value='all';document.getElementById('inpPass').value='bad-code';document.getElementById('inpPass').dispatchEvent(new Event('input'));document.getElementById('btnLoad').click()`);await wait('requests.length===6');
   await ev(`requests[5].resolve({ok:false,err:'unauthorized'})`);
   await wait(`document.getElementById('gateErr').textContent.includes('không hợp lệ')`);
   ok(await ev(`!document.getElementById('tblWrap').textContent.includes('Month Student')&&!document.getElementById('tblWrap').textContent.includes('Local Only')`),'Invalid credential clears prior private data and fails closed');
   // Mo tab thu hai that cung origin: CSP frame-src 'none' chan iframe.
   const tabTarget=await(await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(base+'/test-tab.html')}`,{method:'PUT'})).json();
   ws2=new WebSocket(tabTarget.webSocketDebuggerUrl);await new Promise((r,j)=>{ws2.onopen=r;ws2.onerror=j;});
   const send2=(method,params={})=>new Promise((resolve,reject)=>{const id=++n2;calls2.set(id,{resolve,reject});ws2.send(JSON.stringify({id,method,params}));});
   const ev2=async expression=>{const r=await send2('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
   ws2.onmessage=({data})=>{const d=JSON.parse(data);if(d.id){const p=calls2.get(d.id);if(p){calls2.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}}};
   await send2('Runtime.enable');
   await waitUntil(()=>ev2(`typeof PTW!=="undefined"&&!!PTW.pending`),'second tab ready');
   await ev(`PTW.pending.add('${A}',{attemptId:'browser_1',examId:'fixture',revision:'r1',receiptToken:'1'.repeat(64)})`);
   await ev2(`PTW.pending.add('${A}',{attemptId:'browser_2',examId:'fixture',revision:'r1',receiptToken:'2'.repeat(64)})`);
   ok(await ev(`(async()=>{
     const originalPost=PTW.sheet.post;
     PTW.sheet.post=async(_,data)=>({...data,ok:true,saved:true,revision:'mismatch'});
     await PTW.pending.flush('${A}');if(PTW.pending.list().length!==2)return false;
     PTW.sheet.post=async(_,data)=>({...data,ok:true,saved:true});
     await PTW.pending.flush('${A}');PTW.sheet.post=originalPost;return PTW.pending.list().length===0;
   })()`),'Shared-origin tabs retain mismatched receipts and clear only matching ACKs');
   // Restore the actual transport and exercise script insertion + callback cleanup.
   const common=fs.readFileSync(path.join(root,'assets/common.js'),'utf8');
   await ev(common.slice(common.indexOf('PTW.sheet ='),common.indexOf('PTW.csvCell =')));
   await ev('window.fetch=window.nativeFetch');
   await send('Fetch.enable',{patterns:[{urlPattern:'https://script.google.com/*'}]});
   let failCors=false;const transportPosts=[];
   ws.addEventListener('message',({data})=>{const d=JSON.parse(data);if(d.method==='Fetch.requestPaused'){
     const request=d.params.request,url=new URL(request.url),body=JSON.parse(request.postData||'{}');
     assert.equal(url.searchParams.has('pass'),false);
     if(request.method==='POST'){
       transportPosts.push(request.postData);
       if(failCors){failCors=false;send('Fetch.failRequest',{requestId:d.params.requestId,errorReason:'Failed'}).catch(()=>{});return;}
     }
     const value=request.method==='POST'?{ok:true,capability:body.nonce}:{ok:true,rows:[]};
     // PTW.sheet.get doc bang r.json(): tra JSON, khong con JSONP.
     const response=JSON.stringify(value);
     send('Fetch.fulfillRequest',{requestId:d.params.requestId,responseCode:200,responseHeaders:[{name:'Access-Control-Allow-Origin',value:'*'},{name:'Content-Type',value:'application/json'}],body:Buffer.from(response).toString('base64')}).catch(()=>{});
   }});
   ok(await ev(`(async()=>{const before=document.scripts.length;const r=await PTW.sheet.post('${A}',{action:'report',pass:'in-body-only'});return r.ok&&document.scripts.length===before&&!Object.keys(window).some(k=>k.startsWith('__ptwsh_'));})()`),'Actual browser POST/capability fetch resolves and cleans up');
   assert.equal(transportPosts.length,1,'CORS POST reached browser network interception');
   failCors=true;
   ok(await ev(`(async()=>{const r=await PTW.sheet.post('${A}',{action:'report',pass:'fallback-body-only'});return r.ok&&!Object.keys(window).some(k=>k.startsWith('__ptwsh_'));})()`),'Browser network failure falls back to no-cors POST and capability');
   assert.equal(transportPosts.length,3);assert.equal(transportPosts[1],transportPosts[2]);
   await send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
   ok(await ev(`document.documentElement.scrollWidth<=innerWidth+1`),'Report has no horizontal overflow at 375px');
   ok(errors.length===0,'No uncaught browser exceptions: '+errors.join(' | '));
 }finally{if(ws)ws.close();if(ws2)ws2.close();browser.kill();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
