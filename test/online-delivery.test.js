const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isOnlineDeliveryOrder,
  kitchenGroupKey,
  kitchenTableName,
} = require('../src/lib/online-delivery');

describe('online delivery helpers', () => {
  it('detects /order takeaway with address', () => {
    assert.equal(isOnlineDeliveryOrder({
      order_type: 'takeaway',
      customer_address: '123 ABC',
    }), true);
  });

  it('rejects staff takeaway without address', () => {
    assert.equal(isOnlineDeliveryOrder({
      order_type: 'takeaway',
      customer_address: '',
    }), false);
  });

  it('groups delivery orders by order_id not shared table', () => {
    const row = { order_id: 9, order_type: 'takeaway', customer_address: 'X', table_id: 1 };
    assert.equal(kitchenGroupKey(row), 'delivery-9');
    assert.match(kitchenTableName(row), /GIAO ONLINE/);
  });
});
