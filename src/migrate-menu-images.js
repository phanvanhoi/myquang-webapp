const { q } = require('../db');
const { resolveMenuImage, isStaleStockUrl } = require('./menu-stock-images');

/** Gán ảnh stock cho món thiếu ảnh hoặc ảnh Wikimedia cũ lỗi (idempotent). */
function ensureMenuStockImages() {
  const items = q.all(
    `SELECT mi.id, mi.name, mi.image_url, mc.name AS category_name
     FROM menu_items mi
     JOIN menu_categories mc ON mc.id = mi.category_id`
  );
  let updated = 0;
  for (const item of items) {
    const url = (item.image_url || '').trim();
    if (url && !isStaleStockUrl(url)) continue;
    const stock = resolveMenuImage(item.name, item.category_name);
    q.run(
      'UPDATE menu_items SET image_url = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?',
      stock,
      item.id
    );
    updated++;
  }
  if (updated > 0) {
    console.log(`[menu-images] Đã cập nhật ảnh cho ${updated} món.`);
  }
}

if (require.main === module) {
  ensureMenuStockImages();
}

module.exports = { ensureMenuStockImages };
