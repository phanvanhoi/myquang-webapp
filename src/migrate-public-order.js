// One-shot migration: thêm customer_* columns vào orders + tạo sentinel user 'guest_online' cho public order.
// Idempotent — chạy nhiều lần không sao.
//
// Run inside container:  docker exec -it myquang-app node src/migrate-public-order.js
// Local:                 node src/migrate-public-order.js [--dry-run]
const bcrypt = require('bcryptjs');
const { db, q } = require('./db');

const dryRun = process.argv.includes('--dry-run');
const log = [];

const NEW_ORDER_COLUMNS = [
  ['customer_name',    'TEXT'],
  ['customer_phone',   'TEXT'],
  ['customer_address', 'TEXT'],
  ['customer_note',    'TEXT'],
];

db.exec('BEGIN');
try {
  // 1. ADD COLUMN nếu chưa có
  const existing = db.prepare(`PRAGMA table_info(orders)`).all([]).map(r => r.name);
  for (const [col, type] of NEW_ORDER_COLUMNS) {
    if (existing.includes(col)) {
      log.push(`SKIP    orders.${col} đã tồn tại`);
      continue;
    }
    db.exec(`ALTER TABLE orders ADD COLUMN ${col} ${type}`);
    log.push(`ADD     orders.${col} (${type})`);
  }

  // 2. Sentinel user 'guest_online' cho public order
  const guest = db.prepare(`SELECT id FROM users WHERE username = 'guest_online' LIMIT 1`).get([]);
  if (guest) {
    log.push(`SKIP    user 'guest_online' đã tồn tại (id=${guest.id})`);
  } else {
    const waiterRole = db.prepare(`SELECT id FROM roles WHERE name = 'waiter' LIMIT 1`).get([]);
    if (!waiterRole) {
      throw new Error("Role 'waiter' không tồn tại — chạy seed trước.");
    }
    const r = q.run(
      `INSERT INTO users (role_id, username, full_name, password_hash, is_active)
       VALUES (?, 'guest_online', 'Khách đặt online', ?, 0)`,
      waiterRole.id, bcrypt.hashSync(Math.random().toString(36).slice(2) + Date.now(), 10)
    );
    log.push(`INSERT  user 'guest_online' (id=${r.lastInsertRowid}, role=waiter, is_active=0 — tài khoản không thể đăng nhập)`);
  }

  if (dryRun) {
    db.exec('ROLLBACK');
    console.log('[DRY RUN] Sẽ thực hiện:');
  } else {
    db.exec('COMMIT');
    console.log('Đã thực hiện:');
  }
  log.forEach(l => console.log('  ' + l));
} catch (e) {
  db.exec('ROLLBACK');
  console.error('Migration failed:', e.message);
  process.exit(1);
}
