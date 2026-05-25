function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function localYmdCompact(d = new Date()) {
  return localYmd(d).replace(/-/g, '');
}

function parseYmd(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isoWeekKey(d) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - day);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Số ngày lịch trong khoảng [start, end] (bao gồm cả hai đầu). */
function daysInRange(start, end) {
  const s = parseYmd(start);
  const e = parseYmd(end);
  if (e < s) return 0;
  return Math.floor((e - s) / 86400000) + 1;
}

/** Số tuần ISO có ít nhất một ngày nằm trong khoảng. */
function weeksInRange(start, end) {
  const s = parseYmd(start);
  const e = parseYmd(end);
  if (e < s) return 0;
  const weeks = new Set();
  const cur = new Date(s);
  while (cur <= e) {
    weeks.add(isoWeekKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return weeks.size;
}

/** Số tháng lịch có ít nhất một ngày nằm trong khoảng. */
function monthsInRange(start, end) {
  const s = parseYmd(start);
  const e = parseYmd(end);
  if (e < s) return 0;
  const months = new Set();
  const cur = new Date(s);
  while (cur <= e) {
    months.add(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
    cur.setDate(cur.getDate() + 1);
  }
  return months.size;
}

function reportPeriodMeta(start, end) {
  const days = daysInRange(start, end);
  const weeks = weeksInRange(start, end);
  const months = monthsInRange(start, end);
  return {
    start,
    end,
    days,
    weeks: Math.max(weeks, 1),
    months: Math.max(months, 1),
  };
}

module.exports = {
  localYmd,
  localYmdCompact,
  parseYmd,
  daysInRange,
  weeksInRange,
  monthsInRange,
  reportPeriodMeta,
};
