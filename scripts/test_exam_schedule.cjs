'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/common.js'), 'utf8');
const start = source.indexOf('function parseVNTime(');
const end = source.indexOf('/* Số lượt đã nộp', start);
assert.ok(start >= 0 && end > start, 'Schedule helpers must be present');
const sandbox = vm.createContext({ Date });
vm.runInContext(source.slice(start, end), sandbox);
const index = JSON.parse(fs.readFileSync(path.join(root, 'data/exams.json'), 'utf8'));
const exam = index.exams.find(x => x.id === 'on-tap-lan10-de-5');
/* De 5 da duoc mo lai nhu de 1-4 (commit d734745): bo khoa lich, bo an dap an. */
assert.ok(exam, 'L10 exam 5 must exist in the catalog');
assert.ok(!exam.strictSchedule && !exam.hideKeyUntilClose, 'exam 5 must be reopened without a schedule lock');
assert.ok(!exam.openAt && !exam.closeAt, 'exam 5 must not carry open/close windows');
const nowS = sandbox.examSchedule(exam, Date.now());
assert.equal(nowS.state, 'always');
assert.equal(nowS.blocked, false);
assert.equal(nowS.assigned, false);
console.log('PASS exam 5 reopened: practice mode, never blocked by schedule');
/* Engine coverage: synthetic timed assignment keeps boundary logic fully tested. */
const OPEN = '2026-11-23T07:00:00+07:00', CLOSE = '2026-11-23T11:00:00+07:00';
const assigned = { openAt: OPEN, closeAt: CLOSE, strictSchedule: true, hideKeyUntilClose: true };
const open = Date.parse(OPEN), close = Date.parse(CLOSE);
assert.equal(sandbox.parseVNTime('2026-11-23T07:00'), open);
assert.equal(new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Ho_Chi_Minh' }).format(open), 'Monday');
for (const [time, state, blocked] of [
  [open - 1, 'before', true], [open, 'open', false],
  [close - 1, 'open', false], [close, 'closed', true], [close + 1, 'closed', true]
]) {
  const s = sandbox.examSchedule(assigned, time);
  assert.equal(s.state, state);
  assert.equal(s.blocked, blocked);
  assert.equal(s.assigned, true);
  assert.equal(s.keyHidden, time < close);
}
console.log('PASS exact VN open/close boundaries; Monday date; strict timed assignment');
for (let i = 1; i <= 5; i++) {
  const practice = index.exams.find(x => x.id === 'on-tap-lan10-de-' + i);
  assert.ok(practice, 'L10 exam ' + i + ' must exist in the catalog');
  assert.equal(sandbox.examSchedule(practice, open - 1).blocked, false);
  assert.equal(sandbox.examSchedule(practice, close + 1).blocked, false);
}
console.log('PASS all L10 papers 1-5 stay open for practice around any window');
assert.equal(sandbox.examSchedule({ closeAt: CLOSE }, close).blocked, false);
console.log('PASS legacy after-close review remains supported');
const registryScope = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/ExamRegistry.gs'), 'utf8') +
  '\nglobalThis.registry = SERVER_EXAMS;', registryScope);
const rawExam = JSON.parse(fs.readFileSync(path.join(root, 'data/tests/' + exam.id + '.json'), 'utf8'));
const registered = registryScope.registry[exam.id];
assert.ok(registered, 'exam 5 must stay registered server-side');
assert.equal(String(registered.openAt || ''), String(exam.openAt || ''));
assert.equal(String(registered.closeAt || ''), String(exam.closeAt || ''));
assert.equal(registered.revision, crypto.createHash('sha256').update(JSON.stringify(rawExam)).digest('hex'));
console.log('PASS server registry matches reopened catalog; grading revision stays content-based');
