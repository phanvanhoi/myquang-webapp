// One-shot migration: thêm cột is_takeaway / order_type + sentinel "Mang về".
// Run inside container:  docker exec -it myquang-app node src/migrate-takeaway.js
// Local:  node src/migrate-takeaway.js [--dry-run]
const { db, q } = require('./db');

const dryRun = process.argv.includes('--dry-run');

function columnExists(table, column) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all([]);
  return rows.some(r => r.name === column);
}

const log = [];

db.exec('BEGIN');
try {
  // 1. ALTER TABLE tables ADD COLUMN is_takeaway
  if (!columnExists('tables', 'is_takeaway')) {
    db.exec(`ALTER TABLE tables ADD COLUMN is_takeaway INTEGER NOT NULL DEFAULT 0`);
    log.push('ADD COLUMN tables.is_takeaway');
  } else {
    log.push('SKIP (already has) tables.is_takeaway');
  }

  // 2. ALTER TABLE orders ADD COLUMN order_type
  // Note: ALTER TABLE ADD COLUMN với CHECK constraint không support trong SQLite —
  // nên CHECK chỉ áp dụng với fresh install qua db.js. Migrate dùng default + ràng buộc app-level.
  if (!columnExists('orders', 'order_type')) {
    db.exec(`ALTER TABLE orders ADD COLUMN order_type TEXT NOT NULL DEFAULT 'dine_in'`);
    log.push("ADD COLUMN orders.order_type (default 'dine_in')");
  } else {
    log.push('SKIP (already has) orders.order_type');
  }

  // 3. Insert sentinel "Mang về" (idempotent qua UNIQUE code='MV')
  const existing = db.prepare(`SELECT id, name FROM tables WHERE code = 'MV'`).get([]);
  if (!existing) {
    const firstFloor = db.prepare(`SELECT id FROM floors WHERE is_active = 1 ORDER BY sort_order, id LIMIT 1`).get([]);
    if (!firstFloor) throw new Error('Không tìm thấy floor nào để gán sentinel.');
    q.run(
      `INSERT INTO tables (floor_id, code, name, capacity, status, is_active, is_takeaway)
       VALUES (?, 'MV', 'Mang về', 0, 'available', 1, 1)`,
      firstFloor.id
    );
    log.push("INSERT sentinel table 'Mang về' (code=MV, is_takeaway=1)");
  } else {
    // Đảm bảo flag is_takeaway=1 (phòng trường hợp insert qua tay)
    q.run(`UPDATE tables SET is_takeaway = 1, is_active = 1 WHERE code = 'MV'`);
    log.push(`SKIP (exists) sentinel id=${existing.id}, ensured is_takeaway=1`);
  }

  if (dryRun) {
    db.exec('ROLLBACK');
    console.log('[DRY RUN] Sẽ thực hiện:');
  } else {
    db.exec('COMMIT');
    console.log('Đã thực hiện:');
  }
  log.forEach(l => console.log('  - ' + l));
} catch (e) {
  db.exec('ROLLBACK');
  console.error('Migration failed:', e.message);
  process.exit(1);
}
