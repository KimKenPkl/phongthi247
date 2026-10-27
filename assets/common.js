/* common.js – Tiện ích dùng chung + ENGINE CHẤM ĐIỂM theo QĐ 764/QĐ-BGDĐT 2024
 * + CLOUD REALTIME LEADERBOARD & XẾP HẠNG TREO THƯỞNG · Kimkenpkl
 */

async function loadJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('Không tải được: ' + url + ' (HTTP ' + r.status + ')');
  return r.json();
}

function escapeHTML(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function sanitizeHTML(s) {
  let t = String(s == null ? '' : s);
  t = t.replace(/\s(on\w+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  t = t.replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  t = t.replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi, '');
  t = t.replace(/<\s*a\b[^>]*href\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, '<a href="#"');
  return t;
}

function gradeQuestion(exam, q, ans) {
  const sc = (exam && exam.scoring) || {};
  if (q.part === 1) {
    const p = (sc.part1 != null ? sc.part1 : 0.25);
    const ok = ans === q.answerIndex;
    return { got: ok ? p : 0, max: p, correct: ok, answered: ans != null };
  }
  if (q.part === 2) {
    const tiers = Array.isArray(sc.part2) && sc.part2.length === 4 ? sc.part2 : [0.1, 0.25, 0.5, 1.0];
    const strict = sc.strictPart2 !== false;
    const sts = q.statements || [];
    let correct = 0, wrong = 0, pickedAny = false;
    sts.forEach((st, i) => {
      const v = ans && ans[i];
      if (v === true || v === false) pickedAny = true;
      if (v === st.answer) correct++;
      else if (v === true || v === false) wrong++;
    });
    let got = 0, ok = false, note = '';
    if (wrong > 0 && strict) { got = 0; note = 'Có ý chọn sai → câu này 0 điểm (chỉ được chọn chính xác).'; }
    else if (correct >= 1) { got = tiers[Math.min(correct, 4) - 1]; ok = (wrong === 0 && correct === sts.length); }
    if (!pickedAny) note = 'Chưa trả lời ý nào.';
    return { got, max: tiers[3], correct: ok, answered: pickedAny, info: { correct, wrong, note } };
  }
  if (q.part === 3) {
    const p = (sc.part3 != null ? sc.part3 : 0.25);
    const num = parseNumVN(ans);
    const answered = num !== null;
    const tol = q.tolerance != null ? q.tolerance : 0;
    const ok = answered && num !== null && Math.abs(num - q.answer) <= tol + 1e-9;
    return { got: ok ? p : 0, max: p, correct: ok, answered, info: { expected: q.answer } };
  }
  return { got: 0, max: 0, correct: false, answered: false };
}

function gradeExam(exam, answers) {
  const qs = exam.questions || [];
  const detail = []; let score = 0; let max = 0; let nAnswered = 0;
  const parts = exam.parts || [];
  const perPart = parts.map(p => ({ part: p.part, got: 0, max: 0 }));
  qs.forEach((q, i) => {
    const a = answers && answers[i] !== undefined ? answers[i] : null;
    const r = gradeQuestion(exam, q, a);
    score += r.got; max += r.max;
    if (r.answered) nAnswered++;
    const pp = perPart.find(x => x.part === q.part);
    if (pp) { pp.got += r.got; pp.max += r.max; }
    detail.push({ no: i + 1, part: q.part, got: r.got, max: r.max, correct: r.correct, answered: r.answered, info: r.info, q, ans: a });
  });
  return { score, max, perPart, detail, nAnswered, nQuestions: qs.length };
}

function parseNumVN(s) {
  if (s == null) return null;
  let t = String(s).trim().replace(/\s/g, '').replace(/,/g, '.');
  if (t === '' || t === '-' || t === '.') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffled(arr, seedFn) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(seedFn() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
function fmtDuration(sec) {
  sec = Math.max(1, Math.round(+sec || 0));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}p ${String(s).padStart(2, '0')}s` : `${s}s`;
}
function fmtScore(x) {
  return (Math.round((+x || 0) * 100) / 100).toFixed(2).replace('.', ',');
}
function fmtDateTime(d) {
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString('vi-VN');
}

const PTW = {
  ls: {
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } }
  },
  uuid() { return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9); },

  /* Chuẩn hóa & Xếp hạng danh sách bài nộp:
   * Ưu tiên: Điểm cao nhất → Thời gian làm nhanh nhất (timeUsedSec) → Ít rời tab nhất (exitTab)
   */
  rankRows(rows, bestPerStudent = true) {
    const norm = (rows || []).map(r => {
      const score = +(r.score != null ? r.score : r['Điểm']) || 0;
      const max = +(r.max != null ? r.max : r['Tối đa']) || 10;
      const pct = r.pct != null ? +r.pct : (r['%'] != null ? +r['%'] : (max ? Math.round(score / max * 1000) / 10 : 0));
      const sec = +(r.timeUsedSec != null ? r.timeUsedSec : (r['Làm/giây'] != null ? r['Làm/giây'] : ((+(r.timeUsedMin || r['Làm/phút']) || 1) * 60)));
      const exitTab = +(r.exitTab != null ? r.exitTab : r['Rời tab']) || 0;
      const name = String(r.name || r['Họ tên'] || '').trim();
      const clazz = String(r.class || r['Lớp'] || '').trim();
      const examId = String(r.examId || '').trim();
      const examTitle = String(r.examTitle || r['Tên đề'] || examId).trim();
      const ts = r.ts || r['Thời điểm nộp'] || '';
      const attemptId = r.attemptId || (name + '|' + clazz + '|' + score + '|' + sec + '|' + ts);
      return {
        ...r,
        attemptId, examId, examTitle, name, class: clazz,
        score, max, pct, timeUsedSec: sec,
        timeUsedMin: Math.max(1, Math.round(sec / 60)),
        exitTab,
        'Thời điểm nộp': r['Thời điểm nộp'] || (r.ts ? fmtDateTime(new Date(r.ts)) : ''),
        'Tên đề': examTitle,
        'Mã phòng': r.code || r['Mã phòng'] || '',
        'Họ tên': name,
        'Lớp': clazz,
        'SBD': r.sbd || r['SBD'] || '',
        'Điểm': score,
        'Tối đa': max,
        '%': pct,
        'P1': (r.per && r.per.part1 != null) ? r.per.part1 : (+(r['P1']) || 0),
        'P2': (r.per && r.per.part2 != null) ? r.per.part2 : (+(r['P2']) || 0),
        'P3': (r.per && r.per.part3 != null) ? r.per.part3 : (+(r['P3']) || 0),
        'Làm/phút': fmtDuration(sec),
        'Làm/giây': sec,
        'Rời tab': exitTab,
        'Thoát FS': +(r.exitFs != null ? r.exitFs : r['Thoát FS']) || 0,
        'Số câu TL': r.answered != null ? r.answered : (r['Số câu TL'] || ''),
        'Tổng câu': r.total != null ? r.total : (r['Tổng câu'] || ''),
        'Nguồn': r['Nguồn'] || '🌐 Cloud'
      };
    });

    // Khử trùng lặp theo attemptId
    const seenAttempt = new Set();
    const uniqueAttempts = [];
    norm.forEach(item => {
      if (!item.name) return;
      if (seenAttempt.has(item.attemptId)) return;
      seenAttempt.add(item.attemptId);
      uniqueAttempts.push(item);
    });

    // Sắp xếp theo Điểm cao nhất -> Thời gian giây thấp nhất -> Ít rời tab nhất
    uniqueAttempts.sort((a, b) => {
      if (Math.abs(b.score - a.score) > 1e-6) return b.score - a.score;
      if (a.timeUsedSec !== b.timeUsedSec) return a.timeUsedSec - b.timeUsedSec;
      return a.exitTab - b.exitTab;
    });

    let finalRows = uniqueAttempts;
    if (bestPerStudent) {
      const seenStudent = new Set();
      finalRows = [];
      uniqueAttempts.forEach(item => {
        const key = (item.examId + '|' + item.name.toLowerCase().replace(/\s+/g, ' ') + '|' + item.class.toLowerCase().replace(/\s+/g, '')).trim();
        if (seenStudent.has(key)) return;
        seenStudent.add(key);
        finalRows.push(item);
      });
    }

    return finalRows.map((item, idx) => ({
      ...item,
      rank: idx + 1,
      'Hạng': idx + 1
    }));
  },

  cloud: {
    async fetchBucket(baseUrl, bucketId) {
      if (!baseUrl || !bucketId) return [];
      const r = await fetch(`${baseUrl}/${bucketId}?t=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      return (j && j.data && Array.isArray(j.data.submissions)) ? j.data.submissions : [];
    },

    async pushToBucket(baseUrl, bucketId, bucketName, entry) {
      if (!baseUrl || !bucketId) return false;
      const cur = await this.fetchBucket(baseUrl, bucketId).catch(() => []);
      const compact = {
        attemptId: entry.attemptId,
        ts: entry.ts,
        examId: entry.examId,
        examTitle: entry.examTitle,
        code: entry.code,
        name: entry.name,
        class: entry.class,
        sbd: entry.sbd,
        score: entry.score,
        max: entry.max,
        pct: entry.pct,
        per: entry.per,
        answered: entry.answered,
        total: entry.total,
        timeUsedSec: entry.timeUsedSec,
        timeUsedMin: entry.timeUsedMin,
        exitTab: entry.exitTab,
        exitFs: entry.exitFs
      };
      const filtered = cur.filter(x => x && x.attemptId !== compact.attemptId);
      filtered.unshift(compact);
      // Giữ tối đa 400 bài điểm cao nhất trong mỗi bucket
      filtered.sort((a, b) => ((+b.score || 0) - (+a.score || 0)) || ((+a.timeUsedSec || 99999) - (+b.timeUsedSec || 99999)));
      const trimmed = filtered.slice(0, 400);
      const putRes = await fetch(`${baseUrl}/${bucketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: bucketName, data: { submissions: trimmed, updatedAt: new Date().toISOString() } })
      });
      return putRes.ok;
    },

    async submit(cfg, entry) {
      if (!cfg || !cfg.cloudApiBase || !cfg.cloudBuckets) return false;
      const base = cfg.cloudApiBase;
      const bExam = cfg.cloudBuckets[entry.examId];
      const bAll = cfg.cloudBuckets.ALL;
      const tasks = [];
      if (bExam) tasks.push(this.pushToBucket(base, bExam, 'ptw247_' + entry.examId, entry));
      if (bAll) tasks.push(this.pushToBucket(base, bAll, 'ptw247_ALL', entry));
      const results = await Promise.allSettled(tasks);
      return results.some(r => r.status === 'fulfilled' && r.value === true);
    },

    async fetchExamOrAll(cfg, examId) {
      if (!cfg || !cfg.cloudApiBase || !cfg.cloudBuckets) return [];
      const base = cfg.cloudApiBase;
      const bId = (examId && cfg.cloudBuckets[examId]) ? cfg.cloudBuckets[examId] : cfg.cloudBuckets.ALL;
      const list = await this.fetchBucket(base, bId);
      return examId ? list.filter(x => x && x.examId === examId) : list;
    }
  }
};
