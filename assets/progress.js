/* progress.js — Tiến độ học tập cá nhân kiểu Azota Student.
 * Toàn bộ dữ liệu lưu trong localStorage (không cần server, chạy tốt trên GitHub Pages).
 *
 * Các khóa lưu trữ:
 *   ptw_qhist_<examId>  : { "<khóa câu>": { n, r, w, last, ts } }  — lịch sử từng câu
 *   ptw_history         : [ { examId, title, mode, score, max, nQ, nAns, nRight, sec, ts } ]
 *   ptw_days            : { "YYYY-MM-DD": { q, r, sec, n } }        — hoạt động theo ngày
 *   ptw_goal_week       : số câu mục tiêu mỗi tuần (mặc định 150)
 *
 * "last" = 1 nếu lần làm gần nhất đúng, 0 nếu sai. Câu chưa từng trả lời có n = 0.
 */
(function () {
  'use strict';

  const K = {
    hist: 'ptw_history',
    days: 'ptw_days',
    goal: 'ptw_goal_week',
    qh: id => 'ptw_qhist_' + id
  };

  /* Nhãn tiếng Việt cho các chuyên đề trong ngân hàng câu hỏi.
     Khóa lạ sẽ được làm đẹp tự động (bỏ tiền tố bank-x-, thay gạch nối bằng khoảng trắng). */
  const TOPIC_LABEL = {
    // Lớp 6
    'bank-6-chat': 'Chất và sự biến đổi chất',
    'bank-6-oxygen': 'Oxygen và không khí',
    'bank-6-vatlieu': 'Vật liệu, nhiên liệu, nguyên liệu',
    'bank-6-honhop': 'Hỗn hợp và tách chất',
    'bank-6-tainguyen': 'Tài nguyên thiên nhiên',
    'bank-6-modau': 'Mở đầu môn KHTN',
    // Lớp 7
    'bank-7-nguyentu': 'Nguyên tử',
    'bank-7-nguyento': 'Nguyên tố hóa học',
    'bank-7-phantu': 'Phân tử và liên kết hóa học',
    'bank-7-hoatri': 'Hóa trị và công thức hóa học',
    'bank-7-atomicfacts': 'Kiến thức nền: Nguyên tử',
    'bank-7-moleculefacts': 'Kiến thức nền: Phân tử',
    // Lớp 8
    'bank-8-phanung': 'Phản ứng hóa học',
    'bank-8-mol': 'Mol và tính toán hóa học',
    'bank-8-acid': 'Acid – Base – Muối',
    'bank-8-muoi': 'Muối và phản ứng trao đổi',
    'bank-8-basicfacts': 'Kiến thức nền lớp 8',
    'bank-8-stoichiometry': 'Tính theo phương trình hóa học',
    'bank-8-acidfacts': 'Kiến thức nền: Acid',
    // Lớp 9
    'bank-9-kimloai': 'Kim loại',
    'bank-9-hydrocarbon': 'Hydrocarbon',
    'bank-9-alcohol': 'Alcohol và hợp chất hữu cơ',
    'bank-9-sinhhoc': 'Hóa học và sinh học',
    'bank-9-metalbasic': 'Kiến thức nền: Kim loại',
    'bank-9-organicbasic': 'Kiến thức nền: Hữu cơ',
    // Lớp 10
    'bank-10-nguyentu': 'Cấu tạo nguyên tử',
    'bank-10-lienket': 'Liên kết hóa học',
    'bank-10-nangluong': 'Năng lượng hóa học',
    'bank-10-halogen': 'Halogen',
    'bank-10-tuanhoan': 'Bảng tuần hoàn',
    'bank-10-redox': 'Phản ứng oxi hóa – khử',
    'bank-10-enthalpy': 'Enthalpy',
    'bank-10-rate': 'Tốc độ phản ứng',
    'bank-10-corefacts': 'Kiến thức nền lớp 10',
    // Lớp 11
    'bank-11-canbang': 'Cân bằng hóa học',
    'bank-11-nitrogen': 'Nitrogen và hợp chất',
    'bank-11-huuco': 'Đại cương hữu cơ',
    'bank-11-nhomchuc': 'Nhóm chức',
    'bank-11-aqueous': 'Dung dịch và sự điện li',
    'bank-11-sulfur': 'Sulfur và hợp chất',
    'bank-11-hydrocarbon': 'Hydrocarbon',
    'bank-11-alcohol': 'Alcohol – Phenol',
    'bank-11-carbonyl': 'Aldehyde – Ketone – Carboxylic acid',
    'bank-11-acid': 'Carboxylic acid',
    'bank-11-corefacts': 'Kiến thức nền lớp 11',
    // Lớp 12
    'bank-12-ester': 'Ester – Lipid',
    'bank-12-carbohydrate': 'Carbohydrate',
    'bank-12-polymer': 'Polymer',
    'bank-12-nitrogen': 'Amine – Amino acid – Protein',
    'bank-12-dien': 'Alkadiene – Alkyne',
    'bank-12-kimloai': 'Kim loại',
    'bank-12-cell': 'Pin điện và điện phân',
    'bank-12-electrolysis': 'Điện phân',
    'bank-12-IA': 'Kim loại nhóm IA',
    'bank-12-IIA': 'Kim loại nhóm IIA',
    'bank-12-complex': 'Phức chất',
    'bank-12-corefacts': 'Kiến thức nền lớp 12',
    // Sinh 7
    'bank-bio7-sinhtruong': 'Sinh trưởng và phát triển',
    'bank-bio7-tonghop': 'Tổng hợp kiến thức',
    'bank-bio7-sinhsan': 'Sinh sản',
    'bank-bio7-camung': 'Cảm ứng',
    'bank-bio7-traodoi': 'Trao đổi chất và năng lượng',
    'bank-bio7-quanghop': 'Quang hợp',
    'bank-bio7-hohap': 'Hô hấp tế bào'
  };

  const PART_LABEL = { 1: 'Phần I – Trắc nghiệm', 2: 'Phần II – Đúng/Sai', 3: 'Phần III – Trả lời ngắn' };

  function dayKey(d) {
    const x = d || new Date();
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }

  function qKey(q, i) {
    return (q && q.id) ? 'id:' + q.id : 'i' + i;
  }

  function prettifyTopic(key) {
    const s = String(key || '')
      .replace(/^bank-(bio\d+|\d+)-/i, '')
      .replace(/^bank-/i, '')
      .replace(/[-_]+/g, ' ')
      .trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Khác';
  }

  function topicLabel(q, exam) {
    if (q && q.topic) return TOPIC_LABEL[q.topic] || prettifyTopic(q.topic);
    const part = (q && q.part) || 1;
    return PART_LABEL[part] || ('Phần ' + part);
  }

  function readQHist(examId) {
    const v = PTW.ls.get(K.qh(examId));
    return (v && typeof v === 'object') ? v : {};
  }

  /* Ghi nhận một lượt nộp bài: cập nhật lịch sử từng câu, lịch sử lượt làm và hoạt động ngày. */
  function recordAttempt(exam, order, res, attempt, usedSec) {
    if (!exam || !exam.id || !Array.isArray(order) || !res) return null;
    const store = readQHist(exam.id);
    const now = Date.now();
    let nAns = 0, nRight = 0;

    order.forEach(ci => {
      const d = res.detail && res.detail[ci];
      if (!d || !d.answered) return;
      const key = qKey(exam.questions[ci], ci);
      const rec = store[key] || { n: 0, r: 0, w: 0, last: null, ts: 0 };
      rec.n += 1;
      nAns += 1;
      if (d.correct) { rec.r += 1; nRight += 1; rec.last = 1; }
      else { rec.w += 1; rec.last = 0; }
      rec.ts = now;
      rec.a = d.ans; // đáp án gần nhất, để sổ tay câu sai hiện "em đã chọn gì"
      store[key] = rec;
    });

    PTW.ls.set(K.qh(exam.id), store);

    const hist = PTW.ls.get(K.hist) || [];
    const rec = {
      id: (attempt && attempt.attemptId) || PTW.uuid(),
      examId: exam.id,
      title: exam.title || exam.id,
      mode: (attempt && attempt.mode) || 'practice',
      rawMode: (attempt && attempt.rawMode) || (attempt && attempt.mode) || 'practice',
      score: Math.round((res.score || 0) * 100) / 100,
      max: Math.round((res.max || 0) * 100) / 100,
      nQ: order.length,
      nAns,
      nRight,
      sec: Math.max(0, Math.round(usedSec || 0)),
      ts: new Date().toISOString()
    };
    hist.unshift(rec);
    PTW.ls.set(K.hist, hist.slice(0, 300));

    const days = PTW.ls.get(K.days) || {};
    const dk = dayKey();
    const day = days[dk] || { q: 0, r: 0, sec: 0, n: 0 };
    day.q += nAns;
    day.r += nRight;
    day.sec += rec.sec;
    day.n += 1;
    days[dk] = day;
    const keys = Object.keys(days).sort();
    if (keys.length > 400) keys.slice(0, keys.length - 400).forEach(k => delete days[k]);
    PTW.ls.set(K.days, days);

    return rec;
  }

  /* Thống kê một đề: đã chạm bao nhiêu câu, nắm chắc bao nhiêu, còn sai bao nhiêu. */
  function examStats(examId, total) {
    const store = readQHist(examId);
    let seen = 0, right = 0, wrong = 0, attempts = 0, lastTs = 0;
    Object.keys(store).forEach(k => {
      const r = store[k];
      if (!r || !r.n) return;
      seen += 1;
      attempts += r.n;
      if (r.last === 1) right += 1;
      else if (r.last === 0) wrong += 1;
      if (r.ts > lastTs) lastTs = r.ts;
    });
    const graded = right + wrong;
    return {
      total: total || 0,
      seen,
      right,
      wrong,
      attempts,
      accuracy: graded ? Math.round(right * 100 / graded) : 0,
      coverage: total ? Math.min(100, Math.round(seen * 100 / total)) : 0,
      lastTs
    };
  }

  /* Thống kê theo chuyên đề (dùng trường topic/family nếu có, không thì gom theo phần). */
  function topicStats(exam) {
    const store = readQHist(exam && exam.id);
    const map = new Map();
    ((exam && exam.questions) || []).forEach((q, i) => {
      const key = q.topic || ('part' + (q.part || 1));
      if (!map.has(key)) {
        map.set(key, { key, label: topicLabel(q, exam), total: 0, seen: 0, right: 0, wrong: 0 });
      }
      const g = map.get(key);
      g.total += 1;
      const r = store[qKey(q, i)];
      if (r && r.n) {
        g.seen += 1;
        if (r.last === 1) g.right += 1;
        else if (r.last === 0) g.wrong += 1;
      }
    });
    return Array.from(map.values()).sort((a, b) => (b.total - a.total) || a.label.localeCompare(b.label, 'vi'));
  }

  /* Danh sách chỉ số (canonical index) của những câu lần gần nhất làm SAI. */
  function wrongIndices(exam) {
    if (!exam || !Array.isArray(exam.questions)) return [];
    const store = readQHist(exam.id);
    const out = [];
    exam.questions.forEach((q, i) => {
      const r = store[qKey(q, i)];
      if (r && r.n && r.last === 0) out.push(i);
    });
    return out;
  }

  /* Chọn câu cho "Luyện thông minh": ưu tiên câu sai gần nhất, rồi câu chưa từng làm,
     cuối cùng là câu đã đúng (để phiên luyện không bị lặp nhàm). */
  function smartSubset(exam, n) {
    if (!exam || !Array.isArray(exam.questions) || !exam.questions.length) return [];
    const store = readQHist(exam.id);
    const pool = exam.questions.map((q, i) => {
      const r = store[qKey(q, i)];
      let s;
      if (!r || !r.n) s = 58 + Math.random() * 10;                 // chưa từng làm
      else if (r.last === 0) s = 82 + Math.min(14, (r.w || 1) * 3) + Math.random() * 4; // đang sai
      else s = 24 + Math.random() * 10;                            // đã đúng
      return { i, s };
    });
    pool.sort((a, b) => b.s - a.s);
    const take = Math.min(n || 20, exam.questions.length);
    return pool.slice(0, take)
      .map(x => x.i)
      .sort((a, b) => ((exam.questions[a].part || 1) - (exam.questions[b].part || 1)) || (a - b));
  }

  /* Toàn bộ câu đang sai của đề, xếp theo thứ tự đề gốc. */
  function wrongSubset(exam) {
    return wrongIndices(exam).sort((a, b) => ((exam.questions[a].part || 1) - (exam.questions[b].part || 1)) || (a - b));
  }

  /* Chuỗi ngày học liên tiếp (tính cả hôm nay; nếu hôm nay chưa học thì tính tới hôm qua). */
  function streak() {
    const days = PTW.ls.get(K.days) || {};
    const d = new Date();
    const hasToday = days[dayKey(d)] && days[dayKey(d)].q > 0;
    if (!hasToday) d.setDate(d.getDate() - 1);
    let n = 0;
    for (let i = 0; i < 3660; i++) {
      const rec = days[dayKey(d)];
      if (!rec || !rec.q) break;
      n += 1;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  /* Chuỗi hoạt động n ngày gần nhất, cũ → mới. */
  function lastNDays(n) {
    const days = PTW.ls.get(K.days) || {};
    const out = [];
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (n - 1));
    for (let i = 0; i < n; i++) {
      const key = dayKey(d);
      const rec = days[key] || { q: 0, r: 0, sec: 0 };
      out.push({
        key,
        label: String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'),
        dow: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()],
        q: rec.q || 0,
        r: rec.r || 0,
        sec: rec.sec || 0
      });
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  /* Tuần hiện tại (bắt đầu thứ Hai). */
  function weekStats() {
    const days = PTW.ls.get(K.days) || {};
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;
    const mon = new Date(now);
    mon.setHours(0, 0, 0, 0);
    mon.setDate(now.getDate() - dow);
    let q = 0, r = 0, sec = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      const rec = days[dayKey(d)];
      if (rec) { q += rec.q || 0; r += rec.r || 0; sec += rec.sec || 0; }
    }
    return { q, r, sec, goal: getGoal(), pct: Math.min(100, Math.round(q * 100 / Math.max(1, getGoal()))) };
  }

  function getGoal() {
    const g = +PTW.ls.get(K.goal);
    return g > 0 ? g : 150;
  }

  function setGoal(n) {
    const g = Math.max(10, Math.min(5000, Math.round(+n || 150)));
    PTW.ls.set(K.goal, g);
    return g;
  }

  /* Tổng quan toàn bộ các đề đã luyện. */
  function overview() {
    const days = PTW.ls.get(K.days) || {};
    let q = 0, r = 0, sec = 0, activeDays = 0;
    Object.keys(days).forEach(k => {
      const rec = days[k];
      if (!rec) return;
      q += rec.q || 0;
      r += rec.r || 0;
      sec += rec.sec || 0;
      if (rec.q) activeDays += 1;
    });
    return {
      questions: q,
      right: r,
      sec,
      activeDays,
      accuracy: q ? Math.round(r * 100 / q) : 0,
      streak: streak(),
      attempts: (PTW.ls.get(K.hist) || []).length
    };
  }

  function history() {
    return PTW.ls.get(K.hist) || [];
  }

  /* Xóa toàn bộ dữ liệu tiến độ (giữ hồ sơ học sinh và kỷ lục điểm). */
  function reset() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('ptw_qhist_') === 0) keys.push(k);
      }
      keys.forEach(k => localStorage.removeItem(k));
    } catch (e) { }
    PTW.ls.del(K.hist);
    PTW.ls.del(K.days);
  }

  /* Lấy bản ghi của một câu cụ thể (dùng cho sổ tay câu sai). */
  function getRecord(examId, q, i) {
    return readQHist(examId)[qKey(q, i)] || null;
  }

  window.PTWProgress = {
    recordAttempt, examStats, topicStats, wrongIndices,
    smartSubset, wrongSubset, streak, lastNDays, weekStats,
    getGoal, setGoal, overview, history, reset, getRecord,
    topicLabel, dayKey
  };
})();
