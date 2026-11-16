/* Deploy together with Code.gs and generated ExamRegistry.gs. No client score is trusted. */
function safeCell_(v) {
  if (typeof v !== 'string') return v;
  return /^[\s\u0000-\u001f\u007f-\u009f]*[=+\-@＝＋－＠]/.test(v.normalize('NFKC')) ? "'" + v : v;
}
function csvCell_(v) { return '"' + String(safeCell_(v == null ? '' : v)).replace(/"/g, '""') + '"'; }
function digest_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8).map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
function fail_(code) { const e = new Error(code); e.publicCode = code; throw e; }
function text_(v, max, required) {
  if (typeof v !== 'string' || v.length > max || /[\u0000-\u001f\u007f]/.test(v)) fail_('bad_text');
  const s = v.normalize('NFC').trim();
  if (required && !s) fail_('bad_text');
  return s;
}
function scope_(pass) {
  if (typeof pass !== 'string' || !pass || pass.length > 256) return null;
  const props = PropertiesService.getScriptProperties();
  const master = props.getProperty('REPORT_PASS');
  if (master && pass === master) return { classes: null, exams: null };
  let readers;
  try { readers = JSON.parse(props.getProperty('REPORT_READERS') || '[]'); } catch (_) { return null; }
  if (!Array.isArray(readers)) return null;
  const r = readers.find(x => x && x.pass === pass);
  if (!r) return null;
  const valid = a => a === undefined || Array.isArray(a) && a.length <= 200 && a.every(s => typeof s === 'string' && s.length > 0 && s.length <= 100);
  if (!valid(r.classes) || !valid(r.exams) || r.classes === undefined && r.exams === undefined) return null;
  return { classes: r.classes === undefined ? null : r.classes, exams: r.exams === undefined ? null : r.exams };
}
function receipt_(d) {
  return { ok: true, saved: true, attemptId: d.attemptId, examId: d.examId, revision: d.revision, receiptToken: d.receiptToken, score: d.score, max: d.max };
}
function stashCapability_(nonce, value) {
  if (!/^[a-f0-9]{64}$/.test(nonce || '')) fail_('bad_capability');
  let raw = JSON.stringify(value);
  if (Utilities.newBlob(raw).getBytes().length > 90000) raw = JSON.stringify({ ok: false, err: 'response_too_large' });
  CacheService.getScriptCache().put('report_cap_' + nonce, raw, 60);
  return json_({ ok: true, capability: nonce });
}
function validateSubmission_(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) fail_('bad_payload');
  const id = text_(p.examId, 80, true);
  const exam = typeof SERVER_EXAMS !== 'undefined' && Object.prototype.hasOwnProperty.call(SERVER_EXAMS, id) && SERVER_EXAMS[id];
  if (!exam) fail_('unknown_exam');
  if (p.revision !== exam.revision) fail_('exam_revision');
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(p.attemptId || '') || !/^[a-f0-9]{64}$/.test(p.receiptToken || '')) fail_('bad_receipt');
  const d = { examId: id, revision: exam.revision, examTitle: exam.title, attemptId: p.attemptId, receiptToken: p.receiptToken,
    name: text_(p.name, 60, true), class: text_(p.class, 20, true), sbd: text_(p.sbd || '', 20, false), code: text_(p.code || '', 20, false) };
  if ((d.name.match(/[A-Za-zÀ-ỹ]/g) || []).length < 2) fail_('bad_name');
  if (exam.code && d.code !== String(exam.code)) fail_('bad_code');
  const order = p.order;
  if (!Array.isArray(order) || !order.length || order.length > exam.questions.length || new Set(order).size !== order.length || !order.every(i => Number.isInteger(i) && i >= 0 && i < exam.questions.length)) fail_('bad_order');
  let answers;
  try { answers = typeof p.answers === 'string' ? JSON.parse(p.answers) : p.answers; } catch (_) { fail_('bad_answers'); }
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) fail_('bad_answers');
  if (!Object.keys(answers).every(k => /^(0|[1-9]\d*)$/.test(k) && order.indexOf(Number(k)) >= 0)) fail_('bad_answers');
  const canonical = {}, detail = {}, per = { part1: 0, part2: 0, part3: 0 }, sc = exam.scoring;
  let score = 0, max = 0, answered = 0;
  order.slice().sort((a,b) => a-b).forEach(i => {
    const q = exam.questions[i], a = answers[i] == null ? null : answers[i];
    let got = 0, limit = 0, picked = false;
    if (q.part === 1) {
      if (a !== null && (!Number.isInteger(a) || a < 0 || a >= q.optionCount)) fail_('bad_answer');
      limit = sc.part1 == null ? 0.25 : sc.part1; picked = a !== null; got = a === q.answerIndex ? limit : 0;
    } else if (q.part === 2) {
      if (a !== null && (!Array.isArray(a) || a.length !== q.statements.length || !a.every(v => v === null || typeof v === 'boolean'))) fail_('bad_answer');
      const tiers = Array.isArray(sc.part2) && sc.part2.length === 4 ? sc.part2 : [0.1,0.25,0.5,1];
      let correct = 0, wrong = 0;
      q.statements.forEach((s,j) => { const v = a && a[j]; if (typeof v === 'boolean') { picked = true; if (v === s.answer) correct++; else wrong++; } });
      limit = tiers[3]; got = wrong && sc.strictPart2 !== false ? 0 : correct ? tiers[Math.min(correct,4)-1] : 0;
    } else {
      if (a !== null && (typeof a !== 'string' && typeof a !== 'number' || String(a).length > 100)) fail_('bad_answer');
      const t = a === null ? '' : String(a).trim().replace(/\s/g,'').replace(/,/g,'.');
      const n = t && t !== '-' && t !== '.' ? Number(t) : NaN;
      picked = isFinite(n); limit = sc.part3 == null ? 0.25 : sc.part3;
      got = picked && Math.abs(n - q.answer) <= q.tolerance + 1e-9 ? limit : 0;
    }
    canonical[i] = a; detail['Q'+(i+1)] = got;
    score += got; max += limit; per['part'+q.part] += got; if (picked) answered++;
  });
  const boundedInt = (v, cap) => { if (!Number.isInteger(v) || v < 0 || v > cap) fail_('bad_counter'); return v; };
  d.timeUsedSec = boundedInt(p.timeUsedSec, 10000000); d.timeUsedMin = Math.max(1, Math.round(d.timeUsedSec/60));
  d.exitTab = boundedInt(p.exitTab || 0, 100000); d.exitFs = boundedInt(p.exitFs || 0, 100000);
  d.ua = text_(p.ua || '', 300, false); d.ts = text_(p.ts || '', 40, false);
  d.score = Math.round(score*100)/100; d.max = max; d.pct = max ? Math.round(score/max*1000)/10 : 0;
  d.per = per; d.answered = answered; d.total = order.length; d.full = order.length === exam.questions.length;
  d.answers = JSON.stringify(canonical); d.detail = JSON.stringify(detail);
  if (d.answers.length > CELL_MAX || d.detail.length > CELL_MAX) fail_('too_large');
  d.receiptHash = digest_(d.receiptToken);
  // Include all stored, meaningful fields; omit caller-provided scores and ordering.
  d.submissionHash = digest_(JSON.stringify(d));
  return { d, exam };
}
function handlePost_(e) {
  let lock, p;
  try {
    if (!e || !e.postData || !e.postData.contents || e.postData.contents.length > 100000) fail_('bad_body');
    try { p = JSON.parse(e.postData.contents); } catch (_) { fail_('bad_json'); }
    if (p && p.nonce !== undefined && !/^[a-f0-9]{64}$/.test(p.nonce)) fail_('bad_capability');
    if (p && (p.action === 'report' || p.action === 'roster')) {
      const scope = scope_(p.pass);
      if (!scope) fail_('unauthorized');
      const result = privateRead_(p, scope);
      if (p.nonce) return stashCapability_(p.nonce, result);
      if (result && result.__csv != null) return ContentService.createTextOutput(result.__csv).setMimeType(ContentService.MimeType.TEXT);
      return json_(result);
    }
    if (p && p.action && p.action !== 'submit') fail_('bad_action');
    const validated = validateSubmission_(p), d = validated.d, exam = validated.exam;
    lock = LockService.getScriptLock(); lock.waitLock(25000);
    const sh = ensureSheet_();
    let head = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
    ['Receipt hash','Submission hash','Exam revision','Bài đầy đủ'].forEach(h => { if (head.indexOf(h) < 0) { sh.getRange(1,head.length+1).setValue(h); head.push(h); } });
    const rows = sh.getDataRange().getValues().slice(1), ix = h => head.indexOf(h);
    const same = rows.filter(r => String(r[ix('attemptId')]) === d.attemptId);
    if (same.length) {
      if (same.length !== 1 || same[0][ix('Receipt hash')] !== d.receiptHash || same[0][ix('Submission hash')] !== d.submissionHash) fail_('attempt_conflict');
      const receipt = receipt_(d);
      return p.nonce ? stashCapability_(p.nonce, receipt) : json_(receipt);
    }
    const parseTime = s => {
      if (!s) return null;
      let t = String(s).trim().replace(' ','T');
      if (/^\d{4}-\d{2}-\d{2}$/.test(t)) t += 'T00:00';
      if (!/(Z|[+-]\d{2}:?\d{2})$/.test(t)) t += '+07:00';
      const n = Date.parse(t); if (!isFinite(n)) fail_('bad_exam_policy'); return n;
    };
    const now = Date.now(), open = parseTime(exam.openAt), close = parseTime(exam.closeAt);
    if (open && now < open) fail_('exam_not_open');
    // Late offline submissions are retained locally; retries of saved attempts above remain valid.
    if (close && now >= close) fail_('exam_closed');
    const norm = s => String(s || '').normalize('NFC').trim().toLowerCase().replace(/\s+/g,' ');
    const used = rows.filter(r => r[ix('examId')] === d.examId && norm(r[ix('Họ tên')]) === norm(d.name) && norm(r[ix('Lớp')]) === norm(d.class)).length;
    if (exam.maxAttempts > 0 && used >= exam.maxAttempts) fail_('attempt_limit');
    const receipt = appendSubmission_(d, sh, d.full ? 'Máy chủ chấm lại; danh tính/thời gian do thiết bị khai báo' : 'Luyện tập một phần; không xếp hạng công khai');
    return p.nonce ? stashCapability_(p.nonce, receipt) : json_(receipt);
  } catch (err) {
    const result = { ok: false, err: err.publicCode || 'server_error' };
    if (p && /^[a-f0-9]{64}$/.test(p.nonce || '')) {
      try { return stashCapability_(p.nonce, result); } catch (_) {}
    }
    return json_(result);
  }
  finally { if (lock) try { lock.releaseLock(); } catch (_) {} }
}
