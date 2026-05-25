const crypto = require('crypto');

// Public JSON endpoint — không dùng session CSRF
const SKIP_PATHS = ['/order/submit'];

function ensureCsrfToken(req) {
  if (!req.session) return '';
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

function csrfTokenMiddleware(req, res, next) {
  res.locals.csrfToken = ensureCsrfToken(req);
  next();
}

function csrfProtect(req, res, next) {
  if (req.method !== 'POST') return next();
  if (SKIP_PATHS.includes(req.path)) return next();

  const token = (req.body && req.body._csrf) || req.get('X-CSRF-Token');
  const expected = req.session && req.session.csrfToken;

  if (!expected || !token || token !== expected) {
    const wantsJson =
      req.is('application/json') ||
      (req.get('accept') || '').includes('application/json');
    if (wantsJson) {
      return res.status(403).json({
        success: false,
        error: 'Phiên làm việc không hợp lệ. Vui lòng tải lại trang.',
      });
    }
    if (req.session) {
      res.flash('error', 'Phiên làm việc không hợp lệ. Vui lòng thử lại.');
    }
    const back = req.get('Referer') || '/login';
    return res.redirect(back);
  }
  next();
}

module.exports = { csrfTokenMiddleware, csrfProtect };
