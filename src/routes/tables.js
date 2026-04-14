const express = require('express');
const router = express.Router();
const { q } = require('../db');
const { requireAuth } = require('../middleware/auth');

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

  // 3. Lấy tất cả bàn đang hoạt động (kèm floor/room info)
  const tables = q.all(
    `SELECT t.*,
            f.name as floor_name,
            r.name as room_name
     FROM tables t
     JOIN floors f ON f.id = t.floor_id
     LEFT JOIN rooms r ON r.id = t.room_id
     WHERE t.is_active = 1
     ORDER BY f.sort_order, r.sort_order, t.id`
  );

  // 4. Với mỗi bàn, lấy active order (nếu có)
  // _table_card.html expects: entry = { table, active_order }
  const tableEntries = tables.map(table => {
    const active_order = q.get(
      `SELECT o.*, COUNT(oi.id) as item_count
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.status != 'cancelled'
       WHERE o.table_id = ? AND o.status IN ('open','serving')
       GROUP BY o.id
       LIMIT 1`,
      table.id
    ) || null;
    return { table, active_order };
  });

  // 5. Build floors_data structure used by index.html template
  // Template iterates: {% for entry in fd.tables_by_room[None] %} and {% for entry in fd.tables_by_room[room.id] %}
  const floors_data = floors.map(floor => {
    const floorRooms = rooms.filter(r => r.floor_id === floor.id);
    const floorEntries = tableEntries.filter(e => e.table.floor_id === floor.id);

    // tables_by_room: key = null (không phòng) hoặc room.id → array of entries
    const tables_by_room = {};

    // Bàn không thuộc phòng nào
    const noRoomEntries = floorEntries.filter(e => !e.table.room_id);
    if (noRoomEntries.length > 0) {
      tables_by_room[null] = noRoomEntries;
    }

    // Bàn theo phòng
    floorRooms.forEach(room => {
      const roomEntries = floorEntries.filter(e => e.table.room_id === room.id);
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

    const noRoomEntries = floorEntries.filter(e => !e.table.room_id);
    if (noRoomEntries.length > 0) {
      sections.push({ room: null, tables: noRoomEntries });
    }

    floorRooms.forEach(room => {
      const roomEntries = floorEntries.filter(e => e.table.room_id === room.id);
      if (roomEntries.length > 0) {
        sections.push({
          room: { id: room.id, name: room.name },
          tables: roomEntries,
        });
      }
    });

    return { floor, sections };
  });

  res.render('tables/index.html', { floors, tablesByFloor, floors_data });
});

// ─────────────────────────────────────────────
// POST /tables/:id/open — mở bàn, tạo order
// ─────────────────────────────────────────────
router.post('/:id/open', (req, res) => {
  const tableId = parseInt(req.params.id);
  const guestCount = parseInt(req.body.guest_count) || 1;

  const table = q.get(`SELECT * FROM tables WHERE id = ? AND is_active = 1`, tableId);
  if (!table) {
    res.flash('error', 'Bàn không tồn tại.');
    return res.redirect('/tables');
  }
  if (table.status !== 'available') {
    res.flash('error', `Bàn ${table.name} hiện không ở trạng thái trống.`);
    return res.redirect('/tables');
  }

  const orderCode = q.generateOrderCode();

  const openTable = q.transaction(() => {
    const result = q.run(
      `INSERT INTO orders (table_id, user_id, order_code, status, guest_count, created_at, updated_at)
       VALUES (?, ?, ?, 'open', ?, datetime('now','localtime'), datetime('now','localtime'))`,
      tableId, req.session.userId, orderCode, guestCount
    );

    q.run(
      `UPDATE tables SET status = 'occupied', updated_at = datetime('now','localtime') WHERE id = ?`,
      tableId
    );

    return result.lastInsertRowid;
  });

  openTable();
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
// GET /tables/:id/order — xem chi tiết order của bàn
// ─────────────────────────────────────────────
router.get('/:id/order', (req, res) => {
  const tableId = parseInt(req.params.id);

  // Lấy thông tin bàn (kèm tầng và phòng)
  const table = q.get(
    `SELECT t.*,
            f.name as floor_name, f.id as floor_id,
            r.name as room_name, r.id as room_id_ref
     FROM tables t
     JOIN floors f ON f.id = t.floor_id
     LEFT JOIN rooms r ON r.id = t.room_id
     WHERE t.id = ? AND t.is_active = 1`,
    tableId
  );

  if (!table) {
    res.flash('error', 'Bàn không tồn tại.');
    return res.redirect('/tables');
  }

  // Attach floor/room objects để template dùng table.floor.name, table.room.name
  table.floor = table.floor_id ? { id: table.floor_id, name: table.floor_name } : null;
  table.room  = table.room_id  ? { id: table.room_id,  name: table.room_name  } : null;

  // Lấy active order
  const order = q.get(
    `SELECT o.*,
            u.full_name as user_full_name
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     WHERE o.table_id = ? AND o.status IN ('open','serving')
     ORDER BY o.created_at DESC
     LIMIT 1`,
    tableId
  );

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

  const table = q.get(`SELECT * FROM tables WHERE id = ? AND is_active = 1`, tableId);
  if (!table) {
    res.flash('error', 'Bàn không tồn tại.');
    return res.redirect('/tables');
  }

  const closeTable = q.transaction(() => {
    // Lấy tất cả order đang mở của bàn này
    const openOrders = q.all(
      `SELECT id FROM orders WHERE table_id = ? AND status IN ('open','serving')`,
      tableId
    );

    openOrders.forEach(order => {
      // Hủy tất cả order items chưa cancel
      q.run(
        `UPDATE order_items SET status = 'cancelled', updated_at = datetime('now','localtime')
         WHERE order_id = ? AND status != 'cancelled'`,
        order.id
      );
      // Hủy order
      q.run(
        `UPDATE orders SET status = 'cancelled', updated_at = datetime('now','localtime') WHERE id = ?`,
        order.id
      );
    });

    // Đặt bàn về trạng thái trống
    q.run(
      `UPDATE tables SET status = 'available', updated_at = datetime('now','localtime') WHERE id = ?`,
      tableId
    );
  });

  closeTable();
  res.flash('success', `Đã hủy order và giải phóng bàn ${table.name}.`);
  res.redirect('/tables');
});

module.exports = router;
