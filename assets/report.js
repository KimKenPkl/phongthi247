/* report.js – Báo cáo Sheet và lịch sử cục bộ · Kimkenpkl */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const COLS_TABLE = ['Hạng', 'Họ tên', 'Lớp', 'Tên đề', 'Điểm', '%', 'Làm/phút', 'P1', 'P2', 'P3', 'Rời tab', 'Camera', 'Thời điểm nộp'];
  const COLS_CSV = ['Hạng', 'Họ tên', 'Lớp', 'SBD', 'Tên đề', 'Điểm', 'Tối đa', '%', 'Làm/phút', 'Làm/giây', 'P1', 'P2', 'P3', 'Rời tab', 'Camera', 'Thoát FS', 'Thời điểm nộp', 'Nguồn'];
  let CFG = {}, RAW_ROWS = [], RANKED_ROWS = [], CHART = null, EXAMS = [], PERIOD_ERROR = '';
  let adminUnlocked = false, loadGeneration = 0;
  const csvCell = v => PTW.csvCell(v);
  // Backend cũ (chưa redeploy) trả các mã này thay vì 'unauthorized'/'post_required' của bản mới.
  const BACKEND_STALE_CODES = ['bad_name', 'bad_action', 'bad_request', 'unknown_action'];
  const BACKEND_STALE_MSG = '⚠ Backend Apps Script còn là bản CŨ: chưa có đường đọc báo cáo riêng và chưa có lịch mới của đề 5, nên đề 5 vẫn bị chặn khi nộp bài và họ tên trong bảng còn bị rút gọn. '
    + 'Cách xử lý: bấm “📋 Copy đủ 3 tệp backend”, dán lần lượt vào Code.gs, Submission.gs, ExamRegistry.gs, rồi Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.';
  const PUBLIC_MASK_MSG = 'Đang xem BẢNG CÔNG KHAI: máy chủ đã rút gọn họ tên (dạng “Nguyễn V. A.”). '
    + 'Nhập mã GV ở ô bên dưới rồi bấm “🔄 Tải kết quả mới nhất” để xem họ tên đầy đủ.';
  // Họ tên đầy đủ: bật theo tuỳ chọn GV trên máy này, hoặc sau khi Apps Script xác thực mã đọc trong POST.
  const fullNamesOn = () => PTW.ls.get('ptw_show_full') !== false;
  let SHOW_FULL = fullNamesOn();
  const dispName = n => SHOW_FULL ? String(n || '') : maskName(n);
  const withMask = r => SHOW_FULL ? r : { ...r, 'Họ tên': maskName(r['Họ tên']), 'SBD': '' };

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
    try { sessionStorage.removeItem('ptwRpPass'); } catch (_) {}
    if ($('inpPass')) $('inpPass').value = '';

    try {
      const idx = await loadJSON('../data/exams.json');
      const exams = EXAMS = (idx.exams || []).filter(x => !x.customUrl && !x.hidden);
      $('selExam').innerHTML = '<option value="">— Tất cả các đề cương —</option>' +
        exams.map(x => `<option value="${escapeHTML(x.id)}">${escapeHTML(x.title)}</option>`).join('');
      const urlExam = new URLSearchParams(location.search).get('exam');
      if (urlExam && exams.some(x => x.id === urlExam)) {
        $('selExam').value = urlExam;
      }
    } catch (e) {}

    loadReport();
  }

  async function loadReport() {
    const generation = ++loadGeneration;
    const btn = $('btnLoad');
    const errEl = $('gateErr');
    if (errEl) errEl.textContent = '';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang tải kết quả…'; }

    const examFilter = $('selExam') ? $('selExam').value : '';
    const period = $('selPeriod') ? $('selPeriod').value : 'all';

    let localSubs = (period === 'all' ? PTW.ls.get('ptw_local_submissions') || [] : [])
      .filter(r => !examFilter || r.examId === examFilter)
      .map(r => ({ ...r, 'Nguồn': '💻 Máy này' }));

    let sheetRows = [];
    SHOW_FULL = fullNamesOn();
    const u = activeUrl();
    const pass = ($('inpPass') && $('inpPass').value) || '';
    RAW_ROWS = []; RANKED_ROWS = []; ITEM_ROWS = []; applyFilterAndRender();
    PERIOD_ERROR = '';
    if (u) {
      try {
        // Có mã GV: đọc đầy đủ. Không có mã: chỉ đọc bảng xếp hạng công khai (họ tên, lớp, điểm, thời gian).
        const res = pass
          ? await PTW.sheet.post(u, { action: 'report', pass, exam: examFilter, period })
          : await PTW.sheet.get(`${PTW.sheet.validUrl(u)}?action=top&exam=${encodeURIComponent(examFilter)}&period=${encodeURIComponent(period)}`);
        if (generation !== loadGeneration || activeUrl() !== u || (($('inpPass') && $('inpPass').value) || '') !== pass) return;
        if (!res || !res.ok || !Array.isArray(res.rows)) {
          PERIOD_ERROR = res?.err === 'unauthorized'
            ? 'Mã giáo viên không hợp lệ hoặc chưa được cấu hình trong Apps Script.'
            : BACKEND_STALE_CODES.includes(res?.err) ? BACKEND_STALE_MSG
              : res?.err === 'ranking_private' ? 'Bảng xếp hạng công khai đang tắt. Nhập mã GV để đọc báo cáo riêng.' : `Apps Script không trả dữ liệu hợp lệ${res?.err ? ': ' + res.err : ''}.`;
        } else if (res && Array.isArray(res.rows)) {
          if (period !== 'all' && (!res.period || res.period.type !== period || res.period.source !== 'server-received-at')) {
            PERIOD_ERROR = 'Apps Script chưa xác nhận lọc theo thời điểm máy chủ nhận bài. Hãy cập nhật và triển khai lại apps-script/Code.gs; không dùng dữ liệu cũ để xếp hạng theo kỳ.';
          } else {
            sheetRows = res.rows.map(r => ({ ...r, 'Nguồn': '☁️ Sheet' }));
            if (pass && res.ok) SHOW_FULL = true;
            // Private reports contain only server-authorized rows; do not mix local data.
            if (pass) localSubs = [];
          }
        }
      } catch (err) { PERIOD_ERROR = 'Không đọc được xác nhận từ Apps Script: ' + err.message; }
    } else if (period !== 'all') PERIOD_ERROR = 'Xếp hạng tuần/tháng cần kết nối Apps Script đã triển khai phiên bản hỗ trợ thời điểm máy chủ nhận bài.';

    if (generation !== loadGeneration || activeUrl() !== u || (($('inpPass') && $('inpPass').value) || '') !== pass) return;
    RAW_ROWS = sheetRows.concat(pass ? [] : localSubs);
    populateClassFilter();
    applyFilterAndRender();
    if (PERIOD_ERROR && errEl) errEl.textContent = PERIOD_ERROR;

    if ($('cloudLiveBadge')) $('cloudLiveBadge').textContent = sheetRows.length ? 'Google Sheet · đã nhận phản hồi' : 'Máy này / chưa có dữ liệu Sheet';
    if ($('modeHint')) {
      $('modeHint').textContent = !sheetRows.length
        ? ''
        : pass ? '✅ Đang xem báo cáo riêng (mã GV): họ tên đầy đủ, đúng dữ liệu máy chủ đã nhận.'
          : PUBLIC_MASK_MSG;
    }
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Tải kết quả mới nhất'; }
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
    const period = $('selPeriod')?.value || 'all';
    const periodStatus = $('periodStatus');
    if (periodStatus) periodStatus.textContent = period === 'all'
      ? ''
      : `Kỳ ${period === 'week' ? 'tuần' : 'tháng'} theo múi giờ Asia/Ho_Chi_Minh, thời điểm Apps Script nhận bài. Lượt cũ chưa có dấu nhận máy chủ không được tính.`;
    renderPodium();
    renderStats();
    renderTable();
    renderItems();
    renderRoster();
  }

  /* ---------- Thống kê từng câu ---------- */
  const TESTS = {};
  async function getTest(id) {
    if (!(id in TESTS)) { try { TESTS[id] = await loadJSON('../data/tests/' + encodeURIComponent(id) + '.json'); } catch (e) { TESTS[id] = null; } }
    return TESTS[id];
  }
  function parseJ(v) { if (!v) return null; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch (e) { return null; } }
  const plain = s => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  let ITEM_ROWS = [];

  async function renderItems() {
    const generation = loadGeneration;
    const wrap = $('itemWrap'); if (!wrap) return;
    const exId = $('selExam').value;
    ITEM_ROWS = [];
    if (!exId) { wrap.innerHTML = 'Chọn một đề ở mục 1 để xem tỉ lệ đúng từng câu.'; return; }
    const T = await getTest(exId);
    if (generation !== loadGeneration || exId !== $('selExam').value) return;
    if (!T || !Array.isArray(T.questions)) { wrap.innerHTML = 'Không tải được file đề để thống kê.'; return; }
    const qs = T.questions;
    const st = qs.map(q => ({ n: 0, got: 0, max: 0, full: 0, blank: 0, opt: [0, 0, 0, 0], sOk: (q.statements || []).map(() => 0) }));
    let used = 0;
    RANKED_ROWS.forEach(r => {
      const ans = parseJ(r.answers || r['Đáp án (JSON)']);
      const det = parseJ(r.detail || r['Chi tiết điểm câu (JSON)']);
      const hasQ = det && Object.keys(det).some(k => /^Q\d+$/.test(k));
      if (!ans && !hasQ) return;   // bài cũ hoặc bảng công khai: không có chi tiết từng câu
      used++;
      qs.forEach((q, i) => {
        if (hasQ && !(('Q' + (i + 1)) in det)) return;   // câu không có trong lượt này (Rút 20 câu…)
        const s = st[i];
        if (ans) {
          const a = ans[i] === undefined ? null : ans[i];
          const g = gradeQuestion(T, q, a);
          s.n++; s.got += g.got; s.max += g.max;
          if (g.correct) s.full++;
          if (!g.answered) s.blank++;
          if (q.part === 1 && a != null && a >= 0 && a < 4) s.opt[a]++;
          if (q.part === 2 && Array.isArray(a)) (q.statements || []).forEach((x, j) => { if (a[j] === x.answer) s.sOk[j]++; });
        } else {
          const g0 = gradeQuestion(T, q, null);
          const got = +det['Q' + (i + 1)] || 0;
          s.n++; s.got += got; s.max += g0.max;
          if (g0.max && got >= g0.max - 1e-9) s.full++;
        }
      });
    });
    if (!used) {
      wrap.innerHTML = 'Chưa có bài nộp nào kèm chi tiết từng câu. Bài trên Google Sheet cần nhập <b>mã GV</b> mới đọc được chi tiết; bài nộp trước bản cập nhật này không có dữ liệu theo câu.';
      return;
    }
    const L = ['A', 'B', 'C', 'D'];
    ITEM_ROWS = qs.map((q, i) => {
      const s = st[i];
      const pct = s.max ? s.got / s.max * 100 : 0;
      let dist = '';
      if (q.part === 1) dist = L.map((l, k) => (k === q.answerIndex ? `[${l}] ` : l + ' ') + s.opt[k]).join(' · ');
      else if (q.part === 2) dist = (q.statements || []).map((x, j) => 'abcd'[j] + ' ' + (s.n ? Math.round(s.sOk[j] / s.n * 100) : 0) + '%').join(' · ');
      else dist = 'Đáp án ' + q.answer;
      return { no: i + 1, part: q.part, text: plain(q.content).slice(0, 90), n: s.n, pct, full: s.n ? s.full / s.n * 100 : 0, blank: s.blank, dist };
    }).filter(x => x.n);
    const rows = ITEM_ROWS.slice();
    if ($('selItemSort') && $('selItemSort').value === 'hard') rows.sort((a, b) => a.pct - b.pct);
    const color = p => p < 40 ? 'var(--danger)' : p >= 85 ? 'var(--ok)' : 'var(--ink)';
    const hard = ITEM_ROWS.filter(x => x.pct < 40).length;
    wrap.innerHTML = `<div class="hint" style="margin-bottom:6px">Tính trên <b>${used}</b> bài (theo bộ lọc ở trên). ${hard ? `<b style="color:var(--danger)">${hard} câu</b> dưới 40% điểm, nên chữa lại.` : ''} Phần I: [đáp án đúng] và số HS chọn mỗi phương án. Phần II: % HS chọn đúng từng ý.</div>
      <div style="overflow-x:auto"><table><thead><tr><th>Câu</th><th>Phần</th><th>Nội dung</th><th>Số bài</th><th>% điểm</th><th>% đúng hẳn</th><th>Bỏ trống</th><th>Phân bố</th></tr></thead><tbody>` +
      rows.map(x => `<tr><td><b>${x.no}</b></td><td>${x.part}</td><td style="max-width:340px">${escapeHTML(x.text)}</td><td>${x.n}</td>
        <td><b style="color:${color(x.pct)}">${x.pct.toFixed(0)}%</b></td><td>${x.full.toFixed(0)}%</td><td>${x.blank}</td><td style="white-space:nowrap">${escapeHTML(x.dist)}</td></tr>`).join('') +
      '</tbody></table></div>';
  }

  /* ---------- Danh sách lớp · ai chưa nộp ---------- */
  const norm = s => String(s || '').normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
  function parseRoster(txt) {
    return String(txt || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
      let c = l.split(/\t|;|,/).map(s => s.trim()).filter(s => s !== '');
      if (c.length >= 3 && /^\d+$/.test(c[0])) c = c.slice(1);   // cột STT
      if (c.length) c[0] = c[0].replace(/^\d+[.)]\s*/, '');
      return { name: c[0] || '', class: c[1] || '' };
    }).filter(x => (x.name.match(/\p{L}/gu) || []).length >= 2 && !/^họ (và )?tên$/i.test(x.name));
  }
  function renderRoster() {
    const out = $('rosterOut'); if (!out || !$('rosterText')) return;
    const exId = $('selExam').value, cls = $('selClass') ? $('selClass').value : '';
    const key = (n, c) => norm(n) + '|' + norm(c);
    const subs = RAW_ROWS.filter(r => (!exId || r.examId === exId) && !r.review)
      .map(r => ({ name: r.name || r['Họ tên'] || '', class: r.class || r['Lớp'] || '' }))
      .filter(r => !cls || norm(r.class) === norm(cls));
    const roster = parseRoster($('rosterText').value);
    if (!roster.length) {
      // Fallback: chưa có danh sách lớp → tự trích "ai đã nộp" từ kết quả,
      // để GV vẫn theo dõi được dù nút ☁️ Lấy từ tab DanhSach chưa trả về.
      const uniq = new Map();
      subs.forEach(r => {
        const k = key(r.name, r.class);
        const e = uniq.get(k);
        if (e) e.n++; else uniq.set(k, { name: r.name, class: r.class, n: 1 });
      });
      const fList = [...uniq.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'vi'));
      if (!fList.length) {
        out.innerHTML = '<p class="hint">Chưa có danh sách lớp và cũng chưa có bài nộp nào. Hãy dán danh sách lớp (mỗi dòng <code>Họ tên, Lớp</code>) hoặc bấm ☁️ Lấy từ tab DanhSach để theo dõi ai đã/chưa nộp.</p>';
        return;
      }
      out.innerHTML = `<div class="banner banner-warn" style="margin-bottom:8px">📋 <b>Chưa có danh sách lớp</b> — đây là các học sinh <b>đã nộp</b> (tự trích từ kết quả). Dán danh sách lớp hoặc bấm ☁️ Lấy từ tab DanhSach để biết <b>ai chưa nộp</b>.</div>
        <div class="row" style="gap:8px;flex-wrap:wrap"><span class="badge">✅ Đã nộp: <b>${fList.length}</b> học sinh</span></div>
        <ol style="columns:2;margin:8px 0">${fList.map(x => `<li>${escapeHTML(dispName(x.name))}${x.class ? ' <span class="hint">(' + escapeHTML(x.class) + ')</span>' : ''}${x.n > 1 ? ' <span class="hint">(nộp ' + x.n + ' lần)</span>' : ''}</li>`).join('')}</ol>`;
      return;
    }
    const list = cls ? roster.filter(x => !x.class || norm(x.class) === norm(cls)) : roster;
    const done = new Set(), doneName = new Set();
    subs.forEach(r => { done.add(key(r.name, r.class)); doneName.add(norm(r.name)); });
    const missing = list.filter(x => !(x.class ? done.has(key(x.name, x.class)) : doneName.has(norm(x.name))));
    const rk = new Set(roster.map(x => x.class ? key(x.name, x.class) : norm(x.name)));
    const seen = new Set();
    const strangers = subs.filter(r => !rk.has(key(r.name, r.class)) && !rk.has(norm(r.name)))
      .filter(r => { const k = key(r.name, r.class); if (seen.has(k)) return false; seen.add(k); return true; });
    // Tên trong danh sách lớp do GV tự dán nên hiện đủ; tên lạ lấy từ bài nộp thì che nếu chưa xác thực.
    const fmt = (x, fromSub) => escapeHTML(fromSub ? dispName(x.name) : x.name) + (x.class ? ' <span class="hint">(' + escapeHTML(x.class) + ')</span>' : '');
    out.innerHTML = `${exId ? '' : '<div class="banner banner-warn" style="margin-bottom:8px">Đang tính trên tất cả các đề. Chọn một đề ở mục 1 để biết chính xác ai chưa nộp đề đó.</div>'}
      <div class="row" style="gap:8px;flex-wrap:wrap"><span class="badge">✅ Đã nộp: <b>${list.length - missing.length}/${list.length}</b></span>
      <span class="badge" style="background:var(--danger-soft);color:var(--danger);border-color:var(--danger-border)">⏳ Chưa nộp: <b>${missing.length}</b></span>
      ${missing.length ? '<button class="btn" id="btnCopyMissing" style="padding:4px 10px;font-size:12px">📋 Copy danh sách chưa nộp</button>' : ''}</div>
      ${missing.length ? `<ol style="columns:2;margin:8px 0">${missing.map(x => `<li>${fmt(x)}</li>`).join('')}</ol>` : '<p>🎉 Cả lớp đã nộp.</p>'}
      ${strangers.length ? `<div class="hint"><b>Có bài nộp nhưng không khớp danh sách</b> (thường do gõ sai tên/lớp): ${strangers.map(x => fmt(x, true)).join('; ')}</div>` : ''}`;
    if ($('btnCopyMissing')) $('btnCopyMissing').onclick = () => {
      const t = missing.map((x, i) => `${i + 1}. ${x.name}${x.class ? ' - ' + x.class : ''}`).join('\n');
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => { $('btnCopyMissing').textContent = '✓ Đã copy'; });
    };
  }

  /* ---------- Giao bài: link + QR ---------- */
  function shareModal(html) {
    const root = $('modalRoot');
    root.innerHTML = `<div class="modal-backdrop"><div class="modal" style="max-width:520px">${html}
      <div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn" id="mClose">Đóng</button></div></div></div>`;
    $('mClose').onclick = () => { root.innerHTML = ''; };
  }
  function openShare() {
    const exId = $('selExam').value;
    if (!exId) { alert('Chọn đề ở mục 1 trước khi giao bài.'); return; }
    const x = EXAMS.find(e => e.id === exId) || { id: exId, title: exId };
    const url = new URL('../thi.html?exam=' + encodeURIComponent(exId), location.href).href;
    const S = examSchedule(x);
    let svg = '', gif = '';
    try {
      const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
      svg = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
      gif = qr.createDataURL(8, 16);
    } catch (e) {}
    const msg = ['📝 ' + x.title, 'Link làm bài: ' + url, x.code ? 'Mã phòng: ' + x.code : '',
      S.open ? 'Mở đề: ' + fmtVNTime(S.open) : '', S.close ? 'Hạn nộp: ' + fmtVNTime(S.close) : '',
      S.maxAttempts ? 'Số lượt nộp: ' + S.maxAttempts : '', 'Các em ghi đúng Họ tên và Lớp như danh sách lớp.'].filter(Boolean).join('\n');
    shareModal(`<h3 style="margin-top:0">📤 Giao bài: ${escapeHTML(x.title)}</h3>
      <div style="width:220px;margin:0 auto">${svg || '<p class="hint">Không tạo được mã QR.</p>'}</div>
      <div class="field"><label>Link làm bài</label><input type="text" id="shareUrl" readonly value="${escapeHTML(url)}"></div>
      <div class="field"><label>Tin nhắn gửi nhóm Zalo</label><textarea id="shareMsg" rows="6" style="width:100%">${escapeHTML(msg)}</textarea></div>
      <div class="row" style="gap:6px;flex-wrap:wrap">
        <button class="btn btn-primary" id="btnCopyUrl">📋 Copy link</button>
        <button class="btn" id="btnCopyMsg">📋 Copy tin nhắn</button>
        ${gif ? `<a class="btn" download="qr-${escapeHTML(exId)}.gif" href="${gif}">⬇ Tải ảnh QR</a>` : ''}
      </div>`);
    const copy = (id, btn) => { const v = $(id).value; if (navigator.clipboard) navigator.clipboard.writeText(v).then(() => { $(btn).textContent = '✓ Đã copy'; }); else { $(id).select(); document.execCommand('copy'); } };
    $('btnCopyUrl').onclick = () => copy('shareUrl', 'btnCopyUrl');
    $('btnCopyMsg').onclick = () => copy('shareMsg', 'btnCopyMsg');
  }

  if ($('rosterText')) {
    $('rosterText').value = PTW.ls.get('ptw_roster') || '';
    $('rosterText').oninput = () => { PTW.ls.set('ptw_roster', $('rosterText').value); renderRoster(); };
  }
  if ($('btnShare')) $('btnShare').onclick = openShare;
  if ($('selItemSort')) $('selItemSort').onchange = () => renderItems();
  if ($('btnItemCsv')) $('btnItemCsv').onclick = () => {
    if (!ITEM_ROWS.length) { alert('Chưa có dữ liệu thống kê câu cho đề đang chọn.'); return; }
    const head = ['Câu', 'Phần', 'Nội dung', 'Số bài', '% điểm', '% đúng hẳn', 'Bỏ trống', 'Phân bố'];
    const q = csvCell;
    const csv = '\ufeff' + [head.map(q).join(',')].concat(ITEM_ROWS.map(x => [x.no, x.part, x.text, x.n, x.pct.toFixed(1), x.full.toFixed(1), x.blank, x.dist].map(q).join(','))).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'thong-ke-cau-' + ($('selExam').value || 'de') + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
  };
  if ($('btnRosterSheet')) $('btnRosterSheet').onclick = async () => {
    const generation = loadGeneration;
    const u = activeUrl();
    const pass = ($('inpPass') && $('inpPass').value) || '';
    if (!u || !pass) { alert('Cần gắn Google Sheet (nút ⚙ ở trên) và nhập mã GV trước.'); return; }
    try {
      const res = await PTW.sheet.post(u, { action: 'roster', pass });
      if (generation !== loadGeneration || activeUrl() !== u || $('inpPass').value !== pass) return;
      if (!res || !res.ok) { alert(res && res.msg ? res.msg : 'Không đọc được tab DanhSach (' + ((res && res.err) || 'lỗi') + ').'); return; }
      $('rosterText').value = res.rows.map(r => r.name + (r.class ? ', ' + r.class : '')).join('\n');
      renderRoster();
    } catch (e) { if (generation === loadGeneration) alert('Không kết nối được Google Sheet.'); }
  };

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
        <div class="podium-name">${escapeHTML(dispName(r['Họ tên']))} <span class="badge">${escapeHTML(r['Lớp'])}</span></div>
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
          if (r['Nguồn'] !== '💻 Máy này') return '<td>Quản lý tại Google Sheet</td>';
          const ex = +(r.exitTab != null ? r.exitTab : r['Rời tab']) || 0;
          return `<td style="white-space:nowrap"><button class="btn btn-danger btnDelRow" data-aid="${escapeHTML(r.attemptId)}" data-ex="${escapeHTML(r.examId)}" style="padding:4px 9px;font-size:12px">🗑 Xóa trên máy</button>` +
            (ex > 0 ? `<button class="btn btnUnflagRow" data-aid="${escapeHTML(r.attemptId)}" style="padding:4px 9px;font-size:12px;margin-left:4px" title="Giảm số lần rời tab đã ghi nhận của bài này trên máy">🙅 Gỡ 1 vi phạm (×${ex})</button>` : '') + '</td>';
        }
        const v = r[c];
        if (c === 'Hạng') return `<td><b>${idx < 3 ? medals[idx] : ('#' + r.rank)}</b></td>`;
        if (v == null) return '<td></td>';
        if (c === 'Điểm') return '<td><b style="color:var(--primary)">' + fmtScore(+v) + '</b><span class="hint">/' + fmtScore(+r.max) + '</span></td>';
        if (c === '%') return '<td>' + (+v).toFixed(1) + '%</td>';
        if (c === 'Họ tên') return '<td>' + escapeHTML(dispName(v)) + '</td>';
        if (c === 'Rời tab') return `<td><span class="badge" style="${+v > 2 ? 'background:var(--danger-soft);color:var(--danger);border-color:var(--danger-border)' : ''}">×${+v || 0}</span></td>`;
        if (c === 'Camera') return `<td>${r.camVerified ? `<span class="badge" style="background:var(--ok-soft);color:var(--ok);border-color:var(--ok-border)">${escapeHTML(String(v))}</span>` : '<span class="hint">—</span>'}</td>`;
        if (['P1', 'P2', 'P3'].indexOf(c) >= 0) return '<td>' + fmtScore(+v || 0) + '</td>';
        return '<td>' + escapeHTML(String(v)) + '</td>';
      }).join('') + '</tr>').join('') + '</tbody></table></div>';

    if (adminUnlocked) {
      document.querySelectorAll('.btnDelRow').forEach(btn => {
        btn.onclick = async () => {
          const aid = btn.dataset.aid, exId = btn.dataset.ex;
          if (!confirm('Xóa bản lịch sử trên máy này? Bài chờ gửi và Google Sheet được giữ nguyên.')) return;
          btn.disabled = true; btn.textContent = 'Đang xóa…';
          const localSubs = (PTW.ls.get('ptw_local_submissions') || []).filter(x => x.attemptId !== aid);
          PTW.ls.set('ptw_local_submissions', localSubs);
          await loadReport();
        };
      });
      document.querySelectorAll('.btnUnflagRow').forEach(btn => {
        btn.onclick = async () => {
          const aid = btn.dataset.aid;
          if (!confirm('Gỡ 1 lần rời tab đã ghi nhận của bài này trên máy?\n\nChỉ sửa bản lịch sử trên thiết bị này; Google Sheet không đổi.')) return;
          const localSubs = PTW.ls.get('ptw_local_submissions') || [];
          const row = localSubs.find(x => x.attemptId === aid);
          if (!row) return;
          const cur = +(row.exitTab != null ? row.exitTab : row['Rời tab']) || 0;
          if (cur <= 0) return;
          const next = cur - 1;
          if (row.exitTab != null) row.exitTab = next;
          row['Rời tab'] = next;
          PTW.ls.set('ptw_local_submissions', localSubs);
          await loadReport();
        };
      });
    }
  }

  if ($('btnAdminMode')) {
    $('btnAdminMode').onclick = () => {
      adminUnlocked = !adminUnlocked;
      $('btnAdminMode').textContent = adminUnlocked ? 'Đang sửa lịch sử máy này' : 'Sửa lịch sử máy này';
      if ($('btnResetExamCloud')) $('btnResetExamCloud').style.display = adminUnlocked ? '' : 'none';
      renderTable();
    };
  }

  if ($('btnResetExamCloud')) {
    $('btnResetExamCloud').onclick = async () => {
      const exId = $('selExam').value;
      const label = exId ? `đề "${$('selExam').options[$('selExam').selectedIndex].text}"` : 'TẤT CẢ CÁC ĐỀ';
      if (!confirm(`Xóa lịch sử trên máy này của ${label}? Bài chờ gửi và Google Sheet được giữ nguyên.`)) return;
      $('btnResetExamCloud').disabled = true;
      $('btnResetExamCloud').textContent = '⏳ Đang làm sạch…';
      if (!exId) PTW.ls.del('ptw_local_submissions');
      else {
        const localSubs = (PTW.ls.get('ptw_local_submissions') || []).filter(x => x.examId !== exId);
        PTW.ls.set('ptw_local_submissions', localSubs);
      }
      $('btnResetExamCloud').disabled = false;
      $('btnResetExamCloud').textContent = '🧹 Xóa lịch sử máy này theo đề';
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
      const msg = $('gsPingMsg');
      try { if (u) PTW.sheet.validUrl(u); } catch (e) { msg.textContent = e.message; return; }
      PTW.ls.set('ptw_custom_gs_url', u);
      if (!u) {
        msg.textContent = 'Dùng cấu hình Apps Script của website; chưa có URL thì chỉ đọc lịch sử máy này.';
        loadReport();
        return;
      }
      msg.textContent = '⏳ Đang kiểm tra kết nối…';
      try {
        const res = await PTW.sheet.get(`${u}?action=ping`);
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
        const sources = await Promise.all(['Code.gs', 'Submission.gs', 'ExamRegistry.gs'].map(async name => {
          const r = await fetch('../apps-script/' + name, { cache: 'no-store' });
          if (!r.ok) throw new Error('Không tải được ' + name);
          return await r.text();
        }));
        await navigator.clipboard.writeText(sources.join('\n\n'));
        $('btnCopyGsCode').textContent = '✅ Đã copy đầy đủ 3 tệp backend';
        setTimeout(() => { $('btnCopyGsCode').textContent = '📋 Copy đủ 3 tệp backend'; }, 3000);
      } catch (e) { alert('Không copy được mã backend: ' + e.message); }
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
  if ($('selPeriod')) $('selPeriod').onchange = () => loadReport();
  if ($('selClass')) $('selClass').onchange = () => applyFilterAndRender();
  if ($('selRankMode')) $('selRankMode').onchange = () => applyFilterAndRender();
  if ($('selAntiCheat')) $('selAntiCheat').onchange = () => applyFilterAndRender();
  const chkFullName = $('chkFullName');
  if (chkFullName) {
    chkFullName.checked = fullNamesOn();
    chkFullName.onchange = () => {
      SHOW_FULL = chkFullName.checked;
      PTW.ls.set('ptw_show_full', chkFullName.checked);
      applyFilterAndRender();
    };
  }
  $('btnCsv').onclick = () => {
    if (!RANKED_ROWS.length) return;
    const esc = csvCell;
    const lines = [COLS_CSV.join(',')].concat(RANKED_ROWS.map(withMask).map(r => COLS_CSV.map(c => esc(r[c])).join(',')));
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bang-xep-hang-phongthi247.csv';
    a.click();
  };

  for (const id of ['inpPass', 'inpGsUrl']) if ($(id)) $(id).addEventListener('input', () => {
    ++loadGeneration; SHOW_FULL = fullNamesOn(); RAW_ROWS = []; RANKED_ROWS = []; ITEM_ROWS = [];
    applyFilterAndRender();
    $('btnLoad').disabled = false; $('btnLoad').textContent = '🔄 Tải kết quả mới nhất';
  });
  boot();
})();
