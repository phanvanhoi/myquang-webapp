const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { q } = require('../db');
const { requireAdmin } = require('../middleware/auth');

// Toàn bộ /settings yêu cầu admin
router.use(requireAdmin);

// ─────────────────────────────────────────────────────────────
// GET /settings
// ─────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const settings = q.getSettings();

  // Lấy users kèm role name
  const users = q.all(`
    SELECT u.*, r.name as role_name
    FROM users u
    JOIN roles r ON r.id = u.role_id
    ORDER BY u.created_at
  `);

  const roles = q.all(`SELECT * FROM roles ORDER BY id`);

  res.render('settings/index.html', {
    settings,
    users,
    roles,
    activeTab: req.query.tab || 'info',
  });
});

// ─────────────────────────────────────────────────────────────
// POST /settings  — lưu cài đặt chung + ngân hàng
// ─────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const fields = [
    'restaurant_name',
    'restaurant_address',
    'restaurant_phone',
    'bank_account',
    'bank_name',
    'bank_owner',
    'receipt_footer_note',
    // template cũ gửi key khác — hỗ trợ cả hai
    'address',
    'phone',
  ];

  fields.forEach(key => {
    if (req.body[key] !== undefined) {
      q.upsertSetting(key, req.body[key] || '');
    }
  });

  res.flash('success', 'Đã lưu cài đặt');
  res.redirect('/settings');
});

// ─────────────────────────────────────────────────────────────
// POST /settings/users  — tạo tài khoản mới
// ─────────────────────────────────────────────────────────────
router.post('/users', (req, res) => {
  const { username, full_name, password, role_id } = req.body;

  if (!username || !full_name || !password || !role_id) {
    res.flash('error', 'Vui lòng điền đầy đủ thông tin');
    return res.redirect('/settings?tab=users');
  }

  // Kiểm tra username đã tồn tại chưa
  const exists = q.get(
    `SELECT id FROM users WHERE username = ?`, username
  );
  if (exists) {
    res.flash('error', `Username "${username}" đã tồn tại`);
    return res.redirect('/settings?tab=users');
  }

  const hash = bcrypt.hashSync(password, 10);

  try {
    q.run(`
      INSERT INTO users (role_id, username, full_name, password_hash)
      VALUES (?, ?, ?, ?)
    `, role_id, username, full_name, hash);

    res.flash('success', `Tạo tài khoản "${username}" thành công`);
  } catch (err) {
    res.flash('error', 'Tạo tài khoản thất bại: ' + err.message);
  }

  res.redirect('/settings?tab=users');
});

// ─────────────────────────────────────────────────────────────
// POST /settings/users/:id/toggle  — bật/tắt tài khoản
// ─────────────────────────────────────────────────────────────
router.post('/users/:id/toggle', (req, res) => {
  const userId = parseInt(req.params.id, 10);

  // Không thể tự khóa chính mình
  if (userId === req.session.userId) {
    res.flash('error', 'Không thể khóa tài khoản đang đăng nhập');
    return res.redirect('/settings?tab=users');
  }

  const user = q.get(`SELECT id, is_active, username FROM users WHERE id = ?`, userId);
  if (!user) {
    res.flash('error', 'Không tìm thấy tài khoản');
    return res.redirect('/settings?tab=users');
  }

  const newStatus = user.is_active ? 0 : 1;
  q.run(`UPDATE users SET is_active = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
    newStatus, userId);

  const label = newStatus ? 'Kích hoạt' : 'Khóa';
  res.flash('success', `${label} tài khoản "${user.username}" thành công`);
  res.redirect('/settings?tab=users');
});

// ─────────────────────────────────────────────────────────────
// POST /settings/users/:id/reset-password  — đặt lại mật khẩu
// ─────────────────────────────────────────────────────────────
router.post('/users/:id/reset-password', (req, res) => {
  const userId = parseInt(req.params.id, 10);

  const user = q.get(`SELECT id, username, full_name FROM users WHERE id = ?`, userId);
  if (!user) {
    res.flash('error', 'Không tìm thấy tài khoản');
    return res.redirect('/settings?tab=users');
  }

  // Tạo mật khẩu ngẫu nhiên 8 ký tự (chữ + số)
  const newPwd = Math.random().toString(36).slice(-8);
  const hash   = bcrypt.hashSync(newPwd, 10);

  q.run(`UPDATE users SET password_hash = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
    hash, userId);

  res.flash('success', `Mật khẩu mới của "${user.full_name}": ${newPwd}`);
  res.redirect('/settings?tab=users');
});

module.exports = router;
