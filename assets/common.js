/* common.js – Tiện ích dùng chung + ENGINE CHẤM ĐIỂM theo QĐ 764/QĐ-BGDĐT 2024
 * + CLOUD REALTIME LEADERBOARD & QUẢN TRỊ KẾT QUẢ TREO THƯỞNG · Kimkenpkl
 */

const MEM_CACHE = new Map();

async function loadJSON(url) {
  // exams.json là danh mục đề: luôn lấy bản mới, không cache sessionStorage
  // (F5 vẫn giữ sessionStorage nên trước đây phải đóng tab mới thấy đề mới).
  const isExamsIndex = /(^|\/)data\/exams\.json(\?|$)/.test(url);
  const isStaticData = !isExamsIndex && /^(\.\.\/)?data\/(tests|exams|bank)\//.test(url);
  if (isStaticData && MEM_CACHE.has(url)) {
    return JSON.parse(MEM_CACHE.get(url));
  }
  if (isStaticData) {
    try {
      const cachedStr = sessionStorage.getItem('ptw_cache_' + url);
      if (cachedStr) {
        MEM_CACHE.set(url, cachedStr);
        return JSON.parse(cachedStr);
      }
    } catch (e) {}
  }
  const fetchUrl = isExamsIndex
    ? url + (url.includes('?') ? '&' : '?') + 't=' + Date.now()
    : url;
  const r = await fetch(fetchUrl, { cache: isStaticData ? 'default' : 'no-store' });
  if (!r.ok) throw new Error('Không tải được: ' + url + ' (HTTP ' + r.status + ')');
  const txt = await r.text();
  if (isStaticData) {
    MEM_CACHE.set(url, txt);
    try { sessionStorage.setItem('ptw_cache_' + url, txt); } catch (e) {}
  }
  return JSON.parse(txt);
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

/* Khối dẫn / đoạn đọc hiểu nhập từ Word hay kèm màu hard-code (nền #f7f5ff, chữ #5b5b6b)
   -> bỏ các khai báo màu trong inline style, giữ lại bố cục (padding/margin/font-size).
   Màu khung do CSS theme (--stem-bg / --stem-ink / --stem-accent) quyết định, nhờ đó
   dark mode không còn cảnh nền sáng + chữ sáng. */
function stemHTML(s) {
  let t = sanitizeHTML(s);
  t = t.replace(/\sstyle="([^"]*)"/gi, (m, css) => {
    const kept = String(css).split(';')
      .map(x => x.trim())
      .filter(Boolean)
      .filter(decl => {
        const prop = decl.split(':')[0].trim().toLowerCase();
        return !/^(background|background-color|background-image|color|border|border-color|border-left|border-left-color|border-right|border-right-color|border-top|border-top-color|border-bottom|border-bottom-color)$/.test(prop);
      });
    return kept.length ? ` style="${kept.join(';')}"` : '';
  });
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
/* Đảo [0..n-1] nhưng giữ nguyên vị trí các chỉ số trong `fixed` (phương án "#A." của file Word). */
function shuffledFixed(n, fixed, seedFn) {
  const fx = new Set((fixed || []).filter(k => k >= 0 && k < n));
  const free = [];
  for (let k = 0; k < n; k++) if (!fx.has(k)) free.push(k);
  const mixed = shuffled(free, seedFn);
  let p = 0;
  return Array.from({ length: n }, (_, k) => fx.has(k) ? k : mixed[p++]);
}
/* Đảo danh sách câu, các câu cùng `keyFn(x)` (nhóm <g>) đứng liền nhau và giữ thứ tự bên trong. */
function shuffledGroups(list, seedFn, keyFn) {
  const units = [];
  list.forEach(x => {
    const g = keyFn(x), last = units[units.length - 1];
    if (g && last && last.g === g) last.items.push(x); else units.push({ g, items: [x] });
  });
  return [].concat(...shuffled(units, seedFn).map(u => u.items));
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
/* Che tên học sinh trên bảng công khai: "Nguyễn Văn An" → "Nguyễn V. A." (gọi lại nhiều lần vẫn ra như nhau). */
function maskName(n) {
  const w = String(n || '').normalize('NFC').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '';
  const ini = x => (Array.from(x)[0] || '').toUpperCase() + '.';
  return w.length === 1 ? ini(w[0]) : w[0] + ' ' + w.slice(1).map(ini).join(' ');
}
/* Lịch giao bài: "openAt"/"closeAt" dạng "2026-11-20T07:30" – không ghi múi giờ thì hiểu là giờ Việt Nam (+07:00). */
function parseVNTime(s) {
  if (!s) return null;
  let t = String(s).trim().replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) t += 'T00:00';
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(t)) t += '+07:00';
  const ms = Date.parse(t);
  return isNaN(ms) ? null : ms;
}
function fmtVNTime(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) + ' ' + d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}
/* state: always | before | open | closed. assigned = đề giao bài (giới hạn lượt hoặc ẩn đáp án) → chỉ cho thi, không luyện. */
function examSchedule(x, now) {
  now = now == null ? Date.now() : now;
  x = x || {};
  const open = parseVNTime(x.openAt), close = parseVNTime(x.closeAt);
  const state = open && now < open ? 'before' : close && now >= close ? 'closed' : (open || close) ? 'open' : 'always';
  const maxAttempts = +x.maxAttempts > 0 ? Math.floor(+x.maxAttempts) : 0;
  return {
    open, close, state, maxAttempts,
    assigned: !!(maxAttempts || x.hideKeyUntilClose),
    keyHidden: !!x.hideKeyUntilClose && state !== 'closed'
  };
}
/* Số lượt đã nộp trên máy này (theo họ tên + lớp, tính từ giờ mở đề) */
function countLocalAttempts(examId, name, clazz, sinceMs) {
  const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const list = PTW.ls.get('ptw_local_submissions') || [];
  return list.filter(r => r.examId === examId && norm(r['Họ tên']) === norm(name) && norm(r['Lớp']) === norm(clazz) &&
    !r.review && (!sinceMs || Date.parse(r.ts) >= sinceMs)).length;
}

const PTW = {
  ls: {
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } }
  },
  uuid() { return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9); },

  theme: {
    init() {
      const saved = PTW.ls.get('ptw_theme') || 'light';
      document.documentElement.setAttribute('data-theme', saved);
      return saved;
    },
    toggle() {
      const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      PTW.ls.set('ptw_theme', next);
      return next;
    }
  },

  /* Khóa Copy / Bôi đen / Chuột phải / Kéo thả / Phím tắt (Ctrl+C, Ctrl+A, Ctrl+U, Ctrl+S, F12) toàn diện */
  protectContent() {
    if (window.__ptwCopyProtected) return;
    window.__ptwCopyProtected = true;

    let toastTimer = null;
    function showCopyWarn(msg) {
      let el = document.getElementById('ptwCopyToast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'ptwCopyToast';
        el.className = 'copy-toast';
        document.body.appendChild(el);
      }
      el.textContent = msg || '🔒 Đã khóa tính năng Sao chép (Copy) để đảm bảo công bằng thi cử!';
      el.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
    }

    const isEditable = t => t && /INPUT|TEXTAREA|SELECT/.test(t.tagName);

    ['copy', 'cut'].forEach(ev => document.addEventListener(ev, e => {
      if (isEditable(e.target)) return;
      e.preventDefault();
      if (e.clipboardData) e.clipboardData.setData('text/plain', 'Phòng Thi 24/7: Không cho phép sao chép nội dung câu hỏi.');
      showCopyWarn('🔒 Không cho phép sao chép (Copy) nội dung đề thi!');
    }, true));

    document.addEventListener('contextmenu', e => {
      if (isEditable(e.target)) return;
      e.preventDefault();
      showCopyWarn('🔒 Đã khóa chuột phải trong khu vực đề thi!');
    }, true);

    document.addEventListener('selectstart', e => {
      if (isEditable(e.target)) return;
      e.preventDefault();
    }, true);

    document.addEventListener('dragstart', e => {
      if (e.target && e.target.tagName === 'IMG') {
        e.preventDefault();
      }
    }, true);

    document.addEventListener('keydown', e => {
      const k = (e.key || '').toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.key === 'F12' || (ctrl && e.shiftKey && 'ijc'.includes(k)) || (ctrl && 'cusp'.includes(k) && !isEditable(e.target)) || (ctrl && k === 'a' && !isEditable(e.target))) {
        e.preventDefault();
        e.stopPropagation();
        if (ctrl && (k === 'c' || k === 'a' || k === 'u' || k === 's')) {
          showCopyWarn('🔒 Đã khóa phím tắt sao chép / lưu mã nguồn đề thi!');
        }
        return false;
      }
    }, true);
  },

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
        'camVerified': !!(r.camVerified || r['Camera'] === '📷 Có Cam'),
        'camWarns': +(r.camWarns || 0),
        'Camera': (r.camVerified || r['Camera'] === '📷 Có Cam') ? ('📷 Có Cam' + (r.camWarns ? ` (⚠×${r.camWarns})` : ' ✓')) : '—',
        'Số câu TL': r.answered != null ? r.answered : (r['Số câu TL'] || ''),
        'Tổng câu': r.total != null ? r.total : (r['Tổng câu'] || ''),
        'Nguồn': r['Nguồn'] || '🌐 Cloud'
      };
    });

    const seenAttempt = new Set();
    const uniqueAttempts = [];
    norm.forEach(item => {
      if (!item.name) return;
      if (seenAttempt.has(item.attemptId)) return;
      seenAttempt.add(item.attemptId);
      uniqueAttempts.push(item);
    });

    // Sắp xếp theo % Điểm đạt được (hoặc Điểm) giảm dần -> Thời gian giây tăng dần -> Ít rời tab nhất
    uniqueAttempts.sort((a, b) => {
      if (Math.abs(b.pct - a.pct) > 1e-4) return b.pct - a.pct;
      if (Math.abs(b.score - a.score) > 1e-6) return b.score - a.score;
      if (a.timeUsedSec !== b.timeUsedSec) return a.timeUsedSec - b.timeUsedSec;
      return a.exitTab - b.exitTab;
    });

    let finalRows = uniqueAttempts;
    if (bestPerStudent) {
      const seenStudent = new Set();
      finalRows = [];
      uniqueAttempts.forEach(item => {
        // sid: mã học sinh do Code.gs tạo (tên đã che có thể trùng giữa 2 em cùng lớp)
        const key = (item.examId + '|' + (item.sid || item.name.toLowerCase().replace(/\s+/g, ' ')) + '|' + item.class.toLowerCase().replace(/\s+/g, '')).trim();
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

    async writeBucket(baseUrl, bucketId, bucketName, submissions) {
      if (!baseUrl || !bucketId) return false;
      const putRes = await fetch(`${baseUrl}/${bucketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: bucketName, data: { submissions, updatedAt: new Date().toISOString() } })
      });
      return putRes.ok;
    },

    async pushToBucket(baseUrl, bucketId, bucketName, entry) {
      if (!baseUrl || !bucketId) return false;
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
        exitFs: entry.exitFs,
        camVerified: !!entry.camVerified,
        camWarns: +(entry.camWarns || 0)
      };
      // Cơ chế Retry + Random Jitter chống nghẽn & chống ghi đè khi nhiều học sinh nộp bài cùng lúc
      for (let attemptIdx = 0; attemptIdx < 3; attemptIdx++) {
        if (attemptIdx > 0) {
          await new Promise(r => setTimeout(r, 250 + Math.floor(Math.random() * 1200)));
        }
        try {
          const cur = await this.fetchBucket(baseUrl, bucketId).catch(() => []);
          const filtered = cur.filter(x => x && x.attemptId !== compact.attemptId);
          filtered.unshift(compact);
          filtered.sort((a, b) => ((+b.pct || 0) - (+a.pct || 0)) || ((+a.timeUsedSec || 99999) - (+b.timeUsedSec || 99999)));
          const trimmed = filtered.slice(0, 500);
          const ok = await this.writeBucket(baseUrl, bucketId, bucketName, trimmed);
          if (ok) return trimmed;
        } catch (e) {}
      }
      return null;
    },

    async submit(cfg, entry) {
      if (!cfg || !cfg.cloudApiBase || !cfg.cloudBuckets) return null;
      const base = cfg.cloudApiBase;
      const bExam = cfg.cloudBuckets[entry.examId] || cfg.cloudBuckets.ALL;
      const bName = cfg.cloudBuckets[entry.examId] ? ('ptw247_' + entry.examId) : 'ptw247_ALL';
      // Chỉ ghi vào đúng shard bucket của môn thi đó để cắt giảm 50% tải HTTP PUT đồng thời
      const updatedRows = await this.pushToBucket(base, bExam, bName, entry);
      if (updatedRows) return updatedRows;
      // Nếu mạng nghẽn tức thời (500 HS nộp cùng giây), đưa vào hàng đợi nền tự gửi lại
      const q = PTW.ls.get('ptw_cloud_queue') || [];
      q.push(entry);
      PTW.ls.set('ptw_cloud_queue', q.slice(-50));
      return null;
    },

    async flushCloudQueue(cfg) {
      const q = PTW.ls.get('ptw_cloud_queue') || [];
      if (!q.length || !cfg || !cfg.cloudApiBase || !cfg.cloudBuckets) return;
      const remain = [];
      for (const item of q) {
        const okRows = await this.submit(cfg, item).catch(() => null);
        if (!okRows) remain.push(item);
      }
      PTW.ls.set('ptw_cloud_queue', remain);
    },

    async fetchExamOrAll(cfg, examId) {
      if (!cfg || !cfg.cloudApiBase || !cfg.cloudBuckets) return [];
      const base = cfg.cloudApiBase;
      if (examId && cfg.cloudBuckets[examId]) {
        const list = await this.fetchBucket(base, cfg.cloudBuckets[examId]);
        return list.filter(x => x && x.examId === examId);
      }
      // Khi GV xem "Tất cả các đề", đọc song song tất cả các shard môn học
      const entries = Object.entries(cfg.cloudBuckets);
      const settled = await Promise.allSettled(entries.map(([, bId]) => this.fetchBucket(base, bId)));
      const merged = [];
      settled.forEach(r => {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) merged.push(...r.value);
      });
      return merged;
    },

    /* Quyền kiểm soát của Giáo viên: Xóa 1 bài nộp cụ thể trên Cloud */
    async deleteAttempt(cfg, examId, attemptId) {
      if (!cfg || !cfg.cloudApiBase || !cfg.cloudBuckets) return false;
      const base = cfg.cloudApiBase;
      const targets = [];
      if (examId && cfg.cloudBuckets[examId]) targets.push([cfg.cloudBuckets[examId], 'ptw247_' + examId]);
      if (cfg.cloudBuckets.ALL) targets.push([cfg.cloudBuckets.ALL, 'ptw247_ALL']);
      for (const [bId, bName] of targets) {
        const cur = await this.fetchBucket(base, bId).catch(() => []);
        const next = cur.filter(x => x && x.attemptId !== attemptId);
        await this.writeBucket(base, bId, bName, next);
      }
      return true;
    },

    /* Quyền kiểm soát của Giáo viên: Reset sạch Bảng xếp hạng của 1 đề (hoặc tất cả) cho đợt thưởng mới */
    async clearExam(cfg, examId) {
      if (!cfg || !cfg.cloudApiBase || !cfg.cloudBuckets) return false;
      const base = cfg.cloudApiBase;
      if (examId && cfg.cloudBuckets[examId]) {
        await this.writeBucket(base, cfg.cloudBuckets[examId], 'ptw247_' + examId, []);
        if (cfg.cloudBuckets.ALL) {
          const allCur = await this.fetchBucket(base, cfg.cloudBuckets.ALL).catch(() => []);
          await this.writeBucket(base, cfg.cloudBuckets.ALL, 'ptw247_ALL', allCur.filter(x => x && x.examId !== examId));
        }
      } else if (cfg.cloudBuckets.ALL) {
        for (const [k, bId] of Object.entries(cfg.cloudBuckets)) {
          await this.writeBucket(base, bId, 'ptw247_' + k, []);
        }
      }
      return true;
    }
  }
};

/* Đọc bảng xếp hạng công khai từ Google Sheet (Apps Script action=top, xem apps-script/Code.gs). */
PTW.sheet = {
  jsonp(url, timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
      const cb = '__ptwsh_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const s = document.createElement('script');
      const done = () => { delete window[cb]; s.remove(); };
      const timer = setTimeout(() => { done(); reject(new Error('Hết thời gian chờ Apps Script')); }, timeoutMs);
      window[cb] = data => { clearTimeout(timer); done(); resolve(data); };
      s.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'callback=' + cb;
      s.onerror = () => { clearTimeout(timer); done(); reject(new Error('Không kết nối được Apps Script')); };
      document.body.appendChild(s);
    });
  },
  top(gsUrl, examId) {
    return this.jsonp(`${gsUrl}?action=top&exam=${encodeURIComponent(examId || '')}`);
  }
};

PTW.theme.init();
if (typeof document !== 'undefined' && !location.pathname.includes('/admin/') && !location.pathname.includes('/report/')) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PTW.protectContent());
  } else {
    PTW.protectContent();
  }
}
