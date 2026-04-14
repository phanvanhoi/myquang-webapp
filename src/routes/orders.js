const express = require('express');
const router = express.Router();
const { q } = require('../db');
const { requireAuth, requireAdminOrCashier } = require('../middleware/auth');

// GET / — Danh sách orders đang mở
router.get('/', requireAuth, (req, res) => {
  const orders = q.all(
    `SELECT o.*, t.name as table_name, t.code as table_code,
       COUNT(CASE WHEN oi.status != 'cancelled' THEN 1 END) as item_count
     FROM orders o
     JOIN tables t ON t.id = o.table_id
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.status IN ('open','serving')
     GROUP BY o.id
     ORDER BY o.created_at DESC`
  );
  res.render('orders/index.html', { orders });
});

// GET /:id — Chi tiết order
router.get('/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const order = q.get(
    `SELECT o.*, t.name as table_name, t.code as table_code
     FROM orders o
     JOIN tables t ON t.id = o.table_id
     WHERE o.id = ?`,
    id
  );
  if (!order) {
    res.flash('error', 'Không tìm thấy order');
    return res.redirect('/orders');
  }
  const table = q.get(`SELECT * FROM tables WHERE id = ?`, order.table_id);
  const items = q.all(
    `SELECT oi.*, mi.name as item_name
     FROM order_items oi
     JOIN menu_items mi ON mi.id = oi.item_id
     WHERE oi.order_id = ?
     ORDER BY oi.created_at`,
    id
  );
  const pending_count = items.filter(i => i.status === 'pending').length;
  res.render('orders/detail.html', { order, table, items, pending_count });
});

// GET /:id/add-items — Màn hình gọi món
router.get('/:id/add-items', requireAuth, (req, res) => {
  const { id } = req.params;
  const order = q.get(
    `SELECT o.*, t.name as table_name, t.code as table_code
     FROM orders o
     JOIN tables t ON t.id = o.table_id
     WHERE o.id = ?`,
    id
  );
  if (!order) {
    res.flash('error', 'Không tìm thấy order');
    return res.redirect('/orders');
  }
  const categories = q.all(
    `SELECT * FROM menu_categories WHERE is_active = 1 ORDER BY sort_order, name`
  );
  const items = q.all(
    `SELECT mi.*, mc.name as category_name
     FROM menu_items mi
     JOIN menu_categories mc ON mc.id = mi.category_id
     WHERE mi.is_active = 1
     ORDER BY mc.sort_order, mi.sort_order, mi.name`
  );
  const currentItems = q.all(
    `SELECT oi.*, mi.name as item_name
     FROM order_items oi
     JOIN menu_items mi ON mi.id = oi.item_id
     WHERE oi.order_id = ? AND oi.status != 'cancelled'
     ORDER BY oi.created_at`,
    id
  );
  res.render('orders/add_items.html', { order, categories, items, currentItems });
});

// POST /:id/add-items — Thêm món (JSON body)
router.post('/:id/add-items', requireAuth, (req, res) => {
  const { id } = req.params;
  const order = q.get(`SELECT * FROM orders WHERE id = ?`, id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy order' });
  }

  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Không có món nào được chọn' });
  }

  try {
    const addItems = q.transaction(() => {
      for (const entry of items) {
        const menuItem = q.get(
          `SELECT * FROM menu_items WHERE id = ? AND is_active = 1 AND is_available = 1`,
          entry.item_id
        );
        if (!menuItem) {
          throw new Error(`Món ID ${entry.item_id} không hợp lệ hoặc tạm hết`);
        }
        const qty = parseInt(entry.quantity) || 1;
        const unit_price = menuItem.base_price;
        const subtotal = qty * unit_price;
        q.run(
          `INSERT INTO order_items (order_id, item_id, quantity, unit_price, subtotal, note, status)
           VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
          parseInt(id),
          menuItem.id,
          qty,
          unit_price,
          subtotal,
          entry.note || ''
        );
      }
    });
    addItems();

    q.recalcOrder(parseInt(id));

    if (order.status === 'open') {
      q.run(
        `UPDATE orders SET status = 'serving', updated_at = datetime('now','localtime') WHERE id = ?`,
        id
      );
    }

    return res.json({ success: true, redirect: '/tables/' + order.table_id + '/order' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// POST /:id/items/:itemId/cancel — Huỷ 1 món
router.post('/:id/items/:itemId/cancel', requireAdminOrCashier, (req, res) => {
  const { id, itemId } = req.params;
  q.run(
    `UPDATE order_items
     SET status = 'cancelled', updated_at = datetime('now','localtime')
     WHERE id = ? AND order_id = ?`,
    itemId,
    id
  );
  q.recalcOrder(parseInt(id));
  res.flash('success', 'Đã huỷ món');
  const back = req.headers.referer || '/orders/' + id;
  res.redirect(back);
});

// POST /:id/send-to-kitchen — Gửi bếp (pending → preparing)
router.post('/:id/send-to-kitchen', requireAuth, (req, res) => {
  const { id } = req.params;
  q.run(
    `UPDATE order_items
     SET status = 'preparing', updated_at = datetime('now','localtime')
     WHERE order_id = ? AND status = 'pending'`,
    id
  );
  res.flash('success', 'Đã gửi món lên bếp');
  res.redirect('/orders/' + id);
});

// POST /:id/cancel — Huỷ toàn bộ order
router.post('/:id/cancel', requireAdminOrCashier, (req, res) => {
  const { id } = req.params;
  const order = q.get(`SELECT * FROM orders WHERE id = ?`, id);
  if (!order) {
    res.flash('error', 'Không tìm thấy order');
    return res.redirect('/orders');
  }
  q.run(
    `UPDATE orders SET status = 'cancelled', updated_at = datetime('now','localtime') WHERE id = ?`,
    id
  );
  q.run(
    `UPDATE tables SET status = 'available', updated_at = datetime('now','localtime') WHERE id = ?`,
    order.table_id
  );
  res.flash('success', 'Đã huỷ order');
  res.redirect('/tables');
});

module.exports = router;
