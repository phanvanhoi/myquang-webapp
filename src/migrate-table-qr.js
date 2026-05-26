// One-shot migration: public_token cho QR gọi món tại bàn.
// Run: node src/migrate-table-qr.js [--dry-run]
const crypto = require('crypto');
const { db, q } = require('./db');

const dryRun = process.argv.includes('--dry-run');
const log = [];

function columnExists(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all([]).some(r => r.name === column);
}

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

db.exec('BEGIN');
try {
  if (!columnExists('tables', 'public_token')) {
    db.exec(`ALTER TABLE tables ADD COLUMN public_token TEXT`);
    log.push('ADD COLUMN tables.public_token');
  } else {
    log.push('SKIP tables.public_token');
  }

  const tables = q.all(
    `SELECT id, code, public_token FROM tables
     WHERE is_active = 1 AND is_takeaway = 0 AND (is_virtual = 0 OR is_virtual IS NULL)`
  );

  let added = 0;
  tables.forEach(t => {
    if (t.public_token) return;
    const token = generateToken();
    q.run(
      `UPDATE tables SET public_token = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
      token,
      t.id
    );
    added += 1;
    log.push(`TOKEN  ${t.code} → ${token.slice(0, 8)}…`);
  });

  if (added === 0) {
    log.push('SKIP all physical tables already have public_token');
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
