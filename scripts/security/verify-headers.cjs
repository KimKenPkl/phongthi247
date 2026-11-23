// Kiem tra nhanh sau khi bat CSP: khong con script/handler noi tuyen, moi trang co CSP + guard.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const files = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', 'reports', '.git'].includes(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) files.push(p);
  }
}
walk(ROOT);
let bad = 0;
for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  const t = fs.readFileSync(f, 'utf8');
  const inline = [...t.matchAll(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi)];
  const handlers = [...t.matchAll(/\son(click|load|error|change|input|submit|focus|blur)\s*=/gi)];
  const csp = /http-equiv="Content-Security-Policy"/i.test(t);
  const guard = /guard\.js/.test(t);
  if (inline.length || handlers.length || !csp || !guard) {
    bad++;
    console.log('ISSUE', rel, 'inline=' + inline.length, 'handlers=' + handlers.length, 'csp=' + csp, 'guard=' + guard);
  }
}
console.log(bad ? 'Con ' + bad + ' trang loi' : 'Tat ca ' + files.length + ' trang da sach: khong inline script, khong handler, co CSP + guard');
