const express = require('express');
const router = express.Router();
const { q } = require('../db');
const { requireAuth, requireAdminOrCashier } = require('../middleware/auth');

// ─────────────────────────────────────────────
// GET /payments/history — lịch sử hóa đơn (theo ngày / giai đoạn)
// ─────────────────────────────────────────────
function ymd(d) {
  // Local YYYY-MM-DD (tránh lệch UTC)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

router.get('/history', requireAdminOrCashier, (req, res) => {
  const now = new Date();
  const today = ymd(now);

  // Backward compat: ?date_filter=YYYY-MM-DD hoặc ?date=...
  const legacy = req.query.date_filter || req.query.date;
  let start = req.query.start || legacy || today;
  let end   = req.query.end   || legacy || today;
  if (end < start) { const t = start; start = end; end = t; }

  // Danh sách HĐ completed trong khoảng
  const orders = q.all(
    `SELECT o.id, o.order_code, o.final_amount, o.discount_amount,
            o.updated_at,
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
    yesterday: { start: ymd(yest),         end: ymd(yest),         label: 'Hôm qua' },
    last7:     { start: ymd(sixDaysAgo),   end: today,             label: '7 ngày' },
    thisMonth: { start: ymd(monthStart),   end: today,             label: 'Tháng này' },
    prevMonth: { start: ymd(prevMonthStart), end: ymd(prevMonthEnd), label: 'Tháng trước' },
  };

  res.render('payments/history.html', {
    orders, cancelledOrders, dailyBreakdown,
    start, end,
    isRange: start !== end,
    totalRevenue, cashTotal, transferTotal,
    presets,
    // Aliases cho template / link cũ
    date_filter:    start,
    total_revenue:  totalRevenue,
    total_cash:     cashTotal,
    total_transfer: transferTotal,
  });
});

// ─────────────────────────────────────────────
// GET /payments/:orderId — trang thanh toán checkout
// ─────────────────────────────────────────────
router.get('/:orderId', requireAdminOrCashier, (req, res) => {
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

  const paymentMethods = q.all(
    `SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY id`
  );

  const settings = q.getSettings();

  // Gán table và items vào order cho template dùng order.table.name
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
    paymentMethods,
    settings,
  });
});

// ─────────────────────────────────────────────
// POST /payments/:orderId/confirm — xác nhận thanh toán
// ─────────────────────────────────────────────
router.post('/:orderId/confirm', requireAdminOrCashier, (req, res) => {
  const orderId = parseInt(req.params.orderId);

  const discountAmount = parseFloat(req.body.discount_amount) || 0;
  const discountReason = (req.body.discount_reason || '').trim();
  const cashAmount     = parseFloat(req.body.cash_amount)     || 0;
  const transferAmount = parseFloat(req.body.transfer_amount) || 0;

  try {
    const doPayment = q.transaction(() => {
      // 1. Lấy order, kiểm tra trạng thái
      const order = q.get(`SELECT * FROM orders WHERE id = ?`, orderId);
      if (!order) throw new Error('Không tìm thấy order.');
      if (!['open', 'serving'].includes(order.status)) {
        throw new Error(`Order đã ở trạng thái "${order.status}", không thể thanh toán.`);
      }

      // 2. Tính final_amount sau giảm giá
      const finalAmount = Math.max(0, order.total_amount - discountAmount);

      q.run(
        `UPDATE orders
         SET discount_amount = ?, discount_reason = ?, final_amount = ?,
             updated_at = datetime('now','localtime')
         WHERE id = ?`,
        discountAmount, discountReason || null, finalAmount, orderId
      );

      // 3. Ghi payments
      if (cashAmount > 0) {
        const cashMethod = q.get(
          `SELECT id FROM payment_methods WHERE name = 'Tiền mặt' AND is_active = 1`
        );
        if (cashMethod) {
          q.run(
            `INSERT INTO payments (order_id, method_id, amount, paid_at)
             VALUES (?, ?, ?, datetime('now','localtime'))`,
            orderId, cashMethod.id, cashAmount
          );
        }
      }

      if (transferAmount > 0) {
        const transferMethod = q.get(
          `SELECT id FROM payment_methods WHERE name = 'Chuyển khoản' AND is_active = 1`
        );
        if (transferMethod) {
          q.run(
            `INSERT INTO payments (order_id, method_id, amount, paid_at)
             VALUES (?, ?, ?, datetime('now','localtime'))`,
            orderId, transferMethod.id, transferAmount
          );
        }
      }

      // 4. Cập nhật trạng thái order → completed
      q.run(
        `UPDATE orders SET status = 'completed', updated_at = datetime('now','localtime')
         WHERE id = ?`,
        orderId
      );

      // 5. Giải phóng bàn
      q.run(
        `UPDATE tables SET status = 'available', updated_at = datetime('now','localtime')
         WHERE id = ?`,
        order.table_id
      );

      // 6. Ghi transaction thu nhập
      const tableRow = q.get(`SELECT name FROM tables WHERE id = ?`, order.table_id);
      const tableName = tableRow ? tableRow.name : `#${order.table_id}`;

      q.run(
        `INSERT INTO transactions
           (type, amount, description, reference_id, reference_type, user_id, occurred_at)
         VALUES ('income', ?, ?, ?, 'order', ?, datetime('now','localtime'))`,
        finalAmount,
        `Thu từ ${order.order_code} - ${tableName}`,
        orderId,
        req.session.userId
      );
    });

    doPayment();
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

  const settings = q.getSettings();

  // Giả lập object lồng nhau cho template
  order.table    = { id: order.table_id, name: order.table_name, code: order.table_code };
  order.items    = rawItems.map(i => ({ ...i, menu_item: { name: i.item_name } }));
  order.payments = rawPayments.map(p => ({ ...p, method: { name: p.method_name } }));

  res.render('payments/receipt.html', {
    order,
    items:    order.items,
    payments: order.payments,
    settings,
  });
});

module.exports = router;
