/* report.js – Trang GV xem điểm + Trợ lý cấu hình & test kết nối Google Sheet 1-Click · Kimkenpkl */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const COLS_TABLE = ['Thời điểm nộp', 'Tên đề', 'Họ tên', 'Lớp', 'SBD', 'Điểm', '%', 'P1', 'P2', 'P3', 'Làm/phút', 'Rời tab', 'Nguồn'];
  const COLS_CSV = ['Thời điểm nộp', 'examId', 'Tên đề', 'Mã phòng', 'Họ tên', 'Lớp', 'SBD', 'Điểm', 'Tối đa', '%', 'P1', 'P2', 'P3', 'Làm/phút', 'Rời tab', 'Thoát FS', 'Số câu TL', 'Tổng câu', 'Nguồn'];
  let CFG = {}, LASTROWS = [], CHART = null;

  function activeUrl() {
    return (($('inpGsUrl') && $('inpGsUrl').value) || PTW.ls.get('ptw_custom_gs_url') || CFG.appsScriptUrl || '').trim();
  }

  function updateStatusBadge() {
    const u = activeUrl();
    const b = $('gsStatusBadge');
    if (!b) return;
    if (u) {
      b.textContent = '🟢 Đã gắn URL Apps Script';
      b.style.background = '#ECFDF5';
      b.style.color = '#047857';
      b.style.borderColor = '#A7E3CC';
    } else {
      b.textContent = '🟡 Đang lưu cục bộ trên trình duyệt (chưa gắn URL Sheet)';
      b.style.background = '#FFFBEB';
      b.style.color = '#B45309';
      b.style.borderColor = '#FDE68A';
    }
  }

  async function boot() {
    try { CFG = await loadJSON('../data/config.json'); } catch (e) {}
    const savedUrl = PTW.ls.get('ptw_custom_gs_url') || CFG.appsScriptUrl || '';
    if ($('inpGsUrl')) $('inpGsUrl').value = savedUrl;
    const savedPass = sessionStorage.getItem('ptwRpPass') || '';
    if ($('inpPass')) $('inpPass').value = savedPass;
    updateStatusBadge();

    try {
      const idx = await loadJSON('../data/exams.json');
      $('selExam').innerHTML = '<option value="">— Tất cả các bài —</option>' +
        (idx.exams || []).map(x => `<option value="${escapeHTML(x.id)}">${escapeHTML(x.title)}</option>`).join('');
    } catch (e) {}

    loadReport();
  }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const cb = '__ptwcb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const timer = setTimeout(() => { reject(new Error('Hết thời gian chờ (Timeout) khi gọi Apps Script')); }, 12000);
      window[cb] = data => { clearTimeout(timer); resolve(data); };
      const s = document.createElement('script');
      s.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'callback=' + cb;
      s.onerror = () => { clearTimeout(timer); reject(new Error('Không kết nối được URL Apps Script (kiểm tra quyền "Anyone")')); };
      document.body.appendChild(s);
    });
  }

  async function loadReport() {
    const btn = $('btnLoad');
    const errEl = $('gateErr');
    if (errEl) errEl.textContent = '';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang tải…'; }

    const examFilter = $('selExam') ? $('selExam').value : '';
    const localSubs = (PTW.ls.get('ptw_local_submissions') || [])
      .filter(r => !examFilter || r.examId === examFilter)
      .map(r => ({ ...r, 'Nguồn': '💻 Máy này' }));

    let sheetRows = [];
    const u = activeUrl();
    const pass = ($('inpPass') && $('inpPass').value.trim()) || sessionStorage.getItem('ptwRpPass') || '';
    if (pass) sessionStorage.setItem('ptwRpPass', pass);

    if (u && pass) {
      try {
        const res = await jsonp(`${u}?action=report&pass=${encodeURIComponent(pass)}&exam=${encodeURIComponent(examFilter)}`);
        if (res && res.err === 'unauthorized') {
          if (errEl) errEl.textContent = '⚠ Mã GV (REPORT_PASS) chưa khớp với Script Properties trên Google Sheet. Hiện đang hiển thị các bài lưu trên máy này.';
        } else if (res && Array.isArray(res.rows)) {
          sheetRows = res.rows.map(r => ({ ...r, 'Nguồn': '☁️ Google Sheet' }));
        }
      } catch (err) {
        if (errEl) errEl.textContent = '⚠ ' + (err.message || 'Không tải được từ Google Sheet.') + ' Đang hiển thị dữ liệu lưu trên máy này.';
      }
    }

    LASTROWS = sheetRows.concat(localSubs);
    renderStats();
    renderTable();
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Làm mới bảng điểm'; }
  }

  function renderStats() {
    const rows = LASTROWS, n = rows.length;
    const pcts = rows.map(r => {
      if (r['%'] != null && r['%'] !== '') return +r['%'] || 0;
      const sc = +r['Điểm'] || 0, mx = +r['Tối đa'] || 10;
      return mx ? (sc / mx * 100) : 0;
    });
    const sc = rows.map(r => +r['Điểm'] || 0);
    const avg = n ? sc.reduce((a, b) => a + b, 0) / n : 0;
    const hi = n ? Math.max.apply(null, sc) : 0;
    const lo = n ? Math.min.apply(null, sc) : 0;
    const cls = [...new Set(rows.map(r => r['Lớp'] || ''))].filter(Boolean);
    $('stat').innerHTML = `
      <span class="badge">🧾 Tổng bài nộp: <b>${n}</b></span>
      <span class="badge">📈 Điểm TB: <b>${fmtScore(avg)}</b></span>
      <span class="badge">⬆ Cao nhất: <b>${fmtScore(hi)}</b></span>
      <span class="badge">⬇ Thấp nhất: <b>${fmtScore(lo)}</b></span>
      ${cls.map(c => `<span class="badge">🏫 ${escapeHTML(c)}</span>`).join('')}`;
    const b = [0, 0, 0, 0, 0];
    pcts.forEach(p => { b[Math.min(4, Math.floor(p / 20))]++; });
    if (CHART) { CHART.destroy(); CHART = null; }
    if (window.Chart) {
      CHART = new Chart($('hist'), {
        type: 'bar',
        data: {
          labels: ['0–20%', '20–40%', '40–60%', '60–80%', '80–100%'],
          datasets: [{ label: 'Số bài theo % điểm đạt được', data: b, backgroundColor: '#7C3AED', borderRadius: 6 }]
        },
        options: { plugins: { legend: { display: true } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
      });
    }
  }

  function renderTable() {
    const rows = LASTROWS.slice().sort((a, b) => (+b['Điểm'] || 0) - (+a['Điểm'] || 0));
    if (!rows.length) {
      $('tblWrap').innerHTML = '<p class="hint">Chưa có bài nộp nào. Thầy có thể vào thử 1 đề bất kỳ ở Trang HS và bấm Nộp bài — điểm sẽ xuất hiện ngay tại đây!</p>';
      return;
    }
    $('tblWrap').innerHTML = '<div style="overflow-x:auto"><table><thead><tr>' + COLS_TABLE.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>' +
      rows.map(r => '<tr>' + COLS_TABLE.map(c => {
        const v = r[c];
        if (v == null) return '<td></td>';
        if (c === 'Điểm') return '<td><b>' + fmtScore(+v) + '</b>' + (r['Tối đa'] ? '<span class="hint">/' + fmtScore(+r['Tối đa']) + '</span>' : '') + '</td>';
        if (c === '%') return '<td>' + (+v).toFixed(1) + '%</td>';
        if (['P1', 'P2', 'P3'].indexOf(c) >= 0) return '<td>' + fmtScore(+v || 0) + '</td>';
        return '<td>' + escapeHTML(String(v)) + '</td>';
      }).join('') + '</tr>').join('') + '</tbody></table></div>';
  }

  if ($('btnSaveGs')) {
    $('btnSaveGs').onclick = async () => {
      const u = ($('inpGsUrl').value || '').trim();
      const pass = ($('inpPass').value || '').trim();
      PTW.ls.set('ptw_custom_gs_url', u);
      if (pass) sessionStorage.setItem('ptwRpPass', pass);
      updateStatusBadge();
      const msg = $('gsPingMsg');
      if (!u) {
        msg.textContent = '💾 Đã lưu chế độ cục bộ (chưa nhập URL Apps Script).';
        loadReport();
        return;
      }
      msg.textContent = '⏳ Đang kiểm tra kết nối (Ping) tới Apps Script…';
      try {
        const res = await jsonp(`${u}?action=ping`);
        if (res && res.ok) {
          msg.innerHTML = '<span style="color:#047857;font-weight:700">✅ Kết nối Google Sheet thành công (' + escapeHTML(res.msg || 'OK') + ')!</span>';
        } else {
          msg.innerHTML = '<span style="color:#B45309">⚠ Đã nhận phản hồi nhưng chưa đúng chuẩn.</span>';
        }
      } catch (e) {
        msg.innerHTML = '<span style="color:#DC2626">❌ Lỗi kết nối: ' + escapeHTML(e.message) + '</span>';
      }
      loadReport();
    };
  }

  if ($('btnCopyGsCode')) {
    $('btnCopyGsCode').onclick = async () => {
      try {
        const r = await fetch('../apps-script/Code.gs', { cache: 'no-store' });
        const txt = await r.text();
        await navigator.clipboard.writeText(txt);
        $('btnCopyGsCode').textContent = '✅ Đã copy mã Code.gs!';
        setTimeout(() => { $('btnCopyGsCode').textContent = '📋 Copy mã Code.gs'; }, 3000);
      } catch (e) {
        alert('Không tự copy được, thầy mở file apps-script/Code.gs nhé.');
      }
    };
  }

  if ($('btnDownloadConfig')) {
    $('btnDownloadConfig').onclick = () => {
      const u = activeUrl();
      const newCfg = {
        _doc: 'Cau hinh site. Sau khi deploy Apps Script (xem apps-script/Code.gs), thay appsScriptUrl bang URL dang https://script.google.com/macros/s/xxx/exec',
        brand: CFG.brand || 'Phòng Thi 24/7',
        appsScriptUrl: u,
        classes: CFG.classes || [],
        requireFullscreen: CFG.requireFullscreen !== false,
        blockCopy: CFG.blockCopy !== false,
        maxExitWarnings: CFG.maxExitWarnings || 20,
        version: '1.1.0'
      };
      const blob = new Blob([JSON.stringify(newCfg, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'config.json';
      a.click();
    };
  }

  if ($('btnClearLocal')) {
    $('btnClearLocal').onclick = () => {
      if (confirm('Xóa lịch sử các bài thi thử lưu trên trình duyệt này?')) {
        PTW.ls.del('ptw_local_submissions');
        loadReport();
      }
    };
  }

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
