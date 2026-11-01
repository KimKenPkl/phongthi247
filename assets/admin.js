/* admin.js – Trang GV: soạn đề (3 loại câu), ngân hàng câu hỏi, xuất JSON · Phong Thi Web */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  /* Đoán môn cho trường "category" của exams.json. Sai thì sửa tay: toan, tieng-anh, hoa, ly, sinh, tin, su, gdqp, van */
  function guessCategory(id, title) {
    const s = (String(id || '') + ' ' + String(title || '')).toLowerCase();
    const rules = [['ly', /vật l[íý]|\bly\d/], ['sinh', /sinh học|sinh\d|-sinh/], ['tin', /tin học|tin\d/], ['su', /lịch sử|su\d/],
      ['gdqp', /gdqp|quốc phòng/], ['van', /ngữ văn|van\d/], ['tieng-anh', /tiếng anh|ta\d|tieng-anh/], ['toan', /toán|toan/], ['hoa', /hóa|hoá|hoa/]];
    for (const [k, re] of rules) if (re.test(s)) return k;
    return 'hoa';
  }
  const PARTS = [
    { part: 1, label: 'PHẦN I – TRẮC NGHIỆM NHIỀU LỰA CHỌN', hint: 'Mỗi câu có 4 phương án A, B, C, D – chỉ chọn 1 đáp án đúng.' },
    { part: 2, label: 'PHẦN II – TRẮC NGHIỆM ĐÚNG SAI', hint: 'Mỗi câu có 4 ý a), b), c), d) – tại mỗi ý thí sinh chọn Đúng hoặc Sai.' },
    { part: 3, label: 'PHẦN III – TRẮC NGHIỆM TRẢ LỜI NGẮN', hint: 'Thí sinh điền kết quả vào ô trống.' }
  ];
  function blank() {
    return {
      schema: 1, id: '', title: '', subject: '', code: '', durationMin: 45,
      shuffleQuestions: true, shuffleOptions: true, showAnswersAfterSubmit: true,
      scoring: { strictPart2: true, part1: 0.25, part2: [0.1, 0.25, 0.5, 1], part3: 0.25 },
      parts: JSON.parse(JSON.stringify(PARTS)), questions: []
    };
  }
  let EX, BANK = [], editingIdx = null;

  function slugify(s) {
    return String(s || '').toLowerCase().replace(/đ/g, 'd')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60);
  }
  function stripTags(h) { return String(h || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
  function save() { PTW.ls.set('ptw_admin_draft', EX); }

  /* ---------- Thông tin đề ---------- */
  function fillMeta() {
    $('fTitle').value = EX.title || '';
    $('fSubject').value = EX.subject || '';
    $('fId').value = EX.id || '';
    $('fCode').value = EX.code || '';
    $('fDur').value = EX.durationMin || 45;
    $('fShufQ').checked = EX.shuffleQuestions !== false;
    $('fShufO').checked = EX.shuffleOptions !== false;
    $('fShowKey').checked = EX.showAnswersAfterSubmit !== false;
    $('fStrict').checked = !!(EX.scoring && EX.scoring.strictPart2);
    $('fOpenAt').value = (EX.openAt || '').slice(0, 16);
    $('fCloseAt').value = (EX.closeAt || '').slice(0, 16);
    $('fMaxAtt').value = EX.maxAttempts || 0;
    $('fHideKey').checked = !!EX.hideKeyUntilClose;
  }
  // Chỉ ghi trường lịch vào JSON khi có giá trị, để đề luyện tự do giữ nguyên như cũ.
  function setOpt(k, v) { if (v) EX[k] = v; else delete EX[k]; save(); }
  function bindMeta() {
    $('fTitle').oninput = e => { EX.title = e.target.value.trim(); if (!EX.id) { EX.id = slugify(EX.title); $('fId').value = EX.id; } save(); };
    $('fSubject').oninput = e => { EX.subject = e.target.value.trim(); save(); };
    $('fId').oninput = e => { EX.id = slugify(e.target.value); e.target.value = EX.id; save(); };
    $('fCode').oninput = e => { EX.code = e.target.value.trim().toUpperCase(); e.target.value = EX.code; save(); };
    $('fDur').oninput = e => { EX.durationMin = Math.max(1, +e.target.value || 45); save(); };
    $('fShufQ').onchange = e => { EX.shuffleQuestions = e.target.checked; save(); };
    $('fShufO').onchange = e => { EX.shuffleOptions = e.target.checked; save(); };
    $('fShowKey').onchange = e => { EX.showAnswersAfterSubmit = e.target.checked; save(); };
    $('fStrict').onchange = e => { EX.scoring.strictPart2 = e.target.checked; save(); };
    $('fOpenAt').onchange = e => setOpt('openAt', e.target.value);
    $('fCloseAt').onchange = e => setOpt('closeAt', e.target.value);
    $('fMaxAtt').oninput = e => setOpt('maxAttempts', Math.max(0, Math.floor(+e.target.value || 0)));
    $('fHideKey').onchange = e => setOpt('hideKeyUntilClose', e.target.checked);
  }

  /* ---------- Danh sách câu ---------- */
  function partMeta(q) {
    if (q.part === 1) return q.answerIndex == null ? '<span style="color:#B45309;font-weight:600">⚠ chưa có đáp án</span>' : 'Đáp án: <b>' + 'ABCD'[q.answerIndex] + '</b>';
    if (q.part === 2) return 'Đ/S: ' + (q.statements || []).map(s => s.answer ? 'Đ' : 'S').join('');
    return 'Đáp án: <b>' + escapeHTML(String(q.answer)) + '</b>' + (q.unit ? ' ' + escapeHTML(q.unit) : '');
  }
  function renderList() {
    $('qCount').textContent = EX.questions.length;
    $('qList').innerHTML = EX.questions.map((q, i) => `
      <div class="row" style="align-items:flex-start;border-bottom:1px dashed var(--line);padding:8px 0">
        <b style="min-width:40px">#${i + 1}</b><span class="badge">P${q.part}</span>
        <div style="flex:1;min-width:0"><div>${escapeHTML(stripTags(q.content)).slice(0, 120) || '<i>(trống)</i>'}</div><div class="hint">${partMeta(q)}</div></div>
        <button class="btn" data-act="up" data-i="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn" data-act="down" data-i="${i}" ${i === EX.questions.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="btn" data-act="edit" data-i="${i}">✎</button>
        <button class="btn btn-danger" data-act="del" data-i="${i}">✕</button>
      </div>`).join('') || '<p class="hint">Chưa có câu nào – bấm một nút “＋” ở trên để thêm câu đầu tiên.</p>';
    $('qList').querySelectorAll('button[data-act]').forEach(b => b.onclick = () => {
      const i = +b.dataset.i, act = b.dataset.act;
      if (act === 'edit') openEditor(EX.questions[i].part, EX.questions[i]);
      if (act === 'up' && i > 0) { const t = EX.questions[i - 1]; EX.questions[i - 1] = EX.questions[i]; EX.questions[i] = t; save(); renderList(); }
      if (act === 'down' && i < EX.questions.length - 1) { const t = EX.questions[i + 1]; EX.questions[i + 1] = EX.questions[i]; EX.questions[i] = t; save(); renderList(); }
      if (act === 'del' && confirm('Xóa câu #' + (i + 1) + '?')) { EX.questions.splice(i, 1); save(); renderList(); }
    });
  }

  /* ---------- Editor câu hỏi ---------- */
  function openEditor(t, q) {
    editingIdx = q ? EX.questions.indexOf(q) : null;
    const card = $('editCard');
    card.style.display = '';
    const st = i => (q && q.statements && q.statements[i]) || null;
    card.innerHTML = `
      <h3 style="margin-top:0">${q ? '✎ Sửa câu #' + (editingIdx + 1) : '＋ Thêm câu mới'}</h3>
      <div class="grid2">
        <div class="field"><label>Loại câu</label>
          <select id="eType">
            <option value="1"${t === 1 ? ' selected' : ''}>Phần I – 4 lựa chọn (0,25 đ)</option>
            <option value="2"${t === 2 ? ' selected' : ''}>Phần II – Đúng/Sai 4 ý (QĐ 764)</option>
            <option value="3"${t === 3 ? ' selected' : ''}>Phần III – Trả lời ngắn (0,25 đ)</option>
          </select></div>
        <div class="field"><label>Ảnh (đường dẫn, tùy chọn)</label><input id="eImg" value="${escapeHTML(q && q.image || '')}" placeholder="data/img/ten-anh.png"></div>
      </div>
      <div class="field"><label>Nội dung câu hỏi (hỗ trợ thẻ &lt;sub&gt;, &lt;sup&gt;, &lt;b&gt;, &lt;i&gt;)</label><textarea id="eContent" rows="3">${escapeHTML(q && q.content || '')}</textarea></div>
      <div id="sec1" style="display:${t === 1 ? '' : 'none'}">
        <div class="grid2">
          ${[0, 1, 2, 3].map(i => `<div class="field"><label>Phương án ${'ABCD'[i]}</label><input id="eo${i}" value="${escapeHTML(q && q.options && q.options[i] || '')}"></div>`).join('')}
        </div>
        <div class="field"><label>Đáp án đúng</label><div class="row">${[0, 1, 2, 3].map(i => `<label style="margin-right:14px"><input type="radio" name="eAns" value="${i}"${q ? (q.answerIndex === i ? ' checked' : '') : (i === 0 ? ' checked' : '')}> ${'ABCD'[i]}</label>`).join('')}</div></div>
      </div>
      <div id="sec2" style="display:${t === 2 ? '' : 'none'}">
        ${[0, 1, 2, 3].map(i => `<div class="field"><label>Ý ${'abcd'[i]}) nội dung</label>
          <input id="es${i}" value="${escapeHTML(st(i) ? st(i).text : '')}">
          <div class="row">
            <label><input type="radio" name="eTs${i}" value="1"${!st(i) || st(i).answer !== false ? ' checked' : ''}> Đúng</label>
            <label><input type="radio" name="eTs${i}" value="0"${st(i) && st(i).answer === false ? ' checked' : ''}> Sai</label>
          </div></div>`).join('')}
      </div>
      <div id="sec3" style="display:${t === 3 ? '' : 'none'}">
        <div class="grid2">
          <div class="field"><label>Đáp án (số)</label><input id="eAns" value="${escapeHTML(q && q.answer != null ? String(q.answer) : '')}" placeholder="VD: 40 hoặc 0,25"></div>
          <div class="field"><label>Dung sai ±</label><input id="eTol" value="${escapeHTML(q && q.tolerance != null ? String(q.tolerance) : '0')}"></div>
        </div>
        <div class="field"><label>Đơn vị (tùy chọn)</label><input id="eUnit" value="${escapeHTML(q && q.unit || '')}" placeholder="%, mol/L…"></div>
      </div>
      <div class="field"><label>Giải thích (hiện sau khi nộp, tùy chọn)</label><textarea id="eExplain" rows="2">${escapeHTML(q && q.explain || '')}</textarea></div>
      <div class="row"><button class="btn btn-primary" id="btnSaveQ">💾 Lưu câu vào đề</button><button class="btn btn-ghost" id="btnCancelQ">Hủy</button><span id="editErr" class="err"></span></div>`;
    $('eType').onchange = e => {
      const v = +e.target.value;
      $('sec1').style.display = v === 1 ? '' : 'none';
      $('sec2').style.display = v === 2 ? '' : 'none';
      $('sec3').style.display = v === 3 ? '' : 'none';
    };
    $('btnSaveQ').onclick = () => {
      let nx;
      try { nx = buildQ(); } catch (err) { $('editErr').textContent = '⚠ ' + err.message; return; }
      if (editingIdx == null) EX.questions.push(nx); else EX.questions[editingIdx] = nx;
      editingIdx = null; card.style.display = 'none'; card.innerHTML = '';
      save(); renderList();
    };
    $('btnCancelQ').onclick = () => { editingIdx = null; card.style.display = 'none'; card.innerHTML = ''; };
    card.scrollIntoView({ behavior: 'smooth' });
  }

  function buildQ() {
    const t = +$('eType').value, content = $('eContent').value.trim();
    if (!content) throw new Error('Chưa nhập nội dung câu hỏi.');
    let q;
    if (t === 1) {
      const opts = [0, 1, 2, 3].map(i => $('eo' + i).value.trim());
      if (opts.some(o => !o)) throw new Error('Cần nhập đủ 4 phương án.');
      const sel = document.querySelector('input[name="eAns"]:checked');
      q = { part: 1, content, options: opts, answerIndex: +sel.value };
    } else if (t === 2) {
      const sts = [0, 1, 2, 3].map(i => ({ text: $('es' + i).value.trim(), answer: document.querySelector('input[name="eTs' + i + '"]:checked').value === '1' }));
      if (sts.some(s => !s.text)) throw new Error('Phần II cần nhập nội dung đủ 4 ý.');
      q = { part: 2, content, statements: sts };
    } else {
      const ans = parseNumVN($('eAns').value);
      if (ans == null) throw new Error('Phần III cần đáp án dạng số (dùng dấu phẩy thập phân, VD 0,25).');
      q = { part: 3, content, answer: ans, tolerance: parseNumVN($('eTol').value) || 0, unit: $('eUnit').value.trim() };
    }
    const ex = $('eExplain').value.trim();
    if (ex) q.explain = ex;
    const img = $('eImg').value.trim();
    if (img) q.image = img;
    return q;
  }

  /* ---------- Ngân hàng câu hỏi ---------- */
  async function bindBank() {
    const sel = $('selBank');
    let files = [];
    try { const idx = await loadJSON('../data/bank/index.json'); files = (idx && idx.files) || []; } catch (e) {}
    if (!files.length) {
      sel.style.display = 'none';
      $('bankTool').innerHTML = '<p class="hint" style="padding:12px">Chưa có ngân hàng câu hỏi – chạy <code>python scripts/import_neopentan.py</code> rồi commit thư mục <code>data/bank/</code>.</p>';
      $('btnBankAdd').disabled = true; $('btnBankRandom').disabled = true; return;
    }
    sel.innerHTML = files.map(f => `<option value="${escapeHTML(f.file)}">${escapeHTML(f.title)} (${f.count} câu)</option>`).join('');
    sel.onchange = () => reloadBank();
    $('inpBankSearch').oninput = () => renderBank();
    $('btnBankAdd').onclick = () => addBankItems([...document.querySelectorAll('.bankChk')].filter(c => c.checked).map(c => +c.dataset.i));
    $('btnBankRandom').onclick = () => addBankRandom(12);
    await reloadBank();
  }
  async function reloadBank() {
    try {
      const data = await loadJSON('../data/bank/' + encodeURIComponent($('selBank').value));
      BANK = (data && data.questions) || [];
      $('inpBankSearch').value = '';
      renderBank();
    } catch (e) {
      BANK = [];
      $('bankTool').innerHTML = '<p class="err" style="padding:12px">Không tải được ngân hàng.</p>';
    }
  }
  function bankFiltered() {
    const k = ($('inpBankSearch').value || '').trim().toLowerCase();
    return BANK.map((q, i) => ({ q, i })).filter(x => !k || stripTags(x.q.content).toLowerCase().indexOf(k) >= 0);
  }
  function renderBank() {
    const rows = bankFiltered();
    $('bankTool').innerHTML = rows.length ? rows.map(x => `
      <label class="row" style="border-bottom:1px dashed var(--line);padding:6px 10px;align-items:center">
        <input type="checkbox" class="bankChk" data-i="${x.i}">
        <b style="min-width:54px">#${x.i + 1}</b>
        <div style="flex:1;min-width:0">${escapeHTML(stripTags(x.q.content)).slice(0, 150)}</div>
        <span class="badge">${x.q.answerIndex != null ? '✔ có đáp án' : '⚠ thiếu đáp án'}</span>
      </label>`).join('') : '<p class="hint" style="padding:12px">Không có câu nào khớp.</p>';
  }
  function addBankItems(list) {
    let added = 0;
    list.forEach(i => {
      const src = BANK[i];
      if (!src || !src.content) return;
      EX.questions.push(JSON.parse(JSON.stringify(src)));
      added++;
    });
    save(); renderList();
    $('bankMsg').textContent = 'Đã thêm ' + added + ' câu.';
    setTimeout(() => { $('bankMsg').textContent = ''; }, 2500);
  }
  function addBankRandom(n) {
    const cand = bankFiltered().filter(x => x.q.answerIndex != null);
    const picks = [];
    while (picks.length < n && cand.length) picks.push(cand.splice(Math.floor(Math.random() * cand.length), 1)[0].i);
    addBankItems(picks);
  }

  /* ---------- Validate + Xuất/nhập ---------- */
  function validate() {
    const errs = [];
    if (!EX.title) errs.push('Tiêu đề đề thi còn trống.');
    if (!EX.id) errs.push('Chưa có ID đề (tên file).');
    const o = parseVNTime(EX.openAt), c = parseVNTime(EX.closeAt);
    if (o && c && c <= o) errs.push('Giờ đóng đề phải sau giờ mở đề.');
    if (EX.hideKeyUntilClose && !c) errs.push('Đã chọn "Ẩn đáp án đến giờ đóng đề" nhưng chưa đặt giờ đóng: học sinh sẽ không bao giờ thấy đáp án.');
    EX.questions.forEach((q, i) => {
      const tag = 'Câu #' + (i + 1);
      if (!q.content) errs.push(tag + ': chưa có nội dung.');
      if (q.part === 1) {
        if (!Array.isArray(q.options) || q.options.length !== 4) errs.push(tag + ': cần đúng 4 phương án.');
        else if (q.answerIndex == null) errs.push(tag + ': chưa chọn đáp án đúng.');
      } else if (q.part === 2) {
        const s = q.statements || [];
        if (s.length !== 4) errs.push(tag + ': Phần II cần đủ 4 ý.');
        else if (s.some(x => !x.text)) errs.push(tag + ': có ý trống nội dung.');
      } else if (q.part === 3) {
        if (q.answer == null || isNaN(Number(q.answer))) errs.push(tag + ': chưa có đáp án số.');
      } else errs.push(tag + ': loại câu không hợp lệ.');
    });
    return errs;
  }
  function bindIO() {
    $('btnExport').onclick = () => {
      const errs = validate(), v = $('valReport');
      if (errs.length) { v.style.display = ''; v.innerHTML = '<b>⚠ Sửa trước khi phát hành:</b><br>' + errs.map(x => '• ' + escapeHTML(x)).join('<br>'); }
      else v.style.display = 'none';
      const id = EX.id || slugify(EX.title) || 'de-moi';
      const blob = new Blob([JSON.stringify(EX, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = id + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      const entry = { id, title: EX.title, category: guessCategory(id, EX.title), subject: EX.subject || '', count: EX.questions.length, durationMin: EX.durationMin, code: EX.code || '', hasPassword: !!EX.code, desc: '' };
      ['openAt', 'closeAt', 'maxAttempts', 'hideKeyUntilClose'].forEach(k => { if (EX[k]) entry[k] = EX[k]; });
      $('examsEntry').textContent = JSON.stringify(entry, null, 2);
    };
    $('btnShowSnippet').onclick = () => { const p = $('examsEntry'); p.style.display = p.style.display === 'none' ? '' : 'none'; };
    $('btnCopySnippet').onclick = () => {
      const t = $('examsEntry').textContent || '';
      if (!t) { $('examsEntry').textContent = 'Bấm “Tải file” trước để tạo mục JSON.'; $('examsEntry').style.display = ''; return; }
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => {
        $('btnCopySnippet').textContent = '✓ Đã copy';
        setTimeout(() => { $('btnCopySnippet').textContent = '📋 Copy mục exams.json'; }, 1500);
      });
    };
    $('fileImport').onchange = async e => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data || !Array.isArray(data.questions)) throw new Error('không có mảng "questions"');
        EX = data;
        EX.scoring = Object.assign({ strictPart2: true, part1: 0.25, part2: [0.1, 0.25, 0.5, 1], part3: 0.25 }, EX.scoring || {});
        if (!Array.isArray(EX.parts) || !EX.parts.length) EX.parts = JSON.parse(JSON.stringify(PARTS));
        save(); fillMeta(); renderList();
      } catch (err) { alert('File JSON không đọc được: ' + err.message); }
      e.target.value = '';
    };
  }

  /* ---------- Nhập đề từ Word / văn bản (assets/import-docx.js) ---------- */
  let IMP = null;
  function bindImport() {
    const msg = t => { $('impMsg').textContent = t; };
    $('impShowText').onclick = () => { const b = $('impTextBox'); b.style.display = b.style.display === 'none' ? '' : 'none'; };
    $('impFile').onchange = async e => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      if (/\.doc$/i.test(f.name)) { msg('File .doc cũ: mở bằng Word → Lưu thành (Save As) → .docx rồi chọn lại.'); return; }
      if (!window.PTWImport || typeof DecompressionStream === 'undefined') { msg('Trình duyệt quá cũ – dùng Chrome/Edge/Firefox bản mới.'); return; }
      msg('Đang đọc ' + f.name + '…');
      try {
        IMP = await PTWImport.parseDocx(await f.arrayBuffer());
        IMP.name = f.name.replace(/\.docx$/i, '');
        msg(''); showImport();
      } catch (err) { msg('Không đọc được file: ' + err.message); }
    };
    $('impParseText').onclick = () => {
      const t = $('impText').value;
      if (!t.trim()) { msg('Chưa dán nội dung.'); return; }
      IMP = PTWImport.parseText(t); IMP.name = '';
      msg(''); showImport();
    };
  }
  function previewQ(q, i, warns) {
    const L = 'ABCD';
    let body = '';
    if (q.part === 1) body = q.options.map((o, k) => `<div${k === q.answerIndex ? ' style="color:var(--ok);font-weight:700"' : ''}>${L[k]}. ${sanitizeHTML(o) || '<i class="tag-bad">(trống)</i>'}${k === q.answerIndex ? ' ✓' : ''}</div>`).join('');
    else if (q.part === 2) body = q.statements.map((s, k) => `<div>${'abcd'[k]}) ${sanitizeHTML(s.text) || '<i class="tag-bad">(trống)</i>'} → <b class="${s.answer ? 'tag-ok' : 'tag-bad'}">${s.answer ? 'Đúng' : 'Sai'}</b></div>`).join('');
    else body = `<div>Đáp số: <b>${escapeHTML(String(q.answer))}</b>${q.tolerance ? ' (± ' + escapeHTML(String(q.tolerance)) + ')' : ''}</div>`;
    return `<div style="border-bottom:1px dashed var(--line);padding:8px 0${warns.length ? ';background:var(--warn-soft)' : ''}">
      <div><b>#${i + 1}</b> <span class="badge">P${q.part}</span> ${sanitizeHTML(q.content) || '<i class="tag-bad">(thiếu nội dung)</i>'}</div>
      <div style="padding-left:18px;margin-top:4px">${body}</div>
      ${q.explain ? `<div class="hint" style="padding-left:18px">💡 ${sanitizeHTML(q.explain)}</div>` : ''}
      ${warns.map(w => `<div style="color:var(--warn);padding-left:18px">⚠ ${escapeHTML(w)}</div>`).join('')}
    </div>`;
  }
  function showImport() {
    const r = IMP, s = r.stats, box = $('impPreview');
    const byQ = {}, general = [];
    r.warnings.forEach(w => { if (w.i < 0) general.push(w.msg); else (byQ[w.i] = byQ[w.i] || []).push(w.msg); });
    const nWarnQ = Object.keys(byQ).length;
    const list = () => r.questions.map((q, i) => (!$('impOnlyWarn').checked || byQ[i]) ? previewQ(q, i, byQ[i] || []) : '').join('');
    box.style.display = '';
    box.innerHTML = `
      <div class="banner ${nWarnQ || general.length ? 'banner-warn' : 'banner-info'}">
        Nhận được <b>${s.total}</b> câu: Phần I ${s.p1} · Phần II ${s.p2} · Phần III ${s.p3}${s.images ? ` · ${s.images} ảnh` : ''}.
        ${nWarnQ ? `<b>${nWarnQ}</b> câu cần xem lại (tô vàng).` : 'Không có câu nào cần xem lại.'}
        ${general.map(g => '<div>⚠ ' + escapeHTML(g) + '</div>').join('')}
      </div>
      <div class="row" style="margin:8px 0;flex-wrap:wrap">
        <button class="btn btn-primary" id="impAppend" ${s.total ? '' : 'disabled'}>＋ Thêm vào cuối đề</button>
        <button class="btn btn-ghost" id="impReplace" ${s.total ? '' : 'disabled'}>⟳ Thay toàn bộ câu trong đề</button>
        <label><input type="checkbox" id="impOnlyWarn"> Chỉ xem câu có cảnh báo</label>
        <div class="spacer"></div>
        <button class="btn" id="impClose">✕ Đóng</button>
      </div>
      <div id="impList" style="max-height:480px;overflow:auto;border:1px solid var(--line);border-radius:10px;background:#fff;padding:0 10px"></div>`;
    $('impList').innerHTML = list();
    $('impOnlyWarn').onchange = () => { $('impList').innerHTML = list(); };
    $('impClose').onclick = () => { box.style.display = 'none'; box.innerHTML = ''; IMP = null; };
    const apply = replace => {
      if (replace && EX.questions.length && !confirm(`Xóa ${EX.questions.length} câu đang có và thay bằng ${s.total} câu vừa nhập?`)) return;
      const base = replace ? 0 : EX.questions.length;
      const add = JSON.parse(JSON.stringify(r.questions));
      EX.questions = replace ? add : EX.questions.concat(add);
      if (!EX.title && r.name) { EX.title = r.name; if (!EX.id) EX.id = slugify(r.name); fillMeta(); }
      save(); renderList();
      const size = JSON.stringify(EX).length;
      const warnIdx = Object.keys(byQ).map(k => '#' + (base + +k + 1));
      box.innerHTML = `<div class="banner banner-info">✓ Đã thêm ${s.total} câu.${warnIdx.length ? ' Bấm ✎ để sửa các câu: ' + warnIdx.join(', ') + '.' : ''}${size > 4e6 ? '<br>⚠ Đề nặng ' + (size / 1e6).toFixed(1) + ' MB – trình duyệt có thể không lưu được bản nháp; hãy bấm “Tải file” ngay.' : ''}</div>`;
      IMP = null;
    };
    $('impAppend').onclick = () => apply(false);
    $('impReplace').onclick = () => apply(true);
  }

  (async function main() {
    EX = PTW.ls.get('ptw_admin_draft') || blank();
    bindMeta(); fillMeta(); renderList(); bindIO(); bindImport();
    await bindBank();
  })();
})();
