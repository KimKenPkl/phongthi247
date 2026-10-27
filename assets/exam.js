/* exam.js – Phòng thi: vào bài, đối giờ, chế độ Luyện đề cương & Thi thử,
 * Bảng xếp hạng trực tuyến Realtime (Cloud Leaderboard) để xếp rank trao thưởng · Kimkenpkl
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const URLP = new URLSearchParams(location.search);
  const examId = URLP.get('exam');

  let CFG = null, EXAM = null;
  let attempt = null;
  let answers = {};
  let ORDER = [];
  let cur = 0;
  let submitted = false;
  let timerId = null, busyModal = false;

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

  async function boot() {
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

  function renderEnter() {
    $('loading').style.display = 'none';
    $('enterArea').style.display = '';
    $('examTitle').textContent = EXAM.title;
    $('examMeta').innerHTML = `
      <span class="badge">📚 ${escapeHTML(EXAM.subject || '')}</span>
      <span class="badge">🧮 ${EXAM.questions.length} câu</span>
      <span class="badge">⏱ ${EXAM.durationMin} phút</span>
      ${EXAM.code ? `<span class="badge">🔑 Mã: <b>${escapeHTML(EXAM.code)}</b></span>` : ''}`;
    $('rulesBox').innerHTML = `
      <b>Hướng dẫn:</b> Điền đúng <b>Họ tên</b> và <b>Lớp</b> để hệ thống ghi nhận kết quả lên <b>🏆 Bảng Xếp Hạng Trực Tuyến</b> của lớp.
      Xếp hạng tính theo: <b>Điểm cao nhất → Thời gian làm nhanh nhất</b>.`;
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
    if ($('modeField')) {
      $('modeField').style.display = EXAM.showAnswersAfterSubmit ? '' : 'none';
      if ($('lblModeMatrix')) {
        $('lblModeMatrix').style.display = (EXAM.questions && EXAM.questions.length > 35 && typeof PTWExport !== 'undefined') ? '' : 'none';
      }
      document.querySelectorAll('input[name="examMode"]').forEach(r => {
        r.onchange = () => {
          if ($('lblModePractice')) $('lblModePractice').classList.toggle('active', r.value === 'practice' && r.checked);
          if ($('lblModeExam')) $('lblModeExam').classList.toggle('active', r.value === 'exam' && r.checked);
          if ($('lblModeMatrix')) $('lblModeMatrix').classList.toggle('active', r.value === 'matrix' && r.checked);
        };
      });
    }
    $('btnStart').onclick = () => startExam(null);

    const draft = PTW.ls.get('ptw_draft_' + EXAM.id);
    if (draft && draft.attempt) {
      const left = Math.max(0, Math.ceil((draft.attempt.deadline - Date.now()) / 60000));
      const rb = $('resumeBox');
      rb.style.display = '';
      rb.innerHTML = `Phát hiện bài làm đang dở của <b>${escapeHTML(draft.attempt.name)}</b> (còn ~${left} phút).
        <div class="row" style="margin-top:8px">
          <button class="btn btn-primary" id="btnResume">▶ Tiếp tục bài dở</button>
          <button class="btn btn-ghost" id="btnDiscardDraft">Bỏ bài cũ, làm mới</button>
        </div>`;
      $('btnResume').onclick = () => resumeDraft(draft);
      $('btnDiscardDraft').onclick = () => { PTW.ls.del('ptw_draft_' + EXAM.id); rb.style.display = 'none'; };
    }
  }

  function startExam(customOrderSubset) {
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
    if (!customOrderSubset && rawMode === 'matrix' && typeof PTWExport !== 'undefined') {
      customOrderSubset = PTWExport.drawSmartSubset(EXAM);
    }
    const mode = rawMode === 'matrix' ? 'exam' : rawMode;

    attempt = {
      attemptId: PTW.uuid(), name, class: clazz, sbd, code, mode,
      startTs: Date.now(), deadline: Date.now() + EXAM.durationMin * 60000,
      exitTab: 0, exitFs: 0, exitLog: [], flags: {}, checked: {}
    };
    attempt.shuffles = buildShuffles(customOrderSubset);
    answers = {}; cur = 0; submitted = false;

    if (CFG.blockCopy && mode === 'exam') installCopyBlock();
    installCheaters();
    if (CFG.requireFullscreen && mode === 'exam') tryFullscreen();

    $('resultArea').style.display = 'none';
    $('enterArea').style.display = 'none';
    $('examArea').style.display = '';
    document.body.classList.add('exam-active');
    $('miniTitle').textContent = EXAM.title + (mode === 'practice' ? ' · [Luyện đề]' : '');
    $('miniStudent').textContent = `${name} · ${clazz}`;
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

  const LETTERS = ['A', 'B', 'C', 'D', 'E'];
  function buildPalette() {
    const p = $('palette'); p.innerHTML = '';
    ORDER.forEach((ci, k) => {
      const b = document.createElement('button');
      b.textContent = (k + 1);
      b.title = 'Câu ' + (k + 1);
      b.dataset.k = k;
      b.onclick = () => { cur = k; renderQuestion(); };
      p.appendChild(b);
    });
    syncPalette();
  }
  function syncPalette() {
    document.querySelectorAll('#palette button').forEach(b => {
      const k = +b.dataset.k;
      const ci = ORDER[k];
      b.classList.toggle('current', k === cur);
      b.classList.toggle('answered', isAnswered(ci));
      b.classList.toggle('flagged', !!attempt.flags[ci]);
      if (attempt.checked && attempt.checked[ci]) {
        const r = gradeQuestion(EXAM, EXAM.questions[ci], answers[ci]);
        b.style.borderColor = r.correct ? '#059669' : '#E11D48';
      }
    });
    $('btnFlag').textContent = attempt.flags[ORDER[cur]] ? '⚑ Bỏ đánh dấu' : '⚑ Đánh dấu xem lại';
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
    const prev = cur > 0 ? EXAM.questions[ORDER[cur - 1]] : null;
    const head = (!prev || prev.part !== q.part) && parts.length
      ? `<div class="part-divider">${sanitizeHTML(parts.find(x => x.part === q.part)?.label || ('PHẦN ' + q.part))}<div class="hint">${sanitizeHTML(parts.find(x => x.part === q.part)?.hint || '')}</div></div>` : '';
    const stem = `<div class="question" style="margin:10px 0 14px;font-size:16.5px;line-height:1.7"><b style="color:var(--primary)">Câu ${cur + 1}.</b> ${sanitizeHTML(q.content || '')}</div>${qImg(q)}`;
    let body = '';
    if (q.part === 1) {
      const map = attempt.shuffles.optMaps[cur];
      body = map.map((canon, di) => `
        <div class="option ${answers[ci] === canon ? 'selected' : ''}" data-di="${di}">
          <b>${LETTERS[di]}</b> <span>${sanitizeHTML(q.options[canon])}</span>
        </div>`).join('');
      body = `${head}${stem}${body}`;
    } else if (q.part === 2) {
      const al = ['a', 'b', 'c', 'd'];
      body = q.statements.map((st, i) => `
        <div class="tfrow">
          <b>${al[i]})</b>
          <span style="flex:1">${sanitizeHTML(st.text)}</span>
          <button class="tfbtn ${answers[ci]?.[i] === true ? 'sel-true' : ''}" data-si="${i}" data-v="1">Đ</button>
          <button class="tfbtn ${answers[ci]?.[i] === false ? 'sel-false' : ''}" data-si="${i}" data-v="0">S</button>
        </div>`).join('');
      body = `${head}${stem}${body}`;
    } else {
      body = `
        ${head}${stem}
        <div class="row" style="margin-top:10px">
          <input class="short-input" type="text" id="shortInp" inputmode="decimal" placeholder="Kết quả"
                 value="${answers[ci] != null ? escapeHTML(String(answers[ci])) : ''}">
          ${q.unit ? `<span class="hint">${escapeHTML(q.unit)}</span>` : ''}
        </div>`;
    }
    view.innerHTML = body;
    renderInstantFeedback(ci);

    if (q.part === 1) view.querySelectorAll('.option').forEach(el => el.onclick = () => {
      const canon = attempt.shuffles.optMaps[cur][+el.dataset.di];
      answers[ci] = canon; renderQuestion(); saveDraft();
    });
    if (q.part === 2) view.querySelectorAll('.tfbtn').forEach(el => el.onclick = () => {
      const i = +el.dataset.si, v = el.dataset.v === '1';
      const arr = Array.isArray(answers[ci]) ? answers[ci].slice() : [null, null, null, null].map(x => x);
      arr[i] = (arr[i] === v ? null : v);
      answers[ci] = arr; renderQuestion(); saveDraft();
    });
    if (q.part === 3) $('shortInp').oninput = e => { answers[ci] = e.target.value.trim() || null; syncPalette(); saveDraftThrottled(); };
    $('btnPrev').disabled = cur === 0;
    $('btnNext').textContent = cur === ORDER.length - 1 ? '🏁 Xem danh sách câu' : 'Câu sau →';
    syncPalette();
  }
  function qImg(q) {
    return q && q.image ? `<img class="qimg" src="${escapeHTML(q.image)}" alt="hình câu hỏi">` : '';
  }

  function tick() {
    const left = Math.max(0, Math.round((attempt.deadline - Date.now()) / 1000));
    const t = $('timerEl');
    t.textContent = fmtClock(left);
    t.classList.toggle('low', left < 300);
    if (left === 0) { finishExam('timeup'); return; }
    if ((left === 300 || left === 60) && attempt.mode === 'exam') {
      modal('⏰ Còn ' + (left === 300 ? '5 phút' : '60 giây') + '!', 'Em kiểm tra và nộp bài nhé.', [{ label: 'OK', cls: 'btn-primary' }]);
    }
  }

  function installCopyBlock() {
    ['copy', 'cut', 'paste'].forEach(ev => document.addEventListener(ev, e => {
      if (!submitted && attempt && attempt.mode === 'exam' && $('examArea').style.display !== 'none') { e.preventDefault(); }
    }));
    document.addEventListener('contextmenu', e => {
      if (!submitted && attempt && attempt.mode === 'exam' && $('examArea').style.display !== 'none') e.preventDefault();
    });
  }
  let cheatersInstalled = false;
  function installCheaters() {
    if (cheatersInstalled) return;
    cheatersInstalled = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !submitted && attempt && attempt.mode === 'exam') {
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
  $('btnFlag').onclick = () => { attempt.flags[ORDER[cur]] = !attempt.flags[ORDER[cur]]; syncPalette(); saveDraft(); };
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
    modal('Nộp bài?', nLeft ? `⚠ Em còn ${nLeft} câu chưa trả lời. Vẫn nộp bài ngay bây giờ?` : `Xác nhận nộp bài? Em đã trả lời đủ ${ORDER.length} câu.`,
      [
        { label: 'Làm tiếp' },
        { label: '✅ Nộp bài', cls: 'btn-danger', fn: () => finishExam('manual') }
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
    clearInterval(timerId);
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
      return `<tr style="${isMe ? 'background:#EEF2FF;font-weight:700' : ''}">
        <td><b>${badgeRank}</b></td>
        <td>${escapeHTML(r.name)} ${isMe ? '<span class="badge" style="background:#4F46E5;color:#fff;border:none">Em</span>' : ''}</td>
        <td>${escapeHTML(r.class)}</td>
        <td><b style="color:var(--primary)">${fmtScore(r.score)}</b><span class="hint">/${fmtScore(r.max)}</span></td>
        <td>${fmtDuration(r.timeUsedSec)}</td>
      </tr>`;
    }).join('');

    box.innerHTML = `
      <div class="card" style="margin-top:14px">
        <div class="row" style="justify-content:space-between;margin-bottom:10px">
          <h3 style="margin:0">🏆 Bảng Xếp Hạng Trực Tuyến – ${escapeHTML(EXAM.title)}</h3>
          ${myEntry ? `<span class="badge" style="background:#ECFDF5;border-color:#A7F3D0;color:#059669;font-size:13.5px;padding:5px 12px">🎉 Hạng của em: <b>#${myEntry.rank} / ${ranked.length} học sinh</b></span>` : ''}
        </div>
        <div style="overflow-x:auto">
          <table>
            <thead><tr><th>Hạng</th><th>Học sinh</th><th>Lớp</th><th>Điểm</th><th>Thời gian</th></tr></thead>
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
    let html = `
      <div class="card" style="text-align:center;padding:28px">
        <div class="hint">${reason === 'timeup' ? '⏰ Hết giờ — hệ thống tự nộp bài' : '✅ Bài làm đã được nộp'}</div>
        <div style="font-size:56px;font-weight:800;color:var(--primary);letter-spacing:-1px">${fmtScore(res.score)}<span style="font-size:26px;color:var(--muted)">/${fmtScore(res.max)}</span></div>
        <div class="row" style="justify-content:center">${per}</div>
        <div class="hint" style="margin-top:8px">${res.nAnswered}/${res.nQuestions} câu đã trả lời · thời gian: <b>${fmtDuration(usedSec)}</b> · rời tab ×${attempt.exitTab}</div>
        <div class="row" style="justify-content:center;margin-top:14px">
          ${wrongIndices.length ? `<button class="btn btn-primary" id="btnRetryWrong">🔄 Luyện lại ${wrongIndices.length} câu Sai / Bỏ trống</button>` : '<span class="badge" style="background:#ECFDF5;color:#059669;font-size:14px;padding:8px 14px">🎉 Tuyệt vời! Em đã đúng tuyệt đối 100% số câu!</span>'}
          <button class="btn" id="btnRetryAll">🔁 Làm lại toàn bộ đề</button>
          <button class="btn" onclick="window.print()">🖨 In kết quả</button>
          ${EXAM.showAnswersAfterSubmit && typeof PTWExport !== 'undefined' ? '<button class="btn" id="btnExportDocx" style="border-color:#2563EB;color:#1D4ED8">📄 Tải phiếu (.DOCX)</button><button class="btn" id="btnExportPdf" style="border-color:#DC2626;color:#B91C1C">📕 Tải phiếu (.PDF)</button>' : ''}
          ${EXAM.showAnswersAfterSubmit ? '<button class="btn" id="btnExportResult">⬇ Tải bài làm (JSON)</button>' : ''}
          <a class="btn btn-ghost" href="index.html">← Về trang chủ</a>
        </div>
        <div id="sendStatus" class="hint" style="margin-top:10px">⏳ Đang đồng bộ điểm lên Bảng xếp hạng trực tuyến…</div>
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
            inner += `<span class="badge" style="${isKey ? 'background:#ECFDF5;border-color:#A7F3D0;color:#059669' : 'opacity:.78'}">${isKey ? '✔ ' : ''}${LETTERS[i]}: ${sanitizeHTML(op)}${isMine ? ' (em chọn)' : ''}${isMine && !isKey ? ' ✘' : ''}</span>`;
          });
          inner += `</div>`;
        } else if (q.part === 2) {
          const al = ['a', 'b', 'c', 'd'];
          inner += (q.statements || []).map((st, i) => {
            const a = Array.isArray(d.ans) ? d.ans[i] : null;
            const ok = a === st.answer;
            return `<div class="tfrow" style="border:none;padding:4px 0;background:transparent">
              <b>${al[i]})</b> <span style="flex:1">${sanitizeHTML(st.text)}</span>
              <span>đáp án: <b>${st.answer ? 'Đ' : 'S'}</b>${a === true || a === false ? ` · em chọn: <b style="color:${ok ? 'var(--ok)' : 'var(--danger)'}">${a ? 'Đ' : 'S'}</b>` : ''}</span>
            </div>`;
          }).join('');
          if (d.info && d.info.note) inner += `<div class="hint">${escapeHTML(d.info.note)}</div>`;
        } else {
          inner += `<div class="hint" style="margin-top:6px">Đáp án: <b>${escapeHTML(String(q.answer))}${q.unit ? ' ' + escapeHTML(q.unit) : ''}</b>${d.ans != null && d.ans !== '' ? ` · em nhập: <b>${escapeHTML(String(d.ans))}</b>` : ' · chưa nhập'}</div>`;
        }
        if (q.explain) inner += `<div class="explain">💡 ${sanitizeHTML(q.explain)}</div>`;
        html += `<div class="q ${cls}" style="user-select:text">${inner}</div>`;
      });
      html += '</div>';
    }
    ra.innerHTML = html;
    if ($('btnRetryWrong')) $('btnRetryWrong').onclick = () => startExam(wrongIndices);
    if ($('btnRetryAll')) $('btnRetryAll').onclick = () => startExam(null);
    if ($('btnExportDocx') && typeof PTWExport !== 'undefined') $('btnExportDocx').onclick = () => PTWExport.downloadAttemptDocx(EXAM, attempt, ORDER, res, usedSec);
    if ($('btnExportPdf') && typeof PTWExport !== 'undefined') $('btnExportPdf').onclick = () => PTWExport.downloadAttemptPdf(EXAM, attempt, ORDER, res, usedSec);
    if ($('btnExportResult')) $('btnExportResult').onclick = () => {
      const data = {
        examId: EXAM.id, title: EXAM.title,
        name: attempt.name, class: attempt.class, sbd: attempt.sbd,
        submittedAt: new Date().toISOString(),
        score: res.score, max: res.max, perPart: res.perPart,
        answers: answers,
        detail: ORDER.map(ci => res.detail[ci])
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = EXAM.id + '_' + (attempt.name || 'hs').replace(/\s+/g, '-') + '.json';
      a.click();
    };
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
      'Số câu TL': p.answered,
      'Tổng câu': p.total
    });
    PTW.ls.set('ptw_local_submissions', localList.slice(0, 500));

    // 1) Đồng bộ lên Cloud Leaderboard Realtime (hoạt động tự động cho mọi học sinh)
    let cloudOk = false;
    try {
      cloudOk = await PTW.cloud.submit(CFG, p);
      const cloudRows = await PTW.cloud.fetchExamOrAll(CFG, EXAM.id);
      renderLeaderboardBox(cloudRows, p.attemptId);
    } catch (e) {}

    // 2) Đồng bộ thêm về Google Sheet nếu có gắn appsScriptUrl
    const gsUrl = getActiveScriptUrl();
    if (gsUrl) {
      const list = PTW.ls.get('ptw_pending') || [];
      list.push(p);
      PTW.ls.set('ptw_pending', list);
      await flushPending();
    } else if (st) {
      st.innerHTML = cloudOk
        ? '<span style="color:#059669;font-weight:600">🌐 Đã ghi danh lên Bảng Xếp Hạng Trực Tuyến thành công ✓</span>'
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
      st.innerHTML = `<span style="color:#059669;font-weight:600">🌐 Đã đồng bộ lên Bảng Xếp Hạng Trực Tuyến &amp; Google Sheet ✓</span>`;
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
    $('miniTitle').textContent = EXAM.title + (attempt.mode === 'practice' ? ' · [Luyện đề]' : '');
    $('miniStudent').textContent = `${attempt.name} · ${attempt.class}`;
    buildPalette(); renderQuestion();
    clearInterval(timerId);
    timerId = setInterval(tick, 1000); tick();
  }

  boot();
})();
