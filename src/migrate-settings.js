// One-shot migration: cập nhật settings (chỉ ghi đè khi giá trị hiện tại rỗng).
// Run inside container:  docker exec -it myquang-app node src/migrate-settings.js
// Local:  node src/migrate-settings.js [--dry-run] [--force]
//   --dry-run : chỉ in ra, không commit
//   --force   : ghi đè cả khi giá trị hiện tại không rỗng
const { db, q } = require('./db');

const TARGET = [
  ['bank_account', '7167676767'],
  ['bank_name',    'MB'],
  ['bank_owner',   'HO KINH DOANH E E.. MI QUANG QUE'],
];

const dryRun = process.argv.includes('--dry-run');
const force  = process.argv.includes('--force');

db.exec('BEGIN');
try {
  const log = [];

  for (const [key, newValue] of TARGET) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get([key]);
    const current = row ? row.value : null;

    if (!row) {
      q.run(
        `INSERT INTO settings (key, value, description) VALUES (?, ?, ?)`,
        key, newValue, key
      );
      log.push(`INSERT  ${key} = "${newValue}"`);
      continue;
    }

    if (current === newValue) {
      log.push(`SKIP    ${key} = "${current}" (đã đúng)`);
      continue;
    }

    if (current && current.trim() !== '' && !force) {
      log.push(`KEEP    ${key} = "${current}" (đã có giá trị, dùng --force để ghi đè thành "${newValue}")`);
      continue;
    }

    q.run(
      `UPDATE settings SET value = ?, updated_at = datetime('now','localtime') WHERE key = ?`,
      newValue, key
    );
    log.push(`UPDATE  ${key} = "${current || ''}" → "${newValue}"`);
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
