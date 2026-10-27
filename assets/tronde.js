/* tronde.js – Bộ công cụ Trộn Đề In Giấy Nhiều Mã Đề (101, 102, 103, 104...)
 * + Xuất File Word (.DOCX OpenXML) có ngắt trang & định dạng chỉ số hóa học
 * + Xuất Bảng Đáp Án Chuẩn TNMaker (CSV/Excel theo Cột & theo Dòng) · Kimkenpkl
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const LETTERS = ['A', 'B', 'C', 'D'];
  const SUB_LETTERS = ['a', 'b', 'c', 'd'];

  let EXAMS_META = [];
  let SOURCE_EXAM = null;
  let MIXED_VERSIONS = []; // [{ code, p1:[{q, optMap, ansLetter}], p2:[{q, stmMap, ansStr, ansArr}], p3:[{q, ansVal}] }]
  let activeCodeIdx = 0;

  async function boot() {
    if ($('btnTheme')) {
      const sync = () => { $('btnTheme').textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙'; };
      sync();
      $('btnTheme').onclick = () => { PTW.theme.toggle(); sync(); };
    }

    try {
      const idx = await loadJSON('data/exams.json');
      EXAMS_META = (idx.exams || []).filter(x => !x.customUrl && !x.hidden);
      $('selSourceExam').innerHTML = EXAMS_META.map(x => `<option value="${escapeHTML(x.id)}">${escapeHTML(x.title)} (${x.count} câu)</option>`).join('');
      const urlExam = new URLSearchParams(location.search).get('exam');
      if (urlExam && EXAMS_META.some(x => x.id === urlExam)) {
        $('selSourceExam').value = urlExam;
      }
      if (EXAMS_META.length) {
        await loadSelectedSourceExam();
      }
    } catch (e) {}

    $('selSourceExam').onchange = () => loadSelectedSourceExam();
    $('inpJsonFile').onchange = handleFileUpload;

    $('btnPreset28').onclick = () => {
      if (!SOURCE_EXAM) return;
      const c1 = SOURCE_EXAM.questions.filter(q => q.part === 1).length;
      const c2 = SOURCE_EXAM.questions.filter(q => q.part === 2).length;
      const c3 = SOURCE_EXAM.questions.filter(q => q.part === 3).length;
      $('inpQuotaP1').value = Math.min(18, c1);
      $('inpQuotaP2').value = Math.min(4, c2);
      $('inpQuotaP3').value = Math.min(6, c3);
      $('inpDuration').value = 45;
    };

    $('btnPresetFull').onclick = () => {
      if (!SOURCE_EXAM) return;
      $('inpQuotaP1').value = SOURCE_EXAM.questions.filter(q => q.part === 1).length;
      $('inpQuotaP2').value = SOURCE_EXAM.questions.filter(q => q.part === 2).length;
      $('inpQuotaP3').value = SOURCE_EXAM.questions.filter(q => q.part === 3).length;
      $('inpDuration').value = SOURCE_EXAM.durationMin || 90;
    };

    document.querySelectorAll('.btnPresetCode').forEach(btn => {
      btn.onclick = () => { $('inpCodes').value = btn.dataset.codes; };
    });

    $('btnGenerateMix').onclick = generateMix;
    $('btnDownloadAllDocx').onclick = () => exportDocx(MIXED_VERSIONS, true);
    $('btnDownloadCurrentDocx').onclick = () => {
      if (MIXED_VERSIONS[activeCodeIdx]) exportDocx([MIXED_VERSIONS[activeCodeIdx]], false);
    };
    $('btnDownloadTNMakerCol').onclick = exportTNMakerCSVColumn;
    $('btnDownloadTNMakerRow').onclick = exportTNMakerCSVRow;
  }

  async function loadSelectedSourceExam() {
    const id = $('selSourceExam').value;
    if (!id) return;
    $('mixStatus').textContent = '⏳ Đang nạp đề nguồn…';
    try {
      SOURCE_EXAM = await loadJSON(`data/tests/${encodeURIComponent(id)}.json`);
      syncDefaultQuotas();
      $('mixStatus').textContent = `✅ Đã nạp "${SOURCE_EXAM.title}" (${SOURCE_EXAM.questions.length} câu).`;
      generateMix();
    } catch (e) {
      $('mixStatus').textContent = '❌ Không tải được đề: ' + e.message;
    }
  }

  function handleFileUpload(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj || !Array.isArray(obj.questions)) throw new Error('File JSON không đúng cấu trúc đề.');
        SOURCE_EXAM = obj;
        syncDefaultQuotas();
        $('mixStatus').textContent = `✅ Đã nạp file "${f.name}" (${SOURCE_EXAM.questions.length} câu).`;
        generateMix();
      } catch (err) {
        alert('Lỗi đọc file JSON: ' + err.message);
      }
    };
    reader.readAsText(f, 'utf-8');
  }

  function syncDefaultQuotas() {
    if (!SOURCE_EXAM) return;
    const c1 = SOURCE_EXAM.questions.filter(q => q.part === 1).length;
    const c2 = SOURCE_EXAM.questions.filter(q => q.part === 2).length;
    const c3 = SOURCE_EXAM.questions.filter(q => q.part === 3).length;
    $('inpQuotaP1').value = Math.min(18, c1);
    $('inpQuotaP2').value = Math.min(4, c2);
    $('inpQuotaP3').value = Math.min(6, c3);
  }

  function generateMix() {
    if (!SOURCE_EXAM || !Array.isArray(SOURCE_EXAM.questions)) return;
    const codes = ($('inpCodes').value || '101, 102, 103, 104')
      .split(/[,;\s]+/)
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);
    if (!codes.length) {
      alert('Vui lòng nhập ít nhất 1 mã đề (VD: 101, 102, 103, 104).');
      return;
    }

    const q1Pool = SOURCE_EXAM.questions.filter(q => q.part === 1);
    const q2Pool = SOURCE_EXAM.questions.filter(q => q.part === 2);
    const q3Pool = SOURCE_EXAM.questions.filter(q => q.part === 3);

    const n1 = +$('inpQuotaP1').value > 0 ? Math.min(+$('inpQuotaP1').value, q1Pool.length) : q1Pool.length;
    const n2 = +$('inpQuotaP2').value > 0 ? Math.min(+$('inpQuotaP2').value, q2Pool.length) : q2Pool.length;
    const n3 = +$('inpQuotaP3').value > 0 ? Math.min(+$('inpQuotaP3').value, q3Pool.length) : q3Pool.length;

    const mixQ = $('chkMixQ').checked;
    const mixOpt = $('chkMixOpt').checked;
    const mixStm = $('chkMixStm').checked;

    // Chọn bộ câu gốc chuẩn trước khi trộn thành các mã đề (để các mã đề 101, 102, 103, 104 có CÙNG tập câu hỏi, chỉ khác thứ tự câu & đáp án!)
    const baseSeed = mulberry32(hashStr(SOURCE_EXAM.id + '|base|' + codes.join(',')));
    const baseP1 = (mixQ ? shuffled(q1Pool, baseSeed) : q1Pool).slice(0, n1);
    const baseP2 = (mixQ ? shuffled(q2Pool, baseSeed) : q2Pool).slice(0, n2);
    const baseP3 = (mixQ ? shuffled(q3Pool, baseSeed) : q3Pool).slice(0, n3);

    MIXED_VERSIONS = codes.map(code => {
      const seedFn = mulberry32(hashStr((SOURCE_EXAM.id || 'ex') + '|code|' + code));
      const list1 = mixQ ? shuffled(baseP1, seedFn) : baseP1.slice();
      const list2 = mixQ ? shuffled(baseP2, seedFn) : baseP2.slice();
      const list3 = mixQ ? shuffled(baseP3, seedFn) : baseP3.slice();

      const p1 = list1.map(q => {
        const optMap = mixOpt ? shuffled([0, 1, 2, 3], seedFn) : [0, 1, 2, 3];
        const newAnsIdx = optMap.indexOf(q.answerIndex != null ? q.answerIndex : 0);
        return {
          q,
          optMap,
          options: optMap.map(ci => (q.options && q.options[ci]) || ''),
          ansIdx: newAnsIdx >= 0 ? newAnsIdx : 0,
          ansLetter: LETTERS[newAnsIdx >= 0 ? newAnsIdx : 0]
        };
      });

      const p2 = list2.map(q => {
        const stmMap = mixStm ? shuffled([0, 1, 2, 3], seedFn) : [0, 1, 2, 3];
        const sts = stmMap.map(ci => (q.statements && q.statements[ci]) || { text: '', answer: false });
        const ansArr = sts.map(s => !!s.answer);
        const ansStr = ansArr.map(b => b ? 'Đ' : 'S').join('');
        return { q, stmMap, statements: sts, ansArr, ansStr };
      });

      const p3 = list3.map(q => ({
        q,
        ansVal: q.answer != null ? String(q.answer).replace('.', ',') : ''
      }));

      return { code, p1, p2, p3 };
    });

    activeCodeIdx = 0;
    $('mixOutput').style.display = '';
    const totalQ = (MIXED_VERSIONS[0]?.p1.length || 0) + (MIXED_VERSIONS[0]?.p2.length || 0) + (MIXED_VERSIONS[0]?.p3.length || 0);
    $('mixSummaryBadge').textContent = `Đã tạo ${MIXED_VERSIONS.length} mã đề · ${totalQ} câu/đề`;
    renderTabs();
    renderKeyMatrix();
    renderPaperPreview();
  }

  function renderTabs() {
    const wrap = $('codeTabs');
    wrap.innerHTML = MIXED_VERSIONS.map((v, idx) =>
      `<button type="button" class="code-tab ${idx === activeCodeIdx ? 'active' : ''}" data-idx="${idx}">📄 Mã đề ${escapeHTML(v.code)}</button>`
    ).join('');
    wrap.querySelectorAll('.code-tab').forEach(btn => {
      btn.onclick = () => {
        activeCodeIdx = +btn.dataset.idx;
        renderTabs();
        renderPaperPreview();
      };
    });
  }

  function renderKeyMatrix() {
    if (!MIXED_VERSIONS.length) return;
    const v0 = MIXED_VERSIONS[0];
    const codes = MIXED_VERSIONS.map(v => v.code);
    let html = `<table class="tnmaker-table"><thead><tr><th>Phần / Câu</th>` +
      codes.map(c => `<th>Mã ${escapeHTML(c)}</th>`).join('') + `</tr></thead><tbody>`;

    // Phần I
    v0.p1.forEach((_, i) => {
      html += `<tr><td><b>P1 – Câu ${i + 1}</b></td>` +
        MIXED_VERSIONS.map(v => `<td><b style="color:var(--primary)">${v.p1[i].ansLetter}</b></td>`).join('') + `</tr>`;
    });

    // Phần II
    v0.p2.forEach((_, i) => {
      html += `<tr style="background:var(--card-subtle)"><td><b>P2 – Câu ${i + 1} (a,b,c,d)</b></td>` +
        MIXED_VERSIONS.map(v => `<td><b style="color:var(--ok);letter-spacing:2px">${v.p2[i].ansStr}</b></td>`).join('') + `</tr>`;
    });

    // Phần III
    v0.p3.forEach((_, i) => {
      html += `<tr><td><b>P3 – Câu ${i + 1}</b></td>` +
        MIXED_VERSIONS.map(v => `<td><b>${escapeHTML(v.p3[i].ansVal)}</b></td>`).join('') + `</tr>`;
    });

    html += `</tbody></table>`;
    $('keyMatrixWrap').innerHTML = html;
  }

  function renderPaperPreview() {
    const v = MIXED_VERSIONS[activeCodeIdx];
    if (!v) return;
    const school = ($('inpSchool').value || 'TRƯỜNG THPT CHI LĂNG').trim();
    const heading = ($('inpExamHeading').value || 'KIỂM TRA GIỮA HỌC KÌ I').trim();
    const dur = +$('inpDuration').value || 45;
    const subjTitle = (SOURCE_EXAM && SOURCE_EXAM.title) || 'MÔN HÓA HỌC 12';

    let html = `
      <table class="paper-head-tbl">
        <tr>
          <td style="width:44%">
            <div><b>${escapeHTML(school)}</b></div>
            <div><i>(Đề thi có đủ ${v.p1.length + v.p2.length + v.p3.length} câu)</i></div>
          </td>
          <td style="width:56%">
            <div><b>${escapeHTML(heading)}</b></div>
            <div><b>${escapeHTML(subjTitle.toUpperCase())}</b></div>
            <div><i>Thời gian làm bài: ${dur} phút (không kể thời gian phát đề)</i></div>
            <div class="paper-code-box">Mã đề: ${escapeHTML(v.code)}</div>
          </td>
        </tr>
      </table>
      <div style="border-bottom:1.5px solid #000;padding-bottom:8px;margin-bottom:14px">
        <b>Họ và tên thí sinh:</b> ............................................................................ <b>Lớp:</b> ................... <b>SBD:</b> ...................
      </div>`;

    if (v.p1.length) {
      html += `<div style="margin:12px 0 8px"><b>PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn (${v.p1.length} câu).</b> <i>Thí sinh trả lời từ câu 1 đến câu ${v.p1.length}. Mỗi câu hỏi thí sinh chỉ chọn một phương án.</i></div>`;
      v.p1.forEach((item, idx) => {
        html += `<div style="margin:8px 0">
          <div><b>Câu ${idx + 1}:</b> ${sanitizeHTML(item.q.content)}</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:4px 16px;margin-top:4px">
            ${item.options.map((op, oi) => `<div><b>${LETTERS[oi]}.</b> ${sanitizeHTML(op)}</div>`).join('')}
          </div>
        </div>`;
      });
    }

    if (v.p2.length) {
      html += `<div style="margin:16px 0 8px"><b>PHẦN II. Câu trắc nghiệm đúng sai (${v.p2.length} câu).</b> <i>Thí sinh trả lời từ câu 1 đến câu ${v.p2.length}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.</i></div>`;
      v.p2.forEach((item, idx) => {
        html += `<div style="margin:10px 0">
          <div><b>Câu ${idx + 1}:</b> ${sanitizeHTML(item.q.content)}</div>
          <div style="margin-top:4px;padding-left:10px">
            ${item.statements.map((st, si) => `<div style="margin:3px 0"><b>${SUB_LETTERS[si]})</b> ${sanitizeHTML(st.text)}</div>`).join('')}
          </div>
        </div>`;
      });
    }

    if (v.p3.length) {
      html += `<div style="margin:16px 0 8px"><b>PHẦN III. Câu trắc nghiệm trả lời ngắn (${v.p3.length} câu).</b> <i>Thí sinh trả lời từ câu 1 đến câu ${v.p3.length}.</i></div>`;
      v.p3.forEach((item, idx) => {
        html += `<div style="margin:10px 0">
          <div><b>Câu ${idx + 1}:</b> ${sanitizeHTML(item.q.content)}</div>
          <div style="margin-top:4px"><i>Đáp số: ..............................</i></div>
        </div>`;
      });
    }

    html += `<div style="text-align:center;font-weight:bold;margin-top:22px">--- HẾT ---</div>`;
    $('paperPreview').innerHTML = html;
  }

  /* ---------- Xuất CSV chuẩn TNMaker (Theo Cột Mã Đề & Theo Dòng Mã Đề) ---------- */
  function downloadCSV(filename, lines) {
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }

  function exportTNMakerCSVColumn() {
    if (!MIXED_VERSIONS.length) return;
    const v0 = MIXED_VERSIONS[0];
    const codes = MIXED_VERSIONS.map(v => v.code);
    const esc = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const lines = [];
    lines.push(['Cau_Hoi', ...codes.map(c => 'Ma_' + c)].map(esc).join(','));

    // Phần I
    v0.p1.forEach((_, i) => {
      lines.push([`P1_Cau_${i + 1}`, ...MIXED_VERSIONS.map(v => v.p1[i].ansLetter)].map(esc).join(','));
    });

    // Phần II (Ghi cả chuỗi ĐSĐS lẫn tách từng ý a, b, c, d cho TNMaker)
    v0.p2.forEach((_, i) => {
      lines.push([`P2_Cau_${i + 1}_Chuoi`, ...MIXED_VERSIONS.map(v => v.p2[i].ansStr)].map(esc).join(','));
      SUB_LETTERS.forEach((sl, si) => {
        lines.push([`P2_Cau_${i + 1}${sl}`, ...MIXED_VERSIONS.map(v => v.p2[i].ansArr[si] ? 'Đ' : 'S')].map(esc).join(','));
      });
    });

    // Phần III
    v0.p3.forEach((_, i) => {
      lines.push([`P3_Cau_${i + 1}`, ...MIXED_VERSIONS.map(v => v.p3[i].ansVal)].map(esc).join(','));
    });

    downloadCSV(`DapAn_TNMaker_TheoCot_${SOURCE_EXAM.id || 'DeThi'}.csv`, lines);
  }

  function exportTNMakerCSVRow() {
    if (!MIXED_VERSIONS.length) return;
    const v0 = MIXED_VERSIONS[0];
    const esc = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const headers = ['Ma_De'];
    v0.p1.forEach((_, i) => headers.push(`P1_C${i + 1}`));
    v0.p2.forEach((_, i) => headers.push(`P2_C${i + 1}`));
    v0.p3.forEach((_, i) => headers.push(`P3_C${i + 1}`));

    const lines = [headers.map(esc).join(',')];
    MIXED_VERSIONS.forEach(v => {
      const row = [v.code];
      v.p1.forEach(x => row.push(x.ansLetter));
      v.p2.forEach(x => row.push(x.ansStr));
      v.p3.forEach(x => row.push(x.ansVal));
      lines.push(row.map(esc).join(','));
    });

    downloadCSV(`DapAn_TNMaker_TheoDong_${SOURCE_EXAM.id || 'DeThi'}.csv`, lines);
  }

  /* ---------- Xuất File Word (.DOCX OpenXML) có giữ sub/sup & ngắt trang ---------- */
  function cleanXmlText(v) {
    return Array.from(String(v ?? '').normalize('NFC')).filter(c => {
      const p = c.codePointAt(0);
      return p === 9 || p === 10 || p === 13 || (p >= 32 && p <= 0xd7ff) || (p >= 0xe000 && p <= 0xfffd) || (p >= 0x10000 && p <= 0x10ffff);
    }).join('').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function htmlToDocxRuns(htmlStr, defaultBold = false) {
    let s = String(htmlStr || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/tr\s*>/gi, '\n')
      .replace(/<\/td\s*>/gi, '   |   ')
      .replace(/<\/th\s*>/gi, '   |   ')
      .replace(/<img[^>]*>/gi, '[Hình minh họa]');

    // Tách token theo thẻ sub, sup, strong, b, em, i
    const tokens = s.split(/(<\/?(?:sub|sup|strong|b|em|i)>)/gi);
    let b = defaultBold, i = false, sub = false, sup = false;
    let out = '';

    for (const tok of tokens) {
      const low = tok.toLowerCase();
      if (low === '<b>' || low === '<strong>') { b = true; continue; }
      if (low === '</b>' || low === '</strong>') { b = defaultBold; continue; }
      if (low === '<i>' || low === '<em>') { i = true; continue; }
      if (low === '</i>' || low === '</em>') { i = false; continue; }
      if (low === '<sub>') { sub = true; sup = false; continue; }
      if (low === '</sub>') { sub = false; continue; }
      if (low === '<sup>') { sup = true; sub = false; continue; }
      if (low === '</sup>') { sup = false; continue; }

      // Loại bỏ các thẻ HTML còn lại
      const plain = tok.replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;|&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
      if (!plain) continue;

      let rPr = '<w:rPr>';
      if (b) rPr += '<w:b/>';
      if (i) rPr += '<w:i/>';
      if (sub) rPr += '<w:vertAlign w:val="subscript"/>';
      if (sup) rPr += '<w:vertAlign w:val="superscript"/>';
      rPr += '</w:rPr>';

      const lines = plain.split('\n');
      lines.forEach((ln, idx) => {
        out += `<w:r>${rPr}${idx > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${cleanXmlText(ln)}</w:t></w:r>`;
      });
    }
    return out;
  }

  function makePara(runsXml, align = 'both', spaceAfter = 80, pageBreakBefore = false) {
    return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:after="${spaceAfter}" w:line="276" w:lineRule="auto"/>${pageBreakBefore ? '<w:pageBreakBefore/>' : ''}</w:pPr>${runsXml}</w:p>`;
  }

  function buildZipBytes(files) {
    const enc = new TextEncoder(), parts = [], directory = []; let offset = 0;
    const table = Array.from({ length: 256 }, (_, x) => { for (let j = 0; j < 8; j++) x = x & 1 ? 0xedb88320 ^ (x >>> 1) : x >>> 1; return x >>> 0; });
    const crc = bytes => { let c = 0xffffffff; for (const b of bytes) c = table[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const header = size => { const b = new Uint8Array(size); return { b, d: new DataView(b.buffer) }; };
    for (const [path, text] of Object.entries(files)) {
      const name = enc.encode(path), data = enc.encode(text), sum = crc(data), h = header(30);
      h.d.setUint32(0, 0x04034b50, true); h.d.setUint16(4, 20, true); h.d.setUint16(6, 0x800, true); h.d.setUint16(12, 33, true);
      h.d.setUint32(14, sum, true); h.d.setUint32(18, data.length, true); h.d.setUint32(22, data.length, true); h.d.setUint16(26, name.length, true);
      parts.push(h.b, name, data);
      const c = header(46);
      c.d.setUint32(0, 0x02014b50, true); c.d.setUint16(4, 20, true); c.d.setUint16(6, 20, true); c.d.setUint16(8, 0x800, true); c.d.setUint16(14, 33, true);
      c.d.setUint32(16, sum, true); c.d.setUint32(20, data.length, true); c.d.setUint32(24, data.length, true); c.d.setUint16(28, name.length, true); c.d.setUint32(42, offset, true);
      directory.push(c.b, name); offset += 30 + name.length + data.length;
    }
    const directorySize = directory.reduce((s, p) => s + p.length, 0), end = header(22), count = Object.keys(files).length;
    end.d.setUint32(0, 0x06054b50, true); end.d.setUint16(8, count, true); end.d.setUint16(10, count, true); end.d.setUint32(12, directorySize, true); end.d.setUint32(16, offset, true);
    const out = new Uint8Array(offset + directorySize + 22); let pos = 0;
    for (const p of [...parts, ...directory, end.b]) { out.set(p, pos); pos += p.length; }
    return out;
  }

  function exportDocx(versions, includeMasterKey = true) {
    if (!versions || !versions.length) return;
    const school = ($('inpSchool').value || 'TRƯỜNG THPT CHI LĂNG').trim();
    const heading = ($('inpExamHeading').value || 'KIỂM TRA GIỮA HỌC KÌ I').trim();
    const dur = +$('inpDuration').value || 45;
    const subjTitle = ((SOURCE_EXAM && SOURCE_EXAM.title) || 'ĐỀ KIỂM TRA').toUpperCase();

    const bodyParas = [];

    versions.forEach((v, vIdx) => {
      const isNewPage = vIdx > 0;
      bodyParas.push(makePara(htmlToDocxRuns(`${school}   —   ${heading}`, true), 'center', 40, isNewPage));
      bodyParas.push(makePara(htmlToDocxRuns(`${subjTitle}   |   MÃ ĐỀ: ${v.code}`, true), 'center', 40, false));
      bodyParas.push(makePara(htmlToDocxRuns(`Thời gian làm bài: ${dur} phút (không kể thời gian phát đề)`, false), 'center', 120, false));
      bodyParas.push(makePara(htmlToDocxRuns(`Họ và tên thí sinh: ..................................................................... Lớp: ............... SBD: ...............`, true), 'left', 160, false));

      if (v.p1.length) {
        bodyParas.push(makePara(htmlToDocxRuns(`PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn (${v.p1.length} câu). Thí sinh trả lời từ câu 1 đến câu ${v.p1.length}.`, true), 'both', 100, false));
        v.p1.forEach((item, idx) => {
          bodyParas.push(makePara(htmlToDocxRuns(`<b>Câu ${idx + 1}: </b>` + item.q.content, false), 'both', 40, false));
          const optsLine = item.options.map((op, oi) => `<b>${LETTERS[oi]}. </b>${op}`).join('      ');
          bodyParas.push(makePara(htmlToDocxRuns(optsLine, false), 'both', 100, false));
        });
      }

      if (v.p2.length) {
        bodyParas.push(makePara(htmlToDocxRuns(`PHẦN II. Câu trắc nghiệm đúng sai (${v.p2.length} câu). Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.`, true), 'both', 100, false));
        v.p2.forEach((item, idx) => {
          bodyParas.push(makePara(htmlToDocxRuns(`<b>Câu ${idx + 1}: </b>` + item.q.content, false), 'both', 40, false));
          item.statements.forEach((st, si) => {
            bodyParas.push(makePara(htmlToDocxRuns(`<b>${SUB_LETTERS[si]}) </b>` + st.text, false), 'both', 40, false));
          });
        });
      }

      if (v.p3.length) {
        bodyParas.push(makePara(htmlToDocxRuns(`PHẦN III. Câu trắc nghiệm trả lời ngắn (${v.p3.length} câu).`, true), 'both', 100, false));
        v.p3.forEach((item, idx) => {
          bodyParas.push(makePara(htmlToDocxRuns(`<b>Câu ${idx + 1}: </b>` + item.q.content, false), 'both', 40, false));
          bodyParas.push(makePara(htmlToDocxRuns(`<i>Đáp số: ..............................</i>`, false), 'left', 100, false));
        });
      }

      bodyParas.push(makePara(htmlToDocxRuns(`--- HẾT MÃ ĐỀ ${v.code} ---`, true), 'center', 180, false));
    });

    if (includeMasterKey && versions.length) {
      bodyParas.push(makePara(htmlToDocxRuns(`BẢNG ĐÁP ÁN TỔNG HỢP CÁC MÃ ĐỀ (${versions.map(v => v.code).join(', ')})`, true), 'center', 140, true));
      versions.forEach(v => {
        bodyParas.push(makePara(htmlToDocxRuns(`MÃ ĐỀ ${v.code}:`, true), 'left', 60, false));
        if (v.p1.length) {
          const p1Key = v.p1.map((x, i) => `${i + 1}.${x.ansLetter}`).join('   ');
          bodyParas.push(makePara(htmlToDocxRuns(`<b>Phần I: </b>` + p1Key, false), 'both', 60, false));
        }
        if (v.p2.length) {
          const p2Key = v.p2.map((x, i) => `Câu ${i + 1}: ${x.ansStr}`).join('   |   ');
          bodyParas.push(makePara(htmlToDocxRuns(`<b>Phần II: </b>` + p2Key, false), 'both', 60, false));
        }
        if (v.p3.length) {
          const p3Key = v.p3.map((x, i) => `Câu ${i + 1}: ${x.ansVal}`).join('   |   ');
          bodyParas.push(makePara(htmlToDocxRuns(`<b>Phần III: </b>` + p3Key, false), 'both', 120, false));
        }
      });
    }

    const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const files = {
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
      '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/_rels/document.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      'word/styles.xml': '<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="' + w + '"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:color w:val="000000"/><w:sz w:val="24"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>',
      'word/document.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="' + w + '"><w:body>' + bodyParas.join('') + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="1134"/></w:sectPr></w:body></w:document>'
    };

    const bytes = buildZipBytes(files);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const suffix = versions.length === 1 ? `Ma_${versions[0].code}` : `${versions.length}_MaDe`;
    a.download = `De_In_Giay_${(SOURCE_EXAM && SOURCE_EXAM.id) || 'TronDe'}_${suffix}.docx`;
    a.click();
  }

  boot();
})();
