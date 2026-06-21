/** Nội dung trang giới thiệu — đồng bộ với https://taplink.cc/miquangque */
module.exports = {
  avatarUrl: 'https://taplink.st/a/7/8/3/b/e0dc04.png?1',
  heroImage: require('./menu-stock-images').INTRO_HERO,
  title: 'Ê ê ... Mì Quảng Quê',
  tagline: 'Mì Quảng · Bún Mắm Nêm · Bánh Tráng Cuốn · Cơm Gà Hội An',
  hotline: '0971351112',
  hotlineTel: '+84971351112',
  linkGroups: [
    {
      id: 'delivery',
      label: 'Giao & đặt món',
      links: [
        {
          title: 'ShopeeFood',
          subtitle: 'Nhiều mã — tài xế hay ghép nhiều đơn.',
          href: 'https://shopeefood.shopee.vn/u/jxZdduT',
          icon: 'shopping-bag',
        },
        {
          title: 'GrabFood',
          subtitle: 'Ship nhanh — trời mưa hơi khó tìm ship.',
          href: 'https://byvn.net/0AOj',
          icon: 'bike',
        },
        {
          title: 'Xanh SM Ngon',
          subtitle: 'Dễ tìm ship, giao nhanh.',
          href: 'https://byvn.net/rYH2',
          icon: 'zap',
        },
        {
          title: 'BeeFood',
          subtitle: 'Tốc độ ship trung bình.',
          href: 'https://byvn.net/rYH2',
          icon: 'package',
        },
      ],
    },
    {
      id: 'visit',
      label: 'Ghé quán',
      links: [
        {
          title: 'Chỉ đường',
          subtitle: 'Tìm đường đến Ê ê... Mì Quảng Quê',
          href: 'https://byvn.net/VaKn',
          icon: 'map-pin',
        },
        {
          title: 'Đánh giá 5 sao Google',
          subtitle: 'Mỗi sao là động lực — thiếu sót xin gọi hotline trước khi đánh giá.',
          href: 'https://byvn.net/lVuJ',
          icon: 'star',
        },
      ],
    },
    {
      id: 'learn',
      label: 'Khám phá',
      links: [
        {
          title: 'Cách ăn mì Quảng đúng điệu',
          subtitle: 'Đừng ăn mì Quảng như ăn bún, phở!',
          href: 'https://byvn.net/cNBF',
          icon: 'book-open',
        },
      ],
    },
  ],
};
