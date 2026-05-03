// One-shot migration: bỏ bàn T1-B06 (tầng 1 chỉ còn 5 bàn).
// Run inside container:  docker exec -it myquang-app node src/migrate-tables.js
// Local:  node src/migrate-tables.js [--dry-run]
const { db, q } = require('./db');

const REMOVE_CODES = ['T1-B06'];
const dryRun = process.argv.includes('--dry-run');

db.exec('BEGIN');
try {
  const log = [];
  for (const code of REMOVE_CODES) {
    const t = db.prepare('SELECT id, name, is_active FROM tables WHERE code = ?').get([code]);
    if (!t) { log.push(`${code}: không tồn tại, bỏ qua`); continue; }
    if (!t.is_active) { log.push(`${code}: đã inactive, bỏ qua`); continue; }

    const orders = db.prepare('SELECT COUNT(*) AS c FROM orders WHERE table_id = ?').get([t.id]);
    if (orders.c > 0) {
      // Có lịch sử order: chỉ soft-delete
      q.run(
        `UPDATE tables SET is_active = 0, status = 'available',
                updated_at = datetime('now','localtime') WHERE id = ?`,
        t.id
      );
      log.push(`${code} (${t.name}): soft-delete (có ${orders.c} order trong lịch sử)`);
    } else {
      // Không có order → xoá hẳn để code không còn UNIQUE
      q.run('DELETE FROM tables WHERE id = ?', t.id);
      log.push(`${code} (${t.name}): xoá hẳn (không có order)`);
    }
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
