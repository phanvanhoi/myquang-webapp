const express = require('express');
const router = express.Router();
const { q } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET / — Danh sách thực đơn
router.get('/', requireAuth, (req, res) => {
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
  res.render('menu/index.html', { categories, items });
});

// GET /categories — Quản lý danh mục
router.get('/categories', requireAdmin, (req, res) => {
  const categories = q.all(
    `SELECT mc.*,
       COUNT(CASE WHEN mi.is_active = 1 THEN 1 END) as item_count
     FROM menu_categories mc
     LEFT JOIN menu_items mi ON mi.category_id = mc.id
     WHERE mc.is_active = 1
     GROUP BY mc.id
     ORDER BY mc.sort_order, mc.name`
  );
  res.render('menu/categories.html', { categories });
});

// POST /categories — Thêm danh mục
router.post('/categories', requireAdmin, (req, res) => {
  const { name, sort_order } = req.body;
  if (!name || !name.trim()) {
    res.flash('error', 'Tên danh mục không được để trống');
    return res.redirect('/menu/categories');
  }
  q.run(
    `INSERT INTO menu_categories (name, sort_order) VALUES (?, ?)`,
    name.trim(),
    parseInt(sort_order) || 0
  );
  res.flash('success', `Đã thêm danh mục "${name.trim()}"`);
  res.redirect('/menu/categories');
});

// POST /categories/:id/edit — Sửa danh mục
router.post('/categories/:id/edit', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, sort_order } = req.body;
  if (!name || !name.trim()) {
    res.flash('error', 'Tên danh mục không được để trống');
    return res.redirect('/menu/categories');
  }
  q.run(
    `UPDATE menu_categories
     SET name = ?, sort_order = ?, updated_at = datetime('now','localtime')
     WHERE id = ?`,
    name.trim(),
    parseInt(sort_order) || 0,
    id
  );
  res.flash('success', 'Đã cập nhật danh mục');
  res.redirect('/menu/categories');
});

// POST /categories/:id/delete — Xoá danh mục (soft delete)
router.post('/categories/:id/delete', requireAdmin, (req, res) => {
  const { id } = req.params;
  const hasItems = q.get(
    `SELECT 1 FROM menu_items WHERE category_id = ? AND is_active = 1 LIMIT 1`,
    id
  );
  if (hasItems) {
    res.flash('error', 'Danh mục đang có món ăn, không thể xóa');
    return res.redirect('/menu/categories');
  }
  q.run(
    `UPDATE menu_categories SET is_active = 0, updated_at = datetime('now','localtime') WHERE id = ?`,
    id
  );
  res.flash('success', 'Đã xoá danh mục');
  res.redirect('/menu/categories');
});

// GET /items/new — Form thêm món
router.get('/items/new', requireAdmin, (req, res) => {
  const categories = q.all(
    `SELECT * FROM menu_categories WHERE is_active = 1 ORDER BY sort_order, name`
  );
  res.render('menu/form.html', { categories, item: null, action: '/menu/items' });
});

// POST /items — Tạo món mới
router.post('/items', requireAdmin, (req, res) => {
  const { category_id, name, description, base_price, sort_order, is_available } = req.body;
  if (!name || !name.trim()) {
    res.flash('error', 'Tên món không được để trống');
    return res.redirect('/menu/items/new');
  }
  q.run(
    `INSERT INTO menu_items (category_id, name, description, base_price, sort_order, is_available)
     VALUES (?, ?, ?, ?, ?, ?)`,
    parseInt(category_id),
    name.trim(),
    description || '',
    parseFloat(base_price) || 0,
    parseInt(sort_order) || 0,
    is_available ? 1 : 0
  );
  res.flash('success', `Đã thêm món "${name.trim()}"`);
  res.redirect('/menu');
});

// GET /items/:id/edit — Form sửa món
router.get('/items/:id/edit', requireAdmin, (req, res) => {
  const { id } = req.params;
  const item = q.get(`SELECT * FROM menu_items WHERE id = ? AND is_active = 1`, id);
  if (!item) {
    res.flash('error', 'Không tìm thấy món ăn');
    return res.redirect('/menu');
  }
  const categories = q.all(
    `SELECT * FROM menu_categories WHERE is_active = 1 ORDER BY sort_order, name`
  );
  res.render('menu/form.html', {
    item,
    categories,
    action: '/menu/items/' + id + '/edit',
  });
});

// POST /items/:id/edit — Cập nhật món
router.post('/items/:id/edit', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { category_id, name, description, base_price, sort_order, is_available } = req.body;
  if (!name || !name.trim()) {
    res.flash('error', 'Tên món không được để trống');
    return res.redirect('/menu/items/' + id + '/edit');
  }
  q.run(
    `UPDATE menu_items
     SET category_id = ?, name = ?, description = ?, base_price = ?,
         sort_order = ?, is_available = ?, updated_at = datetime('now','localtime')
     WHERE id = ?`,
    parseInt(category_id),
    name.trim(),
    description || '',
    parseFloat(base_price) || 0,
    parseInt(sort_order) || 0,
    is_available ? 1 : 0,
    id
  );
  res.flash('success', 'Đã cập nhật món ăn');
  res.redirect('/menu');
});

// POST /items/:id/toggle — Toggle is_available (JSON, dùng Alpine fetch)
router.post('/items/:id/toggle', requireAuth, (req, res) => {
  const { id } = req.params;
  const item = q.get(`SELECT id, is_available FROM menu_items WHERE id = ? AND is_active = 1`, id);
  if (!item) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy món' });
  }
  const newValue = item.is_available ? 0 : 1;
  q.run(
    `UPDATE menu_items SET is_available = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
    newValue,
    id
  );
  res.json({ success: true, is_available: newValue });
});

// POST /items/:id/delete — Xoá món (soft delete)
router.post('/items/:id/delete', requireAdmin, (req, res) => {
  const { id } = req.params;
  q.run(
    `UPDATE menu_items SET is_active = 0, updated_at = datetime('now','localtime') WHERE id = ?`,
    id
  );
  res.flash('success', 'Đã xoá món ăn');
  res.redirect('/menu');
});

module.exports = router;
