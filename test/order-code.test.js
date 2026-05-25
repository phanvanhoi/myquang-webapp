const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { localYmdCompact } = require('../src/lib/date');
const { MONEY_EPS } = require('../src/lib/money');

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
    const code = q.generateOrderCode();
    assert.match(code, new RegExp(`^ORD-${localYmdCompact()}-\\d{3}$`));
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
    assert.deepEqual(q.findCompletedOrdersWithPaymentMismatch(MONEY_EPS), []);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});
