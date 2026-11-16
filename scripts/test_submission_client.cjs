'use strict';
// Deterministic transport/queue tests. No requests leave the process.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const source=fs.readFileSync('assets/common.js','utf8');
const transport=source.slice(source.indexOf('PTW.sheet ='),source.indexOf('PTW.theme.init();'));
const A='https://script.google.com/macros/s/unit_A/exec',B='https://script.google.com/macros/s/unit_B/exec';
function storage(){const x={};Object.defineProperties(x,{getItem:{value:k=>x[k]??null},setItem:{value:(k,v)=>{x[k]=String(v);}},removeItem:{value:k=>delete x[k]}});return x;}
function env(localStorage=storage()){
  const ctx=vm.createContext({PTW:{ls:{get:()=>[]}},URL,TextEncoder,Uint8Array,AbortController,crypto:webcrypto,setTimeout,clearTimeout,localStorage});
  vm.runInContext(transport,ctx);return ctx;
}
const payload=i=>({attemptId:'attempt_'+i,examId:'fixture',revision:'r1',receiptToken:String(i).padStart(64,'0')});
const ack=p=>({...p,ok:true,saved:true});
const json=value=>({ok:true,type:'cors',json:async()=>value});
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
(async()=>{
  await test('CORS capability resolves receipt; credentials stay in POST body',async()=>{
    const c=env(),calls=[];
    c.fetch=async(url,options)=>{calls.push({url,options});return json({ok:true,capability:JSON.parse(options.body).nonce});};
    c.PTW.sheet.jsonp=async url=>{assert.equal(new URL(url).searchParams.has('pass'),false);return {ok:true,rows:[]};};
    assert.equal((await c.PTW.sheet.post(A,{action:'report',pass:'private-code'})).ok,true);
    assert.equal(calls.length,1);assert.equal(JSON.parse(calls[0].options.body).pass,'private-code');
    assert.equal(calls[0].options.credentials,'omit');
  });
  await test('CORS failure resends identical body then polls capability and preserves server errors',async()=>{
    const c=env(),calls=[];let reads=0;
    c.fetch=async(url,options)=>{calls.push(options);if(options.mode==='cors')throw Error('CORS');return {type:'opaque'};};
    c.PTW.sheet.jsonp=async()=>++reads===1?{ok:false,err:'not_ready'}:{ok:false,err:'exam_closed'};
    assert.equal((await c.PTW.sheet.post(A,{...payload(1),action:'submit'})).err,'exam_closed');
    assert.equal(calls.length,2);assert.equal(calls[0].body,calls[1].body);assert.notEqual(calls[0].signal,calls[1].signal);
  });
  await test('both POST attempts abort on timeout, but saved capability can still confirm',async()=>{
    const c=env();let aborted=0;
    c.fetch=(_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{aborted++;reject(Error('timeout'));},{once:true}));
    c.PTW.sheet.jsonp=async()=>ack(payload(2));
    assert.equal((await c.PTW.sheet.post(A,{...payload(2),action:'submit'},10)).saved,true);assert.equal(aborted,2);
  });
  await test('missing capability does not trigger additional POSTs; queue survives missing/mismatched ACK',async()=>{
    const c=env();let posts=0;
    c.fetch=async(_,options)=>{posts++;return json({ok:true,capability:JSON.parse(options.body).nonce});};
    c.PTW.sheet.jsonp=async()=>{throw Error('lost');};
    c.setTimeout=(fn,ms)=>setTimeout(fn,ms===250?0:ms);
    await assert.rejects(()=>c.PTW.sheet.post(A,{action:'submit'}));assert.equal(posts,1);
    c.PTW.pending.add(A,payload(3));
    for(const response of [null,{ok:true,saved:true},ack({...payload(3),revision:'wrong'}),ack({...payload(3),receiptToken:'wrong'}),{ok:false,err:'exam_closed'}]){
      c.PTW.sheet.post=async()=>response;await c.PTW.pending.flush(A);assert.equal(c.PTW.pending.list().length,1);
    }
    c.PTW.sheet.post=async()=>{throw Error('offline');};await c.PTW.pending.flush(A);assert.equal(c.PTW.pending.list().length,1);
    c.PTW.sheet.post=async()=>ack(payload(3));assert.equal((await c.PTW.pending.flush(A)).remaining,0);
  });
  await test('target binding prevents cross-deployment sends; legacy and invalid items remain',async()=>{
    const c=env(),calls=[];c.PTW.pending.add(A,payload(4));c.PTW.pending.add(B,payload(5));
    c.localStorage.setItem(c.PTW.pending.prefix+'broken','bad json');
    c.PTW.ls.get=()=>[{old:true}];c.PTW.sheet.post=async(target,p)=>{calls.push(target);return ack(p);};
    const result=await c.PTW.pending.flush(A);assert.equal(calls.length,1);assert.equal(calls[0],A);assert.equal(result.remaining,2);assert.equal(result.legacy,1);
    assert.throws(()=>c.PTW.sheet.validUrl(A+'?pass=x'));assert.throws(()=>c.PTW.sheet.validUrl('https://script.google.com.evil/macros/s/a/exec'));
  });
  await test('concurrent tabs preserve new entries and remove only acknowledged snapshots',async()=>{
    const shared=storage(),c=env(shared),d=env(shared),waiting=[];
    c.PTW.pending.add(A,payload(6));d.PTW.pending.add(A,payload(7));assert.equal(c.PTW.pending.list().length,2);
    c.PTW.sheet.post=async(_,p)=>{if(p.attemptId==='attempt_6'){await new Promise(r=>waiting.push(r));}return ack(p);};
    const flush=c.PTW.pending.flush(A);d.PTW.pending.add(A,payload(8));waiting.shift()();await flush;
    assert.deepEqual(Array.from(c.PTW.pending.list(),x=>x.data.attemptId),['attempt_8']);
    let release;const k=c.PTW.pending.list()[0].key;
    c.PTW.sheet.post=async(_,p)=>{await new Promise(r=>release=r);return ack(p);};
    const f=c.PTW.pending.flush(A);shared.setItem(k,JSON.stringify({target:A,data:{...payload(8),revision:'changed'}}));release();await f;
    assert.equal(c.PTW.pending.list().length,1);
  });
  console.log(passed+' client hardening groups passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
