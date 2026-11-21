const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const text=fs.readFileSync(path.resolve(__dirname,'../../assets/exam.js'),'utf8');
const start=text.indexOf('  function qImg(q) {');
const end=text.indexOf('\n  function tick()',start);
assert.ok(start>=0&&end>start);
const source=text.slice(start,end);
const escapeHTML=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
function compile(s){const ctx={escapeHTML};vm.createContext(ctx);vm.runInContext(s,ctx);return ctx.qImg;}
function check(fn){
  assert.equal(fn(null),'');
  assert.equal(fn({}),'');
  const q={image:'a.png',imageAlt:'Đồ thị "Cu" <x>',imageWidth:1400,imageHeight:700};
  const result=fn(q);
  assert.match(result,/width="1400" height="700"/);
  assert.match(result,/alt="Đồ thị &quot;Cu&quot; &lt;x&gt;"/);
  assert.ok(!result.includes('alt="Đồ thị "'));
  for(const invalid of [0,-1,NaN,Infinity,1.5,10001]){
    assert.ok(!fn({...q,imageWidth:invalid}).includes(' width='),String(invalid));
    assert.ok(!fn({...q,imageHeight:invalid}).includes(' height='),String(invalid));
  }
  assert.match(fn({image:'old.png'}),/alt="Hình câu hỏi"/);
  assert.ok(!fn({image:'old.png'}).includes(' width='));
}
check(compile(source));
// Mutation only in an in-memory copy, never in the working source.
const mutated=source.replace('w > 0 && h > 0','w >= 0 && h >= 0');
assert.notEqual(mutated,source);
assert.throws(()=>check(compile(mutated)));
console.log('PASS: qImg alt escaping, dimension limits, legacy fallback; zero-dimension mutation detected.');
