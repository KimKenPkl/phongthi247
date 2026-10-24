/* report.js – Trang GV xem điểm: gate mã GV → JSONP tới Apps Script → thống kê + biểu đồ + bảng + CSV */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const COLS_TABLE = ['Thời điểm nộp', 'Tên đề', 'Họ tên', 'Lớp', 'SBD', 'Điểm', '%', 'P1', 'P2', 'P3', 'Làm/phút', 'Rời tab', 'Thoát FS'];
  const COLS_CSV = ['Thời điểm nộp', 'examId', 'Tên đề', 'Mã phòng', 'Họ tên', 'Lớp', 'SBD', 'Điểm', 'Tối đa', '%', 'P1', 'P2', 'P3', 'Làm/phút', 'Rời tab', 'Thoát FS', 'Số câu TL', 'Tổng câu'];
  let CFG = {}, LASTROWS = [], CHART = null;

  async function boot() {
    try { CFG = await loadJSON('../data/config.json'); } catch (e) {}
    if (!CFG.appsScriptUrl) {
      $('noScript').style.display = '';
      $('btnLoad').disabled = true;
    }
    try {
      const idx = await loadJSON('../data/exams.json');
      $('selExam').innerHTML = '<option value="">— Tất cả các bài —</option>' +
        (idx.exams || []).map(x => `<option value="${escapeHTML(x.id)}">${escapeHTML(x.title)}</option>`).join('');
    } catch (e) {}
    if (sessionStorage.getItem('ptwRpPass')) {
      $('gate').style.display = 'none';
      $('viewer').style.display = '';
      if (CFG.appsScriptUrl) loadReport();
    }
  }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const cb = '__ptwcb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      window[cb] = data => resolve(data);
      const s = document.createElement('script');
      s.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'callback=' + cb;
      s.onerror = () => reject(new Error('Lỗi mạng hoặc URL Apps Script chưa đúng'));
      document.body.appendChild(s);
    });
  }

  async function loadReport() {
    const btn = $('btnLoad');
    btn.disabled = true; btn.textContent = '⏳ Đang tải…';
    try {
      const pass = encodeURIComponent(sessionStorage.getItem('ptwRpPass') || '');
      const exam = encodeURIComponent($('selExam').value || '');
      const res = await jsonp(`${CFG.appsScriptUrl}?action=report&pass=${pass}&exam=${exam}`);
      if (res && res.err === 'unauthorized') {
        sessionStorage.removeItem('ptwRpPass');
        $('gate').style.display = '';
        $('viewer').style.display = 'none';
        $('gateErr').textContent = 'Mã GV sai, hoặc REPORT_PASS chưa đặt trong Script Properties của Apps Script.';
        return;
      }
      LASTROWS = (res && res.rows) || [];
      renderStats();
      renderTable();
    } catch (err) {
      $('tblWrap').innerHTML = '<div class="banner banner-danger">⚠ ' + escapeHTML(err.message || 'Không tải được dữ liệu.') + ' – kiểm tra appsScriptUrl và quyền truy cập "Anyone" của Web app.</div>';
    }
    btn.disabled = false; btn.textContent = '📥 Tải dữ liệu';
  }

  function renderStats() {
    const rows = LASTROWS, n = rows.length;
    const sc = rows.map(r => +r['Điểm'] || 0);
    const avg = n ? sc.reduce((a, b) => a + b, 0) / n : 0;
    const hi = n ? Math.max.apply(null, sc) : 0;
    const lo = n ? Math.min.apply(null, sc) : 0;
    const cls = [...new Set(rows.map(r => r['Lớp'] || ''))].filter(Boolean);
    $('stat').innerHTML = `
      <span class="badge">🧾 Bài nộp: <b>${n}</b></span>
      <span class="badge">📈 ĐTB: <b>${fmtScore(avg)}</b></span>
      <span class="badge">⬆ Cao nhất: <b>${fmtScore(hi)}</b></span>
      <span class="badge">⬇ Thấp nhất: <b>${fmtScore(lo)}</b></span>
      ${cls.map(c => `<span class="badge">🏫 ${escapeHTML(c)}</span>`).join('')}`;
    const b = [0, 0, 0, 0, 0];
    sc.forEach(s => { b[Math.min(4, Math.floor(s / 2))]++; });
    if (CHART) { CHART.destroy(); CHART = null; }
    if (window.Chart) {
      CHART = new Chart($('hist'), {
        type: 'bar',
        data: {
          labels: ['0–2', '2–4', '4–6', '6–8', '8–10'],
          datasets: [{ label: 'Số bài', data: b, backgroundColor: '#7C3AED', borderRadius: 6 }]
        },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
      });
    }
  }

  function renderTable() {
    const rows = LASTROWS.slice().sort((a, b) => (+b['Điểm'] || 0) - (+a['Điểm'] || 0));
    if (!rows.length) { $('tblWrap').innerHTML = '<p class="hint">Chưa có bài nộp nào trong Sheet.</p>'; return; }
    $('tblWrap').innerHTML = '<table><thead><tr>' + COLS_TABLE.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>' +
      rows.map(r => '<tr>' + COLS_TABLE.map(c => {
        const v = r[c];
        if (v == null) return '<td></td>';
        if (c === 'Điểm') return '<td><b>' + fmtScore(+v) + '</b></td>';
        if (c === '%') return '<td>' + (+v).toFixed(1) + '%</td>';
        if (['P1', 'P2', 'P3'].indexOf(c) >= 0) return '<td>' + fmtScore(+v || 0) + '</td>';
        return '<td>' + escapeHTML(String(v)) + '</td>';
      }).join('') + '</tr>').join('') + '</tbody></table>';
  }

  $('btnUnlock').onclick = () => {
    const p = $('inpPass').value.trim();
    if (!p) { $('gateErr').textContent = '⚠ Nhập mã GV trước.'; return; }
    sessionStorage.setItem('ptwRpPass', p);
    $('gate').style.display = 'none';
    $('viewer').style.display = '';
    loadReport();
  };
  $('btnLoad').onclick = () => loadReport();
  $('selExam').onchange = () => loadReport();
  $('btnCsv').onclick = () => {
    if (!LASTROWS.length) return;
    const esc = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const lines = [COLS_CSV.join(',')].concat(LASTROWS.map(r => COLS_CSV.map(c => esc(r[c])).join(',')));
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'diem-phong-thi.csv';
    a.click();
  };

  boot();
})();
