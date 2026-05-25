const express = require('express');
const router = express.Router();
const { q } = require('../db');
const { requireAuth, requireAdminOrCashier } = require('../middleware/auth');
const {
  roundMoney,
  parsePaymentAmounts,
  validatePaymentSubmission,
} = require('../lib/money');
const { localYmd } = require('../lib/date');

function recordPayment(orderId, methodName, amount) {
  if (amount <= 0) return;
  const method = q.get(
    `SELECT id FROM payment_methods WHERE name = ? AND is_active = 1`,
    methodName
  );
  if (!method) {
    throw new Error(`Phương thức thanh toán "${methodName}" chưa được cấu hình.`);
  }
  q.run(
    `INSERT INTO payments (order_id, method_id, amount, paid_at)
     VALUES (?, ?, ?, datetime('now','localtime'))`,
    orderId, method.id, amount
  );
}

router.get('/history', requireAdminOrCashier, (req, res) => {
  const now = new Date();
  const today = localYmd(now);

  // Backward compat: ?date_filter=YYYY-MM-DD hoặc ?date=...
  const legacy = req.query.date_filter || req.query.date;
  let start = req.query.start || legacy || today;
  let end   = req.query.end   || legacy || today;
  if (end < start) { const t = start; start = end; end = t; }

  // Danh sách HĐ completed trong khoảng
  const orders = q.all(
    `SELECT o.id, o.order_code, o.final_amount, o.discount_amount,
            o.updated_at, o.order_type,
            t.name  AS table_name,
            t.code  AS table_code,
            GROUP_CONCAT(pm.name, ', ') AS payment_methods,
            SUM(p.amount)               AS paid_amount
     FROM orders o
     JOIN tables t        ON t.id = o.table_id
     LEFT JOIN payments p ON p.order_id = o.id
     LEFT JOIN payment_methods pm ON pm.id = p.method_id
     WHERE o.status = 'completed'
       AND date(o.updated_at) BETWEEN ? AND ?
     GROUP BY o.id
     ORDER BY o.updated_at DESC`,
    start, end
  );

  // Doanh thu theo ngày — tách 2 query (orders & payments), gộp trong JS để tránh
  // double-count khi 1 order có nhiều payment.
  const orderRows = q.all(
    `SELECT date(o.updated_at) AS day,
            COUNT(*)                        AS order_count,
            COALESCE(SUM(o.final_amount), 0) AS revenue
     FROM orders o
     WHERE o.status = 'completed'
       AND date(o.updated_at) BETWEEN ? AND ?
     GROUP BY day`,
    start, end
  );
  const payRows = q.all(
    `SELECT date(o.updated_at) AS day,
            COALESCE(SUM(CASE WHEN pm.name = 'Tiền mặt'    THEN p.amount END), 0) AS cash,
            COALESCE(SUM(CASE WHEN pm.name = 'Chuyển khoản' THEN p.amount END), 0) AS transfer
     FROM payments p
     JOIN payment_methods pm ON pm.id = p.method_id
     JOIN orders o           ON o.id  = p.order_id
     WHERE o.status = 'completed'
       AND date(o.updated_at) BETWEEN ? AND ?
     GROUP BY day`,
    start, end
  );
  const payByDay = {};
  payRows.forEach(r => { payByDay[r.day] = r; });
  const dailyBreakdown = orderRows.map(r => ({
    day:         r.day,
    order_count: r.order_count,
    revenue:     r.revenue,
    cash:        payByDay[r.day] ? payByDay[r.day].cash     : 0,
    transfer:    payByDay[r.day] ? payByDay[r.day].transfer : 0,
  })).sort((a, b) => b.day.localeCompare(a.day));

  // Đơn hủy trong khoảng (cho audit)
  const cancelledOrders = q.all(
    `SELECT o.id, o.order_code, o.total_amount, o.note, o.updated_at,
            t.name AS table_name,
            u.full_name AS user_name
     FROM orders o
     JOIN tables t ON t.id = o.table_id
     LEFT JOIN users u ON u.id = o.user_id
     WHERE o.status = 'cancelled'
       AND date(o.updated_at) BETWEEN ? AND ?
     ORDER BY o.updated_at DESC`,
    start, end
  );

  // Đơn đã gộp trong khoảng (cho audit) — note có dạng "[Merged into ORD-...]"
  const mergedOrders = q.all(
    `SELECT o.id, o.order_code, o.total_amount, o.note, o.updated_at,
            t.name AS table_name,
            u.full_name AS user_name
     FROM orders o
     JOIN tables t ON t.id = o.table_id
     LEFT JOIN users u ON u.id = o.user_id
     WHERE o.status = 'merged'
       AND date(o.updated_at) BETWEEN ? AND ?
     ORDER BY o.updated_at DESC`,
    start, end
  );

  // Tổng tiền mặt / chuyển khoản
  const totals = q.get(
    `SELECT COALESCE(SUM(CASE WHEN pm.name = 'Tiền mặt'    THEN p.amount END), 0) AS cash,
            COALESCE(SUM(CASE WHEN pm.name = 'Chuyển khoản' THEN p.amount END), 0) AS transfer
     FROM payments p
     JOIN payment_methods pm ON pm.id = p.method_id
     JOIN orders o           ON o.id  = p.order_id
     WHERE o.status = 'completed'
       AND date(o.updated_at) BETWEEN ? AND ?`,
    start, end
  );

  const totalRevenue  = orders.reduce((s, o) => s + (o.final_amount || 0), 0);
  const cashTotal     = totals ? totals.cash     : 0;
  const transferTotal = totals ? totals.transfer : 0;

  // Preset URLs
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  const sixDaysAgo = new Date(now); sixDaysAgo.setDate(now.getDate() - 6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0);

  const presets = {
    today:     { start: today,             end: today,             label: 'Hôm nay' },
    yesterday: { start: localYmd(yest),         end: localYmd(yest),         label: 'Hôm qua' },
    last7:     { start: localYmd(sixDaysAgo),   end: today,             label: '7 ngày' },
    thisMonth: { start: localYmd(monthStart),   end: today,             label: 'Tháng này' },
    prevMonth: { start: localYmd(prevMonthStart), end: localYmd(prevMonthEnd), label: 'Tháng trước' },
  };

  res.render('payments/history.html', {
    orders, cancelledOrders, mergedOrders, dailyBreakdown,
    start, end,
    isRange: start !== end,
    presets,
    total_revenue:  totalRevenue,
    total_cash:     cashTotal,
    total_transfer: transferTotal,
  });
});

// ─────────────────────────────────────────────
// GET /payments/:orderId — trang thanh toán checkout
// Waiter được vào nhưng UI sẽ chỉ cho phép chuyển khoản (tiền mặt phải
// qua thu ngân vì waiter không cầm két).
// ─────────────────────────────────────────────
router.get('/:orderId', requireAuth, (req, res) => {
  const orderId = parseInt(req.params.orderId);

  const order = q.get(
    `SELECT o.*, t.name AS table_name, t.code AS table_code
     FROM orders o
     JOIN tables t ON t.id = o.table_id
     WHERE o.id = ?`,
    orderId
  );
  if (!order) {
    res.flash('error', 'Không tìm thấy order.');
    return res.redirect('/tables');
  }

  const rawItems = q.all(
    `SELECT oi.*, mi.name AS item_name
     FROM order_items oi
     JOIN menu_items mi ON mi.id = oi.item_id
     WHERE oi.order_id = ? AND oi.status != 'cancelled'
     ORDER BY oi.id`,
    orderId
  );

  // Giả lập object lồng nhau cho template (item.menu_item.name)
  const items = rawItems.map(i => ({
    ...i,
    menu_item: { name: i.item_name },
  }));

  order.table = {
    id:   order.table_id,
    name: order.table_name,
    code: order.table_code,
  };
  order.items = items;

  res.render('payments/checkout.html', {
    order,
    items,
    table: order.table,
  });
});

// ─────────────────────────────────────────────
// POST /payments/:orderId/confirm — xác nhận thanh toán
// ─────────────────────────────────────────────
router.post('/:orderId/confirm', requireAuth, (req, res) => {
  const orderId = parseInt(req.params.orderId);

  const { discountAmount, discountReason, cashAmount, transferAmount } =
    parsePaymentAmounts(req.body);
  const isWaiter = req.session.role === 'waiter';

  try {
    q.transaction(() => {
      const order = q.get(
        `SELECT o.*, t.name AS table_name
         FROM orders o
         JOIN tables t ON t.id = o.table_id
         WHERE o.id = ?`,
        orderId
      );
      if (!order) throw new Error('Không tìm thấy order.');
      if (!['open', 'serving'].includes(order.status)) {
        throw new Error(`Order đã ở trạng thái "${order.status}", không thể thanh toán.`);
      }

      const finalAmount = roundMoney(Math.max(0, order.total_amount - discountAmount));
      const paymentError = validatePaymentSubmission({
        cashAmount,
        transferAmount,
        finalAmount,
        isWaiter,
      });
      if (paymentError) throw new Error(paymentError);

      q.run(
        `UPDATE orders
         SET discount_amount = ?, discount_reason = ?, final_amount = ?,
             updated_at = datetime('now','localtime')
         WHERE id = ?`,
        discountAmount, discountReason || null, finalAmount, orderId
      );

      recordPayment(orderId, 'Tiền mặt', cashAmount);
      recordPayment(orderId, 'Chuyển khoản', transferAmount);

      q.run(
        `UPDATE orders SET status = 'completed', updated_at = datetime('now','localtime')
         WHERE id = ?`,
        orderId
      );

      q.run(
        `UPDATE tables SET status = 'available', updated_at = datetime('now','localtime')
         WHERE id = ?`,
        order.table_id
      );

      const tableName = order.table_name || `#${order.table_id}`;
      q.run(
        `INSERT INTO transactions
           (type, amount, description, reference_id, reference_type, user_id, occurred_at)
         VALUES ('income', ?, ?, ?, 'order', ?, datetime('now','localtime'))`,
        finalAmount,
        `Thu từ ${order.order_code} - ${tableName}`,
        orderId,
        req.session.userId
      );
    })();
    res.flash('success', 'Thanh toán thành công!');
    res.redirect('/tables');
  } catch (err) {
    res.flash('error', err.message || 'Có lỗi khi thanh toán.');
    res.redirect(`/payments/${orderId}`);
  }
});

// ─────────────────────────────────────────────
// GET /payments/:orderId/receipt — in hóa đơn
// ─────────────────────────────────────────────
router.get('/:orderId/receipt', requireAuth, (req, res) => {
  const orderId = parseInt(req.params.orderId);

  const order = q.get(
    `SELECT o.*, t.name AS table_name, t.code AS table_code
     FROM orders o
     JOIN tables t ON t.id = o.table_id
     WHERE o.id = ?`,
    orderId
  );
  if (!order) {
    res.flash('error', 'Không tìm thấy hóa đơn.');
    return res.redirect('/payments/history');
  }

  if (order.status !== 'completed' && req.session.role !== 'admin') {
    res.flash('error', 'Hóa đơn chỉ in được sau khi đã thanh toán.');
    return res.redirect(order.status === 'open' || order.status === 'serving'
      ? `/payments/${orderId}`
      : '/payments/history');
  }

  const rawItems = q.all(
    `SELECT oi.*, mi.name AS item_name
     FROM order_items oi
     JOIN menu_items mi ON mi.id = oi.item_id
     WHERE oi.order_id = ? AND oi.status != 'cancelled'
     ORDER BY oi.id`,
    orderId
  );

  const rawPayments = q.all(
    `SELECT p.*, pm.name AS method_name
     FROM payments p
     JOIN payment_methods pm ON pm.id = p.method_id
     WHERE p.order_id = ?
     ORDER BY p.id`,
    orderId
  );

  order.table = { id: order.table_id, name: order.table_name, code: order.table_code };
  order.items = rawItems.map(i => ({ ...i, menu_item: { name: i.item_name } }));
  order.payments = rawPayments.map(p => ({ ...p, method: { name: p.method_name } }));

  res.render('payments/receipt.html', {
    order,
    items:    order.items,
    payments: order.payments,
  });
});

module.exports = router;
