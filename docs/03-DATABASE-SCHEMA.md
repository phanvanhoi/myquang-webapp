# 03 - DATABASE SCHEMA: Hệ Thống Quản Lý Quán Ăn MyQuang

> **Phiên bản:** 1.0 | **Ngày tạo:** 2026-04-14 | **Database:** SQLite (MVP) / PostgreSQL (tùy chọn)

---

## 1. ENTITY RELATIONSHIP DIAGRAM

```
+------------------+     +------------------+     +------------------+
|     floors       |     |      rooms       |     |     tables       |
|------------------|     |------------------|     |------------------|
| id (PK)          |1---*| id (PK)          |1---*| id (PK)          |
| name             |     | floor_id (FK)    |     | floor_id (FK)    |
| sort_order       |     | name             |     | room_id (FK)?    |
| is_active        |     | capacity         |     | code  UNIQUE     |
+------------------+     | is_active        |     | name             |
                         +------------------+     | capacity         |
                                                  | status           |
                                                  +------------------+
                                                          |1
                                                          *
+------------------+     +------------------+     +------------------+
|  menu_categories |1---*|   menu_items     |1---*|  item_variants   |
|------------------|     |------------------|     |------------------|
| id (PK)          |     | id (PK)          |     | id (PK)          |
| name             |     | category_id (FK) |     | item_id (FK)     |
| sort_order       |     | name             |     | name             |
| is_active        |     | base_price       |     | price_modifier   |
+------------------+     | is_available     |     | is_available     |
                         | is_active        |     +------------------+
                         +------------------+

+------------------+     +------------------+     +------------------+
|      orders      |1---*|   order_items    |     |    payments      |
|------------------|     |------------------|     |------------------|
| id (PK)          |     | id (PK)          |     | id (PK)          |
| table_id (FK)    |     | order_id (FK)    |     | order_id (FK)    |
| user_id (FK)     |     | item_id (FK)     |     | method_id (FK)   |
| order_code UNIQUE|     | variant_id (FK)? |     | amount           |
| status           |     | quantity         |     | reference_code   |
| total_amount     |     | unit_price       |     | paid_at          |
| discount_amount  |     | subtotal         |     +------------------+
| final_amount     |     | note             |
+------------------+     | status           |
                         +------------------+

+------------------+     +------------------+     +------------------+
| expense_categories|1--*|    expenses      |     |  transactions    |
|------------------|     |------------------|     |------------------|
| id (PK)          |     | id (PK)          |     | id (PK)          |
| name             |     | category_id (FK) |     | type (income/exp)|
| is_active        |     | user_id (FK)     |     | amount           |
+------------------+     | amount           |     | reference_id     |
                         | description      |     | reference_type   |
                         | occurred_at      |     | occurred_at      |
                         +------------------+     +------------------+

+------------------+     +------------------+
|      roles       |1---*|     users        |
|------------------|     |------------------|
| id (PK)          |     | id (PK)          |
| name UNIQUE      |     | role_id (FK)     |
| permissions JSON |     | username UNIQUE  |
+------------------+     | password_hash    |
                         | pin_code         |
                         | is_active        |
                         +------------------+

+------------------+     +------------------+
| payment_methods  |1---*|    settings      |
|------------------|     |------------------|
| id (PK)          |     | id (PK)          |
| name UNIQUE      |     | key UNIQUE       |
| is_active        |     | value            |
+------------------+     | description      |
                         +------------------+
```

---

## 2. ĐỊNH NGHĨA CÁC BẢNG (DDL)

### Module: Quản lý Bàn

**`floors`** — Tầng
```sql
CREATE TABLE floors (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

**`rooms`** — Phòng
```sql
CREATE TABLE rooms (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    floor_id    INTEGER NOT NULL REFERENCES floors(id) ON DELETE RESTRICT,
    name        TEXT    NOT NULL,
    description TEXT,
    capacity    INTEGER,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

**`tables`** — Bàn
```sql
CREATE TABLE tables (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    floor_id   INTEGER NOT NULL REFERENCES floors(id) ON DELETE RESTRICT,
    room_id    INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    code       TEXT    NOT NULL UNIQUE,     -- T1-B01, T2-PA-B01...
    name       TEXT    NOT NULL,
    capacity   INTEGER NOT NULL DEFAULT 4,
    status     TEXT    NOT NULL DEFAULT 'available'
               CHECK (status IN ('available','occupied','reserved','cleaning')),
    is_active  INTEGER NOT NULL DEFAULT 1,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

---

### Module: Menu

**`menu_categories`** — Danh mục thực đơn
```sql
CREATE TABLE menu_categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT,
    image_url   TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

**`menu_items`** — Món ăn
```sql
CREATE TABLE menu_items (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id   INTEGER NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
    name          TEXT    NOT NULL,
    description   TEXT,
    base_price    REAL    NOT NULL DEFAULT 0,
    image_url     TEXT,
    is_available  INTEGER NOT NULL DEFAULT 1,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

**`item_variants`** — Biến thể (size, topping...)
```sql
CREATE TABLE item_variants (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id        INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    name           TEXT    NOT NULL,        -- "Size S", "Size L", "Nóng", "Đá"
    price_modifier REAL    NOT NULL DEFAULT 0,
    is_available   INTEGER NOT NULL DEFAULT 1,
    sort_order     INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

---

### Module: Orders

**`orders`** — Đơn hàng
```sql
CREATE TABLE orders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id        INTEGER NOT NULL REFERENCES tables(id) ON DELETE RESTRICT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    order_code      TEXT    NOT NULL UNIQUE,    -- ORD-20260414-001
    status          TEXT    NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','serving','completed','cancelled')),
    note            TEXT,
    total_amount    REAL    NOT NULL DEFAULT 0,
    discount_amount REAL    NOT NULL DEFAULT 0,
    final_amount    REAL    NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

**`order_items`** — Chi tiết món trong đơn
```sql
CREATE TABLE order_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_id     INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
    variant_id  INTEGER REFERENCES item_variants(id) ON DELETE SET NULL,
    quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price  REAL    NOT NULL,   -- snapshot giá tại thời điểm gọi
    subtotal    REAL    NOT NULL,   -- quantity * unit_price
    note        TEXT,               -- "ít cay", "không hành"
    status      TEXT    NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','preparing','served','cancelled')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

---

### Module: Thanh toán

**`payment_methods`** — Phương thức thanh toán
```sql
CREATE TABLE payment_methods (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,  -- "Tiền mặt", "Chuyển khoản", "Momo"
    description TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

**`payments`** — Giao dịch thanh toán
```sql
CREATE TABLE payments (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id       INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    method_id      INTEGER NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
    amount         REAL    NOT NULL CHECK (amount > 0),
    reference_code TEXT,    -- mã giao dịch ngân hàng/ví
    note           TEXT,
    paid_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

---

### Module: Thu Chi

**`expense_categories`** — Danh mục chi phí
```sql
CREATE TABLE expense_categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

**`expenses`** — Chi phí
```sql
CREATE TABLE expenses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id  INTEGER NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount       REAL    NOT NULL CHECK (amount > 0),
    description  TEXT    NOT NULL,
    receipt_url  TEXT,
    occurred_at  TEXT    NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

**`transactions`** — Sổ cái thu chi
```sql
CREATE TABLE transactions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    type           TEXT    NOT NULL CHECK (type IN ('income','expense')),
    amount         REAL    NOT NULL CHECK (amount > 0),
    description    TEXT    NOT NULL,
    reference_id   INTEGER,       -- ID của order hoặc expense
    reference_type TEXT,          -- 'order' hoặc 'expense'
    user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
    occurred_at    TEXT    NOT NULL,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

---

### Module: Người dùng & Phân quyền

**`roles`** — Vai trò
```sql
CREATE TABLE roles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    description TEXT,
    permissions TEXT    NOT NULL DEFAULT '[]',  -- JSON array quyền
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

**`users`** — Người dùng
```sql
CREATE TABLE users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id        INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    username       TEXT    NOT NULL UNIQUE,
    full_name      TEXT    NOT NULL,
    password_hash  TEXT    NOT NULL,   -- bcrypt
    pin_code       TEXT,               -- PIN 4-6 số cho POS nhanh
    is_active      INTEGER NOT NULL DEFAULT 1,
    last_login_at  TEXT,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

---

### Module: Cấu hình

**`settings`** — Cài đặt hệ thống
```sql
CREATE TABLE settings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    key         TEXT    NOT NULL UNIQUE,
    value       TEXT    NOT NULL,
    description TEXT,
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

---

## 3. INDEXES QUAN TRỌNG

```sql
CREATE INDEX idx_tables_floor_id       ON tables(floor_id);
CREATE INDEX idx_tables_room_id        ON tables(room_id);
CREATE INDEX idx_tables_status         ON tables(status);

CREATE INDEX idx_menu_items_category   ON menu_items(category_id);
CREATE INDEX idx_menu_items_available  ON menu_items(is_available);
CREATE INDEX idx_item_variants_item    ON item_variants(item_id);

CREATE INDEX idx_orders_table_id       ON orders(table_id);
CREATE INDEX idx_orders_user_id        ON orders(user_id);
CREATE INDEX idx_orders_status         ON orders(status);
CREATE INDEX idx_orders_created_at     ON orders(created_at);
CREATE INDEX idx_order_items_order_id  ON order_items(order_id);
CREATE INDEX idx_order_items_status    ON order_items(status);

CREATE INDEX idx_payments_order_id     ON payments(order_id);
CREATE INDEX idx_payments_paid_at      ON payments(paid_at);

CREATE INDEX idx_expenses_category_id  ON expenses(category_id);
CREATE INDEX idx_expenses_occurred_at  ON expenses(occurred_at);
CREATE INDEX idx_transactions_type     ON transactions(type);
CREATE INDEX idx_transactions_date     ON transactions(occurred_at);
CREATE INDEX idx_transactions_ref      ON transactions(reference_type, reference_id);
```

---

## 4. RELATIONSHIPS & FOREIGN KEYS

| Bảng con | Cột FK | Bảng cha | ON DELETE |
|----------|--------|----------|-----------|
| rooms | floor_id | floors(id) | RESTRICT |
| tables | floor_id | floors(id) | RESTRICT |
| tables | room_id | rooms(id) | SET NULL |
| menu_items | category_id | menu_categories(id) | RESTRICT |
| item_variants | item_id | menu_items(id) | CASCADE |
| orders | table_id | tables(id) | RESTRICT |
| orders | user_id | users(id) | RESTRICT |
| order_items | order_id | orders(id) | CASCADE |
| order_items | item_id | menu_items(id) | RESTRICT |
| order_items | variant_id | item_variants(id) | SET NULL |
| payments | order_id | orders(id) | RESTRICT |
| payments | method_id | payment_methods(id) | RESTRICT |
| expenses | category_id | expense_categories(id) | RESTRICT |
| expenses | user_id | users(id) | RESTRICT |
| transactions | user_id | users(id) | SET NULL |
| users | role_id | roles(id) | RESTRICT |

> **Quan trọng với SQLite:** Bật FK mỗi khi mở kết nối: `PRAGMA foreign_keys = ON;`

**Lý do chọn ON DELETE:**
- `RESTRICT` — Không cho xóa nếu còn bản ghi con (bảo toàn lịch sử)
- `CASCADE` — Xóa theo (order_items theo orders; variants theo item)
- `SET NULL` — Giữ bản ghi con nhưng bỏ liên kết

---

## 5. SAMPLE DATA MẪU

### 5.1 Tầng, phòng, bàn

```sql
INSERT INTO floors (id, name, sort_order) VALUES
(1, 'Tầng 1', 1),
(2, 'Tầng 2', 2);

INSERT INTO rooms (id, floor_id, name, capacity, sort_order) VALUES
(1, 2, 'Phòng A', 16, 1),
(2, 2, 'Phòng B', 16, 2);

-- 6 bàn tầng 1
INSERT INTO tables (floor_id, room_id, code, name, capacity) VALUES
(1, NULL, 'T1-B01', 'Bàn 01', 4),
(1, NULL, 'T1-B02', 'Bàn 02', 4),
(1, NULL, 'T1-B03', 'Bàn 03', 4),
(1, NULL, 'T1-B04', 'Bàn 04', 4),
(1, NULL, 'T1-B05', 'Bàn 05', 6),
(1, NULL, 'T1-B06', 'Bàn 06', 6);

-- 4 bàn Phòng A tầng 2
INSERT INTO tables (floor_id, room_id, code, name, capacity) VALUES
(2, 1, 'T2-PA-B01', 'Phòng A - Bàn 01', 4),
(2, 1, 'T2-PA-B02', 'Phòng A - Bàn 02', 4),
(2, 1, 'T2-PA-B03', 'Phòng A - Bàn 03', 4),
(2, 1, 'T2-PA-B04', 'Phòng A - Bàn 04', 4);

-- 4 bàn Phòng B tầng 2
INSERT INTO tables (floor_id, room_id, code, name, capacity) VALUES
(2, 2, 'T2-PB-B01', 'Phòng B - Bàn 01', 4),
(2, 2, 'T2-PB-B02', 'Phòng B - Bàn 02', 4),
(2, 2, 'T2-PB-B03', 'Phòng B - Bàn 03', 4),
(2, 2, 'T2-PB-B04', 'Phòng B - Bàn 04', 4);
```

### 5.2 Menu mẫu

```sql
INSERT INTO menu_categories (id, name, sort_order) VALUES
(1, 'Món chính', 1), (2, 'Khai vị', 2),
(3, 'Đồ uống', 3),  (4, 'Tráng miệng', 4);

INSERT INTO menu_items (id, category_id, name, base_price, sort_order) VALUES
(1, 1, 'Cơm sườn nướng',    65000, 1),
(2, 1, 'Cơm gà xào sả ớt', 60000, 2),
(3, 1, 'Bún bò Huế',        55000, 3),
(4, 1, 'Phở bò tái nạm',    60000, 4),
(5, 2, 'Gỏi cuốn (2 cuốn)', 35000, 1),
(6, 2, 'Chả giò (4 cái)',   40000, 2),
(7, 3, 'Cà phê đen đá',     25000, 1),
(8, 3, 'Cà phê sữa đá',     30000, 2),
(9, 3, 'Trà đào cam sả',    45000, 3),
(10,3, 'Nước ngọt lon',      20000, 4),
(11,3, 'Bia Tiger lon',      35000, 5),
(12,4, 'Chè đậu xanh',      25000, 1),
(13,4, 'Kem ba màu',         30000, 2);

-- Biến thể cà phê đen
INSERT INTO item_variants (item_id, name, price_modifier, sort_order) VALUES
(7, 'Nóng', 0, 1), (7, 'Đá', 0, 2);

-- Biến thể trà đào
INSERT INTO item_variants (item_id, name, price_modifier, sort_order) VALUES
(9, 'Size M', 0, 1), (9, 'Size L', 10000, 2);
```

### 5.3 Roles & Users

```sql
INSERT INTO roles (id, name, description, permissions) VALUES
(1, 'admin',   'Chủ quán - Toàn quyền',
 '["order.view","order.create","order.edit","order.cancel","menu.manage","payment.create","payment.view","expense.manage","report.view","user.manage","setting.manage","table.manage"]'),
(2, 'cashier', 'Thu ngân',
 '["order.view","order.create","order.edit","payment.create","payment.view","menu.view","report.basic"]'),
(3, 'waiter',  'Phục vụ',
 '["order.view","order.create","order.edit","menu.view"]');

INSERT INTO users (role_id, username, full_name, password_hash, pin_code) VALUES
(1, 'admin',    'Chủ quán',     '$2b$12$placeholder_hash', '1234'),
(2, 'cashier1', 'Trần Thị B',   '$2b$12$placeholder_hash', '3456'),
(3, 'waiter1',  'Lê Văn C',     '$2b$12$placeholder_hash', '4567');
```

### 5.4 Payment Methods, Expense Categories & Settings

```sql
INSERT INTO payment_methods (name, description) VALUES
('Tiền mặt',     'Khách trả tiền mặt'),
('Chuyển khoản', 'Chuyển khoản / quét QR VietQR'),
('Momo',         'Ví điện tử Momo'),
('VNPay',        'Thanh toán VNPay');

INSERT INTO expense_categories (name) VALUES
('Nguyên vật liệu'), ('Điện - Nước'), ('Lương nhân viên'),
('Thuê mặt bằng'), ('Sửa chữa - Bảo trì'), ('Marketing'), ('Chi phí khác');

INSERT INTO settings (key, value, description) VALUES
('restaurant_name',     'Quán Ăn MyQuang',                            'Tên quán'),
('restaurant_address',  '123 Đường ABC, TP.HCM',                      'Địa chỉ'),
('restaurant_phone',    '0901234567',                                  'Số điện thoại'),
('tax_rate',            '0',                                           'Thuế suất (%)'),
('service_charge_rate', '0',                                           'Phí phục vụ (%)'),
('currency',            'VND',                                         'Đơn vị tiền tệ'),
('order_code_prefix',   'ORD',                                         'Tiền tố mã đơn'),
('receipt_footer_note', 'Cảm ơn quý khách đã dùng bữa tại MyQuang!', 'Ghi chú phiếu thu');
```

### 5.5 Vòng đời một đơn hàng hoàn chỉnh

```sql
-- 1. Tạo đơn
INSERT INTO orders (table_id, user_id, order_code, status, total_amount, final_amount)
VALUES (1, 3, 'ORD-20260414-001', 'open', 0, 0);

-- 2. Thêm món
INSERT INTO order_items (order_id, item_id, variant_id, quantity, unit_price, subtotal, status) VALUES
(1, 1, NULL, 2, 65000, 130000, 'pending'),  -- 2 cơm sườn
(1, 7, 1,    2, 25000,  50000, 'pending'),  -- 2 cà phê đen nóng
(1, 5, NULL, 1, 35000,  35000, 'pending');  -- 1 gỏi cuốn

-- 3. Cập nhật tổng đơn
UPDATE orders SET total_amount=215000, final_amount=215000,
    status='serving', updated_at=datetime('now') WHERE id=1;

-- 4. Bàn chuyển trạng thái
UPDATE tables SET status='occupied', updated_at=datetime('now') WHERE id=1;

-- 5. Bếp phục vụ xong
UPDATE order_items SET status='served', updated_at=datetime('now') WHERE order_id=1;

-- 6. Thanh toán tiền mặt
INSERT INTO payments (order_id, method_id, amount, paid_at)
VALUES (1, 1, 215000, datetime('now'));

-- 7. Hoàn tất & trả bàn
UPDATE orders SET status='completed', updated_at=datetime('now') WHERE id=1;
UPDATE tables SET status='available', updated_at=datetime('now') WHERE id=1;

-- 8. Ghi sổ cái
INSERT INTO transactions (type, amount, description, reference_id, reference_type, user_id, occurred_at)
VALUES ('income', 215000, 'Thu từ ORD-20260414-001 - Bàn T1-B01', 1, 'order', 2, datetime('now'));
```

---

## 6. MIGRATION STRATEGY

### 6.1 Lựa chọn Database

| Tiêu chí | SQLite | PostgreSQL |
|----------|--------|------------|
| Cài đặt | Không cần server | Cần cài server |
| Phù hợp | 1 POS, quán nhỏ | Nhiều POS đồng thời |
| Backup | Copy file .db | pg_dump |
| Concurrency | Giới hạn (WAL cải thiện) | Tốt |
| **Khuyến nghị** | **MVP — giai đoạn 1** | Nâng cấp khi cần |

### 6.2 Cấu trúc file migration

```
db/
├── migrations/
│   ├── 001_create_floors_rooms_tables.sql
│   ├── 002_create_menu.sql
│   ├── 003_create_roles_users.sql
│   ├── 004_create_orders.sql
│   ├── 005_create_payments.sql
│   ├── 006_create_expenses_transactions.sql
│   ├── 007_create_settings.sql
│   └── 008_seed_initial_data.sql
├── schema.sql       <- Toàn bộ DDL tổng hợp
└── myquang.db       <- File SQLite
```

### 6.3 Migration tracking

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    version    TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 6.4 SQLite PRAGMA khởi tạo (bắt buộc mỗi khi mở kết nối)

```sql
PRAGMA foreign_keys = ON;   -- Bắt buộc
PRAGMA journal_mode = WAL;  -- Hiệu năng tốt hơn
PRAGMA synchronous = NORMAL;
```

### 6.5 Backup hằng ngày

```bash
# Sao lưu
cp myquang.db "backups/myquang_$(date +%Y%m%d_%H%M%S).db"
gzip "backups/myquang_$(date +%Y%m%d)_*.db"

# Xóa backup cũ hơn 30 ngày
find backups/ -name "*.db.gz" -mtime +30 -delete
```

### 6.6 Checklist nâng cấp PostgreSQL

1. `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
2. `TEXT` datetime → `TIMESTAMPTZ`
3. `TEXT` JSON permissions → `JSONB`
4. `REAL` tiền → `NUMERIC(15,0)` (tránh floating point với VNĐ)
5. Bỏ `PRAGMA` statements
6. Dùng `pg_dump` / `pg_restore` để backup

---

## PHỤ LỤC: Quy tắc đặt tên

| Loại | Quy tắc | Ví dụ |
|------|---------|-------|
| Tên bảng | snake_case, số nhiều | `menu_items`, `order_items` |
| Tên cột | snake_case | `category_id`, `base_price` |
| FK | `{bảng_tham_chiếu}_id` | `table_id`, `user_id` |
| Index | `idx_{bảng}_{cột}` | `idx_orders_status` |
| Boolean | `is_*`, kiểu INTEGER 0/1 | `is_active`, `is_available` |
| Timestamp | `*_at`, ISO 8601 TEXT | `created_at`, `paid_at` |
| Enum | TEXT + CHECK constraint | `status IN ('open','done')` |
| Mã code | Chữ hoa, dấu gạch ngang | `T1-B01`, `ORD-20260414-001` |
