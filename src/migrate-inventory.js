// Migration: tồn kho + tách Coca/Pepsi + công thức trừ Nem/Chả.
// Chạy: node src/migrate-inventory.js
const { db, q } = require('./db');
const { DEFAULT_INVENTORY } = require('./lib/inventory');

const RECIPES_BY_MENU_NAME = {
  'Bún Mắm Nêm Thập Cẩm Đặc Biệt': { nem: 1, cha: 1 },
  'Bún Mắm Thịt Luộc (Đặc Biệt)': { nem: 1, cha: 1 },
  'Bún Mắm Heo Quay (Đặc Biệt)': { nem: 1, cha: 1 },
  'Chả Ram Tôm Bình Định': { cha: 1 },
  'Coca Cola': { coca: 1 },
  'Pepsi': { pepsi: 1 },
  'Nước Suối': { nuoc_suoi: 1 },
};

function ensureInventoryItems() {
  for (const row of DEFAULT_INVENTORY) {
    const existing = q.get(`SELECT id FROM inventory_items WHERE code = ?`, row.code);
    if (!existing) {
      q.run(
        `INSERT INTO inventory_items (code, name, unit, qty_on_hand) VALUES (?, ?, ?, 0)`,
        row.code,
        row.name,
        row.unit
      );
    }
  }
}

function splitCombinedDrink() {
  const combined = q.get(
    `SELECT mi.* FROM menu_items mi
     WHERE mi.name = 'Pepsi / Coca Cola' AND mi.is_active = 1`
  );
  if (!combined) return;

  const catId = combined.category_id;
  const price = combined.base_price;
  const sort = combined.sort_order;

  q.run(`UPDATE menu_items SET is_active = 0 WHERE id = ?`, combined.id);

  const coca = q.get(
    `SELECT id FROM menu_items WHERE category_id = ? AND name = 'Coca Cola' AND is_active = 1`,
    catId
  );
  if (!coca) {
    q.run(
      `INSERT INTO menu_items (category_id, name, base_price, sort_order, is_available, is_active)
       VALUES (?, 'Coca Cola', ?, ?, 1, 1)`,
      catId,
      price,
      sort
    );
  }

  const pepsi = q.get(
    `SELECT id FROM menu_items WHERE category_id = ? AND name = 'Pepsi' AND is_active = 1`,
    catId
  );
  if (!pepsi) {
    q.run(
      `INSERT INTO menu_items (category_id, name, base_price, sort_order, is_available, is_active)
       VALUES (?, 'Pepsi', ?, ?, 1, 1)`,
      catId,
      price,
      sort + 1
    );
  }
}

function syncRecipes() {
  const codes = Object.fromEntries(
    q.all(`SELECT id, code FROM inventory_items`).map(r => [r.code, r.id])
  );

  for (const [menuName, recipe] of Object.entries(RECIPES_BY_MENU_NAME)) {
    const menuItem = q.get(
      `SELECT id FROM menu_items WHERE name = ? AND is_active = 1 ORDER BY id LIMIT 1`,
      menuName
    );
    if (!menuItem) continue;

    q.run(`DELETE FROM menu_item_recipes WHERE menu_item_id = ?`, menuItem.id);

    for (const [code, qty] of Object.entries(recipe)) {
      const invId = codes[code];
      if (!invId) continue;
      q.run(
        `INSERT INTO menu_item_recipes (menu_item_id, inventory_item_id, qty_per_serving)
         VALUES (?, ?, ?)`,
        menuItem.id,
        invId,
        qty
      );
    }
  }
}

function runMigration() {
  db.exec('BEGIN');
  try {
    ensureInventoryItems();
    splitCombinedDrink();
    syncRecipes();
    db.exec('COMMIT');
    return true;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

if (require.main === module) {
  try {
    runMigration();
    console.log('migrate-inventory: OK');
  } catch (e) {
    console.error('migrate-inventory FAILED:', e.message);
    process.exit(1);
  }
}

module.exports = {
  ensureInventoryItems,
  splitCombinedDrink,
  syncRecipes,
  runMigration,
};
