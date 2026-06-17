const { q } = require('../db');

/**
 * Chọn active order cho 1 bàn — khớp findActiveOrderForTable (requireItems true, rồi false nếu ảo).
 * @param {object[]} ordersForTable — đã sort mới nhất trước
 */
function pickActiveOrderForTable(ordersForTable, isVirtual) {
  if (!ordersForTable?.length) return null;
  const withItems = ordersForTable.find((o) => o.item_count > 0);
  if (withItems) return withItems;
  if (isVirtual) {
    return ordersForTable.find((o) => o.item_count === 0) || null;
  }
  return null;
}

/** Gom active orders + item_count theo table_id (1 query). */
function loadActiveOrdersGrouped() {
  const rows = q.all(
    `SELECT o.*,
            COUNT(oi.id) AS item_count
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.status != 'cancelled'
     WHERE o.status IN ('open','serving')
     GROUP BY o.id
     ORDER BY o.created_at DESC, o.id DESC`
  );
  const byTable = new Map();
  for (const row of rows) {
    const tid = row.table_id;
    if (!byTable.has(tid)) byTable.set(tid, []);
    byTable.get(tid).push(row);
  }
  return byTable;
}

/** Đếm bàn ảo đang có order theo parent_table_id (1 query). */
function loadVirtualChildCounts() {
  const rows = q.all(
    `SELECT t.parent_table_id AS parent_id, COUNT(*) AS cnt
     FROM tables t
     WHERE t.parent_table_id IS NOT NULL
       AND t.is_virtual = 1
       AND t.is_active = 1
       AND EXISTS (
         SELECT 1 FROM orders o
         WHERE o.table_id = t.id AND o.status IN ('open','serving')
       )
     GROUP BY t.parent_table_id`
  );
  const map = new Map();
  for (const row of rows) {
    map.set(row.parent_id, row.cnt);
  }
  return map;
}

/** Đếm dine-in orders active theo table_id (1 query). */
function loadActiveDineInOrderCounts() {
  const rows = q.all(
    `SELECT table_id, COUNT(*) AS cnt
     FROM orders
     WHERE order_type = 'dine_in' AND status IN ('open','serving')
     GROUP BY table_id`
  );
  const map = new Map();
  for (const row of rows) {
    map.set(row.table_id, row.cnt);
  }
  return map;
}

/**
 * Build tableEntries cho sơ đồ bàn — thay vòng lặp N+1 query.
 * @param {object[]} tables — rows từ query tables chính
 */
function buildTableEntries(tables) {
  const ordersByTable = loadActiveOrdersGrouped();
  const virtualCounts = loadVirtualChildCounts();
  const dineInCounts = loadActiveDineInOrderCounts();

  return tables.map((table) => {
    const ordersForTable = ordersByTable.get(table.id) || [];
    return {
      table,
      active_order: pickActiveOrderForTable(ordersForTable, !!table.is_virtual),
      active_virtual_count: table.is_virtual
        ? 0
        : (virtualCounts.get(table.id) || 0),
      active_order_count: dineInCounts.get(table.id) || 0,
    };
  });
}

module.exports = {
  pickActiveOrderForTable,
  buildTableEntries,
  loadActiveOrdersGrouped,
  loadVirtualChildCounts,
  loadActiveDineInOrderCounts,
};
