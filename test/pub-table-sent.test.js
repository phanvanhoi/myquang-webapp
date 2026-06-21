const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  isFromTableUrl,
  shouldShowAwaitingUI,
  isActive,
  getRemainingMs,
  parseFromUrl,
  resolveState,
  buildIntroQuery,
  introHref,
  needsTableIntroParam,
  tablePageIntroHref,
  GRACE_MS,
} = require('../src/lib/table-order-sent');

test('isFromTableUrl chỉ true với ?from=table', () => {
  assert.equal(isFromTableUrl('?from=table'), true);
  assert.equal(isFromTableUrl('from=table'), true);
  assert.equal(isFromTableUrl({ from: 'table' }), true);
  assert.equal(isFromTableUrl('?from=delivery'), false);
  assert.equal(isFromTableUrl(''), false);
  assert.equal(isFromTableUrl('?'), false);
});

test('shouldShowAwaitingUI cần from=table và countdown (storage hoặc URL)', () => {
  const now = 1_000_000;
  const data = { sentAt: now, etaMinutes: 12, tableName: 'Bàn 1' };

  assert.equal(shouldShowAwaitingUI(data, '?from=table', now + 60_000), true);
  assert.equal(shouldShowAwaitingUI(data, '', now + 60_000), false);
  assert.equal(shouldShowAwaitingUI(data, '?from=table', now + 12 * 60_000 + 31 * 60_000), false);
  assert.equal(shouldShowAwaitingUI(null, '?from=table', now), false);

  const urlOnly = '?from=table&sent=' + now + '&eta=12&table=B%C3%A0n%201';
  assert.equal(shouldShowAwaitingUI(null, urlOnly, now + 60_000), true);
});

test('parseFromUrl và resolveState khôi phục từ query', () => {
  const now = 2_000_000;
  const qs = '?from=table&sent=' + now + '&eta=15&table=B%C3%A0n%202&t=abc';
  const parsed = parseFromUrl(qs);
  assert.equal(parsed.sentAt, now);
  assert.equal(parsed.etaMinutes, 15);
  assert.equal(parsed.tableName, 'Bàn 2');
  assert.equal(parsed.tableToken, 'abc');
  assert.deepEqual(resolveState(null, qs), parsed);
});

test('buildIntroQuery giữ token và countdown', () => {
  const data = { sentAt: 100, etaMinutes: 11, tableName: 'Bàn 3', tableToken: 'tok1' };
  const q = buildIntroQuery(data);
  assert.match(q, /\?from=table/);
  assert.match(q, /sent=100/);
  assert.match(q, /eta=11/);
  assert.match(q, /table=B%C3%A0n(\+|%20)3/);
  assert.match(q, /t=tok1/);
});

test('tablePageIntroHref luôn giữ ngữ cảnh bàn', () => {
  assert.equal(tablePageIntroHref('tok99'), '/gioi-thieu?from=table&t=tok99');
  assert.equal(tablePageIntroHref(''), '/gioi-thieu');
});

test('isActive trong grace sau ETA', () => {
  const now = 5_000_000;
  const data = { sentAt: now, etaMinutes: 10 };
  assert.equal(isActive(data, now + 9 * 60_000), true);
  assert.equal(isActive(data, now + 10 * 60_000 + 1), true);
  assert.equal(isActive(data, now + 10 * 60_000 + GRACE_MS), false);
});

test('getRemainingMs giảm dần', () => {
  const now = 0;
  const data = { sentAt: now, etaMinutes: 15 };
  assert.equal(getRemainingMs(data, now), 15 * 60_000);
  assert.equal(getRemainingMs(data, now + 5 * 60_000), 10 * 60_000);
  assert.equal(getRemainingMs(data, now + 20 * 60_000), 0);
});

test('introHref và needsTableIntroParam khi session chờ bàn active', () => {
  const now = 2_000_000;
  const data = { sentAt: now, etaMinutes: 12, tableName: 'Bàn 3', tableToken: 'x' };

  assert.match(introHref(data, '', now + 60_000), /^\/gioi-thieu\?from=table/);
  assert.equal(introHref(data, now + 12 * 60_000 + GRACE_MS), '/gioi-thieu');
  assert.equal(introHref(null, now), '/gioi-thieu');

  assert.equal(needsTableIntroParam(data, '', now + 60_000), true);
  assert.equal(needsTableIntroParam(data, '?from=table', now + 60_000), false);
  assert.equal(needsTableIntroParam(null, '', now), false);
});
