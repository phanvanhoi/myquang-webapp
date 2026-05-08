// One-shot migration: cộng 7 giờ cho mọi cột timestamp tự động,
// dùng khi DB cũ đã lưu UTC vì server VPS chạy TZ=UTC nhưng SQL gọi
// datetime('now','localtime'). Sau khi VPS đã set TZ=Asia/Ho_Chi_Minh,
// các record mới sẽ là giờ VN — script này kéo các record cũ về cùng mốc.
//
// Idempotent: ghi marker vào bảng settings, chạy lại sẽ no-op.
//
// Chỉ động vào các cột do DB tự sinh (created_at/updated_at/last_login_at/paid_at).
// KHÔNG đụng occurred_at trong expenses/transactions vì đó là input của user.
//
// Cách chạy:  node src/migrate-fix-tz.js
// (nhớ stop app + backup file myquang.db trước khi chạy)

const { db } = require('./db');

const COLUMNS_TO_SHIFT = [
  ['floors',             ['created_at', 'updated_at']],
  ['rooms',              ['created_at', 'updated_at']],
  ['tables',             ['created_at', 'updated_at']],
  ['roles',              ['created_at', 'updated_at']],
  ['users',              ['created_at', 'updated_at', 'last_login_at']],
  ['menu_categories',    ['created_at', 'updated_at']],
  ['menu_items',         ['created_at', 'updated_at']],
  ['orders',             ['created_at', 'updated_at']],
  ['order_items',        ['created_at', 'updated_at']],
  ['payment_methods',    ['created_at']],
  ['payments',           ['paid_at', 'created_at']],
  ['expense_categories', ['created_at']],
  ['expenses',           ['created_at', 'updated_at']],
  ['transactions',       ['created_at']],
  ['settings',           ['updated_at']],
];

const MARKER_KEY = 'tz_shifted_utc_to_vn';

function alreadyMigrated() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get([MARKER_KEY]);
  return row && row.value === '1';
}

function run() {
  if (alreadyMigrated()) {
    console.log('Đã migrate trước đó (settings.' + MARKER_KEY + ' = 1). Bỏ qua.');
    return;
  }

  console.log('Bắt đầu shift +7h cho các cột timestamp tự động...');
  db.exec('BEGIN');
  try {
    let total = 0;
    for (const [table, cols] of COLUMNS_TO_SHIFT) {
      for (const col of cols) {
        const sql = `UPDATE ${table} SET ${col} = datetime(${col}, '+7 hours') WHERE ${col} IS NOT NULL`;
        const res = db.prepare(sql).run([]);
        console.log(`  ${table}.${col}: ${res.changes} rows`);
        total += res.changes;
      }
    }

    db.prepare(
      `INSERT INTO settings (key, value, description)
       VALUES (?, '1', ?)
       ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = datetime('now','localtime')`
    ).run([MARKER_KEY, 'Đã shift created_at/updated_at +7h từ UTC sang giờ VN']);

    db.exec('COMMIT');
    console.log(`✓ Hoàn tất. Tổng cộng ${total} row được cập nhật.`);
  } catch (e) {
    db.exec('ROLLBACK');
    console.error('✗ Migration lỗi, đã rollback:', e);
    process.exit(1);
  }
}

run();
