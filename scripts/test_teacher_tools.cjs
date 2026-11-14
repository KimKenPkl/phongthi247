'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../assets/teacher-data.js'),Q=require('../assets/qr-tool.js'),G=require('../assets/teacher-grading.js'),E=require('../assets/teacher-editor.js');
const I=require('../assets/import-docx.js');
require('../assets/tnmaker-qr.js');
const key=[['code','part','question','answer'],['001',1,1,'A|C'],['001',2,1,'DSD*'],['001',3,1,'2,50|3']];
const answers=[['id','name','class','code','I.1','II.1','III.1'],['007','Mẫu','12A','001','C','DSDS','2.5']];
test('CSV quoted separators, multiline, BOM, TSV and formula neutralization',()=>{
  assert.deepEqual(D.csv('\uFEFFid,name\r\n001,"A,B"\r\n002,"a\nb"'),[['id','name'],['001','A,B'],['002','a\nb']]);
  assert.deepEqual(D.csv('id\tname\n001\tMẫu'),[['id','name'],['001','Mẫu']]);
  assert.throws(()=>D.csv('a,b\n"unclosed'));
  assert.equal(D.csv(D.csvOut([['=HYPERLINK("evil")','+1','@x','-2']]))[0][0][0],"'");
  assert.equal(D.csv(D.csvOut([['-2.5']]))[0][0],'-2.5');
});
test('QR preserves leading zeros and encodes all three parts',()=>{
  const v=Q.parse([['Câu\\Mã','001'],[1,'A'],[1,'ĐSĐS'],[1,'2,5']]);
  // Official public encoder maps ASCII D to U+0110 (Đ) in type-6 payloads.
  const r=TNMakerQR.build(v);assert.equal(r.ok,true);assert.equal(JSON.parse(r.payloads[0])['001'],'A#\u0110S\u0110S#2.5');
  assert.throws(()=>Q.parse([['Câu','101','101'],[1,'A','B']]),/trùng/);
  assert.throws(()=>Q.parse([['Câu','101'],[1,'A'],[2,'']]),/không có đáp án/);
  assert.throws(()=>Q.version('101',['A'],['DS'],[],'Mẫu'),/4 ý/);
  assert.throws(()=>Q.version('101',[],[],['Infinity'],'Mẫu'));
  assert.throws(()=>Q.parse([['Câu','101'],[1,'A'],[3,'B']]),/số câu/);
  assert.throws(()=>Q.parse([['Câu','101'],[1,'A'],[1,'B']]),/số câu/);
  const sample=[['Câu','101'],[1,'A'],[1,'DSDS'],[1,'-1']];
  assert.equal(Q.parse(D.csv(D.csvOut(sample)))[0].p3[0].ansVal,'-1');
});
test('QR chunks 27 versions and internal roster rejects duplicate IDs',()=>{
  const v=Array.from({length:27},(_,i)=>Q.version(String(100+i),['A'],[],[],'Test'));
  const r=TNMakerQR.build(v);assert.equal(r.payloads.length,3);assert.equal(Object.keys(JSON.parse(r.payloads[0])).length,11);
  assert.equal(Q.roster([['id','name','class'],['001','Mẫu','12A']])[0].id,'001');
  assert.throws(()=>Q.roster([['id','name','class'],['001','Mẫu','12A'],['001','Khác','12B']]));
});
test('Grading alternatives, decimal comma and wildcard; blank answers zero',()=>{
  const r=G.grade(key,answers)[0];assert.equal(r.score,1.5);assert.equal(r.normalized10,10);
  const blank=answers.map(r=>r.slice());blank[1].splice(4,3,'','','');assert.equal(G.grade(key,blank)[0].score,0);
  blank[1].splice(4,3,'A','DS??','3');assert.equal(G.grade(key,blank)[0].score,.75);
  blank[1][5]='SSSS';assert.equal(G.grade(key,blank)[0].score,.75);
});
test('Grading rejects duplicate key/student, missing headers, bad answer and weight',()=>{
  assert.throws(()=>G.keys([...key,key[1]]),/trùng/);
  assert.throws(()=>G.grade(key,[answers[0],answers[1],answers[1]]),/Trùng/);
  assert.throws(()=>G.grade(key,[answers[0].slice(0,5),answers[1].slice(0,5)]),/Thiếu cột/);
  const bad=answers.map(r=>r.slice());bad[1][4]='A|C';assert.throws(()=>G.grade(key,bad));
  assert.throws(()=>G.grade(key,answers,{p1:0}));assert.throws(()=>G.grade(key,answers,{p3:NaN}));
  const v=Q.parse([['Câu','001'],[1,'A'],[1,'DSDS'],[1,'2.5']]);assert.equal(G.keys(G.fromVersions(v)).size,1);
  v[0].p1[0].q={needsReview:true};assert.throws(()=>G.fromVersions(v),/rà soát/);
});
test('Results validate score ranges, consistent identity, duplicate subject',()=>{
  const h=['id','name','class','subject','score','max'];
  assert.throws(()=>G.results([h,['1','Mẫu','A','X','',10]]));
  assert.throws(()=>G.results([h,['1','Mẫu','A','X',11,10]]));
  assert.throws(()=>G.results([h,['1','Mẫu','A','X',8,0]]));
  assert.throws(()=>G.results([h,['1','Mẫu','A','X',8,10],['1','Mẫu','A','X',7,10]]));
  assert.throws(()=>G.results([h,['1','Mẫu','A','X',8,10],['1','Khác','A','Y',7,10]]));
});
test('Aggregate only complete students, ties share competition rank, backup validates',()=>{
  const rows=G.results([['id','name','class','subject','score','max'],['1','A','L','X',8,10],['1','A','L','Y',7,10],['2','B','L','X',16,20],['2','B','L','Y',7,10],['3','C','L','X',10,10]]);
  const r=G.aggregate(rows,['X','Y']);assert.equal(r.complete.length,2);assert.equal(r.incomplete.length,1);assert.equal(r.complete[0].total,15);assert.equal(r.complete[1].rank,1);
  assert.deepEqual(G.restore({app:'phongthi247-results',schemaVersion:1,rows}),rows);
  assert.throws(()=>G.restore({schemaVersion:2,rows}));
});
test('Editor duplicate stems, numbering, normalization and solution splitting',()=>{
  const source='Câu 8. Nội dung câu hỏi mẫu\nA. Một B. Hai C. Ba D. Bốn\nLời giải: Nội dung giải\nCâu 8. Nội dung câu hỏi mẫu\nA. Một\nB. Hai\nC. Ba\nD. Bốn';
  const r=E.analyze(source);assert.equal(r.questions.length,2);assert.equal(r.warnings.length,2);
  const c=E.clean(source,{renumber:true,splitOptions:true});assert.match(c,/Câu 2\./);assert.match(c,/\nB\. Hai/);
  const parts=E.splitSolutions(source);assert.ok(!parts.question.includes('Nội dung giải'));assert.ok(parts.solution.includes('Nội dung giải'));assert.equal(E.clean(' a\r\n\r\n\r\nb '),'a\n\nb');
  assert.throws(()=>E.clean('Câu 8. Nội dung\nĐÁP ÁN\nCâu 8. B',{renumber:true}),/bảng đáp án/);
  const parsed=I.parseText('Câu 1. Nội dung\nA. Một\nB. Hai\nC. Ba\nD. Bốn');
  assert.equal(parsed.questions[0].needsReview,true);assert.ok(parsed.warnings.length>0);
});
