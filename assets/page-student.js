/* Tach tu hoc-sinh.html de bat CSP script-src 'self'. */
(async () => {
  const $ = id => document.getElementById(id);
  const LETTERS = ['A', 'B', 'C', 'D', 'E'];
  const MODE_LABEL = {
    practice: 'Luyện từng câu', exam: 'Thi thử', quick20: 'Quick 20',
    matrix: 'Đề 28 câu', smart: 'Luyện thông minh', wrong: 'Ôn câu sai'
  };

  /* ---------- Theme ---------- */
  const btnTheme = $('btnTheme');
  function syncThemeLabel() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btnTheme.textContent = isDark ? 'THEME: MONOCHROM DARK' : 'THEME: BARYTA LIGHT';
  }
  syncThemeLabel();
  btnTheme.onclick = () => { PTW.theme.toggle(); syncThemeLabel(); };

  function fmtStudy(sec) {
    sec = Math.max(0, Math.round(+sec || 0));
    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m} phút`;
  }
  function plain(s) {
    const d = document.createElement('div');
    d.innerHTML = sanitizeHTML(s || '');
    return (d.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function timeAgo(iso) {
    const t = Date.parse(iso);
    if (!t) return '';
    const s = Math.max(1, Math.round((Date.now() - t) / 1000));
    if (s < 60) return 'vừa xong';
    if (s < 3600) return Math.round(s / 60) + ' phút trước';
    if (s < 86400) return Math.round(s / 3600) + ' giờ trước';
    if (s < 604800) return Math.round(s / 86400) + ' ngày trước';
    const d = new Date(t);
    return d.getDate() + '/' + (d.getMonth() + 1);
  }

  /* ---------- Dữ liệu ---------- */
  let exams = [];
  try { exams = (await loadJSON('data/exams.json')).exams || []; } catch (e) { }
  const visible = exams.filter(x => !x.hidden && !x.customUrl);
  const byId = new Map(visible.map(x => [x.id, x]));

  const profile = PTW.ls.get('ptw_student_profile');
  if (profile && profile.name) {
    $('whoami').innerHTML = `👋 Xin chào <b>${escapeHTML(profile.name)}</b>${profile.class ? ' · Lớp <b>' + escapeHTML(profile.class) + '</b>' : ''} — dữ liệu học tập lưu trên máy này.`;
  }

  const ov = PTWProgress.overview();

  function renderLabProgress(){
    const activities=PTWLabProgress.activities(),dated=activities.filter(e=>e.completedAt),stats=$('labProgressStats'),list=$('labProgressList');
    stats.textContent=`${activities.length} hoạt động đã ghi nhận · ${dated.length} có ngày hoàn thành · ${activities.length-dated.length} từ dữ liệu cũ chưa rõ ngày.`;
    list.replaceChildren();if(!activities.length){const p=document.createElement('p');p.className='hint';p.textContent='Chưa có hoạt động Lab được ghi nhận trên thiết bị này.';list.append(p);return;}
    const labels={game:'Kỷ lục trò chơi', 'phan-tu':'Mô hình phân tử','nhiem-vu':'Nhiệm vụ thí nghiệm',review:'Bài ôn tập Lab'};
    const ul=document.createElement('ul');ul.className='lab-progress-list';activities.slice(0,30).forEach(event=>{const li=document.createElement('li'),title=document.createElement('strong'),meta=document.createElement('span');title.textContent=`${labels[event.source]||'Hoạt động Lab'} · ${event.activityId}`;meta.textContent=event.completedAt?`Hoàn thành ${new Date(event.completedAt).toLocaleString('vi-VN')}`:'Ngày hoàn thành chưa được lưu trong dữ liệu cũ';li.append(title,document.createElement('br'),meta);ul.append(li);});list.append(ul);
  }
  renderLabProgress();
  $('labProgressExport').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(PTWLabProgress.exportData(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='tien-do-lab.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);$('labProgressStatus').textContent='Đã yêu cầu tải sao lưu tiến độ Lab từ thiết bị này.';});
  $('labProgressImport').addEventListener('change',async event=>{const input=event.currentTarget;try{const file=input.files[0];if(!file)return;if(file.size>2e6)throw Error('Tệp sao lưu Lab tối đa 2 MB.');const count=PTWLabProgress.importData(JSON.parse(await file.text()));renderLabProgress();$('labProgressStatus').textContent=`Đã ghép sao lưu trên thiết bị này; có ${count} sự kiện đã ghi nhận.`;}catch(error){$('labProgressStatus').textContent=error.message;}finally{input.value='';}});

  /* ---------- KPI ---------- */
  $('kpiGrid').innerHTML = `
    <div class="kpi">
      <div class="kpi-num">${ov.streak}<small> ngày</small></div>
      <div class="kpi-lbl">🔥 Chuỗi ngày học</div>
      <div class="kpi-sub">${ov.streak ? 'Giữ nhịp mỗi ngày nhé!' : 'Học một câu hôm nay để bắt đầu chuỗi'}</div>
    </div>
    <div class="kpi">
      <div class="kpi-num">${ov.questions}</div>
      <div class="kpi-lbl">Câu đã luyện</div>
      <div class="kpi-sub">${ov.attempts} lượt nộp bài</div>
    </div>
    <div class="kpi">
      <div class="kpi-num">${ov.accuracy}<small>%</small></div>
      <div class="kpi-lbl">Độ chính xác</div>
      <div class="kpi-sub">${ov.right}/${ov.questions} câu đúng</div>
    </div>
    <div class="kpi">
      <div class="kpi-num">${fmtStudy(ov.sec)}</div>
      <div class="kpi-lbl">Thời gian học</div>
      <div class="kpi-sub">${ov.activeDays} ngày có hoạt động</div>
    </div>`;

  /* ---------- Biểu đồ 14 ngày ---------- */
  const days = PTWProgress.lastNDays(14);
  const maxQ = Math.max(1, ...days.map(d => d.q));
  $('chart').innerHTML = `<div class="chart-wrap">${days.map((d, i) => {
    const h = d.q ? Math.max(5, Math.round(d.q / maxQ * 100)) : 2;
    const today = i === days.length - 1;
    return `<div class="chart-col ${today ? 'today' : ''} ${d.q ? '' : 'zero'}" title="${d.label}: ${d.q} câu · đúng ${d.r}">
      ${d.q ? `<span class="chart-val">${d.q}</span>` : ''}
      <div class="chart-bar" style="height:${h}%"></div>
      <span class="chart-lbl">${d.dow}</span>
    </div>`;
  }).join('')}</div>`;

  /* ---------- Mục tiêu tuần ---------- */
  function renderGoal() {
    const w = PTWProgress.weekStats();
    $('goalBox').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap">
        <div><span style="font-family:var(--font-head);font-size:30px;font-weight:800">${w.q}</span><span class="hint"> / ${w.goal} câu</span></div>
        <span class="badge">${w.pct}%</span>
      </div>
      <div class="goal-track"><div class="goal-fill" style="width:${w.pct}%"></div></div>
      <div class="hint">Tuần này đúng ${w.r} câu · ${fmtStudy(w.sec)}</div>
      <div class="goal-row">
        <label class="hint" for="goalInp">Mục tiêu mỗi tuần:</label>
        <input class="goal-inp" id="goalInp" type="number" min="10" max="5000" step="10" value="${w.goal}">
        <button class="btn btn-ghost" id="btnSaveGoal">Lưu</button>
      </div>`;
    $('btnSaveGoal').onclick = () => {
      PTWProgress.setGoal($('goalInp').value);
      renderGoal();
    };
  }
  renderGoal();

  /* ---------- Tiến độ từng đề ---------- */
  const rows = visible
    .map(x => ({ x, st: PTWProgress.examStats(x.id, x.count) }))
    .filter(r => r.st.seen > 0 || r.st.attempts > 0)
    .sort((a, b) => b.st.lastTs - a.st.lastTs);

  if (!rows.length) {
    $('examProgress').innerHTML = `<div class="card" style="text-align:center;padding:30px">
      <div style="font-size:38px">🚀</div>
      <h3 style="margin:8px 0 4px">Chưa có dữ liệu luyện tập</h3>
      <p class="hint" style="max-width:52ch;margin:0 auto 14px">Làm một đề bất kỳ, hệ thống sẽ tự ghi nhận tiến độ, độ chính xác và sổ tay câu sai cho em.</p>
      <a class="btn btn-primary" href="index.html">Chọn đề để luyện →</a>
    </div>`;
  } else {
    $('examProgress').innerHTML = rows.map(({ x, st }) => `
      <div class="prow">
        <div class="prow-head">
          <div class="prow-title">${escapeHTML(x.title)}</div>
          <div class="prow-meta">${st.seen}/${x.count} câu · nắm ${st.accuracy}%</div>
        </div>
        <div class="pbar"><i style="width:${st.coverage}%"></i></div>
        <div class="prow-actions">
          <a class="btn btn-primary" href="thi.html?exam=${encodeURIComponent(x.id)}&mode=smart">🧠 Luyện thông minh</a>
          ${st.wrong ? `<a class="btn" href="thi.html?exam=${encodeURIComponent(x.id)}&mode=wrong">🔁 Ôn ${st.wrong} câu sai</a>` : ''}
          ${st.wrong ? `<button class="btn btn-ghost" data-nb="${escapeHTML(x.id)}">📓 Sổ tay câu sai</button>` : ''}
          <a class="btn btn-ghost" href="thi.html?exam=${encodeURIComponent(x.id)}&mode=practice">Luyện từng câu</a>
        </div>
      </div>`).join('');
  }

  /* ---------- Lịch sử gần đây ---------- */
  const hist = PTWProgress.history().slice(0, 10);
  if (!hist.length) {
    $('historyBox').innerHTML = '<div class="nb-empty" style="border:none">Chưa có lượt làm bài nào.</div>';
  } else {
    $('historyBox').innerHTML = hist.map(h => {
      const pct = h.max ? Math.round(h.score / h.max * 100) : 0;
      return `<div class="hist-row">
        <span class="badge">${escapeHTML(MODE_LABEL[h.rawMode] || MODE_LABEL[h.mode] || 'Luyện tập')}</span>
        <span style="min-width:0;flex:1">${escapeHTML(h.title)}</span>
        <span class="hint">${timeAgo(h.ts)}</span>
        <span class="hist-score">${fmtScore(h.score)}/${fmtScore(h.max)} <span class="hint">(${pct}%)</span></span>
      </div>`;
    }).join('');
  }

  /* ---------- Sổ tay câu sai ---------- */
  const nbExams = rows.filter(r => r.st.wrong > 0);
  let nbExamId = nbExams.length ? nbExams[0].x.id : null;

  function renderNbItem(exam, ci) {
    const q = exam.questions[ci];
    const rec = PTWProgress.getRecord(exam.id, q, ci) || {};
    const stemTxt = plain(q.content || '');
    const short = stemTxt.slice(0, 110) + (stemTxt.length > 110 ? '…' : '');
    let ansHtml = '';
    if (q.part === 1) {
      ansHtml = '<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:9px">' + (q.options || []).map((op, i) => {
        const isKey = i === q.answerIndex;
        const mine = rec.a === i;
        const style = isKey
          ? 'background:var(--ok-soft);border-color:var(--ok-border);color:var(--ok)'
          : (mine ? 'background:var(--danger-soft);border-color:var(--danger-border);color:var(--danger)' : 'opacity:.8');
        return `<span class="badge" style="${style}">${isKey ? '✓ ' : ''}${LETTERS[i]}: ${sanitizeHTML(op)}${mine ? ' (em chọn)' : ''}</span>`;
      }).join('') + '</div>';
    } else if (q.part === 2) {
      ansHtml = '<div style="margin-top:8px">' + (q.statements || []).map((st, i) => {
        const mine = Array.isArray(rec.a) ? rec.a[i] : null;
        const picked = mine === true || mine === false;
        return `<div style="font-size:13px;margin-top:4px;line-height:1.55">
          <b>${'abcd'[i]})</b> ${sanitizeHTML(st.text)}
          <span class="hint">— đáp án <b>${st.answer ? 'Đúng' : 'Sai'}</b>${picked ? ` · em chọn <b style="color:${mine === st.answer ? 'var(--ok)' : 'var(--danger)'}">${mine ? 'Đúng' : 'Sai'}</b>` : ''}</span>
        </div>`;
      }).join('') + '</div>';
    } else {
      ansHtml = `<div class="nb-ans">Đáp án đúng: <b class="ok">${escapeHTML(String(q.answer))}${q.unit ? ' ' + escapeHTML(q.unit) : ''}</b>${rec.a != null && rec.a !== '' ? ` · em nhập: <b class="bad">${escapeHTML(String(rec.a))}</b>` : ''}</div>`;
    }
    const grp = q.groupContent ? `<div class="grp-content" style="margin-top:9px">${stemHTML(q.groupContent)}</div>` : '';
    return `<details class="nb-q">
      <summary><span class="badge" style="flex:none">Câu ${ci + 1}</span> <span>${escapeHTML(short)}</span></summary>
      ${grp}
      <div class="nb-stem">${sanitizeHTML(q.content || '')}</div>
      ${ansHtml}
      ${q.explain ? `<div class="explain" style="margin-top:9px">💡 ${sanitizeHTML(q.explain)}</div>` : ''}
    </details>`;
  }

  async function openNotebook(examId) {
    const meta = byId.get(examId);
    if (!meta) return;
    nbExamId = examId;
    document.querySelectorAll('.nb-chip').forEach(b => b.classList.toggle('active', b.dataset.nb === examId));
    const box = $('nbList');
    box.innerHTML = '<div class="nb-empty">Đang tải đề…</div>';
    let exam;
    try { exam = await loadJSON(`data/tests/${encodeURIComponent(examId)}.json`); }
    catch (e) { box.innerHTML = '<div class="nb-empty">Không tải được đề này.</div>'; return; }
    const wrong = PTWProgress.wrongSubset(exam);
    if (!wrong.length) {
      box.innerHTML = '<div class="nb-empty">🎉 Không còn câu sai nào ở đề này.</div>';
      return;
    }
    box.innerHTML = `
      <div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <span class="hint">${wrong.length} câu cần ôn lại · ${escapeHTML(meta.title)}</span>
        <a class="btn btn-primary" style="padding:6px 12px;font-size:12px" href="thi.html?exam=${encodeURIComponent(examId)}&mode=wrong">🔁 Luyện lại ${wrong.length} câu sai</a>
      </div>
      ${wrong.slice(0, 50).map(ci => renderNbItem(exam, ci)).join('')}
      ${wrong.length > 50 ? `<div class="hint" style="margin-top:8px">… và ${wrong.length - 50} câu khác. Bấm "Luyện lại" để ôn toàn bộ.</div>` : ''}`;
  }

  if (!nbExams.length) {
    $('nbTools').innerHTML = '';
    $('nbList').innerHTML = '<div class="nb-empty">Chưa có câu sai nào được ghi nhận. Làm đề ở chế độ luyện tập để sổ tay bắt đầu hoạt động.</div>';
  } else {
    $('nbTools').innerHTML = nbExams.map(r =>
      `<button class="nb-chip" data-nb="${escapeHTML(r.x.id)}">${escapeHTML(r.x.title)} <b>(${r.st.wrong})</b></button>`
    ).join('');
    document.querySelectorAll('.nb-chip').forEach(b => {
      b.onclick = () => { openNotebook(b.dataset.nb); $('notebookTitle').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    });
    document.querySelectorAll('[data-nb]').forEach(b => {
      if (b.classList.contains('nb-chip')) return;
      b.onclick = () => { openNotebook(b.dataset.nb); $('notebookTitle').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    });
    openNotebook(nbExamId);
  }

  /* ---------- Xóa dữ liệu ---------- */
  let resetArmed = false, resetTimer = null;
  $('btnReset').onclick = () => {
    if (!resetArmed) {
      resetArmed = true;
      $('btnReset').textContent = '⚠️ Bấm lần nữa để xóa hết';
      resetTimer = setTimeout(() => { resetArmed = false; $('btnReset').textContent = '🗑 Xóa dữ liệu tiến độ'; }, 4000);
      return;
    }
    clearTimeout(resetTimer);
    PTWProgress.reset();
    PTWLabProgress.reset();
    location.reload();
  };
})();
