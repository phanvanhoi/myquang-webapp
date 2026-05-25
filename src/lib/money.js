const MONEY_EPS = 0.01;

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function parsePaymentAmounts(body = {}) {
  return {
    discountAmount: 0,
    discountReason: '',
    cashAmount: roundMoney(parseFloat(body.cash_amount) || 0),
    transferAmount: roundMoney(parseFloat(body.transfer_amount) || 0),
  };
}

function validatePaymentSubmission({ cashAmount, transferAmount, finalAmount, isWaiter }) {
  if (cashAmount < 0 || transferAmount < 0) {
    return 'Số tiền thanh toán không hợp lệ.';
  }
  if (isWaiter && cashAmount > MONEY_EPS) {
    return 'Phục vụ chỉ được xác nhận thanh toán chuyển khoản. Tiền mặt phải qua thu ngân.';
  }

  const paidTotal = roundMoney(cashAmount + transferAmount);
  const final = roundMoney(finalAmount);

  if (final > MONEY_EPS) {
    if (paidTotal < MONEY_EPS) {
      return 'Chưa nhập số tiền thanh toán.';
    }
    if (Math.abs(paidTotal - final) > MONEY_EPS) {
      return 'Tổng tiền mặt + chuyển khoản phải bằng số tiền cần thanh toán.';
    }
    if (isWaiter && Math.abs(transferAmount - final) > MONEY_EPS) {
      return 'Phục vụ phải xác nhận chuyển khoản đúng số tiền cần thanh toán.';
    }
  }

  return null;
}

module.exports = {
  MONEY_EPS,
  roundMoney,
  parsePaymentAmounts,
  validatePaymentSubmission,
};
