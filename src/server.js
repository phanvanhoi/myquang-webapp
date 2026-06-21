const express = require('express');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const nunjucks = require('nunjucks');
const path = require('path');

const { seed } = require('./seed');
const { q } = require('./db');
const { wantsJson } = require('./lib/http');

// ── Process-level safety net ──
// Node ≥15 kills process on unhandled rejection by default. Log + survive
// thay vì để container restart loop khi 1 route lỡ throw không catch.
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

// ── Seed on startup ──
seed();

try {
  const { ensureInventoryItems, splitCombinedDrink, syncRecipes } = require('./migrate-inventory');
  ensureInventoryItems();
  splitCombinedDrink();
  syncRecipes();
} catch (err) {
  console.error('[inventory-bootstrap]', err.message);
}

try {
  const { ensureMenuStockImages } = require('./migrate-menu-images');
  ensureMenuStockImages();
} catch (err) {
  console.error('[menu-images-bootstrap]', err.message);
}

const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SECRET_KEY;
if (isProduction && !sessionSecret) {
  console.error('[FATAL] SECRET_KEY is required when NODE_ENV=production');
  process.exit(1);
}

const app = express();

if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

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
  // Default MemoryStore không evict expired sessions → leak RAM theo thời
  // gian (mỗi tab POS, mỗi bot hit /order public tạo 1 session 4h trong
  // RAM). memorystore evict TTL nên RAM bounded. Vẫn in-memory (mất khi
  // restart, staff phải login lại) — giữ nguyên hành vi cũ, chỉ chặn leak.
  store: new MemoryStore({
    checkPeriod: 60 * 60 * 1000, // sweep mỗi giờ
  }),
  secret: sessionSecret || 'myquang-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 4 * 60 * 60 * 1000, // 4 hours
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === '1',
  },
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

  try {
    const introPage = require('./lib/intro-page');
    res.locals.publicHotline = introPage.hotlineTel;
  } catch (_) {
    res.locals.publicHotline = '+84971351112';
  }

  if (
    req.method === 'GET'
    && !wantsJson(req)
    && req.session.userId
    && ['admin', 'cashier'].includes(req.session.role)
  ) {
    try {
      const { getCachedDailySummary } = require('./lib/inventory-daily-cache');
      res.locals.inventoryDaily = getCachedDailySummary();
    } catch (_) {
      res.locals.inventoryDaily = null;
    }
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

const { csrfTokenMiddleware, csrfProtect } = require('./middleware/csrf');
app.use(csrfTokenMiddleware);
app.use(csrfProtect);

// ── Routes ──
app.use('/',        require('./routes/auth'));
app.use('/tables',  require('./routes/tables'));
app.use('/takeaway',require('./routes/takeaway'));
app.use('/menu',    require('./routes/menu'));
app.use('/orders',  require('./routes/orders'));
app.use('/kitchen', require('./routes/kitchen'));
app.use('/payments',require('./routes/payments'));
app.use('/order',   require('./routes/public'));    // public, không yêu cầu login
app.use('/gioi-thieu', require('./routes/intro')); // trang giới thiệu (Taplink)
app.use('/t',       require('./routes/table-guest')); // QR gọi món tại bàn
app.use('/finance', require('./routes/finance'));
app.use('/reports', require('./routes/reports'));
app.use('/dashboard',require('./routes/reports'));   // reports also handles /dashboard
app.use('/settings',require('./routes/settings'));
app.use('/inventory', require('./routes/inventory'));

// ── 404 ──
app.use((req, res) => {
  res.status(404).render('error.html', {
    message: `Không tìm thấy trang: ${req.path}`
  });
});

// ── Global error handler ──
// Bắt mọi exception bubble lên từ route/middleware. Không có nó, Express
// chỉ in stack ra stdout và trả 500 text/html mặc định; với async handler
// throw không catch, response có thể không bao giờ gửi → request hang.
app.use((err, req, res, next) => {
  console.error('[express-error]', err);
  if (res.headersSent) return next(err);
  // Defensive: nếu lỗi fire trước locals middleware, session/settings có
  // thể chưa set → base.html render fail. Set fallback tối thiểu.
  res.locals.session = res.locals.session || req.session || {};
  res.locals.settings = res.locals.settings || {};
  res.locals.flash = res.locals.flash || [];
  res.locals.currentPath = res.locals.currentPath || req.path;
  res.locals.query = res.locals.query || req.query || {};
  if (wantsJson(req)) {
    return res.status(500).json({ success: false, error: 'Đã có lỗi xảy ra.' });
  }
  try {
    return res.status(500).render('error.html', { message: 'Đã có lỗi xảy ra. Vui lòng thử lại.' });
  } catch (_) {
    return res.status(500).send('Đã có lỗi xảy ra.');
  }
});

// ── Start ──
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`\n🍜 MyQuang Web App`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Đăng nhập: admin / admin123\n`);
});
