const { q } = require('../db');

function addItemsToOrderCore(orderId, items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Không có món nào được chọn');
  }

  for (const entry of items) {
    const menuItem = q.get(
      `SELECT * FROM menu_items WHERE id = ? AND is_active = 1 AND is_available = 1`,
      entry.item_id
    );
    if (!menuItem) {
      throw new Error(`Món ID ${entry.item_id} không hợp lệ hoặc tạm hết`);
    }
    const qty = parseInt(entry.quantity, 10) || 1;
    if (qty < 1 || qty > 99) {
      throw new Error('Số lượng không hợp lệ');
    }
    const unitPrice = menuItem.base_price;
    const subtotal = qty * unitPrice;
    q.run(
      `INSERT INTO order_items (order_id, item_id, quantity, unit_price, subtotal, note, status,
                                created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending',
               datetime('now','localtime'), datetime('now','localtime'))`,
      orderId,
      menuItem.id,
      qty,
      unitPrice,
      subtotal,
      (entry.note || '').toString().slice(0, 200) || null
    );
  }
}

function finalizeOrderAfterItems(orderId) {
  q.recalcOrder(orderId);

  const order = q.get(`SELECT * FROM orders WHERE id = ?`, orderId);
  if (order && order.status === 'open') {
    q.run(
      `UPDATE orders SET status = 'serving', updated_at = datetime('now','localtime') WHERE id = ?`,
      orderId
    );
  }
  return order;
}

function addItemsToOrder(orderId, items) {
  q.transaction(() => {
    addItemsToOrderCore(orderId, items);
  })();
  return finalizeOrderAfterItems(orderId);
}

module.exports = { addItemsToOrder, addItemsToOrderCore, finalizeOrderAfterItems };
