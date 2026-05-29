const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

function loadDb(tmpPath) {
  process.env.DB_PATH = tmpPath;
  delete require.cache[require.resolve('../src/db')];
  delete require.cache[require.resolve('../src/lib/virtual-tables')];
  delete require.cache[require.resolve('../src/lib/table-move')];
  return require('../src/db');
}

function seedFloor(q) {
  q.run(`INSERT INTO roles (name, permissions) VALUES ('admin', '[]')`);
  const floor = q.run(`INSERT INTO floors (name, sort_order) VALUES ('T1', 1)`);
  const user = q.run(
    `INSERT INTO users (role_id, username, full_name, password_hash)
     VALUES (1, 'u1', 'User', 'x')`
  );
  const t1 = q.run(
    `INSERT INTO tables (floor_id, code, name, capacity, status, is_active, is_takeaway, is_virtual)
     VALUES (?, 'T1-B01', 'Bàn 01', 4, 'occupied', 1, 0, 0)`,
    floor.lastInsertRowid
  );
  const t2 = q.run(
    `INSERT INTO tables (floor_id, code, name, capacity, status, is_active, is_takeaway, is_virtual)
     VALUES (?, 'T1-B02', 'Bàn 02', 4, 'available', 1, 0, 0)`,
    floor.lastInsertRowid
  );
  const t3 = q.run(
    `INSERT INTO tables (floor_id, code, name, capacity, status, is_active, is_takeaway, is_virtual)
     VALUES (?, 'T1-B03', 'Bàn 03', 4, 'occupied', 1, 0, 0)`,
    floor.lastInsertRowid
  );
  return {
    userId: user.lastInsertRowid,
    table1: t1.lastInsertRowid,
    table2: t2.lastInsertRowid,
    table3: t3.lastInsertRowid,
  };
}

function openOrder(q, tableId, userId, code) {
  const ins = q.run(
    `INSERT INTO orders (table_id, user_id, order_code, status, order_type, guest_count)
     VALUES (?, ?, ?, 'serving', 'dine_in', 2)`,
    tableId, userId, code
  );
  return ins.lastInsertRowid;
}

test('moveOrderToTable updates table_id and sets source available / target occupied', () => {
  const tmp = path.join(os.tmpdir(), `myquang-move-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const move = require('../src/lib/table-move');
    const { userId, table1, table2 } = seedFloor(q);
    const orderId = openOrder(q, table1, userId, 'ORD-MOVE-001');

    const updated = move.moveOrderToTable(orderId, table2, userId);
    assert.strictEqual(updated.table_id, table2);

    const src = q.get(`SELECT status FROM tables WHERE id = ?`, table1);
    const dst = q.get(`SELECT status FROM tables WHERE id = ?`, table2);
    assert.strictEqual(src.status, 'available');
    assert.strictEqual(dst.status, 'occupied');

    const note = q.get(`SELECT note FROM orders WHERE id = ?`, orderId).note;
    assert.match(note, /Chuyển bàn/);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test('moveOrderToTable rejects non-available target', () => {
  const tmp = path.join(os.tmpdir(), `myquang-move2-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const move = require('../src/lib/table-move');
    const { userId, table1, table3 } = seedFloor(q);
    const orderId = openOrder(q, table1, userId, 'ORD-MOVE-002');
    openOrder(q, table3, userId, 'ORD-MOVE-003');

    assert.throws(
      () => move.moveOrderToTable(orderId, table3, userId),
      /không còn trống/
    );
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test('moveOrderToTable rejects second move to same target table', () => {
  const tmp = path.join(os.tmpdir(), `myquang-move2b-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const move = require('../src/lib/table-move');
    const { userId, table1, table2, table3 } = seedFloor(q);
    const orderA = openOrder(q, table1, userId, 'ORD-MOVE-A2');
    const orderB = openOrder(q, table3, userId, 'ORD-MOVE-B2');

    move.moveOrderToTable(orderA, table2, userId);

    assert.throws(
      () => move.moveOrderToTable(orderB, table2, userId),
      /không còn trống/
    );
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test('moveOrderToTable keeps source occupied when another active order remains', () => {
  const tmp = path.join(os.tmpdir(), `myquang-move3-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const move = require('../src/lib/table-move');
    const { userId, table1, table2 } = seedFloor(q);
    const orderA = openOrder(q, table1, userId, 'ORD-MOVE-A');
    openOrder(q, table1, userId, 'ORD-MOVE-B');

    move.moveOrderToTable(orderA, table2, userId);

    const src = q.get(`SELECT status FROM tables WHERE id = ?`, table1);
    assert.strictEqual(src.status, 'occupied');
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test('moveOrderToTable deactivates empty virtual source table', () => {
  const tmp = path.join(os.tmpdir(), `myquang-move4-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const move = require('../src/lib/table-move');
    const vt = require('../src/lib/virtual-tables');
    const { userId, table1, table2 } = seedFloor(q);

    q.run(
      `INSERT INTO orders (table_id, user_id, order_code, status, guest_count)
       VALUES (?, ?, 'ORD-PARENT', 'open', 1)`,
      table1, userId
    );
    const { virtualId } = vt.createVirtualTable(table1, userId);
    const virtualOrder = q.get(
      `SELECT id FROM orders WHERE table_id = ? AND status IN ('open','serving')`,
      virtualId
    );

    move.moveOrderToTable(virtualOrder.id, table2, userId);

    const virtual = q.get(`SELECT is_active FROM tables WHERE id = ?`, virtualId);
    assert.strictEqual(virtual.is_active, 0);

    const parent = q.get(`SELECT status FROM tables WHERE id = ?`, table1);
    assert.strictEqual(parent.status, 'occupied');
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test('failed move rolls back without partial table or order changes', () => {
  const tmp = path.join(os.tmpdir(), `myquang-move-rollback-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const move = require('../src/lib/table-move');
    const { userId, table1, table2, table3 } = seedFloor(q);
    const orderId = openOrder(q, table1, userId, 'ORD-ROLLBACK');

    assert.throws(
      () => move.moveOrderToTable(orderId, table3, userId),
      /không còn trống/
    );

    const order = q.get(`SELECT table_id, note FROM orders WHERE id = ?`, orderId);
    const src = q.get(`SELECT status FROM tables WHERE id = ?`, table1);
    const dst = q.get(`SELECT status FROM tables WHERE id = ?`, table3);
    const spare = q.get(`SELECT status FROM tables WHERE id = ?`, table2);

    assert.strictEqual(order.table_id, table1);
    assert.strictEqual(order.note, null);
    assert.strictEqual(src.status, 'occupied');
    assert.strictEqual(dst.status, 'occupied');
    assert.strictEqual(spare.status, 'available');
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test('listAvailableMoveTargets excludes source table', () => {
  const tmp = path.join(os.tmpdir(), `myquang-move5-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const move = require('../src/lib/table-move');
    const { table1, table2 } = seedFloor(q);

    const all = move.listAvailableMoveTargets();
    assert.ok(all.some(t => t.id === table2));
    assert.ok(all.some(t => t.id === table1) === false || q.get(`SELECT status FROM tables WHERE id = ?`, table1).status !== 'available');

    const filtered = move.listAvailableMoveTargets(table2);
    assert.ok(!filtered.some(t => t.id === table2));
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});
