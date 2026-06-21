function kitchenTableLabel(row) {
  if (row.is_virtual) {
    return row.table_name || row.parent_name || row.table_code || '—';
  }
  return row.table_name || row.table_code || '—';
}

/** Đơn đặt qua /order (giao tận nơi) — có địa chỉ khách. */
function isOnlineDeliveryOrder(row) {
  if (!row) return false;
  const addr = String(row.customer_address || '').trim();
  return row.order_type === 'takeaway' && addr.length > 0;
}

function kitchenGroupKey(row) {
  if (isOnlineDeliveryOrder(row)) return `delivery-${row.order_id}`;
  return String(row.table_id || `order-${row.order_id}`);
}

function kitchenTableName(row) {
  if (isOnlineDeliveryOrder(row)) {
    const name = String(row.customer_name || '').trim() || 'Khách';
    return `🛵 GIAO ONLINE · ${name}`;
  }
  return kitchenTableLabel(row);
}

function enrichKitchenItem(row) {
  const online = isOnlineDeliveryOrder(row);
  return {
    ...row,
    is_online_delivery: online,
    kitchen_group_key: kitchenGroupKey(row),
    kitchen_table_name: kitchenTableName(row),
  };
}

module.exports = {
  isOnlineDeliveryOrder,
  kitchenGroupKey,
  kitchenTableName,
  enrichKitchenItem,
};
