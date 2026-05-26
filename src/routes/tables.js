const express = require('express');
const router = express.Router();
const { q } = require('../db');
const { requireAuth } = require('../middleware/auth');
const {
  countActiveVirtualChildren,
  createVirtualTable,
  afterOrderClosed,
  deactivateVirtualTable,
  releasePhysicalTableIfEmpty,
  sortTableEntries,
  MAX_VIRTUAL_PER_PARENT,
} = require('../lib/virtual-tables');
const { ensurePublicToken, guestOrderUrl } = require('../lib/table-guest');

router.use(requireAuth);

// ─────────────────────────────────────────────
// GET /tables — sơ đồ bàn
// ─────────────────────────────────────────────
router.get('/', (req, res) => {
  // 1. Lấy tất cả tầng đang hoạt động
  const floors = q.all(
    `SELECT * FROM floors WHERE is_active = 1 ORDER BY sort_order, id`
  );

  // 2. Lấy tất cả phòng đang hoạt động
  const rooms = q.all(
    `SELECT * FROM rooms WHERE is_active = 1 ORDER BY floor_id, sort_order, id`
  );

  // 3. Bàn thật + bàn ảo đang có order mở (ẩn MV takeaway)
  const tables = q.all(
    `SELECT t.*,
            f.name as floor_name,
            r.name as room_name,
            pt.name as parent_name,
            pt.code as parent_code
     FROM tables t
     JOIN floors f ON f.id = t.floor_id
     LEFT JOIN rooms r ON r.id = t.room_id
     LEFT JOIN tables pt ON pt.id = t.parent_table_id
     WHERE t.is_active = 1 AND t.is_takeaway = 0
       AND (t.is_virtual = 0 OR (t.is_virtual = 1 AND EXISTS (
         SELECT 1 FROM orders o
         WHERE o.table_id = t.id AND o.status IN ('open','serving')
       )))
     ORDER BY f.sort_order, r.sort_order, t.parent_table_id, t.is_virtual, t.id`
  );

  // 3b. Đơn mang về đang xử lý
  // Lọc ra delivery orders (đặt online) — chúng hiển thị riêng ở /orders, không trộn vào takeaway tại quán.
  const takeawayOrders = q.all(
    `SELECT o.*,
            u.full_name as user_full_name,
            (SELECT COUNT(*) FROM order_items oi
              WHERE oi.order_id = o.id AND oi.status != 'cancelled') as item_count
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     WHERE o.order_type = 'takeaway' AND o.status IN ('open','serving')
       AND (o.customer_address IS NULL OR o.customer_address = '')
     ORDER BY o.created_at DESC`
  );

  const tableEntries = tables.map(table => ({
    table,
    active_order: q.findActiveOrderForTable(table.id, { requireItems: true })
      || (table.is_virtual
        ? q.findActiveOrderForTable(table.id, { requireItems: false })
        : null),
    active_virtual_count: table.is_virtual
      ? 0
      : countActiveVirtualChildren(table.id),
  }));

  // 5. Build floors_data structure used by index.html template
  // Template iterates: {% for entry in fd.tables_by_room[None] %} and {% for entry in fd.tables_by_room[room.id] %}
  const floors_data = floors.map(floor => {
    const floorRooms = rooms.filter(r => r.floor_id === floor.id);
    const floorEntries = tableEntries.filter(e => e.table.floor_id === floor.id);

    // tables_by_room: key = null (không phòng) hoặc room.id → array of entries
    const tables_by_room = {};

    // Bàn không thuộc phòng nào
    const noRoomEntries = sortTableEntries(floorEntries.filter(e => !e.table.room_id));
    if (noRoomEntries.length > 0) {
      tables_by_room[null] = noRoomEntries;
    }

    // Bàn theo phòng
    floorRooms.forEach(room => {
      const roomEntries = sortTableEntries(floorEntries.filter(e => e.table.room_id === room.id));
      if (roomEntries.length > 0) {
        tables_by_room[room.id] = roomEntries;
      }
    });

    return {
      floor,
      rooms: floorRooms,
      tables_by_room,
    };
  });

  // 6. Also build tablesByFloor (sections-based, per spec)
  const tablesByFloor = floors.map(floor => {
    const floorRooms = rooms.filter(r => r.floor_id === floor.id);
    const floorEntries = tableEntries.filter(e => e.table.floor_id === floor.id);

    const sections = [];

    const noRoomEntries = sortTableEntries(floorEntries.filter(e => !e.table.room_id));
    if (noRoomEntries.length > 0) {
      sections.push({ room: null, tables: noRoomEntries });
    }

    floorRooms.forEach(room => {
      const roomEntries = sortTableEntries(floorEntries.filter(e => e.table.room_id === room.id));
      if (roomEntries.length > 0) {
        sections.push({
          room: { id: room.id, name: room.name },
          tables: roomEntries,
        });
      }
    });

    return { floor, sections };
  });

  res.render('tables/index.html', {
    floors,
    tablesByFloor,
    floors_data,
    takeawayOrders,
    maxVirtualPerParent: MAX_VIRTUAL_PER_PARENT,
    showTableQr: false, // tạm ẩn nút QR gọi món trên sơ đồ bàn
  });
});

// ─────────────────────────────────────────────
// POST /tables/:id/virtual — tạo bàn ảo (tối đa 2 / bàn thật)
// ─────────────────────────────────────────────
router.post('/:id/virtual', requireAuth, (req, res) => {
  const parentId = parseInt(req.params.id);
  try {
    const { virtualId } = createVirtualTable(parentId, req.session.userId);
    res.flash('success', 'Đã tạo bàn ảo.');
    return res.redirect(`/tables/${virtualId}/order`);
  } catch (err) {
    res.flash('error', err.message || 'Không thể tạo bàn ảo.');
    return res.redirect('/tables');
  }
});

// ─────────────────────────────────────────────
// POST /tables/:id/open — mở bàn, tạo order
// ─────────────────────────────────────────────
router.post('/:id/open', (req, res) => {
  const tableId = parseInt(req.params.id);
  const guestCount = parseInt(req.body.guest_count) || 1;

  const table = q.get(`SELECT * FROM tables WHERE id = ? AND is_active = 1 AND is_takeaway = 0`, tableId);
  if (!table) {
    res.flash('error', 'Bàn không tồn tại.');
    return res.redirect('/tables');
  }
  if (table.is_virtual) {
    res.flash('error', 'Bàn ảo không dùng Mở bàn — vào Xem order.');
    return res.redirect(`/tables/${tableId}/order`);
  }

  // Reuse trước khi tạo mới: tránh ngốn order_code và để staff "mở lại" cùng order rỗng.
  const existingEmpty = q.findActiveOrderForTable(tableId, { requireItems: false });

  if (existingEmpty) {
    q.transaction(() => {
      q.run(
        `UPDATE orders SET guest_count = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
        guestCount, existingEmpty.id
      );
      q.run(
        `UPDATE tables SET status = 'occupied', updated_at = datetime('now','localtime') WHERE id = ?`,
        tableId
      );
    })();
    return res.redirect(`/tables/${tableId}/order`);
  }

  // Chặn tạo order song song khi bàn đang phục vụ
  if (table.status !== 'available') {
    res.flash('error', `Bàn ${table.name} đang phục vụ, không thể mở mới.`);
    return res.redirect('/tables');
  }

  const orderCode = q.generateOrderCode();
  q.transaction(() => {
    q.run(
      `INSERT INTO orders (table_id, user_id, order_code, status, guest_count, created_at, updated_at)
       VALUES (?, ?, ?, 'open', ?, datetime('now','localtime'), datetime('now','localtime'))`,
      tableId, req.session.userId, orderCode, guestCount
    );
    q.run(
      `UPDATE tables SET status = 'occupied', updated_at = datetime('now','localtime') WHERE id = ?`,
      tableId
    );
  })();

  res.redirect(`/tables/${tableId}/order`);
});

// ─────────────────────────────────────────────
// POST /tables/:id/status — đổi trạng thái bàn
// ─────────────────────────────────────────────
router.post('/:id/status', (req, res) => {
  const tableId = parseInt(req.params.id);
  const { status } = req.body;

  const validStatuses = ['available', 'occupied', 'reserved', 'cleaning'];
  if (!validStatuses.includes(status)) {
    res.flash('error', 'Trạng thái không hợp lệ.');
    return res.redirect('/tables');
  }

  const table = q.get(`SELECT * FROM tables WHERE id = ? AND is_active = 1`, tableId);
  if (!table) {
    res.flash('error', 'Bàn không tồn tại.');
    return res.redirect('/tables');
  }

  q.run(
    `UPDATE tables SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
    status, tableId
  );

  const statusLabels = {
    available: 'Trống',
    occupied:  'Có khách',
    reserved:  'Đặt trước',
    cleaning:  'Đang dọn',
  };
  res.flash('success', `Bàn ${table.name} đã chuyển sang trạng thái: ${statusLabels[status]}.`);
  res.redirect('/tables');
});

// ─────────────────────────────────────────────
// GET /tables/:id/qr — QR gọi món (chỉ bàn thật)
// ─────────────────────────────────────────────
router.get('/:id/qr', (req, res) => {
  const tableId = parseInt(req.params.id, 10);
  const table = q.get(
    `SELECT t.*, f.name AS floor_name
     FROM tables t
     JOIN floors f ON f.id = t.floor_id
     WHERE t.id = ? AND t.is_active = 1 AND t.is_takeaway = 0
       AND (t.is_virtual = 0 OR t.is_virtual IS NULL)`,
    tableId
  );

  if (!table) {
    res.flash('error', 'Bàn không tồn tại hoặc không hỗ trợ QR gọi món.');
    return res.redirect('/tables');
  }

  const token = ensurePublicToken(tableId);
  const url = guestOrderUrl(req, token);

  res.render('tables/qr.html', {
    table,
    url,
    token,
    settings: q.getSettings(),
  });
});

// ─────────────────────────────────────────────
// GET /tables/:id/order — xem chi tiết order của bàn
// ─────────────────────────────────────────────
router.get('/:id/order', (req, res) => {
  const tableId = parseInt(req.params.id);

  // Lấy thông tin bàn (kèm tầng và phòng)
  const table = q.get(
    `SELECT t.*,
            f.name as floor_name, f.id as floor_id,
            r.name as room_name, r.id as room_id_ref,
            pt.name as parent_name, pt.code as parent_code
     FROM tables t
     JOIN floors f ON f.id = t.floor_id
     LEFT JOIN rooms r ON r.id = t.room_id
     LEFT JOIN tables pt ON pt.id = t.parent_table_id
     WHERE t.id = ? AND t.is_active = 1 AND t.is_takeaway = 0`,
    tableId
  );

  if (!table) {
    res.flash('error', 'Bàn không tồn tại.');
    return res.redirect('/tables');
  }

  // Attach floor/room objects để template dùng table.floor.name, table.room.name
  table.floor = table.floor_id ? { id: table.floor_id, name: table.floor_name } : null;
  table.room  = table.room_id  ? { id: table.room_id,  name: table.room_name  } : null;

  // Lấy active order. Nếu có ?order_id=X, ưu tiên order đó (sau split 1 bàn
  // có thể có >1 order active). Nếu id không khớp bàn/status, fallback sang
  // order mới nhất để URL cũ vẫn dùng được.
  const requestedId = parseInt(req.query.order_id);
  let order = null;
  if (Number.isInteger(requestedId)) {
    order = q.get(
      `SELECT o.*, u.full_name as user_full_name
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.id = ? AND o.table_id = ? AND o.status IN ('open','serving')`,
      requestedId, tableId
    );
  }
  if (!order) {
    order = q.get(
      `SELECT o.*, u.full_name as user_full_name
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.table_id = ? AND o.status IN ('open','serving')
       ORDER BY o.created_at DESC
       LIMIT 1`,
      tableId
    );
  }

  let items = [];
  if (order) {
    order.user = order.user_full_name ? { full_name: order.user_full_name } : null;
    const rawItems = q.all(
      `SELECT oi.*, mi.name as item_name, mi.base_price
       FROM order_items oi
       JOIN menu_items mi ON mi.id = oi.item_id
       WHERE oi.order_id = ?
       ORDER BY oi.created_at`,
      order.id
    );
    items = rawItems.map(item => ({
      ...item,
      menu_item: { name: item.item_name, base_price: item.base_price },
    }));
    order.items = items;
  }

  // Menu data cho POS inline browser
  const menuCategories = q.all(
    `SELECT * FROM menu_categories WHERE is_active = 1 ORDER BY sort_order, name`
  );
  const menuItems = q.all(
    `SELECT mi.*, mc.name as category_name
     FROM menu_items mi
     JOIN menu_categories mc ON mc.id = mi.category_id
     WHERE mi.is_active = 1
     ORDER BY mc.sort_order, mi.sort_order, mi.name`
  );

  res.render('tables/order_detail.html', {
    table, order, items,
    menuCategories, menuItems,
  });
});

// ─────────────────────────────────────────────
// POST /tables/:id/close — hủy order, giải phóng bàn
// ─────────────────────────────────────────────
router.post('/:id/close', (req, res) => {
  const tableId = parseInt(req.params.id);

  const table = q.get(`SELECT * FROM tables WHERE id = ? AND is_active = 1 AND is_takeaway = 0`, tableId);
  if (!table) {
    res.flash('error', 'Bàn không tồn tại.');
    return res.redirect('/tables');
  }

  const openOrders = q.all(
    `SELECT id, table_id FROM orders WHERE table_id = ? AND status IN ('open','serving') AND order_type = 'dine_in'`,
    tableId
  );

  q.transaction(() => {
    openOrders.forEach(order => {
      q.run(
        `UPDATE order_items SET status = 'cancelled', updated_at = datetime('now','localtime')
         WHERE order_id = ? AND status != 'cancelled'`,
        order.id
      );
      q.run(
        `UPDATE orders SET status = 'cancelled', updated_at = datetime('now','localtime') WHERE id = ?`,
        order.id
      );
    });
  })();

  openOrders.forEach(order => afterOrderClosed(order));

  res.flash('success', `Đã hủy order và giải phóng bàn ${table.name}.`);
  res.redirect('/tables');
});

function releaseTableIfEmpty(tableId) {
  if (!tableId) return;
  const table = q.get(`SELECT is_virtual, parent_table_id FROM tables WHERE id = ?`, tableId);
  if (!table) return;

  const stillActive = q.get(
    `SELECT 1 FROM orders WHERE table_id = ? AND status IN ('open','serving') LIMIT 1`,
    tableId
  );
  if (stillActive) return;

  if (table.is_virtual) {
    const parentId = deactivateVirtualTable(tableId);
    releasePhysicalTableIfEmpty(parentId);
    return;
  }

  releasePhysicalTableIfEmpty(tableId);
}

module.exports = router;
module.exports.releaseTableIfEmpty = releaseTableIfEmpty;
