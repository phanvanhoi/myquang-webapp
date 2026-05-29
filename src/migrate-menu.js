// One-shot migration: sync menu data to the layout shown on the printed menu.
// Run inside the running container:  docker exec -it myquang-app node src/migrate-menu.js
// Or locally:  node src/migrate-menu.js
const { db, q } = require('./db');

const TARGET = [
  {
    name: 'Mì Quảng Truyền Thống',
    sort: 1,
    items: [
      ['Mì Quảng Đặc Biệt', 80000],
      ['Mì Quảng Bò',       65000],
      ['Mì Quảng Ếch',      60000],
      ['Mì Quảng Gà',       55000],
      ['Mì Quảng Tôm Thịt', 55000],
      ['Mì Quảng Cá Lóc',   55000],
    ],
  },
  {
    name: 'Bún Mắm Nêm',
    sort: 2,
    items: [
      ['Bún Mắm Nêm Thập Cẩm Đặc Biệt', 75000],
      ['Bún Mắm Heo Quay (Thường)',     55000],
      ['Bún Mắm Heo Quay (Đặc Biệt)',   65000],
      ['Bún Mắm Thịt Luộc (Thường)',    45000],
      ['Bún Mắm Thịt Luộc (Đặc Biệt)',  55000],
    ],
  },
  {
    name: 'Món Cuốn',
    sort: 3,
    items: [
      ['Bánh Tráng Cuốn Heo Quay',  80000],
      ['Bánh Tráng Cuốn Thịt Luộc', 70000],
    ],
  },
  {
    name: 'Món Ăn Kèm',
    sort: 4,
    items: [
      ['Bánh Bột Lọc (Đĩa 6 cái)', 30000],
      ['Chả Ram Tôm Bình Định',    35000],
    ],
  },
  {
    name: 'Cơm Gà Hội An',
    sort: 5,
    items: [
      ['Cơm Gà Hội An (Phần Nhỏ)',     55000],
      ['Cơm Gà Hội An (Phần Đầy Đặn)', 65000],
    ],
  },
  {
    name: 'Giải Khát',
    sort: 6,
    items: [
      ['Coca Cola', 15000],
      ['Pepsi', 15000],
      ['Trà Chanh / Quất',  15000],
      ['Trà Sâm Dứa',        5000],
      ['Nước Suối',         10000],
    ],
  },
];

// Old → new name aliases so renames don't create duplicates.
const ITEM_ALIASES = {
  'Bún Mắm Heo Quay (Đặc biệt)':  'Bún Mắm Heo Quay (Đặc Biệt)',
  'Bún Mắm Thịt Luộc (Đặc biệt)': 'Bún Mắm Thịt Luộc (Đặc Biệt)',
};

const dryRun = process.argv.includes('--dry-run');

function findCategoryByName(name) {
  return db.prepare('SELECT id FROM menu_categories WHERE name = ? AND is_active = 1').get([name]);
}
function findItem(catId, name) {
  return db.prepare(
    'SELECT id, base_price, sort_order FROM menu_items WHERE category_id = ? AND name = ? AND is_active = 1'
  ).get([catId, name]);
}

const log = [];
function record(action, detail) { log.push({ action, detail }); }

db.exec('BEGIN');
try {
  const targetItemIds = new Set();

  TARGET.forEach((cat, idx) => {
    let row = findCategoryByName(cat.name);
    let catId;
    if (!row) {
      const r = q.run(
        `INSERT INTO menu_categories (name, sort_order, is_active) VALUES (?, ?, 1)`,
        cat.name, cat.sort
      );
      catId = r.lastInsertRowid;
      record('CATEGORY_INSERT', `${cat.name} (sort=${cat.sort})`);
    } else {
      catId = row.id;
      q.run(
        `UPDATE menu_categories SET sort_order = ?, is_active = 1,
                updated_at = datetime('now','localtime') WHERE id = ?`,
        cat.sort, catId
      );
      record('CATEGORY_UPDATE', `${cat.name} (sort=${cat.sort})`);
    }

    cat.items.forEach(([name, price], i) => {
      const sort = i + 1;

      // If an old-name version exists, rename it first
      for (const [oldName, newName] of Object.entries(ITEM_ALIASES)) {
        if (newName === name) {
          const old = findItem(catId, oldName);
          if (old) {
            q.run(
              `UPDATE menu_items SET name = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
              newName, old.id
            );
            record('ITEM_RENAME', `${oldName} → ${newName}`);
          }
        }
      }

      const item = findItem(catId, name);
      if (!item) {
        const r = q.run(
          `INSERT INTO menu_items (category_id, name, base_price, sort_order, is_available, is_active)
           VALUES (?, ?, ?, ?, 1, 1)`,
          catId, name, price, sort
        );
        targetItemIds.add(r.lastInsertRowid);
        record('ITEM_INSERT', `[${cat.name}] ${name} = ${price.toLocaleString('vi-VN')}đ`);
      } else {
        targetItemIds.add(item.id);
        const changes = [];
        if (item.base_price !== price) changes.push(`giá ${item.base_price}→${price}`);
        if (item.sort_order !== sort) changes.push(`sort ${item.sort_order}→${sort}`);
        q.run(
          `UPDATE menu_items
              SET category_id = ?, base_price = ?, sort_order = ?, is_available = 1, is_active = 1,
                  updated_at = datetime('now','localtime')
            WHERE id = ?`,
          catId, price, sort, item.id
        );
        if (changes.length) record('ITEM_UPDATE', `[${cat.name}] ${name}: ${changes.join(', ')}`);
      }
    });
  });

  // Soft-deactivate items not in the target set (preserves history of paid orders)
  const allActive = db.prepare(
    'SELECT mi.id, mi.name, mc.name AS cat FROM menu_items mi JOIN menu_categories mc ON mc.id = mi.category_id WHERE mi.is_active = 1'
  ).all([]);
  allActive.forEach(it => {
    if (!targetItemIds.has(it.id)) {
      q.run(
        `UPDATE menu_items SET is_active = 0, is_available = 0,
                updated_at = datetime('now','localtime') WHERE id = ?`,
        it.id
      );
      record('ITEM_DEACTIVATE', `[${it.cat}] ${it.name}`);
    }
  });

  // Soft-deactivate categories that no longer have any active items
  const orphanCats = db.prepare(`
    SELECT mc.id, mc.name FROM menu_categories mc
    WHERE mc.is_active = 1
      AND NOT EXISTS (SELECT 1 FROM menu_items mi WHERE mi.category_id = mc.id AND mi.is_active = 1)
      AND mc.name NOT IN (${TARGET.map(() => '?').join(',')})
  `).all(TARGET.map(c => c.name));
  orphanCats.forEach(c => {
    q.run(
      `UPDATE menu_categories SET is_active = 0,
              updated_at = datetime('now','localtime') WHERE id = ?`,
      c.id
    );
    record('CATEGORY_DEACTIVATE', c.name);
  });

  if (dryRun) {
    db.exec('ROLLBACK');
    console.log('[DRY RUN] Changes that would be applied:');
  } else {
    db.exec('COMMIT');
    console.log('Applied changes:');
  }
  log.forEach(l => console.log(`  ${l.action.padEnd(20)} ${l.detail}`));
  console.log(`\nTotal: ${log.length} change(s).`);
} catch (e) {
  db.exec('ROLLBACK');
  console.error('Migration failed:', e.message);
  process.exit(1);
}
