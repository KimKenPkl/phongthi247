/* tnmaker-qr.js – Tạo nội dung QR đáp án cho app chấm TNMaker (định dạng "TLTN-BGD-2025-YoungMix", type 6).
 * Mô phỏng đúng cách qr-code.tnmaker.net đọc file Excel mẫu rồi sinh chuỗi:
 *   Phần I : nối liền các chữ A–E, ô trống ghi "?"            vd. BCAD?C
 *   Phần II: "#" + từng câu 4 ý Đ/S, các câu cách nhau "_"     vd. #ĐĐSĐ_SĐĐĐ
 *   Phần III: "#" + các đáp số (dấu chấm thập phân), cách "_"  vd. #485_1.02
 * Mỗi QR chứa tối đa 9 mã đề: {"success":true,"type":6,"101":"...","102":"..."}.
 * Giới hạn của mẫu: 40 câu Phần I, 8 câu Phần II, 8 câu Phần III, mã đề là số.
 */
(function (root) {
  'use strict';
  // codes: qr-code.tnmaker.net chỉ báo lỗi khi quá 27 mã đề (3 QR × 9), dù thông báo ghi "24".
  const MAX = { p1: 40, p2: 8, p3: 8, codes: 27, perQr: 9 };
  const isNum = v => !isNaN(v) && !isNaN(v - parseFloat(v));
  const isDigit = c => c >= 48 && c <= 57;
  const blank = v => v == null || String(v).replace(/\s/g, '') === '';

  /* Chuỗi đáp án của 1 mã đề, từ các ô như trong file Excel mẫu (ô trống = "?"). */
  function encodeRow(p1Cells, p2Cells, p3Cells) {
    let out = '';
    // Phần I: chỉ tính tới câu cuối cùng có đáp án ở dòng đầu (numberSentence) – xử lý ở build()
    p1Cells.forEach(v => {
      const s = String(v).trim().replace(/['" ]/g, ''); const c = s.charCodeAt(0);
      out += !blank(s) && c >= 65 && c <= 69 ? s : '?';
    });
    let first = true;
    p2Cells.forEach((v, k) => {
      let s = String(v).trim().replace(/['" ]/g, '').replace(',', '.'); const c = s.charCodeAt(0);
      if (!blank(s) && c >= 65 && c <= 90) {
        if (c === 68) s = 'Đ';
        if (first) { out += '#' + s; first = false; } else out += (k % 4 === 0 ? '_' : '') + s;
      }
    });
    first = true;
    p3Cells.forEach(v => {
      let s = String(v).trim().replace(/['" ]/g, '').replace(',', '.');
      let d = s.length - 1;
      while (d > 0 && !isDigit(s.charCodeAt(d))) d--;
      s = s.slice(0, d + 1);
      if (!blank(s) && isNum(s)) { out += (first ? '#' : '_') + s; first = false; }
      else if (s.charCodeAt(0) !== 63) out += '?';
    });
    return out;
  }

  /* versions: [{code, p1:[{ansLetter}], p2:[{ansArr:[bool×4]}], p3:[{ansVal}]}] (cấu trúc của tronde.js) */
  function build(versions) {
    if (!versions || !versions.length) return { ok: false, err: 'Chưa có mã đề nào. Bấm "Trộn đề" trước.' };
    const v0 = versions[0];
    if (v0.p1.length > MAX.p1 || v0.p2.length > MAX.p2 || v0.p3.length > MAX.p3) {
      return { ok: false, err: `Mẫu TNMaker 2025 chỉ nhận tối đa ${MAX.p1} câu Phần I, ${MAX.p2} câu Phần II, ${MAX.p3} câu Phần III. Đề này có ${v0.p1.length}/${v0.p2.length}/${v0.p3.length} câu. Chọn "Rút theo ma trận" để giảm số câu.` };
    }
    if (versions.length > MAX.codes) return { ok: false, err: `TNMaker đọc tối đa ${MAX.codes} mã đề. Hiện có ${versions.length} mã đề.` };
    const bad = versions.filter(v => !isNum(String(v.code).trim())).map(v => v.code);
    if (bad.length) return { ok: false, err: 'Mã đề phải là số (vd. 101, 102). Mã không hợp lệ: ' + bad.join(', ') };
    const pad = (arr, n) => arr.concat(Array(Math.max(0, n - arr.length)).fill('?'));
    // numberSentence: số câu Phần I tính theo mã đề đầu tiên (câu cuối có chữ A–E)
    const nP1 = v0.p1.reduce((m, x, i) => /^[A-E]$/.test(x.ansLetter || '') ? i + 1 : m, 0);
    const rows = versions.map(v => {
      const p1 = v.p1.slice(0, nP1).map(x => x.ansLetter || '?');
      const p2 = pad([].concat(...v.p2.map(x => (x.ansArr || []).map(b => b ? 'D' : 'S'))), 0);
      const p3 = v.p3.map(x => blank(x.ansVal) ? '?' : String(x.ansVal));
      return { code: String(v.code).trim(), str: encodeRow(p1, p2, p3) };
    });
    const payloads = [];
    for (let i = 0; i < rows.length; i += MAX.perQr) {
      const o = { success: true, type: 6 };
      rows.slice(i, i + MAX.perQr).forEach(r => { o[r.code] = r.str; });
      payloads.push(JSON.stringify(o));
    }
    return { ok: true, rows, payloads };
  }

  root.TNMakerQR = { build, encodeRow, MAX };
})(typeof window !== 'undefined' ? window : globalThis);
