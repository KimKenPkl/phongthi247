/* exam.js – Phòng thi: vào bài, đối giờ, chấm tự động, gửi Google Sheet
 * Luồng: ?exam=<id> → form thông tin → fullscreen → làm bài (anti-cheat) → tự nộp/nộp bài → kết quả
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const URLP = new URLSearchParams(location.search);
  const examId = URLP.get('exam');

  let CFG = null, EXAM = null;
  let attempt = null;      // {attemptId, name, class, sbd, code, deadline, exitTab, exitFs, exitLog[], flags{}, shuffles[]}
  let answers = {};        // key = chỉ số câu gốc (canonical) → giá trị
  let ORDER = [];          // thứ tự hiển thị: displayK → canonicalIdx
  let cur = 0;             // vị trí hiển thị hiện tại
  let submitted = false;
  let timerId = null, busyModal = false;

  /* ---------- Modal ---------- */
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

  /* ---------- Boot ---------- */
  async function boot() {
    try {
      CFG = await loadJSON('data/config.json');
      EXAM = await loadJSON(`data/tests/${encodeURIComponent(examId)}.json`);
    } catch (e) {
      $('loading').innerHTML = `<div class="card banner-danger">Không tải được đề "${escapeHTML(String(examId))}".<br><small>${escapeHTML(e.message)}</small></div>
        <a class="btn" href="index.html">← Về trang chủ</a>`;
      return;
    }
    document.title = (EXAM.title || 'Phòng thi') + ' – ' + (CFG.brand || '');
    renderEnter();
    flushPending();
  }

  function renderEnter() {
    $('loading').style.display = 'none';
    $('enterArea').style.display = '';
    $('examTitle').textContent = EXAM.title;
    $('examMeta').innerHTML = `
      <span class="badge">📚 ${escapeHTML(EXAM.subject||'')}</span>
      <span class="badge">🧮 ${EXAM.questions.length} câu</span>
      <span class="badge">⏱ ${EXAM.durationMin} phút</span>`;
    $('rulesBox').innerHTML = `
      <b>Nội quy phòng thi:</b> làm bài trong chế độ toàn màn hình; rời tab/toàn màn hình sẽ được ghi lại và gửi thầy.
      Suốt ${EXAM.durationMin} phút không được nộp lại – hết giờ hệ thống tự nộp.
      ${EXAM.showAnswersAfterSubmit ? 'Nộp xong sẽ xem được đáp án + giải thích từng câu.' : 'Nộp xong chỉ hiện điểm.'}`;
    if (CFG.classes && CFG.classes.length) {
      $('classWrap').innerHTML = `<select id="inpClass">${CFG.classes.map(c=>`<option>${escapeHTML(c)}</option>`).join('')}</select>`;
    }
    $('btnStart').onclick = startExam;

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

  /* ---------- Vào phòng thi ---------- */
  function startExam() {
    const name = ($('inpName').value || '').trim();
    const clazz = ($('inpClass').value || '').trim();
    const sbd = ($('inpSbd').value || '').trim();
    const code = ($('inpCode').value || '').trim().replace(/\s+/g, '').toUpperCase();
    const err = $('enterErr');
    if (!name) { err.textContent = '⚠ Chưa điền họ tên.'; return; }
    if (!clazz) { err.textContent = '⚠ Chưa điền lớp.'; return; }
    if ((EXAM.code || '').toUpperCase() && code !== String(EXAM.code).toUpperCase()) {
      err.textContent = '⚠ Mã phòng thi chưa đúng. Em hỏi lại thầy nhé.'; return;
    }
    err.textContent = '';

    attempt = {
      attemptId: PTW.uuid(), name, class: clazz, sbd, code,
      startTs: Date.now(), deadline: Date.now() + EXAM.durationMin * 60000,
      exitTab: 0, exitFs: 0, exitLog: [], flags: {}
    };
    attempt.shuffles = buildShuffles();
    answers = {}; cur = 0; submitted = false;

    if (CFG.blockCopy) installCopyBlock();
    installCheaters();
    if (CFG.requireFullscreen) tryFullscreen();

    $('enterArea').style.display = 'none';
    $('examArea').style.display = '';
    document.body.classList.add('exam-active');
    $('miniTitle').textContent = EXAM.title;
    $('miniStudent').textContent = `${name} · ${clazz}`;
    buildPalette(); renderQuestion(); saveDraft();
    timerId = setInterval(tick, 1000); tick();
  }

  /* Shuffle ổn định theo attemptId (đề giữ nguyên cả khi reload) */
  function buildShuffles() {
    const seedFn = mulberry32(hashStr(EXAM.id + '|' + attempt.attemptId));
    const n = EXAM.questions.length;
    ORDER = Array.from({ length: n }, (_, i) => i).map(i => i);
    if (EXAM.shuffleQuestions) ORDER = shuffled(ORDER, seedFn);
    const optMaps = [];
    ORDER.forEach(ci => {
      let map = [0, 1, 2, 3].map(i => i);
      if (EXAM.shuffleOptions && EXAM.questions[ci].part === 1) map = shuffled(map, seedFn);
      optMaps.push(map);   // displayIdx → canonicalIdx
    });
    return { optMaps };
  }

  /* ---------- Render ---------- */
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
      b.classList.toggle('current', k === cur);
      b.classList.toggle('answered', isAnswered(ORDER[k]));
      b.classList.toggle('flagged', !!attempt.flags[ORDER[k]]);
    });
    $('btnFlag').textContent = attempt.flags[ORDER[cur]] ? '⚑ Bỏ đánh dấu' : '⚑ Đánh dấu xem lại';
  }
  function isAnswered(ci) {
    const q = EXAM.questions[ci], a = answers[ci];
    if (a == null) return false;
    if (q.part === 2) return Array.isArray(a) && a.some(v => v === true || v === false);
    return true;
  }

  function renderQuestion() {
    const ci = ORDER[cur], q = EXAM.questions[ci];
    const view = $('qView');
    const parts = EXAM.parts || [];
    const prev = cur > 0 ? EXAM.questions[ORDER[cur - 1]] : null;
    const head = (!prev || prev.part !== q.part) && parts.length
      ? `<div class="part-divider">${sanitizeHTML(parts.find(x=>x.part===q.part)?.label || ('PHẦN ' + q.part))}<div class="hint">${sanitizeHTML(parts.find(x=>x.part===q.part)?.hint || '')}</div></div>` : '';
    let body = '';
    if (q.part === 1) {
      const map = attempt.shuffles.optMaps[cur];
      body = map.map((canon, di) => `
        <div class="option ${answers[ci] === canon ? 'selected' : ''}" data-di="${di}">
          <b>${LETTERS[di]}.</b> <span>${sanitizeHTML(q.options[canon])}</span>
        </div>`).join('');
      body = `<p class="gray" style="font-weight:600">Câu ${cur+1}.</p>${head}${qImg(q)}${body}`;
    } else if (q.part === 2) {
      const al = ['a', 'b', 'c', 'd'];
      body = q.statements.map((st, i) => `
        <div class="tfrow">
          <b>${al[i]})</b>
          <span style="flex:1">${sanitizeHTML(st.text)}</span>
          <button class="tfbtn ${answers[ci]?.[i] === true ? 'sel-true' : ''}" data-si="${i}" data-v="1">Đ</button>
          <button class="tfbtn ${answers[ci]?.[i] === false ? 'sel-false' : ''}" data-si="${i}" data-v="0">S</button>
        </div>`).join('');
      body = `<p style="font-weight:600">Câu ${cur+1}.</p>${head}${qImg(q)}${body}`;
    } else {
      body = `
        <p style="font-weight:600">Câu ${cur+1}.</p>${head}${qImg(q)}
        <div class="row" style="margin-top:10px">
          <input class="short-input" type="text" id="shortInp" inputmode="decimal" placeholder="Kết quả"
                 value="${answers[ci] != null ? escapeHTML(String(answers[ci])) : ''}">
          ${q.unit ? `<span class="hint">${escapeHTML(q.unit)}</span>` : ''}
        </div>`;
    }
    view.innerHTML = body;
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function qImg(q) {
    return q && q.image ? `<img class="qimg" src="${escapeHTML(q.image)}" alt="hình câu hỏi">` : '';
  }

  /* ---------- đối giờ ---------- */
  function tick() {
    const left = Math.max(0, Math.round((attempt.deadline - Date.now()) / 1000));
    const t = $('timerEl');
    t.textContent = fmtClock(left);
    t.classList.toggle('low', left < 300);
    if (left === 0) { finishExam('timeup'); return; }
    if (left === 300 || left === 60) {
      modal('⏰ Còn ' + (left === 300 ? '5 phút' : '60 giây') + '!', 'Em kiểm tra và nạp nhanh nhé.', [{ label: 'OK', cls: 'btn-primary' }]);
    }
  }

  /* ---------- Anti-copy / anti-tab ---------- */
  function installCopyBlock() {
    ['copy', 'cut', 'paste'].forEach(ev => document.addEventListener(ev, e => {
      if (!submitted && $('examArea').style.display !== 'none') { e.preventDefault(); }
    }));
    document.addEventListener('contextmenu', e => {
      if (!submitted && $('examArea').style.display !== 'none') e.preventDefault();
    });
  }
  let cheatersInstalled = false;
  function installCheaters() {
    if (cheatersInstalled) return;   // không nhân đôi listener khi "tiếp tục bài dở"
    cheatersInstalled = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !submitted && attempt) {
        attempt.exitTab++;
        attempt.exitLog.push(new Date().toISOString());
        $('exitBadge').textContent = `🚩 rời tab ×${attempt.exitTab}`;
        saveDraft();
        if (CFG.maxExitWarnings && attempt.exitTab <= CFG.maxExitWarnings) {
          modal('⚠ Phát hiện rời trang!', `Em vừa rời khỏi bài thi (lần ${attempt.exitTab}). Lần rời trang sẽ được thầy ghi lại.
            Yêu cầu quay lại ngay và tiếp tục làm bài.`, [{ label: 'Đã hiểu, làm tiếp', cls: 'btn-primary', fn: () => { if (CFG.requireFullscreen) tryFullscreen(); } }]);
        }
      }
    });
    document.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      const blocked = (e.ctrlKey && e.shiftKey && 'ijcx'.includes(k)) || e.key === 'F12' || (e.ctrlKey && k === 'p' && !submitted);
      if (blocked) { e.preventDefault(); return; }
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

  /* ---------- nộp bài ---------- */
  $('btnPrev').onclick = () => { if (cur > 0) { cur--; renderQuestion(); } };
  $('btnNext').onclick = () => {
    if (cur < ORDER.length - 1) { cur++; renderQuestion(); }
    else { const k = ORDER.findIndex(ci => !isAnswered(ci)); if (k >= 0) { cur = k; renderQuestion(); } else askSubmitTotal(); }
  };
  $('btnFlag').onclick = () => { attempt.flags[ORDER[cur]] = !attempt.flags[ORDER[cur]]; syncPalette(); saveDraft(); };
  $('btnSubmit').onclick = askSubmitTotal;

  function askSubmitTotal() {
    const nLeft = ORDER.filter(ci => !isAnswered(ci)).length;
    modal('Nộp bài?', nLeft ? `⚠ Em còn ${nLeft} câu chưa trả lời. Nộp xong sẽ KHÔNG quay lại được.\nVẫn nộp?` : `Xác nhận nộp bài? Em đã làm đủ ${ORDER.length} câu.`,
      [
        { label: 'Làm tiếp' },
        { label: '✅ Nộp bài', cls: 'btn-danger', fn: () => finishExam('manual') }
      ]);
  }

  function finishExam(reason) {
    if (submitted || !attempt) return;
    submitted = true;
    document.body.classList.remove('exam-active');
    clearInterval(timerId);
    const res = gradeExam(EXAM, answers);
    const usedSec = EXAM.durationMin * 60 - Math.max(0, Math.round((attempt.deadline - Date.now()) / 1000));
    PTW.ls.del('ptw_draft_' + EXAM.id);
    renderResult(res, reason, usedSec);
    postAttempt(res, usedSec);
  }

  function renderResult(res, reason, usedSec) {
    $('examArea').style.display = 'none';
    const ra = $('resultArea'); ra.style.display = '';
    const per = res.perPart.map(x => `P${x.part}: <b>${fmtScore(x.got)}</b>/${fmtScore(x.max)}`).join(' · ');
    let html = `
      <div class="card" style="text-align:center;padding:28px">
        <div class="hint">${reason === 'timeup' ? '⏰ Hết giờ — hệ thống tự nộp bài' : '✅ Bài làm đã được nộp'}</div>
        <div style="font-size:56px;font-weight:800;color:var(--primary);letter-spacing:-1px">${fmtScore(res.score)}<span style="font-size:26px;color:var(--muted)">/${fmtScore(res.max)}</span></div>
        <div class="row" style="justify-content:center">${per}</div>
        <div class="hint" style="margin-top:8px">${res.nAnswered}/${res.nQuestions} câu được trả lời · thời gian làm: ${Math.round(usedSec / 60)} phút · rời tab ×${attempt.exitTab} · thoát fullscreen ×${attempt.exitFs}</div>
        <div class="row" style="justify-content:center;margin-top:12px">
          <button class="btn" onclick="window.print()">🖨 In kết quả</button>
          ${EXAM.showAnswersAfterSubmit ? '<button class="btn" id="btnExportResult">⬇ Tải bài làm (JSON)</button>' : ''}
          <a class="btn btn-primary" href="index.html">Về trang chủ</a>
          <button class="btn btn-ghost" id="btnRetrySend">🔁 Gửi lại điểm</button>
        </div>
        <div id="sendStatus" class="hint" style="margin-top:8px"></div>
      </div>`;

    if (EXAM.showAnswersAfterSubmit) {
      html += '<div class="result-list">';
      ORDER.forEach((ci, k) => {
        const d = res.detail[ci];
        const q = d.q;
        const cls = d.correct ? 'ok' : 'bad';
        let inner = ``;
        inner += `<strong>Câu ${k + 1}</strong> · Phần ${d.part} · ${d.got}/${d.max} đ → ${d.correct ? '<span class="tag-ok">ĐÚNG</span>' : (d.answered ? '<span class="tag-bad">SAI</span>' : '<span class="tag-bad">BỎ TRỐNG</span>')}<br>${sanitizeHTML(q.content)}`;

        if (q.part === 1) {
          inner += `<div class="row">`;
          q.options.forEach((op, i) => {
            const isKey = i === q.answerIndex;
            const isMine = d.ans === i;
            inner += `<span class="badge" style="${isKey ? 'background:#ECFDF5;border-color:#A7E3CC' : 'opacity:.75'}">${isKey ? '✔ ' : '   '}${LETTERS[i]}: ${sanitizeHTML(op)}${isMine ? ' (chọn)' : ''}${isMine && !isKey ? ' ✘' : ''}</span>`;
          });
          inner += `</div>`;
        } else if (q.part === 2) {
          const al = ['a', 'b', 'c', 'd'];
          inner += (q.statements || []).map((st, i) => {
            const a = Array.isArray(d.ans) ? d.ans[i] : null;
            const ok = a === st.answer;
            return `<div class="tfrow" style="border:none;padding:4px 0">
              <b>${al[i]})</b> <span style="flex:1">${sanitizeHTML(st.text)}</span>
              <span>đáp án: <b>${st.answer ? 'Đ' : 'S'}</b>${a === true || a === false ? ` · em chọn: <b style="color:${ok ? 'var(--ok)' : 'var(--danger)'}">${a ? 'Đ' : 'S'}</b>` : ''}</span>
            </div>`;
          }).join('');
          if (d.info && d.info.note) inner += `<div class="hint">${escapeHTML(d.info.note)}</div>`;
        } else {
          inner += `<div class="hint">Đáp án: <b>${escapeHTML(String(q.answer))}${q.unit ? ' ' + escapeHTML(q.unit) : ''}</b>${d.ans != null && d.ans !== '' ? ` · em nhập: <b>${escapeHTML(String(d.ans))}</b>` : ' · chưa nhập'}</div>`;
        }
        if (q.explain) inner += `<div class="explain">💡 ${sanitizeHTML(q.explain)}</div>`;
        html += `<div class="q ${cls}" style="user-select:text">${inner}</div>`;
      });
      html += '</div>';
    }
    ra.innerHTML = html;
    $('btnRetrySend').onclick = () => flushPending();
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

  /* ---------- gửi Google Sheet ---------- */
  function payload(res, usedSec) {
    const per = {}; res.perPart.forEach(x => { per['part' + x.part] = Math.round(x.got * 100) / 100; });
    const detail = {};
    ORDER.forEach((ci, k) => { detail['C' + (k + 1)] = res.detail[ci].got; });
    return {
      ts: new Date().toISOString(), brand: CFG.brand || '',
      examId: EXAM.id, examTitle: EXAM.title, code: attempt.code,
      attemptId: attempt.attemptId,
      name: attempt.name, class: attempt.class, sbd: attempt.sbd,
      score: Math.round(res.score * 100) / 100, max: res.max,
      pct: res.max ? Math.round(res.score / res.max * 1000) / 10 : 0,
      per: per, answered: res.nAnswered, total: res.nQuestions,
      timeUsedMin: Math.round(usedSec / 60),
      exitTab: attempt.exitTab, exitFs: attempt.exitFs,
      ua: navigator.userAgent,
      detail: JSON.stringify(detail),
      answers: JSON.stringify(answers)
    };
  }
  async function postAttempt(res, usedSec) {
    const st = $('sendStatus');
    if (!CFG.appsScriptUrl) {
      st.innerHTML = 'ℹ️ GV chưa cấu hình Google Sheet — điểm chỉ lưu trên máy này. Thầy sẽ tổng hợp sau.';
      return;
    }
    const list = PTW.ls.get('ptw_pending') || [];
    list.push(payload(res, usedSec));
    PTW.ls.set('ptw_pending', list);
    await flushPending();
  }
  async function flushPending() {
    const st = $('sendStatus') || { innerHTML: '' };
    if (!CFG || !CFG.appsScriptUrl) return;
    const list = PTW.ls.get('ptw_pending') || [];
    const remain = [];
    for (const p of list) {
      try {
        await fetch(CFG.appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // simple request → no preflight
          body: JSON.stringify(p),
          mode: 'no-cors'
        });
      } catch (e) { remain.push(p); }
    }
    PTW.ls.set('ptw_pending', remain);
    if (remain.length === 0) {
      st.innerHTML = `📡 Điểm đã gửi về Google Sheet ✓ (thầy xem ở trang report)`;
    } else {
      st.innerHTML = `⚠ Có ${remain.length} bài chưa gửi được (mạng?) — bấm "Gửi lại điểm" khi mạng ổn.`;
    }
  }

  /* ---------- draft persist ---------- */
  let draftThrottle = null;
  function saveDraftThrottled() { if (!draftThrottle) draftThrottle = setTimeout(() => { draftThrottle = null; saveDraft(); }, 800); }
  function saveDraft() {
    if (submitted || !attempt) return;
    PTW.ls.set('ptw_draft_' + EXAM.id, { attempt, answers, cur, order: ORDER });
  }

  function resumeDraft(d) {
    attempt = d.attempt; answers = d.answers || {}; cur = d.cur || 0; submitted = false;
    ORDER = Array.isArray(d.order) ? d.order : EXAM.questions.map((_, i) => i);
    if (CFG.blockCopy) installCopyBlock();
    installCheaters();
    if (CFG.requireFullscreen) tryFullscreen();
    $('enterArea').style.display = 'none';
    $('examArea').style.display = '';
    document.body.classList.add('exam-active');
    $('miniTitle').textContent = EXAM.title;
    $('miniStudent').textContent = `${attempt.name} · ${attempt.class}`;
    buildPalette(); renderQuestion();
    timerId = setInterval(tick, 1000); tick();
  }

  boot();
})();
