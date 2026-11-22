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
assert.ok(exam && exam.strictSchedule && exam.hideKeyUntilClose);
assert.equal(exam.openAt, '2026-11-23T07:00:00+07:00');
assert.equal(exam.closeAt, '2026-11-23T11:00:00+07:00');
const open = Date.parse(exam.openAt), close = Date.parse(exam.closeAt);
assert.equal(sandbox.parseVNTime('2026-11-23T07:00'), open);
assert.equal(new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Ho_Chi_Minh' }).format(open), 'Monday');
for (const [time, state, blocked] of [
  [open - 1, 'before', true], [open, 'open', false],
  [close - 1, 'open', false], [close, 'closed', true], [close + 1, 'closed', true]
]) {
  const s = sandbox.examSchedule(exam, time);
  assert.equal(s.state, state);
  assert.equal(s.blocked, blocked);
  assert.equal(s.assigned, true);
}
console.log('PASS exact VN open/close boundaries; Monday date; strict timed assignment');
for (let i = 1; i <= 4; i++) {
  const practice = index.exams.find(x => x.id === 'on-tap-lan10-de-' + i);
  assert.equal(sandbox.examSchedule(practice, open - 1).blocked, false);
  assert.equal(sandbox.examSchedule(practice, close + 1).blocked, false);
}
assert.equal(sandbox.examSchedule({ closeAt: exam.closeAt }, close).blocked, false);
console.log('PASS practice papers unchanged; legacy after-close review remains supported');
const registryScope = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/ExamRegistry.gs'), 'utf8') +
  '\nglobalThis.registry = SERVER_EXAMS;', registryScope);
const rawExam = JSON.parse(fs.readFileSync(path.join(root, 'data/tests/' + exam.id + '.json'), 'utf8'));
const registered = registryScope.registry[exam.id];
assert.equal(registered.openAt, exam.openAt);
assert.equal(registered.closeAt, exam.closeAt);
assert.equal(registered.revision, crypto.createHash('sha256').update(JSON.stringify(rawExam)).digest('hex'));
console.log('PASS generated server policy matches catalog while grading revision stays content-based');
