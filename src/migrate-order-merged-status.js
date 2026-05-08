// One-shot migration: thêm value 'merged' vào CHECK constraint của orders.status
// để phục vụ nghiệp vụ "Gộp hóa đơn".
//
// SQLite không cho ALTER CHECK constraint trực tiếp. 2 phương án:
//   (a) Rebuild table — bị "database table is locked" với node-sqlite3-wasm
//       khi đụng DROP của bảng có FK references.
//   (b) Patch DDL trực tiếp qua sqlite_master với PRAGMA writable_schema=1.
//
// Chọn (b): nhanh, không lock, schema string thay đổi nhỏ nhưng có rủi ro nếu
// DDL không khớp pattern. Verify bằng integrity_check sau migration.
//
// Idempotent: kiểm tra DDL có 'merged' chưa, có rồi → skip.
//
// Cách chạy:  docker compose exec myquang node src/migrate-order-merged-status.js
//             node src/migrate-order-merged-status.js [--dry-run]

const { db } = require('./db');

const dryRun = process.argv.includes('--dry-run');

const OLD_CHECK = "CHECK (status IN ('open','serving','completed','cancelled'))";
const NEW_CHECK = "CHECK (status IN ('open','serving','completed','cancelled','merged'))";

function run() {
  const ddlRow = db.prepare(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'`
  ).get([]);

  if (!ddlRow || !ddlRow.sql) {
    console.error('Không tìm thấy bảng orders. Bỏ qua.');
    return;
  }

  if (ddlRow.sql.includes("'merged'")) {
    console.log("DDL hiện tại đã có 'merged' trong CHECK. Bỏ qua.");
    return;
  }

  if (!ddlRow.sql.includes(OLD_CHECK)) {
    console.error(
      "DDL hiện tại không khớp pattern OLD_CHECK. " +
      "Có thể đã có chỉnh sửa thủ công. Hủy migration để tránh ghi đè sai.\n" +
      "DDL hiện tại:\n" + ddlRow.sql
    );
    process.exit(1);
  }

  const newDdl = ddlRow.sql.replace(OLD_CHECK, NEW_CHECK);

  if (dryRun) {
    console.log('[DRY RUN] Sẽ thay DDL bảng orders thành:');
    console.log(newDdl);
    return;
  }

  console.log('Patching DDL của bảng orders...');

  // PRAGMA writable_schema cho phép UPDATE trực tiếp lên sqlite_master.
  // Ghi xong phải clear lại để tránh accidental modification về sau.
  db.exec('PRAGMA writable_schema = 1');
  try {
    const stmt = db.prepare(
      `UPDATE sqlite_master SET sql = ? WHERE type = 'table' AND name = 'orders'`
    );
    const result = stmt.run([newDdl]);
    if (!result.changes) {
      throw new Error('UPDATE sqlite_master không match row nào.');
    }
  } finally {
    db.exec('PRAGMA writable_schema = 0');
  }

  // Integrity check để chắc DDL không bị hỏng
  const integrity = db.prepare(`PRAGMA integrity_check`).all([]);
  const ok = integrity.length === 1 && integrity[0].integrity_check === 'ok';
  if (!ok) {
    console.error('⚠ integrity_check FAIL:', integrity);
    process.exit(1);
  }

  console.log("✓ Hoàn tất. Bảng orders giờ chấp nhận status='merged'.");
  console.log('  Lưu ý: cần restart app để DDL cache được nạp lại.');
}

run();
