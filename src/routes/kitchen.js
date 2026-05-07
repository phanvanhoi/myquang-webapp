const express = require('express');
const router = express.Router();
const { q } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

const SQL_KITCHEN_ITEMS = `
  SELECT oi.id, oi.quantity, oi.note, oi.status, oi.created_at,
         mi.name AS item_name,
         o.id AS order_id, o.order_code, o.guest_count, o.created_at AS order_created_at,
         t.id AS table_id, t.name AS table_name, t.code AS table_code,
         f.name AS floor_name, r.name AS room_name
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN menu_items mi ON mi.id = oi.item_id
  LEFT JOIN tables t ON t.id = o.table_id
  LEFT JOIN floors f ON f.id = t.floor_id
  LEFT JOIN rooms  r ON r.id = t.room_id
  WHERE oi.status IN ('pending', 'preparing')
    AND o.status IN ('open', 'serving')
  ORDER BY oi.created_at ASC
`;

// GET /kitchen — màn hình bếp
router.get('/', (req, res) => {
  const items = q.all(SQL_KITCHEN_ITEMS);
  res.render('kitchen/index.html', { items });
});

// GET /kitchen/data — JSON cho auto-refresh
router.get('/data', (req, res) => {
  const items = q.all(SQL_KITCHEN_ITEMS);
  res.json({ success: true, items, ts: Date.now() });
});

// POST /kitchen/items/:id/status — đổi trạng thái món
// body: { status: 'preparing' | 'served' }
router.post('/items/:id/status', (req, res) => {
  const itemId = parseInt(req.params.id);
  const newStatus = req.body.status;

  const allowed = ['preparing', 'served'];
  if (!allowed.includes(newStatus)) {
    return res.status(400).json({ success: false, error: 'Trạng thái không hợp lệ' });
  }

  const item = q.get(`SELECT id, status FROM order_items WHERE id = ?`, itemId);
  if (!item) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy món' });
  }

  // Validate transition: pending → preparing → served
  const validTransitions = {
    pending:   ['preparing'],
    preparing: ['served'],
  };
  const allowedNext = validTransitions[item.status] || [];
  if (!allowedNext.includes(newStatus)) {
    return res.status(400).json({
      success: false,
      error: `Không thể chuyển từ "${item.status}" sang "${newStatus}"`,
    });
  }

  q.run(
    `UPDATE order_items SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
    newStatus, itemId
  );

  return res.json({ success: true, status: newStatus });
});

module.exports = router;
