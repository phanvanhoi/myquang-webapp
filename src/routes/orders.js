const express = require('express');
const router = express.Router();
const { q } = require('../db');
const { requireAuth, requireAdminOrCashier } = require('../middleware/auth');
const { releaseTableIfEmpty } = require('./tables');

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

// ─────────────────────────────────────────────
// POST /orders/:id/split — Tách 1 số món sang HĐ mới (cùng bàn, mã mới)
// ─────────────────────────────────────────────
router.post('/:id/split', requireAdminOrCashier, (req, res) => {
  const sourceId = parseInt(req.params.id);
  const itemIds = Array.isArray(req.body.item_ids)
    ? req.body.item_ids.map(Number).filter(Number.isInteger)
    : [];

  if (!itemIds.length) {
    return res.status(400).json({ success: false, error: 'Chưa chọn món để tách' });
  }

  const source = q.get(`SELECT * FROM orders WHERE id = ?`, sourceId);
  if (!source) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy order' });
  }
  if (!['open', 'serving'].includes(source.status)) {
    return res.status(400).json({
      success: false,
      error: `Chỉ tách được order chưa thanh toán (hiện: ${source.status})`,
    });
  }

  // Validate: items thuộc source, chưa cancelled
  const placeholders = itemIds.map(() => '?').join(',');
  const validItems = q.all(
    `SELECT id FROM order_items
     WHERE id IN (${placeholders}) AND order_id = ? AND status != 'cancelled'`,
    ...itemIds, sourceId
  );
  if (validItems.length !== itemIds.length) {
    return res.status(400).json({
      success: false,
      error: 'Một số món không thuộc order này hoặc đã bị huỷ',
    });
  }

  // Phải chừa lại ít nhất 1 món non-cancelled cho source — không được tách hết
  const totalRow = q.get(
    `SELECT COUNT(*) AS c FROM order_items WHERE order_id = ? AND status != 'cancelled'`,
    sourceId
  );
  if (totalRow.c <= itemIds.length) {
    return res.status(400).json({
      success: false,
      error: 'Phải để lại ít nhất 1 món ở hóa đơn gốc. Nếu muốn chuyển hết, đổi mã thay vì tách.',
    });
  }

  let newOrderId;
  try {
    const doSplit = q.transaction(() => {
      const newCode = q.generateOrderCode();
      const ins = q.run(
        `INSERT INTO orders (table_id, user_id, order_code, status, order_type,
                             guest_count, created_at, updated_at)
         VALUES (?, ?, ?, 'serving', ?, ?, datetime('now','localtime'), datetime('now','localtime'))`,
        source.table_id, source.user_id, newCode, source.order_type, source.guest_count
      );
      newOrderId = ins.lastInsertRowid;

      q.run(
        `UPDATE order_items SET order_id = ?, updated_at = datetime('now','localtime')
         WHERE id IN (${placeholders}) AND order_id = ?`,
        newOrderId, ...itemIds, sourceId
      );

      q.recalcOrder(sourceId);
      q.recalcOrder(newOrderId);
    });
    doSplit();
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }

  const newOrder = q.get(`SELECT id, table_id, order_type FROM orders WHERE id = ?`, newOrderId);
  return res.json({
    success: true,
    new_order_id: newOrderId,
    redirect: posUrlFor(newOrder),
  });
});

// ─────────────────────────────────────────────
// POST /orders/merge — Gộp 1+ order nguồn vào 1 order đích
// ─────────────────────────────────────────────
router.post('/merge', requireAdminOrCashier, (req, res) => {
  const targetId = parseInt(req.body.target_id);
  const sourceIds = Array.isArray(req.body.source_ids)
    ? req.body.source_ids.map(Number).filter(Number.isInteger)
    : [];

  if (!targetId || !sourceIds.length) {
    return res.status(400).json({
      success: false,
      error: 'Thiếu order đích hoặc danh sách order nguồn',
    });
  }
  if (sourceIds.includes(targetId)) {
    return res.status(400).json({
      success: false,
      error: 'Order đích không được nằm trong danh sách nguồn',
    });
  }

  const target = q.get(`SELECT * FROM orders WHERE id = ?`, targetId);
  if (!target) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy order đích' });
  }
  if (!['open', 'serving'].includes(target.status)) {
    return res.status(400).json({
      success: false,
      error: `Order đích phải đang mở (hiện: ${target.status})`,
    });
  }

  const srcPlaceholders = sourceIds.map(() => '?').join(',');
  const sources = q.all(
    `SELECT id, status, order_type, table_id, order_code FROM orders WHERE id IN (${srcPlaceholders})`,
    ...sourceIds
  );
  if (sources.length !== sourceIds.length) {
    return res.status(400).json({
      success: false,
      error: 'Một số order nguồn không tồn tại',
    });
  }
  for (const s of sources) {
    if (!['open', 'serving'].includes(s.status)) {
      return res.status(400).json({
        success: false,
        error: `Order ${s.order_code} không ở trạng thái mở (hiện: ${s.status})`,
      });
    }
    if (s.order_type !== target.order_type) {
      return res.status(400).json({
        success: false,
        error: 'Không thể gộp order khác loại (dine_in vs takeaway)',
      });
    }
  }

  const sourceTableIds = [...new Set(sources.map(s => s.table_id))];

  try {
    const doMerge = q.transaction(() => {
      // Di chuyển TẤT CẢ items (kể cả cancelled, để giữ audit trail)
      q.run(
        `UPDATE order_items SET order_id = ?, updated_at = datetime('now','localtime')
         WHERE order_id IN (${srcPlaceholders})`,
        targetId, ...sourceIds
      );

      // Đánh dấu sources merged + ghi note
      const note = `[Merged into ${target.order_code}]`;
      q.run(
        `UPDATE orders
         SET status = 'merged',
             note = COALESCE(note || ' ', '') || ?,
             updated_at = datetime('now','localtime')
         WHERE id IN (${srcPlaceholders})`,
        note, ...sourceIds
      );

      q.recalcOrder(targetId);

      // Giải phóng bàn nguồn nếu không còn order nào active
      sourceTableIds.forEach(tid => releaseTableIfEmpty(tid));
    });
    doMerge();
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }

  return res.json({
    success: true,
    merged_count: sources.length,
    redirect: posUrlFor(target),
  });
});

module.exports = router;
