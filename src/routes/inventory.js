const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const inventory = require('../lib/inventory');

router.use(requireAuth);
router.use(requireAdmin);

router.get('/', (req, res) => {
  const items = inventory.listInventoryItems();
  const movements = inventory.recentMovements(40);
  const lowStockItems = items.filter((i) => i.qty_on_hand <= 5);
  const warningItems = items.filter((i) => i.qty_on_hand > 5 && i.qty_on_hand <= 15);
  const totalOnHand = items.reduce((sum, i) => sum + i.qty_on_hand, 0);
  res.render('inventory/index.html', {
    items,
    movements,
    lowStockItems,
    warningItems,
    totalOnHand,
  });
});

router.post('/:id/adjust', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const delta = parseInt(req.body.delta, 10);
  const note = (req.body.note || '').toString().trim().slice(0, 200) || null;

  try {
    inventory.adminAdjustStock(id, delta, req.session.userId, note);
    const { invalidateDailySummaryCache } = require('../lib/inventory-daily-cache');
    invalidateDailySummaryCache();
    res.flash('success', 'Đã cập nhật tồn kho');
  } catch (err) {
    res.flash('error', err.message || 'Không thể cập nhật tồn kho');
  }
  res.redirect('/inventory');
});

module.exports = router;
