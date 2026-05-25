// One-shot migration: bàn ảo (parent_table_id, is_virtual).
// Run: node src/migrate-virtual-tables.js [--dry-run]
const { db } = require('./db');

const dryRun = process.argv.includes('--dry-run');

function columnExists(table, column) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all([]);
  return rows.some(r => r.name === column);
}

const log = [];

db.exec('BEGIN');
try {
  if (!columnExists('tables', 'is_virtual')) {
    db.exec(`ALTER TABLE tables ADD COLUMN is_virtual INTEGER NOT NULL DEFAULT 0`);
    log.push('ADD COLUMN tables.is_virtual');
  } else {
    log.push('SKIP tables.is_virtual');
  }

  if (!columnExists('tables', 'parent_table_id')) {
    db.exec(`ALTER TABLE tables ADD COLUMN parent_table_id INTEGER REFERENCES tables(id) ON DELETE SET NULL`);
    log.push('ADD COLUMN tables.parent_table_id');
  } else {
    log.push('SKIP tables.parent_table_id');
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
