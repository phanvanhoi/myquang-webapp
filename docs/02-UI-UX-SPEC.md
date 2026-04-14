# UI/UX Specification — Ứng dụng Quản lý Quán Ăn MyQuang

**Phiên bản:** 1.0  
**Ngày:** 2026-04-14  
**Tác giả:** UI/UX Design Team  
**Nền tảng:** Web App (Tablet 10" + Laptop)  
**Loại:** Single-Tenant, Internal Tool

---

## Mục lục

1. [Design System](#1-design-system)
2. [Layout Principles & Navigation](#2-layout-principles--navigation)
3. [Mô tả chi tiết màn hình](#3-mô-tả-chi-tiết-màn-hình)
   - 3.1 Login Screen
   - 3.2 Dashboard tổng quan
   - 3.3 Sơ đồ tầng/bàn (Floor Map)
   - 3.4 Màn hình Order
   - 3.5 Màn hình Thanh toán
   - 3.6 Quản lý Thực đơn
   - 3.7 Thu Chi
   - 3.8 Báo cáo & Thống kê
   - 3.9 Cài đặt
4. [Component Library](#4-component-library)
5. [Interaction Patterns & Micro-animations](#5-interaction-patterns--micro-animations)
6. [Responsive Breakpoints](#6-responsive-breakpoints)
7. [Accessibility Considerations](#7-accessibility-considerations)

---

## 1. Design System

### 1.1 Color Palette

Tone màu ấm áp, gợi cảm giác nhà hàng truyền thống Việt Nam, sạch sẽ và chuyên nghiệp.

#### Primary Colors

| Tên           | Hex       | RGB               | Sử dụng                              |
|---------------|-----------|-------------------|---------------------------------------|
| Amber Deep    | `#C45E1A` | rgb(196, 94, 26)  | CTA buttons, active states, accents   |
| Amber Light   | `#E8832A` | rgb(232, 131, 42) | Hover states, secondary highlights    |
| Cream Warm    | `#FDF6EC` | rgb(253, 246, 236)| Page background                       |
| Cream Card    | `#FEFAF4` | rgb(254, 250, 244)| Card background                       |

#### Semantic Colors

| Tên           | Hex       | Sử dụng                              |
|---------------|-----------|---------------------------------------|
| Success Green | `#2E7D32` | Bàn trống, thanh toán thành công      |
| Warning Amber | `#F57C00` | Bàn đang phục vụ, cảnh báo            |
| Danger Red    | `#C62828` | Xóa, lỗi, bàn chờ lâu                |
| Info Blue     | `#1565C0` | Thông tin, ghi chú                    |
| Reserved Teal | `#00695C` | Bàn đặt trước                         |

#### Neutral Colors

| Tên           | Hex       | Sử dụng                              |
|---------------|-----------|---------------------------------------|
| Gray 900      | `#1A1A1A` | Văn bản chính                         |
| Gray 700      | `#4A4A4A` | Văn bản phụ                           |
| Gray 500      | `#757575` | Placeholder, disabled                 |
| Gray 300      | `#BDBDBD` | Borders, dividers                     |
| Gray 100      | `#F5F5F5` | Hover backgrounds                     |
| White         | `#FFFFFF` | Nền card, modal                       |

#### Trạng thái bàn (quan trọng — dùng xuyên suốt Floor Map)

| Trạng thái     | Background | Border     | Text      | Ý nghĩa                  |
|----------------|------------|------------|-----------|--------------------------|
| Trống          | `#E8F5E9`  | `#2E7D32`  | `#1B5E20` | Bàn chưa có khách        |
| Có khách       | `#FFF3E0`  | `#E8832A`  | `#BF360C` | Đang phục vụ             |
| Chờ thanh toán | `#FFEBEE`  | `#C62828`  | `#B71C1C` | Khách yêu cầu tính tiền  |
| Đặt trước      | `#E0F2F1`  | `#00695C`  | `#004D40` | Đã đặt bàn trước         |

### 1.2 Typography

Font stack ưu tiên load nhanh, không cần Google Fonts nếu muốn offline:

```
Primary Font:   'Be Vietnam Pro', 'Inter', system-ui, sans-serif
Mono Font:      'JetBrains Mono', 'Courier New', monospace (dùng cho số tiền)
```

#### Type Scale

| Token         | Size    | Weight | Line Height | Sử dụng                        |
|---------------|---------|--------|-------------|--------------------------------|
| `text-2xl`    | 24px    | 700    | 1.3         | Tiêu đề trang                  |
| `text-xl`     | 20px    | 600    | 1.4         | Tiêu đề section, tên bàn       |
| `text-lg`     | 18px    | 600    | 1.4         | Tiêu đề card                   |
| `text-base`   | 16px    | 400    | 1.5         | Nội dung chính                 |
| `text-sm`     | 14px    | 400    | 1.5         | Nhãn phụ, metadata             |
| `text-xs`     | 12px    | 400    | 1.4         | Badge, timestamp               |
| `text-price`  | 18px    | 700    | 1.2         | Số tiền (dùng mono font)       |

**Lưu ý:** Minimum font size là 14px để đọc được trên tablet mà không cần zoom.

### 1.3 Spacing System

Dùng hệ thống 4px base:

| Token  | Value | Sử dụng điển hình              |
|--------|-------|--------------------------------|
| `sp-1` | 4px   | Icon padding, micro gaps       |
| `sp-2` | 8px   | Inline element gaps            |
| `sp-3` | 12px  | Component internal padding     |
| `sp-4` | 16px  | Standard padding, card gap     |
| `sp-5` | 20px  | Section spacing                |
| `sp-6` | 24px  | Card padding                   |
| `sp-8` | 32px  | Section separators             |
| `sp-10`| 40px  | Page-level spacing             |

### 1.4 Shadows & Elevation

```
shadow-sm:  0 1px 3px rgba(0,0,0,0.08)           — Card mặc định
shadow-md:  0 4px 12px rgba(0,0,0,0.10)          — Card hover, dropdown
shadow-lg:  0 8px 24px rgba(0,0,0,0.12)          — Modal, sidebar
shadow-xl:  0 16px 48px rgba(0,0,0,0.16)         — Full-screen overlay
```

### 1.5 Border Radius

```
radius-sm:  6px    — Badge, chip, input
radius-md:  10px   — Button, card nhỏ
radius-lg:  16px   — Card lớn, modal
radius-xl:  24px   — Panel chính
radius-full: 9999px — Pill badge, avatar
```

### 1.6 Icons

- **Thư viện:** Lucide Icons (SVG inline, ~2KB/icon, không cần CDN sau build)
- **Fallback:** SVG tự vẽ cho các icon đặc thù quán ăn
- **Kích thước chuẩn:** 20px (inline text), 24px (button), 32px (navigation), 48px (empty state)
- **Stroke width:** 1.75px (trông nhẹ, hiện đại)

#### Icons hay dùng

| Icon            | Lucide Name     | Sử dụng                   |
|-----------------|-----------------|---------------------------|
| Bàn ăn          | `square-dashed` | Floor map                 |
| Thêm món        | `plus-circle`   | Order                     |
| Giỏ hàng        | `shopping-cart` | Xem order hiện tại        |
| Thanh toán      | `receipt`       | Bill                      |
| Thực đơn        | `book-open`     | Menu management           |
| Báo cáo         | `bar-chart-2`   | Analytics                 |
| Cài đặt         | `settings`      | Settings                  |
| Đăng xuất       | `log-out`       | Logout                    |
| In hóa đơn      | `printer`       | Print bill                |
| Ghi chú         | `message-square`| Order notes               |
| Người dùng      | `users`         | Khách hàng                |
| Đồng hồ         | `clock`         | Thời gian ngồi            |

---

## 2. Layout Principles & Navigation

### 2.1 Layout Principles

**Nguyên tắc cốt lõi:**

1. **Touch-first, mouse-friendly:** Tất cả interactive elements tối thiểu 44×44px touch target
2. **Glanceable UI:** Thông tin quan trọng nhất hiển thị không cần scroll
3. **Giảm nhập liệu:** Ưu tiên tap/chọn, hạn chế gõ bàn phím
4. **Trạng thái rõ ràng:** Mỗi bàn, mỗi order phải hiển thị trạng thái tức thì
5. **Ít màn hình, sâu hơn:** Không nhiều trang con — dùng slide-panel và modal thay vì navigate

### 2.2 Navigation Structure

#### Sidebar Navigation (Laptop ≥ 1024px)

```
┌─────────────────────────────────────────────────────────────┐
│  SIDEBAR (240px)           │  MAIN CONTENT AREA             │
│  ┌─────────────────────┐   │                                │
│  │  [Logo] MyQuang     │   │                                │
│  │  ─────────────────  │   │                                │
│  │  [icon] Sơ đồ bàn  │◄──│── Active highlight             │
│  │  [icon] Thực đơn    │   │                                │
│  │  [icon] Thu Chi     │   │                                │
│  │  [icon] Báo cáo     │   │                                │
│  │  [icon] Cài đặt     │   │                                │
│  │  ─────────────────  │   │                                │
│  │  [avatar] Chủ quán  │   │                                │
│  │  [icon] Đăng xuất   │   │                                │
│  └─────────────────────┘   │                                │
└─────────────────────────────────────────────────────────────┘
```

#### Bottom Tab Navigation (Tablet < 1024px)

```
┌─────────────────────────────────────────────────────────────┐
│                    MAIN CONTENT AREA                        │
│                                                             │
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Sơ đồ]  [Thực đơn]  [Thu Chi]  [Báo cáo]  [Cài đặt]    │
│   Bàn        Menu                              ⚙           │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Navigation Hierarchy

```
App Root
├── Login                         (public)
├── Dashboard Nhanh               (post-login redirect)
├── Sơ đồ Bàn (Floor Map)         ← entry point chính
│   ├── Panel Order Bàn           (slide-in từ phải)
│   │   ├── Chọn món              (modal)
│   │   └── Ghi chú món           (inline)
│   └── Panel Thanh toán          (modal full)
├── Thực đơn
│   ├── Danh sách món
│   ├── Thêm/sửa món             (modal)
│   └── Quản lý danh mục
├── Thu Chi
│   ├── Danh sách giao dịch
│   └── Thêm giao dịch           (modal)
├── Báo cáo
│   ├── Doanh thu theo ngày/tuần/tháng
│   └── Món bán chạy
└── Cài đặt
    ├── Thông tin quán
    ├── Quản lý tài khoản
    └── Máy in / Thiết bị
```

---

## 3. Mô tả chi tiết màn hình

---

### 3.1 Login Screen

**Mục đích:** Xác thực người dùng, phân quyền (chủ quán / thu ngân / phục vụ)  
**URL:** `/login`

#### Wireframe

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│                                                            │
│              ┌──────────────────────────────┐             │
│              │          [LOGO]               │             │
│              │       MyQuang                 │             │
│              │   Quán Ăn Gia Đình            │             │
│              │                               │             │
│              │  ┌────────────────────────┐   │             │
│              │  │ 👤 Tên đăng nhập       │   │             │
│              │  └────────────────────────┘   │             │
│              │                               │             │
│              │  ┌────────────────────────┐   │             │
│              │  │ 🔒 Mật khẩu           │   │             │
│              │  └────────────────────────┘   │             │
│              │                               │             │
│              │  ┌────────────────────────┐   │             │
│              │  │    ĐĂNG NHẬP           │   │             │
│              │  └────────────────────────┘   │             │
│              │                               │             │
│              │  Quên mật khẩu? Liên hệ chủ  │             │
│              └──────────────────────────────┘             │
│                                                            │
│                   v1.0 — MyQuang POS                       │
└────────────────────────────────────────────────────────────┘
```

#### Thông số chi tiết

- **Background:** Gradient nhẹ `#FDF6EC → #F5E6D0`, có thể thêm pattern mờ (gạch bát tràng vector)
- **Card login:** `bg-white`, `shadow-xl`, `radius-xl`, width 400px (tablet: 90vw)
- **Logo:** Icon bát/đũa SVG + tên quán, màu `#C45E1A`
- **Input fields:**
  - Height: 52px (touch-friendly)
  - Border: 1.5px `#BDBDBD`, focus: `#C45E1A`
  - Padding: 16px
  - Font size: 16px (tránh iOS auto-zoom)
- **Nút Đăng nhập:**
  - Height: 52px, full-width
  - Background: `#C45E1A`, hover: `#E8832A`
  - Text: "ĐĂNG NHẬP", 16px, 700 weight, màu trắng
  - Loading state: spinner + text "Đang đăng nhập..."
- **Error state:** Toast đỏ xuất hiện phía trên form với message lỗi
- **Auto-focus:** Username field auto-focused khi load trang

#### Behavior

- Nhấn Enter trên bất kỳ field nào → submit form
- Mật khẩu: icon mắt để toggle hiện/ẩn
- Session persist 8 giờ (ca làm việc), sau đó redirect về login
- Không có "Remember me" — bảo mật cho thiết bị dùng chung

---

### 3.2 Dashboard Tổng Quan

**Mục đích:** Cái nhìn nhanh tình trạng quán ngay khi đăng nhập  
**URL:** `/dashboard`  
**Người dùng chính:** Chủ quán

#### Wireframe (Laptop)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR │  Dashboard — Thứ Hai, 14/04/2026            [🔔 2]  [avatar]  │
│         ├──────────────────────────────────────────────────────────────  │
│ [Sơ đồ]│                                                                 │
│ [Menu]  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐  │
│ [ThuChi]│  │ Doanh thu   │ │ Bàn đang    │ │ Order chờ   │ │ Hôm qua │  │
│ [Báocáo]│  │ hôm nay     │ │ phục vụ     │ │ thanh toán  │ │ so sánh │  │
│ [Cài đặt]  │ 4,250,000₫  │ │   8/14 bàn  │ │    3 bàn    │ │  +12%  ▲│  │
│         │  │ ────────    │ │ ─────────── │ │ ──────────  │ │         │  │
│         │  │ Cập nhật    │ │ [bar graph] │ │ [list icon] │ │[sparkline│  │
│         │  │ realtime    │ │             │ │             │ │         │  │
│         │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘  │
│         │                                                                 │
│         │  ┌──────────────────────────────┐  ┌────────────────────────┐  │
│         │  │ Hoạt động gần đây            │  │ Món bán chạy hôm nay   │  │
│         │  │ ──────────────────────────── │  │ ────────────────────── │  │
│         │  │ 14:32 Bàn 3 thanh toán       │  │ 1. Cơm sườn       x18  │  │
│         │  │        1,200,000₫            │  │ 2. Phở bò         x14  │  │
│         │  │ 14:18 Bàn B2 đặt order mới   │  │ 3. Bún bò         x11  │  │
│         │  │ 14:05 Bàn 1 gọi thêm món     │  │ 4. Cơm chiên      x9   │  │
│         │  │ 13:50 Phòng A B3 thanh toán   │  │ 5. Chè hạt sen    x7   │  │
│         │  │           [Xem tất cả →]      │  │      [Xem báo cáo →]   │  │
│         │  └──────────────────────────────┘  └────────────────────────┘  │
│         │                                                                 │
│         │  ┌──────────────────────────────────────────────────────────┐  │
│         │  │   [Sơ đồ tầng mini — Quick View]                        │  │
│         │  │   Tầng 1: [B1🟢][B2🟠][B3🟠][B4🟢][B5🔴][B6🟢]         │  │
│         │  │   Phòng A: [A1🟢][A2🟠][A3🟢][A4🟢]                    │  │
│         │  │   Phòng B: [B1🟢][B2🟢][B3🟠][B4🟢]                    │  │
│         │  │                          [Mở sơ đồ đầy đủ →]           │  │
│         │  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Stat Cards (4 cards)

Mỗi card:
- **Doanh thu hôm nay:** Số tiền lớn (24px, mono), cập nhật realtime mỗi 30 giây; sub-text "Đã nhận: X₫ / Chưa thanh toán: Y₫"
- **Bàn đang phục vụ:** "8/14 bàn", progress bar ngang màu amber
- **Chờ thanh toán:** Badge số đỏ nếu > 0; click → highlight những bàn đó trên mini floor map
- **So với hôm qua:** Sparkline chart đơn giản, % tăng/giảm

#### Behavior

- Dashboard auto-refresh mỗi 30 giây (không reload trang, chỉ fetch data)
- Click vào stat card → navigate đến section liên quan
- Quick-view floor map chỉ read-only; click "Mở sơ đồ đầy đủ" → navigate `/floor-map`

---

### 3.3 Sơ đồ Tầng/Bàn (Floor Map)

**Mục đích:** Entry point chính cho phục vụ và thu ngân. Hiển thị trực quan toàn bộ bàn, trạng thái, thời gian.  
**URL:** `/floor-map`  
**Người dùng chính:** Phục vụ, Thu ngân, Chủ quán

#### Wireframe tổng thể (Tablet, landscape)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← MyQuang                 Sơ đồ Bàn          14:45  [🔔] [Tài khoản]   │
├──────────────────────────────────────────────────────────────────────────┤
│  [Tầng 1] [Phòng A] [Phòng B]          Lọc: [Tất cả▼]  [Trống] [Có KH] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   TẦNG 1                                                                 │
│                                                                          │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                     │
│   │    BÀN 1    │  │    BÀN 2    │  │    BÀN 3    │                     │
│   │   TRỐNG     │  │  CÓ KHÁCH   │  │  CÓ KHÁCH   │                     │
│   │             │  │  45 phút    │  │  1 giờ 20   │                     │
│   │   4 chỗ     │  │  4 chỗ      │  │  6 chỗ      │                     │
│   │             │  │  180,000₫   │  │  350,000₫   │                     │
│   └─────────────┘  └─────────────┘  └─────────────┘                     │
│                                                                          │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                     │
│   │    BÀN 4    │  │    BÀN 5    │  │    BÀN 6    │                     │
│   │  ĐẶT TRƯỚC  │  │  CHỜ TÍNH  │  │   TRỐNG     │                     │
│   │  15:30      │  │  TIỀN       │  │             │                     │
│   │   4 chỗ     │  │  6 chỗ      │  │   4 chỗ     │                     │
│   │             │  │  520,000₫   │  │             │                     │
│   └─────────────┘  └─────────────┘  └─────────────┘                     │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│  Tổng: 6 bàn  |  Trống: 2  |  Có khách: 3  |  Chờ tính: 1  |  Đặt: 1  │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Wireframe — Chi tiết một card bàn

```
Card trạng thái "Có khách" (màu cam):
┌─────────────────────────────┐
│ BÀN 3              6 chỗ   │  ← Header: tên bàn + số chỗ
│ ─────────────────────────── │
│ 🕐 1 giờ 20 phút           │  ← Thời gian ngồi (cập nhật mỗi phút)
│                             │
│         350,000₫            │  ← Tổng tiền hiện tại (to, mono)
│                             │
│ [  Xem Order  ] [Tính Tiền] │  ← 2 action buttons
└─────────────────────────────┘

Card trạng thái "Trống" (màu xanh):
┌─────────────────────────────┐
│ BÀN 1              4 chỗ   │
│ ─────────────────────────── │
│                             │
│       TRỐNG                 │  ← Centered, lớn, màu xanh
│                             │
│   [   Mở Bàn / Order   ]   │  ← Full-width button
└─────────────────────────────┘

Card trạng thái "Chờ thanh toán" (màu đỏ, có pulse animation):
┌─────────────────────────────┐
│ BÀN 5    ● CHỜ TÍNH TIỀN   │  ← Badge nhấp nháy nhẹ
│ ─────────────────────────── │
│ 🕐 2 giờ 05 phút            │
│                             │
│         520,000₫            │
│                             │
│ [  Xem Order  ] [TÍNH TIỀN] │  ← "Tính tiền" highlight đỏ
└─────────────────────────────┘
```

#### Tab Phòng A / Phòng B

Khi chuyển sang "Phòng A" hoặc "Phòng B", layout 2×2 grid (4 bàn mỗi phòng):

```
PHÒNG A                     PHÒNG B
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  A - BÀN 1  │  │  A - BÀN 2  │         (tương tự)
│  TRỐNG   │  │  CÓ KHÁCH│
│          │  │  45 phút │
└──────────┘  └──────────┘
┌──────────┐  ┌──────────┐
│  A - BÀN 3  │  │  A - BÀN 4  │
│  TRỐNG   │  │  TRỐNG   │
└──────────┘  └──────────┘
```

#### Card Dimensions

| Breakpoint        | Card size      | Columns (T1) | Columns (Phòng) |
|-------------------|----------------|--------------|-----------------|
| Laptop ≥ 1280px   | 220×160px      | 3            | 2               |
| Tablet 768-1280px | 200×150px      | 3            | 2               |
| Tablet <768px     | Full width     | 1 (stack)    | 1               |

#### Behavior & Interactions

- **Tap bàn trống:** Mở slide panel bên phải "Bắt đầu order"
- **Tap bàn có khách:** Mở slide panel bên phải hiển thị order hiện tại
- **Tap bàn chờ tính:** Mở thẳng modal thanh toán
- **Long press bàn (2s):** Mở menu context: [Đổi trạng thái | Chuyển bàn | Ghép bàn]
- **Swipe tab** (tablet): Vuốt ngang để chuyển giữa Tầng 1 / Phòng A / Phòng B
- **Filter bar:** Lọc nhanh chỉ xem bàn trống hoặc bàn có khách

---

### 3.4 Màn hình Order

**Mục đích:** Chọn món, thêm/bớt số lượng, ghi chú đặc biệt  
**Trigger:** Từ Floor Map → tap bàn → Slide panel order

#### Wireframe — Slide Panel Order (hiện từ phải, width 420px / full-screen trên mobile)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  FLOOR MAP (mờ dần)           │ ← ORDER BÀN 3 (Tầng 1)        [✕ Đóng] │
│                               │ ─────────────────────────────────────── │
│                               │ 🕐 1 giờ 20 phút  |  Tổng: 350,000₫    │
│                               │                                          │
│                               │ Đã order:                                │
│                               │ ┌──────────────────────────────────────┐ │
│                               │ │ Cơm sườn bì chả     x2   120,000₫  │ │
│                               │ │ [−] [2] [+]              ✏️  🗑️     │ │
│                               │ ├──────────────────────────────────────┤ │
│                               │ │ Phở bò đặc biệt     x1    90,000₫  │ │
│                               │ │ [−] [1] [+]   📝 không hành         │ │
│                               │ ├──────────────────────────────────────┤ │
│                               │ │ Nước ngọt           x3    45,000₫  │ │
│                               │ │ [−] [3] [+]              ✏️  🗑️     │ │
│                               │ └──────────────────────────────────────┘ │
│                               │                                          │
│                               │ [+ Thêm món]  [📋 Ghi chú cho bàn]     │
│                               │ ─────────────────────────────────────── │
│                               │ Tổng cộng:          350,000₫           │
│                               │                                          │
│                               │ [  In phiếu bếp  ]  [  Tính Tiền  ]   │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Wireframe — Modal chọn món (full overlay)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Thêm món — Bàn 3                                               [✕]      │
├────────────────────────────────┬─────────────────────────────────────────┤
│  DANH MỤC                      │  MÓN ĂN                                 │
│  ──────────                    │  ─────────────────────────────────────   │
│  > Cơm (8 món)                 │  🔍  Tìm món...                         │
│    Phở (4 món)                 │                                         │
│    Bún (3 món)                 │  ┌───────────┐ ┌───────────┐ ┌─────────┐│
│    Đồ uống (12 món)            │  │Cơm sườn   │ │Cơm gà     │ │Cơm chiên││
│    Tráng miệng (5 món)         │  │bì chả     │ │xối mỡ     │ │dương    ││
│    ──────────────              │  │           │ │           │ │châu     ││
│    Đặc biệt hôm nay            │  │ 60,000₫   │ │ 65,000₫   │ │70,000₫  ││
│                                │  │ [+ Thêm]  │ │ [+ Thêm]  │ [+ Thêm] ││
│                                │  └───────────┘ └───────────┘ └─────────┘│
│                                │  ┌───────────┐ ┌───────────┐ ┌─────────┐│
│                                │  │Cơm bò lúc │ │Cơm tấm   │ │Cơm      ││
│                                │  │lắc        │ │sườn       │ │thịt kho ││
│                                │  │ 75,000₫   │ │ 55,000₫   │ │55,000₫  ││
│                                │  │ [+ Thêm]  │ │ [+ Thêm]  │ [+ Thêm] ││
│                                │  └───────────┘ └───────────┘ └─────────┘│
├────────────────────────────────┴─────────────────────────────────────────┤
│  Đã chọn: 3 món    Tổng thêm: 120,000₫          [Hủy]  [Xác nhận thêm] │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Thẻ món ăn trong menu

```
┌────────────────────────┐
│ [Ảnh hoặc icon emoji]  │  ← Nếu có ảnh: 80×60px, object-fit: cover
│                        │     Nếu không có ảnh: màu nền + emoji
│ Cơm sườn bì chả        │  ← Tên món, 14px, bold
│ Cơm + sườn + bì chả   │  ← Mô tả ngắn, 12px, gray
│            60,000₫     │  ← Giá, 14px, bold, amber
│      [  + Thêm  ]      │  ← Button, full width card
└────────────────────────┘
```

Khi món đã được thêm vào order:
```
┌────────────────────────┐
│ [Ảnh/icon]             │
│ Cơm sườn bì chả        │
│            60,000₫     │
│  [−]    2    [+]       │  ← Inline quantity control, thay thế button
└────────────────────────┘
```

#### Modal Ghi chú cho món

```
┌─────────────────────────────────────────┐
│  Ghi chú: Phở bò đặc biệt        [✕]   │
│  ─────────────────────────────────────  │
│  Gợi ý nhanh:                           │
│  [Không hành] [Ít cay] [Thêm nước]     │
│  [Không tiêu] [Chín tái] [Ít mỡ]      │
│                                         │
│  Hoặc nhập tùy chỉnh:                  │
│  ┌─────────────────────────────────┐   │
│  │ không hành, thêm chanh          │   │
│  └─────────────────────────────────┘   │
│                                         │
│              [Hủy]  [Lưu ghi chú]      │
└─────────────────────────────────────────┘
```

#### Behavior

- **Search món:** Debounce 300ms, tìm kiếm realtime trong danh sách, highlight kết quả
- **Category sidebar:** Sticky, click scroll đến section; active category highlighted
- **Thêm món:** Tap [+ Thêm] → số lượng hiện ngay (1), có thể tăng/giảm trực tiếp
- **Ghi chú nhanh:** Các tag preset (không hành, ít cay...) toggle ON/OFF bằng tap
- **In phiếu bếp:** Gửi tới máy in nhiệt (nếu cấu hình), hiển thị toast xác nhận
- **Confirm thêm món:** Khi xác nhận → slide panel order cập nhật tức thì, modal đóng

---

### 3.5 Màn hình Thanh Toán

**Mục đích:** Review bill, chọn phương thức thanh toán, in hóa đơn  
**Trigger:** Từ floor map → bàn chờ tính tiền → hoặc từ order panel → "Tính Tiền"

#### Wireframe — Modal Thanh toán (full-screen modal)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HÓA ĐƠN — BÀN 3 (Tầng 1)                        [← Quay lại]  [✕]    │
├───────────────────────────────────────┬──────────────────────────────────┤
│  CHI TIẾT ORDER                       │  THANH TOÁN                      │
│  ─────────────────────────────────    │  ──────────────────────────────  │
│                                       │                                  │
│  Cơm sườn bì chả × 2                 │  Tạm tính:        350,000₫       │
│                        120,000₫       │  Giảm giá:              0₫       │
│                                       │  VAT (đã bao gồm):    0₫         │
│  Phở bò đặc biệt × 1                 │  ─────────────────────────────   │
│  📝 không hành          90,000₫       │  TỔNG CỘNG:       350,000₫       │
│                                       │                                  │
│  Nước ngọt × 3                        │  Phương thức TT:                 │
│                          45,000₫      │  ┌──────────┐ ┌──────────┐       │
│  ─────────────────────────────────    │  │  💵 Tiền │ │ 📱 Chuyển│       │
│                                       │  │  mặt     │ │ khoản    │       │
│  Thời gian: 14:05 → 15:32            │  └──────────┘ └──────────┘       │
│  Thời gian phục vụ: 1h27'            │                                  │
│                                       │  Tiền khách đưa:                 │
│                                       │  ┌─────────────────────────┐     │
│                                       │  │      350,000            │     │
│                                       │  └─────────────────────────┘     │
│                                       │                                  │
│                                       │  Numpad:                         │
│                                       │  ┌───┐ ┌───┐ ┌───┐             │
│                                       │  │ 7 │ │ 8 │ │ 9 │             │
│                                       │  ├───┤ ├───┤ ├───┤             │
│                                       │  │ 4 │ │ 5 │ │ 6 │             │
│                                       │  ├───┤ ├───┤ ├───┤             │
│                                       │  │ 1 │ │ 2 │ │ 3 │             │
│                                       │  ├───┤ ├───┤ ├───┤             │
│                                       │  │000│ │ 0 │ │ ⌫ │             │
│                                       │  └───┘ └───┘ └───┘             │
│                                       │                                  │
│                                       │  Tiền thối:          0₫         │
│                                       │                                  │
│                                       │  [  In hóa đơn  ] [THANH TOÁN] │
└───────────────────────────────────────┴──────────────────────────────────┘
```

#### Quick amounts (tiền mặt)

```
Gợi ý nhanh dưới numpad:
[350,000] [400,000] [500,000] [1,000,000]
(tự tính toán dựa trên tổng bill, làm tròn lên các mệnh giá phổ biến)
```

#### Chuyển khoản mode

Khi chọn "Chuyển khoản":
- Hiển thị QR code ngân hàng (cấu hình sẵn)
- Số tài khoản, tên ngân hàng
- Nội dung chuyển khoản tự động (VD: "Ban3 MyQuang 350000")
- Nút "Xác nhận đã nhận tiền" → hoàn tất thanh toán

#### Giảm giá

Nút nhỏ "[Áp dụng giảm giá]" → modal nhỏ:
```
┌──────────────────────────────────┐
│ Giảm giá                    [✕]  │
│ [%]  Phần trăm: ____%            │
│ [₫]  Số tiền:  ______₫           │
│ Lý do: _________________________ │
│           [Hủy]  [Áp dụng]       │
└──────────────────────────────────┘
```

#### Behavior sau thanh toán

1. Toast xanh: "Thanh toán thành công! Bàn 3 đã được giải phóng"
2. Bàn chuyển về trạng thái "Trống" trên floor map
3. Doanh thu dashboard cập nhật
4. Nếu chọn in: gửi lệnh in hóa đơn khổ 80mm
5. Modal đóng, quay về floor map

---

### 3.6 Quản lý Thực Đơn

**Mục đích:** Thêm, sửa, xóa món ăn; quản lý danh mục; set giá  
**URL:** `/menu`  
**Người dùng chính:** Chủ quán

#### Wireframe (Laptop layout)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR │  Thực đơn                              [+ Thêm danh mục]      │
│         ├──────────────────────────────────────────────────────────────  │
│         │  🔍 Tìm món...                          [+ Thêm món mới]       │
│         │                                                                │
│         │  ┌─────────────────────────────────────────────────────────┐  │
│         │  │ Danh mục: [Tất cả] [Cơm] [Phở] [Bún] [Đồ uống] [Tráng]│  │
│         │  └─────────────────────────────────────────────────────────┘  │
│         │                                                                │
│         │  Cơm (8 món)                            [≡ Sắp xếp]  [✎ Sửa] │
│         │  ──────────────────────────────────────────────────────────── │
│         │  ┌─────────────────────────────────────────────────────────┐  │
│         │  │ [img] Cơm sườn bì chả    60,000₫  🟢 Đang bán  [✎][🗑]│  │
│         │  │ [img] Cơm gà xối mỡ     65,000₫  🟢 Đang bán  [✎][🗑]│  │
│         │  │ [img] Cơm chiên dương châu 70,000₫ 🔴 Hết món   [✎][🗑]│  │
│         │  │ [img] Cơm bò lúc lắc    75,000₫  🟢 Đang bán  [✎][🗑]│  │
│         │  └─────────────────────────────────────────────────────────┘  │
│         │                                                                │
│         │  Đồ uống (12 món)                                             │
│         │  ──────────────────────────────────────────────────────────── │
│         │  ...                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Modal Thêm/Sửa món

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Thêm món mới                                                     [✕]   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────┐   Tên món: *                                   │
│  │                     │   ┌──────────────────────────────────────────┐ │
│  │   [Tải ảnh lên]     │   │ Cơm sườn bì chả                         │ │
│  │   480×360 px        │   └──────────────────────────────────────────┘ │
│  │                     │                                                 │
│  └─────────────────────┘   Danh mục: *                                  │
│                             ┌──────────────────────────────────────────┐ │
│                             │ Cơm                                    ▼ │ │
│                             └──────────────────────────────────────────┘ │
│                                                                          │
│  Giá bán: *                     Mô tả (tùy chọn):                       │
│  ┌───────────────────────┐       ┌──────────────────────────────────┐   │
│  │ 60,000               ₫│       │ Cơm trắng, sườn nướng, bì, chả  │   │
│  └───────────────────────┘       └──────────────────────────────────┘   │
│                                                                          │
│  Trạng thái:  ● Đang bán   ○ Tạm hết   ○ Ẩn khỏi menu                │
│                                                                          │
│  Thứ tự hiển thị: ┌────┐  (kéo thả để sắp xếp)                         │
│                   │ 1  │                                                 │
│                   └────┘                                                 │
│                                                                          │
│                              [Hủy]          [Lưu món]                   │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Tính năng

- **Toggle trạng thái nhanh:** Tap icon trạng thái trên list → toggle giữa "Đang bán" / "Hết món" mà không cần mở modal
- **Kéo thả sắp xếp:** Drag & drop để reorder món trong danh mục
- **Bulk action:** Checkbox chọn nhiều món → [Xóa hàng loạt | Đổi danh mục | Ẩn/Hiện]
- **Tìm kiếm:** Realtime search theo tên món, filter theo danh mục và trạng thái

---

### 3.7 Màn hình Thu Chi

**Mục đích:** Ghi chép thu nhập ngoài đơn hàng và chi phí vận hành  
**URL:** `/finance`  
**Người dùng chính:** Chủ quán

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR │  Thu Chi                  Tháng 4/2026 ◄ ►    [+ Ghi khoản]  │
│         ├──────────────────────────────────────────────────────────────  │
│         │  ┌─────────────────────┐ ┌──────────────────┐ ┌────────────┐  │
│         │  │ Tổng thu (T4)       │ │ Tổng chi (T4)    │ │ Lợi nhuận  │  │
│         │  │   28,500,000₫       │ │    8,200,000₫    │ │ 20,300,000₫│  │
│         │  │ ↑ So tháng trước    │ │ ↓ So tháng trước │ │ Tỷ lệ: 71% │  │
│         │  └─────────────────────┘ └──────────────────┘ └────────────┘  │
│         │                                                                │
│         │  [Tất cả] [Thu] [Chi]          Lọc: [Tháng▼] [Danh mục▼]    │
│         │  ──────────────────────────────────────────────────────────── │
│         │                                                                │
│         │  14/04/2026                                                   │
│         │  ┌──────────────────────────────────────────────────────────┐ │
│         │  │ ↑ Thu  Doanh thu bán hàng          +4,250,000₫  [✎][🗑]│ │
│         │  │ ↓ Chi  Mua nguyên liệu chợ          -850,000₫  [✎][🗑]│ │
│         │  │ ↓ Chi  Tiền điện                    -320,000₫  [✎][🗑]│ │
│         │  └──────────────────────────────────────────────────────────┘ │
│         │                                                                │
│         │  13/04/2026                                                   │
│         │  ┌──────────────────────────────────────────────────────────┐ │
│         │  │ ↑ Thu  Doanh thu bán hàng          +3,890,000₫           │ │
│         │  │ ↓ Chi  Lương nhân viên tuần       -2,400,000₫            │ │
│         │  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Modal Ghi khoản

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Ghi khoản mới                                                    [✕]   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Loại:    ● Thu nhập    ○ Chi phí                                        │
│                                                                          │
│  Danh mục:                                                               │
│  [Doanh thu] [Nguyên liệu] [Nhân công] [Điện nước] [Khác]              │
│                                                                          │
│  Số tiền: *                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │   500,000                                                      ₫ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Mô tả:                                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Mua rau củ chợ Đồng Xuân                                         │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Ngày:  ┌─────────────────┐                                             │
│         │   14/04/2026  📅│                                             │
│         └─────────────────┘                                             │
│                                                                          │
│                              [Hủy]          [Lưu khoản]                 │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### 3.8 Màn hình Báo Cáo & Thống Kê

**Mục đích:** Phân tích doanh thu, xu hướng, món bán chạy  
**URL:** `/reports`  
**Người dùng chính:** Chủ quán

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR │  Báo cáo                    [Hôm nay▼]  [14/04▼] [Xuất Excel]│
│         ├──────────────────────────────────────────────────────────────  │
│         │                                                                │
│         │  Tabs: [Doanh thu] [Món ăn] [Bàn] [Nhân viên]               │
│         │  ────────────────────────────────────────────                 │
│         │                                                                │
│         │  DOANH THU THEO GIỜ — Thứ Hai 14/04/2026                     │
│         │                                                                │
│         │  ₫                                                             │
│         │  1.2M │         ████                                           │
│         │  1.0M │     ███ ████ ██                                        │
│         │  800K │  █  ███ ████ ████                                      │
│         │  600K │  █  ███ ████ ████ ███                                  │
│         │  400K │  █  ███ ████ ████ ███ ██                               │
│         │  200K │  █  ███ ████ ████ ███ ██  █                            │
│         │     0 └──────────────────────────────────── giờ               │
│         │       10  11  12  13  14  15  16  17  18  19  20              │
│         │                                                                │
│         │  ┌──────────────────────┐   ┌────────────────────────────┐    │
│         │  │ TOP MÓN BÁN CHẠY    │   │ DOANH THU THEO TẦNG        │    │
│         │  │ ─────────────────── │   │ ───────────────────────── │    │
│         │  │ 1. Cơm sườn  x18   │   │ Tầng 1:  2,800,000₫  66%   │    │
│         │  │ 2. Phở bò    x14   │   │ Phòng A: 900,000₫    21%    │    │
│         │  │ 3. Bún bò    x11   │   │ Phòng B: 550,000₫    13%    │    │
│         │  │ 4. Cơm chiên  x9   │   │ [Bar chart ngang]           │    │
│         │  │ 5. Chè hạt sen x7  │   │                             │    │
│         │  └──────────────────────┘   └────────────────────────────┘    │
│         │                                                                │
│         │  Tổng hóa đơn: 24  |  TB/hóa đơn: 177,000₫  |  Giờ cao điểm: 12h-13h  │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Các view báo cáo

| Tab          | Nội dung                                                          |
|--------------|-------------------------------------------------------------------|
| Doanh thu    | Bar/line chart theo giờ, ngày, tuần, tháng; so sánh kỳ trước     |
| Món ăn       | Top món bán chạy, món ít bán, doanh thu theo danh mục             |
| Bàn          | Doanh thu theo bàn, tầng; thời gian sử dụng trung bình           |
| Nhân viên    | Số hóa đơn xử lý, doanh thu phụ trách (nếu track theo user)      |

#### Bộ lọc thời gian

```
[Hôm nay] [Hôm qua] [7 ngày] [Tháng này] [Tháng trước] [Tùy chỉnh...]
```

---

### 3.9 Màn hình Cài Đặt

**Mục đích:** Cấu hình thông tin quán, tài khoản, máy in, thiết bị  
**URL:** `/settings`  
**Người dùng chính:** Chủ quán (phân quyền)

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR │  Cài đặt                                                       │
│         ├──────────────────────────────────────────────────────────────  │
│         │                                                                │
│         │  ┌──────────────────────────────────────────────────────────┐ │
│         │  │ THÔNG TIN QUÁN                                           │ │
│         │  │ ──────────────                                           │ │
│         │  │ Tên quán:    ┌──────────────────────────────────────┐   │ │
│         │  │              │ MyQuang                               │   │ │
│         │  │              └──────────────────────────────────────┘   │ │
│         │  │ Địa chỉ:     ┌──────────────────────────────────────┐   │ │
│         │  │              │ 123 Đường ABC, Quận 1, HCM            │   │ │
│         │  │              └──────────────────────────────────────┘   │ │
│         │  │ SĐT:         ┌──────────────────┐                        │ │
│         │  │              │ 0901 234 567      │                        │ │
│         │  │              └──────────────────┘                        │ │
│         │  │ Logo:        [Tải ảnh lên]  [preview]                   │ │
│         │  │                                          [Lưu thay đổi] │ │
│         │  └──────────────────────────────────────────────────────────┘ │
│         │                                                                │
│         │  ┌──────────────────────────────────────────────────────────┐ │
│         │  │ QUẢN LÝ TÀI KHOẢN                          [+ Thêm user]│ │
│         │  │ ──────────────────                                       │ │
│         │  │ [avatar] Nguyễn Văn A   Chủ quán    [✎ Sửa] [🗑 Xóa]  │ │
│         │  │ [avatar] Trần Thị B     Thu ngân    [✎ Sửa] [🗑 Xóa]  │ │
│         │  │ [avatar] Lê Văn C       Phục vụ     [✎ Sửa] [🗑 Xóa]  │ │
│         │  └──────────────────────────────────────────────────────────┘ │
│         │                                                                │
│         │  ┌──────────────────────────────────────────────────────────┐ │
│         │  │ MÁY IN & THIẾT BỊ                                        │ │
│         │  │ ──────────────────                                       │ │
│         │  │ Máy in hóa đơn:  [Epson TM-T82]  [Test in] [Cấu hình]  │ │
│         │  │ Máy in bếp:      [Chưa kết nối]  [+ Thêm máy in]       │ │
│         │  │ Khổ giấy:  ● 80mm  ○ 58mm                               │ │
│         │  └──────────────────────────────────────────────────────────┘ │
│         │                                                                │
│         │  ┌──────────────────────────────────────────────────────────┐ │
│         │  │ HÓA ĐƠN                                                  │ │
│         │  │ ─────────                                                │ │
│         │  │ Header hóa đơn: [MyQuang — Quán Ăn Gia Đình           ] │ │
│         │  │ Footer hóa đơn: [Cảm ơn quý khách! Hẹn gặp lại       ] │ │
│         │  │ In VAT:  ○ Có  ● Không                                  │ │
│         │  │ Tự động in sau thanh toán:  ● Có  ○ Không               │ │
│         │  └──────────────────────────────────────────────────────────┘ │
│         │                                                                │
│         │  ┌──────────────────────────────────────────────────────────┐ │
│         │  │ THÔNG TIN NGÂN HÀNG (QR thanh toán)                      │ │
│         │  │ Ngân hàng: [Vietcombank           ▼]                     │ │
│         │  │ Số TK:     [1234567890              ]                     │ │
│         │  │ Chủ TK:    [NGUYEN VAN A            ]                     │ │
│         │  │ Preview QR: [QR code preview]         [Lưu]              │ │
│         │  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Library

### 4.1 Buttons

#### Variants

```
Primary:    bg:#C45E1A  text:white  hover:bg:#E8832A
Secondary:  bg:white    text:#C45E1A  border:1.5px #C45E1A  hover:bg:#FDF6EC
Danger:     bg:#C62828  text:white  hover:bg:#E53935
Ghost:      bg:transparent  text:#4A4A4A  hover:bg:#F5F5F5
```

#### Sizes

```
Large (L):   height:52px  padding:16px 24px  font:16px  radius:10px  — Form submit, CTA
Medium (M):  height:44px  padding:12px 20px  font:14px  radius:8px   — Default
Small (S):   height:36px  padding:8px  16px  font:13px  radius:6px   — Actions in table
```

#### States

```
Normal → Hover (scale 1.01, shadow-md) → Active (scale 0.99) → Disabled (opacity 0.4)
Loading: spinner icon thay thế text, disabled
```

#### Touch targets

Mọi button đều có padding ẩn để vùng tap tối thiểu 44×44px, kể cả button Small.

### 4.2 Cards

#### Table Card (Floor Map)

```css
.table-card {
  border-radius: 16px;
  border: 2px solid;
  padding: 16px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.table-card:hover {
  transform: translateY(-2px);
  box-shadow: shadow-md;
}
.table-card:active {
  transform: scale(0.98);
}
/* States: --color-empty, --color-occupied, --color-waiting, --color-reserved */
```

#### Info Card (Dashboard stat)

```
┌──────────────────────────────────┐
│ Tiêu đề nhỏ (12px, gray-500)    │
│                                  │
│   2,450,000₫    (24px, bold)    │
│                                  │
│ ▲ 12% so với hôm qua (12px)     │
└──────────────────────────────────┘
bg: white, border-radius: 16px, shadow-sm
padding: 20px 24px
```

#### Menu Item Card (Order modal)

```
┌──────────────────────────────────┐
│ ┌────────────────────────────┐   │
│ │     Ảnh món (aspect 4:3)  │   │
│ └────────────────────────────┘   │
│ Tên món             14px/bold    │
│ Mô tả               12px/gray    │
│               60,000₫            │
│    [+ Thêm vào order]            │
└──────────────────────────────────┘
```

### 4.3 Modals

#### Cấu trúc

```
Backdrop: rgba(0,0,0,0.5), blur(4px)
Container: bg:white, radius:20px, shadow-xl
  Header: padding 24px 24px 0, border-bottom
  Body: padding 24px, overflow-y: auto, max-height: 70vh
  Footer: padding 0 24px 24px, flex, justify-end, gap 12px
```

#### Sizes

- **Small:** max-width 400px — Confirm dialog, ghi chú nhanh
- **Medium:** max-width 600px — Form thêm/sửa
- **Large:** max-width 900px — Chọn món, báo cáo chi tiết
- **Full:** width 100vw, height 100vh — Thanh toán (trên tablet)

#### Animation

```
Enter: scale(0.94) opacity(0) → scale(1) opacity(1) — 200ms ease-out
Exit:  scale(1) opacity(1) → scale(0.94) opacity(0) — 150ms ease-in
Backdrop: opacity(0) → opacity(1) — 200ms
```

### 4.4 Slide Panel

Dùng cho Order panel, kéo từ phải vào:

```
width: 420px (laptop) / 100vw (tablet)
position: fixed, right: 0, top: 0, height: 100vh
background: white
shadow: -8px 0 24px rgba(0,0,0,0.12)

Enter: translateX(100%) → translateX(0) — 280ms cubic-bezier(0.16, 1, 0.3, 1)
Exit:  translateX(0) → translateX(100%) — 200ms ease-in

Overlay: click ra ngoài để đóng
Drag to close (tablet): swipe phải để đóng
```

### 4.5 Toast Notifications

```
Position: top-right (laptop), top-center (tablet/mobile)
Width: 320px
Stack: multiple toasts stack xuống với gap 8px

┌──────────────────────────────────┐
│ ✅ Thanh toán thành công!         │
│    Bàn 3 đã được giải phóng      │
└──────────────────────────────────┘

Types:
  success: bg:#E8F5E9, border-left: 4px solid #2E7D32, icon: check-circle
  error:   bg:#FFEBEE, border-left: 4px solid #C62828, icon: x-circle
  warning: bg:#FFF3E0, border-left: 4px solid #F57C00, icon: alert-triangle
  info:    bg:#E3F2FD, border-left: 4px solid #1565C0, icon: info

Auto-dismiss: 4 giây (success/info), 6 giây (warning), persist cho error
Animation: slideInRight + fadeIn → fadeOut
```

### 4.6 Form Elements

#### Input

```
height: 48px (touch-friendly)
border: 1.5px solid #BDBDBD
border-radius: 8px
padding: 12px 16px
font-size: 16px (tránh iOS zoom)
focus: border-color #C45E1A, box-shadow 0 0 0 3px rgba(196,94,26,0.15)
error: border-color #C62828, helper text màu đỏ bên dưới
```

#### Select / Dropdown

```
Styled native select hoặc custom dropdown
height: 48px, arrow icon Lucide ChevronDown
Dropdown list: radius-md, shadow-md, max-height 200px scroll
```

#### Quantity Stepper (Order)

```
┌──────────────────┐
│  [−]    2    [+] │
└──────────────────┘
Mỗi button: 40×40px, radius 8px
Số giữa: 40px wide, text-align center, font bold 16px
[−] disabled khi quantity = 1 (không cho về 0, dùng nút xóa riêng)
```

### 4.7 Badge / Status Chip

```
Trạng thái bàn:
┌────────────────┐
│ ● CÓ KHÁCH    │   bg: #FFF3E0, text: #BF360C, border: #E8832A
└────────────────┘

┌─────────────┐
│ ● TRỐNG    │   bg: #E8F5E9, text: #1B5E20, border: #2E7D32
└─────────────┘

height: 28px, padding: 4px 12px, radius: 9999px, font: 12px 600
```

### 4.8 Empty State

```
┌─────────────────────────────┐
│                             │
│          [Icon 64px]        │
│                             │
│   Chưa có dữ liệu           │  16px, gray-700
│   Hãy thêm món đầu tiên     │  14px, gray-500
│                             │
│   [+ Thêm ngay]             │  Button primary
│                             │
└─────────────────────────────┘
```

---

## 5. Interaction Patterns & Micro-animations

### 5.1 Nguyên tắc Animation

- **Duration:** 150ms (micro) → 200ms (standard) → 300ms (large)
- **Easing:** `ease-out` cho enter, `ease-in` cho exit, `cubic-bezier(0.16, 1, 0.3, 1)` cho spring effects
- **Tránh:** Animation > 400ms trên UI thao tác nhanh (order, thanh toán)
- **Reduce motion:** Tôn trọng `prefers-reduced-motion: reduce`

### 5.2 Patterns chính

#### Thêm món vào order

```
1. Tap [+ Thêm] trên card món
2. Button scale down nhẹ (active state) — 50ms
3. Badge số lượng trên icon giỏ hàng ở panel header:
   - Số tăng lên với animation: scale(1.4) → scale(1), màu amber pulse — 300ms
4. Dòng món xuất hiện trong danh sách order (slide down + fade in) — 200ms
5. Tổng tiền counter: số đếm lên mượt mà — 300ms
```

#### Thanh toán thành công

```
1. Nút "THANH TOÁN" → loading spinner (300ms)
2. Success overlay: check icon circle animation (SVG path draw) — 500ms
3. Toast xanh slide in — 200ms
4. Modal fade out — 200ms
5. Trên floor map: card bàn transition màu (cam → xanh) — 400ms
6. Số liệu dashboard cập nhật (số đếm lên) — 500ms
```

#### Bàn chờ thanh toán (pulse)

```css
@keyframes pulse-border {
  0%, 100% { border-color: #C62828; box-shadow: 0 0 0 0 rgba(198,40,40,0.4); }
  50% { border-color: #E53935; box-shadow: 0 0 0 6px rgba(198,40,40,0); }
}
.table-card--waiting { animation: pulse-border 2s infinite; }
```

#### Chuyển tab tầng/phòng

```
Tab content: slide horizontal — 250ms ease-out
Active tab indicator: slide ngang dưới tab text — 200ms
```

#### Ghi chú nhanh (tag toggle)

```
Tap tag → scale(0.95) → scale(1) với background fill — 150ms
ON state: bg amber, text white
OFF state: bg gray-100, text gray-700
```

#### Loading states

- **Skeleton loading:** Cho card bàn, danh sách món — shimmer animation
- **Button loading:** Thay text bằng spinner + text mô tả ("Đang lưu...")
- **Page transition:** Fade in khi navigate — 150ms

#### Error feedback

- **Input error:** Border đỏ + shake animation (translateX ±4px × 3 lần) — 300ms total
- **Network error:** Full-width banner đỏ phía trên, không block UI

### 5.3 Touch Gestures (Tablet)

| Gesture               | Action                                          |
|-----------------------|-------------------------------------------------|
| Tap                   | Select, toggle, navigate                        |
| Double tap (bàn)      | Mở nhanh order panel                           |
| Long press 2s (bàn)   | Context menu (chuyển bàn, ghép bàn...)          |
| Swipe right (panel)   | Đóng slide panel                               |
| Swipe left/right (tab)| Chuyển tầng/phòng                              |
| Pull to refresh       | Reload trạng thái bàn                           |
| Pinch to zoom         | Không áp dụng trên floor map (disabled)         |

### 5.4 Keyboard Shortcuts (Laptop)

| Phím              | Action                                    |
|-------------------|-------------------------------------------|
| `Esc`             | Đóng modal/panel đang mở                 |
| `Enter` (form)    | Submit form                               |
| `Ctrl+P`          | In hóa đơn                               |
| `Ctrl+F`          | Focus vào search box                     |
| `1` / `2` / `3`   | Chuyển tab Tầng 1 / Phòng A / Phòng B (khi ở floor map) |
| `Tab`             | Navigation giữa interactive elements     |

---

## 6. Responsive Breakpoints

### 6.1 Breakpoint Definitions

```
xs:  < 480px    — Điện thoại nhỏ (dùng hạn chế)
sm:  480-767px  — Điện thoại lớn (hỗ trợ xem cơ bản)
md:  768-1023px — Tablet portrait (thiết kế chính cho nhân viên)
lg:  1024-1279px— Tablet landscape / laptop nhỏ
xl:  ≥ 1280px   — Laptop / màn hình lớn (thiết kế chính cho chủ quán)
```

### 6.2 Layout Changes per Breakpoint

| Element            | mobile (sm)     | tablet (md)          | laptop (xl)           |
|--------------------|-----------------|----------------------|-----------------------|
| Navigation         | Bottom tab bar  | Bottom tab bar       | Left sidebar 240px    |
| Floor map grid     | 1 column        | 2-3 columns          | 3 columns             |
| Order panel        | Full screen     | 50% overlay          | 420px fixed panel     |
| Payment modal      | Full screen     | Full screen          | 80vw centered         |
| Menu modal         | Full screen     | Full screen          | 900px centered        |
| Dashboard stats    | 1×4 stacked     | 2×2 grid             | 4×1 row               |
| Reports chart      | Height 200px    | Height 280px         | Height 360px          |
| Sidebar visibility | Hidden          | Hidden               | Always visible        |
| Card table size    | Full width      | 180×140px            | 220×160px             |

### 6.3 CSS Implementation Approach

```css
/* Mobile-first approach */
.layout-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@media (min-width: 768px) {
  .layout-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1280px) {
  .layout-grid {
    grid-template-columns: repeat(4, 1fr);
  }
  .app-layout {
    display: grid;
    grid-template-columns: 240px 1fr;
  }
}
```

### 6.4 Tablet-specific Optimizations

- **Touch target minimum:** 44×44px tất cả interactive elements
- **Font size minimum:** 14px (tránh zoom)
- **Input font size:** 16px (tránh iOS auto-zoom)
- **Scroll:** Thêm `-webkit-overflow-scrolling: touch` cho list dài
- **Tap highlight:** Custom hoặc tắt default `tap-highlight-color: transparent`
- **Hover states:** Dùng `@media (hover: hover)` để chỉ áp dụng hover trên desktop
- **Orientation:** Hỗ trợ cả portrait và landscape; layout tự điều chỉnh
- **Safe area:** Thêm `padding: env(safe-area-inset-*)` cho notch/home bar trên tablet

### 6.5 Offline & Performance

- App shell cache (Service Worker) — load nhanh khi mạng chậm
- Data fetch: debounce search (300ms), lazy load ảnh món ăn
- Font: subset tiếng Việt, display: swap
- Icons: SVG inline, không cần external request
- Images: WebP với JPEG fallback, lazy loading

---

## 7. Accessibility Considerations

### 7.1 Color Contrast

Tất cả text đạt WCAG AA minimum:

| Cặp màu                           | Contrast Ratio | Mức đạt |
|-----------------------------------|----------------|---------|
| Gray 900 (#1A1A1A) trên Cream     | 15.2:1         | AAA     |
| White trên Amber Deep (#C45E1A)   | 4.6:1          | AA      |
| White trên Danger Red (#C62828)   | 5.9:1          | AA      |
| Gray 700 trên White               | 7.3:1          | AAA     |
| Amber Deep trên White             | 4.6:1          | AA      |

**Lưu ý:** Không truyền đạt thông tin chỉ qua màu sắc — luôn đi kèm text hoặc icon (trạng thái bàn dùng cả màu + label text).

### 7.2 Semantic HTML

```html
<!-- Ví dụ cấu trúc đúng -->
<nav aria-label="Điều hướng chính">
  <ul role="list">
    <li><a href="/floor-map" aria-current="page">Sơ đồ bàn</a></li>
  </ul>
</nav>

<main id="main-content">
  <h1>Sơ đồ Bàn — Tầng 1</h1>
  <section aria-label="Danh sách bàn tầng 1">
    <article class="table-card" 
             role="button" 
             tabindex="0"
             aria-label="Bàn 3, Có khách, 1 giờ 20 phút, 350.000 đồng"
             aria-pressed="false">
      ...
    </article>
  </section>
</main>
```

### 7.3 Keyboard Navigation

- **Focus order:** Hợp lý theo chiều đọc (trái→phải, trên→dưới)
- **Focus visible:** Ring rõ ràng `outline: 3px solid #C45E1A; outline-offset: 2px`
- **Skip link:** "Nhảy đến nội dung chính" ẩn đến khi focus
- **Modal trap:** Focus bị trap trong modal khi mở; Esc để đóng
- **Dropdown:** Arrow keys để điều hướng trong dropdown

### 7.4 Screen Reader Support

- `aria-live="polite"` cho toast notification và cập nhật số liệu realtime
- `aria-live="assertive"` cho thông báo lỗi quan trọng
- `aria-label` đầy đủ cho icon-only buttons (không có text)
- `aria-expanded` cho accordion, dropdown
- `aria-haspopup` cho nút mở modal/menu
- `role="status"` cho counter đồng hồ thời gian ngồi của bàn

### 7.5 Motion & Vestibular

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  /* Giữ lại: opacity transition cho toast */
  .toast { transition: opacity 0.2s; }
}
```

### 7.6 Touch & Motor Accessibility

- Không dùng double-tap làm action chính (dễ bị trigger nhầm)
- Long press luôn có alternative tap (context menu cũng có nút riêng)
- Destructive actions (xóa món, xóa order) luôn có confirm dialog 2 bước
- Drag & drop trong menu management có alternative button-based reorder

### 7.7 Ngôn ngữ & Localization

- Toàn bộ UI bằng tiếng Việt
- Số tiền: định dạng `1.250.000₫` (dấu chấm ngăn nghìn, ký hiệu ₫)
- Ngày giờ: định dạng `14/04/2026`, `14:32`
- Thời gian tương đối: "45 phút", "1 giờ 20 phút" (không dùng "ago/before")
- Confirm dialog: "Xác nhận" / "Hủy" (không dùng "OK" / "Cancel")

---

## Phụ lục A — Cấu trúc File CSS gợi ý

```
styles/
├── tokens.css          — CSS custom properties (colors, spacing, radius...)
├── reset.css           — Minimal CSS reset
├── typography.css      — Type scale, font imports
├── layout.css          — App shell, grid, sidebar, bottom nav
├── components/
│   ├── button.css
│   ├── card.css
│   ├── modal.css
│   ├── toast.css
│   ├── form.css
│   ├── badge.css
│   └── table-card.css  — Floor map bàn cards
├── pages/
│   ├── login.css
│   ├── floor-map.css
│   ├── order.css
│   ├── payment.css
│   └── reports.css
└── utilities.css       — Helper classes
```

---

## Phụ lục B — Quy ước đặt tên CSS (BEM)

```css
/* Block */
.table-card { }

/* Element */
.table-card__header { }
.table-card__status { }
.table-card__amount { }
.table-card__actions { }

/* Modifier */
.table-card--empty { }
.table-card--occupied { }
.table-card--waiting { }
.table-card--reserved { }

/* State */
.table-card.is-selected { }
.table-card.is-loading { }
```

---

*Tài liệu này là phiên bản 1.0. Cập nhật khi có thay đổi yêu cầu hoặc sau vòng usability testing đầu tiên.*
