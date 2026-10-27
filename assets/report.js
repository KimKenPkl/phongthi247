/* report.js – Bảng Xếp Hạng Treo Thưởng (Cloud Realtime + Google Sheet + Local) · Kimkenpkl */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const COLS_TABLE = ['Hạng', 'Họ tên', 'Lớp', 'Tên đề', 'Điểm', '%', 'Làm/phút', 'P1', 'P2', 'P3', 'Rời tab', 'Thời điểm nộp'];
  const COLS_CSV = ['Hạng', 'Họ tên', 'Lớp', 'SBD', 'Tên đề', 'Điểm', 'Tối đa', '%', 'Làm/phút', 'Làm/giây', 'P1', 'P2', 'P3', 'Rời tab', 'Thoát FS', 'Thời điểm nộp', 'Nguồn'];
  let CFG = {}, RAW_ROWS = [], RANKED_ROWS = [], CHART = null;

  function activeUrl() {
    return (($('inpGsUrl') && $('inpGsUrl').value) || PTW.ls.get('ptw_custom_gs_url') || CFG.appsScriptUrl || '').trim();
  }

  async function boot() {
    try { CFG = await loadJSON('../data/config.json'); } catch (e) {}
    const savedUrl = PTW.ls.get('ptw_custom_gs_url') || CFG.appsScriptUrl || '';
    if ($('inpGsUrl')) $('inpGsUrl').value = savedUrl;
    const savedPass = sessionStorage.getItem('ptwRpPass') || '';
    if ($('inpPass')) $('inpPass').value = savedPass;

    try {
      const idx = await loadJSON('../data/exams.json');
      const exams = (idx.exams || []).filter(x => !x.customUrl);
      $('selExam').innerHTML = '<option value="">— Tất cả các đề —</option>' +
        exams.map(x => `<option value="${escapeHTML(x.id)}">${escapeHTML(x.title)}</option>`).join('');
      const urlExam = new URLSearchParams(location.search).get('exam');
      if (urlExam && exams.some(x => x.id === urlExam)) {
        $('selExam').value = urlExam;
      }
    } catch (e) {}

    loadReport();
  }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const cb = '__ptwcb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const timer = setTimeout(() => { reject(new Error('Hết thời gian chờ khi gọi Apps Script')); }, 12000);
      window[cb] = data => { clearTimeout(timer); resolve(data); };
      const s = document.createElement('script');
      s.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'callback=' + cb;
      s.onerror = () => { clearTimeout(timer); reject(new Error('Không kết nối được URL Apps Script')); };
      document.body.appendChild(s);
    });
  }

  async function loadReport() {
    const btn = $('btnLoad');
    const errEl = $('gateErr');
    if (errEl) errEl.textContent = '';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang đồng bộ từ Cloud…'; }

    const examFilter = $('selExam') ? $('selExam').value : '';

    // 1) Kéo dữ liệu từ Cloud Realtime (tự động từ mọi máy học sinh)
    let cloudRows = [];
    try {
      const list = await PTW.cloud.fetchExamOrAll(CFG, examFilter);
      cloudRows = list.map(r => ({ ...r, 'Nguồn': '🌐 Cloud' }));
    } catch (e) {}

    // 2) Kéo thêm từ localStorage của máy hiện tại (nếu có bài chưa kịp đẩy)
    const localSubs = (PTW.ls.get('ptw_local_submissions') || [])
      .filter(r => !examFilter || r.examId === examFilter)
      .map(r => ({ ...r, 'Nguồn': '💻 Máy này' }));

    // 3) Kéo thêm từ Google Sheet (nếu thầy có gắn appsScriptUrl)
    let sheetRows = [];
    const u = activeUrl();
    const pass = ($('inpPass') && $('inpPass').value.trim()) || sessionStorage.getItem('ptwRpPass') || '';
    if (u && pass) {
      try {
        const res = await jsonp(`${u}?action=report&pass=${encodeURIComponent(pass)}&exam=${encodeURIComponent(examFilter)}`);
        if (res && Array.isArray(res.rows)) {
          sheetRows = res.rows.map(r => ({ ...r, 'Nguồn': '☁️ Sheet' }));
        }
      } catch (err) {}
    }

    RAW_ROWS = cloudRows.concat(sheetRows).concat(localSubs);
    populateClassFilter();
    applyFilterAndRender();

    if (btn) { btn.disabled = false; btn.textContent = '🔄 Cập nhật Bảng xếp hạng ngay'; }
  }

  function populateClassFilter() {
    const sel = $('selClass');
    if (!sel) return;
    const prev = sel.value;
    const classes = [...new Set(RAW_ROWS.map(r => String(r.class || r['Lớp'] || '').trim()).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">— Tất cả các lớp —</option>' +
      classes.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
    if (classes.includes(prev)) sel.value = prev;
  }

  function applyFilterAndRender() {
    const clsFilter = $('selClass') ? $('selClass').value : '';
    const bestOnly = ($('selRankMode') ? $('selRankMode').value : 'best') === 'best';
    const filtered = RAW_ROWS.filter(r => {
      const c = String(r.class || r['Lớp'] || '').trim();
      return !clsFilter || c === clsFilter;
    });
    RANKED_ROWS = PTW.rankRows(filtered, bestOnly);
    renderPodium();
    renderStats();
    renderTable();
  }

  function renderPodium() {
    const wrap = $('podiumWrap');
    if (!wrap) return;
    if (!RANKED_ROWS.length) {
      wrap.innerHTML = '';
      return;
    }
    const top3 = RANKED_ROWS.slice(0, 3);
    const medals = ['🥇 HẠNG NHẤT (TOP 1)', '🥈 HẠNG NHÌ (TOP 2)', '🥉 HẠNG BA (TOP 3)'];
    wrap.innerHTML = `<div class="podium-grid">` + top3.map((r, i) => `
      <div class="podium-card podium-${i + 1}">
        <div class="podium-medal">${medals[i]}</div>
        <div class="podium-name">${escapeHTML(r['Họ tên'])} <span class="badge">${escapeHTML(r['Lớp'])}</span></div>
        <div class="podium-score">${fmtScore(r.score)} <span style="font-size:13px;color:var(--muted);font-weight:500">/ ${fmtScore(r.max)} đ (${r.pct.toFixed(1)}%)</span></div>
        <div class="hint" style="margin-top:4px">⏱ Thời gian: <b>${escapeHTML(r['Làm/phút'])}</b> · Rời tab: ×${r.exitTab}</div>
      </div>`).join('') + `</div>`;
  }

  function renderStats() {
    const rows = RANKED_ROWS, n = rows.length;
    const sc = rows.map(r => +r.score || 0);
    const pcts = rows.map(r => +r.pct || 0);
    const avg = n ? sc.reduce((a, b) => a + b, 0) / n : 0;
    const hi = n ? Math.max.apply(null, sc) : 0;
    const lo = n ? Math.min.apply(null, sc) : 0;
    $('stat').innerHTML = `
      <span class="badge">👥 Số học sinh xếp hạng: <b>${n}</b></span>
      <span class="badge">📈 Điểm TB: <b>${fmtScore(avg)}</b></span>
      <span class="badge">🏆 Điểm cao nhất: <b>${fmtScore(hi)}</b></span>
      <span class="badge">⬇ Thấp nhất: <b>${fmtScore(lo)}</b></span>`;
    const b = [0, 0, 0, 0, 0];
    pcts.forEach(p => { b[Math.min(4, Math.floor(p / 20))]++; });
    if (CHART) { CHART.destroy(); CHART = null; }
    if (window.Chart) {
      CHART = new Chart($('hist'), {
        type: 'bar',
        data: {
          labels: ['0–20%', '20–40%', '40–60%', '60–80%', '80–100%'],
          datasets: [{ label: 'Phân bố theo % điểm đạt được', data: b, backgroundColor: '#4F46E5', borderRadius: 6 }]
        },
        options: { plugins: { legend: { display: true } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
      });
    }
  }

  function renderTable() {
    const rows = RANKED_ROWS;
    if (!rows.length) {
      $('tblWrap').innerHTML = '<p class="hint" style="margin:0">Chưa có học sinh nào nộp bài ở bộ lọc hiện tại. Khi học sinh nộp bài trên bất kỳ thiết bị nào, tên và thứ hạng sẽ tự động xuất hiện tại đây.</p>';
      return;
    }
    const medals = ['🥇 #1', '🥈 #2', '🥉 #3'];
    $('tblWrap').innerHTML = '<div style="overflow-x:auto"><table><thead><tr>' + COLS_TABLE.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>' +
      rows.map((r, idx) => '<tr style="' + (idx < 3 ? 'background:#F8FAFC;font-weight:600' : '') + '">' + COLS_TABLE.map(c => {
        const v = r[c];
        if (c === 'Hạng') return `<td><b>${idx < 3 ? medals[idx] : ('#' + r.rank)}</b></td>`;
        if (v == null) return '<td></td>';
        if (c === 'Điểm') return '<td><b style="color:var(--primary)">' + fmtScore(+v) + '</b><span class="hint">/' + fmtScore(+r.max) + '</span></td>';
        if (c === '%') return '<td>' + (+v).toFixed(1) + '%</td>';
        if (['P1', 'P2', 'P3'].indexOf(c) >= 0) return '<td>' + fmtScore(+v || 0) + '</td>';
        return '<td>' + escapeHTML(String(v)) + '</td>';
      }).join('') + '</tr>').join('') + '</tbody></table></div>';
  }

  if ($('btnToggleGs')) {
    $('btnToggleGs').onclick = () => {
      const card = $('gsSetupCard');
      if (card) card.style.display = card.style.display === 'none' ? '' : 'none';
    };
  }

  if ($('btnSaveGs')) {
    $('btnSaveGs').onclick = async () => {
      const u = ($('inpGsUrl').value || '').trim();
      const pass = ($('inpPass').value || '').trim();
      PTW.ls.set('ptw_custom_gs_url', u);
      if (pass) sessionStorage.setItem('ptwRpPass', pass);
      const msg = $('gsPingMsg');
      if (!u) {
        msg.textContent = 'Đang dùng Cloud Realtime mặc định.';
        loadReport();
        return;
      }
      msg.textContent = '⏳ Đang kiểm tra kết nối…';
      try {
        const res = await jsonp(`${u}?action=ping`);
        msg.innerHTML = res && res.ok ? '<span style="color:#059669;font-weight:700">✅ Kết nối Google Sheet thành công!</span>' : '⚠ Phản hồi chưa khớp.';
      } catch (e) {
        msg.innerHTML = '<span style="color:#E11D48">❌ ' + escapeHTML(e.message) + '</span>';
      }
      loadReport();
    };
  }

  if ($('btnCopyGsCode')) {
    $('btnCopyGsCode').onclick = async () => {
      try {
        const r = await fetch('../apps-script/Code.gs', { cache: 'no-store' });
        await navigator.clipboard.writeText(await r.text());
        $('btnCopyGsCode').textContent = '✅ Đã copy mã Code.gs!';
        setTimeout(() => { $('btnCopyGsCode').textContent = '📋 Copy mã Code.gs'; }, 3000);
      } catch (e) {}
    };
  }

  if ($('btnDownloadConfig')) {
    $('btnDownloadConfig').onclick = () => {
      const newCfg = { ...CFG, appsScriptUrl: activeUrl() };
      const blob = new Blob([JSON.stringify(newCfg, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'config.json';
      a.click();
    };
  }

  $('btnLoad').onclick = () => loadReport();
  $('selExam').onchange = () => loadReport();
  if ($('selClass')) $('selClass').onchange = () => applyFilterAndRender();
  if ($('selRankMode')) $('selRankMode').onchange = () => applyFilterAndRender();
  $('btnCsv').onclick = () => {
    if (!RANKED_ROWS.length) return;
    const esc = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const lines = [COLS_CSV.join(',')].concat(RANKED_ROWS.map(r => COLS_CSV.map(c => esc(r[c])).join(',')));
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bang-xep-hang-phongthi247.csv';
    a.click();
  };

  boot();
})();
