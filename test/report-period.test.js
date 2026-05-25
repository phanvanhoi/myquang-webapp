const { test } = require('node:test');
const assert = require('node:assert');
const {
  daysInRange,
  weeksInRange,
  monthsInRange,
  reportPeriodMeta,
} = require('../src/lib/date');
const { buildNoodleStats } = require('../src/lib/noodle-stats');

test('daysInRange is inclusive', () => {
  assert.strictEqual(daysInRange('2026-05-01', '2026-05-01'), 1);
  assert.strictEqual(daysInRange('2026-05-01', '2026-05-25'), 25);
  assert.strictEqual(daysInRange('2026-05-25', '2026-05-01'), 0);
});

test('weeksInRange counts ISO weeks touched by range', () => {
  assert.strictEqual(weeksInRange('2026-05-01', '2026-05-07'), 2);
  assert.strictEqual(weeksInRange('2026-05-01', '2026-05-25'), 5);
});

test('monthsInRange counts calendar months touched by range', () => {
  assert.strictEqual(monthsInRange('2026-05-01', '2026-05-25'), 1);
  assert.strictEqual(monthsInRange('2026-05-20', '2026-06-05'), 2);
});

test('reportPeriodMeta enforces minimum divisors', () => {
  const period = reportPeriodMeta('2026-05-01', '2026-05-25');
  assert.deepStrictEqual(period, {
    start: '2026-05-01',
    end: '2026-05-25',
    days: 25,
    weeks: 5,
    months: 1,
  });
});

test('buildNoodleStats computes qty and revenue averages', () => {
  const period = reportPeriodMeta('2026-05-01', '2026-05-25');
  const stats = buildNoodleStats([
    { noodle_type: 'mi', qty: 320, revenue: 19200000 },
    { noodle_type: 'bun', qty: 145, revenue: 8700000 },
  ], period);

  assert.strictEqual(stats.mi.qty, 320);
  assert.strictEqual(stats.mi.avg_day, 12.8);
  assert.strictEqual(stats.mi.avg_week, 64);
  assert.strictEqual(stats.mi.avg_month, 320);
  assert.strictEqual(stats.mi.revenue_avg_day, 768000);
  assert.strictEqual(stats.mi.revenue_avg_week, 3840000);
  assert.strictEqual(stats.mi.revenue_avg_month, 19200000);

  assert.strictEqual(stats.bun.qty, 145);
  assert.strictEqual(stats.bun.avg_week, 29);
  assert.strictEqual(stats.bun.revenue_avg_month, 8700000);
});

test('buildNoodleStats defaults missing groups to zero', () => {
  const period = reportPeriodMeta('2026-05-01', '2026-05-07');
  const stats = buildNoodleStats([{ noodle_type: 'mi', qty: 7, revenue: 350000 }], period);
  assert.strictEqual(stats.bun.qty, 0);
  assert.strictEqual(stats.bun.avg_day, 0);
  assert.strictEqual(stats.bun.revenue_avg_week, 0);
});
