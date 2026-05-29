const { q } = require('../db');

/** Ba món bún đặc biệt — chặn gọi món khi thiếu Nem hoặc Chả. */
const SPECIAL_BUN_MENU_NAMES = new Set([
  'Bún Mắm Nêm Thập Cẩm Đặc Biệt',
  'Bún Mắm Thịt Luộc (Đặc Biệt)',
  'Bún Mắm Heo Quay (Đặc Biệt)',
]);

const DEFAULT_INVENTORY = [
  { code: 'coca', name: 'Coca Cola', unit: 'cái' },
  { code: 'pepsi', name: 'Pepsi', unit: 'cái' },
  { code: 'nuoc_suoi', name: 'Nước Suối', unit: 'cái' },
  { code: 'nem', name: 'Nem', unit: 'cái' },
  { code: 'cha', name: 'Chả', unit: 'cái' },
];

function isSpecialBunMenuName(name) {
  return SPECIAL_BUN_MENU_NAMES.has(name);
}

function getInventoryByCode(code) {
  return q.get(`SELECT * FROM inventory_items WHERE code = ?`, code);
}

function listInventoryItems() {
  return q.all(`SELECT * FROM inventory_items ORDER BY id`);
}

function getRecipesForMenuItem(menuItemId) {
  return q.all(
    `SELECT r.qty_per_serving, i.id AS inventory_item_id, i.code, i.name, i.unit, i.qty_on_hand
     FROM menu_item_recipes r
     JOIN inventory_items i ON i.id = r.inventory_item_id
     WHERE r.menu_item_id = ?`,
    menuItemId
  );
}

function aggregateRequirements(menuItemId, quantity) {
  const qty = parseInt(quantity, 10) || 0;
  if (qty < 1) return new Map();
  const recipes = getRecipesForMenuItem(menuItemId);
  const map = new Map();
  for (const row of recipes) {
    const need = row.qty_per_serving * qty;
    const prev = map.get(row.inventory_item_id) || {
      inventory_item_id: row.inventory_item_id,
      code: row.code,
      name: row.name,
      unit: row.unit,
      qty_on_hand: row.qty_on_hand,
      required: 0,
    };
    prev.required += need;
    map.set(row.inventory_item_id, prev);
  }
  return map;
}

function aggregateCartRequirements(items) {
  const totals = new Map();
  for (const entry of items) {
    const menuItemId = parseInt(entry.item_id, 10);
    const qty = parseInt(entry.quantity, 10) || 1;
    const perItem = aggregateRequirements(menuItemId, qty);
    for (const [invId, row] of perItem) {
      const prev = totals.get(invId) || { ...row, required: 0 };
      prev.required += row.required;
      totals.set(invId, prev);
    }
  }
  return totals;
}

function stockErrorForMenuItem(menuItem, quantity) {
  const menuItemId = menuItem.id;
  const qty = parseInt(quantity, 10) || 1;
  const perItem = aggregateRequirements(menuItemId, qty);
  if (!perItem.size) return null;

  if (isSpecialBunMenuName(menuItem.name)) {
    const nem = getInventoryByCode('nem');
    const cha = getInventoryByCode('cha');
    const needNem = (perItem.get(nem?.id)?.required) || 0;
    const needCha = (perItem.get(cha?.id)?.required) || 0;
    if (needNem && nem.qty_on_hand < needNem) {
      return `Không đủ Nem (còn ${nem.qty_on_hand} cái) để gọi "${menuItem.name}".`;
    }
    if (needCha && cha.qty_on_hand < needCha) {
      return `Không đủ Chả (còn ${cha.qty_on_hand} cái) để gọi "${menuItem.name}".`;
    }
    return null;
  }

  for (const row of perItem.values()) {
    const fresh = q.get(`SELECT qty_on_hand, name FROM inventory_items WHERE id = ?`, row.inventory_item_id);
    if (fresh.qty_on_hand < row.required) {
      return `Không đủ ${fresh.name} (còn ${fresh.qty_on_hand} ${row.unit}) để gọi "${menuItem.name}".`;
    }
  }
  return null;
}

function validateCartStock(items) {
  if (!Array.isArray(items) || !items.length) return;

  for (const entry of items) {
    const menuItem = q.get(
      `SELECT * FROM menu_items WHERE id = ? AND is_active = 1 AND is_available = 1`,
      entry.item_id
    );
    if (!menuItem) {
      throw new Error(`Món ID ${entry.item_id} không hợp lệ hoặc tạm hết`);
    }
    const qty = parseInt(entry.quantity, 10) || 1;
    if (qty < 1 || qty > 99) throw new Error('Số lượng không hợp lệ');
    const err = stockErrorForMenuItem(menuItem, qty);
    if (err) throw new Error(err);
  }

  const totals = aggregateCartRequirements(items);
  for (const row of totals.values()) {
    const fresh = q.get(`SELECT qty_on_hand, name, unit FROM inventory_items WHERE id = ?`, row.inventory_item_id);
    if (fresh.qty_on_hand < row.required) {
      throw new Error(`Không đủ ${fresh.name} (còn ${fresh.qty_on_hand} ${fresh.unit}).`);
    }
  }
}

function applyDelta(inventoryItemId, delta, reason, meta = {}) {
  const inv = q.get(`SELECT * FROM inventory_items WHERE id = ?`, inventoryItemId);
  if (!inv) throw new Error('Mặt hàng tồn kho không tồn tại');

  if (delta < 0) {
    const need = -delta;
    const result = q.run(
      `UPDATE inventory_items
       SET qty_on_hand = qty_on_hand + ?,
           updated_at = datetime('now','localtime')
       WHERE id = ? AND qty_on_hand >= ?`,
      delta,
      inventoryItemId,
      need
    );
    if (result.changes !== 1) {
      throw new Error(`Không đủ ${inv.name} (còn ${inv.qty_on_hand} ${inv.unit}).`);
    }
  } else if (delta > 0) {
    q.run(
      `UPDATE inventory_items
       SET qty_on_hand = qty_on_hand + ?,
           updated_at = datetime('now','localtime')
       WHERE id = ?`,
      delta,
      inventoryItemId
    );
  }

  const after = q.get(`SELECT qty_on_hand FROM inventory_items WHERE id = ?`, inventoryItemId);
  q.run(
    `INSERT INTO inventory_movements
       (inventory_item_id, delta, qty_after, reason, order_id, order_item_id, menu_item_id, user_id, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    inventoryItemId,
    delta,
    after.qty_on_hand,
    reason,
    meta.orderId || null,
    meta.orderItemId || null,
    meta.menuItemId || null,
    meta.userId || null,
    meta.note || null
  );
}

function deductForOrderItem(orderItemId, menuItemId, quantity, orderId, userId) {
  const recipes = getRecipesForMenuItem(menuItemId);
  if (!recipes.length) return;

  for (const row of recipes) {
    const delta = -(row.qty_per_serving * quantity);
    applyDelta(row.inventory_item_id, delta, 'sale', {
      orderId,
      orderItemId,
      menuItemId,
      userId,
    });
  }
}

function hasRestoreForOrderItem(orderItemId) {
  return !!q.get(
    `SELECT 1 FROM inventory_movements WHERE order_item_id = ? AND reason = 'cancel' LIMIT 1`,
    orderItemId
  );
}

function restoreForOrderItem(orderItemId, userId) {
  if (hasRestoreForOrderItem(orderItemId)) return;

  const sales = q.all(
    `SELECT inventory_item_id, delta, order_id, menu_item_id
     FROM inventory_movements
     WHERE order_item_id = ? AND reason = 'sale'`,
    orderItemId
  );
  if (!sales.length) return;

  for (const row of sales) {
    applyDelta(row.inventory_item_id, -row.delta, 'cancel', {
      orderId: row.order_id,
      orderItemId,
      menuItemId: row.menu_item_id,
      userId,
    });
  }
}

function adjustOrderItemQty(orderItemId, menuItemId, oldQty, newQty, orderId, userId) {
  const oldQ = parseInt(oldQty, 10) || 0;
  const newQ = parseInt(newQty, 10) || 0;
  if (oldQ === newQ) return;

  const recipes = getRecipesForMenuItem(menuItemId);
  if (!recipes.length) return;

  const diff = newQ - oldQ;
  for (const row of recipes) {
    const delta = -(row.qty_per_serving * diff);
    if (delta === 0) continue;
    applyDelta(row.inventory_item_id, delta, 'qty_change', {
      orderId,
      orderItemId,
      menuItemId,
      userId,
      note: `${oldQ}→${newQ}`,
    });
  }
}

function restoreOrderInventory(orderId, userId) {
  const lines = q.all(
    `SELECT id FROM order_items WHERE order_id = ? AND status != 'cancelled'`,
    orderId
  );
  for (const line of lines) {
    restoreForOrderItem(line.id, userId);
  }
}

function adminAdjustStock(inventoryItemId, delta, userId, note) {
  const parsed = parseInt(delta, 10);
  if (!parsed || Number.isNaN(parsed)) {
    throw new Error('Số lượng điều chỉnh không hợp lệ');
  }
  if (parsed < 0) {
    const inv = q.get(`SELECT qty_on_hand FROM inventory_items WHERE id = ?`, inventoryItemId);
    if (!inv || inv.qty_on_hand + parsed < 0) {
      throw new Error('Tồn kho không đủ để trừ');
    }
  }
  applyDelta(inventoryItemId, parsed, 'adjust', { userId, note: note || null });
}

function recentMovements(limit = 30) {
  return q.all(
    `SELECT m.*, i.name AS inventory_name, i.unit, u.full_name AS user_name
     FROM inventory_movements m
     JOIN inventory_items i ON i.id = m.inventory_item_id
     LEFT JOIN users u ON u.id = m.user_id
     ORDER BY m.id DESC
     LIMIT ?`,
    limit
  );
}

module.exports = {
  SPECIAL_BUN_MENU_NAMES,
  DEFAULT_INVENTORY,
  isSpecialBunMenuName,
  listInventoryItems,
  getInventoryByCode,
  getRecipesForMenuItem,
  validateCartStock,
  stockErrorForMenuItem,
  deductForOrderItem,
  restoreForOrderItem,
  adjustOrderItemQty,
  restoreOrderInventory,
  adminAdjustStock,
  recentMovements,
};
