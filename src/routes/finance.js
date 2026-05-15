const express = require('express');
const router = express.Router();
const { q } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// LƯU Ý: trước đây có 3 route admin sửa/xoá khoản chi
// (GET/POST /expenses/:id/edit, POST /expenses/:id/delete) — đã gỡ theo
// quyết định nghiệp vụ: khoản chi đã ghi nhận là immutable, sai thì
// ghi nhận khoản đối ứng mới chứ không sửa lịch sử. Nếu cần escape
// hatch, làm trực tiếp DB qua docker exec.

// ─────────────────────────────────────────────
// GET /finance — tổng quan thu chi
// ─────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  // Doanh thu hôm nay (từ payments của orders đã hoàn thành)
  const incomeRow = q.get(
    `SELECT COALESCE(SUM(p.amount), 0) AS total
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     WHERE o.status = 'completed'
       AND date(p.paid_at) = date('now', 'localtime')`
  );
  const todayIncome = incomeRow ? incomeRow.total : 0;

  // Chi phí hôm nay
  const expenseRow = q.get(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM expenses
     WHERE date(occurred_at) = date('now', 'localtime')`
  );
  const todayExpense = expenseRow ? expenseRow.total : 0;

  const profit = todayIncome - todayExpense;

  // Tháng lọc (mặc định tháng hiện tại)
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const selectedMonth = req.query.month || defaultMonth;

  // Chi phí theo tháng đã chọn (kèm category_name + user full_name)
  const expenses = q.all(
    `SELECT e.*, ec.name AS category_name, u.full_name AS user_full_name
     FROM expenses e
     JOIN expense_categories ec ON ec.id = e.category_id
     LEFT JOIN users u ON u.id = e.user_id
     WHERE strftime('%Y-%m', e.occurred_at) = ?
     ORDER BY e.occurred_at DESC`,
    selectedMonth
  );

  // Khoản thu theo tháng — từng payment của các order completed.
  // Dùng paid_at thay vì orders.updated_at để không bị nhảy ngày khi
  // hoá đơn được sửa (gặp gotcha với ORD-20260513-023).
  const incomes = q.all(
    `SELECT p.id AS payment_id, p.amount, p.paid_at,
            pm.name AS method_name,
            o.id AS order_id, o.order_code,
            t.name AS table_name
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     JOIN tables t ON t.id = o.table_id
     JOIN payment_methods pm ON pm.id = p.method_id
     WHERE o.status = 'completed'
       AND strftime('%Y-%m', p.paid_at) = ?
     ORDER BY p.paid_at DESC`,
    selectedMonth
  );

  // Danh mục chi phí đang hoạt động
  const categories = q.all(
    `SELECT * FROM expense_categories WHERE is_active = 1 ORDER BY name`
  );

  const total_expense = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const total_income  = incomes.reduce((sum, i) => sum + (i.amount  || 0), 0);

  res.render('finance/index.html', {
    todayIncome,
    todayExpense,
    profit,
    expenses,
    incomes,
    categories,
    selectedMonth,
    total_expense,
    total_income,
    // Aliases cho template cũ (nếu template dùng tên khác)
    total_income_today:   todayIncome,
    total_expense_today:  todayExpense,
    profit_today:         profit,
    month:                selectedMonth,
  });
});

// ─────────────────────────────────────────────
// POST /finance/expenses — thêm khoản chi
// ─────────────────────────────────────────────
router.post('/expenses', requireAuth, (req, res) => {
  const categoryId  = parseInt(req.body.category_id);
  const amount      = parseFloat(req.body.amount);
  const description = (req.body.description || '').trim();
  const occurredAt  = req.body.occurred_at || new Date().toISOString().slice(0, 16);

  if (!categoryId || !amount || amount <= 0 || !description) {
    res.flash('error', 'Vui lòng điền đầy đủ thông tin khoản chi.');
    return res.redirect('/finance');
  }

  try {
    const addExpense = q.transaction(() => {
      // Ghi expense
      const result = q.run(
        `INSERT INTO expenses (category_id, user_id, amount, description, occurred_at)
         VALUES (?, ?, ?, ?, ?)`,
        categoryId, req.session.userId, amount, description, occurredAt
      );
      const expenseId = result.lastInsertRowid;

      // Ghi transaction
      q.run(
        `INSERT INTO transactions
           (type, amount, description, reference_type, reference_id, user_id, occurred_at)
         VALUES ('expense', ?, ?, 'expense', ?, ?, ?)`,
        amount, description, expenseId, req.session.userId, occurredAt
      );

      return expenseId;
    });

    addExpense();
    res.flash('success', 'Đã ghi nhận khoản chi.');
  } catch (err) {
    res.flash('error', err.message || 'Có lỗi khi ghi nhận khoản chi.');
  }

  res.redirect('/finance');
});

// ─────────────────────────────────────────────
// GET /finance/categories — danh mục chi phí
// ─────────────────────────────────────────────
router.get('/categories', requireAdmin, (req, res) => {
  const categories = q.all(
    `SELECT ec.*,
            COUNT(e.id) AS expense_count
     FROM expense_categories ec
     LEFT JOIN expenses e ON e.category_id = ec.id
     GROUP BY ec.id
     ORDER BY ec.name`
  );

  res.render('finance/categories.html', { categories });
});

// ─────────────────────────────────────────────
// POST /finance/categories — thêm danh mục
// ─────────────────────────────────────────────
router.post('/categories', requireAdmin, (req, res) => {
  const name        = (req.body.name || '').trim();
  const description = (req.body.description || '').trim();

  if (!name) {
    res.flash('error', 'Vui lòng nhập tên danh mục.');
    return res.redirect('/finance/categories');
  }

  try {
    q.run(
      `INSERT INTO expense_categories (name, description) VALUES (?, ?)`,
      name, description || null
    );
    res.flash('success', `Đã thêm danh mục "${name}".`);
  } catch (err) {
    res.flash('error', 'Danh mục đã tồn tại hoặc có lỗi xảy ra.');
  }

  res.redirect('/finance/categories');
});

// ─────────────────────────────────────────────
// POST /finance/categories/:id/delete — ẩn danh mục
// ─────────────────────────────────────────────
router.post('/categories/:id/delete', requireAdmin, (req, res) => {
  const catId = parseInt(req.params.id);

  // Kiểm tra còn khoản chi không
  const usageRow = q.get(
    `SELECT COUNT(*) AS cnt FROM expenses WHERE category_id = ?`,
    catId
  );
  if (usageRow && usageRow.cnt > 0) {
    res.flash(
      'error',
      `Danh mục đang được dùng bởi ${usageRow.cnt} khoản chi, không thể xóa.`
    );
    return res.redirect('/finance/categories');
  }

  q.run(
    `UPDATE expense_categories SET is_active = 0 WHERE id = ?`,
    catId
  );

  res.flash('success', 'Đã ẩn danh mục.');
  res.redirect('/finance/categories');
});

module.exports = router;
