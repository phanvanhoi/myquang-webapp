const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

function loadDb(tmpPath) {
  process.env.DB_PATH = tmpPath;
  delete require.cache[require.resolve('../src/db')];
  delete require.cache[require.resolve('../src/lib/virtual-tables')];
  return require('../src/db');
}

function seedMinimalFloor(q) {
  q.run(`INSERT INTO roles (name, permissions) VALUES ('admin', '[]')`);
  const floor = q.run(`INSERT INTO floors (name, sort_order) VALUES ('T1', 1)`);
  const table = q.run(
    `INSERT INTO tables (floor_id, code, name, capacity, status, is_active, is_takeaway, is_virtual)
     VALUES (?, 'T1-B01', 'Bàn 01', 4, 'occupied', 1, 0, 0)`,
    floor.lastInsertRowid
  );
  const user = q.run(
    `INSERT INTO users (role_id, username, full_name, password_hash)
     VALUES (1, 'u1', 'User', 'x')`
  );
  return {
    parentId: table.lastInsertRowid,
    userId: user.lastInsertRowid,
  };
}

test('createVirtualTable adds bill with guest_count 2 and max 2 slots', () => {
  const tmp = path.join(os.tmpdir(), `myquang-vt-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const vt = require('../src/lib/virtual-tables');
    const { parentId, userId } = seedMinimalFloor(q);

    q.run(
      `INSERT INTO orders (table_id, user_id, order_code, status, guest_count)
       VALUES (?, ?, 'ORD-TEST-001', 'open', 1)`,
      parentId, userId
    );

    const first = vt.createVirtualTable(parentId, userId);
    assert.ok(first.virtualId > 0);
    const row1 = q.get(`SELECT * FROM tables WHERE id = ?`, first.virtualId);
    assert.strictEqual(row1.is_virtual, 1);
    assert.strictEqual(row1.parent_table_id, parentId);
    assert.match(row1.code, /^T1-B01-V1$/);

    const order1 = q.get(`SELECT guest_count FROM orders WHERE table_id = ?`, first.virtualId);
    assert.strictEqual(order1.guest_count, vt.DEFAULT_VIRTUAL_GUEST_COUNT);

    const second = vt.createVirtualTable(parentId, userId);
    assert.ok(second.virtualId > 0);

    assert.throws(
      () => vt.createVirtualTable(parentId, userId),
      /tối đa 2 bàn ảo/
    );
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test('afterOrderClosed removes virtual table and keeps parent occupied when sibling open', () => {
  const tmp = path.join(os.tmpdir(), `myquang-vt2-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const vt = require('../src/lib/virtual-tables');
    const { parentId, userId } = seedMinimalFloor(q);

    q.run(
      `INSERT INTO orders (table_id, user_id, order_code, status, guest_count)
       VALUES (?, ?, 'ORD-TEST-002', 'open', 1)`,
      parentId, userId
    );

    const { virtualId } = vt.createVirtualTable(parentId, userId);
    const virtualOrder = q.get(`SELECT id, table_id FROM orders WHERE table_id = ?`, virtualId);

    vt.afterOrderClosed(virtualOrder);

    const gone = q.get(`SELECT is_active FROM tables WHERE id = ?`, virtualId);
    assert.strictEqual(gone.is_active, 0);

    const parent = q.get(`SELECT status FROM tables WHERE id = ?`, parentId);
    assert.strictEqual(parent.status, 'occupied');
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test('kitchenTableLabel uses parent name for virtual tables', () => {
  const vt = require('../src/lib/virtual-tables');
  assert.strictEqual(
    vt.kitchenTableLabel({
      is_virtual: 1,
      parent_name: 'Bàn 03',
      table_name: 'Bàn 03 · Ảo 1',
    }),
    'Bàn 03 · Ảo 1'
  );
  assert.strictEqual(
    vt.kitchenTableLabel({ is_virtual: 0, table_name: 'Bàn 03' }),
    'Bàn 03'
  );
});
