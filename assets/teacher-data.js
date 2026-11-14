/* Small local-only CSV / OOXML reader. No macros, external links or formulas executed. */
(function (root) {
  'use strict';
  const text = v => String(v == null ? '' : v).normalize('NFC').trim();
  const limit = (ok, message) => { if (!ok) throw new Error(message); };
  function csv(source) {
    source = String(source).replace(/^\uFEFF/, '');
    limit(source.length <= 5e6, 'Tệp CSV vượt 5 MB.');
    const first = source.split(/\r?\n/, 1)[0];
    const sep = first.includes('\t') ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
    const rows = []; let row = [], cell = '', quote = false;
    for (let i = 0; i < source.length; i++) {
      const c = source[i];
      if (c === '"') { if (quote && source[i + 1] === '"') { cell += '"'; i++; } else quote = !quote; }
      else if (!quote && (c === sep || c === '\n' || c === '\r')) {
        row.push(cell); cell = '';
        if (c !== sep) { if (c === '\r' && source[i + 1] === '\n') i++; rows.push(row); row = []; }
      } else cell += c;
    }
    limit(!quote, 'CSV có dấu ngoặc kép chưa đóng.');
    if (cell || row.length) { row.push(cell); rows.push(row); }
    limit(rows.length <= 10001 && rows.every(r => r.length <= 250), 'Tối đa 10.000 dòng và 250 cột.');
    return rows.filter(r => r.some(v => text(v)));
  }
  function csvOut(rows) {
    return '\uFEFF' + rows.map(r => r.map(v => {
      let s = String(v == null ? '' : v);
      const numeric = /^-?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(s) && Number.isFinite(Number(s.replace(',', '.')));
      if (!numeric && /^[\s]*[=+@\-\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    }).join(',')).join('\r\n');
  }
  function xml(s) {
    limit(!/<!DOCTYPE|<!ENTITY/i.test(s), 'XML có khai báo không được hỗ trợ.');
    const d = new DOMParser().parseFromString(s, 'application/xml');
    limit(!d.getElementsByTagName('parsererror').length, 'Không đọc được XML trong Excel.');
    return d;
  }
  const nodes = (d, name) => Array.from(d.getElementsByTagNameNS('*', name));
  async function xlsx(buffer) {
    const b = new Uint8Array(buffer), dv = new DataView(buffer), dec = new TextDecoder();
    limit(b.length <= 8e6 && b.length >= 22, 'Tệp Excel phải nhỏ hơn 8 MB và là .xlsx hợp lệ.');
    let end = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { end = i; break; }
    limit(end >= 0, 'Không đọc được .xlsx. Với .xls cũ, hãy lưu lại thành .xlsx hoặc CSV.');
    const count = dv.getUint16(end + 10, true); let p = dv.getUint32(end + 16, true), total = 0;
    limit(count <= 2000, 'Excel có quá nhiều thành phần.');
    const files = new Map();
    for (let i = 0; i < count; i++) {
      limit(p + 46 <= b.length && dv.getUint32(p, true) === 0x02014b50, 'Mục lục ZIP bị hỏng.');
      const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true), rawSize = dv.getUint32(p + 24, true);
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      limit(p + 46 + nl + xl + cl <= b.length && !(dv.getUint16(p + 8, true) & 1), 'ZIP mã hóa hoặc bị hỏng.');
      const name = dec.decode(b.subarray(p + 46, p + 46 + nl));
      total += rawSize;
      limit(rawSize <= 16e6 && total <= 40e6, 'Dữ liệu giải nén vượt giới hạn an toàn.');
      files.set(name, { method, size, rawSize, off }); p += 46 + nl + xl + cl;
    }
    async function read(name) {
      const f = files.get(name); if (!f) return '';
      limit(f.off + 30 <= b.length && dv.getUint32(f.off, true) === 0x04034b50, 'ZIP bị hỏng.');
      const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true);
      limit(start + f.size <= b.length && [0, 8].includes(f.method), 'Kiểu nén Excel không được hỗ trợ.');
      let out = b.subarray(start, start + f.size);
      if (f.method === 8) {
        let ds; try { ds = new DecompressionStream('deflate-raw'); } catch (_) { throw new Error('Trình duyệt chưa hỗ trợ đọc .xlsx. Hãy dùng Chrome/Edge mới hoặc lưu CSV.'); }
        const reader = new Blob([out]).stream().pipeThrough(ds).getReader();
        const chunks = []; let length = 0;
        try {
          while (true) { const x = await reader.read(); if (x.done) break; length += x.value.length; limit(length <= f.rawSize && length <= 16e6, 'Tệp nén vượt dung lượng khai báo.'); chunks.push(x.value); }
        } catch (e) { await reader.cancel(); throw e; }
        out = new Uint8Array(length); let pos = 0; chunks.forEach(c => { out.set(c, pos); pos += c.length; });
      }
      limit(out.length === f.rawSize, 'Độ dài thành phần Excel không hợp lệ.');
      return dec.decode(out);
    }
    const styleXML = await read('xl/styles.xml');
    const formats = new Map(); let cellStyles = [];
    if (styleXML) {
      const styles = xml(styleXML);
      nodes(styles, 'numFmt').forEach(n => formats.set(n.getAttribute('numFmtId'), n.getAttribute('formatCode')));
      const xfs = nodes(styles, 'cellXfs')[0];
      if (xfs) cellStyles = nodes(xfs, 'xf').map(n => formats.get(n.getAttribute('numFmtId')) || '');
    }
    const sharedXML = await read('xl/sharedStrings.xml');
    const shared = sharedXML ? nodes(xml(sharedXML), 'si').map(s => nodes(s, 't').map(t => t.textContent).join('')) : [];
    const workbook = xml(await read('xl/workbook.xml'));
    const rels = new Map(nodes(xml(await read('xl/_rels/workbook.xml.rels')), 'Relationship').filter(r => r.getAttribute('TargetMode') !== 'External').map(r => [r.getAttribute('Id'), r.getAttribute('Target')]));
    const sheets = [];
    for (const sh of nodes(workbook, 'sheet')) {
      const target = rels.get(sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
      if (!target) continue;
      const path = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
      limit(!path.includes('..'), 'Đường dẫn sheet không được hỗ trợ.');
      const source = await read(path); if (!source) continue;
      const rows = []; let nCells = 0;
      for (const r of nodes(xml(source), 'row')) {
        const row = [];
        for (const c of nodes(r, 'c')) {
          limit(++nCells <= 150000, 'Sheet có quá nhiều ô.');
          const ref = c.getAttribute('r') || ''; const match = ref.match(/^([A-Z]+)\d+$/);
          limit(!!match, 'Ô Excel thiếu tọa độ.');
          let index = 0; for (const a of match[1]) index = index * 26 + a.charCodeAt(0) - 64;
          limit(index <= 250, 'Sheet vượt 250 cột.');
          const type = c.getAttribute('t'); let v = nodes(c, 'v')[0]?.textContent || '';
          if (type === 's') v = shared[Number(v)] || '';
          if (type === 'inlineStr') v = nodes(c, 't').map(t => t.textContent).join('');
          // Preserve common identifier formats (000, 0000) without rounding answers.
          const format = cellStyles[Number(c.getAttribute('s') || 0)];
          if ((!type || type === 'n') && /^0{2,12}$/.test(format || '') && /^\d+$/.test(v)) v = v.padStart(format.length, '0');
          limit(!nodes(c, 'f').length, 'Sheet có công thức. Hãy sao chép → Dán giá trị rồi nhập lại để tránh dùng đáp án tính toán chưa cập nhật.');
          row[index - 1] = v;
        }
        if (row.some(v => text(v))) rows.push(row);
        limit(rows.length <= 10001, 'Sheet vượt 10.000 dòng.');
      }
      sheets.push({ name: sh.getAttribute('name'), rows });
    }
    limit(sheets.length > 0, 'Không tìm thấy sheet dữ liệu.'); return sheets;
  }
  async function readFile(file) {
    limit(file && file.size <= 8e6, 'Chọn tệp nhỏ hơn 8 MB.');
    if (/\.xlsx$/i.test(file.name)) return xlsx(await file.arrayBuffer());
    limit(/\.(csv|tsv|txt)$/i.test(file.name), 'Hỗ trợ .xlsx, .csv, .tsv. Với .xls hãy lưu lại thành .xlsx.');
    return [{ name: file.name, rows: csv(await file.text()) }];
  }
  function download(name, content, type = 'text/plain;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  root.PTWData = { text, csv, csvOut, xlsx, readFile, download };
  if (typeof module !== 'undefined') module.exports = root.PTWData;
})(typeof window !== 'undefined' ? window : globalThis);
