/* import-docx.js – Nhập đề từ file Word (.docx) hoặc văn bản dán vào · Phong Thi Web
 * Không dùng thư viện ngoài: giải nén .docx bằng DecompressionStream('deflate-raw').
 *
 * Quy ước nhận dạng (giống Azota):
 *   Câu 1. / Câu 1: / Question 1.      → bắt đầu câu mới
 *   PHẦN I / PHẦN II / PHẦN III         → Phần I (4 lựa chọn), II (Đúng/Sai), III (trả lời ngắn)
 *   A. B. C. D. (mỗi dòng hoặc cùng dòng) → phương án Phần I
 *   a) b) c) d)                          → các ý Phần II
 *   Đáp án đúng: gạch chân / tô đỏ / tô nền / dấu * trước chữ cái, hoặc dòng "Đáp án: B"
 *   Phần II: ý đúng gạch chân/tô đỏ, hoặc ghi (Đ)/(S) cuối ý, hoặc "Đáp án: ĐSĐS"
 *   Phần III: dòng "Đáp án: 2,5"
 *   Lời giải: / Hướng dẫn: / Giải thích: → phần giải thích hiện sau khi nộp
 *   Bảng đáp án cuối file (sau dòng "ĐÁP ÁN"): "1-A 2-B …", "1.ĐSĐS", "1: 2,5" hoặc bảng 2 hàng Câu/Đáp án
 */
(function (root) {
  'use strict';
  const OBJ = '\uFFFC'; // ký tự giữ chỗ cho ảnh/công thức trong chuỗi

  /* ---------- Giải nén ZIP ---------- */
  async function inflateRaw(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(buf);
  }
  async function unzip(ab) {
    const u8 = new Uint8Array(ab), dv = new DataView(ab);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('File không phải .docx (không đọc được cấu trúc ZIP). File .doc cũ: mở bằng Word → Lưu thành .docx.');
    const n = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const files = {}, dec = new TextDecoder();
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
      files[name] = { method, csize, off };
      p += 46 + nl + xl + cl;
    }
    return {
      has: name => !!files[name],
      async bytes(name) {
        const f = files[name];
        if (!f) return null;
        const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true);
        const raw = u8.subarray(start, start + f.csize);
        if (f.method === 0) return raw;
        if (f.method === 8) return inflateRaw(raw);
        throw new Error('Kiểu nén ZIP không hỗ trợ: ' + f.method);
      },
      async text(name) { const b = await this.bytes(name); return b ? new TextDecoder().decode(b) : null; }
    };
  }

  function b64(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function decodeEnt(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
      const l = e.toLowerCase();
      if (l === 'amp') return '&'; if (l === 'lt') return '<'; if (l === 'gt') return '>';
      if (l === 'quot') return '"'; if (l === 'apos') return "'";
      return String.fromCodePoint(l[1] === 'x' ? parseInt(l.slice(2), 16) : parseInt(l.slice(1), 10));
    });
  }
  const attr = (tag, name) => { const m = tag.match(new RegExp('\\s' + name + '="([^"]*)"')); return m ? m[1] : null; };

  /* ---------- Đánh số tự động của Word (numbering.xml) ---------- */
  function parseNumbering(xml) {
    const abs = {}, nums = {};
    if (!xml) return { abs, nums };
    xml.replace(/<w:abstractNum\b[^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g, (m, id, body) => {
      const lv = {};
      body.replace(/<w:lvl\b[^>]*w:ilvl="(\d+)"[^>]*>([\s\S]*?)<\/w:lvl>/g, (mm, il, b) => {
        const g = re => { const x = b.match(re); return x ? x[1] : null; };
        lv[il] = { start: +(g(/<w:start w:val="(\d+)"/) || 1), fmt: g(/<w:numFmt w:val="(\w+)"/) || 'decimal', text: decodeEnt(g(/<w:lvlText w:val="([^"]*)"/) || '') };
      });
      abs[id] = lv;
    });
    xml.replace(/<w:num\b[^>]*w:numId="(\d+)"[^>]*>([\s\S]*?)<\/w:num>/g, (m, id, body) => {
      const a = body.match(/<w:abstractNumId w:val="(\d+)"/);
      if (a) nums[id] = a[1];
    });
    return { abs, nums };
  }
  function makeNumberer(def) {
    const counters = {};
    const fmt = (n, f) => {
      if (f === 'upperLetter') return String.fromCharCode(64 + ((n - 1) % 26) + 1);
      if (f === 'lowerLetter') return String.fromCharCode(96 + ((n - 1) % 26) + 1);
      if (f === 'upperRoman' || f === 'lowerRoman') {
        const r = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n);
        return f === 'lowerRoman' ? r.toLowerCase() : r;
      }
      return String(n);
    };
    return (numId, ilvl) => {
      const lv = def.abs[def.nums[numId]];
      if (!lv || !lv[ilvl]) return '';
      const c = counters[numId] || (counters[numId] = {});
      c[ilvl] = (c[ilvl] == null ? lv[ilvl].start - 1 : c[ilvl]) + 1;
      Object.keys(c).forEach(k => { if (+k > +ilvl) delete c[k]; });
      if (lv[ilvl].fmt === 'bullet' || lv[ilvl].fmt === 'none') return '';
      return lv[ilvl].text.replace(/%(\d)/g, (m, d) => {
        const L = String(+d - 1), L2 = lv[L];
        return fmt(c[L] != null ? c[L] : (L2 ? L2.start : 1), L2 ? L2.fmt : 'decimal');
      });
    };
  }

  /* ---------- document.xml → các dòng. Mỗi dòng là mảng đoạn {t, b, i, u, red, hl, sub, sup, img, bad, math} ---------- */
  const SYM = { F0AE: '→', F0AC: '←', F0AB: '↔', F0DE: '⇒', F0DB: '⇔', F0B0: '°', F0B1: '±', F0A3: '≤', F0B3: '≥', F0B4: '×', F0B8: '÷', F044: 'Δ', F064: 'δ', F061: 'α', F062: 'β', F070: 'π', F06C: 'λ', F06D: 'μ', F0BB: '≈', F0B9: '≠', F0C5: '⇌' };
  function isRed(hex) {
    if (!hex || hex.length !== 6) return false;
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    return r >= 150 && g <= 100 && b <= 100;
  }
  function docToLines(xml, imgMap, numberer, flags) {
    const lines = [];
    const body = (xml.match(/<w:body>([\s\S]*)<\/w:body>/) || [, xml])[1];
    const stack = [];            // đoạn văn lồng nhau (text box)
    let para = null, numId = null, ilvl = '0';
    let inRun = false, inRPr = false, rp = {}, inT = false, skipDepth = 0;
    let tbl = 0, row = null, cell = null;
    let mSub = 0, mSup = 0, inMath = 0;
    const push = seg => { if (para && !rp.hidden) para.push(seg); };
    const emit = segs => {
      if (!segs.length) return;
      if (tbl >= 1 && cell) { if (cell.length) cell.push({ t: ' ' }); cell.push(...segs); return; }
      if (segs.some(s => s.img || s.bad || s.t.trim())) lines.push(segs);
    };
    const re = /<(\/?)([\w:]+)((?:\s[^>]*?)?)(\/?)>|([^<]+)/g;
    let m;
    while ((m = re.exec(body))) {
      if (m[5] != null) {
        if (inT && !skipDepth && para) {
          const s = { t: decodeEnt(m[5]) };
          if (rp.b) s.b = 1; if (rp.i) s.i = 1; if (rp.u) s.u = 1; if (rp.red) s.red = 1; if (rp.hl) s.hl = 1;
          if (rp.sub || mSub) s.sub = 1; if (rp.sup || mSup) s.sup = 1; if (inMath) s.math = 1;
          push(s);
        }
        continue;
      }
      const close = m[1] === '/', tag = m[2], at = m[3] || '', self = m[4] === '/';
      if (tag === 'mc:Fallback' || tag === 'w:delText' || tag === 'w:instrText') { if (!self) skipDepth += close ? -1 : 1; continue; }
      if (skipDepth) continue;
      switch (tag) {
        case 'w:p':
          if (!close) { stack.push({ para, numId, ilvl }); para = []; numId = null; ilvl = '0'; if (self) { const st = stack.pop(); para = st.para; numId = st.numId; ilvl = st.ilvl; } }
          else {
            let segs = para || [];
            if (numId && numId !== '0') { const lab = numberer(numId, ilvl); if (lab) segs = [{ t: lab + ' ' }].concat(segs); }
            emit(segs);
            const st = stack.pop() || {}; para = st.para || null; numId = st.numId || null; ilvl = st.ilvl || '0';
          }
          break;
        case 'w:numId': if (!inRun) numId = attr(at, 'w:val'); break;
        case 'w:ilvl': if (!inRun) ilvl = attr(at, 'w:val') || '0'; break;
        case 'w:r': case 'm:r': if (!close) { inRun = true; rp = {}; } else { inRun = false; rp = {}; } break;
        case 'w:rPr': if (inRun) inRPr = !close && !self; break;
        case 'w:b': if (inRPr) rp.b = attr(at, 'w:val') !== '0' && attr(at, 'w:val') !== 'false'; break;
        case 'w:i': if (inRPr) rp.i = attr(at, 'w:val') !== '0' && attr(at, 'w:val') !== 'false'; break;
        case 'w:u': if (inRPr) { const v = attr(at, 'w:val'); rp.u = !!v && v !== 'none'; } break;
        case 'w:color': if (inRPr) rp.red = isRed(attr(at, 'w:val')); break;
        case 'w:highlight': if (inRPr) { const v = attr(at, 'w:val'); rp.hl = !!v && v !== 'none'; } break;
        case 'w:shd': if (inRPr) { const v = attr(at, 'w:fill'); rp.hl = !!v && v !== 'auto' && v.toUpperCase() !== 'FFFFFF'; } break;
        case 'w:vertAlign': if (inRPr) { const v = attr(at, 'w:val'); rp.sub = v === 'subscript'; rp.sup = v === 'superscript'; } break;
        case 'w:vanish': if (inRPr) rp.hidden = true; break;
        case 'w:t': case 'm:t': inT = !close && !self; break;
        case 'w:tab': if (inRun) push({ t: '\t' }); break;
        case 'w:br': case 'w:cr':
          if (inRun && para) {
            if (tbl >= 1) push({ t: ' ' });
            else { const segs = para; para = []; emit(segs); }
          }
          break;
        case 'w:sym': if (inRun) push({ t: SYM[(attr(at, 'w:char') || '').toUpperCase()] || '' }); break;
        case 'm:oMath': inMath += close ? -1 : (self ? 0 : 1); if (!close && !self) flags.math++; break;
        case 'm:sub': mSub += close ? -1 : (self ? 0 : 1); break;
        case 'm:sup': mSup += close ? -1 : (self ? 0 : 1); break;
        case 'a:blip': case 'v:imagedata': {
          const id = attr(at, 'r:embed') || attr(at, 'r:id');
          if (id && para) { const src = imgMap[id]; if (src) push({ t: OBJ, img: src }); else { push({ t: OBJ, bad: 1 }); flags.bad++; } }
          break;
        }
        case 'o:OLEObject': flags.ole++; break;
        case 'w:tbl': tbl += close ? -1 : 1; break;
        case 'w:tr': if (tbl === 1) { if (!close) row = []; else { if (row && row.length) emitRow(row); row = null; } } break;
        case 'w:tc': if (tbl === 1) { if (!close) cell = []; else { if (row) row.push(cell || []); cell = null; } } break;
      }
    }
    function emitRow(r) {
      const segs = [];
      r.forEach((c, k) => { if (k) segs.push({ t: '\t' }); segs.push(...c); });
      if (segs.some(s => s.img || s.bad || s.t.trim())) lines.push(segs);
    }
    return lines;
  }

  /* ---------- Tiện ích trên mảng đoạn ---------- */
  const segText = segs => segs.map(s => s.t).join('');
  function sliceSegs(segs, a, b) {
    if (b == null) b = Infinity;
    const out = []; let pos = 0;
    for (const s of segs) {
      const s0 = pos, s1 = pos + s.t.length; pos = s1;
      if (s1 <= a || s0 >= b) continue;
      const t = s.t.slice(Math.max(a, s0) - s0, Math.min(b, s1) - s0);
      if (t) out.push(Object.assign({}, s, { t }));
    }
    return out;
  }
  function trimSegs(segs) {
    const t = segText(segs);
    const a = t.length - t.replace(/^[\s\u200B]+/, '').length, b = t.replace(/[\s\u200B]+$/, '').length;
    return a >= b ? [] : sliceSegs(segs, a, b);
  }
  const hasStrong = segs => segs.some(s => (s.u || s.red || s.hl) && s.t.trim());
  const hasBold = segs => segs.some(s => s.b && /[A-Da-d]/.test(s.t));
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function segsToHtml(segs, o) {
    let h = '';
    for (const s of segs) {
      if (s.img) { h += '<img src="' + s.img + '" alt="hình" style="max-width:100%;vertical-align:middle">'; continue; }
      if (s.bad || s.t === OBJ) continue;
      let t = esc(s.t.replace(/\t/g, ' ').replace(new RegExp(OBJ, 'g'), ''));
      if (s.raw) {
        // văn bản dán vào: giữ lại vài thẻ định dạng GV tự gõ
        t = t.replace(/&lt;(\/?)(sub|sup|b|i|u|br)\s*\/?&gt;/gi, '<$1$2>')
          .replace(/&lt;img\s+src=&quot;((?:data\/img\/|https:\/\/)[^&"]+)&quot;\s*\/?&gt;/gi, '<img src="$1" alt="hình" style="max-width:100%">');
      }
      if (!t) continue;
      if (s.sub) t = '<sub>' + t + '</sub>'; else if (s.sup) t = '<sup>' + t + '</sup>';
      if (s.i) t = '<i>' + t + '</i>';
      if (s.b && o.b) t = '<b>' + t + '</b>';
      if (s.u && o.u) t = '<u>' + t + '</u>';
      h += t;
    }
    return h.replace(/ {2,}/g, ' ').replace(/<\/(b|i|u|sub|sup)><\1>/g, '').trim();
  }
  function numVN(s) {
    const m = String(s == null ? '' : s).trim().replace(/−/g, '-').match(/^[-+]?\s*\d+(?:[.,]\d+)?(?![\d.,])/);
    if (!m) return null;
    const v = Number(m[0].replace(/\s/g, '').replace(',', '.'));
    return isFinite(v) ? v : null;
  }
  function normDS(s) { return s.replace(/(^|[^\p{L}])(đúng|sai)(?![\p{L}])/giu, (m, p, w) => p + (w.toLowerCase() === 'sai' ? 'S' : 'Đ')); }
  /* Một giá trị đáp án → ['L', 0..3] | ['DS', [bool×4]] | ['N', số] */
  function classify(v) {
    const t = normDS(String(v == null ? '' : v).trim()).replace(/(^|[\s,;|])\(?[a-d]\s*[).:]\s*/g, '$1').trim();
    let m = t.match(/^([A-D])(?![\p{L}\d])/u);
    if (m) return ['L', 'ABCD'.indexOf(m[1])];
    m = t.replace(/[\s,;.\-–\/|]/g, '').toUpperCase().match(/^([ĐDS]{4})(?![ĐDS])/);
    if (m) return ['DS', m[1].split('').map(c => c !== 'S')];
    const n = numVN(t);
    return n != null ? ['N', n] : null;
  }
  function keyPairs(text) {
    const t = ' ' + normDS(text).replace(/\t+/g, ' | ') + ' ';
    const out = [], used = {};
    const add = (kind, n, v) => { if (!used[kind + n]) { used[kind + n] = 1; out.push([kind, +n, v]); } };
    let m;
    const reDS = /[\s|;,](?:[Cc]âu\s*)?(\d{1,3})\s*[.:\-–)]?\s*((?:[ĐđDS]\s*[,\-–]?\s*){3}[ĐđDS])(?=[\s|;,.])/g;
    while ((m = reDS.exec(t))) add('DS', m[1], m[2].replace(/[^ĐđDS]/g, '').toUpperCase().split('').map(c => c !== 'S'));
    const reL = /[\s|;,](?:[Cc]âu\s*)?(\d{1,3})\s*[.:\-–)]?\s*([A-D])(?=[\s|;,.])/g;
    while ((m = reL.exec(t))) add('L', m[1], 'ABCD'.indexOf(m[2]));
    const reN = /[\s|;,](?:[Cc]âu\s*)?(\d{1,3})\s*[:|]\s*([-−]?\d+(?:[.,]\d+)?)(?=[\s|;])/g;
    while ((m = reN.exec(t))) add('N', m[1], numVN(m[2]));
    return out;
  }

  const ROMAN = ['', 'I', 'II', 'III', 'IV'];
  const RE_PART = /^(?:PHẦN|PHAN)\s+(IV|I{1,3}|[1-4])(?![\p{L}\d])/iu;
  const RE_Q = /^(?:Câu|CÂU|câu|Question|QUESTION)\s*(\d{1,3})\s*[.:)]?/u;
  const RE_KEYHEAD = /^[\s\-–=*_#.]*(?:(?:BẢNG\s+)?ĐÁP\s*ÁN|HƯỚNG\s+DẪN\s+(?:CHẤM|GIẢI)|LỜI\s+GIẢI|ANSWER\s+KEYS?|[Bb]ảng\s+đáp\s+án)(?![^\n]*[:：])/u;
  const RE_END = /^[\s\-–_.*=]*(?:HẾT|Hết|hết)[\s\-–_.*=]*$/u;
  const RE_ANS = /^(?:[Đđ]áp\s*án(?:\s*đúng)?|ĐÁP\s*ÁN(?:\s*ĐÚNG)?|ĐA|Kết\s*quả|KẾT\s*QUẢ|Answer|Key)\s*(?:[:：=]\s*|(?=[A-D](?![\p{L}\d])|[ĐS]{4}(?![\p{L}])))/u;
  const RE_CHON = /^(?:[Cc]họn|CHỌN)\s*(?:đáp\s*án\s*)?([A-D])(?![\p{L}\d])/u;
  const RE_CHON_ANY = /(?:^|[^\p{L}])(?:[Cc]họn|CHỌN)\s*(?:đáp\s*án\s*)?([A-D])(?![\p{L}\d])/u;
  const RE_EXP = /^(?:[Ll]ời\s*giải(?:\s*chi\s*tiết)?|LỜI\s*GIẢI(?:\s*CHI\s*TIẾT)?|[Hh]ướng\s*dẫn(?:\s*giải)?|HƯỚNG\s*DẪN(?:\s*GIẢI)?|[Gg]iải\s*thích|GIẢI\s*THÍCH|[Gg]iải|GIẢI)\s*[:：.]\s*/u;
  /* Dòng tiêu đề mục: >0 = số phần (1–4), -1 = tiêu đề bài/chủ đề (bỏ qua, ngắt câu), 0 = không phải tiêu đề */
  const KW = /trắc nghiệm|đúng\s*[-–\/]?\s*sai|trả lời ngắn|tự luận|nhiều (?:phương án|lựa chọn)|multiple choice|short answer/iu;
  function partHead(st) {
    let s = st.replace(/^\d{1,2}\.\s*/, '');
    let m = s.match(/^(?:PHẦN|PHAN|Phần|phần)\s+(IV|I{1,3}|[1-4])(?![\p{L}\d])/iu);
    if (m) {
      if (RE_Q.test(s)) return 0;
      const rest = s.slice(m[0].length).replace(/\([^)]*\)/g, '').replace(/^[\s.:\-–]+/, '');
      if (KW.test(rest) || rest.split(/\s+/).filter(Boolean).length <= 3) return partOf(s, m[1]);
      return -1;
    }
    m = s.match(/^(IV|I{1,3})\s*[.:\-–)]\s*(.*)$/u);
    if (m && KW.test(m[2]) && m[2].length < 160) return partOf(s, m[1]);
    if (/^(?:BÀI|Bài|CHỦ ĐỀ|Chủ đề|CHƯƠNG|Chương|CHUYÊN ĐỀ|Chuyên đề)\s+[\dIVX]+\s*[.:\-–]/u.test(s) && s.length < 120) return -1;
    return 0;
  }
  function partOf(t, r) {
    const l = t.toLowerCase();
    if (/đúng\s*[-–\/]?\s*sai/u.test(l)) return 2;
    if (/trả lời ngắn|điền (?:đáp số|kết quả)|short answer/u.test(l)) return 3;
    if (/tự luận/u.test(l)) return 4;
    if (/nhiều (?:phương án|lựa chọn)|trắc nghiệm khách quan|multiple choice/u.test(l)) return 1;
    return { I: 1, II: 2, III: 3, IV: 4 }[String(r).toUpperCase()] || +r || 1;
  }
  /* Tìm nhãn A. B. C. D. (lower=false) hoặc a) b) c) d) (lower=true) theo đúng thứ tự, bắt đầu từ chữ thứ `first`. */
  function findLabels(text, lower, first, anywhere) {
    // "#A." = phương án cố định vị trí khi trộn (quy ước của các phần mềm trộn đề phổ biến)
    const re = lower ? /(^|\s)(\*?)\(?([a-d])\s*[).]/g : /(^|\s)([*#]?)([A-D])\s*[.)]/g;
    const out = []; let m, want = first;
    while (want < 4 && (m = re.exec(text))) {
      const L = m[3].toLowerCase().charCodeAt(0) - 97, start = m.index + m[1].length;
      if (L !== want) continue;
      if (!out.length && !anywhere && text.slice(0, start).trim()) return [];
      out.push({ start, end: m.index + m[0].length, star: m[2] === '*', pin: m[2] === '#' });
      want++;
    }
    return out;
  }
  /* Nhãn trên một dòng: ưu tiên nhãn đứng đầu dòng; nhãn giữa dòng chỉ nhận khi đủ đến D; nhãn sau phải cách bằng tab/2 dấu cách */
  function labelsIn(t, lower, first) {
    let L = findLabels(t, lower, first, false);
    if (!L.length && first === 0) { L = findLabels(t, lower, 0, true); if (L.length < 4) L = []; }
    if (L.length && first + L.length < 4) {
      for (let k = 1; k < L.length; k++) if (!/(\t\s*| {2,})$/.test(t.slice(L[k - 1].end, L[k].start))) { L = L.slice(0, k); break; }
    }
    return L;
  }

  const RE_TAG = /^\s*(?:\[[^\]]{0,40}\]|\((?:[\d.,]+\s*điểm|NB|TH|VDC|VD)[^)]{0,20}\))\s*[.:]?\s*/u;
  const RE_MARK = /\s*(?:→\s*)?[[(]\s*(Đúng|Sai|Đ|S)\s*[\])]\s*\.?\s*$/u;
  const RE_BUL = /^[\s→•●▪➢➤\-–+]*/u;
  const RE_DAPSO = /^(?:[Đđ]áp\s*số|ĐÁP\s*SỐ)\s*(?:[:：=]\s*|(?=[-−]?\d))/u;
  /* Tách giá trị đáp án ở đầu chuỗi → {k:'L'|'DS'|'N', v, tol, rest} */
  function splitAns(t) {
    t = String(t || '').trim();
    let m = t.match(/^([A-D])(?![\p{L}\d])\s*[.):]?\s*/u);
    if (m) return { k: 'L', v: 'ABCD'.indexOf(m[1]), rest: t.slice(m[0].length) };
    m = normDS(t).replace(/\(?[a-d]\s*[).:]\s*/g, '').match(/^\s*((?:[ĐđDS]\s*[,;\-–/|]?\s*){3}[ĐđDS])(?![\p{L}])/u);
    if (m) return { k: 'DS', v: m[1].replace(/[^ĐđDS]/g, '').toUpperCase().split('').map(c => c !== 'S'), rest: '' };
    m = t.replace(/−/g, '-').match(/^[-+]?\d+(?:[.,]\d+)?/);
    if (m) {
      const tm = t.slice(m[0].length).match(/^\s*\(\s*±\s*([\d.,eE+-]+)\s*\)\s*\.?/);
      let tol = tm ? Number(tm[1].replace(',', '.')) : null;
      if (tol != null && !(tol >= 1e-6)) tol = 0;
      return { k: 'N', v: numVN(m[0]), tol, rest: t.slice(m[0].length + (tm ? tm[0].length : 0)).replace(/^\s*[.;,]\s*/, '') };
    }
    return null;
  }

  /* Đoạn dẫn/bài đọc hay bị dán lặp 2–3 lần trong file Word: bỏ phần đuôi lặp lại. */
  function dedupeTail(arr) {
    let a = arr;
    for (let guard = 0; guard < 6; guard++) {
      const n = a.length;
      if (n < 4) break;
      let cut = 0;
      for (let p = n >> 1; p >= 2; p--) {
        let same = true;
        for (let i = 0; i < p; i++) {
          if (segText(a[n - 2 * p + i]) !== segText(a[n - p + i])) { same = false; break; }
        }
        if (same) { cut = p; break; }
      }
      if (!cut) break;
      a = a.slice(0, n - cut);
    }
    return a;
  }

  /* ---------- Máy trạng thái: dòng → câu hỏi thô ---------- */
  function parseLines(lines) {
    const items = [], key = {}, sol = {};
    let sec = 0, mode = 'q', cur = null, pending = [], solCur = null, keyHead = null, keySec = 0, skipped = 0, headSeen = true;
    const hasNum = lines.some(l => RE_Q.test(segText(l).trim()));
    const store = (p, n, r) => { if (!r || n == null) return; const k = key[p] || (key[p] = {}); if (!k[r.k + n]) k[r.k + n] = r; };
    const newItem = n => {
      cur = { n, part: sec, stem: [], opts: [], sts: [], exp: [], ans: null, chon: null, stage: 'stem', afterHead: headSeen, grp: inGrp ? grp : 0 };
      headSeen = false;
      if (pending.length) { cur.stem.push(...dedupeTail(pending)); pending = []; }
      items.push(cur);
      return cur;
    };
    const complete = c => {
      if (!c) return false;
      const full = a => a.length >= 4 && a[a.length - 1].segs.length > 0;
      if (c.part === 1) return full(c.opts);
      if (c.part === 2) return full(c.sts);
      if (c.part === 3) return c.ans != null;
      return full(c.opts) || full(c.sts);
    };
    function addLabeled(c, segs, t, L, lower) {
      if (L[0].start > 0) { const pre = trimSegs(sliceSegs(segs, 0, L[0].start)); if (pre.length) c.stem.push(pre); }
      L.forEach((l, k) => {
        const lab = sliceSegs(segs, l.start, l.end), end = k + 1 < L.length ? L[k + 1].start : t.length;
        let content = trimSegs(sliceSegs(segs, l.end, end)), star = l.star;
        if (/^\*/.test(segText(content))) { star = true; content = trimSegs(sliceSegs(content, 1)); }
        const o = { segs: content, star, pin: !!l.pin, strong: hasStrong(content) || hasStrong(lab), bold: hasBold(lab), mark: null };
        if (lower) {
          const ct = segText(content), mm = ct.match(RE_MARK);
          if (mm) { o.mark = mm[1][0] !== 'S'; o.segs = trimSegs(sliceSegs(content, 0, ct.length - mm[0].length)); }
          c.sts.push(o);
        } else c.opts.push(o);
      });
      c.stage = 'opts';
    }
    /* Trả về false nếu dòng không thuộc câu hiện tại */
    function body(c, segs) {
      const t = segText(segs), st = t.replace(RE_BUL, ''), off = t.length - st.length;
      let m;
      if ((m = st.match(RE_ANS) || st.match(RE_DAPSO))) {
        const raw = st.slice(m[0].length), r = splitAns(c.part === 3 ? raw.replace(/^A[.)]\s*(?=[-−\d])/, '') : raw);
        c.ans = r || c.ans;
        const rest = r ? r.rest.trim() : raw.trim();
        if (rest) c.exp.push(trimSegs(sliceSegs(segs, t.lastIndexOf(rest))));
        if (!r) c.badAns = raw.trim();
        c.stage = 'exp'; return true;
      }
      if ((m = st.match(RE_CHON))) {
        c.chon = 'ABCD'.indexOf(m[1]);
        const e = trimSegs(sliceSegs(segs, off + m[0].length)); if (e.length) c.exp.push(e);
        c.stage = 'exp'; return true;
      }
      if ((m = st.match(RE_EXP))) { const e = trimSegs(sliceSegs(segs, off + m[0].length)); if (e.length) c.exp.push(e); c.stage = 'exp'; return true; }
      if (c.stage === 'exp') { if (!hasNum && complete(c)) return false; c.exp.push(trimSegs(segs)); return true; }
      const p = c.part;
      if (p === 3 && c.ans == null && (m = t.match(/^\s*A[.)]\s*([-−]?\d+(?:[.,]\d+)?)\s*$/))) { c.ans = { k: 'N', v: numVN(m[1]), rest: '' }; return true; }
      if (p !== 2 && p !== 3 && p !== 4 && !(p === 0 && c.sts.length)) {
        const L = labelsIn(t, false, c.opts.length);
        if (L.length) { addLabeled(c, segs, t, L, false); return true; }
      }
      if (p !== 1 && p !== 3 && p !== 4 && !(p === 0 && c.opts.length)) {
        const L = labelsIn(t, true, c.sts.length);
        if (L.length) { addLabeled(c, segs, t, L, true); return true; }
      }
      if (c.stage === 'stem') { c.stem.push(trimSegs(segs)); return true; }
      if (complete(c)) return false;
      const last = c.sts.length && (p === 2 || !c.opts.length) ? c.sts[c.sts.length - 1] : c.opts[c.opts.length - 1];
      if (last) { last.segs = last.segs.length ? last.segs.concat([{ t: ' ' }], trimSegs(segs)) : trimSegs(segs); if (hasStrong(segs)) last.strong = true; return true; }
      c.stem.push(trimSegs(segs)); return true;
    }
    /* Dòng trong phần đáp án cuối file */
    function keyLine(segs, t) {
      const st = t.replace(RE_BUL, '').trim();
      const ph = partHead(st);
      if (ph > 0) { keySec = ph; solCur = null; keyHead = null; }
      let m;
      const cells = t.split('\t').map(s => s.trim()).filter((c, k, a) => c || (k > 0 && k < a.length - 1));
      if (cells.length >= 3) {
        const nums = cells.map(c => /^\d{1,3}$/.test(c) ? +c : null), nn = nums.filter(x => x != null).length;
        if (nn >= 2 && nn >= cells.length - 1) { keyHead = nums; solCur = null; return; }
        if (keyHead && keyHead.length === cells.length) {
          cells.forEach((c, k) => { if (keyHead[k] != null) store(keySec, keyHead[k], splitAns(keySec === 3 ? c.replace(/^A[.)]\s*/, '') : c)); });
          return;
        }
      }
      const pairs = keyPairs(t);
      if (pairs.length >= 2) { pairs.forEach(([k, n, v]) => store(keySec, n, { k, v, rest: '' })); solCur = null; return; }
      m = st.match(/^(?:Câu|CÂU|câu|Question)\s*(\d{1,3})(?!\d)(?:\s*\([^)]*\))?\s*[.:)\-–]?\s*/u);
      if (m) {
        const n = +m[1], rest = st.slice(m[0].length).replace(RE_ANS, '').replace(RE_DAPSO, '');
        let r = keySec === 4 ? null : splitAns(keySec === 3 ? rest.replace(/^A[.)]\s*(?=[-−\d])/, '') : rest);
        if (!r && keySec !== 4) { const c = rest.match(RE_CHON_ANY); if (c) r = { k: 'L', v: 'ABCD'.indexOf(c[1]), rest }; }
        if (r) store(keySec, n, r);
        solCur = keySec + ':' + n;
        const tail = r ? r.rest.trim() : rest.trim();
        if (tail) (sol[solCur] = sol[solCur] || []).push(trimSegs(sliceSegs(segs, t.lastIndexOf(tail))));
        return;
      }
      if (solCur && !m) (sol[solCur] = sol[solCur] || []).push(trimSegs(segs));
    }

    let grp = 0, inGrp = false;
    for (const segs of lines) {
      const t = segText(segs), tt = t.trim();
      // <g> … </g>: các câu bên trong đi cùng nhau khi trộn (dùng chung đoạn dẫn, bài đọc).
      // Nhận cả biến thể <g2> <g3> <g 2> <g id="x"> – gặp mốc <g…> mới thì cụm trước tự đóng.
      if (/^<\s*g(?:\s[^>]*|\d+)?\s*>$/i.test(tt)) { if (mode === 'q') { grp++; inGrp = true; cur = null; pending = []; } continue; }
      if (/^<\s*\/\s*g(?:\s[^>]*)?\s*>$/i.test(tt)) { inGrp = false; cur = null; continue; }
      if (!tt || /^<\/?\w+>$/.test(tt) || RE_END.test(tt)) continue;
      const st = tt.replace(RE_BUL, '');
      if (mode === 'q' && items.length && RE_KEYHEAD.test(st)) { mode = 'k'; keySec = 0; cur = null; pending = []; keyLine(segs, t); continue; }
      if (mode === 'k') { keyLine(segs, t); continue; }
      let m;
      const ph = partHead(st);
      if (ph > 0) { sec = ph; cur = null; pending = []; headSeen = true; continue; }
      if (ph < 0) { cur = null; pending = []; headSeen = true; skipped++; continue; }
      const cells = t.split('\t').map(s => s.trim()).filter(Boolean);
      if (items.length && (keyPairs(t).length >= 5 || (/^(?:câu|stt)/i.test(cells[0] || '') && cells.slice(1).filter(c => /^\d{1,3}$/.test(c)).length >= 5))) {
        mode = 'k'; keySec = 0; cur = null; pending = []; keyLine(segs, t); continue;
      }
      if ((m = st.match(RE_Q))) {
        const off = t.indexOf(st) + m[0].length, tg = t.slice(off).match(RE_TAG);
        newItem(+m[1]);
        const rs = trimSegs(sliceSegs(segs, off + (tg ? tg[0].length : 0)));
        if (rs.length) body(cur, rs);
        continue;
      }
      if (cur) {
        if (cur.part === 4 || body(cur, segs)) continue;
        if (!hasNum) { newItem(null); body(cur, segs); } else pending.push(trimSegs(segs));
        continue;
      }
      if (!hasNum && sec >= 1 && sec <= 3) { newItem(null); body(cur, segs); continue; }
      // Đoạn dẫn/bài đọc ngay sau <g>: gắn vào đầu câu đầu tiên của nhóm
      if (inGrp) { pending.push(trimSegs(segs)); continue; }
      skipped++;
    }
    return { items, key, sol, skipped };
  }

  /* ---------- Câu hỏi thô → JSON của web + cảnh báo ---------- */
  function build(P, flags) {
    const questions = [], warnings = [], cnt = { 1: 0, 2: 0, 3: 0 }, seq = {}, auto = {};
    let essay = 0;
    const W = (i, label, msg) => warnings.push({ i, label, msg });
    const getKey = (p, n, k) => (P.key[p] && P.key[p][k + n]) || (P.key[0] && P.key[0][k + n]) || null;
    const L4 = 'ABCD';
    let restarts = 0;
    P.items.forEach(it => {
      let p = it.part;
      if (!p) p = it.opts.length >= 2 ? 1 : it.sts.length >= 2 ? 2 : 3;
      if (p === 4) { essay++; return; }
      // câu không có phương án, không có ý, không có đáp án → câu tự luận/đọc hiểu, bỏ qua
      if (it.part !== 3 && !it.opts.length && !it.sts.length && !it.ans && it.chon == null &&
          !(it.n != null && ['L', 'DS', 'N'].some(k => getKey(p, it.n, k)))) { essay++; return; }
      if (it.n == null) it.n = auto[p] = (auto[p] || 0) + 1;
      else if (seq[p] != null && it.n !== seq[p] + 1) {
        if (it.n <= seq[p] && it.afterHead) restarts++;
        else W(questions.length, ROMAN[p] + '.' + it.n, `Số câu không liên tục: sau Câu ${seq[p]} là Câu ${it.n}${it.n === 1 ? ' (thiếu tiêu đề PHẦN?)' : ''}.`);
      }
      seq[p] = it.n;
      const i = questions.length, lab = ROMAN[p] + '.' + it.n;
      const stem = it.stem.map(s => segsToHtml(s, { b: 1, u: 1 })).filter(Boolean).join('<br>');
      if (!stem) W(i, lab, 'Thiếu nội dung câu hỏi.');
      if (it.stem.some(s => s.some(x => x.bad))) W(i, lab, 'Đề có công thức/hình không đọc được (MathType, WMF) – gõ lại hoặc thay bằng ảnh PNG.');
      if (it.badAns) W(i, lab, `Không đọc được đáp án "${it.badAns.slice(0, 40)}".`);
      const ex = it.exp.slice(), sk = P.sol[p + ':' + it.n] || P.sol['0:' + it.n];
      if (sk && !ex.length) ex.push(...sk);
      const expText = ex.map(segText).join(' ');
      const explain = ex.map(s => segsToHtml(s, { b: 1, u: 1 })).filter(Boolean).join('<br>');
      let q;
      if (p === 1) {
        if (it.opts.length !== 4) W(i, lab, `Có ${it.opts.length} phương án (cần đúng 4).`);
        const options = [0, 1, 2, 3].map(k => it.opts[k] ? segsToHtml(it.opts[k].segs, {}) : '');
        options.forEach((o, k) => { if (!o) W(i, lab, `Phương án ${L4[k]} trống${it.opts[k] && it.opts[k].segs.some(s => s.bad) ? ' (công thức/hình không đọc được – gõ lại)' : ''}.`); });
        const src = [];
        if (it.ans && it.ans.k === 'L') src.push(['dòng Đáp án', it.ans.v]);
        else if (it.ans) W(i, lab, 'Dòng "Đáp án" không phải chữ A–D.');
        if (it.chon != null) src.push(['dòng Chọn', it.chon]);
        const kk = getKey(p, it.n, 'L'); if (kk) src.push(['bảng đáp án', kk.v]);
        const uniq = f => { const ix = it.opts.map((o, k) => f(o) ? k : -1).filter(k => k >= 0); return ix.length === 1 ? ix[0] : null; };
        let u;
        if ((u = uniq(o => o.star)) != null) src.push(['dấu *', u]);
        if ((u = uniq(o => o.strong)) != null) src.push(['gạch chân/tô màu', u]);
        else if ((u = uniq(o => o.bold)) != null) src.push(['in đậm', u]);
        if (!src.length) { const mm = expText.match(RE_CHON_ANY); if (mm) src.push(['lời giải', L4.indexOf(mm[1])]); }
        if (!src.length) W(i, lab, 'Không tìm thấy đáp án – tạm đặt A, cần chọn lại.');
        else if (new Set(src.map(s => s[1])).size > 1) W(i, lab, 'Đáp án mâu thuẫn: ' + src.map(s => s[0] + ' → ' + L4[s[1]]).join('; ') + `. Đã lấy ${L4[src[0][1]]}.`);
        q = { part: 1, content: stem, options, answerIndex: src.length ? src[0][1] : 0 };
        const pins = it.opts.map((o, k) => o.pin ? k : -1).filter(k => k >= 0 && k < 4);
        if (pins.length) q.fixedOptions = pins;
      } else if (p === 2) {
        if (it.sts.length !== 4) W(i, lab, `Có ${it.sts.length} ý (cần đúng 4).`);
        let v = it.ans && it.ans.k === 'DS' ? it.ans.v : null;
        if (!v) { const kk = getKey(p, it.n, 'DS'); if (kk) v = kk.v; }
        if (!v) {
          const marks = it.sts.map(s => s.mark);
          if (marks.length && marks.every(x => x != null)) v = marks;
          else if (marks.some(x => x != null)) { v = marks.map(x => !!x); W(i, lab, 'Chỉ một số ý có ghi (Đ)/(S); ý không ghi được coi là Sai.'); }
          else if (it.sts.some(s => s.strong)) v = it.sts.map(s => s.strong);
          else if (it.sts.some(s => s.star)) v = it.sts.map(s => s.star);
        }
        if (!v) { v = []; W(i, lab, 'Không thấy ý nào được đánh dấu Đúng – tạm đặt cả 4 ý là Sai, kiểm tra lại.'); }
        q = { part: 2, content: stem, statements: [0, 1, 2, 3].map(k => ({ text: it.sts[k] ? segsToHtml(it.sts[k].segs, {}) : '', answer: !!v[k] })) };
        q.statements.forEach((s, k) => { if (!s.text) W(i, lab, `Ý ${'abcd'[k]} trống.`); });
      } else {
        let a = it.ans && it.ans.k === 'N' ? it.ans : getKey(p, it.n, 'N');
        if (!a) { const mm = expText.match(/(?:[Đđ]áp\s*số|[Đđ]áp\s*án|[Kk]ết\s*quả)\s*[:：=]?\s*([-−]?\d+(?:[.,]\d+)?)/u); if (mm) a = { v: numVN(mm[1]) }; }
        if (!a || a.v == null) W(i, lab, 'Không tìm thấy đáp số – tạm đặt 0, cần sửa.');
        q = { part: 3, content: stem, answer: a && a.v != null ? a.v : 0, tolerance: a && a.tol ? a.tol : 0 };
      }
      if (explain) q.explain = explain;
      if (it.grp) q.group = 'g' + it.grp;
      cnt[p]++;
      questions.push(q);
    });
    if (essay) W(-1, '', `Bỏ qua ${essay} câu tự luận/không có phương án: web chỉ chấm 3 phần trắc nghiệm.`);
    if (restarts && Object.keys(P.key).length) W(-1, '', `Số câu bắt đầu lại từ 1 ở ${restarts} chỗ (nhiều bài/chủ đề) – bảng đáp án cuối file có thể khớp sai câu, kiểm tra lại.`);
    if (flags.ole) W(-1, '', `File có ${flags.ole} công thức MathType/đối tượng OLE – web không đọc được, các chỗ đó sẽ trống. Nên gõ lại bằng Equation của Word hoặc chữ thường (H2SO4, x^2).`);
    else if (flags.bad) W(-1, '', `Có ${flags.bad} hình định dạng WMF/EMF không hiển thị được trên web – chụp lại thành PNG.`);
    const size = JSON.stringify(questions).length;
    if (size > 1.5e6) W(-1, '', `Dữ liệu khá nặng (${(size / 1e6).toFixed(1)} MB, chủ yếu do ảnh) – nên nén ảnh trong Word trước khi nhập.`);
    if (!questions.length) W(-1, '', 'Không nhận được câu nào. Mỗi câu phải bắt đầu bằng "Câu 1." và phương án "A." "B." "C." "D.".');
    return { questions, warnings, stats: { total: questions.length, p1: cnt[1], p2: cnt[2], p3: cnt[3], essay, skipped: P.skipped, images: flags.img || 0 } };
  }

  function parseText(str) {
    const lines = String(str == null ? '' : str).replace(/\r/g, '').split('\n').map(l => [{ t: l, raw: 1 }]);
    return build(parseLines(lines), { math: 0, bad: 0, ole: 0, img: 0 });
  }

  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' };
  async function parseDocx(ab) {
    const z = await unzip(ab);
    const xml = await z.text('word/document.xml');
    if (!xml) throw new Error('Không thấy word/document.xml – file không phải .docx của Word.');
    const rels = (await z.text('word/_rels/document.xml.rels')) || '';
    const imgMap = {}, flags = { math: 0, bad: 0, ole: 0, img: 0 };
    const re = /<Relationship\b[^>]*>/g;
    let m;
    while ((m = re.exec(rels))) {
      const tag = m[0], id = attr(tag, 'Id'), tg = attr(tag, 'Target'), ty = attr(tag, 'Type') || '';
      if (!id || !tg || !/\/image$/.test(ty) || attr(tag, 'TargetMode') === 'External') continue;
      const ext = (tg.split('.').pop() || '').toLowerCase();
      if (!MIME[ext]) continue;
      const b = await z.bytes(tg.startsWith('/') ? tg.slice(1) : 'word/' + tg.replace(/^\.\//, ''));
      if (!b) continue;
      flags.img++;
      imgMap[id] = 'data:' + MIME[ext] + ';base64,' + b64(b);
    }
    const lines = docToLines(xml, imgMap, makeNumberer(parseNumbering(await z.text('word/numbering.xml'))), flags);
    return build(parseLines(lines), flags);
  }

  /* Dùng khi gỡ lỗi: trả về các dòng văn bản đã tách từ .docx */
  async function docxLines(ab) {
    const z = await unzip(ab);
    const flags = { math: 0, bad: 0, ole: 0, img: 0 };
    return docToLines(await z.text('word/document.xml'), {}, makeNumberer(parseNumbering(await z.text('word/numbering.xml'))), flags).map(segText);
  }
  const API = { parseDocx, parseText, docxLines };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.PTWImport = API;
})(typeof window !== 'undefined' ? window : globalThis);
