/* report.js – Bảng Xếp Hạng Treo Thưởng & Kiểm Soát Kết Quả Thi Tại Nhà (Cloud Realtime + Admin Control) · Kimkenpkl */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const COLS_TABLE = ['Hạng', 'Họ tên', 'Lớp', 'Tên đề', 'Điểm', '%', 'Làm/phút', 'P1', 'P2', 'P3', 'Rời tab', 'Camera', 'Thời điểm nộp'];
  const COLS_CSV = ['Hạng', 'Họ tên', 'Lớp', 'SBD', 'Tên đề', 'Điểm', 'Tối đa', '%', 'Làm/phút', 'Làm/giây', 'P1', 'P2', 'P3', 'Rời tab', 'Camera', 'Thoát FS', 'Thời điểm nộp', 'Nguồn'];
  let CFG = {}, RAW_ROWS = [], RANKED_ROWS = [], CHART = null;
  let adminUnlocked = false;

  function activeUrl() {
    return (($('inpGsUrl') && $('inpGsUrl').value) || PTW.ls.get('ptw_custom_gs_url') || CFG.appsScriptUrl || '').trim();
  }

  async function boot() {
    if ($('btnTheme')) {
      const sync = () => { $('btnTheme').textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙'; };
      sync();
      $('btnTheme').onclick = () => { PTW.theme.toggle(); sync(); };
    }
    try { CFG = await loadJSON('../data/config.json'); } catch (e) {}
    const savedUrl = PTW.ls.get('ptw_custom_gs_url') || CFG.appsScriptUrl || '';
    if ($('inpGsUrl')) $('inpGsUrl').value = savedUrl;
    const savedPass = sessionStorage.getItem('ptwRpPass') || '';
    if ($('inpPass')) $('inpPass').value = savedPass;

    try {
      const idx = await loadJSON('../data/exams.json');
      const exams = (idx.exams || []).filter(x => !x.customUrl && !x.hidden);
      $('selExam').innerHTML = '<option value="">— Tất cả các đề cương —</option>' +
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
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang tải kết quả từ Cloud…'; }

    const examFilter = $('selExam') ? $('selExam').value : '';

    let cloudRows = [];
    try {
      const list = await PTW.cloud.fetchExamOrAll(CFG, examFilter);
      cloudRows = list.map(r => ({ ...r, 'Nguồn': '🌐 Cloud' }));
    } catch (e) {}

    const localSubs = (PTW.ls.get('ptw_local_submissions') || [])
      .filter(r => !examFilter || r.examId === examFilter)
      .map(r => ({ ...r, 'Nguồn': '💻 Máy này' }));

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

    if (btn) { btn.disabled = false; btn.textContent = '🔄 Tải kết quả mới nhất từ Cloud'; }
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
    const maxExit = $('selAntiCheat') ? $('selAntiCheat').value : 'all';

    const filtered = RAW_ROWS.filter(r => {
      const c = String(r.class || r['Lớp'] || '').trim();
      if (clsFilter && c !== clsFilter) return false;
      if (maxExit !== 'all') {
        const ex = +(r.exitTab != null ? r.exitTab : r['Rời tab']) || 0;
        if (ex > +maxExit) return false;
      }
      return true;
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
      <span class="badge">👥 Số học sinh hợp lệ: <b>${n}</b></span>
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
      $('tblWrap').innerHTML = '<p class="hint" style="margin:0">Chưa có bài nộp nào ở bộ lọc hiện tại. Khi học sinh làm bài ở nhà và bấm Nộp bài, kết quả sẽ tự động báo về đây.</p>';
      return;
    }
    const medals = ['🥇 #1', '🥈 #2', '🥉 #3'];
    const cols = adminUnlocked ? COLS_TABLE.concat(['Quản trị']) : COLS_TABLE;
    $('tblWrap').innerHTML = '<div style="overflow-x:auto"><table><thead><tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>' +
      rows.map((r, idx) => '<tr style="' + (idx < 3 ? 'background:var(--card-subtle);font-weight:600' : '') + '">' + cols.map(c => {
        if (c === 'Quản trị') {
          return `<td><button class="btn btn-danger btnDelRow" data-aid="${escapeHTML(r.attemptId)}" data-ex="${escapeHTML(r.examId)}" style="padding:4px 9px;font-size:12px">🗑 Xóa</button></td>`;
        }
        const v = r[c];
        if (c === 'Hạng') return `<td><b>${idx < 3 ? medals[idx] : ('#' + r.rank)}</b></td>`;
        if (v == null) return '<td></td>';
        if (c === 'Điểm') return '<td><b style="color:var(--primary)">' + fmtScore(+v) + '</b><span class="hint">/' + fmtScore(+r.max) + '</span></td>';
        if (c === '%') return '<td>' + (+v).toFixed(1) + '%</td>';
        if (c === 'Rời tab') return `<td><span class="badge" style="${+v > 2 ? 'background:var(--danger-soft);color:var(--danger);border-color:var(--danger-border)' : ''}">×${+v || 0}</span></td>`;
        if (c === 'Camera') return `<td>${r.camVerified ? `<span class="badge" style="background:var(--ok-soft);color:var(--ok);border-color:var(--ok-border)">${escapeHTML(String(v))}</span>` : '<span class="hint">—</span>'}</td>`;
        if (['P1', 'P2', 'P3'].indexOf(c) >= 0) return '<td>' + fmtScore(+v || 0) + '</td>';
        return '<td>' + escapeHTML(String(v)) + '</td>';
      }).join('') + '</tr>').join('') + '</tbody></table></div>';

    if (adminUnlocked) {
      document.querySelectorAll('.btnDelRow').forEach(btn => {
        btn.onclick = async () => {
          const aid = btn.dataset.aid, exId = btn.dataset.ex;
          if (!confirm('Xóa kết quả này khỏi Bảng xếp hạng Cloud & máy?')) return;
          btn.disabled = true; btn.textContent = 'Đang xóa…';
          const localSubs = (PTW.ls.get('ptw_local_submissions') || []).filter(x => x.attemptId !== aid);
          PTW.ls.set('ptw_local_submissions', localSubs);
          await PTW.cloud.deleteAttempt(CFG, exId, aid);
          await loadReport();
        };
      });
    }
  }

  if ($('btnAdminMode')) {
    $('btnAdminMode').onclick = () => {
      adminUnlocked = !adminUnlocked;
      $('btnAdminMode').textContent = adminUnlocked ? '🔓 Đang bật quyền Xóa / Reset' : '🔐 Bật quyền Xóa / Reset của GV';
      if ($('btnResetExamCloud')) $('btnResetExamCloud').style.display = adminUnlocked ? '' : 'none';
      renderTable();
    };
  }

  if ($('btnResetExamCloud')) {
    $('btnResetExamCloud').onclick = async () => {
      const exId = $('selExam').value;
      const label = exId ? `đề "${$('selExam').options[$('selExam').selectedIndex].text}"` : 'TẤT CẢ CÁC ĐỀ';
      if (!confirm(`Xác nhận làm sạch (Reset) toàn bộ Bảng xếp hạng Cloud của ${label} để bắt đầu đợt trao thưởng mới?`)) return;
      $('btnResetExamCloud').disabled = true;
      $('btnResetExamCloud').textContent = '⏳ Đang làm sạch…';
      if (!exId) PTW.ls.del('ptw_local_submissions');
      else {
        const localSubs = (PTW.ls.get('ptw_local_submissions') || []).filter(x => x.examId !== exId);
        PTW.ls.set('ptw_local_submissions', localSubs);
      }
      await PTW.cloud.clearExam(CFG, exId);
      $('btnResetExamCloud').disabled = false;
      $('btnResetExamCloud').textContent = '🧹 Reset Bảng xếp hạng đề đang chọn';
      await loadReport();
    };
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
        msg.innerHTML = res && res.ok ? '<span style="color:var(--ok);font-weight:700">✅ Kết nối Google Sheet thành công!</span>' : '⚠ Phản hồi chưa khớp.';
      } catch (e) {
        msg.innerHTML = '<span style="color:var(--danger)">❌ ' + escapeHTML(e.message) + '</span>';
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
  if ($('selAntiCheat')) $('selAntiCheat').onchange = () => applyFilterAndRender();
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
