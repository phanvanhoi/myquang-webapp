const crypto = require('crypto');
const { wantsJson } = require('../lib/http');

// Public JSON endpoints — không dùng session CSRF
const SKIP_PATHS = ['/order/submit'];

function csrfShouldSkip(path) {
  if (SKIP_PATHS.includes(path)) return true;
  if (/^\/t\/[a-f0-9]{32}\/submit$/.test(path)) return true;
  return false;
}

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
  if (csrfShouldSkip(req.path)) return next();

  const token = (req.body && req.body._csrf) || req.get('X-CSRF-Token');
  const expected = req.session && req.session.csrfToken;

  if (!expected || !token || token !== expected) {
    if (wantsJson(req)) {
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
