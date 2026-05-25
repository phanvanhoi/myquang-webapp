const { q } = require('../db');

const MAX_VIRTUAL_PER_PARENT = 2;
const DEFAULT_VIRTUAL_GUEST_COUNT = 2;

function countActiveVirtualChildren(parentId) {
  return q.get(
    `SELECT COUNT(*) AS cnt FROM tables t
     WHERE t.parent_table_id = ? AND t.is_virtual = 1 AND t.is_active = 1
       AND EXISTS (
         SELECT 1 FROM orders o
         WHERE o.table_id = t.id AND o.status IN ('open','serving')
       )`,
    parentId
  ).cnt;
}

function nextVirtualSlot(parentCode) {
  for (let i = 1; i <= MAX_VIRTUAL_PER_PARENT; i++) {
    const code = `${parentCode}-V${i}`;
    const taken = q.get(
      `SELECT id FROM tables WHERE code = ? AND is_active = 1`,
      code
    );
    if (!taken) {
      return { slot: i, code, label: `Ảo ${i}` };
    }
  }
  return null;
}

function deactivateVirtualTable(virtualTableId) {
  const vt = q.get(
    `SELECT * FROM tables WHERE id = ? AND is_virtual = 1 AND is_active = 1`,
    virtualTableId
  );
  if (!vt) return null;

  q.run(
    `UPDATE tables
     SET is_active = 0,
         status = 'available',
         code = code || '~' || id,
         updated_at = datetime('now','localtime')
     WHERE id = ?`,
    virtualTableId
  );
  return vt.parent_table_id;
}

function releasePhysicalTableIfEmpty(physicalTableId) {
  if (!physicalTableId) return;

  const table = q.get(
    `SELECT id, is_takeaway, is_virtual FROM tables WHERE id = ?`,
    physicalTableId
  );
  if (!table || table.is_takeaway || table.is_virtual) return;

  const selfActive = q.get(
    `SELECT 1 FROM orders WHERE table_id = ? AND status IN ('open','serving') LIMIT 1`,
    physicalTableId
  );
  if (selfActive) return;

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
    `UPDATE tables SET status = 'available', updated_at = datetime('now','localtime')
     WHERE id = ? AND is_takeaway = 0 AND is_virtual = 0`,
    physicalTableId
  );
}

function afterOrderClosed(order) {
  if (!order?.table_id) return;

  const table = q.get(`SELECT * FROM tables WHERE id = ?`, order.table_id);
  if (!table) return;

  if (table.is_virtual) {
    const parentId = deactivateVirtualTable(table.id);
    releasePhysicalTableIfEmpty(parentId);
    return;
  }

  releasePhysicalTableIfEmpty(table.id);
}

function kitchenTableLabel(row) {
  if (row.is_virtual) {
    return row.table_name || row.parent_name || row.table_code || '—';
  }
  return row.table_name || row.table_code || '—';
}

function createVirtualTable(parentId, userId) {
  const parent = q.get(
    `SELECT * FROM tables
     WHERE id = ? AND is_active = 1 AND is_takeaway = 0 AND is_virtual = 0`,
    parentId
  );
  if (!parent) throw new Error('Bàn không tồn tại.');
  if (parent.status !== 'occupied') {
    throw new Error('Chỉ tạo bàn ảo khi bàn đang có khách.');
  }
  if (countActiveVirtualChildren(parentId) >= MAX_VIRTUAL_PER_PARENT) {
    throw new Error('Mỗi bàn chỉ tạo tối đa 2 bàn ảo.');
  }

  const slot = nextVirtualSlot(parent.code);
  if (!slot) throw new Error('Không còn slot bàn ảo trống.');

  const orderCode = q.generateOrderCode();
  let virtualId;

  q.transaction(() => {
    const ins = q.run(
      `INSERT INTO tables
         (floor_id, room_id, code, name, capacity, status, is_active, is_virtual, parent_table_id)
       VALUES (?, ?, ?, ?, ?, 'occupied', 1, 1, ?)`,
      parent.floor_id,
      parent.room_id,
      slot.code,
      `${parent.name} · ${slot.label}`,
      parent.capacity,
      parentId
    );
    virtualId = ins.lastInsertRowid;

    q.run(
      `INSERT INTO orders (table_id, user_id, order_code, status, guest_count, created_at, updated_at)
       VALUES (?, ?, ?, 'open', ?, datetime('now','localtime'), datetime('now','localtime'))`,
      virtualId,
      userId,
      orderCode,
      DEFAULT_VIRTUAL_GUEST_COUNT
    );

    q.run(
      `UPDATE tables SET status = 'occupied', updated_at = datetime('now','localtime') WHERE id = ?`,
      parentId
    );
  })();

  return { virtualId, orderCode };
}

function sortTableEntries(entries) {
  const parents = entries.filter(e => !e.table.is_virtual);
  const virtuals = entries.filter(e => e.table.is_virtual);
  const sorted = [];

  parents.forEach(p => {
    sorted.push(p);
    virtuals
      .filter(v => v.table.parent_table_id === p.table.id)
      .sort((a, b) => a.table.code.localeCompare(b.table.code))
      .forEach(v => sorted.push(v));
  });

  virtuals
    .filter(v => !parents.some(p => p.table.id === v.table.parent_table_id))
    .forEach(v => sorted.push(v));

  return sorted;
}

module.exports = {
  MAX_VIRTUAL_PER_PARENT,
  DEFAULT_VIRTUAL_GUEST_COUNT,
  countActiveVirtualChildren,
  nextVirtualSlot,
  deactivateVirtualTable,
  releasePhysicalTableIfEmpty,
  afterOrderClosed,
  kitchenTableLabel,
  createVirtualTable,
  sortTableEntries,
};
