/* Code.gs – Backend "BaiLam" của Phong Thi Web (Apps Script) ─────────────
 * Cài đặt:
 *  1) Tạo Google Sheet trống (VD: "BAI LAM Phong Thi Web").
 *     Menu Tiện ích mở rộng (Extensions) → Apps Script → dán file này → Lưu.
 *  2) Tại Apps Script: Settings (⚙) → Script Properties → thêm 2 thuộc tính:
 *     REPORT_PASS = một mật khẩu GV (để trang report được phép xem dữ liệu)
 *  3) Triển khai (Deploy) → New deployment → Web app:
 *     Execute as: Me   ·  Who has access: Anyone   → lấy URL /exec
 *  4) Dán URL /exec vào data/config.json → "appsScriptUrl" → commit & push.
 *  5) Vào trang report, nhập REPORT_PASS để xem bảng điểm + cập nhật CSV.
 * Sheet được tạo tự động các cột. doPost chỉ chấp nhận JSON.
 */

const SHEET_NAME = 'BaiLam';
const HEADERS = [
  'Thời điểm nộp', 'examId', 'Tên đề', 'Mã phòng', 'attemptId',
  'Họ tên', 'Lớp', 'SBD',
  'Điểm', 'Tối đa', '%', 'P1', 'P2', 'P3',
  'Làm/phút', 'Rời tab', 'Thoát FS', 'Số câu TL', 'Tổng câu',
  'Thiết bị', 'Chi tiết điểm câu (JSON)', 'Đáp án (JSON)', 'Làm/giây', 'Ghi chú'
];
const CELL_MAX = 45000; // Google Sheet giới hạn 50.000 ký tự/ô

function clip_(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) : s; }
function num_(v, lo, hi) { const x = Number(v); return isFinite(x) ? Math.min(hi, Math.max(lo, x)) : ''; }

function ensureSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Xếp hàng tối đa 25 giây khi có hàng trăm học sinh nộp bài cùng lúc (tránh mất dữ liệu)
    lock.waitLock(25000);
    if (!e || !e.postData || !e.postData.contents) return json_({ ok: false, err: 'no_body' });
    const d = JSON.parse(e.postData.contents);
    // Chặn bài nộp rác: họ tên phải có ít nhất 2 chữ cái, phải có mã đề
    const name = clip_(d.name, 60).trim();
    if ((name.match(/[A-Za-zÀ-ỹ]/g) || []).length < 2) return json_({ ok: false, err: 'bad_name' });
    if (!d.examId) return json_({ ok: false, err: 'no_exam' });
    const sh = ensureSheet_();
    // Kiểm tra mềm số lượt nộp: vẫn lưu bài nhưng ghi chú để GV thấy (không chặn, tránh mất bài).
    let note = '';
    const maxAtt = Math.floor(Number(d.maxAttempts) || 0);
    if (maxAtt > 0 && sh.getLastRow() > 1) {
      const vals = sh.getRange(2, 2, sh.getLastRow() - 1, 6).getValues(); // cột examId … Lớp
      const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const k = norm(d.examId) + '|' + norm(name) + '|' + norm(d.class);
      const used = vals.filter(v => norm(v[0]) + '|' + norm(v[4]) + '|' + norm(v[5]) === k).length;
      if (used >= maxAtt) note = 'Vượt số lượt (' + (used + 1) + '/' + maxAtt + ')';
    }
    const row = [
      clip_(d.ts || new Date().toISOString(), 40),
      clip_(d.examId, 80), clip_(d.examTitle, 200), clip_(d.code, 20), clip_(d.attemptId, 60),
      name, clip_(d.class, 20).trim(), clip_(d.sbd, 20),
      num_(d.score, 0, 1000), num_(d.max, 0, 1000), num_(d.pct, 0, 100),
      (d.per && d.per.part1) || 0, (d.per && d.per.part2) || 0, (d.per && d.per.part3) || 0,
      num_(d.timeUsedMin, 0, 100000), num_(d.exitTab || 0, 0, 100000), num_(d.exitFs || 0, 0, 100000),
      num_(d.answered, 0, 10000), num_(d.total, 0, 10000),
      clip_(d.ua, 300), clip_(d.detail, CELL_MAX), clip_(d.answers, CELL_MAX),
      num_(d.timeUsedSec, 0, 10000000),
      note
    ];
    sh.appendRow(row);
    SpreadsheetApp.flush();
    CacheService.getScriptCache().remove('top_' + row[1]);
    CacheService.getScriptCache().remove('top_');
    return json_({ ok: true, saved: row[0] });
  } catch (err) {
    return json_({ ok: false, err: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/* GET: action=ping → dùng kiểm tra; action=report&pass=...&exam=... (JSONP qua callback=) */
function doGet(e) {
  const p = (e && e.parameter) || {};
  // Chỉ nhận tên callback JSONP an toàn (chống chèn mã)
  const cb = /^[A-Za-z_$][\w$.]{0,80}$/.test(p.callback || '') ? p.callback : null;
  if (p.action === 'ping') return out_({ ok: true, msg: 'GS ready' }, cb);
  if (p.action === 'top') return out_(top_(p.exam || ''), cb);
  if (p.action === 'roster') {
    // Danh sách lớp nằm ở tab "DanhSach" (cột A: Họ tên, cột B: Lớp). Cần mã GV vì có tên học sinh.
    const pass = PropertiesService.getScriptProperties().getProperty('REPORT_PASS') || '';
    if (!pass || p.pass !== pass) return out_({ ok: false, err: 'unauthorized' }, cb);
    const rs = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DanhSach');
    if (!rs) return out_({ ok: false, err: 'no_tab', msg: 'Chưa có tab "DanhSach" trong Google Sheet (cột A: Họ tên, cột B: Lớp).' }, cb);
    const rows = rs.getDataRange().getValues()
      .map(r => ({ name: String(r[0] || '').trim(), class: String(r[1] || '').trim() }))
      .filter(r => r.name && !/^họ (và )?tên$/i.test(r.name));
    return out_({ ok: true, rows }, cb);
  }
  if (p.action === 'report') {
    const pass = PropertiesService.getScriptProperties().getProperty('REPORT_PASS') || '';
    if (!pass || p.pass !== pass) return out_({ ok: false, err: 'unauthorized' }, cb);
    const sh = ensureSheet_();
    const values = sh.getDataRange().getValues();
    const head = values[0];
    let rows = values.slice(1).map(r => {
      const o = {};
      head.forEach((h, i) => { o[h] = r[i]; });
      if (p.exam && o.examId !== p.exam) return null;
      return o;
    }).filter(Boolean);
    // CSV mode: trả chuỗi để GV download nhanh
    if (p.format === 'csv') {
      const csvRows = [head.join(',')].concat(rows.map(r => head.map(h => JSON.stringify(r[h] == null ? '' : r[h])).join(',')));
      const text = csvRows.join('\n');
      const out = ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.TEXT);
      if (cb) return out;
      return out;   // CSV tải qua fetch report trang
    }
    return out_({ ok: true, count: rows.length, rows }, cb);
  }
  return out_({ ok: true, msg: 'Phong Thi Web GS — dùng action=ping hoặc action=report' }, cb);
}

/* Bảng xếp hạng công khai: chỉ trả họ tên, lớp, điểm, thời gian (không SBD, không bài làm).
 * Mỗi học sinh (họ tên + lớp + đề) giữ lượt cao nhất. Lưu cache 30 giây cho đỡ tải. */
/* "Nguyễn Văn An" → "Nguyễn V. A." — giống maskName() trong assets/common.js */
function maskName_(n) {
  const w = String(n || '').normalize('NFC').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '';
  const ini = x => (Array.from(x)[0] || '').toUpperCase() + '.';
  return w.length === 1 ? ini(w[0]) : w[0] + ' ' + w.slice(1).map(ini).join(' ');
}
function sid_(key) {
  const salt = PropertiesService.getScriptProperties().getProperty('REPORT_PASS') || 'ptw';
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, salt + '|' + key, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(d).slice(0, 10);
}

function top_(examId) {
  const cache = CacheService.getScriptCache();
  const key = 'top_' + examId;
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  const values = ensureSheet_().getDataRange().getValues();
  const head = values[0];
  const ix = h => head.indexOf(h);
  const iTs = ix('Thời điểm nộp'), iEx = ix('examId'), iTitle = ix('Tên đề'), iAtt = ix('attemptId');
  const iName = ix('Họ tên'), iCls = ix('Lớp'), iSc = ix('Điểm'), iMax = ix('Tối đa'), iPct = ix('%');
  const iMin = ix('Làm/phút'), iSec = ix('Làm/giây'), iTab = ix('Rời tab');
  const best = {};
  values.slice(1).forEach(r => {
    if (examId && r[iEx] !== examId) return;
    const sec = (iSec >= 0 && r[iSec] !== '') ? Number(r[iSec]) : (Number(r[iMin]) || 1) * 60;
    const o = {
      ts: r[iTs] instanceof Date ? r[iTs].toISOString() : String(r[iTs]),
      examId: r[iEx], examTitle: r[iTitle], attemptId: r[iAtt],
      name: String(r[iName]), class: String(r[iCls]),
      score: Number(r[iSc]) || 0, max: Number(r[iMax]) || 10, pct: Number(r[iPct]) || 0,
      timeUsedSec: sec, exitTab: Number(r[iTab]) || 0
    };
    const k = (o.examId + '|' + o.name.replace(/\s+/g, ' ').trim() + '|' + o.class.replace(/\s+/g, '')).toLowerCase();
    // Bảng công khai: che tên, kèm mã sid ngắn (băm có muối) để phân biệt 2 em trùng tên viết tắt.
    o.sid = sid_(k);
    o.name = maskName_(o.name);
    const b = best[k];
    if (!b || o.pct > b.pct || (o.pct === b.pct && o.timeUsedSec < b.timeUsedSec)) best[k] = o;
  });
  const rows = Object.keys(best).map(k => best[k])
    .sort((a, b) => (b.pct - a.pct) || (a.timeUsedSec - b.timeUsedSec)).slice(0, 200);
  const res = { ok: true, count: rows.length, rows: rows };
  try { cache.put(key, JSON.stringify(res), 30); } catch (e) {}
  return res;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
/* Nhận JSONP (callback) để trang report tải chéo-miễn-profit từ script.facebook */
function out_(obj, cb) {
  if (cb) return ContentService.createTextOutput(cb + '(' + JSON.stringify(obj) + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return json_(obj);
}
