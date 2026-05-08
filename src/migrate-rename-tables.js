// One-shot rename: đánh lại số bàn tầng 2 cho liên tục với tầng 1.
//   Tầng 1 đã: bàn 01..05.
//   Tầng 2 phòng A: A01..A04 → A06..A09.
//   Tầng 2 phòng B: B01..B04 → B10..B13.
//
// Update cả `name` ("Bàn A01" → "Bàn A06") lẫn `code` ("T2-PA-B01" → "T2-PA-B06").
// WHERE theo code cũ (UNIQUE) nên idempotent — chạy lại sẽ no-op.
//
// Cách chạy:  docker compose exec myquang node src/migrate-rename-tables.js
//             node src/migrate-rename-tables.js [--dry-run]

const { db } = require('./db');

const dryRun = process.argv.includes('--dry-run');

const RENAMES = [
  // [oldCode,    newCode,     newName]
  ['T2-PA-B01', 'T2-PA-B06', 'Bàn A06'],
  ['T2-PA-B02', 'T2-PA-B07', 'Bàn A07'],
  ['T2-PA-B03', 'T2-PA-B08', 'Bàn A08'],
  ['T2-PA-B04', 'T2-PA-B09', 'Bàn A09'],
  ['T2-PB-B01', 'T2-PB-B10', 'Bàn B10'],
  ['T2-PB-B02', 'T2-PB-B11', 'Bàn B11'],
  ['T2-PB-B03', 'T2-PB-B12', 'Bàn B12'],
  ['T2-PB-B04', 'T2-PB-B13', 'Bàn B13'],
];

const log = [];

db.exec('BEGIN');
try {
  for (const [oldCode, newCode, newName] of RENAMES) {
    // Nếu đã rename rồi (newCode đã tồn tại) → skip
    const already = db.prepare(`SELECT id FROM tables WHERE code = ?`).get([newCode]);
    if (already) {
      log.push(`SKIP   ${oldCode} → ${newCode} (đã tồn tại id=${already.id})`);
      continue;
    }

    const old = db.prepare(`SELECT id, name FROM tables WHERE code = ?`).get([oldCode]);
    if (!old) {
      log.push(`MISS   ${oldCode} (không tìm thấy — có thể đã bị xóa hoặc đổi sẵn)`);
      continue;
    }

    db.prepare(
      `UPDATE tables
       SET code = ?, name = ?, updated_at = datetime('now','localtime')
       WHERE id = ?`
    ).run([newCode, newName, old.id]);

    log.push(`RENAME id=${old.id}  ${oldCode} "${old.name}" → ${newCode} "${newName}"`);
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
