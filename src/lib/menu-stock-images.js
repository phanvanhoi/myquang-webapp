/**
 * Ảnh món mặc định — Unsplash (free, hotlink ổn định).
 * Gán khi menu chưa có image_url hoặc ảnh cũ Wikimedia lỗi.
 */
const U = (id) => `https://images.unsplash.com/${id}?w=800&q=80&auto=format`;

const CATEGORY_IMAGES = {
  'Mì Quảng Truyền Thống': U('photo-1569718212165-3a8278d5f624'),
  'Bún Mắm Nêm': U('photo-1606755962773-d324e0a13086'),
  'Món Cuốn': U('photo-1604908176997-125f25cc6f3d'),
  'Món Ăn Kèm': U('photo-1546069901-ba9599a7e63c'),
  'Cơm Gà Hội An': U('photo-1512058564366-18510be2db19'),
  'Giải Khát': U('photo-1529692236671-f1f6cf9683ba'),
};

const NAME_IMAGES = [
  [/coca|pepsi|suối|nuoc/i, U('photo-1529692236671-f1f6cf9683ba')],
  [/trà|tra/i, U('photo-1546069901-ba9599a7e63c')],
  [/bánh tráng|banh trang|cuốn|cuon/i, U('photo-1604908176997-125f25cc6f3d')],
  [/cơm gà|com ga/i, U('photo-1512058564366-18510be2db19')],
  [/bún|bun/i, U('photo-1606755962773-d324e0a13086')],
  [/mì|mi quang/i, U('photo-1569718212165-3a8278d5f624')],
];

const HERO_IMAGES = [
  CATEGORY_IMAGES['Mì Quảng Truyền Thống'],
  CATEGORY_IMAGES['Bún Mắm Nêm'],
  CATEGORY_IMAGES['Món Cuốn'],
  CATEGORY_IMAGES['Cơm Gà Hội An'],
  CATEGORY_IMAGES['Món Ăn Kèm'],
];

const INTRO_HERO = U('photo-1569718212165-3a8278d5f624');

function isStaleStockUrl(url) {
  if (!url) return true;
  return url.includes('upload.wikimedia.org/wikipedia/commons');
}

function resolveMenuImage(name, categoryName) {
  const n = String(name || '');
  for (const [re, imgUrl] of NAME_IMAGES) {
    if (re.test(n)) return imgUrl;
  }
  if (categoryName && CATEGORY_IMAGES[categoryName]) {
    return CATEGORY_IMAGES[categoryName];
  }
  return CATEGORY_IMAGES['Mì Quảng Truyền Thống'];
}

function enrichMenuItem(item) {
  const url = (item.image_url || '').trim();
  const resolved = isStaleStockUrl(url) ? resolveMenuImage(item.name, item.category_name) : url;
  return { ...item, image_url: resolved || resolveMenuImage(item.name, item.category_name) };
}

function enrichMenuItems(items) {
  return items.map(enrichMenuItem);
}

module.exports = {
  CATEGORY_IMAGES,
  HERO_IMAGES,
  INTRO_HERO,
  isStaleStockUrl,
  resolveMenuImage,
  enrichMenuItem,
  enrichMenuItems,
};
