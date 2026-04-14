const express = require('express');
const session = require('express-session');
const nunjucks = require('nunjucks');
const path = require('path');

const { seed } = require('./seed');
const { q } = require('./db');

// ── Seed on startup ──
seed();

const app = express();

// ── Template engine: Nunjucks ──
const env = nunjucks.configure(
  path.join(__dirname, '..', 'app', 'templates'),
  {
    autoescape: true,
    express: app,
    watch: false,
  }
);

// ── Custom filters ──
env.addFilter('currency', (value) => {
  if (value == null) return '0đ';
  return Number(value).toLocaleString('vi-VN') + 'đ';
});
env.addFilter('dt', (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d)) return value;
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
});
env.addFilter('date', (value) => {
  if (!value) return '';
  return String(value).slice(0, 10).split('-').reverse().join('/');
});
env.addFilter('abs', (value) => Math.abs(value));
env.addFilter('tojson', (value) => JSON.stringify(value));
env.addFilter('startsWith', (str, prefix) => str ? str.startsWith(prefix) : false);
env.addFilter('int', (value) => parseInt(value) || 0);
env.addFilter('float', (value) => parseFloat(value) || 0);
env.addFilter('min', (arr) => Array.isArray(arr) ? Math.min(...arr) : arr);
env.addFilter('max', (arr) => Array.isArray(arr) ? Math.max(...arr) : arr);

// ── Middleware ──
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'app', 'static')));

app.use(session({
  secret: process.env.SECRET_KEY || 'myquang-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 4 * 60 * 60 * 1000 }, // 4 hours
}));

// ── Global template locals ──
app.use((req, res, next) => {
  res.locals.session   = req.session;
  res.locals.currentPath = req.path;
  res.locals.query     = req.query;
  res.locals.flash     = req.session.flash || [];
  delete req.session.flash;

  // Restaurant settings in every template
  try {
    const settings = q.getSettings();
    res.locals.settings = settings;
  } catch (_) {
    res.locals.settings = {};
  }

  next();
});

// Helper to add flash message
app.use((req, res, next) => {
  res.flash = (type, message) => {
    if (!req.session.flash) req.session.flash = [];
    req.session.flash.push({ type, message });
  };
  next();
});

// ── Routes ──
app.use('/',        require('./routes/auth'));
app.use('/tables',  require('./routes/tables'));
app.use('/menu',    require('./routes/menu'));
app.use('/orders',  require('./routes/orders'));
app.use('/payments',require('./routes/payments'));
app.use('/finance', require('./routes/finance'));
app.use('/reports', require('./routes/reports'));
app.use('/dashboard',require('./routes/reports'));   // reports also handles /dashboard
app.use('/settings',require('./routes/settings'));

// ── 404 ──
app.use((req, res) => {
  res.status(404).render('error.html', {
    message: `Không tìm thấy trang: ${req.path}`
  });
});

// ── Start ──
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`\n🍜 MyQuang Web App`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Đăng nhập: admin / admin123\n`);
});
