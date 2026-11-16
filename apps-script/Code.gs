/* Code.gs – Backend "BaiLam" của Phong Thi Web (Apps Script) ─────────────
 * Cài đặt:
 *  1) Tạo Google Sheet trống (VD: "BAI LAM Phong Thi Web").
 *     Menu Tiện ích mở rộng → Apps Script → dán đủ Code.gs, Submission.gs, ExamRegistry.gs.
 *  2) Tại Apps Script: Settings (⚙) → Script Properties → thêm REPORT_PASS:
 *     REPORT_PASS = một mật khẩu GV (để trang report được phép xem dữ liệu)
 *  3) Triển khai (Deploy) → New deployment → Web app:
 *     Execute as: Me   ·  Who has access: Anyone   → lấy URL /exec
 *     REPORT_READERS và PUBLIC_RANKING: xem docs/SUBMISSION-HARDENING.md.
 *  4) Dán URL /exec vào data/config.json → "appsScriptUrl".
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
const RECEIVED_HEADER = 'Server nhận (Asia/Ho_Chi_Minh)';

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
  let headers = sh.getLastColumn() > 0 ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
  if (!headers.some(h => String(h || '').trim())) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    headers = HEADERS.slice();
  }
  if (headers.indexOf(RECEIVED_HEADER) < 0) {
    const column = headers.length + 1;
    sh.getRange(1, column).setValue(RECEIVED_HEADER);
    headers.push(RECEIVED_HEADER);
  }
  return sh;
}

function doPost(e) {
  return handlePost_(e);
}

/* Kept as a row builder; only validated, server-graded input reaches this function. */
function appendSubmission_(d, sh, note) {
    const receivedAt = new Date();
    const values = [
      clip_(d.ts || new Date().toISOString(), 40),
      clip_(d.examId, 80), clip_(d.examTitle, 200), clip_(d.code, 20), clip_(d.attemptId, 80),
       d.name, d.class, d.sbd,
      num_(d.score, 0, 1000), num_(d.max, 0, 1000), num_(d.pct, 0, 100),
      (d.per && d.per.part1) || 0, (d.per && d.per.part2) || 0, (d.per && d.per.part3) || 0,
      num_(d.timeUsedMin, 0, 100000), num_(d.exitTab || 0, 0, 100000), num_(d.exitFs || 0, 0, 100000),
      num_(d.answered, 0, 10000), num_(d.total, 0, 10000),
      clip_(d.ua, 300), clip_(d.detail, CELL_MAX), clip_(d.answers, CELL_MAX),
      num_(d.timeUsedSec, 0, 10000000),
      note
    ];
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const rowByHeader = {};
    HEADERS.forEach((header, index) => { rowByHeader[header] = values[index]; });
    rowByHeader[RECEIVED_HEADER] = receivedAt;
    rowByHeader['Receipt hash'] = d.receiptHash;
    rowByHeader['Submission hash'] = d.submissionHash;
    rowByHeader['Exam revision'] = d.revision;
    rowByHeader['Bài đầy đủ'] = d.full;
    const row = headers.map(header => safeCell_(Object.prototype.hasOwnProperty.call(rowByHeader, header) ? rowByHeader[header] : ''));
    if (headers.indexOf(RECEIVED_HEADER) < 0) throw new Error('Missing server-received timestamp column');
    sh.appendRow(row);
    SpreadsheetApp.flush();
    CacheService.getScriptCache().remove('top_all_' + row[1]);
    CacheService.getScriptCache().remove('top_all_');
    return receipt_(d);
}

/* GET: ping, ranking công khai, capability một lần; report/roster bắt buộc POST. */
function doGet(e) {
  const p = (e && e.parameter) || {};
  // Chỉ nhận tên callback JSONP an toàn cho ping/ranking công khai.
  const cb = /^[A-Za-z_$][\w$.]{0,80}$/.test(p.callback || '') ? p.callback : null;
  if (p.action === 'ping') return out_({ ok: true, msg: 'GS ready' }, cb);
  if (p.action === 'top') return out_(top_(p.exam || '', p.period || 'all'), cb);
  if (p.action === 'capability') return out_(capabilityLookup_(p.nonce || ''), cb);
  return out_({ ok: false, err: 'post_required' }, cb);
}

/* Private reads are called only after POST authentication/scope checks. */
function privateRead_(p, scope) {
  if (p.action === 'roster') {
    // Danh sách lớp nằm ở tab "DanhSach" (cột A: Họ tên, cột B: Lớp). Cần mã GV vì có tên học sinh.
    const rs = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DanhSach');
    if (!rs) return { ok: false, err: 'no_tab' };
    const rows = rs.getDataRange().getValues()
      .map(r => ({ name: String(r[0] || '').trim(), class: String(r[1] || '').trim() }))
      .filter(r => r.name && !/^họ (và )?tên$/i.test(r.name) && (!scope.classes || scope.classes.indexOf(r.class) >= 0));
    // An exam-only reader has no permission to enumerate a school-wide roster.
    if (scope.exams) return { ok: false, err: 'roster_scope' };
    return { ok: true, rows, scope };
  }
  if (p.action === 'report') {
    const sh = ensureSheet_();
    const values = sh.getDataRange().getValues();
    const head = values[0].filter(h => ['Receipt hash', 'Submission hash'].indexOf(h) < 0);
    const rawHead = values[0];
    const window = periodWindow_(p.period || 'all', new Date());
    if (!window) return { ok: false, err: 'bad_period' };
    let rows = values.slice(1).map(r => {
      const o = {};
      head.forEach(h => { o[h] = r[rawHead.indexOf(h)]; });
      if (scope.classes && scope.classes.indexOf(String(o['Lớp'])) < 0) return null;
      if (scope.exams && scope.exams.indexOf(String(o.examId)) < 0) return null;
      if (p.exam && o.examId !== p.exam) return null;
      if (window.type !== 'all' && !inPeriod_(o[RECEIVED_HEADER], window)) return null;
      return o;
    }).filter(Boolean);
    // CSV mode: trả chuỗi để GV download nhanh
    if (p.format === 'csv') {
      const csvRows = [head.map(csvCell_).join(',')].concat(rows.map(r => head.map(h => csvCell_(r[h])).join(',')));
      const text = csvRows.join('\n');
      return { __csv: text };   // handlePost_ đóng gói JSON hoặc capability
    }
    return { ok: true, count: rows.length, rows, period: window, scope };
  }
  return { ok: false, err: 'bad_action' };
}

function capabilityLookup_(nonce) {
  if (!/^[a-f0-9]{64}$/.test(nonce || '')) return { ok: false, err: 'bad_capability' };
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const cache = CacheService.getScriptCache(), key = 'report_cap_' + nonce, raw = cache.get(key);
    if (!raw) return { ok: false, err: 'not_ready' };
    cache.remove(key);
    try { return JSON.parse(raw); } catch (_) { return { ok: false, err: 'bad_capability' }; }
  } catch (_) { return { ok: false, err: 'not_ready' }; }
  finally { try { lock.releaseLock(); } catch (_) {} }
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

function periodWindow_(type, now) {
  if (type !== 'all' && type !== 'week' && type !== 'month') return null;
  const tz = 'Asia/Ho_Chi_Minh';
  if (type === 'all') return { type: 'all', timezone: tz };
  const local = Utilities.formatDate(now, tz, 'yyyy-MM-dd').split('-').map(Number);
  const date = new Date(Date.UTC(local[0], local[1] - 1, local[2]));
  if (type === 'week') {
    const offset = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - offset);
  } else date.setUTCDate(1);
  const start = Utilities.formatDate(new Date(date.getTime()), 'UTC', 'yyyy-MM-dd');
  if (type === 'week') date.setUTCDate(date.getUTCDate() + 7);
  else date.setUTCMonth(date.getUTCMonth() + 1);
  const end = Utilities.formatDate(new Date(date.getTime()), 'UTC', 'yyyy-MM-dd');
  return {
    type: type,
    start: start,
    endExclusive: end,
    timezone: tz,
    source: 'server-received-at'
  };
}

function inPeriod_(value, window) {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return false;
  const local = Utilities.formatDate(date, window.timezone, 'yyyy-MM-dd');
  return local >= window.start && local < window.endExclusive;
}

function top_(examId, period) {
  if (PropertiesService.getScriptProperties().getProperty('PUBLIC_RANKING') !== 'true') return { ok: false, err: 'ranking_private' };
  period = period || 'all';
  const window = periodWindow_(period, new Date());
  if (!window) return { ok: false, err: 'bad_period' };
  const cache = CacheService.getScriptCache();
  const key = 'top_' + period + '_' + examId;
  if (period === 'all') {
    const hit = cache.get(key);
    if (hit) return JSON.parse(hit);
  }
  const values = ensureSheet_().getDataRange().getValues();
  const head = values[0];
  const ix = h => head.indexOf(h);
  const iTs = ix('Thời điểm nộp'), iEx = ix('examId'), iTitle = ix('Tên đề'), iAtt = ix('attemptId');
  const iName = ix('Họ tên'), iCls = ix('Lớp'), iSc = ix('Điểm'), iMax = ix('Tối đa'), iPct = ix('%'), iReceived = ix(RECEIVED_HEADER);
  const iMin = ix('Làm/phút'), iSec = ix('Làm/giây'), iTab = ix('Rời tab');
  const best = {};
  values.slice(1).forEach(r => {
    if (head.indexOf('Bài đầy đủ') < 0 || r[head.indexOf('Bài đầy đủ')] !== true) return;
    if (examId && r[iEx] !== examId) return;
    if (period !== 'all' && (iReceived < 0 || !inPeriod_(r[iReceived], window))) return;
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
  const res = { ok: true, count: rows.length, rows: rows, period: window };
  if (period === 'all') try { cache.put(key, JSON.stringify(res), 30); } catch (e) {}
  return res;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
/* JSONP: dữ liệu công khai đã che tên hoặc phản hồi capability ngẫu nhiên một lần. */
function out_(obj, cb) {
  if (cb) return ContentService.createTextOutput(cb + '(' + JSON.stringify(obj) + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return json_(obj);
}
