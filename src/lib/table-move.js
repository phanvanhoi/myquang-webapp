const { q } = require('../db');
const { deactivateVirtualTable } = require('./virtual-tables');

function hasActiveOrders(tableId) {
  return !!q.get(
    `SELECT 1 FROM orders WHERE table_id = ? AND status IN ('open','serving') LIMIT 1`,
    tableId
  );
}

function releasePhysicalAfterMove(physicalTableId) {
  if (!physicalTableId) return;

  const table = q.get(
    `SELECT id, is_takeaway, is_virtual FROM tables WHERE id = ?`,
    physicalTableId
  );
  if (!table || table.is_takeaway || table.is_virtual) return;
  if (hasActiveOrders(physicalTableId)) return;

  const childActive = q.get(
    `SELECT 1 FROM orders o
     JOIN tables t ON t.id = o.table_id
     WHERE t.parent_table_id = ? AND t.is_virtual = 1 AND t.is_active = 1
       AND o.status IN ('open','serving')
     LIMIT 1`,
    physicalTableId
  );
  if (childActive) return;

  q.run(
    `UPDATE tables SET status = 'cleaning', updated_at = datetime('now','localtime')
     WHERE id = ? AND is_takeaway = 0 AND is_virtual = 0`,
    physicalTableId
  );
}

function releaseSourceAfterMove(sourceTableId) {
  if (!sourceTableId) return;

  const table = q.get(`SELECT * FROM tables WHERE id = ?`, sourceTableId);
  if (!table) return;
  if (hasActiveOrders(sourceTableId)) return;

  if (table.is_virtual) {
    const parentId = deactivateVirtualTable(sourceTableId);
    releasePhysicalAfterMove(parentId);
    return;
  }

  releasePhysicalAfterMove(sourceTableId);
}

function listAvailableMoveTargets(excludeTableId) {
  let sql = `
    SELECT t.id, t.code, t.name, t.capacity, t.status,
           f.name AS floor_name, r.name AS room_name
    FROM tables t
    JOIN floors f ON f.id = t.floor_id
    LEFT JOIN rooms r ON r.id = t.room_id
    WHERE t.is_active = 1 AND t.is_takeaway = 0 AND t.is_virtual = 0
      AND t.status = 'available'
      AND NOT EXISTS (
        SELECT 1 FROM orders o
        WHERE o.table_id = t.id AND o.status IN ('open','serving')
      )`;
  const params = [];
  if (Number.isInteger(excludeTableId)) {
    sql += ` AND t.id != ?`;
    params.push(excludeTableId);
  }
  sql += ` ORDER BY f.sort_order, r.sort_order, t.id`;
  return q.all(sql, ...params);
}

function moveOrderToTable(orderId, targetTableId, userId) {
  const order = q.get(`SELECT * FROM orders WHERE id = ?`, orderId);
  if (!order) throw new Error('Không tìm thấy order.');
  if (!['open', 'serving'].includes(order.status)) {
    throw new Error(`Chỉ chuyển được order đang mở (hiện: ${order.status}).`);
  }
  if (order.order_type !== 'dine_in') {
    throw new Error('Chỉ chuyển được order tại bàn.');
  }
  if (order.table_id === targetTableId) {
    throw new Error('Order đã ở bàn này.');
  }

  const sourceTable = q.get(`SELECT * FROM tables WHERE id = ?`, order.table_id);
  const targetTable = q.get(
    `SELECT * FROM tables
     WHERE id = ? AND is_active = 1 AND is_takeaway = 0 AND is_virtual = 0`,
    targetTableId
  );
  if (!targetTable) throw new Error('Bàn đích không tồn tại hoặc không hợp lệ.');

  const sourceLabel = sourceTable?.name || sourceTable?.code || `#${order.table_id}`;
  const targetLabel = targetTable.name || targetTable.code || `#${targetTableId}`;
  const user = userId ? q.get(`SELECT full_name, username FROM users WHERE id = ?`, userId) : null;
  const userLabel = user?.full_name || user?.username || 'staff';

  q.transaction(() => {
    const ts = q.get(`SELECT datetime('now','localtime') AS ts`).ts;
    const auditNote = `[Chuyển bàn ${sourceLabel} → ${targetLabel} bởi ${userLabel} lúc ${ts}]`;

    const fresh = q.get(
      `SELECT * FROM orders
       WHERE id = ? AND order_type = 'dine_in' AND status IN ('open','serving')`,
      orderId
    );
    if (!fresh) {
      throw new Error('Order không còn ở trạng thái có thể chuyển.');
    }
    if (fresh.table_id === targetTableId) {
      throw new Error('Order đã ở bàn này.');
    }

    const claimTarget = q.run(
      `UPDATE tables
       SET status = 'occupied', updated_at = datetime('now','localtime')
       WHERE id = ?
         AND is_active = 1 AND is_takeaway = 0 AND is_virtual = 0
         AND status = 'available'
         AND NOT EXISTS (
           SELECT 1 FROM orders o
           WHERE o.table_id = tables.id AND o.status IN ('open','serving')
         )`,
      targetTableId
    );
    if (claimTarget.changes !== 1) {
      throw new Error('Bàn đích không còn trống. Vui lòng chọn bàn khác.');
    }

    const moved = q.run(
      `UPDATE orders
       SET table_id = ?,
           note = COALESCE(note || ' ', '') || ?,
           updated_at = datetime('now','localtime')
       WHERE id = ? AND table_id = ?`,
      targetTableId,
      auditNote,
      orderId,
      fresh.table_id
    );
    if (moved.changes !== 1) {
      throw new Error('Order đã thay đổi. Vui lòng thử lại.');
    }

    releaseSourceAfterMove(fresh.table_id);
  })();

  return q.get(`SELECT * FROM orders WHERE id = ?`, orderId);
}

module.exports = {
  hasActiveOrders,
  releaseSourceAfterMove,
  listAvailableMoveTargets,
  moveOrderToTable,
};
