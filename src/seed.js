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
    for (let i = 1; i <= 5; i++) {
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

    // ── Sentinel: Mang về (không hiện trên sơ đồ bàn) ──
    q.run(
      `INSERT INTO tables (floor_id, code, name, capacity, status, is_active, is_takeaway)
       VALUES (?, 'MV', 'Mang về', 0, 'available', 1, 1)`,
      f1.lastInsertRowid
    );

    // ── Menu Categories ──
    const catMiQuang  = q.run(`INSERT INTO menu_categories (name, sort_order) VALUES (?,?)`, 'Mì Quảng Truyền Thống', 1);
    const catBunMam   = q.run(`INSERT INTO menu_categories (name, sort_order) VALUES (?,?)`, 'Bún Mắm Nêm', 2);
    const catCuon     = q.run(`INSERT INTO menu_categories (name, sort_order) VALUES (?,?)`, 'Món Cuốn', 3);
    const catAnKem    = q.run(`INSERT INTO menu_categories (name, sort_order) VALUES (?,?)`, 'Món Ăn Kèm', 4);
    const catComGa    = q.run(`INSERT INTO menu_categories (name, sort_order) VALUES (?,?)`, 'Cơm Gà Hội An', 5);
    const catDrink    = q.run(`INSERT INTO menu_categories (name, sort_order) VALUES (?,?)`, 'Giải Khát', 6);

    // ── Menu Items ──
    const menuItems = [
      // Mì Quảng Truyền Thống
      [catMiQuang.lastInsertRowid, 'Mì Quảng Đặc Biệt',   80000, 1],
      [catMiQuang.lastInsertRowid, 'Mì Quảng Bò',         65000, 2],
      [catMiQuang.lastInsertRowid, 'Mì Quảng Ếch',        60000, 3],
      [catMiQuang.lastInsertRowid, 'Mì Quảng Gà',         55000, 4],
      [catMiQuang.lastInsertRowid, 'Mì Quảng Tôm Thịt',   55000, 5],
      [catMiQuang.lastInsertRowid, 'Mì Quảng Cá Lóc',     55000, 6],
      // Bún Mắm Nêm
      [catBunMam.lastInsertRowid,  'Bún Mắm Nêm Thập Cẩm Đặc Biệt', 75000, 1],
      [catBunMam.lastInsertRowid,  'Bún Mắm Heo Quay (Thường)',     55000, 2],
      [catBunMam.lastInsertRowid,  'Bún Mắm Heo Quay (Đặc Biệt)',   65000, 3],
      [catBunMam.lastInsertRowid,  'Bún Mắm Thịt Luộc (Thường)',    45000, 4],
      [catBunMam.lastInsertRowid,  'Bún Mắm Thịt Luộc (Đặc Biệt)',  55000, 5],
      // Món Cuốn
      [catCuon.lastInsertRowid,    'Bánh Tráng Cuốn Heo Quay',  80000, 1],
      [catCuon.lastInsertRowid,    'Bánh Tráng Cuốn Thịt Luộc', 70000, 2],
      // Món Ăn Kèm
      [catAnKem.lastInsertRowid,   'Bánh Bột Lọc (Đĩa 6 cái)',  30000, 1],
      [catAnKem.lastInsertRowid,   'Chả Ram Tôm Bình Định',     35000, 2],
      // Cơm Gà Hội An
      [catComGa.lastInsertRowid,   'Cơm Gà Hội An (Phần Nhỏ)',      55000, 1],
      [catComGa.lastInsertRowid,   'Cơm Gà Hội An (Phần Đầy Đặn)',  65000, 2],
      // Giải Khát
      [catDrink.lastInsertRowid,   'Coca Cola',         15000, 1],
      [catDrink.lastInsertRowid,   'Pepsi',             15000, 2],
      [catDrink.lastInsertRowid,   'Trà Chanh / Quất',  15000, 3],
      [catDrink.lastInsertRowid,   'Trà Sâm Dứa',        5000, 4],
      [catDrink.lastInsertRowid,   'Nước Suối',         10000, 5],
    ];
    const catNames = {
      [catMiQuang.lastInsertRowid]: 'Mì Quảng Truyền Thống',
      [catBunMam.lastInsertRowid]: 'Bún Mắm Nêm',
      [catCuon.lastInsertRowid]: 'Món Cuốn',
      [catAnKem.lastInsertRowid]: 'Món Ăn Kèm',
      [catComGa.lastInsertRowid]: 'Cơm Gà Hội An',
      [catDrink.lastInsertRowid]: 'Giải Khát',
    };
    menuItems.forEach(([cat, name, price, sort]) => {
      const img = resolveMenuImage(name, catNames[cat] || '');
      q.run(
        `INSERT INTO menu_items (category_id, name, base_price, sort_order, image_url) VALUES (?,?,?,?,?)`,
        cat, name, price, sort, img
      );
    });

    const { ensureInventoryItems, splitCombinedDrink, syncRecipes } = require('./migrate-inventory');
    const { resolveMenuImage } = require('./lib/menu-stock-images');
    ensureInventoryItems();
    splitCombinedDrink();
    syncRecipes();

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
      ['bank_account',       '7167676767',               'Số tài khoản'],
      ['bank_name',          'MB',                       'Tên ngân hàng (mã VietQR)'],
      ['bank_owner',         'HO KINH DOANH E E.. MI QUANG QUE', 'Tên chủ tài khoản'],
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
