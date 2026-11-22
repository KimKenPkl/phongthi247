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
const EXAM = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/tests/on-tap-lan10-de-5.json'), 'utf8'));
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
    const context = await browser.newContext({ permissions: ['camera'], viewport: { width: 1280, height: 900 } });
    await context.route(/https:\/\/script\.google(?:usercontent)?\.com\/.*/, route => route.abort());
    await context.route(/https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/, route => route.abort());
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
    const draft = () => page.evaluate(id => JSON.parse(localStorage.getItem('ptw_draft_' + id)), EXAM.id);
    async function open(mode = '', fresh = true) {
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
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.setViewportSize({ width: 1280, height: 900 });
    pass('Default ranked mode + exam duration; camera can be turned off/on during exam; mobile has no overflow');

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
      await page.getByRole('button', { name: 'Vẫn làm bài', exact: true }).waitFor();
      if (errorName === 'NotAllowedError') {
        await page.getByRole('button', { name: '📷 Thử lại', exact: true }).click();
        await page.getByRole('button', { name: 'Vẫn làm bài', exact: true }).waitFor();
        assert.equal(await page.evaluate(() => window.__cameraCalls), 2);
      }
      await page.getByRole('button', { name: 'Vẫn làm bài', exact: true }).click();
      assert.equal((await draft()).attempt.camRequested, false);
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
    await page.locator('#btnResume').click();
    assert.equal(await page.locator('#btnStart').isDisabled(), true);
    assert.equal(await page.locator('#btnDiscardDraft').isDisabled(), true);
    await page.evaluate(() => document.getElementById('btnStart').onclick());
    await page.evaluate(() => window.__finishPendingCamera());
    await page.locator('#qView .question').waitFor();
    const resumed = await draft();
    assert.equal(resumed.attempt.attemptId, oldDraft.attempt.attemptId);
    assert.equal(resumed.attempt.name, oldDraft.attempt.name);
    assert.equal(resumed.attempt.customDurMin, 15);
    assert.equal(resumed.attempt.deadline, oldDraft.attempt.deadline);
    assert.equal(await page.locator('#modalRoot').innerText(), '');
    pass('Start/resume share one entry lock: pending camera cannot replace draft identity or deadline');

    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS ${LIVE ? 'LIVE' : 'LOCAL'}: ${passed.length} camera/mode regression groups; no page errors; Apps Script requests blocked.`);
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
  }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
