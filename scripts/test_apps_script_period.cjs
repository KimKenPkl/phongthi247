'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');

const headers=['Thời điểm nộp','examId','Tên đề','attemptId','Họ tên','Lớp','Điểm','Tối đa','%','Làm/phút','Làm/giây','Rời tab','Sheet extension','Server nhận (Asia/Ho_Chi_Minh)'];
const rows=[
  ['old','chem','Hóa','a1','Nguyễn An','12A1',10,10,100,20,1200,0,'keep',new Date('2026-11-22T16:59:59Z')],
  ['new-low','chem','Hóa','a2','Nguyễn An','12A1',8,10,80,10,600,0,'keep',new Date('2026-11-22T17:00:00Z')],
  ['new-best','chem','Hóa','a3','Nguyễn An','12A1',9,10,90,9,540,0,'keep',new Date('2026-11-23T03:00:00Z')],
  ['legacy','chem','Hóa','a0','Trần Bình','12A2',10,10,100,5,300,0,'keep','']
];
const sheet={getLastColumn:()=>headers.length,getRange:(r,c,n,m)=>({getValues:()=>r===1?[headers]:rows.map(x=>x.slice(c-1,c-1+m)),setValue:value=>{headers.push(value);}}),getDataRange:()=>({getValues:()=>[headers,...rows]})};
const cache=new Map();
class FixedDate extends Date { constructor(...args){super(...(args.length?args:['2026-11-23T12:00:00+07:00']));} }
FixedDate.now=()=>new Date('2026-11-23T05:00:00Z').getTime();
const context={
  console,Date:FixedDate,Math,JSON,String,Number,Array,Object,RegExp,
  SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:()=>sheet,insertSheet:()=>sheet})},
  CacheService:{getScriptCache:()=>({get:key=>cache.get(key)||null,put:(key,value)=>cache.set(key,value),remove:key=>cache.delete(key),removeAll:keys=>keys.forEach(k=>cache.delete(k))})},
  PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'test-salt'})},
  Utilities:{
    formatDate:(date,tz,format)=>{
      const parts=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
      const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));
      if(format==='yyyy-MM-dd')return `${values.year}-${values.month}-${values.day}`;
      throw Error('Unexpected date format '+format);
    },
    computeDigest:()=>new Uint8Array([1,2,3]),DigestAlgorithm:{MD5:'MD5'},Charset:{UTF_8:'UTF-8'},base64EncodeWebSafe:()=> 'test-sid'
  }
};
vm.createContext(context);vm.runInContext(fs.readFileSync('apps-script/Code.gs','utf8'),context);

const monday=vm.runInContext("periodWindow_('week', new Date('2026-11-23T00:00:00+07:00'))",context);
assert.equal(monday.start,'2026-11-23');assert.equal(monday.endExclusive,'2026-11-30');
const sunday=vm.runInContext("periodWindow_('week', new Date('2026-11-22T23:59:59+07:00'))",context);
assert.equal(sunday.start,'2026-11-16');assert.equal(sunday.endExclusive,'2026-11-23');
const month=vm.runInContext("periodWindow_('month', new Date('2026-12-31T23:59:59+07:00'))",context);
assert.equal(month.start,'2026-12-01');assert.equal(month.endExclusive,'2027-01-01');
assert.equal(vm.runInContext("inPeriod_(new Date('2026-11-22T16:59:59Z'), periodWindow_('week', new Date('2026-11-23T00:00:00+07:00'))) ",context),false);
assert.equal(vm.runInContext("inPeriod_(new Date('2026-11-22T17:00:00Z'), periodWindow_('week', new Date('2026-11-23T00:00:00+07:00'))) ",context),true);

const result=vm.runInContext("top_('chem','week')",context);
assert.equal(result.period.source,'server-received-at');
assert.equal(result.count,1);
assert.equal(result.rows[0].attemptId,'a3','period filter must run before best-attempt selection');
assert.equal(result.rows.some(r=>r.name==='Trần B.'),false,'legacy rows without server receipt time are excluded');
assert.ok(!cache.has('top_week_chem'),'period rankings must not be cached across submissions');
console.log('PASS Apps Script week/month boundaries, Vietnam timezone, header-based timestamp lookup, legacy exclusion, filter-before-best, and period cache behavior');
