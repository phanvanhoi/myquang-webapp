const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

function loadDb(tmpPath) {
  process.env.DB_PATH = tmpPath;
  const dbPath = require.resolve('../src/db');
  delete require.cache[dbPath];
  return require('../src/db');
}

test('generateOrderCode prefix matches local date', () => {
  const tmp = path.join(os.tmpdir(), `myquang-test-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const code = q.generateOrderCode();
    assert.match(code, new RegExp(`^ORD-${y}${m}${day}-\\d{3}$`));
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test('audit query runs on empty database', () => {
  const tmp = path.join(os.tmpdir(), `myquang-audit-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const rows = q.all(`
      SELECT o.id
      FROM orders o
      LEFT JOIN payments p ON p.order_id = o.id
      WHERE o.status = 'completed'
      GROUP BY o.id
      HAVING ABS(COALESCE(SUM(p.amount), 0) - o.final_amount) > 0.01
    `);
    assert.deepEqual(rows, []);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});
