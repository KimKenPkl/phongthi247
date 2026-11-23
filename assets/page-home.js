/* Tach tu index.html de bat CSP script-src 'self'. */
(async () => {
  const btnTheme = document.getElementById('btnTheme');
  function syncThemeLabel() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btnTheme.textContent = isDark ? 'THEME: MONOCHROM DARK' : 'THEME: BARYTA LIGHT';
  }
  syncThemeLabel();
  btnTheme.onclick = () => { PTW.theme.toggle(); syncThemeLabel(); };

  let exams = [];
  try { exams = (await loadJSON('data/exams.json')).exams || []; } catch (e) {
    document.getElementById('examList').innerHTML = '<div class="card">Không tải được danh sách đề (data/exams.json).</div>'; return;
  }
  const list = document.getElementById('examList');
  const inpSearch = document.getElementById('inpSearchExam');
  const showHidden = new URLSearchParams(location.search).get('all') === '1';
  let curCat = 'all';
  document.getElementById('scheduleNotices').innerHTML = exams
    .filter(x => !x.hidden && typeof x.announcement === 'string' && x.announcement)
    .map(x => `<article class="banner banner-info" style="margin-bottom:20px">
      <h2 style="font-size:18px;margin:0 0 8px">📢 ${escapeHTML(x.title)}</h2>
      <p style="margin:0 0 10px">${escapeHTML(x.announcement)}</p>
      <a class="btn btn-primary" href="thi.html?exam=${encodeURIComponent(x.id)}">Xem lịch / vào phòng thi</a>
      <span class="badge">Mã phòng: ${escapeHTML(x.code || '')}</span>
    </article>`).join('');

  // Ẩn nút "Làm thử đề 10 câu" nếu đề dùng thử đang bị ẩn khỏi thư viện.
  const demoMeta = exams.find(x => x.id === 'dung-thu');
  if (!demoMeta || demoMeta.hidden) {
    const demoBtn = document.querySelector('#heroCta a.btn-primary');
    if (demoBtn) demoBtn.remove();
  }

  /* Phân loại chính xác môn học dựa trên ID và Tiêu đề chính (Title) của đề,
   * tuyệt đối KHÔNG quét nhầm chữ "nhiệt hóa hơi" của Vật lí hay "mã hóa" của Sinh/Tin!
   */
  /* Môn học lấy từ trường "category" trong data/exams.json.
   * Giá trị hợp lệ: toan, tieng-anh, hoa, ly, sinh, tin, su, gdqp, van.
   * Đề cũ chưa có "category" thì đoán theo id/tiêu đề như trước. */
  const CAT_LABEL = { toan: 'TOÁN', 'tieng-anh': 'TIẾNG ANH', hoa: 'HÓA HỌC', ly: 'VẬT LÍ', sinh: 'SINH HỌC', tin: 'TIN HỌC', su: 'LỊCH SỬ', gdqp: 'GDQP & AN', van: 'NGỮ VĂN' };
  const LEGACY_TO_KEY = { 'VẬT LÍ 12': 'ly', 'SINH HỌC 12': 'sinh', 'TIN HỌC 12': 'tin', 'LỊCH SỬ 12': 'su', 'GDQP & AN 12': 'gdqp', 'NGỮ VĂN 12': 'van', 'TOÁN 12': 'toan', 'TIẾNG ANH 12': 'tieng-anh', 'HÓA HỌC 12': 'hoa' };
  function getCatKey(x) {
    if (x.category && CAT_LABEL[x.category]) return x.category;
    return LEGACY_TO_KEY[guessSubjectCategory(x)] || 'khac';
  }
  function getSubjectCategory(x) { return CAT_LABEL[getCatKey(x)] || 'KHÁC'; }

  function guessSubjectCategory(x) {
    const id = String(x.id || '').toLowerCase();
    const title = String(x.title || '').toLowerCase();
    if (id.includes('ly12') || title.includes('vật lí') || title.includes('vật lý')) return 'VẬT LÍ 12';
    if (id.includes('sinh') || title.includes('sinh học')) return 'SINH HỌC 12';
    if (id.includes('tin') || title.includes('tin học')) return 'TIN HỌC 12';
    if (id.includes('su12') || title.includes('lịch sử')) return 'LỊCH SỬ 12';
    if (id.includes('gdqp') || title.includes('gdqp')) return 'GDQP & AN 12';
    if (id.includes('van') || title.includes('ngữ văn')) return 'NGỮ VĂN 12';
    if (id.includes('toan') || title.includes('toán')) return 'TOÁN 12';
    if (id.includes('ta12') || id.includes('tieng-anh') || title.includes('tiếng anh')) return 'TIẾNG ANH 12';
    if (id.includes('hoa') || id === 'de-cuong-gk1-2627' || title.includes('hóa học')) return 'HÓA HỌC 12';
    return 'KHỐI 12';
  }

  function renderCards() {
    const visibleAll = exams.filter(x => !x.hidden || showHidden);
    if (!visibleAll.length) {
      const chips = document.getElementById('subjectChips');
      if (chips) chips.style.display = 'none';
      list.innerHTML = '<div class="card"><h3 style="margin-top:0">Thư viện đề đang tạm ẩn</h3><p class="hint" style="margin-bottom:0">Thầy đang chuẩn bị lại danh sách đề. Vui lòng quay lại sau.</p></div>';
      return;
    }
    const q = (inpSearch.value || '').trim().toLowerCase();
    const filtered = visibleAll.filter(x => {
      const matchCat = curCat === 'all' || getCatKey(x) === curCat;
      const hay = ((x.title || '') + ' ' + (x.subject || '') + ' ' + (x.code || '')).toLowerCase();
      const matchQ = !q || hay.includes(q);
      return matchCat && matchQ;
    });
    if (!filtered.length) {
      list.innerHTML = '<div class="card">Không tìm thấy học phần phù hợp.</div>';
      return;
    }
    list.innerHTML = filtered.map((x, idx) => {
      const cat = getSubjectCategory(x);
      const frameNo = String(idx + 1).padStart(2, '0');
      const countText = x.countLabel ? x.countLabel : `${x.count} CÂU`;
      const codeBadge = (x.demo ? '<span class="badge" style="background:var(--ok-soft);color:var(--ok)">🧪 DÙNG THỬ · KHÔNG LƯU ĐIỂM</span> ' : '') + (x.code ? `<span class="badge">MÃ: ${escapeHTML(x.code)}</span>` : '');
      const S = examSchedule(x);
      const filesAvailable = !x.strictSchedule || S.state === 'open';
      const hsBtn = filesAvailable && x.docHsUrl ? `<a class="btn btn-ghost" href="${escapeHTML(x.docHsUrl)}" download style="padding:6px 10px;font-size:11.5px">FILE ĐỀ</a>` : '';
      const pdfBtn = filesAvailable && x.pdfHsUrl ? `<a class="btn btn-ghost" href="${escapeHTML(x.pdfHsUrl)}" download aria-label="Bản in PDF ${escapeHTML(x.code || x.title)}" style="padding:6px 10px;font-size:11.5px;min-height:24px">Bản in PDF</a>` : '';
      const best = PTW.ls.get('ptw_best_' + x.id);
      const draft = PTW.ls.get('ptw_draft_' + x.id);
      const st = window.PTWProgress ? PTWProgress.examStats(x.id, x.count) : null;
      const bestPct = (best && best.max) ? Math.min(100, Math.round((best.score / best.max) * 100)) : 0;
      const pct = (st && st.seen) ? st.coverage : bestPct;
      const statusText = (st && st.seen)
        ? `ĐÃ LUYỆN ${st.seen}/${x.count} CÂU · NẮM ${st.accuracy}%${best ? ` · KỶ LỤC ${fmtScore(best.score)}/${fmtScore(best.max)}` : ''}`
        : best
          ? `KỶ LỤC: ${fmtScore(best.score)}/${fmtScore(best.max)} Đ (${bestPct}% · ${best.runs || 1} LƯỢT)`
          : (draft && draft.attempt && (!x.contentVersion || draft.contentVersion === x.contentVersion) ? 'ĐANG LÀM DỞ' : 'CHƯA LUYỆN');

      const delayMs = Math.min(idx * 55, 330);
      if (x.customUrl) {
        return `
        <div class="card exam-card" style="animation-delay:${delayMs}ms">
          <div>
            <div class="exam-card-top">
              <span class="subj-code">${frameNo} // ${cat}</span>
              <span class="badge">${escapeHTML(countText)}</span>
            </div>
            <h3>${escapeHTML(x.title)}</h3>
            <div class="hint" style="margin:6px 0 14px">${escapeHTML(x.desc || '')}</div>
          </div>
          <div class="row" style="gap:8px;margin-top:auto">
            <a class="btn btn-primary" href="${x.customUrl}">Mở Đề Cương Tự Luyện →</a>
          </div>
        </div>`;
      }

      const schedBadge = S.state === 'before' ? `<span class="badge" style="background:var(--warn-soft,#fff4d6)">⏳ MỞ ${escapeHTML(fmtVNTime(S.open))}</span>`
        : S.state === 'open' ? `<span class="badge" style="background:var(--ok-soft);color:var(--ok)">🟢 ĐANG MỞ${S.close ? ' · ĐÓNG ' + escapeHTML(fmtVNTime(S.close)) : ''}</span>`
        : S.state === 'closed' ? '<span class="badge">🔒 ĐÃ ĐÓNG</span>' : '';
      const href = m => `thi.html?exam=${encodeURIComponent(x.id)}&mode=${m}`;
      const actBtns = x.strictSchedule && S.state === 'closed'
        ? `<a class="btn btn-ghost" href="${href('exam')}">Đã đóng · Xem lịch</a>`
        : x.demo
        ? `<a class="btn btn-primary" href="${href('exam')}">Làm thử ngay (${x.durationMin || 15} phút)</a>
          <a class="btn" href="${href('practice')}">Luyện từng câu</a>`
        : S.assigned && S.state !== 'closed'
        ? `<a class="btn btn-primary" href="${href('exam')}">${S.state === 'before' ? 'Xem lịch' : 'Làm bài'}${S.maxAttempts ? ` (${S.maxAttempts} lượt)` : ''}</a>`
        : `<a class="btn btn-primary" href="${href('practice')}">Luyện đề</a>
          <a class="btn" href="${href('exam')}">Thi thử</a>
          <a class="btn" href="${href('quick20')}">Rút 20 câu</a>
          <a class="btn btn-ghost" href="tronde.html?exam=${encodeURIComponent(x.id)}">Trộn đề</a>`;

      return `
      <div class="card exam-card" style="animation-delay:${delayMs}ms">
        <div>
          <div class="exam-card-top">
            <span class="subj-code">${frameNo} // ${cat}</span>
            <div class="meta">
              <span class="badge">${escapeHTML(countText)}</span>
              <span class="badge">${x.durationMin} PHÚT</span>
              ${codeBadge}${schedBadge}
            </div>
          </div>
          <h3>${escapeHTML(x.title)}</h3>
          <div class="hint" style="margin:4px 0 10px">${escapeHTML(x.desc || '')}</div>
          <div class="mastery-wrap">
            <div class="mastery-head">
              <span>TIẾN ĐỘ</span>
              <span style="color:${best ? 'var(--ink)' : 'var(--muted)'}">${escapeHTML(statusText)}</span>
            </div>
            <div class="mastery-bar"><div class="mastery-fill" style="width:${pct}%"></div></div>
          </div>
          ${(st && st.seen && !S.assigned) ? `<div class="row" style="gap:6px;margin-top:8px">
            <a class="btn btn-ghost" style="padding:4px 9px;font-size:11.5px" href="${href('smart')}">🧠 Luyện thông minh</a>
            ${st.wrong ? `<a class="btn btn-ghost" style="padding:4px 9px;font-size:11.5px" href="${href('wrong')}">🔁 Ôn ${st.wrong} câu sai</a>` : ''}
          </div>` : ''}
        </div>
        <div class="row" style="gap:6px;margin-top:auto">
          ${actBtns}
          <a class="btn btn-ghost" href="report/index.html?exam=${encodeURIComponent(x.id)}">Xếp hạng</a>
          ${hsBtn}
          ${pdfBtn}
        </div>
      </div>`;
    }).join('');
  }

  document.querySelectorAll('#subjectChips .chip').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#subjectChips .chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      curCat = btn.dataset.cat;
      renderCards();
    };
  });
  inpSearch.oninput = renderCards;
  renderCards();
  // Mở sẵn trang trước 07h00 vẫn được cập nhật nút vào bài khi đến giờ.
  const scheduleStates = () => exams.filter(x => !x.hidden && x.strictSchedule)
    .map(x => x.id + ':' + examSchedule(x).state).join('|');
  let lastScheduleStates = scheduleStates();
  if (lastScheduleStates) setInterval(() => {
    const next = scheduleStates();
    if (next !== lastScheduleStates) { lastScheduleStates = next; renderCards(); }
  }, 1000);
})();
