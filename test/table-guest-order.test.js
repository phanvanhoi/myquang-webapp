const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

function loadDb(tmpPath) {
  process.env.DB_PATH = tmpPath;
  delete require.cache[require.resolve('../src/db')];
  delete require.cache[require.resolve('../src/lib/order-items')];
  delete require.cache[require.resolve('../src/lib/table-guest')];
  return require('../src/db');
}

function seedTableGuestFixture(q) {
  q.run(`INSERT INTO roles (name, permissions) VALUES ('waiter', '[]')`);
  q.run(
    `INSERT INTO users (role_id, username, full_name, password_hash, is_active)
     VALUES (1, 'guest_online', 'Khách QR', 'x', 0)`
  );
  const staff = q.run(
    `INSERT INTO users (role_id, username, full_name, password_hash, is_active)
     VALUES (1, 'staff1', 'Staff', 'x', 1)`
  );

  const floor = q.run(`INSERT INTO floors (name, sort_order) VALUES ('T1', 1)`);
  const token = crypto.randomBytes(16).toString('hex');
  const table = q.run(
    `INSERT INTO tables (floor_id, code, name, capacity, status, is_active, is_takeaway, is_virtual, public_token)
     VALUES (?, 'T1-B01', 'Bàn 01', 4, 'available', 1, 0, 0, ?)`,
    floor.lastInsertRowid,
    token
  );

  const cat = q.run(`INSERT INTO menu_categories (name, sort_order, is_active) VALUES ('Món', 1, 1)`);
  const item = q.run(
    `INSERT INTO menu_items (category_id, name, base_price, is_active, is_available, sort_order)
     VALUES (?, 'Mì Quảng', 45000, 1, 1, 1)`,
    cat.lastInsertRowid
  );

  return {
    token,
    tableId: table.lastInsertRowid,
    itemId: item.lastInsertRowid,
    staffId: staff.lastInsertRowid,
  };
}

test('resolveTableByToken rejects invalid tokens and virtual table tokens', () => {
  const tmp = path.join(os.tmpdir(), `myquang-tg-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const tg = require('../src/lib/table-guest');
    const { token, tableId } = seedTableGuestFixture(q);

    assert.ok(tg.resolveTableByToken(token));
    assert.strictEqual(tg.resolveTableByToken('bad-token'), null);
    assert.strictEqual(tg.resolveTableByToken(''), null);

    const virtualToken = crypto.randomBytes(16).toString('hex');
    q.run(
      `INSERT INTO tables (floor_id, code, name, capacity, status, is_active, is_takeaway, is_virtual, public_token, parent_table_id)
       VALUES (1, 'T1-B01-V1', 'Ảo 1', 2, 'occupied', 1, 0, 1, ?, ?)`,
      virtualToken,
      tableId
    );
    assert.strictEqual(tg.resolveTableByToken(virtualToken), null);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test('submitGuestItems auto-opens table and returns summary with final_amount', () => {
  const tmp = path.join(os.tmpdir(), `myquang-tg2-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const tg = require('../src/lib/table-guest');
    const { token, tableId, itemId } = seedTableGuestFixture(q);

    const tableBefore = q.get(`SELECT status FROM tables WHERE id = ?`, tableId);
    assert.strictEqual(tableBefore.status, 'available');
    assert.strictEqual(tg.getTableGuestStatus(token).order, null);

    const result = tg.submitGuestItems(token, [{ item_id: itemId, quantity: 2 }]);

    const tableAfter = q.get(`SELECT status FROM tables WHERE id = ?`, tableId);
    assert.strictEqual(tableAfter.status, 'occupied');

    const order = q.get(
      `SELECT * FROM orders WHERE table_id = ? AND status IN ('open','serving')`,
      tableId
    );
    assert.ok(order);
    assert.strictEqual(result.summary.item_count, 2);
    assert.strictEqual(result.summary.total_amount, 90000);
    assert.strictEqual(result.summary.final_amount, 90000);

    const status = tg.getTableGuestStatus(token);
    assert.strictEqual(status.order.item_count, 2);
    assert.strictEqual(status.can_submit, true);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test('submitGuestItems rate limits rapid submits', () => {
  const tmp = path.join(os.tmpdir(), `myquang-tg3-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const tg = require('../src/lib/table-guest');
    const { token, itemId } = seedTableGuestFixture(q);

    tg.submitGuestItems(token, [{ item_id: itemId, quantity: 1 }]);
    assert.throws(
      () => tg.submitGuestItems(token, [{ item_id: itemId, quantity: 1 }]),
      err => err.code === 'RATE_LIMIT'
    );
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test('ensurePublicToken creates token for physical table only', () => {
  const tmp = path.join(os.tmpdir(), `myquang-tg4-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const tg = require('../src/lib/table-guest');
    const { tableId, token } = seedTableGuestFixture(q);

    assert.strictEqual(tg.ensurePublicToken(tableId), token);

    q.run(`UPDATE tables SET public_token = NULL WHERE id = ?`, tableId);
    const newToken = tg.ensurePublicToken(tableId);
    assert.ok(newToken && newToken.length === 32);

    const virtual = q.run(
      `INSERT INTO tables (floor_id, code, name, capacity, status, is_active, is_takeaway, is_virtual, parent_table_id)
       VALUES (1, 'T1-B01-V1', 'Ảo', 2, 'occupied', 1, 0, 1, ?)`,
      tableId
    );
    assert.strictEqual(tg.ensurePublicToken(virtual.lastInsertRowid), null);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test('blocks submit when multiple active dine-in orders exist', () => {
  const tmp = path.join(os.tmpdir(), `myquang-tg5-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const tg = require('../src/lib/table-guest');
    const { token, tableId, itemId, staffId } = seedTableGuestFixture(q);

    q.run(
      `INSERT INTO orders (table_id, user_id, order_code, status, order_type, guest_count)
       VALUES (?, ?, 'ORD-A', 'serving', 'dine_in', 2)`,
      tableId, staffId
    );
    q.run(
      `INSERT INTO orders (table_id, user_id, order_code, status, order_type, guest_count)
       VALUES (?, ?, 'ORD-B', 'open', 'dine_in', 2)`,
      tableId, staffId
    );

    const status = tg.getTableGuestStatus(token);
    assert.strictEqual(status.can_submit, false);
    assert.match(status.block_reason, /nhiều hóa đơn/);

    assert.throws(
      () => tg.submitGuestItems(token, [{ item_id: itemId, quantity: 1 }]),
      err => err.code === 'MULTI_ORDER'
    );
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test('blocks submit when table is cleaning or reserved', () => {
  const tmp = path.join(os.tmpdir(), `myquang-tg6-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const tg = require('../src/lib/table-guest');
    const { token, tableId, itemId } = seedTableGuestFixture(q);

    q.run(`UPDATE tables SET status = 'cleaning' WHERE id = ?`, tableId);
    assert.throws(
      () => tg.submitGuestItems(token, [{ item_id: itemId, quantity: 1 }]),
      err => err.code === 'TABLE_UNAVAILABLE'
    );

    q.run(`UPDATE tables SET status = 'reserved' WHERE id = ?`, tableId);
    assert.throws(
      () => tg.submitGuestItems(token, [{ item_id: itemId, quantity: 1 }]),
      err => err.code === 'TABLE_UNAVAILABLE'
    );
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test('getTableGuestSummary reflects discount via final_amount', () => {
  const tmp = path.join(os.tmpdir(), `myquang-tg7-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const tg = require('../src/lib/table-guest');
    const { token, tableId, itemId, staffId } = seedTableGuestFixture(q);

    const order = q.run(
      `INSERT INTO orders (table_id, user_id, order_code, status, order_type, guest_count,
                           total_amount, discount_amount, final_amount)
       VALUES (?, ?, 'ORD-DISC', 'serving', 'dine_in', 2, 0, 0, 0)`,
      tableId, staffId
    );
    q.run(
      `INSERT INTO order_items (order_id, item_id, quantity, unit_price, subtotal, status)
       VALUES (?, ?, 1, 45000, 45000, 'pending')`,
      order.lastInsertRowid, itemId
    );
    q.recalcOrder(order.lastInsertRowid);
    q.run(
      `UPDATE orders SET discount_amount = 5000, final_amount = total_amount - 5000 WHERE id = ?`,
      order.lastInsertRowid
    );

    const summary = tg.getTableGuestSummary(tableId);
    assert.strictEqual(summary.total_amount, 45000);
    assert.strictEqual(summary.discount_amount, 5000);
    assert.strictEqual(summary.final_amount, 40000);

    const status = tg.getTableGuestStatus(token);
    assert.strictEqual(status.order.final_amount, 40000);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test('submitGuestItems rolls back empty order when items are invalid', () => {
  const tmp = path.join(os.tmpdir(), `myquang-tg8-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const tg = require('../src/lib/table-guest');
    const { token, tableId } = seedTableGuestFixture(q);

    assert.throws(
      () => tg.submitGuestItems(token, [{ item_id: 99999, quantity: 1 }]),
      /không hợp lệ/
    );

    const orders = q.all(
      `SELECT * FROM orders WHERE table_id = ? AND status IN ('open','serving')`,
      tableId
    );
    assert.strictEqual(orders.length, 0);

    const table = q.get(`SELECT status FROM tables WHERE id = ?`, tableId);
    assert.strictEqual(table.status, 'available');
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});
