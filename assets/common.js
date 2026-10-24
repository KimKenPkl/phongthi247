/* common.js – Tiện ích dùng chung + ENGINE CHẤM ĐIỂM theo QĐ 764/QĐ-BGDĐT 2024
 * Phần I:  0,25 điểm/câu (đúng 1/4 phương án)
 * Phần II: mỗi câu 4 ý Đúng/Sai – chọn chính xác 1 ý 0,10; 2 ý 0,25; 3 ý 0,50; đủ 4 ý 1,00.
 *          Nếu strictPart2 = true: có BẤT KỲ ý nào chọn sai → câu đó 0 điểm (đúng tinh thần "chỉ lựa chọn chính xác").
 * Phần III: mỗi câu trả lời ngắn đúng 0,25 (cấu hình được).
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

/* Sanitizer ở mức an toàn: only a small subset tags (đề của thầy tự soạn, nhưng vẫn hạn chế) */
function sanitizeHTML(s) {
  let t = String(s == null ? '' : s);
  t = t.replace(/\s(on\w+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');   // bỏ event handler
  t = t.replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  t = t.replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi, '');
  t = t.replace(/<\s*a\b[^>]*href\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, '<a href="#"'); // chặn javascript:
  return t;
}

/* Chấm 1 câu → {got, max, correct(bool/null khi none), info} */
function gradeQuestion(exam, q, ans) {
  const sc = exam.scoring || {};
  if (q.part === 1) {
    const p = (sc.part1 != null ? sc.part1 : 0.25);
    const ok = ans === q.answerIndex;
    return { got: ok ? p : 0, max: p, correct: ok, answered: ans != null };
  }
  if (q.part === 2) {
    const tiers = Array.isArray(sc.part2) && sc.part2.length === 4 ? sc.part2 : [0.1, 0.25, 0.5, 1.0];
    const strict = sc.strictPart2 !== false;      // mặc định chế độ nghiêm ngặt
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

/* Chấm cả đề → {score, max, perPart:[{part,got,max}], detail:[...], nAnswered, nQuestions} */
function gradeExam(exam, answers) {
  const qs = exam.questions || [];
  const detail = []; let score = 0; let max = 0; let nAnswered = 0;
  const parts = exam.parts || [];
  const perPart = parts.map(p => ({ part: p.part, got: 0, max: 0 }));
  qs.forEach((q, i) => {
    const a = answers && answers[i] !== undefined ? answers[i] : null;
    const r = gradeQuestion(q, a);
    score += r.got; max += r.max;
    if (r.answered) nAnswered++;
    const pp = perPart.find(x => x.part === q.part);
    if (pp) { pp.got += r.got; pp.max += r.max; }
    detail.push({ no: i + 1, part: q.part, got: r.got, max: r.max, correct: r.correct, answered: r.answered, info: r.info, q, ans: a });
  });
  return { score, max, perPart, detail, nAnswered, nQuestions: qs.length };
}

/* "1,75" / "1.75" / "-3" → số; rỗng/điện thoại → null */
function parseNumVN(s) {
  if (s == null) return null;
  let t = String(s).trim().replace(/\s/g, '').replace(/,/g, '.');
  if (t === '' || t === '-' || t === '.') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/* Pseudonumber-perfect shuffle theo seed (đề ổn định trong tất cả mọi reload) */
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
function fmtScore(x) {
  return (Math.round(x * 100) / 100).toFixed(2).replace('.', ',');
}
function fmtDateTime(d) {
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString('vi-VN');
}

/* Ghi localStorage an toàn (private mode fallback) */
const PTW = {
  ls: {
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } }
  },
  uuid() { return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }
};
