'use strict';
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), crypto = require('node:crypto');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };
const props = { REPORT_PASS: 'test-master', REPORT_READERS: JSON.stringify([{pass:'class-a',classes:['12A1']},{pass:'exam-a',exams:['fixture']}]) };
const rows = [], headers = [], cache = new Map();
let locked = false, flushFail = false;
const sheet = {
  getLastColumn:()=>headers.length, getLastRow:()=>rows.length+1,
  getRange:(r,c,n=1,m=1)=>({getValues:()=>r===1?[headers.slice(c-1,c-1+m)]:rows.slice(r-2,r-2+n).map(x=>x.slice(c-1,c-1+m)),
    setValue:v=>{headers[c-1]=v;}, setValues:vs=>{headers.splice(0,headers.length,...vs[0]);return {setFontWeight:()=>{}};}}),
  setFrozenRows:()=>{}, getDataRange:()=>({getValues:()=>[headers,...rows]}),
  appendRow:r=>{assert.ok(locked,'append requires lock'); rows.push(r);}
};
const ctx = vm.createContext({console, Date, Set,
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null})},
  SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:n=>n==='DanhSach'?{getDataRange:()=>({getValues:()=>[['Họ tên','Lớp'],['An','12A1'],['Bình','12A2']]})}:sheet,insertSheet:()=>sheet}),flush:()=>{if(flushFail)throw Error('flush failed');}},
  LockService:{getScriptLock:()=>({waitLock:()=>{assert.equal(locked,false);locked=true;},releaseLock:()=>{locked=false;}})},
   Utilities:{newBlob:s=>({getBytes:()=>Buffer.from(s)}),DigestAlgorithm:{SHA_256:'sha256',MD5:'md5'},Charset:{UTF_8:'utf8'},computeDigest:(alg,s)=>[...crypto.createHash(alg).update(s).digest()],base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url'),
    formatDate:(d,tz)=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(d)},
  ContentService:{MimeType:{JSON:'json',TEXT:'text',JAVASCRIPT:'js'},createTextOutput:text=>({text,setMimeType(){return this;}})},
  CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})}
});
for(const name of ['Code.gs','Submission.gs','ExamRegistry.gs']) vm.runInContext(fs.readFileSync('apps-script/'+name,'utf8'),ctx);
vm.runInContext(`SERVER_EXAMS.fixture={revision:'r1',title:'Test',code:'ROOM',openAt:'',closeAt:'',maxAttempts:0,scoring:{},questions:[{part:1,answerIndex:1,optionCount:4},{part:2,statements:[{answer:true},{answer:false},{answer:true},{answer:false}]},{part:3,answer:1.5,tolerance:0.01}]}`,ctx);
const call = p => JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(p)}}).text);
const getCapability = nonce => {
  const cb = 'cb';
  const out = ctx.doGet({parameter:{action:'capability',nonce,callback:cb}}).text;
  const match = out.match(/^cb\((.*)\)$/);
  return JSON.parse(match[1]);
};
const payload = (over={})=>({examId:'fixture',revision:'r1',attemptId:'attempt_001',receiptToken:'a'.repeat(64),name:'Nguyễn An',class:'12A1',sbd:'1',code:'ROOM',order:[2,0,1],answers:{0:1,1:[true,false,true,false],2:'1,5'},ts:'2026-11-15T08:00:00Z',timeUsedSec:300,exitTab:0,exitFs:0,ua:'VM',score:999,max:1,pct:999,...over});
const value=(row,h)=>row[headers.indexOf(h)];
test('unknown exam/revision/room fail closed without writes',()=>{
  assert.equal(call(payload({examId:'missing'})).err,'unknown_exam');
  assert.equal(call(payload({revision:'old'})).err,'exam_revision');
  assert.equal(call(payload({code:'wrong'})).err,'bad_code');assert.equal(rows.length,0);
});
test('canonical schema rejects malformed types, duplicates, out-of-subset answers',()=>{
  for(const x of [{order:[0,0]},{order:[-1]},{order:[]},{answers:{0:'1'}},{answers:{1:[1,0,true,false]}},{answers:{1:[true]}},{answers:{99:0}},{order:[0],answers:{0:1,2:1.5}}]) assert.equal(call(payload(x)).ok,false);
});
test('server regrades and ignores forged scores; extension columns preserved',()=>{
  const ack=call(payload());assert.equal(ack.ok,true);assert.equal(ack.score,1.5);assert.equal(ack.max,1.5);assert.equal(rows.length,1);
  assert.equal(value(rows[0],'Điểm'),1.5);assert.equal(value(rows[0],'Bài đầy đủ'),true);assert.ok(value(rows[0],'Server nhận (Asia/Ho_Chi_Minh)') instanceof Date);
  sheet.getRange(1,headers.length+1).setValue('Custom extension');
});
test('identical replay and reordered answers dedupe under lock; token/content conflicts reject',()=>{
  assert.equal(call(payload({score:-999,order:[0,1,2]})).ok,true);assert.equal(rows.length,1);
  assert.equal(call(payload({answers:{0:0}})).err,'attempt_conflict');
  assert.equal(call(payload({receiptToken:'b'.repeat(64)})).err,'attempt_conflict');assert.equal(rows.length,1);assert.equal(locked,false);
});
test('uncertain flush retains idempotency on retry',()=>{
  flushFail=true;assert.equal(call(payload({attemptId:'attempt_002'})).ok,false);flushFail=false;
  assert.equal(call(payload({attemptId:'attempt_002'})).ok,true);assert.equal(rows.length,2);
});
test('subset accepted for practice, excluded from public ranking',()=>{
  assert.equal(call(payload({attemptId:'attempt_003',order:[0],answers:{0:1}})).score,0.25);
  assert.equal(value(rows[2],'Bài đầy đủ'),false);
  assert.equal(ctx.top_('fixture','all').err,'ranking_private');props.PUBLIC_RANKING='true';
  assert.equal(ctx.top_('fixture','all').rows.some(r=>r.attemptId==='attempt_003'),false);
});
test('Sheet formulas and server CSV neutralized; numeric negatives preserved',()=>{
  call(payload({attemptId:'attempt_004',name:'  =An',class:'12A2',sbd:'＋SUM(1,2)'}));
  assert.equal(value(rows[3],'Họ tên'),"'=An");assert.equal(value(rows[3],'SBD'),"'＋SUM(1,2)");
  assert.ok(ctx.csvCell_('\t@SUM(1)').startsWith('"\''));assert.equal(ctx.safeCell_(-2),-2);
});
test('GET never exposes private report/roster even with a correct pass',()=>{
  for(const action of ['report','roster']) assert.equal(JSON.parse(ctx.doGet({parameter:{action,pass:'test-master'}}).text).err,'post_required');
});
test('POST authorization/scopes apply before rows/CSV/roster; receipt hashes absent',()=>{
  assert.equal(call({action:'report',pass:'bad'}).err,'unauthorized');
  const r=call({action:'report',pass:'class-a'});assert.equal(r.ok,true);assert.ok(r.rows.every(r=>r['Lớp']==='12A1'));
  assert.ok(r.rows.every(r=>!('Receipt hash' in r)&&!('Submission hash' in r)));
  assert.equal(call({action:'report',pass:'exam-a',exam:'missing'}).rows.length,0);
  assert.equal(call({action:'roster',pass:'class-a'}).rows.length,1);
  assert.equal(call({action:'roster',pass:'exam-a'}).err,'roster_scope');
  const csv=ctx.doPost({postData:{contents:JSON.stringify({action:'report',pass:'class-a',format:'csv'})}}).text;
  assert.ok(!csv.includes('12A2'));assert.ok(!csv.includes('Receipt hash'));
});
test('one-time capability returns the real receipt/report and is consumed once',()=>{
  const nonce='c'.repeat(64), p=payload({attemptId:'attempt_006',nonce});
  const first=call(p);assert.deepEqual(first,{ok:true,capability:nonce});
  const receipt=getCapability(nonce);assert.equal(receipt.ok,true);assert.equal(receipt.attemptId,'attempt_006');
  assert.equal(getCapability(nonce).err,'not_ready');
  const reportNonce='d'.repeat(64), report=call({action:'report',pass:'class-a',nonce:reportNonce});
  assert.deepEqual(report,{ok:true,capability:reportNonce});
  const reportData=getCapability(reportNonce);assert.equal(reportData.ok,true);assert.ok(Array.isArray(reportData.rows));
});
test('server schedule and max-attempt policy cannot be overridden by client',()=>{
  vm.runInContext("SERVER_EXAMS.fixture.maxAttempts=1",ctx);
  assert.equal(call(payload({attemptId:'attempt_005',maxAttempts:0})).err,'attempt_limit');
  vm.runInContext("SERVER_EXAMS.fixture.maxAttempts=0;SERVER_EXAMS.fixture.closeAt='2020-01-01'",ctx);
  assert.equal(call(payload({attemptId:'attempt_005'})).err,'exam_closed');assert.equal(call(payload()).ok,true);
  vm.runInContext("SERVER_EXAMS.fixture.closeAt='';SERVER_EXAMS.fixture.openAt='2099-01-01'",ctx);
  assert.equal(call(payload({attemptId:'attempt_005'})).err,'exam_not_open');
});
test('fallback errors are readable, oversized responses fail closed and invalid nonce never writes',()=>{
  const nonce='e'.repeat(64);
  assert.equal(call({action:'report',pass:'bad',nonce}).capability,nonce);
  assert.equal(getCapability(nonce).err,'unauthorized');
  const before=rows.length;
  assert.equal(call(payload({attemptId:'invalid_nonce',nonce:'invalid'})).err,'bad_capability');
  assert.equal(rows.length,before);
  const largeNonce='f'.repeat(64);
  ctx.stashCapability_(largeNonce,{ok:true,rows:['á'.repeat(50000)]});
  assert.equal(getCapability(largeNonce).err,'response_too_large');
  assert.equal(getCapability(largeNonce).err,'not_ready');
  const cacheGet=ctx.CacheService.getScriptCache;
  ctx.CacheService.getScriptCache=()=>({get:()=>{assert.equal(locked,true);return null;}});
  assert.equal(getCapability('1'.repeat(64)).err,'not_ready');assert.equal(locked,false);
  ctx.CacheService.getScriptCache=cacheGet;
});
test('80-character attempt IDs retain identity and dedupe without truncation',()=>{
  vm.runInContext("SERVER_EXAMS.fixture.openAt=''",ctx);
  const p=payload({attemptId:'x'.repeat(80)}),before=rows.length;
  assert.equal(call(p).ok,true);assert.equal(call(p).ok,true);assert.equal(rows.length,before+1);
  assert.equal(value(rows.at(-1),'attemptId'),p.attemptId);
});
console.log(passed+' backend hardening groups passed');
