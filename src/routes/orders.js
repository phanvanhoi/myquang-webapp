const express = require('express');
const router = express.Router();
const { q } = require('../db');
const { requireAuth, requireAdminOrCashier } = require('../middleware/auth');

// Trang chi tiết order tập trung ở /tables/:tableId/order (POS) cho dine-in
// và /takeaway/:id cho mang về. /orders chỉ giữ list view + redirect.
function posUrlFor(order) {
  if (!order) return '/orders';
  return order.order_type === 'takeaway'
    ? `/takeaway/${order.id}`
    : `/tables/${order.table_id}/order`;
}

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
     HAVING item_count > 0
     ORDER BY o.created_at DESC`
  );
  res.render('orders/index.html', { orders });
});

// GET /:id — Trỏ về POS hợp với loại order (giữ route cho backward compat).
router.get('/:id', requireAuth, (req, res) => {
  const order = q.get(`SELECT id, table_id, order_type FROM orders WHERE id = ?`, req.params.id);
  if (!order) {
    res.flash('error', 'Không tìm thấy order');
    return res.redirect('/orders');
  }
  res.redirect(posUrlFor(order));
});

// GET /:id/add-items — POS đã có menu inline, chỉ cần đưa user vào đó.
router.get('/:id/add-items', requireAuth, (req, res) => {
  const order = q.get(`SELECT id, table_id, order_type FROM orders WHERE id = ?`, req.params.id);
  if (!order) {
    res.flash('error', 'Không tìm thấy order');
    return res.redirect('/orders');
  }
  res.redirect(posUrlFor(order));
});

// POST /:id/add-items — Thêm món (JSON body)
router.post('/:id/add-items', requireAuth, (req, res) => {
  const { id } = req.params;
  const order = q.get(`SELECT * FROM orders WHERE id = ?`, id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy order' });
  }
  if (!['open', 'serving'].includes(order.status)) {
    return res.status(400).json({
      success: false,
      error: `Không thể thêm món: order đã ở trạng thái "${order.status}".`,
    });
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

    const redirectUrl = order.order_type === 'takeaway'
      ? '/takeaway/' + order.id
      : '/tables';
    return res.json({ success: true, redirect: redirectUrl });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// POST /:id/items/:itemId/cancel — Huỷ 1 món
router.post('/:id/items/:itemId/cancel', requireAdminOrCashier, (req, res) => {
  const { id, itemId } = req.params;

  // Chặn huỷ món trên order đã thanh toán/đã huỷ — payments giữ nguyên trong khi
  // recalcOrder giảm final_amount, gây lệch doanh thu.
  const order = q.get(
    `SELECT id, status, table_id, order_type FROM orders WHERE id = ?`,
    id
  );
  if (!order) {
    if (req.is('application/json')) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy order' });
    }
    res.flash('error', 'Không tìm thấy order');
    return res.redirect('/orders');
  }
  if (!['open', 'serving'].includes(order.status)) {
    const msg = `Không thể huỷ món: order đã ở trạng thái "${order.status}".`;
    if (req.is('application/json')) {
      return res.status(400).json({ success: false, error: msg });
    }
    res.flash('error', msg);
    return res.redirect(posUrlFor(order));
  }

  q.run(
    `UPDATE order_items
     SET status = 'cancelled', updated_at = datetime('now','localtime')
     WHERE id = ? AND order_id = ?`,
    itemId,
    id
  );
  q.recalcOrder(parseInt(id));
  if (req.is('application/json')) {
    return res.json({ success: true });
  }
  res.flash('success', 'Đã huỷ món');
  const back = req.headers.referer || posUrlFor(order);
  res.redirect(back);
});

// POST /:id/items/:itemId/qty — Sửa số lượng (chỉ status='pending')
router.post('/:id/items/:itemId/qty', requireAdminOrCashier, (req, res) => {
  const { id, itemId } = req.params;
  const quantity = parseInt(req.body.quantity);
  if (!quantity || quantity < 1) {
    return res.status(400).json({ success: false, error: 'Số lượng không hợp lệ' });
  }
  const order = q.get(`SELECT status FROM orders WHERE id = ?`, id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy order' });
  }
  if (!['open', 'serving'].includes(order.status)) {
    return res.status(400).json({
      success: false,
      error: `Không thể sửa số lượng: order đã ở trạng thái "${order.status}".`,
    });
  }
  const item = q.get(
    `SELECT * FROM order_items WHERE id = ? AND order_id = ?`,
    itemId, id
  );
  if (!item) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy món' });
  }
  if (item.status !== 'pending') {
    return res.status(400).json({ success: false, error: 'Chỉ sửa được món chưa gửi bếp' });
  }
  const subtotal = quantity * item.unit_price;
  q.run(
    `UPDATE order_items
     SET quantity = ?, subtotal = ?, updated_at = datetime('now','localtime')
     WHERE id = ? AND order_id = ?`,
    quantity, subtotal, itemId, id
  );
  q.recalcOrder(parseInt(id));
  return res.json({ success: true, quantity, subtotal });
});

// POST /:id/send-to-kitchen — Gửi bếp (pending → preparing)
router.post('/:id/send-to-kitchen', requireAuth, (req, res) => {
  const { id } = req.params;
  const order = q.get(
    `SELECT id, table_id, order_type FROM orders WHERE id = ?`,
    id
  );
  if (!order) {
    res.flash('error', 'Không tìm thấy order');
    return res.redirect('/orders');
  }
  q.run(
    `UPDATE order_items
     SET status = 'preparing', updated_at = datetime('now','localtime')
     WHERE order_id = ? AND status = 'pending'`,
    id
  );
  res.flash('success', 'Đã gửi món lên bếp');
  res.redirect(posUrlFor(order));
});

// POST /:id/cancel — Huỷ toàn bộ order
router.post('/:id/cancel', requireAdminOrCashier, (req, res) => {
  const { id } = req.params;
  const order = q.get(`SELECT * FROM orders WHERE id = ?`, id);
  if (!order) {
    res.flash('error', 'Không tìm thấy order');
    return res.redirect('/orders');
  }
  // Không cho huỷ order đã thanh toán — payments + transactions income sẽ
  // mồ côi và làm sai doanh thu. Nếu cần hoàn tiền phải xử lý nghiệp vụ riêng.
  if (order.status === 'completed') {
    res.flash('error', 'Không thể huỷ hóa đơn đã thanh toán.');
    return res.redirect(posUrlFor(order));
  }
  if (order.status === 'cancelled') {
    res.flash('error', 'Hóa đơn đã ở trạng thái huỷ.');
    return res.redirect(posUrlFor(order));
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
