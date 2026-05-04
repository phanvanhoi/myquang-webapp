const express = require('express');
const router = express.Router();
const { q } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

function getSentinel() {
  return q.get(`SELECT * FROM tables WHERE is_takeaway = 1 LIMIT 1`);
}

// POST /takeaway/new — tạo đơn mang về mới
router.post('/new', (req, res) => {
  const sentinel = getSentinel();
  if (!sentinel) {
    res.flash('error', 'Chưa cấu hình "Mang về". Liên hệ admin.');
    return res.redirect('/tables');
  }

  const orderCode = q.generateOrderCode();
  const r = q.run(
    `INSERT INTO orders (table_id, user_id, order_code, status, order_type, guest_count,
                         created_at, updated_at)
     VALUES (?, ?, ?, 'open', 'takeaway', 0,
             datetime('now','localtime'), datetime('now','localtime'))`,
    sentinel.id, req.session.userId, orderCode
  );
  res.redirect(`/takeaway/${r.lastInsertRowid}`);
});

// GET /takeaway/:orderId — POS view cho 1 đơn mang về
router.get('/:orderId', (req, res) => {
  const orderId = parseInt(req.params.orderId);

  const order = q.get(
    `SELECT o.*, u.full_name as user_full_name
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     WHERE o.id = ? AND o.order_type = 'takeaway'`,
    orderId
  );

  if (!order) {
    res.flash('error', 'Đơn mang về không tồn tại.');
    return res.redirect('/tables');
  }
  if (order.status === 'completed' || order.status === 'cancelled') {
    res.flash('error', `Đơn ${order.order_code} đã ${order.status === 'completed' ? 'thanh toán' : 'hủy'}, không thể chỉnh sửa.`);
    return res.redirect('/tables');
  }

  order.user = order.user_full_name ? { full_name: order.user_full_name } : null;

  const rawItems = q.all(
    `SELECT oi.*, mi.name as item_name, mi.base_price
     FROM order_items oi
     JOIN menu_items mi ON mi.id = oi.item_id
     WHERE oi.order_id = ?
     ORDER BY oi.created_at`,
    order.id
  );
  const items = rawItems.map(item => ({
    ...item,
    menu_item: { name: item.item_name, base_price: item.base_price },
  }));
  order.items = items;

  // Pseudo-table cho template (header dùng table.name)
  const sentinel = getSentinel();
  const table = {
    id: sentinel.id,
    name: 'Mang về',
    code: order.order_code,
    floor: null,
    room: null,
    is_takeaway: 1,
  };

  const menuCategories = q.all(
    `SELECT * FROM menu_categories WHERE is_active = 1 ORDER BY sort_order, name`
  );
  const menuItems = q.all(
    `SELECT mi.*, mc.name as category_name
     FROM menu_items mi
     JOIN menu_categories mc ON mc.id = mi.category_id
     WHERE mi.is_active = 1
     ORDER BY mc.sort_order, mi.sort_order, mi.name`
  );

  res.render('tables/order_detail.html', {
    table, order, items, menuCategories, menuItems,
    isTakeaway: true,
  });
});

// POST /takeaway/:orderId/cancel — hủy đơn mang về
router.post('/:orderId/cancel', (req, res) => {
  const orderId = parseInt(req.params.orderId);

  const order = q.get(
    `SELECT * FROM orders WHERE id = ? AND order_type = 'takeaway'`,
    orderId
  );
  if (!order) {
    res.flash('error', 'Đơn không tồn tại.');
    return res.redirect('/tables');
  }
  if (!['open', 'serving'].includes(order.status)) {
    res.flash('error', `Đơn đã ở trạng thái "${order.status}", không thể hủy.`);
    return res.redirect('/tables');
  }

  const cancel = q.transaction(() => {
    q.run(
      `UPDATE order_items SET status = 'cancelled', updated_at = datetime('now','localtime')
       WHERE order_id = ? AND status != 'cancelled'`,
      orderId
    );
    q.run(
      `UPDATE orders SET status = 'cancelled', updated_at = datetime('now','localtime') WHERE id = ?`,
      orderId
    );
    // KHÔNG đụng tables.status — sentinel luôn 'available'
  });
  cancel();

  res.flash('success', `Đã hủy đơn mang về ${order.order_code}.`);
  res.redirect('/tables');
});

module.exports = router;
