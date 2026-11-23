// Camera/mode regressions in real Chrome with fake media. Never sends student data.
const fs = require('fs'), path = require('path'), http = require('http');
const assert = require('assert/strict');
const { createRequire } = require('module');
const req = createRequire(path.join(process.env.LOCALAPPDATA, 'Temp/opencode/lan10-tools/package.json'));
const { chromium } = req('playwright-core');
const ROOT = path.resolve(__dirname, '../..');
const LIVE = process.argv.includes('--live');
const overlayArg = process.argv.find(v => v.startsWith('--overlay='));
const OVERLAY = overlayArg ? path.resolve(overlayArg.slice('--overlay='.length)) : null;
const EXAM = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/tests/on-tap-lan10-de-1.json'), 'utf8'));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

async function main() {
  let server, browser;
  const errors = [], passed = [];
  try {
    let base = 'https://kimkenpkl.github.io/phongthi247/';
    if (!LIVE) {
      server = http.createServer((req, res) => {
        let relative, file;
        try {
          relative = '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
          if (relative === './') relative = './index.html';
          file = path.resolve(ROOT, relative);
          if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; }
          if (OVERLAY) {
            const alternate = path.resolve(OVERLAY, relative);
            if (alternate.startsWith(OVERLAY + path.sep) && fs.existsSync(alternate)) file = alternate;
          }
        } catch { res.writeHead(400).end(); return; }
        fs.readFile(file, (err, data) => {
          if (err) { res.writeHead(404).end(); return; }
          res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
            'Cache-Control': 'no-store' }).end(data);
        });
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      base = `http://127.0.0.1:${server.address().port}/`;
    }
    browser = await chromium.launch({
      headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      args: ['--use-fake-device-for-media-stream']
    });
    const context = await browser.newContext({ permissions: ['camera'], timezoneId: 'America/Los_Angeles',
      viewport: { width: 1280, height: 900 } });
    await context.route(/https:\/\/script\.google(?:usercontent)?\.com\/.*/, route => route.abort());
    await context.route(/https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/, route => route.abort());
    // Cho phép từng ca test giả lập giờ máy chủ khác giờ điện thoại.
    let testServerNow = null;
    await context.route(/\/thi\.html\?t=\d+$/, route => {
      if (route.request().method() === 'HEAD' && testServerNow) {
        return route.fulfill({ status: 200, headers: { Date: new Date(testServerNow).toUTCString() } });
      }
      return route.continue();
    });
    // Cho phép từng ca test giả lập danh mục đề không tải được.
    let blockCatalog = false;
    await context.route('**/data/exams.json*', route => blockCatalog ? route.abort() : route.continue());
    await context.addInitScript(() => {
      window.__cameraCalls = 0;
      if (!navigator.mediaDevices) return;
      const realGetMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = constraints => {
        window.__cameraCalls++;
        return realGetMedia(constraints);
      };
    });
    const page = await context.newPage();
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', m => { const t = m.text(); if (/Content Security Policy|Refused to (load|execute|apply|connect|frame)/i.test(t)) errors.push('CSP: ' + t); });
    const draft = () => page.evaluate(id => JSON.parse(localStorage.getItem('ptw_draft_' + id)), EXAM.id);
    async function open(mode = '', fresh = true) {
      testServerNow = null;
      if (fresh) {
        await page.goto(base + 'thi.html?exam=' + EXAM.id, { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => localStorage.clear());
      }
      await page.goto(base + 'thi.html?exam=' + EXAM.id + mode, { waitUntil: 'networkidle' });
      await page.locator('#enterArea').waitFor({ state: 'visible' });
      await page.locator('#inpName').fill('Kiểm thử camera nội bộ');
      await page.locator('#inpClass').fill('QA');
      await page.locator('#inpCode').fill(EXAM.code);
    }
    async function start() {
      await page.locator('#btnStart').click();
      await page.locator('#qView .question').waitFor();
    }
    async function submit() {
      await page.locator('#btnSubmit').click();
      await page.getByRole('button', { name: '✅ Nộp bài ngay', exact: true }).click();
      await page.locator('#resultArea').waitFor({ state: 'visible' });
    }
    function pass(name) { passed.push(name); console.log('PASS: ' + name); }

    await open();
    assert.equal(await page.locator('input[name="examMode"][value="exam"]').isChecked(), true);
    assert.equal(await page.locator('#btnDurDefault').evaluate(el => el.classList.contains('active')), true);
    assert.equal(await page.locator('#chkCamProctor').isChecked(), true);
    await start();
    assert.equal((await draft()).attempt.mode, 'exam');
    assert.equal((await draft()).attempt.customDurMin, EXAM.durationMin);
    assert.equal((await draft()).attempt.unlimitedTime, false);
    await page.locator('#proctorPip').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#btnCheckNow').isVisible(), false);
    await page.locator('#btnCamToggle').click();
    assert.equal(await page.locator('#btnCamToggle').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('#proctorPip').isVisible(), false);
    assert.equal((await draft()).attempt.camVerified, false);
    assert.equal(await page.evaluate(() => document.getElementById('proctorVideo').srcObject), null);
    await page.locator('#btnCamToggle').click();
    await page.locator('#proctorPip').waitFor({ state: 'visible' });
    assert.equal((await draft()).attempt.camVerified, true);
    for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(vp);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    pass('Default ranked mode + exam duration; camera can be turned off/on during exam; mobile has no overflow');

    await open();
    for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(vp);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      const box = await page.locator('#btnStart').boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= vp.width + 1, 'nút Bắt đầu phải nằm trong màn hình ' + vp.width);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    pass('Entry form fits 390/360/320 wide phones without horizontal overflow');

    await open('&mode=practice');
    assert.equal(await page.locator('input[value="practice"]').isChecked(), true);
    assert.equal(await page.locator('#chkCamProctor').isChecked(), true);
    await page.locator('#chkCamProctor').focus();
    await page.keyboard.press('Space');
    await page.locator('input[value="exam"]').check();
    await page.locator('input[value="practice"]').check();
    assert.equal(await page.locator('#chkCamProctor').isChecked(), false);
    await start();
    assert.equal(await page.evaluate(() => window.__cameraCalls), 0);
    assert.equal((await draft()).attempt.mode, 'practice');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#chkCamProctor').isChecked(), false);
    await page.locator('#btnResume').click();
    await page.locator('#qView .question').waitFor();
    assert.equal(await page.evaluate(() => window.__cameraCalls), 0);
    assert.equal((await draft()).attempt.mode, 'practice');
    assert.equal((await draft()).attempt.camVerified, false);
    await submit();
    const offline = await page.evaluate(() => JSON.parse(localStorage.getItem('ptw_local_submissions'))[0]);
    assert.equal(offline.camVerified, false);
    pass('Practice URL respected; keyboard camera opt-out survives mode changes/resume; no-camera submission succeeds');

    for (const errorName of ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'unsupported']) {
      await open();
      await page.evaluate(name => {
        if (name === 'unsupported') {
          Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
        } else {
          navigator.mediaDevices.getUserMedia = async () => {
            window.__cameraCalls++;
            throw new DOMException('Camera test', name);
          };
        }
      }, errorName);
      await start();
      // Vào bài ngay; lỗi camera chỉ hiện banner, không mở modal chặn bài.
      assert.equal(await page.locator('#qView .question').isVisible(), true);
      await page.locator('#camNotice').waitFor({ state: 'visible', timeout: 4000 });
      assert.match(await page.locator('#camNotice').innerText(), /Camera chưa bật được/);
      assert.equal(await page.locator('#modalRoot').innerText(), '');
      if (errorName === 'NotAllowedError') {
        await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
        await page.waitForFunction(() => window.__cameraCalls >= 2);
        await page.locator('#camNotice').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#modalRoot').innerText(), '');
      }
      assert.equal((await draft()).attempt.camVerified, false);
      await page.getByRole('button', { name: 'Ẩn', exact: true }).click();
      assert.equal(await page.locator('#camNotice').isVisible(), false);
      assert.equal(await page.locator('#qView .question').isVisible(), true);
      await submit();
      pass(errorName + ': camera failure/retry never blocks answering or submitting');
    }

    await open();
    await start();
    await page.locator('#proctorPip').waitFor({ state: 'visible' });
    await page.evaluate(() => document.getElementById('proctorVideo').srcObject.getVideoTracks()[0].stop());
    await page.getByRole('button', { name: 'Tiếp tục không camera', exact: true }).waitFor({ timeout: 8000 });
    const warns = (await draft()).attempt.camWarns;
    assert.ok(warns >= 1);
    await page.getByRole('button', { name: 'Tiếp tục không camera', exact: true }).click();
    await page.waitForTimeout(4500);
    assert.equal(await page.locator('#modalRoot').innerText(), '');
    assert.equal((await draft()).attempt.camWarns, warns);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#chkCamProctor').isChecked(), false);
    await page.locator('#btnResume').click();
    await page.locator('#qView .question').waitFor();
    assert.equal((await draft()).attempt.camWarns, warns);
    pass('Lost camera: one warning, continue without repeated modals; resume preserves warning history and opt-out');

    await open();
    await start();
    await page.evaluate(() => {
      const original = CanvasRenderingContext2D.prototype.getImageData;
      window.__restoreCameraPixels = () => { CanvasRenderingContext2D.prototype.getImageData = original; };
      CanvasRenderingContext2D.prototype.getImageData = function (...args) {
        if (this.canvas.width === 48 && this.canvas.height === 36) {
          return { data: new Uint8ClampedArray(48 * 36 * 4) };
        }
        return original.apply(this, args);
      };
    });
    await page.waitForFunction(() => document.getElementById('proctorStatusTxt').textContent === 'CAM THIẾU SÁNG', null, { timeout: 8000 });
    assert.equal((await draft()).attempt.camWarns, 1);
    await page.waitForTimeout(4500);
    assert.equal((await draft()).attempt.camWarns, 1);
    await page.evaluate(() => window.__restoreCameraPixels());
    await page.waitForFunction(() => document.getElementById('proctorStatusTxt').textContent === 'CAM ĐANG BẬT', null, { timeout: 8000 });
    assert.equal((await draft()).attempt.camWarns, 1);
    assert.equal((await draft()).attempt.camVerified, true);
    pass('Dark frame counted once; brightness recovery preserves history; no phone/person/AI claim');

    await open();
    await page.locator('#chkCamProctor').uncheck();
    await start();
    await page.evaluate(() => {
      const realGetMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = constraints => new Promise(resolve => {
        window.__releaseCamera = async () => {
          window.__lateCameraStream = await realGetMedia(constraints);
          resolve(window.__lateCameraStream);
        };
      });
    });
    await page.locator('#btnCamToggle').click();
    await page.waitForFunction(() => typeof window.__releaseCamera === 'function');
    await submit();
    await page.evaluate(() => window.__releaseCamera());
    await page.waitForFunction(() => window.__lateCameraStream.getTracks().every(t => t.readyState === 'ended'));
    assert.equal(await page.locator('#proctorPip').isVisible(), false);
    assert.equal(await page.locator('#modalRoot').innerText(), '');
    pass('Late camera permission after submission is released without reopening camera or modal');

    await open();
    await page.locator('#chkCamProctor').uncheck();
    await page.locator('.dur-pill[data-min="15"]').click();
    await start();
    const oldDraft = await draft();
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#enterArea').waitFor({ state: 'visible' });
    await page.locator('#inpName').fill('Không được ghi đè bài nháp');
    await page.locator('#chkCamProctor').check();
    await page.evaluate(() => {
      const realGetMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = constraints => new Promise(resolve => {
        window.__finishPendingCamera = async () => resolve(await realGetMedia(constraints));
      });
    });
    // Resume phải mở bài ngay, không chờ quyền camera treo.
    await page.locator('#btnResume').click();
    await page.locator('#qView .question').waitFor({ timeout: 4000 });
    assert.equal((await draft()).attempt.camPending, true);
    await page.waitForFunction(() => typeof window.__finishPendingCamera === 'function');
    await page.evaluate(() => window.__finishPendingCamera());
    await page.locator('#proctorPip').waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForFunction(id => {
      const d = JSON.parse(localStorage.getItem('ptw_draft_' + id));
      return d && d.attempt && d.attempt.camPending === false;
    }, EXAM.id);
    const resumed = await draft();
    assert.equal(resumed.attempt.attemptId, oldDraft.attempt.attemptId);
    assert.equal(resumed.attempt.name, oldDraft.attempt.name);
    assert.equal(resumed.attempt.customDurMin, 15);
    assert.equal(resumed.attempt.deadline, oldDraft.attempt.deadline);
    assert.equal(resumed.attempt.camVerified, true);
    assert.equal(await page.locator('#modalRoot').innerText(), '');
    pass('Resume opens without waiting for a pending camera; draft identity and deadline unchanged');

    const scheduledId = 'on-tap-lan10-de-5';
    const scheduledExam = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/tests/' + scheduledId + '.json'), 'utf8'));
    const scheduleMeta = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/exams.json'), 'utf8'))
      .exams.find(x => x.id === scheduledId);
    assert.equal(scheduleMeta.openAt, '2026-11-23T07:00:00+07:00');
    assert.equal(scheduleMeta.closeAt, '2026-11-23T11:00:00+07:00');
    const scheduledDraft = () => page.evaluate(id => JSON.parse(localStorage.getItem('ptw_draft_' + id)), scheduledId);
    async function openScheduled(time, fresh = true) {
      testServerNow = Date.parse(time);
      await page.clock.setFixedTime(new Date(time));
      await page.goto(base + 'thi.html?exam=' + scheduledId + '&mode=practice', { waitUntil: 'networkidle' });
      if (fresh) {
        await page.evaluate(id => localStorage.removeItem('ptw_draft_' + id), scheduledId);
        await page.reload({ waitUntil: 'networkidle' });
      }
      await page.locator('#enterArea').waitFor({ state: 'visible' });
      await page.locator('#inpName').fill('Kiểm thử lịch thi nội bộ');
      await page.locator('#inpClass').fill('QA');
      await page.locator('#inpCode').fill('L10-105');
    }

    await openScheduled('2026-11-23T06:59:59+07:00');
    assert.equal(await page.locator('#btnStart').isDisabled(), true);
    assert.equal(await page.locator('#qView .question').count(), 0);
    await page.evaluate(() => document.getElementById('btnStart').onclick());
    assert.match(await page.locator('#modalRoot').innerText(), /Đề chưa mở/);
    await page.getByRole('button', { name: 'Đã hiểu', exact: true }).click();
    await page.clock.setFixedTime(new Date('2026-11-23T07:00:00+07:00'));
    await page.waitForFunction(() => !document.getElementById('btnStart').disabled);
    await page.locator('#chkCamProctor').uncheck();
    await start();
    const sevenAmDraft = await scheduledDraft();
    assert.equal(sevenAmDraft.attempt.mode, 'exam');
    assert.equal(sevenAmDraft.attempt.customDurMin, 50);
    assert.equal(sevenAmDraft.attempt.unlimitedTime, false);
    assert.equal(sevenAmDraft.order.length, 28);
    assert.equal(await page.locator('#btnCheckNow').isVisible(), false);
    const { createHash } = require('crypto');
    assert.equal(sevenAmDraft.revision, createHash('sha256').update(JSON.stringify(scheduledExam)).digest('hex'));
    pass('06:59:59 blocked; exact 07:00 opens without reload in another timezone; practice URL cannot bypass full timed exam; content revision stable');

    await page.clock.setFixedTime(new Date('2026-11-23T06:59:59+07:00'));
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#btnResume').isDisabled(), true);
    await page.evaluate(() => document.getElementById('btnResume').onclick());
    assert.equal(await page.locator('#qView .question').count(), 0);
    assert.match(await page.locator('#modalRoot').innerText(), /Đề chưa mở/);
    await page.getByRole('button', { name: 'Đã hiểu', exact: true }).click();
    await page.evaluate(id => {
      const key = 'ptw_cache_data/tests/' + id + '.json';
      sessionStorage.setItem(key, JSON.stringify({ id, title: 'STALE CACHED EXAM', questions: [] }));
    }, scheduledId);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#examTitle').innerText(), scheduledExam.title);
    await page.goto(base, { waitUntil: 'networkidle' });
    assert.match(await page.locator('#scheduleNotices').innerText(), /07h00.*11h00.*23\/11\/2026/);
    assert.equal(await page.getByRole('link', { name: 'Bản in PDF L10-105', exact: true }).count(), 0);
    assert.equal(await page.getByRole('link', { name: 'Bản in PDF L10-101', exact: true }).count(), 1);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.setViewportSize({ width: 1280, height: 900 });
    pass('Resume blocked before open; stale exam session cache ignored; notice visible and early paper downloads hidden; other practice papers unchanged');

    await openScheduled('2026-11-23T08:00:00+07:00');
    const invalidDraft = structuredClone(sevenAmDraft);
    invalidDraft.attempt.startTs = Date.parse('2026-11-23T06:00:00+07:00');
    await page.evaluate(({ id, data }) => localStorage.setItem('ptw_draft_' + id, JSON.stringify(data)),
      { id: scheduledId, data: invalidDraft });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#btnResume').click();
    await page.getByRole('heading', { name: 'Bài nháp ngoài lịch thi', exact: true }).waitFor();
    assert.match(await page.locator('#modalRoot').innerText(), /Bài nháp ngoài lịch thi/);
    assert.equal(await page.locator('#qView .question').count(), 0);
    pass('Draft created before scheduled opening cannot be resumed during the exam');

    await page.goto(base + 'tronde.html?exam=' + scheduledId, { waitUntil: 'networkidle' });
    await page.locator('#selSourceExam').waitFor();
    await page.locator('#selSourceExam').selectOption(scheduledId);
    await page.waitForFunction(() => /đang khóa đáp án/.test(document.getElementById('mixStatus').textContent));
    assert.match(await page.locator('#mixStatus').innerText(), /không được nạp/);
    pass('Exam mixer refuses a scheduled exam while its answers are hidden, including inside the open window');

    await openScheduled('2026-11-23T10:50:00+07:00');
    await page.locator('#chkCamProctor').uncheck();
    await start();
    const lateDraft = await scheduledDraft();
    assert.equal(lateDraft.attempt.deadline, Date.parse('2026-11-23T11:00:00+07:00'));
    assert.equal(lateDraft.attempt.deadline - lateDraft.attempt.startTs, 10 * 60000);
    await page.clock.setFixedTime(new Date('2026-11-23T11:00:00+07:00'));
    await page.locator('#resultArea').waitFor({ state: 'visible' });
    assert.match(await page.locator('#resultArea').innerText(), /Đến giờ đóng đề/);
    assert.equal(await page.locator('#btnRetryAll').count(), 0);
    await openScheduled('2026-11-23T11:00:00+07:00');
    assert.equal(await page.locator('#btnStart').isDisabled(), true);
    await page.evaluate(({ id, data }) => localStorage.setItem('ptw_draft_' + id, JSON.stringify(data)),
      { id: scheduledId, data: lateDraft });
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#btnResume').isDisabled(), true);
    await page.evaluate(() => document.getElementById('btnResume').onclick());
    assert.equal(await page.locator('#qView .question').count(), 0);
    assert.match(await page.locator('#modalRoot').innerText(), /Đề đã đóng/);
    pass('Late entry gets only remaining time; 11:00 auto-finishes and blocks both fresh and resumed exams');

    // Điện thoại lùi giờ 12 tiếng nhưng giờ máy chủ đúng: không được chặn oan.
    const serverNow = Date.parse('2026-11-23T08:00:00+07:00');
    testServerNow = serverNow;
    await page.clock.setFixedTime(new Date('2026-11-22T20:00:00+07:00'));
    await page.goto(base + 'thi.html?exam=' + scheduledId + '&mode=practice', { waitUntil: 'networkidle' });
    await page.evaluate(id => localStorage.removeItem('ptw_draft_' + id), scheduledId);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#enterArea').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.getElementById('btnStart').disabled);
    await page.locator('#inpName').fill('Kiểm thử lệch giờ');
    await page.locator('#inpClass').fill('QA');
    await page.locator('#inpCode').fill('L10-105');
    await page.locator('#chkCamProctor').uncheck();
    await start();
    const skewDraft = await scheduledDraft();
    assert.ok(Math.abs(skewDraft.attempt.startTs - serverNow) < 5000,
      'startTs phải theo giờ máy chủ, không theo giờ điện thoại');
    pass('Device clock 12h behind still enters: server Date header drives the schedule');

    // Mất mạng khi tải danh mục: dùng lịch đã lưu thay vì chặn vào thi.
    blockCatalog = true;
    testServerNow = Date.parse('2026-11-23T09:00:00+07:00');
    await page.clock.setFixedTime(new Date('2026-11-23T09:00:00+07:00'));
    await page.goto(base + 'thi.html?exam=' + scheduledId + '&mode=practice', { waitUntil: 'domcontentloaded' });
    await page.locator('#enterArea').waitFor({ state: 'visible', timeout: 15000 });
    assert.match(await page.locator('#rulesBox').innerText(), /Mạng đang yếu/);
    await page.waitForFunction(() => !document.getElementById('btnStart').disabled);
    blockCatalog = false;
    pass('Offline catalog falls back to the saved schedule instead of blocking entry');

    // Quyền camera treo: vào bài ngay, banner chỉ hiện sau 8 giây.
    await open();
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () => new Promise(() => {});
    });
    const entryAt = Date.now();
    await start();
    assert.ok(Date.now() - entryAt < 4000, 'không được chờ quyền camera trước khi mở đề');
    assert.equal(await page.locator('#qView .question').isVisible(), true);
    await page.locator('#camNotice').waitFor({ state: 'visible', timeout: 12000 });
    assert.equal(await page.locator('#modalRoot').innerText(), '');
    await submit();
    pass('Hanging camera permission never blocks entry or submission');

    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS ${LIVE ? 'LIVE' : 'LOCAL'}: ${passed.length} camera/mode regression groups; no page errors; Apps Script requests blocked.`);
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
  }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
