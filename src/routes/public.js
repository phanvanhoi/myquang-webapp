const express = require('express');
const router = express.Router();
const { q } = require('../db');
const { addItemsToOrderCore, finalizeOrderAfterItems } = require('../lib/order-items');

// In-memory rate limit per phone — đủ MVP, reset khi container restart.
const RATE_LIMIT_MS = 5 * 60 * 1000;
const lastOrderByPhone = new Map();

// Endpoint public không auth: bot/scraper enumerate số điện thoại có thể
// phình Map vô hạn → OOM chậm. Sweep mỗi phút, xóa entry đã quá rate-limit
// window (không còn ý nghĩa với việc check rate-limit nữa). `.unref()` để
// interval không giữ event loop khi process muốn exit.
setInterval(() => {
  const now = Date.now();
  for (const [phone, t] of lastOrderByPhone) {
    if (now - t > RATE_LIMIT_MS) lastOrderByPhone.delete(phone);
  }
}, 60 * 1000).unref();

const PHONE_RE = /^0[1-9]\d{8,9}$/;

function getDeliverySentinels() {
  const table = q.get(`SELECT * FROM tables WHERE is_takeaway = 1 LIMIT 1`);
  const user  = q.get(`SELECT * FROM users WHERE username = 'guest_online' LIMIT 1`);
  return { table, user };
}

// GET /order — trang đặt món chính
router.get('/', (req, res) => {
  const categories = q.all(
    `SELECT * FROM menu_categories WHERE is_active = 1 ORDER BY sort_order, name`
  );
  const items = q.all(
    `SELECT mi.*, mc.name as category_name
     FROM menu_items mi
     JOIN menu_categories mc ON mc.id = mi.category_id
     WHERE mi.is_active = 1 AND mi.is_available = 1
     ORDER BY mc.sort_order, mi.sort_order, mi.name`
  );
  const settings = q.getSettings();
  res.render('public/order.html', { categories, items, settings });
});

// POST /order/submit — { customer:{name,phone,address,note}, items:[{item_id,quantity,note}] }
router.post('/submit', (req, res) => {
  const { customer = {}, items = [] } = req.body || {};
  const name = String(customer.name || '').trim();
  const phone = String(customer.phone || '').trim();
  const address = String(customer.address || '').trim();
  const note = String(customer.note || '').trim();

  if (!name) return res.status(400).json({ success: false, error: 'Vui lòng nhập tên' });
  if (!PHONE_RE.test(phone)) {
    return res.status(400).json({ success: false, error: 'Số điện thoại không hợp lệ (10-11 chữ số, bắt đầu bằng 0)' });
  }
  if (!address) return res.status(400).json({ success: false, error: 'Vui lòng nhập địa chỉ giao hàng' });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Chưa chọn món nào' });
  }

  const last = lastOrderByPhone.get(phone);
  if (last && Date.now() - last < RATE_LIMIT_MS) {
    const wait = Math.ceil((RATE_LIMIT_MS - (Date.now() - last)) / 60000);
    return res.status(429).json({
      success: false,
      error: `Bạn vừa đặt đơn. Vui lòng đợi ~${wait} phút trước khi đặt tiếp.`,
    });
  }

  const { table, user } = getDeliverySentinels();
  if (!table || !user) {
    return res.status(500).json({ success: false, error: 'Hệ thống đang bảo trì. Vui lòng thử lại sau.' });
  }

  const orderCode = q.generateOrderCode();
  let orderId;
  try {
    q.transaction(() => {
      const r = q.run(
        `INSERT INTO orders (table_id, user_id, order_code, status, order_type, guest_count,
                             customer_name, customer_phone, customer_address, customer_note,
                             created_at, updated_at)
         VALUES (?, ?, ?, 'open', 'takeaway', 0,
                 ?, ?, ?, ?,
                 datetime('now','localtime'), datetime('now','localtime'))`,
        table.id, user.id, orderCode, name, phone, address, note || null
      );
      orderId = r.lastInsertRowid;
      addItemsToOrderCore(orderId, items, user.id);
    })();
    finalizeOrderAfterItems(orderId);
    lastOrderByPhone.set(phone, Date.now());
    return res.json({ success: true, redirect: `/order/success/${orderCode}` });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// GET /order/success/:code — trang xác nhận
router.get('/success/:code', (req, res) => {
  const order = q.get(
    `SELECT o.*, COUNT(oi.id) as item_count
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.status != 'cancelled'
     WHERE o.order_code = ?
     GROUP BY o.id`,
    req.params.code
  );
  if (!order) return res.redirect('/order');
  const items = q.all(
    `SELECT oi.*, mi.name as item_name
     FROM order_items oi
     JOIN menu_items mi ON mi.id = oi.item_id
     WHERE oi.order_id = ? AND oi.status != 'cancelled'
     ORDER BY oi.created_at`,
    order.id
  );
  const settings = q.getSettings();
  res.render('public/success.html', { order, items, settings });
});

module.exports = router;
