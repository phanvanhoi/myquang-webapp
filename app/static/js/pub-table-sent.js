/**
 * Trạng thái sau khi khách gửi món QR tại bàn — sessionStorage (tab hiện tại).
 */
(function (global) {
  const KEY = 'mq_table_order_sent';
  const MIN_ETA = 10;
  const MAX_ETA = 15;
  const GRACE_MS = 30 * 60 * 1000;

  function randomEtaMinutes() {
    return MIN_ETA + Math.floor(Math.random() * (MAX_ETA - MIN_ETA + 1));
  }

  function save(payload) {
    const data = {
      sentAt: Date.now(),
      etaMinutes: randomEtaMinutes(),
      tableName: '',
      ...(payload || {}),
    };
    if (!data.etaMinutes) data.etaMinutes = randomEtaMinutes();
    sessionStorage.setItem(KEY, JSON.stringify(data));
    return data;
  }

  function load() {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function getEndMs(data) {
    if (!data || !data.sentAt || !data.etaMinutes) return 0;
    return data.sentAt + data.etaMinutes * 60 * 1000;
  }

  function getRemainingMs(data) {
    return Math.max(0, getEndMs(data) - Date.now());
  }

  function isActive(data) {
    if (!data || !data.sentAt) return false;
    return Date.now() < getEndMs(data) + GRACE_MS;
  }

  function isCounting(data) {
    return getRemainingMs(data) > 0;
  }

  function clear() {
    sessionStorage.removeItem(KEY);
  }

  global.MqTableSent = {
    save,
    load,
    getEndMs,
    getRemainingMs,
    isActive,
    isCounting,
    clear,
    MIN_ETA,
    MAX_ETA,
  };
})(typeof window !== 'undefined' ? window : global);
