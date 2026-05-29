const crypto = require('crypto');
const { q } = require('../db');
const { addItemsToOrderCore, finalizeOrderAfterItems } = require('./order-items');

const SUBMIT_RATE_MS = 30 * 1000;
const TOKEN_RE = /^[a-f0-9]{32}$/;
const lastSubmitByToken = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [token, t] of lastSubmitByToken) {
    if (now - t > SUBMIT_RATE_MS) lastSubmitByToken.delete(token);
  }
}, 60 * 1000).unref();

function generatePublicToken() {
  return crypto.randomBytes(16).toString('hex');
}

function getGuestUser() {
  return q.get(`SELECT * FROM users WHERE username = 'guest_online' LIMIT 1`);
}

function resolveTableByToken(token) {
  if (!token || !TOKEN_RE.test(token)) return null;
  return q.get(
    `SELECT t.*, f.name AS floor_name
     FROM tables t
     JOIN floors f ON f.id = t.floor_id
     WHERE t.public_token = ?
       AND t.is_active = 1
       AND t.is_takeaway = 0
       AND (t.is_virtual = 0 OR t.is_virtual IS NULL)`,
    token
  );
}

function ensurePublicToken(tableId) {
  const table = q.get(
    `SELECT id, public_token FROM tables
     WHERE id = ? AND is_active = 1 AND is_takeaway = 0 AND is_virtual = 0`,
    tableId
  );
  if (!table) return null;
  if (table.public_token) return table.public_token;

  const token = generatePublicToken();
  q.run(
    `UPDATE tables SET public_token = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
    token,
    tableId
  );
  return token;
}

function countActiveDineInOrders(tableId) {
  return q.get(
    `SELECT COUNT(*) AS cnt FROM orders
     WHERE table_id = ? AND order_type = 'dine_in' AND status IN ('open','serving')`,
    tableId
  ).cnt;
}

function getActiveDineInOrders(tableId) {
  return q.all(
    `SELECT * FROM orders
     WHERE table_id = ? AND order_type = 'dine_in' AND status IN ('open','serving')
     ORDER BY created_at ASC, id ASC`,
    tableId
  );
}

function getActiveDineInOrder(tableId) {
  const orders = getActiveDineInOrders(tableId);
  return orders.length ? orders[orders.length - 1] : null;
}

function canGuestSubmit(table) {
  if (['cleaning', 'reserved'].includes(table.status)) {
    return {
      allowed: false,
      code: 'TABLE_UNAVAILABLE',
      message: 'Bàn đang dọn hoặc đặt trước. Vui lòng gọi nhân viên.',
    };
  }
  if (countActiveDineInOrders(table.id) > 1) {
    return {
      allowed: false,
      code: 'MULTI_ORDER',
      message: 'Bàn đang có nhiều hóa đơn. Vui lòng gọi nhân viên.',
    };
  }
  return { allowed: true, code: null, message: null };
}

function getTableGuestSummary(tableId) {
  const orders = getActiveDineInOrders(tableId);
  if (!orders.length) return null;

  const orderIds = orders.map(o => o.id);
  const placeholders = orderIds.map(() => '?').join(',');
  const items = q.all(
    `SELECT oi.quantity, oi.unit_price, oi.subtotal, oi.note, oi.status, mi.name AS item_name,
            oi.created_at, oi.id
     FROM order_items oi
     JOIN menu_items mi ON mi.id = oi.item_id
     WHERE oi.order_id IN (${placeholders}) AND oi.status != 'cancelled'
     ORDER BY oi.created_at, oi.id`,
    ...orderIds
  );

  const totalAmount = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const discountAmount = orders.reduce((sum, o) => sum + (o.discount_amount || 0), 0);
  const finalAmount = orders.reduce((sum, o) => sum + (o.final_amount || 0), 0);

  return {
    order_code: orders.map(o => o.order_code).join(', '),
    total_amount: totalAmount,
    discount_amount: discountAmount,
    final_amount: finalAmount,
    item_count: items.reduce((sum, row) => sum + row.quantity, 0),
    items: items.map(row => ({
      item_name: row.item_name,
      quantity: row.quantity,
      unit_price: row.unit_price,
      subtotal: row.subtotal,
      note: row.note,
      status: row.status,
    })),
  };
}

function getOrderSummary(orderId) {
  const order = q.get(`SELECT table_id FROM orders WHERE id = ?`, orderId);
  if (!order) return null;
  return getTableGuestSummary(order.table_id);
}

function getTableGuestStatus(token) {
  const table = resolveTableByToken(token);
  if (!table) return null;

  const gate = canGuestSubmit(table);
  return {
    table: {
      id: table.id,
      name: table.name,
      code: table.code,
      floor_name: table.floor_name,
    },
    order: getTableGuestSummary(table.id),
    can_submit: gate.allowed,
    block_reason: gate.allowed ? null : gate.message,
  };
}

function checkSubmitRateLimit(token) {
  const last = lastSubmitByToken.get(token);
  if (last && Date.now() - last < SUBMIT_RATE_MS) {
    const wait = Math.ceil((SUBMIT_RATE_MS - (Date.now() - last)) / 1000);
    const err = new Error(`Vui lòng đợi ${wait} giây trước khi gửi tiếp.`);
    err.code = 'RATE_LIMIT';
    throw err;
  }
}

function submitGuestItems(token, items) {
  const table = resolveTableByToken(token);
  if (!table) {
    const err = new Error('Không tìm thấy bàn.');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const user = getGuestUser();
  if (!user) {
    const err = new Error('Hệ thống đang bảo trì. Vui lòng gọi nhân viên.');
    err.code = 'MAINTENANCE';
    throw err;
  }

  const gate = canGuestSubmit(table);
  if (!gate.allowed) {
    const err = new Error(gate.message);
    err.code = gate.code;
    throw err;
  }

  checkSubmitRateLimit(token);

  let orderId;
  q.transaction(() => {
    let order = getActiveDineInOrder(table.id);
    if (!order) {
      const orderCode = q.generateOrderCode();
      const ins = q.run(
        `INSERT INTO orders (table_id, user_id, order_code, status, order_type, guest_count,
                             created_at, updated_at)
         VALUES (?, ?, ?, 'open', 'dine_in', 1,
                 datetime('now','localtime'), datetime('now','localtime'))`,
        table.id,
        user.id,
        orderCode
      );
      orderId = ins.lastInsertRowid;
      q.run(
        `UPDATE tables SET status = 'occupied', updated_at = datetime('now','localtime') WHERE id = ?`,
        table.id
      );
    } else {
      orderId = order.id;
    }

    addItemsToOrderCore(orderId, items, user.id);
    finalizeOrderAfterItems(orderId);
  })();

  lastSubmitByToken.set(token, Date.now());

  return {
    table: {
      name: table.name,
      code: table.code,
      floor_name: table.floor_name,
    },
    summary: getTableGuestSummary(table.id),
    can_submit: true,
    block_reason: null,
  };
}

function guestOrderUrl(req, token) {
  const proto = req.get('X-Forwarded-Proto') || req.protocol || 'http';
  const host = req.get('X-Forwarded-Host') || req.get('host');
  return `${proto}://${host}/t/${token}`;
}

module.exports = {
  TOKEN_RE,
  generatePublicToken,
  ensurePublicToken,
  resolveTableByToken,
  canGuestSubmit,
  countActiveDineInOrders,
  getTableGuestSummary,
  getTableGuestStatus,
  submitGuestItems,
  guestOrderUrl,
  getOrderSummary,
};
