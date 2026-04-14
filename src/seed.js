const bcrypt = require('bcryptjs');
const { db, q } = require('./db');

function seed() {
  const existing = q.get('SELECT COUNT(*) as cnt FROM floors');
  if (existing && existing.cnt > 0) {
    console.log('Database already seeded. Skipping.');
    return;
  }

  console.log('Seeding database...');

  db.exec('BEGIN');
  try {
    // ── Roles ──
    const roleAdmin = q.run(
      `INSERT INTO roles (name, description, permissions) VALUES (?,?,?)`,
      'admin', 'Chủ quán - Toàn quyền', '["all"]'
    );
    const roleCashier = q.run(
      `INSERT INTO roles (name, description, permissions) VALUES (?,?,?)`,
      'cashier', 'Thu ngân', '["order.view","order.create","order.edit","payment.create","payment.view","menu.view"]'
    );
    const roleWaiter = q.run(
      `INSERT INTO roles (name, description, permissions) VALUES (?,?,?)`,
      'waiter', 'Phục vụ', '["order.view","order.create","order.edit","menu.view"]'
    );

    // ── Users ──
    q.run(
      `INSERT INTO users (role_id, username, full_name, password_hash, pin_code) VALUES (?,?,?,?,?)`,
      roleAdmin.lastInsertRowid, 'admin', 'Chủ quán MyQuang',
      bcrypt.hashSync('admin123', 10), '1234'
    );
    q.run(
      `INSERT INTO users (role_id, username, full_name, password_hash, pin_code) VALUES (?,?,?,?,?)`,
      roleCashier.lastInsertRowid, 'thungan', 'Thu ngân',
      bcrypt.hashSync('thungan123', 10), '3456'
    );
    q.run(
      `INSERT INTO users (role_id, username, full_name, password_hash, pin_code) VALUES (?,?,?,?,?)`,
      roleWaiter.lastInsertRowid, 'phucvu', 'Phục vụ',
      bcrypt.hashSync('phucvu123', 10), '4567'
    );

    // ── Floors ──
    const f1 = q.run(`INSERT INTO floors (name, sort_order) VALUES (?,?)`, 'Tầng 1', 1);
    const f2 = q.run(`INSERT INTO floors (name, sort_order) VALUES (?,?)`, 'Tầng 2', 2);

    // ── Rooms ──
    const roomA = q.run(
      `INSERT INTO rooms (floor_id, name, capacity, sort_order) VALUES (?,?,?,?)`,
      f2.lastInsertRowid, 'Phòng A', 16, 1
    );
    const roomB = q.run(
      `INSERT INTO rooms (floor_id, name, capacity, sort_order) VALUES (?,?,?,?)`,
      f2.lastInsertRowid, 'Phòng B', 16, 2
    );

    // ── Tables: Tầng 1 ──
    for (let i = 1; i <= 6; i++) {
      q.run(
        `INSERT INTO tables (floor_id, room_id, code, name, capacity) VALUES (?,?,?,?,?)`,
        f1.lastInsertRowid, null,
        `T1-B${String(i).padStart(2,'0')}`,
        `Bàn ${String(i).padStart(2,'0')}`,
        i <= 4 ? 4 : 6
      );
    }
    // ── Tables: Phòng A ──
    for (let i = 1; i <= 4; i++) {
      q.run(
        `INSERT INTO tables (floor_id, room_id, code, name, capacity) VALUES (?,?,?,?,?)`,
        f2.lastInsertRowid, roomA.lastInsertRowid,
        `T2-PA-B${String(i).padStart(2,'0')}`,
        `Bàn A${String(i).padStart(2,'0')}`, 4
      );
    }
    // ── Tables: Phòng B ──
    for (let i = 1; i <= 4; i++) {
      q.run(
        `INSERT INTO tables (floor_id, room_id, code, name, capacity) VALUES (?,?,?,?,?)`,
        f2.lastInsertRowid, roomB.lastInsertRowid,
        `T2-PB-B${String(i).padStart(2,'0')}`,
        `Bàn B${String(i).padStart(2,'0')}`, 4
      );
    }

    // ── Menu Categories ──
    const catMain    = q.run(`INSERT INTO menu_categories (name, sort_order) VALUES (?,?)`, 'Món chính', 1);
    const catStarter = q.run(`INSERT INTO menu_categories (name, sort_order) VALUES (?,?)`, 'Khai vị', 2);
    const catDrink   = q.run(`INSERT INTO menu_categories (name, sort_order) VALUES (?,?)`, 'Đồ uống', 3);
    const catDessert = q.run(`INSERT INTO menu_categories (name, sort_order) VALUES (?,?)`, 'Tráng miệng', 4);

    // ── Menu Items ──
    const menuItems = [
      [catMain.lastInsertRowid,    'Cơm sườn nướng',    65000, 1],
      [catMain.lastInsertRowid,    'Cơm gà xào sả ớt', 60000, 2],
      [catMain.lastInsertRowid,    'Bún bò Huế',        55000, 3],
      [catMain.lastInsertRowid,    'Phở bò tái nạm',    60000, 4],
      [catMain.lastInsertRowid,    'Mì xào hải sản',    70000, 5],
      [catStarter.lastInsertRowid, 'Gỏi cuốn (2 cuốn)', 35000, 1],
      [catStarter.lastInsertRowid, 'Chả giò (4 cái)',   40000, 2],
      [catStarter.lastInsertRowid, 'Soup cua',          45000, 3],
      [catDrink.lastInsertRowid,   'Cà phê đen đá',     25000, 1],
      [catDrink.lastInsertRowid,   'Cà phê sữa đá',     30000, 2],
      [catDrink.lastInsertRowid,   'Trà đào cam sả',    45000, 3],
      [catDrink.lastInsertRowid,   'Nước ngọt lon',     20000, 4],
      [catDrink.lastInsertRowid,   'Bia Tiger lon',     35000, 5],
      [catDrink.lastInsertRowid,   'Nước suối',         15000, 6],
      [catDessert.lastInsertRowid, 'Chè đậu xanh',     25000, 1],
      [catDessert.lastInsertRowid, 'Kem ba màu',        30000, 2],
    ];
    menuItems.forEach(([cat, name, price, sort]) => {
      q.run(`INSERT INTO menu_items (category_id, name, base_price, sort_order) VALUES (?,?,?,?)`,
        cat, name, price, sort);
    });

    // ── Payment Methods ──
    ['Tiền mặt', 'Chuyển khoản', 'Momo'].forEach(name => {
      q.run(`INSERT INTO payment_methods (name) VALUES (?)`, name);
    });

    // ── Expense Categories ──
    ['Nguyên vật liệu','Điện - Nước','Lương nhân viên','Thuê mặt bằng','Sửa chữa - Bảo trì','Marketing','Chi phí khác'].forEach(name => {
      q.run(`INSERT INTO expense_categories (name) VALUES (?)`, name);
    });

    // ── Settings ──
    const defaults = [
      ['restaurant_name',    'Quán Ăn MyQuang',          'Tên quán'],
      ['restaurant_address', '123 Đường ABC, TP.HCM',    'Địa chỉ'],
      ['restaurant_phone',   '0901234567',               'Số điện thoại'],
      ['tax_rate',           '0',                        'Thuế suất (%)'],
      ['service_charge_rate','0',                        'Phí phục vụ (%)'],
      ['currency',           'VND',                      'Đơn vị tiền tệ'],
      ['receipt_footer_note','Cảm ơn quý khách đã dùng bữa tại MyQuang!', 'Ghi chú phiếu thu'],
      ['bank_account',       '',                         'Số tài khoản'],
      ['bank_name',          '',                         'Tên ngân hàng'],
      ['bank_owner',         '',                         'Tên chủ tài khoản'],
    ];
    defaults.forEach(([key, value, desc]) => {
      q.run(`INSERT INTO settings (key, value, description) VALUES (?,?,?)`, key, value, desc);
    });

    db.exec('COMMIT');
    console.log('✅ Database seeded!');
    console.log('   admin / admin123');
    console.log('   thungan / thungan123');
    console.log('   phucvu / phucvu123');
  } catch (e) {
    db.exec('ROLLBACK');
    console.error('❌ Seed failed:', e.message);
    throw e;
  }
}

module.exports = { seed };
