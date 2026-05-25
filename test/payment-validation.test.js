const { test } = require('node:test');
const assert = require('node:assert');
const {
  roundMoney,
  parsePaymentAmounts,
  validatePaymentSubmission,
} = require('../src/lib/money');

test('roundMoney rounds to 2 decimal places', () => {
  assert.equal(roundMoney(10.005), 10.01);
  assert.equal(roundMoney('50000'), 50000);
});

test('parsePaymentAmounts ignores discount from body', () => {
  const parsed = parsePaymentAmounts({
    discount_amount: 99999,
    cash_amount: 50000,
    transfer_amount: 0,
  });
  assert.equal(parsed.discountAmount, 0);
  assert.equal(parsed.cashAmount, 50000);
});

test('validatePaymentSubmission rejects underpayment', () => {
  const err = validatePaymentSubmission({
    cashAmount: 0,
    transferAmount: 0,
    finalAmount: 100000,
    isWaiter: false,
  });
  assert.equal(err, 'Chưa nhập số tiền thanh toán.');
});

test('validatePaymentSubmission rejects mismatch', () => {
  const err = validatePaymentSubmission({
    cashAmount: 30000,
    transferAmount: 30000,
    finalAmount: 100000,
    isWaiter: false,
  });
  assert.match(err, /phải bằng số tiền/);
});

test('validatePaymentSubmission accepts exact combo payment', () => {
  const err = validatePaymentSubmission({
    cashAmount: 40000,
    transferAmount: 60000,
    finalAmount: 100000,
    isWaiter: false,
  });
  assert.equal(err, null);
});

test('validatePaymentSubmission rejects waiter cash', () => {
  const err = validatePaymentSubmission({
    cashAmount: 1000,
    transferAmount: 99000,
    finalAmount: 100000,
    isWaiter: true,
  });
  assert.match(err, /Phục vụ/);
});
