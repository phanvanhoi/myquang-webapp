function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  if (req.session.role !== 'admin') {
    return res.status(403).render('error.html', {
      message: 'Bạn không có quyền thực hiện thao tác này.'
    });
  }
  next();
}

function requireAdminOrCashier(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  if (!['admin', 'cashier'].includes(req.session.role)) {
    return res.status(403).render('error.html', {
      message: 'Bạn không có quyền thực hiện thao tác này.'
    });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireAdminOrCashier };
