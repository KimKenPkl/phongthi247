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
  'Thiết bị', 'Chi tiết điểm câu (JSON)', 'Đáp án (JSON)'
];

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
    const sh = ensureSheet_();
    const row = [
      d.ts || new Date().toISOString(),
      d.examId || '', d.examTitle || '', d.code || '', d.attemptId || '',
      d.name || '', d.class || '', d.sbd || '',
      d.score != null ? d.score : '', d.max != null ? d.max : '', d.pct != null ? d.pct : '',
      (d.per && d.per.part1) || 0, (d.per && d.per.part2) || 0, (d.per && d.per.part3) || 0,
      d.timeUsedMin != null ? d.timeUsedMin : '', d.exitTab || 0, d.exitFs || 0,
      d.answered != null ? d.answered : '', d.total != null ? d.total : '',
      d.ua || '', d.detail || '', d.answers || ''
    ];
    sh.appendRow(row);
    SpreadsheetApp.flush();
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
  const cb = p.callback || null;
  if (p.action === 'ping') return out_({ ok: true, msg: 'GS ready' }, cb);
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

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
/* Nhận JSONP (callback) để trang report tải chéo-miễn-profit từ script.facebook */
function out_(obj, cb) {
  if (cb) return ContentService.createTextOutput(cb + '(' + JSON.stringify(obj) + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return json_(obj);
}
