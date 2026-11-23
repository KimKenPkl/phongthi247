// Chen hoac cap nhat CSP + Referrer-Policy + guard.js vao <head> cua moi trang.
// Chay lai nhieu lan duoc: trang da co ptw-security thi chi cap nhat CSP.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

const CSP = [
  "default-src 'self'",
  // Da chuyen JSONP sang fetch (CORS): chi can connect-toi script.google.com,
  // khong them script-src ngoai tro 'self'.
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' https://script.google.com https://script.googleusercontent.com",
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'reports', '.git'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) files.push(p);
  }
}
walk(ROOT);

const cspRe = /<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=(?:"[^"]*"|'[^']*')\s*>/i;
let changed = 0;
for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  let src = fs.readFileSync(file, 'utf8');
  const cspTag = '<meta http-equiv="Content-Security-Policy" content="' + CSP + '">';

  if (src.includes('ptw-security')) {
    if (!cspRe.test(src)) {
      console.log('WARN (co dau nhung thieu CSP):', rel);
      continue;
    }
    const next = src.replace(cspRe, cspTag);
    if (next !== src) {
      fs.writeFileSync(file, next, 'utf8');
      changed++;
      console.log('UPDATED', rel);
    } else {
      console.log('SKIP (CSP da dung):', rel);
    }
    continue;
  }

  const prefix = rel.startsWith('admin/') || rel.startsWith('report/') ? '../' : '';
  const hasReferrer = /<meta\s+name=["']referrer["']/i.test(src);
  const tags = [];
  if (!hasReferrer) tags.push('<meta name="referrer" content="strict-origin-when-cross-origin">');
  tags.push(cspTag);
  tags.push('<script src="' + prefix + 'assets/guard.js?v=1"></script>');
  tags.push('<!-- ptw-security -->');
  const block = tags.join('');

  const anchor = src.match(/<meta\s+charset=["']utf-8["']\s*>/i);
  if (!anchor) {
    console.log('SKIP (khong thay charset):', rel);
    continue;
  }
  const at = anchor.index + anchor[0].length;
  src = src.slice(0, at) + block + src.slice(at);
  fs.writeFileSync(file, src, 'utf8');
  changed++;
  console.log('OK', rel);
}
console.log('Da xu ly', changed, 'trang.');
