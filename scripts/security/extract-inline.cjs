// Tach script noi tuyen ra file rieng de bat CSP script-src 'self'.
// Chay 1 lan; sau do co the xoa file nay.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

const targets = [
  ['index.html', 'assets/page-home.js'],
  ['hoc-sinh.html', 'assets/page-student.js'],
  ['gioi-thieu.html', 'assets/page-about.js'],
  ['van12.html', 'assets/page-van12.js'],
];

let changed = 0;
for (const [html, js] of targets) {
  const htmlPath = path.join(ROOT, html);
  const jsPath = path.join(ROOT, js);
  const src = fs.readFileSync(htmlPath, 'utf8');
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/;
  const m = src.match(re);
  if (!m) {
    console.log('SKIP (khong con inline):', html);
    continue;
  }
  let body = m[1];
  // Bo newline dau/cuoi cho gon, giu nguyen phan con lai.
  body = body.replace(/^\r?\n/, '').replace(/\r?\n$/, '');
  const banner = '/* Tach tu ' + html + ' de bat CSP script-src \'self\'. */\n';
  fs.writeFileSync(jsPath, banner + body + '\n', 'utf8');
  const replacement = '<script src="' + js + '?v=1"></script>';
  const out = src.replace(re, replacement);
  if (out === src) {
    console.log('SKIP (khong thay doi):', html);
    continue;
  }
  fs.writeFileSync(htmlPath, out, 'utf8');
  changed++;
  console.log('OK', html, '->', js, '(' + body.length + ' chars)');
}
console.log('Da xu ly', changed, 'trang.');
