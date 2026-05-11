const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { q } = require('../db');

// Waiter không thấy menu Dashboard/Báo cáo/Thu Chi → đẩy thẳng vào /tables
// sau login thay vì /dashboard (đỡ trang trống/khó hiểu).
function landingFor(role) {
  return role === 'waiter' ? '/tables' : '/dashboard';
}

// GET / → redirect based on login state
router.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect(landingFor(req.session.role));
  }
  res.redirect('/login');
});

// GET /login → render login page
router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect(landingFor(req.session.role));
  }
  res.render('login.html', { error: req.query.error || null });
});

// POST /login → authenticate user
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.redirect('/login?error=' + encodeURIComponent('Vui lòng nhập tên đăng nhập và mật khẩu'));
  }

  // Get user with role name via JOIN
  const user = q.get(
    `SELECT u.*, r.name as role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.username = ? AND u.is_active = 1`,
    username
  );

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.redirect(
      '/login?error=' + encodeURIComponent('Tên đăng nhập hoặc mật khẩu không đúng')
    );
  }

  // Set session
  req.session.userId   = user.id;
  req.session.username = user.username;
  req.session.fullName = user.full_name;
  req.session.role     = user.role;

  // Update last_login_at
  q.run(
    `UPDATE users SET last_login_at = datetime('now','localtime'), updated_at = datetime('now','localtime') WHERE id = ?`,
    user.id
  );

  res.redirect(landingFor(user.role));
});

// GET /logout → destroy session and redirect login
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
