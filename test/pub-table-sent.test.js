const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  isFromTableUrl,
  shouldShowAwaitingUI,
  isActive,
  getRemainingMs,
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

test('shouldShowAwaitingUI cần cả session active và from=table', () => {
  const now = 1_000_000;
  const data = { sentAt: now, etaMinutes: 12, tableName: 'Bàn 1' };

  assert.equal(shouldShowAwaitingUI(data, '?from=table', now + 60_000), true);
  assert.equal(shouldShowAwaitingUI(data, '', now + 60_000), false);
  assert.equal(shouldShowAwaitingUI(data, '?from=table', now + 12 * 60_000 + 31 * 60_000), false);
  assert.equal(shouldShowAwaitingUI(null, '?from=table', now), false);
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
