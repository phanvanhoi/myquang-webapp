const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

function loadDb(tmpPath) {
  process.env.DB_PATH = tmpPath;
  [
    '../src/db',
    '../src/lib/floor-plan',
    '../src/migrate-inventory',
  ].forEach((mod) => delete require.cache[require.resolve(mod)]);
  return require('../src/db');
}

function seedFloorPlan(q) {
  q.run(`INSERT INTO roles (name, permissions) VALUES ('admin', '[]')`);
  const user = q.run(
    `INSERT INTO users (role_id, username, full_name, password_hash) VALUES (1, 'u1', 'Admin', 'x')`
  );
  const cat = q.run(`INSERT INTO menu_categories (name, sort_order) VALUES ('Món', 1)`);
  const menu = q.run(
    `INSERT INTO menu_items (category_id, name, base_price, sort_order) VALUES (?, 'Test', 50000, 1)`,
    cat.lastInsertRowid
  );
  const floor = q.run(`INSERT INTO floors (name, sort_order) VALUES ('T1', 1)`);
  const parent = q.run(
    `INSERT INTO tables (floor_id, code, name, capacity, status, is_takeaway, is_virtual)
     VALUES (?, 'B01', 'Bàn 1', 4, 'occupied', 0, 0)`,
    floor.lastInsertRowid
  );
  const virtual = q.run(
    `INSERT INTO tables (floor_id, code, name, capacity, status, is_takeaway, is_virtual, parent_table_id)
     VALUES (?, 'B01-V1', 'Ảo 1', 2, 'occupied', 0, 1, ?)`,
    floor.lastInsertRowid,
    parent.lastInsertRowid
  );
  return {
    userId: user.lastInsertRowid,
    menuId: menu.lastInsertRowid,
    parentId: parent.lastInsertRowid,
    virtualId: virtual.lastInsertRowid,
  };
}

test('pickActiveOrderForTable prefers order with items', () => {
  const { pickActiveOrderForTable } = require('../src/lib/floor-plan');
  const orders = [
    { id: 1, item_count: 0 },
    { id: 2, item_count: 3 },
  ];
  assert.strictEqual(pickActiveOrderForTable(orders, false).id, 2);
});

test('pickActiveOrderForTable allows empty order on virtual table', () => {
  const { pickActiveOrderForTable } = require('../src/lib/floor-plan');
  const orders = [{ id: 5, item_count: 0 }];
  assert.strictEqual(pickActiveOrderForTable(orders, true).id, 5);
  assert.strictEqual(pickActiveOrderForTable(orders, false), null);
});

test('buildTableEntries batches counts without per-table queries', () => {
  const tmp = path.join(os.tmpdir(), `mq-floor-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const { userId, menuId, parentId, virtualId } = seedFloorPlan(q);

    const parentOrder = q.run(
      `INSERT INTO orders (table_id, user_id, order_code, status, order_type, guest_count)
       VALUES (?, ?, 'ORD-P1', 'serving', 'dine_in', 2)`,
      parentId,
      userId
    );
    q.run(
      `INSERT INTO order_items (order_id, item_id, quantity, unit_price, subtotal, status)
       VALUES (?, ?, 1, 50000, 50000, 'pending')`,
      parentOrder.lastInsertRowid,
      menuId
    );

    q.run(
      `INSERT INTO orders (table_id, user_id, order_code, status, order_type, guest_count)
       VALUES (?, ?, 'ORD-V1', 'open', 'dine_in', 2)`,
      virtualId,
      userId
    );

    const tables = q.all(`SELECT * FROM tables WHERE is_takeaway = 0 ORDER BY id`);
    const { buildTableEntries } = require('../src/lib/floor-plan');
    const entries = buildTableEntries(tables);

    const parent = entries.find((e) => e.table.id === parentId);
    const virtual = entries.find((e) => e.table.id === virtualId);

    assert.ok(parent.active_order);
    assert.strictEqual(parent.active_order.item_count, 1);
    assert.strictEqual(parent.active_virtual_count, 1);
    assert.strictEqual(parent.active_order_count, 1);

    assert.ok(virtual.active_order);
    assert.strictEqual(virtual.active_order.order_code, 'ORD-V1');
    assert.strictEqual(virtual.active_order_count, 1);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});
