/* tronde.js – Bộ công cụ Trộn Đề In Giấy Nhiều Mã Đề (Chuẩn trondetracnghiem.com & McMIX):
 * - Khắc phục triệt để 100% lỗi giãn chữ (Justify + <w:br/>) trong Word bằng cách tách mỗi dòng <br>
 *   thành một đoạn <w:p> độc lập + bật <w:doNotExpandShiftReturn/> trong word/settings.xml
 * - Chuyển đổi bảng <table> HTML trong câu hỏi thành bảng <w:tbl> kẻ ô chuẩn trong Word
 * - Căn chỉnh A, B, C, D tự động (Bảng 4 cột / 2 cột / 4 dòng riêng thẳng hàng tuyệt đối)
 * - Hỗ trợ xuất cả Bản Đề Học Sinh (.docx) và Bản Đề Giáo Viên có Tô đỏ & Gạch chân đáp án (.docx)
 * - Bảng đáp án tổng hợp kẻ ô chuẩn Word ở cuối đề + Xuất CSV/Excel chuẩn TNMaker · Kimkenpkl
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const LETTERS = ['A', 'B', 'C', 'D'];
  const SUB_LETTERS = ['a', 'b', 'c', 'd'];

  let EXAMS_META = [];
  let SOURCE_EXAM = null;
  let MIXED_VERSIONS = [];
  let activeCodeIdx = 0;

  async function boot() {
    if ($('btnTheme')) {
      const sync = () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        $('btnTheme').textContent = isDark ? 'THEME: MONOCHROM DARK' : 'THEME: BARYTA LIGHT';
      };
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

    document.querySelectorAll('input[name="mixScope"]').forEach(r => {
      r.onchange = () => {
        const isFull = r.value === 'full' && r.checked;
        if ($('lblScopeFull')) $('lblScopeFull').classList.toggle('active', isFull);
        if ($('lblScopeCustom')) $('lblScopeCustom').classList.toggle('active', !isFull);
        if ($('customQuotaWrap')) $('customQuotaWrap').style.display = isFull ? 'none' : '';
        generateMix();
      };
    });

    document.querySelectorAll('.btnPresetCode').forEach(btn => {
      btn.onclick = () => { $('inpCodes').value = btn.dataset.codes; generateMix(); };
    });

    $('btnGenerateMix').onclick = generateMix;
    $('btnDownloadAllDocx').onclick = () => exportDocx(MIXED_VERSIONS, true, false);
    if ($('btnDownloadTeacherDocx')) {
      $('btnDownloadTeacherDocx').onclick = () => exportDocx(MIXED_VERSIONS, true, true);
    }
    $('btnDownloadCurrentDocx').onclick = () => {
      if (MIXED_VERSIONS[activeCodeIdx]) exportDocx([MIXED_VERSIONS[activeCodeIdx]], true, false);
    };
    $('btnDownloadTNMakerCol').onclick = exportTNMakerCSVColumn;
    $('btnDownloadTNMakerRow').onclick = exportTNMakerCSVRow;
  }

  async function loadSelectedSourceExam() {
    const id = $('selSourceExam').value;
    if (!id) return;
    $('mixStatus').textContent = 'Đang nạp đề nguồn…';
    try {
      SOURCE_EXAM = await loadJSON(`data/tests/${encodeURIComponent(id)}.json`);
      syncDefaultQuotas();
      $('mixStatus').textContent = `Đã nạp "${SOURCE_EXAM.title}" (${SOURCE_EXAM.questions.length} câu).`;
      generateMix();
    } catch (e) {
      $('mixStatus').textContent = 'Không tải được đề: ' + e.message;
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
        $('mixStatus').textContent = `Đã nạp file "${f.name}" (${SOURCE_EXAM.questions.length} câu).`;
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
    if ($('hintFullCount')) {
      $('hintFullCount').textContent = `Trộn đủ toàn bộ ${SOURCE_EXAM.questions.length} câu (Phần I: ${c1} câu · Phần II: ${c2} câu · Phần III: ${c3} câu).`;
    }
    $('inpQuotaP1').value = Math.min(18, c1);
    $('inpQuotaP2').value = Math.min(4, c2);
    $('inpQuotaP3').value = Math.min(6, c3);
    $('inpDuration').value = SOURCE_EXAM.durationMin || 90;
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

    const scopeRadio = document.querySelector('input[name="mixScope"]:checked');
    const isFullScope = !scopeRadio || scopeRadio.value === 'full';

    const n1 = isFullScope ? q1Pool.length : Math.min(Math.max(0, +$('inpQuotaP1').value || 0), q1Pool.length);
    const n2 = isFullScope ? q2Pool.length : Math.min(Math.max(0, +$('inpQuotaP2').value || 0), q2Pool.length);
    const n3 = isFullScope ? q3Pool.length : Math.min(Math.max(0, +$('inpQuotaP3').value || 0), q3Pool.length);

    const mixQ = $('chkMixQ').checked;
    const mixOpt = $('chkMixOpt').checked;
    const mixStm = $('chkMixStm').checked;

    const baseSeed = mulberry32(hashStr((SOURCE_EXAM.id || 'ex') + '|base|' + codes.join(',')));
    const baseP1 = (isFullScope ? q1Pool : (mixQ ? shuffled(q1Pool, baseSeed) : q1Pool)).slice(0, n1);
    const baseP2 = (isFullScope ? q2Pool : (mixQ ? shuffled(q2Pool, baseSeed) : q2Pool)).slice(0, n2);
    const baseP3 = (isFullScope ? q3Pool : (mixQ ? shuffled(q3Pool, baseSeed) : q3Pool)).slice(0, n3);

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
    $('mixSummaryBadge').textContent = `Đã trộn ${MIXED_VERSIONS.length} mã đề · ${totalQ} câu/đề`;
    renderTabs();
    renderKeyMatrix();
    renderPaperPreview();
  }

  function renderTabs() {
    const wrap = $('codeTabs');
    wrap.innerHTML = MIXED_VERSIONS.map((v, idx) =>
      `<button type="button" class="code-tab ${idx === activeCodeIdx ? 'active' : ''}" data-idx="${idx}">Mã đề ${escapeHTML(v.code)}</button>`
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

    v0.p1.forEach((_, i) => {
      html += `<tr><td><b>P1 – Câu ${i + 1}</b></td>` +
        MIXED_VERSIONS.map(v => `<td><b>${v.p1[i].ansLetter}</b></td>`).join('') + `</tr>`;
    });

    v0.p2.forEach((_, i) => {
      html += `<tr style="background:var(--card-subtle)"><td><b>P2 – Câu ${i + 1} (a,b,c,d)</b></td>` +
        MIXED_VERSIONS.map(v => `<td><b style="color:var(--ok);letter-spacing:2px">${v.p2[i].ansStr}</b></td>`).join('') + `</tr>`;
    });

    v0.p3.forEach((_, i) => {
      html += `<tr><td><b>P3 – Câu ${i + 1}</b></td>` +
        MIXED_VERSIONS.map(v => `<td><b>${escapeHTML(v.p3[i].ansVal)}</b></td>`).join('') + `</tr>`;
    });

    html += `</tbody></table>`;
    $('keyMatrixWrap').innerHTML = html;
  }

  function plainOptionLen(optHtml) {
    const s = String(optHtml || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    const imgCount = (String(optHtml || '').match(/<img\b/gi) || []).length;
    return s.length + imgCount * 10;
  }

  function decideOptionCols(options) {
    const maxLen = Math.max(...(options || []).map(plainOptionLen), 0);
    if (maxLen <= 16) return 4;
    if (maxLen <= 38) return 2;
    return 1;
  }

  function ensureDotEnd(htmlStr) {
    const s = String(htmlStr || '').trim();
    if (!s) return '';
    if (/[.!?;:]$/.test(s) || s.endsWith('>')) return s;
    return s + '.';
  }

  function renderPaperPreview() {
    const v = MIXED_VERSIONS[activeCodeIdx];
    if (!v) return;
    const school = ($('inpSchool').value || 'TRƯỜNG THPT CHI LĂNG').trim();
    const heading = ($('inpExamHeading').value || 'KIỂM TRA GIỮA HỌC KÌ I').trim();
    const dur = +$('inpDuration').value || 90;
    const subjTitle = (SOURCE_EXAM && SOURCE_EXAM.title) || 'MÔN HÓA HỌC 12';
    const totalQ = v.p1.length + v.p2.length + v.p3.length;

    let html = `
      <table class="paper-head-tbl">
        <tr>
          <td style="width:42%">
            <div style="font-weight:bold;text-transform:uppercase">${escapeHTML(school)}</div>
            <div style="width:120px;height:1px;background:#000;margin:3px auto 4px"></div>
            <div><i>(Đề có ${totalQ} câu)</i></div>
          </td>
          <td style="width:58%">
            <div style="font-weight:bold;text-transform:uppercase">${escapeHTML(heading)}</div>
            <div style="font-weight:bold;margin-top:2px">${escapeHTML(subjTitle.toUpperCase())}</div>
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
        const cols = decideOptionCols(item.options);
        const gridCls = cols === 4 ? 'paper-opt-grid-4' : (cols === 2 ? 'paper-opt-grid-2' : 'paper-opt-grid-1');
        html += `<div class="paper-q-block">
          <div><b>Câu ${idx + 1}.</b> ${sanitizeHTML(item.q.content)}</div>
          <div class="${gridCls}">
            ${item.options.map((op, oi) => `<div><b>${LETTERS[oi]}.</b> ${sanitizeHTML(ensureDotEnd(op))}</div>`).join('')}
          </div>
        </div>`;
      });
    }

    if (v.p2.length) {
      html += `<div style="margin:16px 0 8px"><b>PHẦN II. Câu trắc nghiệm đúng sai (${v.p2.length} câu).</b> <i>Thí sinh trả lời từ câu 1 đến câu ${v.p2.length}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.</i></div>`;
      v.p2.forEach((item, idx) => {
        html += `<div class="paper-q-block">
          <div><b>Câu ${idx + 1}.</b> ${sanitizeHTML(item.q.content)}</div>
          <div class="paper-opt-grid-1" style="padding-left:6px">
            ${item.statements.map((st, si) => `<div><b>${SUB_LETTERS[si]})</b> ${sanitizeHTML(ensureDotEnd(st.text))}</div>`).join('')}
          </div>
        </div>`;
      });
    }

    if (v.p3.length) {
      html += `<div style="margin:16px 0 8px"><b>PHẦN III. Câu trắc nghiệm trả lời ngắn (${v.p3.length} câu).</b> <i>Thí sinh trả lời từ câu 1 đến câu ${v.p3.length}.</i></div>`;
      v.p3.forEach((item, idx) => {
        html += `<div class="paper-q-block">
          <div><b>Câu ${idx + 1}.</b> ${sanitizeHTML(item.q.content)}</div>
          <div style="margin-top:3px"><i>Đáp số: ..............................</i></div>
        </div>`;
      });
    }

    html += `<div style="text-align:center;font-weight:bold;margin-top:22px">--- HẾT ---</div>`;
    $('paperPreview').innerHTML = html;
  }

  /* ---------- Xuất CSV chuẩn TNMaker ---------- */
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

    v0.p1.forEach((_, i) => {
      lines.push([`P1_Cau_${i + 1}`, ...MIXED_VERSIONS.map(v => v.p1[i].ansLetter)].map(esc).join(','));
    });

    v0.p2.forEach((_, i) => {
      lines.push([`P2_Cau_${i + 1}_Chuoi`, ...MIXED_VERSIONS.map(v => v.p2[i].ansStr)].map(esc).join(','));
      SUB_LETTERS.forEach((sl, si) => {
        lines.push([`P2_Cau_${i + 1}${sl}`, ...MIXED_VERSIONS.map(v => v.p2[i].ansArr[si] ? 'Đ' : 'S')].map(esc).join(','));
      });
    });

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

  /* ==========================================================================
   * XUẤT FILE WORD (.DOCX OPENXML) CHUẨN ĐỀ THI (trondetracnghiem.com / McMIX):
   * 1. Tách mỗi dòng <br> thành 1 đoạn <w:p> riêng biệt -> Tuyệt đối KHÔNG BỊ GIÃN CHỮ!
   * 2. Chuyển bảng <table> HTML trong câu hỏi thành bảng <w:tbl> thật có viền trong Word.
   * 3. Bổ sung word/settings.xml có <w:doNotExpandShiftReturn/>.
   * 4. Hỗ trợ chế độ Giáo Viên (markAnswerKey = true): tô đỏ + gạch chân đáp án đúng ngay trên đề.
   * ========================================================================== */
  function cleanXmlText(v) {
    return Array.from(String(v ?? '').normalize('NFC')).filter(c => {
      const p = c.codePointAt(0);
      return p === 9 || p === 10 || p === 13 || (p >= 32 && p <= 0xd7ff) || (p >= 0xe000 && p <= 0xfffd) || (p >= 0x10000 && p <= 0x10ffff);
    }).join('').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function getPngDimensions(bytes) {
    if (bytes && bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return { w: dv.getUint32(16, false), h: dv.getUint32(20, false) };
    }
    return { w: 120, h: 40 };
  }

  function makeDrawingRunXml(rId, docPrId, cx, cy) {
    return (
      `<w:r><w:drawing>` +
      `<wp:inline distT="0" distB="0" distL="11430" distR="11430">` +
      `<wp:extent cx="${cx}" cy="${cy}"/>` +
      `<wp:docPr id="${docPrId}" name="Img${docPrId}"/>` +
      `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
      `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      `<pic:nvPicPr><pic:cNvPr id="${docPrId}" name="Img${docPrId}"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
      `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
    );
  }

  /* Chuyển 1 dòng HTML đơn lẻ (không chứa <br> hay <table>) thành chuỗi <w:r> */
  function singleLineHtmlToRuns(lineHtml, imgRegistry, defaultBold = false) {
    const s = String(lineHtml || '')
      .replace(/<span\s+class="badge"[^>]*>([\s\S]*?)<\/span>/gi, '[$1] ');

    const tokens = s.split(/(<img\b[^>]*>|<\/?(?:sub|sup|strong|b|em|i|u|red)>)/gi);
    let b = defaultBold, i = false, u = false, red = false, sub = false, sup = false;
    let out = '';

    for (const tok of tokens) {
      if (!tok) continue;
      const low = tok.toLowerCase();
      if (low.startsWith('<img')) {
        const srcM = tok.match(/src="([^"]+)"/i);
        const hM = tok.match(/height\s*:\s*([\d.]+)px/i);
        const wM = tok.match(/width\s*:\s*([\d.]+)px/i);
        if (srcM && imgRegistry && imgRegistry.has(srcM[1])) {
          const info = imgRegistry.get(srcM[1]);
          let targetH_px = hM ? parseFloat(hM[1]) : 0;
          let targetW_px = wM ? parseFloat(wM[1]) : 0;
          if (!targetH_px && !targetW_px) {
            targetH_px = Math.min(180, Math.round(info.h / 2.2));
          }
          if (targetH_px && !targetW_px) {
            targetW_px = Math.round(targetH_px * (info.w / Math.max(1, info.h)));
          } else if (targetW_px && !targetH_px) {
            targetH_px = Math.round(targetW_px * (info.h / Math.max(1, info.w)));
          }
          const cx = Math.max(85000, Math.round(targetW_px * 9100));
          const cy = Math.max(85000, Math.round(targetH_px * 9100));
          info.docPrCounter = (info.docPrCounter || 100) + 1;
          out += makeDrawingRunXml(info.rId, info.docPrCounter, cx, cy);
        }
        continue;
      }
      if (low === '<b>' || low === '<strong>') { b = true; continue; }
      if (low === '</b>' || low === '</strong>') { b = defaultBold; continue; }
      if (low === '<i>' || low === '<em>') { i = true; continue; }
      if (low === '</i>' || low === '</em>') { i = false; continue; }
      if (low === '<u>') { u = true; continue; }
      if (low === '</u>') { u = false; continue; }
      if (low === '<red>') { red = true; continue; }
      if (low === '</red>') { red = false; continue; }
      if (low === '<sub>') { sub = true; sup = false; continue; }
      if (low === '</sub>') { sub = false; continue; }
      if (low === '<sup>') { sup = true; sub = false; continue; }
      if (low === '</sup>') { sup = false; continue; }

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
      if (u) rPr += '<w:u w:val="single"/>';
      if (red) rPr += '<w:color w:val="D91E18"/>';
      if (sub) rPr += '<w:vertAlign w:val="subscript"/>';
      if (sup) rPr += '<w:vertAlign w:val="superscript"/>';
      rPr += '</w:rPr>';

      out += `<w:r>${rPr}<w:t xml:space="preserve">${cleanXmlText(plain)}</w:t></w:r>`;
    }
    return out;
  }

  function makePara(runsXml, align = 'both', spaceAfter = 50, pageBreakBefore = false) {
    return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:after="${spaceAfter}" w:line="264" w:lineRule="auto"/>${pageBreakBefore ? '<w:pageBreakBefore/>' : ''}</w:pPr>${runsXml}</w:p>`;
  }

  /* Chuyển bảng <table>...</table> HTML trong câu hỏi thành bảng <w:tbl> kẻ viền chuẩn trong Word */
  function convertHtmlTableToWordXml(tableHtml, imgRegistry) {
    const rows = [];
    for (const trM of tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [];
      for (const tdM of trM[1].matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
        cells.push({ isHeader: tdM[1].toLowerCase() === 'th', html: tdM[2] });
      }
      if (cells.length) rows.push(cells);
    }
    if (!rows.length) return '';

    const borders = '<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="666666"/><w:left w:val="single" w:sz="4" w:space="0" w:color="666666"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="666666"/><w:right w:val="single" w:sz="4" w:space="0" w:color="666666"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="666666"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="666666"/></w:tblBorders>';
    const tblPr = `<w:tblPr><w:tblW w:w="5000" w:type="pct"/>${borders}<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>`;

    const trsXml = rows.map(cells => {
      const wPct = Math.floor(5000 / Math.max(1, cells.length));
      const tcsXml = cells.map(c => {
        const subLines = String(c.html || '').split(/<br\s*\/?>/gi).map(x => x.trim()).filter(Boolean);
        const paras = (subLines.length ? subLines : ['']).map(ln =>
          makePara(singleLineHtmlToRuns(ln, imgRegistry, c.isHeader), 'center', 20, false)
        ).join('');
        const shd = c.isHeader ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>' : '';
        return `<w:tc><w:tcPr><w:tcW w:w="${wPct}" w:type="pct"/>${shd}</w:tcPr>${paras}</w:tc>`;
      }).join('');
      return `<w:tr>${tcsXml}</w:tr>`;
    }).join('');

    return `<w:tbl>${tblPr}${trsXml}</w:tbl>`;
  }

  /* Tách câu dẫn có nhiều dòng (<br>) hoặc có bảng (<table>) thành chuỗi các <w:p> và <w:tbl> độc lập!
   * Tuyệt đối KHÔNG dùng <w:br/> trong đoạn justify để không bao giờ bị giãn khoảng cách chữ!
   */
  function renderStemBlocksToWordXml(prefixHtml, contentHtml, imgRegistry) {
    let s = String(contentHtml || '')
      .replace(/<span\s+class="badge"[^>]*>([\s\S]*?)<\/span>\s*(?:<br\s*\/?>)?/gi, '[$1] ');

    // Tách theo khối <table>...</table> hoặc <div style="background:#1E293B...">...</div> (code block Tin học)
    const parts = s.split(/(<table\b[\s\S]*?<\/table>)/gi);
    const outBlocks = [];
    let prefixUsed = false;

    for (const part of parts) {
      if (!part || !part.trim()) continue;
      if (/^<table\b/i.test(part.trim())) {
        outBlocks.push(convertHtmlTableToWordXml(part, imgRegistry));
        continue;
      }
      // Tách từng dòng theo <br> hoặc \n thành các đoạn <w:p> riêng biệt!
      const lines = part.split(/<br\s*\/?>|\r?\n/gi).map(x => x.trim()).filter(Boolean);
      lines.forEach(ln => {
        const fullLine = !prefixUsed ? (prefixHtml + ln) : ln;
        prefixUsed = true;
        // Nếu dòng là phương trình phản ứng (có mũi tên →) thì dùng align='left' để phương trình đẹp tự nhiên
        const isReactionLine = ln.includes('→') || ln.includes('⟶') || ln.includes('<img');
        outBlocks.push(makePara(singleLineHtmlToRuns(fullLine, imgRegistry, false), isReactionLine ? 'left' : 'both', 45, false));
      });
    }

    if (!prefixUsed) {
      outBlocks.push(makePara(singleLineHtmlToRuns(prefixHtml, imgRegistry, false), 'both', 45, false));
    }
    return outBlocks.join('');
  }

  function makeOptionsTableXml(options, cols, imgRegistry, correctIdx = -1) {
    const noBorder = '<w:tblBorders><w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/></w:tblBorders>';
    const tblPr = `<w:tblPr><w:tblW w:w="5000" w:type="pct"/>${noBorder}<w:tblCellMar><w:top w:w="15" w:type="dxa"/><w:bottom w:w="15" w:type="dxa"/><w:left w:w="20" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr>`;

    const formatOptLabel = oi => {
      if (oi === correctIdx) return `<b><u><red>${LETTERS[oi]}.</red></u> </b>`;
      return `<b>${LETTERS[oi]}. </b>`;
    };

    const cellXml = (oi, widthPct) => {
      const optRuns = singleLineHtmlToRuns(formatOptLabel(oi) + ensureDotEnd(options[oi] || ''), imgRegistry, false);
      return `<w:tc><w:tcPr><w:tcW w:w="${widthPct}" w:type="pct"/></w:tcPr>${makePara(optRuns, 'left', 35, false)}</w:tc>`;
    };

    if (cols === 4) {
      return `<w:tbl>${tblPr}<w:tr>${cellXml(0, 1250)}${cellXml(1, 1250)}${cellXml(2, 1250)}${cellXml(3, 1250)}</w:tr></w:tbl>`;
    }
    if (cols === 2) {
      return `<w:tbl>${tblPr}<w:tr>${cellXml(0, 2500)}${cellXml(1, 2500)}</w:tr><w:tr>${cellXml(2, 2500)}${cellXml(3, 2500)}</w:tr></w:tbl>`;
    }
    return options.map((op, oi) =>
      makePara(singleLineHtmlToRuns(formatOptLabel(oi) + ensureDotEnd(op), imgRegistry, false), 'both', 35, false)
    ).join('');
  }

  function makeExamHeaderTableXml(school, heading, subjTitle, dur, totalQ, code, isNewPage, isTeacherCopy) {
    const noBorder = '<w:tblBorders><w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/></w:tblBorders>';
    const tblPr = `<w:tblPr><w:tblW w:w="5000" w:type="pct"/>${noBorder}</w:tblPr>`;
    const leftCell = `<w:tc><w:tcPr><w:tcW w:w="2100" w:type="pct"/></w:tcPr>` +
      makePara(singleLineHtmlToRuns(`<b>${escapeHTML(school.toUpperCase())}</b>`, null, true), 'center', 20, isNewPage) +
      makePara(singleLineHtmlToRuns(`<i>(Đề có ${totalQ} câu)</i>`, null, false), 'center', 40, false) +
      `</w:tc>`;
    const codeTag = isTeacherCopy ? `Mã đề: ${escapeHTML(code)} (BẢN ĐÁP ÁN GV)` : `Mã đề: ${escapeHTML(code)}`;
    const rightCell = `<w:tc><w:tcPr><w:tcW w:w="2900" w:type="pct"/></w:tcPr>` +
      makePara(singleLineHtmlToRuns(`<b>${escapeHTML(heading.toUpperCase())}</b>`, null, true), 'center', 20, false) +
      makePara(singleLineHtmlToRuns(`<b>${escapeHTML(subjTitle.toUpperCase())}</b>`, null, true), 'center', 20, false) +
      makePara(singleLineHtmlToRuns(`<i>Thời gian làm bài: ${dur} phút (không kể thời gian phát đề)</i>`, null, false), 'center', 40, false) +
      makePara(singleLineHtmlToRuns(`<b>${codeTag}</b>`, null, true), 'center', 60, false) +
      `</w:tc>`;
    return `<w:tbl>${tblPr}<w:tr>${leftCell}${rightCell}</w:tr></w:tbl>`;
  }

  /* Tạo Bảng Đáp Án Kẻ Ô chuẩn Word ở trang cuối */
  function makeMasterKeyTableWordXml(versions) {
    if (!versions || !versions.length) return '';
    const v0 = versions[0];
    const borders = '<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="333333"/><w:left w:val="single" w:sz="4" w:space="0" w:color="333333"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="333333"/><w:right w:val="single" w:sz="4" w:space="0" w:color="333333"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="333333"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="333333"/></w:tblBorders>';
    const tblPr = `<w:tblPr><w:tblW w:w="5000" w:type="pct"/>${borders}<w:tblCellMar><w:top w:w="45" w:type="dxa"/><w:bottom w:w="45" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>`;

    const colW = Math.floor(5000 / (versions.length + 1));
    const cell = (txt, bold = false, bg = '') => {
      const shd = bg ? `<w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>` : '';
      return `<w:tc><w:tcPr><w:tcW w:w="${colW}" w:type="pct"/>${shd}</w:tcPr>${makePara(singleLineHtmlToRuns(txt, null, bold), 'center', 20, false)}</w:tc>`;
    };

    const rows = [];
    rows.push(`<w:tr>${cell('Câu / Phần', true, 'EAEAEA')}${versions.map(v => cell('Mã ' + escapeHTML(v.code), true, 'EAEAEA')).join('')}</w:tr>`);

    v0.p1.forEach((_, i) => {
      rows.push(`<w:tr>${cell(`P1 – Câu ${i + 1}`, true)}${versions.map(v => cell(v.p1[i].ansLetter, true)).join('')}</w:tr>`);
    });
    v0.p2.forEach((_, i) => {
      rows.push(`<w:tr>${cell(`P2 – Câu ${i + 1}`, true, 'F9F9F9')}${versions.map(v => cell(v.p2[i].ansStr, true, 'F9F9F9')).join('')}</w:tr>`);
    });
    v0.p3.forEach((_, i) => {
      rows.push(`<w:tr>${cell(`P3 – Câu ${i + 1}`, true)}${versions.map(v => cell(escapeHTML(v.p3[i].ansVal), true)).join('')}</w:tr>`);
    });

    return `<w:tbl>${tblPr}${rows.join('')}</w:tbl>`;
  }

  function buildZipBytesMixed(files) {
    const enc = new TextEncoder(), parts = [], directory = []; let offset = 0;
    const table = Array.from({ length: 256 }, (_, x) => { for (let j = 0; j < 8; j++) x = x & 1 ? 0xedb88320 ^ (x >>> 1) : x >>> 1; return x >>> 0; });
    const crc = bytes => { let c = 0xffffffff; for (const b of bytes) c = table[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const header = size => { const b = new Uint8Array(size); return { b, d: new DataView(b.buffer) }; };
    for (const [path, content] of Object.entries(files)) {
      const name = enc.encode(path);
      const data = content instanceof Uint8Array ? content : enc.encode(String(content));
      const sum = crc(data), h = header(30);
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

  async function collectAndFetchImages(versions) {
    const urls = new Set();
    const scan = s => {
      if (!s) return;
      for (const m of String(s).matchAll(/src="([^"]+)"/gi)) {
        urls.add(m[1]);
      }
    };
    versions.forEach(v => {
      v.p1.forEach(it => { scan(it.q.content); it.options.forEach(scan); });
      v.p2.forEach(it => { scan(it.q.content); it.statements.forEach(st => scan(st.text)); });
      v.p3.forEach(it => { scan(it.q.content); });
    });

    const registry = new Map();
    let idx = 1;
    await Promise.allSettled(Array.from(urls).map(async src => {
      try {
        const r = await fetch(src);
        if (!r.ok) return;
        const buf = new Uint8Array(await r.arrayBuffer());
        if (!buf.length) return;
        const ext = src.toLowerCase().endsWith('.jpeg') || src.toLowerCase().endsWith('.jpg') ? 'jpeg' : 'png';
        const dims = ext === 'png' ? getPngDimensions(buf) : { w: 220, h: 140 };
        const myIdx = idx++;
        registry.set(src, {
          rId: `rIdImg${myIdx}`,
          mediaName: `media/img${myIdx}.${ext}`,
          ext,
          bytes: buf,
          w: dims.w,
          h: dims.h,
          docPrCounter: myIdx * 1000
        });
      } catch (e) {}
    }));
    return registry;
  }

  async function exportDocx(versions, includeMasterKey = true, markTeacherKey = false) {
    if (!versions || !versions.length) return;
    const btnAll = markTeacherKey ? $('btnDownloadTeacherDocx') : $('btnDownloadAllDocx');
    const prevTxt = btnAll ? btnAll.textContent : '';
    if (btnAll) { btnAll.disabled = true; btnAll.textContent = 'Đang kết xuất Word chuẩn…'; }

    const imgRegistry = await collectAndFetchImages(versions);
    const school = ($('inpSchool').value || 'TRƯỜNG THPT CHI LĂNG').trim();
    const heading = ($('inpExamHeading').value || 'KIỂM TRA GIỮA HỌC KÌ I').trim();
    const dur = +$('inpDuration').value || 90;
    const subjTitle = ((SOURCE_EXAM && SOURCE_EXAM.title) || 'ĐỀ KIỂM TRA').toUpperCase();

    const bodyBlocks = [];

    versions.forEach((v, vIdx) => {
      const isNewPage = vIdx > 0;
      const totalQ = v.p1.length + v.p2.length + v.p3.length;
      bodyBlocks.push(makeExamHeaderTableXml(school, heading, subjTitle, dur, totalQ, v.code, isNewPage, markTeacherKey));
      bodyBlocks.push(makePara(singleLineHtmlToRuns(`<b>Họ và tên thí sinh:</b> ..................................................................... <b>Lớp:</b> ............... <b>SBD:</b> ...............`, imgRegistry, false), 'left', 110, false));

      if (v.p1.length) {
        bodyBlocks.push(makePara(singleLineHtmlToRuns(`<b>PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn (${v.p1.length} câu).</b> <i>Thí sinh trả lời từ câu 1 đến câu ${v.p1.length}. Mỗi câu hỏi thí sinh chỉ chọn một phương án.</i>`, imgRegistry, false), 'both', 70, false));
        v.p1.forEach((item, idx) => {
          bodyBlocks.push(renderStemBlocksToWordXml(`<b>Câu ${idx + 1}. </b>`, item.q.content, imgRegistry));
          const cols = decideOptionCols(item.options);
          bodyBlocks.push(makeOptionsTableXml(item.options, cols, imgRegistry, markTeacherKey ? item.ansIdx : -1));
        });
      }

      if (v.p2.length) {
        bodyBlocks.push(makePara(singleLineHtmlToRuns(`<b>PHẦN II. Câu trắc nghiệm đúng sai (${v.p2.length} câu).</b> <i>Thí sinh trả lời từ câu 1 đến câu ${v.p2.length}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.</i>`, imgRegistry, false), 'both', 70, false));
        v.p2.forEach((item, idx) => {
          bodyBlocks.push(renderStemBlocksToWordXml(`<b>Câu ${idx + 1}. </b>`, item.q.content, imgRegistry));
          item.statements.forEach((st, si) => {
            const isTrue = !!item.ansArr[si];
            const stmPrefix = (markTeacherKey && isTrue)
              ? `<b><u><red>${SUB_LETTERS[si]})</red></u> </b>`
              : `<b>${SUB_LETTERS[si]}) </b>`;
            bodyBlocks.push(renderStemBlocksToWordXml(stmPrefix, ensureDotEnd(st.text), imgRegistry));
          });
        });
      }

      if (v.p3.length) {
        bodyBlocks.push(makePara(singleLineHtmlToRuns(`<b>PHẦN III. Câu trắc nghiệm trả lời ngắn (${v.p3.length} câu).</b> <i>Thí sinh trả lời từ câu 1 đến câu ${v.p3.length}.</i>`, imgRegistry, false), 'both', 70, false));
        v.p3.forEach((item, idx) => {
          bodyBlocks.push(renderStemBlocksToWordXml(`<b>Câu ${idx + 1}. </b>`, item.q.content, imgRegistry));
          const ansDisplay = markTeacherKey ? `<b><red>${escapeHTML(item.ansVal)}</red></b>` : `..............................`;
          bodyBlocks.push(makePara(singleLineHtmlToRuns(`<i>Đáp số: </i>${ansDisplay}`, imgRegistry, false), 'left', 70, false));
        });
      }

      bodyBlocks.push(makePara(singleLineHtmlToRuns(`--- HẾT MÃ ĐỀ ${v.code} ---`, imgRegistry, true), 'center', 140, false));
    });

    if (includeMasterKey && versions.length) {
      bodyBlocks.push(makePara(singleLineHtmlToRuns(`BẢNG ĐÁP ÁN TỔNG HỢP (${versions.map(v => 'Mã ' + v.code).join(' · ')})`, imgRegistry, true), 'center', 120, true));
      bodyBlocks.push(makeMasterKeyTableWordXml(versions));
    }

    const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    let relsExtra = '<Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>';
    for (const info of imgRegistry.values()) {
      relsExtra += `<Relationship Id="${info.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${info.mediaName}"/>`;
    }

    const files = {
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>',
      '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/_rels/document.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' + relsExtra + '</Relationships>',
      'word/settings.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="' + w + '"><w:compat><w:doNotExpandShiftReturn/></w:compat></w:settings>',
      'word/styles.xml': '<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="' + w + '"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:color w:val="000000"/><w:sz w:val="24"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>',
      'word/document.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="' + w + '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>' + bodyBlocks.join('') + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="1134"/></w:sectPr></w:body></w:document>'
    };

    for (const info of imgRegistry.values()) {
      files['word/' + info.mediaName] = info.bytes;
    }

    const bytes = buildZipBytesMixed(files);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const suffix = (versions.length === 1 ? `Ma_${versions[0].code}` : `${versions.length}_MaDe`) + (markTeacherKey ? '_BanGV_CoDapAn' : '_BanHS');
    a.download = `De_In_Giay_${(SOURCE_EXAM && SOURCE_EXAM.id) || 'TronDe'}_${suffix}.docx`;
    a.click();

    if (btnAll) { btnAll.disabled = false; btnAll.textContent = prevTxt; }
  }

  boot();
})();
