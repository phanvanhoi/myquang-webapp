const express = require('express');
const router = express.Router();
const { q } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { enrichKitchenItem } = require('../lib/online-delivery');

router.use(requireAuth);

// Blacklist thay vì whitelist: cho phép cả order 'completed' lọt qua nếu vẫn
// còn items pending/preparing — đề phòng case khách thanh toán nhanh trước
// khi KDS kịp poll (mất 10s) khiến món bị bỏ sót. Vẫn loại 'cancelled' và
// 'merged' để không hiện món của order đã đóng/đã gộp.
const SQL_KITCHEN_ITEMS = `
  SELECT oi.id, oi.quantity, oi.note, oi.created_at,
         mi.name AS item_name,
         o.id AS order_id, o.order_code, o.order_type, o.guest_count,
         o.customer_name, o.customer_phone, o.customer_address, o.customer_note,
         o.created_at AS order_created_at,
         t.id AS table_id, t.name AS table_name, t.code AS table_code,
         t.is_takeaway AS is_takeaway,
         t.is_virtual AS is_virtual,
         pt.name AS parent_name, pt.code AS parent_code,
         f.name AS floor_name, r.name AS room_name
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN menu_items mi ON mi.id = oi.item_id
  LEFT JOIN tables t ON t.id = o.table_id
  LEFT JOIN tables pt ON pt.id = t.parent_table_id
  LEFT JOIN floors f ON f.id = t.floor_id
  LEFT JOIN rooms  r ON r.id = t.room_id
  WHERE oi.status IN ('pending', 'preparing')
    AND o.status NOT IN ('cancelled', 'merged')
  ORDER BY oi.created_at ASC
`;

function mapKitchenItems(rows) {
  return rows.map(enrichKitchenItem);
}

// GET /kitchen — màn hình bếp
router.get('/', (req, res) => {
  const items = mapKitchenItems(q.all(SQL_KITCHEN_ITEMS));
  res.render('kitchen/index.html', { items });
});

// GET /kitchen/data — JSON cho auto-refresh
router.get('/data', (req, res) => {
  const items = mapKitchenItems(q.all(SQL_KITCHEN_ITEMS));
  res.json({ success: true, items, ts: Date.now() });
});

// POST /kitchen/items/bulk-served — đánh dấu cả bàn "đã lên" trong 1 phát
// body: { ids: [number, ...] }
router.post('/items/bulk-served', (req, res) => {
  const ids = Array.isArray(req.body.ids)
    ? req.body.ids.map(Number).filter(Number.isInteger)
    : [];

  if (!ids.length) {
    return res.status(400).json({ success: false, error: 'Thiếu danh sách món' });
  }

  // Compare-and-swap: chỉ chuyển sang served nếu món vẫn còn pending/preparing.
  // Món nào đã bị huỷ/served bởi luồng khác sẽ bị bỏ qua an toàn.
  const placeholders = ids.map(() => '?').join(',');
  const result = q.run(
    `UPDATE order_items
       SET status = 'served', updated_at = datetime('now','localtime')
     WHERE id IN (${placeholders})
       AND status IN ('pending','preparing')`,
    ...ids
  );

  return res.json({ success: true, changed: result.changes });
});

module.exports = router;
