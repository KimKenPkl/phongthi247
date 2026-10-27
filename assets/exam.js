/* exam.js – Phòng thi chuẩn QBank Quốc tế (UWorld / AMBOSS / Bluebook Digital SAT):
 * - Bố cục 2 Cột (Main Question Workspace + Sticky Navigator Sidebar có lọc Tất cả/Chưa làm/Đánh dấu)
 * - Công cụ Gạch loại trừ phương án sai (Strikethrough Eliminator ✂)
 * - Chế độ Vô hạn thời gian (♾️ Đếm xuôi) + Tự chọn thời gian + Đồng hồ thời gian thực (🕒 Wall Clock)
 * - Chế độ Tutor Mode (Kiểm tra từng câu), Quick 20-Q, Đề chuẩn 28 câu & Cloud Leaderboard Realtime · Kimkenpkl
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const URLP = new URLSearchParams(location.search);
  const examId = URLP.get('exam');
  const urlMode = URLP.get('mode');

  let CFG = null, EXAM = null;
  let attempt = null;      // {attemptId, name, class, sbd, code, mode, customDurMin, unlimitedTime, startTs, deadline, exitTab, exitFs, exitLog[], flags{}, shuffles{}, checked{}, strikes{}}
  let answers = {};        // key = canonicalIdx → giá trị
  let ORDER = [];          // displayK → canonicalIdx
  let cur = 0;             // vị trí hiển thị hiện tại
  let submitted = false;
  let timerId = null, wallClockId = null, camCheckId = null, mediaStream = null, busyModal = false;
  let hideTimer = false;
  let paletteFilterMode = 'all'; // 'all' | 'unanswered' | 'flagged'
  let selectedDurMin = 0;        // 0 = Vô hạn thời gian (mặc định cho Luyện đề cương)

  function modal(title, msg, actions) {
    if (busyModal) return;
    busyModal = true;
    const root = $('modalRoot');
    root.innerHTML = `<div class="modal-backdrop"><div class="modal">
      <h3 style="margin-top:0">${escapeHTML(title)}</h3>
      <div style="white-space:pre-line">${msg}</div>
      <div class="row" style="margin-top:16px;justify-content:flex-end" id="mActions"></div>
    </div></div>`;
    const act = $('mActions');
    actions.forEach(a => {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.cls || '');
      b.textContent = a.label;
      b.onclick = () => { root.innerHTML = ''; busyModal = false; a.fn && a.fn(); };
      act.appendChild(b);
    });
  }

  function startWallClock() {
    function updateWall() {
      const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      if ($('wallClockEl')) $('wallClockEl').textContent = nowStr;
      if ($('enterWallClock')) $('enterWallClock').textContent = '🕒 Giờ thực tế hiện tại: ' + nowStr;
    }
    updateWall();
    if (!wallClockId) wallClockId = setInterval(updateWall, 1000);
  }

  function bindThemeButtons() {
    ['btnThemeEnter', 'btnThemeExam'].forEach(id => {
      const el = $(id);
      if (!el) return;
      const sync = () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        el.textContent = id === 'btnThemeExam' ? (isDark ? '☀️' : '🌙') : (isDark ? '☀️ Chế độ Sáng' : '🌙 Chế độ Tối');
      };
      sync();
      el.onclick = () => { PTW.theme.toggle(); sync(); };
    });
  }

  async function boot() {
    startWallClock();
    bindThemeButtons();
    try {
      CFG = await loadJSON('data/config.json');
      EXAM = await loadJSON(`data/tests/${encodeURIComponent(examId)}.json`);
    } catch (e) {
      $('loading').innerHTML = `<div class="card banner-danger">Không tải được đề "${escapeHTML(String(examId))}".<br><small>${escapeHTML(e.message)}</small></div>
        <a class="btn" href="index.html">← Về trang chủ</a>`;
      return;
    }
    document.title = (EXAM.title || 'Phòng thi') + ' – Phòng Thi 24/7';
    renderEnter();
    flushPending();
  }

  function syncDurPills(minVal) {
    selectedDurMin = minVal;
    document.querySelectorAll('#durPills .dur-pill').forEach(b => {
      const dm = b.dataset.min === 'default' ? (EXAM.durationMin || 90) : +b.dataset.min;
      b.classList.toggle('active', dm === minVal && (b.dataset.min !== 'default' || minVal === (EXAM.durationMin || 90)));
    });
  }

  function renderEnter() {
    $('loading').style.display = 'none';
    $('enterArea').style.display = '';
    $('examTitle').textContent = EXAM.title;
    $('examMeta').innerHTML = `
      <span class="badge">📚 ${escapeHTML(EXAM.subject || '')}</span>
      <span class="badge">🧮 ${EXAM.questions.length} câu</span>
      <span class="badge">⏱ Chuẩn: ${EXAM.durationMin} phút</span>
      ${EXAM.code ? `<span class="badge">🔑 Mã: <b>${escapeHTML(EXAM.code)}</b></span>` : ''}`;
    $('rulesBox').innerHTML = `
      <b>Hướng dẫn:</b> Điền đúng <b>Họ tên</b> và <b>Lớp</b> để ghi nhận kết quả lên <b>🏆 Bảng Xếp Hạng Trực Tuyến</b> (xếp hạng theo Điểm cao nhất → Thời gian nhanh nhất).
      Khi ôn đề cương dài, em có thể chọn <b>♾️ Vô hạn thời gian</b> và xem <b>🕒 Đồng hồ thời gian thực</b> ở góc trên để chủ động nghỉ ngơi.`;

    if ($('btnDurDefault')) {
      $('btnDurDefault').textContent = `⏱ Chuẩn của đề (${EXAM.durationMin || 90} phút)`;
    }

    if (CFG.classes && CFG.classes.length) {
      $('classWrap').innerHTML = `<select id="inpClass">${CFG.classes.map(c => `<option>${escapeHTML(c)}</option>`).join('')}</select>`;
    }
    if (EXAM.hasPassword === false && EXAM.code && !$('inpCode').value) {
      $('inpCode').value = EXAM.code;
    }
    const savedProfile = PTW.ls.get('ptw_student_profile');
    if (savedProfile) {
      if (!$('inpName').value && savedProfile.name) $('inpName').value = savedProfile.name;
      if ($('inpClass') && !$('inpClass').value && savedProfile.class) $('inpClass').value = savedProfile.class;
      if (!$('inpSbd').value && savedProfile.sbd) $('inpSbd').value = savedProfile.sbd;
    }

    const p1Count = EXAM.questions.filter(q => q.part === 1).length;
    const p2Count = EXAM.questions.filter(q => q.part === 2).length;
    const p3Count = EXAM.questions.filter(q => q.part === 3).length;
    if ($('lblModeMatrix') && p1Count >= 18 && p2Count >= 4 && p3Count >= 6 && EXAM.questions.length > 35) {
      $('lblModeMatrix').style.display = '';
    }

    // Xử lý mode truyền từ URL (?mode=practice | exam | quick20)
    if (urlMode && ['practice', 'exam', 'quick20', 'matrix'].includes(urlMode)) {
      const r = document.querySelector(`input[name="examMode"][value="${urlMode}"]`);
      if (r) r.checked = true;
    }

    function updateModeHighlight() {
      const checkedVal = (document.querySelector('input[name="examMode"]:checked') || {}).value || 'practice';
      ['Practice', 'Exam', 'Quick20', 'Matrix'].forEach(k => {
        const el = $('lblMode' + k);
        if (el) el.classList.toggle('active', checkedVal === k.toLowerCase());
      });
      if (checkedVal === 'practice') { syncDurPills(0); if ($('chkCamProctor')) $('chkCamProctor').checked = false; }
      else if (checkedVal === 'quick20') { syncDurPills(25); if ($('chkCamProctor')) $('chkCamProctor').checked = false; }
      else if (checkedVal === 'matrix') { syncDurPills(45); if ($('chkCamProctor')) $('chkCamProctor').checked = true; }
      else { syncDurPills(EXAM.durationMin || 90); if ($('chkCamProctor')) $('chkCamProctor').checked = true; }
      if ($('lblCamProctor') && $('chkCamProctor')) $('lblCamProctor').classList.toggle('active', $('chkCamProctor').checked);
    }

    if ($('chkCamProctor')) {
      $('chkCamProctor').onchange = () => {
        if ($('lblCamProctor')) $('lblCamProctor').classList.toggle('active', $('chkCamProctor').checked);
      };
    }

    document.querySelectorAll('input[name="examMode"]').forEach(r => { r.onchange = updateModeHighlight; });
    document.querySelectorAll('#durPills .dur-pill').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#durPills .dur-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedDurMin = btn.dataset.min === 'default' ? (EXAM.durationMin || 90) : +btn.dataset.min;
      };
    });
    updateModeHighlight();

    // Palette filter buttons
    document.querySelectorAll('#paletteFilter .pf-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#paletteFilter .pf-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        paletteFilterMode = btn.dataset.pf || 'all';
        syncPalette();
      };
    });

    if ($('btnToggleTimer')) {
      $('btnToggleTimer').onclick = () => {
        hideTimer = !hideTimer;
        $('timerEl').style.opacity = hideTimer ? '0.18' : '1';
        $('btnToggleTimer').textContent = hideTimer ? '🙈' : '👁';
      };
    }

    $('btnStart').onclick = () => startExam(null);

    const draft = PTW.ls.get('ptw_draft_' + EXAM.id);
    if (draft && draft.attempt) {
      const rb = $('resumeBox');
      rb.style.display = '';
      rb.innerHTML = `Phát hiện bài làm đang dở của <b>${escapeHTML(draft.attempt.name)}</b> (${Object.keys(draft.answers || {}).length}/${(draft.order || EXAM.questions).length} câu đã chọn).
        <div class="row" style="margin-top:8px">
          <button class="btn btn-primary" id="btnResume">▶ Tiếp tục bài đang làm dở</button>
          <button class="btn btn-ghost" id="btnDiscardDraft">Bỏ bài cũ, làm mới</button>
        </div>`;
      $('btnResume').onclick = () => resumeDraft(draft);
      $('btnDiscardDraft').onclick = () => { PTW.ls.del('ptw_draft_' + EXAM.id); rb.style.display = 'none'; };
    }
  }

  async function startCameraProctor() {
    const pip = $('proctorPip'), video = $('proctorVideo'), txt = $('proctorStatusTxt');
    if (!pip || !video || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' }, audio: false });
      video.srcObject = mediaStream;
      pip.style.display = 'block';
      attempt.camVerified = true;
      attempt.camWarns = 0;

      const canvas = document.createElement('canvas');
      canvas.width = 48; canvas.height = 36;
      const ctx = canvas.getContext('2d');

      clearInterval(camCheckId);
      camCheckId = setInterval(() => {
        if (submitted || !attempt || !mediaStream) return;
        const tracks = mediaStream.getVideoTracks();
        if (!tracks.length || tracks[0].readyState === 'ended' || !tracks[0].enabled) {
          pip.classList.add('warn');
          txt.textContent = 'MẤT CAM!';
          attempt.camWarns = (attempt.camWarns || 0) + 1;
          return;
        }
        try {
          ctx.drawImage(video, 0, 0, 48, 36);
          const data = ctx.getImageData(0, 0, 48, 36).data;
          let sum = 0;
          for (let i = 0; i < data.length; i += 16) {
            sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
          }
          const avgBrightness = sum / (data.length / 16);
          // Nếu che kín camera (tối đen avgBrightness < 12)
          if (avgBrightness < 12) {
            pip.classList.add('warn');
            txt.textContent = 'CHE CAM!';
            attempt.camWarns = (attempt.camWarns || 0) + 1;
          } else {
            pip.classList.remove('warn');
            txt.textContent = 'AI PROCTOR';
          }
        } catch (e) {}
      }, 4000);
      return true;
    } catch (err) {
      attempt.camVerified = false;
      return false;
    }
  }

  function stopCameraProctor() {
    clearInterval(camCheckId);
    camCheckId = null;
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
    if ($('proctorPip')) $('proctorPip').style.display = 'none';
  }

  async function startExam(customOrderSubset) {
    const name = ($('inpName').value || '').trim();
    const clazz = ($('inpClass').value || '').trim();
    const sbd = ($('inpSbd').value || '').trim();
    const code = ($('inpCode').value || '').trim().replace(/\s+/g, '').toUpperCase();
    const err = $('enterErr');
    if (!name) { err.textContent = '⚠ Chưa điền họ tên.'; return; }
    if (!clazz) { err.textContent = '⚠ Chưa điền lớp.'; return; }
    if ((EXAM.code || '').toUpperCase() && code !== String(EXAM.code).toUpperCase()) {
      err.textContent = '⚠ Mã phòng thi chưa đúng. Mã đề này là: ' + EXAM.code; return;
    }
    err.textContent = '';
    PTW.ls.set('ptw_student_profile', { name, class: clazz, sbd });

    const modeRadio = document.querySelector('input[name="examMode"]:checked');
    const rawMode = (EXAM.showAnswersAfterSubmit && modeRadio) ? modeRadio.value : 'exam';
    let subset = customOrderSubset;

    if (!subset && rawMode === 'quick20') {
      const seedFn = mulberry32(hashStr(EXAM.id + '|q20|' + Date.now()));
      const allIdx = Array.from({ length: EXAM.questions.length }, (_, i) => i);
      subset = shuffled(allIdx, seedFn).slice(0, Math.min(20, allIdx.length)).sort((a, b) => (EXAM.questions[a].part - EXAM.questions[b].part) || (a - b));
    } else if (!subset && rawMode === 'matrix' && window.PTWExport && window.PTWExport.drawSmartSubset) {
      subset = window.PTWExport.drawSmartSubset(EXAM);
    }

    const mode = (rawMode === 'quick20' || rawMode === 'matrix') ? 'practice' : rawMode;
    const durMin = selectedDurMin;
    const unlimitedTime = durMin <= 0;

    attempt = {
      attemptId: PTW.uuid(), name, class: clazz, sbd, code, mode, rawMode,
      customDurMin: durMin, unlimitedTime,
      startTs: Date.now(),
      deadline: unlimitedTime ? (Date.now() + 24 * 3600 * 1000) : (Date.now() + durMin * 60000),
      exitTab: 0, exitFs: 0, exitLog: [], flags: {}, checked: {}, strikes: {}, restReminded45: false,
      camVerified: false, camWarns: 0
    };
    attempt.shuffles = buildShuffles(subset);
    answers = {}; cur = 0; submitted = false;

    if ($('chkCamProctor') && $('chkCamProctor').checked) {
      await startCameraProctor();
    } else {
      stopCameraProctor();
    }

    if (CFG.blockCopy !== false) installCopyBlock();
    installCheaters();
    if (CFG.requireFullscreen && mode === 'exam') tryFullscreen();

    $('resultArea').style.display = 'none';
    $('enterArea').style.display = 'none';
    $('examArea').style.display = '';
    document.body.classList.add('exam-active');
    const modeTag = unlimitedTime ? ' · [♾️ Vô hạn thời gian]' : ` · [${durMin} phút]`;
    $('miniTitle').textContent = EXAM.title + modeTag;
    $('miniStudent').textContent = `${name} · Lớp ${clazz}`;
    buildPalette(); renderQuestion(); saveDraft();
    clearInterval(timerId);
    timerId = setInterval(tick, 1000); tick();
  }

  function buildShuffles(customOrderSubset) {
    const seedFn = mulberry32(hashStr(EXAM.id + '|' + attempt.attemptId));
    const baseIdx = Array.isArray(customOrderSubset) && customOrderSubset.length
      ? customOrderSubset.slice()
      : Array.from({ length: EXAM.questions.length }, (_, i) => i);

    if (EXAM.shuffleQuestions && !customOrderSubset) {
      const partOrder = [];
      const groups = {};
      baseIdx.forEach(i => {
        const p = EXAM.questions[i].part || 1;
        if (!groups[p]) { groups[p] = []; partOrder.push(p); }
        groups[p].push(i);
      });
      ORDER = [];
      partOrder.forEach(p => { ORDER.push(...shuffled(groups[p], seedFn)); });
    } else {
      ORDER = baseIdx;
    }
    const optMaps = [];
    ORDER.forEach(ci => {
      let map = [0, 1, 2, 3].map(i => i);
      if (EXAM.shuffleOptions && EXAM.questions[ci].part === 1) map = shuffled(map, seedFn);
      optMaps.push(map);
    });
    return { optMaps };
  }

  let paletteBtns = [];
  const LETTERS = ['A', 'B', 'C', 'D', 'E'];
  function buildPalette() {
    const p = $('palette'); p.innerHTML = '';
    paletteBtns = [];
    const frag = document.createDocumentFragment();
    ORDER.forEach((ci, k) => {
      const b = document.createElement('button');
      b.textContent = (k + 1);
      b.title = 'Câu ' + (k + 1);
      b.dataset.k = k;
      b.onclick = () => { cur = k; renderQuestion(); };
      frag.appendChild(b);
      paletteBtns.push(b);
    });
    p.appendChild(frag);
    syncPalette();
  }

  function syncPalette() {
    let nAns = 0, nFlag = 0;
    ORDER.forEach(ci => {
      if (isAnswered(ci)) nAns++;
      if (attempt && attempt.flags && attempt.flags[ci]) nFlag++;
    });
    const total = ORDER.length || 1;
    const pct = Math.round((nAns / total) * 100);
    if ($('topProgBar')) $('topProgBar').style.width = pct + '%';
    if ($('progTextBadge')) $('progTextBadge').textContent = `${nAns} / ${ORDER.length} (${pct}%)`;
    if ($('stAnswered')) $('stAnswered').textContent = nAns;
    if ($('stUnanswered')) $('stUnanswered').textContent = ORDER.length - nAns;
    if ($('stFlagged')) $('stFlagged').textContent = nFlag;

    for (let k = 0; k < paletteBtns.length; k++) {
      const b = paletteBtns[k];
      const ci = ORDER[k];
      const ans = isAnswered(ci);
      const flg = !!(attempt.flags && attempt.flags[ci]);
      b.classList.toggle('current', k === cur);
      b.classList.toggle('answered', ans);
      b.classList.toggle('flagged', flg);
      if (attempt.checked && attempt.checked[ci]) {
        const r = gradeQuestion(EXAM, EXAM.questions[ci], answers[ci]);
        b.style.borderColor = r.correct ? '#10B981' : '#F43F5E';
      }
      let show = true;
      if (paletteFilterMode === 'unanswered') show = !ans;
      else if (paletteFilterMode === 'flagged') show = flg;
      b.style.display = show ? '' : 'none';
    }

    const curFlagged = !!(attempt && attempt.flags && attempt.flags[ORDER[cur]]);
    $('btnFlag').textContent = curFlagged ? '⚑ Bỏ đánh dấu' : '⚑ Đánh dấu xem lại';
    if ($('btnCheckNow')) {
      $('btnCheckNow').style.display = (attempt && attempt.mode === 'practice' && EXAM.showAnswersAfterSubmit) ? '' : 'none';
    }
  }

  function isAnswered(ci) {
    const q = EXAM.questions[ci], a = answers[ci];
    if (a == null) return false;
    if (q.part === 2) return Array.isArray(a) && a.some(v => v === true || v === false);
    return true;
  }

  function renderInstantFeedback(ci) {
    const box = $('instantCheckBox');
    if (!box) return;
    if (!attempt || attempt.mode !== 'practice' || !attempt.checked || !attempt.checked[ci]) {
      box.innerHTML = '';
      return;
    }
    const q = EXAM.questions[ci];
    const r = gradeQuestion(EXAM, q, answers[ci]);
    let keyHtml = '';
    if (q.part === 1) {
      const map = attempt.shuffles.optMaps[cur];
      const dispIdx = map.indexOf(q.answerIndex);
      const dispLet = dispIdx >= 0 ? LETTERS[dispIdx] : LETTERS[q.answerIndex];
      keyHtml = `Đáp án đúng: <b>${dispLet}. ${sanitizeHTML(q.options[q.answerIndex])}</b>`;
    } else if (q.part === 2) {
      const al = ['a', 'b', 'c', 'd'];
      keyHtml = 'Đáp án đúng: ' + (q.statements || []).map((st, i) => `<b>${al[i]}) ${st.answer ? 'Đúng' : 'Sai'}</b>`).join(' · ');
    } else {
      keyHtml = `Đáp số đúng: <b>${escapeHTML(String(q.answer))}${q.unit ? ' ' + escapeHTML(q.unit) : ''}</b>`;
    }
    box.innerHTML = `<div class="banner ${r.correct ? 'banner-info' : 'banner-danger'}" style="margin-top:10px">
      <div>${r.correct ? '✅ <b>CHÍNH XÁC!</b> (+' + fmtScore(r.got) + ' đ)' : '❌ <b>CHƯA ĐÚNG</b> (' + fmtScore(r.got) + '/' + fmtScore(r.max) + ' đ)'}</div>
      <div style="margin-top:4px">${keyHtml}</div>
      ${q.explain ? `<div style="margin-top:6px">💡 ${sanitizeHTML(q.explain)}</div>` : ''}
    </div>`;
  }

  function renderQuestion() {
    const ci = ORDER[cur], q = EXAM.questions[ci];
    const view = $('qView');
    const parts = EXAM.parts || [];
    const partMeta = parts.find(x => x.part === q.part);
    const partLabel = partMeta ? partMeta.label : ('PHẦN ' + q.part);
    const isFlag = !!(attempt.flags && attempt.flags[ci]);

    const qToolbar = `
      <div class="q-toolbar">
        <div class="row" style="gap:8px">
          <span class="q-num-pill">Câu ${cur + 1} / ${ORDER.length}</span>
          <span class="badge">${sanitizeHTML(partLabel)}</span>
          ${isFlag ? '<span class="badge" style="background:var(--warn-soft);color:var(--warn);border-color:var(--warn-border)">⚑ Đã đánh dấu</span>' : ''}
        </div>
        <span class="hint" style="font-size:12px">${q.part === 1 ? 'Chọn 1 đáp án đúng (Bấm ✂ để gạch loại trừ)' : (q.part === 2 ? 'Chọn Đúng (Đ) hoặc Sai (S) cho từng ý a, b, c, d' : 'Điền kết quả số vào ô trống')}</span>
      </div>`;

    const stem = `<div class="question">${sanitizeHTML(q.content || '')}</div>${qImg(q)}`;
    let body = '';
    if (q.part === 1) {
      const map = attempt.shuffles.optMaps[cur];
      const strikeMap = (attempt.strikes && attempt.strikes[ci]) || {};
      body = map.map((canon, di) => {
        const isElim = !!strikeMap[canon];
        return `
        <div class="option-wrap">
          <div class="option ${answers[ci] === canon ? 'selected' : ''} ${isElim ? 'eliminated' : ''}" data-di="${di}">
            <b>${LETTERS[di]}</b> <span>${sanitizeHTML(q.options[canon])}</span>
          </div>
          <button type="button" class="strike-btn ${isElim ? 'active' : ''}" data-strike="${canon}" title="Gạch loại trừ phương án nhiễu này">✂</button>
        </div>`;
      }).join('');
      body = `${qToolbar}${stem}${body}`;
    } else if (q.part === 2) {
      const al = ['a', 'b', 'c', 'd'];
      body = q.statements.map((st, i) => `
        <div class="tfrow">
          <b>${al[i]})</b>
          <span style="flex:1">${sanitizeHTML(st.text)}</span>
          <button class="tfbtn ${answers[ci]?.[i] === true ? 'sel-true' : ''}" data-si="${i}" data-v="1">Đ</button>
          <button class="tfbtn ${answers[ci]?.[i] === false ? 'sel-false' : ''}" data-si="${i}" data-v="0">S</button>
        </div>`).join('');
      body = `${qToolbar}${stem}${body}`;
    } else {
      body = `
        ${qToolbar}${stem}
        <div class="row" style="margin-top:12px">
          <input class="short-input" type="text" id="shortInp" inputmode="decimal" placeholder="Nhập đáp số..."
                 value="${answers[ci] != null ? escapeHTML(String(answers[ci])) : ''}">
          ${q.unit ? `<span class="hint">${escapeHTML(q.unit)}</span>` : ''}
        </div>`;
    }
    view.classList.remove('frame-shift');
    void view.offsetWidth;
    view.style.animation = 'none';
    requestAnimationFrame(() => { view.style.animation = ''; });
    view.innerHTML = body;
    renderInstantFeedback(ci);

    if (q.part === 1) {
      view.querySelectorAll('.option').forEach(el => el.onclick = () => {
        const canon = attempt.shuffles.optMaps[cur][+el.dataset.di];
        answers[ci] = canon; renderQuestion(); saveDraft();
      });
      view.querySelectorAll('.strike-btn').forEach(btn => btn.onclick = e => {
        e.stopPropagation();
        const canon = +btn.dataset.strike;
        if (!attempt.strikes) attempt.strikes = {};
        if (!attempt.strikes[ci]) attempt.strikes[ci] = {};
        attempt.strikes[ci][canon] = !attempt.strikes[ci][canon];
        renderQuestion(); saveDraft();
      });
    }
    if (q.part === 2) view.querySelectorAll('.tfbtn').forEach(el => el.onclick = () => {
      const i = +el.dataset.si, v = el.dataset.v === '1';
      const arr = Array.isArray(answers[ci]) ? answers[ci].slice() : [null, null, null, null].map(x => x);
      arr[i] = (arr[i] === v ? null : v);
      answers[ci] = arr; renderQuestion(); saveDraft();
    });
    if (q.part === 3) $('shortInp').oninput = e => { answers[ci] = e.target.value.trim() || null; syncPalette(); saveDraftThrottled(); };
    $('btnPrev').disabled = cur === 0;
    $('btnNext').textContent = cur === ORDER.length - 1 ? '🏁 Kiểm tra & Nộp bài' : 'Câu tiếp theo →';
    syncPalette();
  }
  function qImg(q) {
    return q && q.image ? `<img class="qimg" src="${escapeHTML(q.image)}" alt="hình câu hỏi">` : '';
  }

  function tick() {
    if (!attempt) return;
    const elapsedSec = Math.max(0, Math.round((Date.now() - (attempt.startTs || Date.now())) / 1000));
    const t = $('timerEl');

    if (attempt.unlimitedTime) {
      t.textContent = '♾️ ' + fmtClock(elapsedSec);
      t.classList.remove('low');
      // Nhắc nhở nghỉ ngơi nhẹ nhàng sau 45 phút học liên tục
      if (elapsedSec >= 2700 && !attempt.restReminded45) {
        attempt.restReminded45 = true;
        modal('☕ Nghỉ ngơi 2 phút nhé!', 'Em đã tập trung ôn đề liên tục được 45 phút rồi. Hãy nhìn xa 20 giây hoặc uống ngụm nước trước khi làm tiếp nhé!', [{ label: 'Tiếp tục ôn tập', cls: 'btn-primary' }]);
      }
      return;
    }

    const left = Math.max(0, Math.round((attempt.deadline - Date.now()) / 1000));
    t.textContent = '⏱ ' + fmtClock(left);
    t.classList.toggle('low', left < 300);
    if (left === 0) { finishExam('timeup'); return; }
    if ((left === 300 || left === 60) && attempt.mode === 'exam') {
      modal('⏰ Còn ' + (left === 300 ? '5 phút' : '60 giây') + '!', 'Em kiểm tra lại các câu và chuẩn bị nộp bài nhé.', [{ label: 'Đã hiểu', cls: 'btn-primary' }]);
    }
  }

  function installCopyBlock() {
    PTW.protectContent();
  }
  let cheatersInstalled = false;
  function installCheaters() {
    if (cheatersInstalled) return;
    cheatersInstalled = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !submitted && attempt) {
        attempt.exitTab++;
        attempt.exitLog.push(new Date().toISOString());
        $('exitBadge').textContent = `🚩 rời tab ×${attempt.exitTab}`;
        saveDraft();
      }
    });
    document.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      const blocked = (e.ctrlKey && e.shiftKey && 'ijcx'.includes(k)) || e.key === 'F12' || (e.ctrlKey && k === 'p' && !submitted);
      if (blocked && attempt && attempt.mode === 'exam') { e.preventDefault(); return; }
      if (!$('examArea').style.display || $('examArea').style.display === 'none') return;
      const inInput = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
      if (e.key === 'ArrowRight' && !inInput && cur < ORDER.length - 1) { cur++; renderQuestion(); }
      if (e.key === 'ArrowLeft' && !inInput && cur > 0) { cur--; renderQuestion(); }
      if (inInput || !attempt || e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === 'f') { attempt.flags[ORDER[cur]] = !attempt.flags[ORDER[cur]]; syncPalette(); saveDraft(); }
      const q = EXAM.questions[ORDER[cur]];
      if (q && q.part === 1) {
        let di = -1;
        if ('1234'.includes(e.key)) di = +e.key - 1;
        else if ('abcd'.includes(k)) di = k.charCodeAt(0) - 97;
        if (di >= 0 && di < 4) {
          answers[ORDER[cur]] = attempt.shuffles.optMaps[cur][di];
          renderQuestion(); saveDraft();
        }
      }
    });
    window.addEventListener('blur', () => {
      if (!submitted && attempt && $('examArea').style.display !== 'none') {
        document.body.classList.add('window-blurred');
      }
    });
    window.addEventListener('focus', () => {
      document.body.classList.remove('window-blurred');
    });
    window.addEventListener('beforeunload', e => {
      if (!submitted && attempt) { e.preventDefault(); e.returnValue = ''; return ''; }
    });
  }
  function tryFullscreen() {
    const el = document.documentElement;
    (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el).catch?.(() => {});
  }

  $('btnPrev').onclick = () => { if (cur > 0) { cur--; renderQuestion(); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
  $('btnNext').onclick = () => {
    if (cur < ORDER.length - 1) { cur++; renderQuestion(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else { const k = ORDER.findIndex(ci => !isAnswered(ci)); if (k >= 0) { cur = k; renderQuestion(); } else askSubmitTotal(); }
  };
  $('btnFlag').onclick = () => { attempt.flags[ORDER[cur]] = !attempt.flags[ORDER[cur]]; renderQuestion(); saveDraft(); };
  if ($('btnCheckNow')) {
    $('btnCheckNow').onclick = () => {
      const ci = ORDER[cur];
      if (!attempt.checked) attempt.checked = {};
      attempt.checked[ci] = true;
      renderInstantFeedback(ci);
      syncPalette();
      saveDraft();
    };
  }
  $('btnSubmit').onclick = askSubmitTotal;

  function askSubmitTotal() {
    const nLeft = ORDER.filter(ci => !isAnswered(ci)).length;
    modal('Xác nhận nộp bài?', nLeft ? `⚠ Em còn ${nLeft}/${ORDER.length} câu chưa trả lời. Vẫn nộp bài ngay bây giờ?` : `Em đã hoàn thành đủ ${ORDER.length} câu. Nộp bài để chấm điểm & ghi danh Bảng xếp hạng?`,
      [
        { label: 'Quay lại làm tiếp' },
        { label: '✅ Nộp bài ngay', cls: 'btn-danger', fn: () => finishExam('manual') }
      ]);
  }

  function gradeSubset(orderList) {
    const fullRes = gradeExam(EXAM, answers);
    if (orderList.length === EXAM.questions.length) return fullRes;
    let score = 0, max = 0, nAnswered = 0;
    const parts = EXAM.parts || [];
    const perPart = parts.map(p => ({ part: p.part, got: 0, max: 0 }));
    orderList.forEach(ci => {
      const d = fullRes.detail[ci];
      score += d.got; max += d.max;
      if (d.answered) nAnswered++;
      const pp = perPart.find(x => x.part === d.part);
      if (pp) { pp.got += d.got; pp.max += d.max; }
    });
    return { score, max, perPart, detail: fullRes.detail, nAnswered, nQuestions: orderList.length };
  }

  function finishExam(reason) {
    if (submitted || !attempt) return;
    submitted = true;
    document.body.classList.remove('exam-active');
    document.body.classList.remove('window-blurred');
    clearInterval(timerId);
    stopCameraProctor();
    const res = gradeSubset(ORDER);
    const usedSec = Math.max(1, Math.round((Date.now() - (attempt.startTs || Date.now())) / 1000));
    PTW.ls.del('ptw_draft_' + EXAM.id);

    const prevBest = PTW.ls.get('ptw_best_' + EXAM.id);
    const runs = (prevBest && prevBest.runs ? prevBest.runs : 0) + 1;
    if (!prevBest || res.score >= prevBest.score) {
      PTW.ls.set('ptw_best_' + EXAM.id, { score: res.score, max: res.max, runs, ts: new Date().toISOString() });
    } else {
      PTW.ls.set('ptw_best_' + EXAM.id, { ...prevBest, runs });
    }

    renderResult(res, reason, usedSec);
    postAttempt(res, usedSec);
  }

  function renderLeaderboardBox(rows, myAttemptId) {
    const box = $('liveRankBox');
    if (!box) return;
    const ranked = PTW.rankRows(rows, true);
    if (!ranked.length) {
      box.innerHTML = '';
      return;
    }
    const myEntry = ranked.find(r => r.attemptId === myAttemptId) || ranked.find(r => r.name.toLowerCase() === (attempt.name || '').toLowerCase() && r.class.toLowerCase() === (attempt.class || '').toLowerCase());
    const medals = ['🥇', '🥈', '🥉'];
    const topRows = ranked.slice(0, 15).map((r, i) => {
      const isMe = myEntry && r.rank === myEntry.rank;
      const badgeRank = i < 3 ? `${medals[i]} #${r.rank}` : `#${r.rank}`;
      return `<tr style="${isMe ? 'background:var(--primary-soft);font-weight:700' : ''}">
        <td><b>${badgeRank}</b></td>
        <td>${escapeHTML(r.name)} ${isMe ? '<span class="badge" style="background:var(--primary);color:#fff;border:none">Bạn</span>' : ''}</td>
        <td>${escapeHTML(r.class)}</td>
        <td><b style="color:var(--primary)">${fmtScore(r.score)}</b><span class="hint">/${fmtScore(r.max)} (${r.pct.toFixed(1)}%)</span></td>
        <td>${fmtDuration(r.timeUsedSec)}</td>
      </tr>`;
    }).join('');

    box.innerHTML = `
      <div class="card" style="margin-top:16px">
        <div class="row" style="justify-content:space-between;margin-bottom:10px">
          <h3 style="margin:0">🏆 Bảng Xếp Hạng Trực Tuyến – ${escapeHTML(EXAM.title)}</h3>
          ${myEntry ? `<span class="badge" style="background:var(--ok-soft);border-color:var(--ok-border);color:var(--ok);font-size:13.5px;padding:5px 12px">🎉 Hạng hiện tại của bạn: <b>#${myEntry.rank} / ${ranked.length} học sinh</b></span>` : ''}
        </div>
        <div style="overflow-x:auto">
          <table>
            <thead><tr><th>Hạng</th><th>Học sinh</th><th>Lớp</th><th>Điểm</th><th>Thời gian làm</th></tr></thead>
            <tbody>${topRows}</tbody>
          </table>
        </div>
      </div>`;
  }

  function renderResult(res, reason, usedSec) {
    $('examArea').style.display = 'none';
    const ra = $('resultArea'); ra.style.display = '';
    const per = res.perPart.map(x => `P${x.part}: <b>${fmtScore(x.got)}</b>/${fmtScore(x.max)}`).join(' · ');
    const wrongIndices = ORDER.filter(ci => !res.detail[ci].correct);
    const pct = res.max ? Math.round((res.score / res.max) * 1000) / 10 : 0;
    let html = `
      <div class="card" style="text-align:center;padding:28px">
        <div class="hint">${reason === 'timeup' ? '⏰ Hết giờ — hệ thống tự nộp bài' : '✅ Đã hoàn thành &amp; chấm điểm tự động'}</div>
        <div style="font-size:54px;font-weight:800;color:var(--primary);letter-spacing:-1px">${fmtScore(res.score)}<span style="font-size:24px;color:var(--muted)">/${fmtScore(res.max)} đ (${pct}%)</span></div>
        <div class="row" style="justify-content:center">${per}</div>
        <div class="hint" style="margin-top:8px">${res.nAnswered}/${res.nQuestions} câu đã trả lời · thời gian thực tế: <b>${fmtDuration(usedSec)}</b> · rời tab ×${attempt.exitTab}</div>
        <div class="row" style="justify-content:center;margin-top:14px">
          ${wrongIndices.length ? `<button class="btn btn-primary" id="btnRetryWrong">🔄 Luyện lại ${wrongIndices.length} câu Sai / Bỏ trống</button>` : '<span class="badge" style="background:var(--ok-soft);color:var(--ok);font-size:14px;padding:8px 14px">🎉 Xuất sắc! Đúng tuyệt đối 100% số câu!</span>'}
          <button class="btn" id="btnRetryAll">🔁 Làm lại đề</button>
          <button class="btn" onclick="window.print()">🖨 In kết quả</button>
          ${window.PTWExport ? '<button class="btn" id="btnExportDocx">📄 Tải phiếu bài làm (.docx)</button><button class="btn" id="btnExportPdf">📕 Tải phiếu bài làm (.pdf)</button>' : ''}
          <a class="btn btn-ghost" href="index.html">← Về trang chủ</a>
        </div>
        <div id="sendStatus" class="hint" style="margin-top:10px">⏳ Đang báo kết quả về Bảng xếp hạng của Thầy…</div>
      </div>
      <div id="liveRankBox"></div>`;

    if (EXAM.showAnswersAfterSubmit) {
      html += '<div class="result-list">';
      ORDER.forEach((ci, k) => {
        const d = res.detail[ci];
        const q = d.q;
        const cls = d.correct ? 'ok' : 'bad';
        let inner = `<strong>Câu ${k + 1}</strong> · Phần ${d.part} · ${d.got}/${d.max} đ → ${d.correct ? '<span class="tag-ok">ĐÚNG</span>' : (d.answered ? '<span class="tag-bad">SAI</span>' : '<span class="tag-bad">BỎ TRỐNG</span>')}<br>${sanitizeHTML(q.content)}`;

        if (q.part === 1) {
          inner += `<div class="row" style="margin-top:6px">`;
          q.options.forEach((op, i) => {
            const isKey = i === q.answerIndex;
            const isMine = d.ans === i;
            inner += `<span class="badge" style="${isKey ? 'background:var(--ok-soft);border-color:var(--ok-border);color:var(--ok)' : 'opacity:.78'}">${isKey ? '✔ ' : ''}${LETTERS[i]}: ${sanitizeHTML(op)}${isMine ? ' (bạn chọn)' : ''}${isMine && !isKey ? ' ✘' : ''}</span>`;
          });
          inner += `</div>`;
        } else if (q.part === 2) {
          const al = ['a', 'b', 'c', 'd'];
          inner += (q.statements || []).map((st, i) => {
            const a = Array.isArray(d.ans) ? d.ans[i] : null;
            const ok = a === st.answer;
            return `<div class="tfrow" style="border:none;padding:4px 0;background:transparent">
              <b>${al[i]})</b> <span style="flex:1">${sanitizeHTML(st.text)}</span>
              <span>đáp án: <b>${st.answer ? 'Đ' : 'S'}</b>${a === true || a === false ? ` · bạn chọn: <b style="color:${ok ? 'var(--ok)' : 'var(--danger)'}">${a ? 'Đ' : 'S'}</b>` : ''}</span>
            </div>`;
          }).join('');
          if (d.info && d.info.note) inner += `<div class="hint">${escapeHTML(d.info.note)}</div>`;
        } else {
          inner += `<div class="hint" style="margin-top:6px">Đáp án: <b>${escapeHTML(String(q.answer))}${q.unit ? ' ' + escapeHTML(q.unit) : ''}</b>${d.ans != null && d.ans !== '' ? ` · bạn nhập: <b>${escapeHTML(String(d.ans))}</b>` : ' · chưa nhập'}</div>`;
        }
        if (q.explain) inner += `<div class="explain">💡 ${sanitizeHTML(q.explain)}</div>`;
        html += `<div class="q ${cls}">${inner}</div>`;
      });
      html += '</div>';
    }
    ra.innerHTML = html;
    if ($('btnRetryWrong')) $('btnRetryWrong').onclick = () => startExam(wrongIndices);
    if ($('btnRetryAll')) $('btnRetryAll').onclick = () => startExam(null);
    if ($('btnExportDocx') && window.PTWExport) $('btnExportDocx').onclick = () => window.PTWExport.downloadAttemptDocx(EXAM, attempt, ORDER, res, usedSec);
    if ($('btnExportPdf') && window.PTWExport) $('btnExportPdf').onclick = () => window.PTWExport.downloadAttemptPdf(EXAM, attempt, ORDER, res, usedSec);
  }

  function payload(res, usedSec) {
    const per = {}; res.perPart.forEach(x => { per['part' + x.part] = Math.round(x.got * 100) / 100; });
    const detail = {};
    ORDER.forEach((ci, k) => { detail['C' + (k + 1)] = res.detail[ci].got; });
    return {
      ts: new Date().toISOString(), brand: CFG.brand || 'Phòng Thi 24/7',
      examId: EXAM.id, examTitle: EXAM.title, code: attempt.code,
      attemptId: attempt.attemptId,
      name: attempt.name, class: attempt.class, sbd: attempt.sbd,
      score: Math.round(res.score * 100) / 100, max: res.max,
      pct: res.max ? Math.round(res.score / res.max * 1000) / 10 : 0,
      per: per, answered: res.nAnswered, total: res.nQuestions,
      timeUsedSec: usedSec,
      timeUsedMin: Math.max(1, Math.round(usedSec / 60)),
      exitTab: attempt.exitTab, exitFs: attempt.exitFs,
      camVerified: !!attempt.camVerified,
      camWarns: +(attempt.camWarns || 0),
      ua: navigator.userAgent,
      detail: JSON.stringify(detail),
      answers: JSON.stringify(answers)
    };
  }

  function getActiveScriptUrl() {
    return (PTW.ls.get('ptw_custom_gs_url') || (CFG && CFG.appsScriptUrl) || '').trim();
  }

  async function postAttempt(res, usedSec) {
    const st = $('sendStatus');
    const p = payload(res, usedSec);

    const localList = PTW.ls.get('ptw_local_submissions') || [];
    localList.unshift({
      attemptId: p.attemptId,
      ts: p.ts,
      'Thời điểm nộp': fmtDateTime(new Date(p.ts)),
      'examId': p.examId,
      'Tên đề': p.examTitle,
      'Mã phòng': p.code,
      'Họ tên': p.name,
      'Lớp': p.class,
      'SBD': p.sbd,
      'Điểm': p.score,
      'Tối đa': p.max,
      '%': p.pct,
      'P1': p.per.part1 || 0,
      'P2': p.per.part2 || 0,
      'P3': p.per.part3 || 0,
      'timeUsedSec': p.timeUsedSec,
      'Làm/phút': fmtDuration(p.timeUsedSec),
      'Rời tab': p.exitTab,
      'Thoát FS': p.exitFs,
      'camVerified': p.camVerified,
      'camWarns': p.camWarns,
      'Camera': p.camVerified ? ('📷 Có Cam' + (p.camWarns ? ` (⚠×${p.camWarns})` : ' ✓')) : '—',
      'Số câu TL': p.answered,
      'Tổng câu': p.total
    });
    PTW.ls.set('ptw_local_submissions', localList.slice(0, 500));

    let cloudOk = false;
    try {
      const updatedRows = await PTW.cloud.submit(CFG, p);
      if (Array.isArray(updatedRows) && updatedRows.length) {
        cloudOk = true;
        renderLeaderboardBox(updatedRows, p.attemptId);
      } else {
        const cloudRows = await PTW.cloud.fetchExamOrAll(CFG, EXAM.id);
        renderLeaderboardBox(cloudRows, p.attemptId);
      }
      PTW.cloud.flushCloudQueue(CFG);
    } catch (e) {}

    const gsUrl = getActiveScriptUrl();
    if (gsUrl) {
      const list = PTW.ls.get('ptw_pending') || [];
      list.push(p);
      PTW.ls.set('ptw_pending', list);
      await flushPending();
    } else if (st) {
      st.innerHTML = cloudOk
        ? '<span style="color:var(--ok);font-weight:600">🌐 Kết quả đã tự động gửi về Bảng Xếp Hạng của Thầy thành công ✓</span>'
        : '💾 Đã lưu kết quả trên thiết bị.';
    }
  }

  async function flushPending() {
    const st = $('sendStatus') || { innerHTML: '' };
    const gsUrl = getActiveScriptUrl();
    if (!gsUrl) return;
    const list = PTW.ls.get('ptw_pending') || [];
    if (!list.length) return;
    const remain = [];
    for (const p of list) {
      try {
        await fetch(gsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(p),
          mode: 'no-cors'
        });
      } catch (e) { remain.push(p); }
    }
    PTW.ls.set('ptw_pending', remain);
    if (remain.length === 0) {
      st.innerHTML = `<span style="color:var(--ok);font-weight:600">🌐 Đã đồng bộ lên Bảng Xếp Hạng Trực Tuyến &amp; Google Sheet ✓</span>`;
    }
  }

  let draftThrottle = null;
  function saveDraftThrottled() { if (!draftThrottle) draftThrottle = setTimeout(() => { draftThrottle = null; saveDraft(); }, 800); }
  function saveDraft() {
    if (submitted || !attempt) return;
    PTW.ls.set('ptw_draft_' + EXAM.id, { attempt, answers, cur, order: ORDER });
  }

  function resumeDraft(d) {
    attempt = d.attempt; answers = d.answers || {}; cur = d.cur || 0; submitted = false;
    if (!attempt.checked) attempt.checked = {};
    if (!attempt.strikes) attempt.strikes = {};
    ORDER = Array.isArray(d.order) && d.order.length ? d.order.slice() : EXAM.questions.map((_, i) => i);
    let mixedParts = false;
    for (let i = 1; i < ORDER.length; i++) {
      if ((EXAM.questions[ORDER[i]].part || 1) < (EXAM.questions[ORDER[i - 1]].part || 1)) { mixedParts = true; break; }
    }
    if (mixedParts && attempt.shuffles && Array.isArray(attempt.shuffles.optMaps)) {
      const pairs = ORDER.map((ci, idx) => ({ ci, map: attempt.shuffles.optMaps[idx], part: EXAM.questions[ci].part || 1, idx }));
      pairs.sort((a, b) => (a.part - b.part) || (a.idx - b.idx));
      ORDER = pairs.map(p => p.ci);
      attempt.shuffles.optMaps = pairs.map(p => p.map);
      saveDraft();
    }
    if (CFG.blockCopy && attempt.mode === 'exam') installCopyBlock();
    installCheaters();
    if (CFG.requireFullscreen && attempt.mode === 'exam') tryFullscreen();
    $('enterArea').style.display = 'none';
    $('examArea').style.display = '';
    document.body.classList.add('exam-active');
    const modeTag = attempt.unlimitedTime ? ' · [♾️ Vô hạn thời gian]' : ` · [${attempt.customDurMin || EXAM.durationMin} phút]`;
    $('miniTitle').textContent = EXAM.title + modeTag;
    $('miniStudent').textContent = `${attempt.name} · Lớp ${attempt.class}`;
    buildPalette(); renderQuestion();
    clearInterval(timerId);
    timerId = setInterval(tick, 1000); tick();
  }

  boot();
})();
