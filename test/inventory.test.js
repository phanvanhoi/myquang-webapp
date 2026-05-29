const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

function loadDb(tmpPath) {
  process.env.DB_PATH = tmpPath;
  [
    '../src/db',
    '../src/lib/inventory',
    '../src/lib/order-items',
    '../src/migrate-inventory',
  ].forEach((mod) => delete require.cache[require.resolve(mod)]);
  return require('../src/db');
}

function seedInventoryFixture(q) {
  q.run(`INSERT INTO roles (name, permissions) VALUES ('admin', '[]')`);
  const user = q.run(
    `INSERT INTO users (role_id, username, full_name, password_hash) VALUES (1, 'u1', 'Admin', 'x')`
  );
  const floor = q.run(`INSERT INTO floors (name, sort_order) VALUES ('T1', 1)`);
  const table = q.run(
    `INSERT INTO tables (floor_id, code, name, capacity, status, is_takeaway, is_virtual)
     VALUES (?, 'T1-B01', 'Bàn 01', 4, 'available', 0, 0)`,
    floor.lastInsertRowid
  );
  const cat = q.run(`INSERT INTO menu_categories (name, sort_order, is_active) VALUES ('Bún', 1, 1)`);
  const special = q.run(
    `INSERT INTO menu_items (category_id, name, base_price, sort_order, is_available, is_active)
     VALUES (?, 'Bún Mắm Thịt Luộc (Đặc Biệt)', 55000, 1, 1, 1)`,
    cat.lastInsertRowid
  );
  const chaRam = q.run(
    `INSERT INTO menu_items (category_id, name, base_price, sort_order, is_available, is_active)
     VALUES (?, 'Chả Ram Tôm Bình Định', 35000, 2, 1, 1)`,
    cat.lastInsertRowid
  );

  const { ensureInventoryItems, syncRecipes } = require('../src/migrate-inventory');
  ensureInventoryItems();
  q.run(`UPDATE inventory_items SET qty_on_hand = 5 WHERE code IN ('nem','cha')`);
  q.run(
    `INSERT INTO menu_item_recipes (menu_item_id, inventory_item_id, qty_per_serving)
     SELECT ?, id, 1 FROM inventory_items WHERE code = 'nem'`,
    special.lastInsertRowid
  );
  q.run(
    `INSERT INTO menu_item_recipes (menu_item_id, inventory_item_id, qty_per_serving)
     SELECT ?, id, 1 FROM inventory_items WHERE code = 'cha'`,
    special.lastInsertRowid
  );
  q.run(
    `INSERT INTO menu_item_recipes (menu_item_id, inventory_item_id, qty_per_serving)
     SELECT ?, id, 1 FROM inventory_items WHERE code = 'cha'`,
    chaRam.lastInsertRowid
  );

  const order = q.run(
    `INSERT INTO orders (table_id, user_id, order_code, status, order_type, guest_count)
     VALUES (?, ?, 'ORD-INV-1', 'open', 'dine_in', 1)`,
    table.lastInsertRowid,
    user.lastInsertRowid
  );

  return {
    userId: user.lastInsertRowid,
    orderId: order.lastInsertRowid,
    specialMenuId: special.lastInsertRowid,
    chaMenuId: chaRam.lastInsertRowid,
  };
}

test('special bun deducts nem and cha', () => {
  const tmp = path.join(os.tmpdir(), `myquang-inv-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const { userId, orderId, specialMenuId } = seedInventoryFixture(q);
    const { addItemsToOrder } = require('../src/lib/order-items');

    addItemsToOrder(orderId, [{ item_id: specialMenuId, quantity: 1 }], userId);

    const nem = q.get(`SELECT qty_on_hand FROM inventory_items WHERE code = 'nem'`);
    const cha = q.get(`SELECT qty_on_hand FROM inventory_items WHERE code = 'cha'`);
    assert.strictEqual(nem.qty_on_hand, 4);
    assert.strictEqual(cha.qty_on_hand, 4);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test('blocks special bun when nem insufficient', () => {
  const tmp = path.join(os.tmpdir(), `myquang-inv2-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const { userId, orderId, specialMenuId } = seedInventoryFixture(q);
    q.run(`UPDATE inventory_items SET qty_on_hand = 0 WHERE code = 'nem'`);
    const { addItemsToOrder } = require('../src/lib/order-items');

    assert.throws(
      () => addItemsToOrder(orderId, [{ item_id: specialMenuId, quantity: 1 }], userId),
      /Không đủ Nem/
    );
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test('cancel order item restores inventory', () => {
  const tmp = path.join(os.tmpdir(), `myquang-inv3-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const inventory = require('../src/lib/inventory');
    const { userId, orderId, specialMenuId } = seedInventoryFixture(q);
    const { addItemsToOrder } = require('../src/lib/order-items');

    addItemsToOrder(orderId, [{ item_id: specialMenuId, quantity: 1 }], userId);
    const line = q.get(`SELECT id FROM order_items WHERE order_id = ?`, orderId);
    inventory.restoreForOrderItem(line.id, userId);

    const nem = q.get(`SELECT qty_on_hand FROM inventory_items WHERE code = 'nem'`);
    assert.strictEqual(nem.qty_on_hand, 5);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test('buildDailySummary returns inventory overview for daily dialog', () => {
  const tmp = path.join(os.tmpdir(), `mq-inv-summary-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    const { q } = loadDb(tmp);
    const { ensureInventoryItems } = require('../src/migrate-inventory');
    ensureInventoryItems();
    const inventory = require('../src/lib/inventory');
    q.run(`UPDATE inventory_items SET qty_on_hand = 20`);
    q.run(`UPDATE inventory_items SET qty_on_hand = 3 WHERE code = 'nem'`);

    const summary = inventory.buildDailySummary();
    assert.ok(summary.dateKey);
    assert.ok(summary.dateLabel);
    assert.strictEqual(summary.items.length, 5);
    assert.strictEqual(summary.lowStockCount, 1);
    assert.ok(summary.lowStockNamesText.includes('Nem'));
    const nem = summary.items.find((i) => i.code === 'nem');
    assert.strictEqual(nem.level, 'low');
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});
