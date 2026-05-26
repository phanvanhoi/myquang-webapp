const express = require('express');
const router = express.Router();
const { q } = require('../db');
const {
  resolveTableByToken,
  getTableGuestStatus,
  submitGuestItems,
} = require('../lib/table-guest');

function loadMenuData() {
  const categories = q.all(
    `SELECT * FROM menu_categories WHERE is_active = 1 ORDER BY sort_order, name`
  );
  const items = q.all(
    `SELECT mi.*, mc.name AS category_name
     FROM menu_items mi
     JOIN menu_categories mc ON mc.id = mi.category_id
     WHERE mi.is_active = 1 AND mi.is_available = 1
     ORDER BY mc.sort_order, mi.sort_order, mi.name`
  );
  return { categories, items };
}

// GET /t/:token — menu gọi món tại bàn
router.get('/:token', (req, res) => {
  const table = resolveTableByToken(req.params.token);
  if (!table) {
    return res.status(404).render('public/table_unavailable.html', {
      settings: q.getSettings(),
    });
  }

  const { categories, items } = loadMenuData();
  const status = getTableGuestStatus(req.params.token);

  res.render('public/table_order.html', {
    token: req.params.token,
    table,
    categories,
    items,
    initialSummary: status.order,
    canSubmit: status.can_submit,
    blockReason: status.block_reason,
    settings: q.getSettings(),
  });
});

// GET /t/:token/status — tổng tiền tạm tính + món đã gọi
router.get('/:token/status', (req, res) => {
  const status = getTableGuestStatus(req.params.token);
  if (!status) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy bàn.' });
  }
  return res.json({ success: true, ...status });
});

// POST /t/:token/submit — gửi món xuống bếp
router.post('/:token/submit', (req, res) => {
  const items = (req.body && req.body.items) || [];
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Chưa chọn món nào' });
  }

  try {
    const payload = submitGuestItems(req.params.token, items.map(entry => ({
      item_id: parseInt(entry.item_id, 10),
      quantity: parseInt(entry.quantity, 10) || 1,
      note: entry.note || '',
    })));
    return res.json({ success: true, ...payload });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: err.message });
    }
    if (err.code === 'RATE_LIMIT') {
      return res.status(429).json({ success: false, error: err.message });
    }
    if (err.code === 'MAINTENANCE') {
      return res.status(500).json({ success: false, error: err.message });
    }
    if (err.code === 'MULTI_ORDER' || err.code === 'TABLE_UNAVAILABLE') {
      return res.status(403).json({ success: false, error: err.message, code: err.code });
    }
    return res.status(400).json({ success: false, error: err.message || 'Không thể gửi món' });
  }
});

module.exports = router;
