# 05 - Dashboard & Reports Specification
# Hệ thống Báo cáo & Dashboard - Quán Mỳ Quảng

**Phiên bản:** 1.0  
**Ngày cập nhật:** 2026-04-14  
**Phạm vi:** Single-tenant | Tầng 1 (6 bàn) + Tầng 2 Phòng A (4 bàn) + Tầng 2 Phòng B (4 bàn) = 14 bàn tổng  

---

## MỤC LỤC

1. [Dashboard Chính (Real-time)](#1-dashboard-chính-real-time)
2. [Báo cáo Doanh thu](#2-báo-cáo-doanh-thu)
3. [Báo cáo Món ăn](#3-báo-cáo-món-ăn)
4. [Báo cáo Thu Chi](#4-báo-cáo-thu-chi)
5. [Báo cáo Hiệu suất](#5-báo-cáo-hiệu-suất)
6. [Export & In báo cáo](#6-export--in-báo-cáo)
7. [Phụ lục: Công thức & Định nghĩa](#7-phụ-lục-công-thức--định-nghĩa)

---

## 1. Dashboard Chính (Real-time)

> Mục tiêu: Cho chủ quán/quản lý thấy ngay tình trạng kinh doanh trong ngày mà không cần tra báo cáo.  
> Tần suất làm mới: Tự động cập nhật mỗi **30 giây**.

---

### 1.1 Tổng quan Ngày hôm nay (Today Summary Cards)

Hiển thị dưới dạng **4 thẻ số liệu (KPI Cards)** nằm ngang đầu trang.

| Thẻ | Tên hiển thị | Công thức / Nguồn dữ liệu | Định dạng |
|-----|-------------|--------------------------|-----------|
| 1 | Doanh thu hôm nay | `SUM(hoa_don.tong_tien)` WHERE `ngay_thanh_toan = TODAY()` AND `trang_thai = 'da_thanh_toan'` | `xxx.xxx đ` |
| 2 | Số hóa đơn | `COUNT(hoa_don.id)` WHERE điều kiện trên | `xx hóa đơn` |
| 3 | Khách trung bình / bàn | `SUM(hoa_don.tong_tien) / COUNT(DISTINCT ban_id)` trong ngày | `xx.xxx đ / bàn` |
| 4 | Số bàn đang có khách | `COUNT(ban)` WHERE `trang_thai = 'co_khach'` tại thời điểm hiện tại | `x / 14 bàn` |

**So sánh nhanh:** Mỗi thẻ hiển thị thêm mũi tên so sánh với cùng ngày tuần trước:
- Mũi tên xanh lên: tăng trưởng dương
- Mũi tên đỏ xuống: giảm so với tuần trước
- Công thức: `((Hôm nay - Cùng ngày tuần trước) / Cùng ngày tuần trước) * 100%`

---

### 1.2 Sơ đồ Trạng thái Bàn Live (Table Status Map)

Hiển thị dạng **sơ đồ mặt bằng (Floor Plan View)** — trực quan nhất cho nhân viên.

**Layout:**

```
[ TẦNG 1 ]                          [ TẦNG 2 - PHÒNG A ]  [ TẦNG 2 - PHÒNG B ]
+------+ +------+ +------+          +------+ +------+      +------+ +------+
| B01  | | B02  | | B03  |          | A01  | | A02  |      | B01  | | B02  |
+------+ +------+ +------+          +------+ +------+      +------+ +------+
+------+ +------+ +------+          +------+ +------+      +------+ +------+
| B04  | | B05  | | B06  |          | A03  | | A04  |      | B03  | | B04  |
+------+ +------+ +------+          +------+ +------+      +------+ +------+
```

**Màu sắc trạng thái bàn:**

| Màu | Trạng thái | Mô tả |
|-----|-----------|-------|
| Xanh lá | Trống | Bàn sẵn sàng phục vụ |
| Đỏ | Có khách | Đang phục vụ, có order đang mở |
| Vàng | Chờ thanh toán | Khách đã gọi bill, chưa thanh toán xong |
| Xám | Đặt trước | Bàn đã được đặt, chưa đến giờ |

**Thông tin tooltip khi hover/click vào bàn:**
- Tên bàn, tầng/phòng
- Thời gian khách ngồi (vd: `45 phút`)
- Tổng tiền tạm tính hiện tại
- Số lượng món đã order / đang chờ bếp

---

### 1.3 Top Món Bán Chạy Hôm Nay

Hiển thị dạng **Horizontal Bar Chart** (thanh ngang), top 5 món.

**Dữ liệu:**
```sql
SELECT 
    mon_an.ten_mon,
    SUM(chi_tiet_order.so_luong) AS tong_so_luong,
    SUM(chi_tiet_order.so_luong * chi_tiet_order.don_gia) AS tong_doanh_thu
FROM chi_tiet_order
JOIN order ON order.id = chi_tiet_order.order_id
JOIN mon_an ON mon_an.id = chi_tiet_order.mon_an_id
WHERE DATE(order.thoi_gian_tao) = TODAY()
  AND order.trang_thai != 'huy'
GROUP BY mon_an.id
ORDER BY tong_so_luong DESC
LIMIT 5
```

**Hiển thị mỗi dòng:**
- Tên món
- Số lượng bán (thanh ngang)
- Doanh thu từ món đó (label cuối thanh)

---

### 1.4 Biểu đồ Doanh thu Theo Giờ (Hourly Revenue Chart)

**Loại chart:** Line Chart hoặc Bar Chart theo giờ trong ngày.

**Trục X:** Các khung giờ trong ngày hoạt động (ví dụ: 06:00 - 22:00, chia mỗi 1 tiếng).  
**Trục Y:** Doanh thu (đồng).

**Công thức:**
```sql
SELECT 
    HOUR(hoa_don.thoi_gian_thanh_toan) AS gio,
    SUM(hoa_don.tong_tien) AS doanh_thu
FROM hoa_don
WHERE DATE(thoi_gian_thanh_toan) = TODAY()
  AND trang_thai = 'da_thanh_toan'
GROUP BY gio
ORDER BY gio
```

**Tính năng bổ sung:**
- Đường baseline: Doanh thu trung bình cùng giờ trong 7 ngày trước (đường đứt nét)
- Highlight khung giờ hiện tại
- Tooltip chi tiết khi hover: số hóa đơn + doanh thu trong giờ đó

---

### 1.5 Alerts & Cảnh báo

Hiển thị dưới dạng **danh sách thông báo** ở góc phải hoặc panel riêng. Mỗi alert có icon, màu, và nút xử lý nhanh.

| Loại Alert | Điều kiện kích hoạt | Mức độ | Hành động nhanh |
|-----------|---------------------|--------|----------------|
| Bàn chờ lâu | Bàn có khách > 90 phút mà tổng tiền < 50.000đ (nghi chưa order) | Vàng - Cảnh báo | Xem chi tiết bàn |
| Order chưa xử lý | Có order_item gửi bếp > 15 phút mà chưa chuyển sang `dang_nau` | Đỏ - Khẩn | Chuyển sang bếp |
| Bàn chờ thanh toán | Bàn ở trạng thái `cho_thanh_toan` > 10 phút | Vàng | Mở màn hình thanh toán |
| Hết giờ đặt trước | Bàn đặt trước đến giờ nhưng khách chưa đến (quá 15 phút) | Xanh - Thông báo | Hủy đặt / Giữ thêm |

**Cài đặt ngưỡng alert:** Quản lý có thể tùy chỉnh các ngưỡng thời gian trên trong phần Cài đặt.

---

## 2. Báo cáo Doanh thu

> Truy cập: Menu Báo cáo > Doanh thu  
> Mặc định hiển thị: 30 ngày gần nhất

---

### 2.1 Bộ lọc chung (Filters)

Áp dụng cho toàn bộ trang báo cáo doanh thu:

| Filter | Loại | Giá trị mặc định | Lựa chọn |
|--------|------|-----------------|----------|
| Khoảng thời gian | Date Range Picker | 30 ngày gần nhất | Hôm nay / Tuần này / Tháng này / Tháng trước / Quý này / Năm nay / Tùy chỉnh |
| Kỳ so sánh | Dropdown | Cùng kỳ trước | Không so sánh / Cùng kỳ trước / Tùy chỉnh |
| Phương thức thanh toán | Multi-select | Tất cả | Tiền mặt / Chuyển khoản / Ví điện tử |
| Vị trí | Multi-select | Tất cả | Tầng 1 / Tầng 2 - Phòng A / Tầng 2 - Phòng B |

---

### 2.2 Doanh thu Theo Ngày / Tuần / Tháng / Năm

**Loại chart:** Bar Chart (chuyển đổi được giữa các mốc thời gian)

**Tab chuyển đổi:** `Theo ngày` | `Theo tuần` | `Theo tháng` | `Theo năm`

**Dữ liệu hiển thị trên chart:**
- Cột chính (xanh): Doanh thu kỳ hiện tại
- Cột phụ (xám nhạt hoặc đường line): Doanh thu cùng kỳ trước
- Label trên cột: Giá trị doanh thu

**Bảng dữ liệu bên dưới chart:**

| Ngày/Tuần/Tháng | Doanh thu | Số HĐ | Giá trị TB/HĐ | So cùng kỳ (±%) |
|----------------|-----------|-------|--------------|----------------|
| 01/04/2026 | 3.250.000đ | 18 | 180.556đ | +12% |
| 02/04/2026 | 2.800.000đ | 15 | 186.667đ | -5% |

**Công thức các cột:**
- `Giá trị TB/HĐ = Doanh thu / Số hóa đơn`
- `So cùng kỳ (%) = ((Kỳ hiện tại - Cùng kỳ trước) / Cùng kỳ trước) * 100`

---

### 2.3 Doanh thu Theo Tầng / Phòng / Bàn

**Loại chart:** Pie Chart (tổng quan % theo khu vực) + Bảng chi tiết theo bàn

**Pie Chart — phân bổ doanh thu theo khu:**
- Tầng 1 (6 bàn)
- Tầng 2 Phòng A (4 bàn)
- Tầng 2 Phòng B (4 bàn)

**Bảng chi tiết theo bàn (drill-down):**

| Khu vực | Bàn | Doanh thu | Số lượt | Doanh thu TB/lượt | % Tổng DT |
|---------|-----|-----------|---------|-------------------|-----------|
| Tầng 1 | Bàn 01 | 1.200.000đ | 7 | 171.429đ | 8,5% |
| Tầng 1 | Bàn 02 | 980.000đ | 6 | 163.333đ | 6,9% |
| ... | ... | ... | ... | ... | ... |

**Lưu ý tính doanh thu theo bàn:**
- Dựa vào `ban_id` tại thời điểm tạo hóa đơn (một order gắn với một bàn cụ thể)
- Nếu khách chuyển bàn giữa chừng, tính theo bàn cuối cùng khi thanh toán

---

### 2.4 Doanh thu Theo Phương thức Thanh toán

**Loại chart:** Donut Chart

**Dữ liệu:**
```sql
SELECT 
    phuong_thuc_thanh_toan,
    COUNT(*) AS so_hoa_don,
    SUM(tong_tien) AS tong_doanh_thu,
    ROUND(SUM(tong_tien) * 100.0 / (SELECT SUM(tong_tien) FROM hoa_don WHERE ...), 1) AS phan_tram
FROM hoa_don
WHERE trang_thai = 'da_thanh_toan'
  AND [bộ lọc thời gian]
GROUP BY phuong_thuc_thanh_toan
```

**Hiển thị:**
| Phương thức | Số HĐ | Doanh thu | Tỷ lệ |
|-------------|-------|-----------|-------|
| Tiền mặt | 85 | 12.500.000đ | 62% |
| Chuyển khoản | 40 | 6.800.000đ | 34% |
| Ví điện tử | 5 | 700.000đ | 4% |

---

### 2.5 Biểu đồ Xu hướng Doanh thu

**Loại chart:** Line Chart với nhiều dòng

**Dòng 1:** Doanh thu thực tế (màu xanh đậm)  
**Dòng 2:** Đường trung bình động 7 ngày — Moving Average (màu cam đứt nét)  
**Dòng 3 (tùy chọn):** Mục tiêu doanh thu ngày (nếu quản lý cài đặt target) — đường đỏ ngang

**Công thức Moving Average 7 ngày:**
```
MA7(ngày N) = (DT(N) + DT(N-1) + ... + DT(N-6)) / 7
```

---

## 3. Báo cáo Món ăn

> Truy cập: Menu Báo cáo > Món ăn  
> Bộ lọc: Khoảng thời gian + Danh mục món ăn

---

### 3.1 Top Món Bán Chạy

**Loại chart:** Horizontal Bar Chart, có thể chuyển sang dạng bảng

**Bộ lọc riêng:**
- Khoảng thời gian
- Danh mục (Món chính / Khai vị / Tráng miệng / Đồ uống / ...)
- Top N: 5 / 10 / 20 / Tất cả

**Bảng dữ liệu:**

| Hạng | Tên món | Danh mục | SL bán | Doanh thu | Tỷ lệ DT | SL TB/ngày |
|------|---------|----------|--------|-----------|----------|------------|
| 1 | Mỳ Quảng đặc biệt | Món chính | 320 | 9.600.000đ | 28% | 10,7 |
| 2 | Mỳ Quảng tôm thịt | Món chính | 280 | 7.000.000đ | 21% | 9,3 |
| 3 | Trà đá | Đồ uống | 450 | 2.250.000đ | 7% | 15,0 |

**Công thức:**
- `SL TB/ngày = Tổng số lượng / Số ngày trong kỳ`
- `Tỷ lệ DT = Doanh thu món / Tổng doanh thu tất cả món * 100%`

---

### 3.2 Món Ít Bán Nhất

**Loại chart:** Bảng đơn giản, highlight màu vàng nhạt các hàng có `SL bán = 0`

**Mục đích:** Giúp chủ quán quyết định có nên tiếp tục giữ món trong thực đơn hay không.

**Bảng dữ liệu:**

| Tên món | Danh mục | SL bán | Ngày bán cuối | Ghi chú |
|---------|----------|--------|--------------|---------|
| Mỳ Quảng chay | Món chính | 3 | 15/03/2026 | Xem xét bỏ thực đơn |
| Chè thập cẩm | Tráng miệng | 0 | - | Chưa có lượt bán |

**Ngưỡng cảnh báo:**
- Không có lượt bán trong 14 ngày: Highlight vàng
- Không có lượt bán trong 30 ngày: Highlight đỏ

---

### 3.3 Doanh thu Theo Danh mục Món ăn

**Loại chart:** Stacked Bar Chart theo tháng (mỗi cột là 1 tháng, các màu khác nhau = các danh mục)

**Kết hợp:** Pie Chart tổng tỷ lệ trong kỳ được chọn

**Bảng:**

| Danh mục | Tháng 3 | Tháng 4 | Tổng | Tỷ lệ |
|----------|---------|---------|------|-------|
| Món chính | 18.500.000đ | 12.300.000đ | 30.800.000đ | 72% |
| Đồ uống | 4.200.000đ | 2.800.000đ | 7.000.000đ | 16% |
| Khai vị | 2.100.000đ | 1.400.000đ | 3.500.000đ | 8% |
| Tráng miệng | 850.000đ | 580.000đ | 1.430.000đ | 4% |

---

### 3.4 Tỷ lệ Hủy Món

**Loại chart:** Bar Chart theo ngày/tuần + bảng chi tiết theo món

**Công thức:**
```
Tỷ lệ hủy (%) = (Số lượng món bị hủy / Tổng số lượng món được order) * 100
```

**Bảng tổng hợp:**

| Kỳ | Tổng SL order | SL bị hủy | Tỷ lệ hủy | Lý do hủy phổ biến |
|----|--------------|-----------|-----------|-------------------|
| Tuần 1/4 | 850 | 23 | 2,7% | Hết nguyên liệu: 13, Khách đổi ý: 10 |

**Bảng chi tiết theo món:**

| Tên món | SL order | SL hủy | Tỷ lệ hủy | Lý do chính |
|---------|----------|--------|-----------|-------------|
| Mỳ Quảng gà | 120 | 8 | 6,7% | Hết nguyên liệu |

**Lý do hủy cần ghi nhận khi hủy món:** Hết nguyên liệu / Khách đổi ý / Nhầm order / Lý do khác

---

## 4. Báo cáo Thu Chi

> Truy cập: Menu Báo cáo > Thu Chi  
> Bộ lọc: Tháng / Quý / Năm (không lọc theo ngày vì chi phí thường ghi theo đợt)

---

### 4.1 Tổng Thu vs Tổng Chi

**Loại chart:** Grouped Bar Chart — mỗi nhóm gồm 2 cột (Thu màu xanh, Chi màu đỏ)

**Trục X:** Tháng trong năm  
**Trục Y:** Số tiền (đồng)

**Số liệu tổng hợp (KPI Cards):**

| Chỉ số | Công thức | Ví dụ |
|--------|-----------|-------|
| Tổng thu | `SUM(hoa_don.tong_tien)` WHERE kỳ được chọn | 42.500.000đ |
| Tổng chi | `SUM(chi_phi.so_tien)` WHERE kỳ được chọn | 28.300.000đ |
| Lợi nhuận gộp | `Tổng thu - Tổng chi` | 14.200.000đ |
| Biên lợi nhuận | `(Lợi nhuận / Tổng thu) * 100%` | 33,4% |

---

### 4.2 Lợi nhuận Gộp Theo Kỳ

**Loại chart:** Line Chart — đường lợi nhuận gộp theo tháng, có thể kết hợp với cột doanh thu

**Bảng:**

| Tháng | Doanh thu | Tổng chi | Lợi nhuận | Biên LN |
|-------|-----------|----------|-----------|---------|
| T1/2026 | 38.000.000đ | 26.500.000đ | 11.500.000đ | 30,3% |
| T2/2026 | 32.000.000đ | 24.000.000đ | 8.000.000đ | 25,0% |
| T3/2026 | 42.500.000đ | 28.300.000đ | 14.200.000đ | 33,4% |

**Lưu ý:** Lợi nhuận ở đây là **lợi nhuận gộp** (chưa trừ thuế, lương tháng nếu hạch toán riêng). Quán nhỏ thường gộp lương vào chi phí vận hành.

---

### 4.3 Chi phí Theo Danh mục

**Loại chart:** Pie Chart / Donut Chart

**Các danh mục chi phí chuẩn cho quán ăn nhỏ:**

| Danh mục | Ví dụ chi tiết | Tỷ lệ điển hình |
|----------|---------------|----------------|
| Nguyên vật liệu | Thịt, hải sản, rau củ, gia vị | 35–45% |
| Nhân công | Lương nhân viên phục vụ, bếp | 20–25% |
| Thuê mặt bằng | Tiền thuê nhà/mặt bằng tháng | 10–15% |
| Điện nước | Hóa đơn điện, nước hàng tháng | 5–8% |
| Bao bì vật tư | Hộp mang về, khăn giấy, đũa | 3–5% |
| Marketing | In ấn, mạng xã hội, khuyến mãi | 2–3% |
| Chi phí khác | Sửa chữa, phí dịch vụ, tạp vụ | 5–10% |

**Màu sắc trên Pie Chart:** Mỗi danh mục một màu cố định, có legend bên phải.

---

### 4.4 Cashflow Hàng Tháng

**Loại chart:** Waterfall Chart (biểu đồ thác nước) — trực quan nhất cho dòng tiền

**Các cột trong Waterfall Chart:**
1. Số dư đầu tháng (baseline)
2. (+) Doanh thu tháng
3. (-) Chi phí nguyên vật liệu
4. (-) Chi phí nhân công
5. (-) Tiền thuê mặt bằng
6. (-) Điện nước
7. (-) Chi phí khác
8. = Số dư cuối tháng

**Bảng Cashflow:**

| Hạng mục | Tháng 3 | Tháng 4 | Ghi chú |
|----------|---------|---------|---------|
| Số dư đầu kỳ | 8.000.000đ | 14.200.000đ | |
| + Doanh thu | +42.500.000đ | +38.000.000đ | |
| - Nguyên vật liệu | -16.000.000đ | -14.500.000đ | ~38% doanh thu |
| - Nhân công | -7.000.000đ | -7.000.000đ | Cố định |
| - Thuê mặt bằng | -4.000.000đ | -4.000.000đ | Cố định |
| - Điện nước | -1.800.000đ | -1.600.000đ | |
| - Chi phí khác | -1.300.000đ | -1.200.000đ | |
| **Số dư cuối kỳ** | **14.200.000đ** | **18.700.000đ** | |

---

## 5. Báo cáo Hiệu suất

> Truy cập: Menu Báo cáo > Hiệu suất  
> Giúp quản lý tối ưu lịch nhân viên, bố trí bàn, và cải thiện chất lượng phục vụ

---

### 5.1 Giờ Cao Điểm — Heatmap

**Loại chart:** Heatmap (ma trận nhiệt) — trục X là giờ trong ngày, trục Y là thứ trong tuần

**Kích thước:** 7 hàng (Thứ 2 → CN) × 16 cột (7:00 → 22:00, mỗi cột 1 tiếng)

**Màu sắc:**
- Xanh nhạt → Đỏ đậm: Tương ứng ít khách → nhiều khách (hoặc doanh thu thấp → cao)
- Giá trị trong ô: Số hóa đơn hoặc doanh thu trung bình

**Công thức giá trị ô:**
```sql
SELECT 
    DAYOFWEEK(thoi_gian_thanh_toan) AS thu,   -- 1=CN, 2=T2, ..., 7=T7
    HOUR(thoi_gian_thanh_toan) AS gio,
    COUNT(*) AS so_hoa_don,
    AVG(tong_tien) AS doanh_thu_tb
FROM hoa_don
WHERE trang_thai = 'da_thanh_toan'
  AND [bộ lọc khoảng thời gian - khuyến nghị >= 4 tuần]
GROUP BY thu, gio
```

**Ứng dụng thực tế:** Xác định cần tăng nhân viên vào khung giờ nào, thứ nào.

---

### 5.2 Thời gian Trung bình Phục vụ

**Định nghĩa các mốc thời gian:**

| Chỉ số | Công thức | Ý nghĩa |
|--------|-----------|---------|
| T1: Thời gian nhận order | `thoi_gian_order - thoi_gian_khach_ngoi` | Khách chờ nhân viên đến ghi order |
| T2: Thời gian chờ món | `thoi_gian_mon_ra - thoi_gian_order` | Khách chờ từ lúc gọi đến khi có món |
| T3: Thời gian ăn | `thoi_gian_goi_bill - thoi_gian_mon_ra_dau_tien` | Ước tính thời gian khách dùng bữa |
| T4: Thời gian thanh toán | `thoi_gian_thanh_toan - thoi_gian_goi_bill` | Chờ thanh toán |
| Tổng thời gian phục vụ | `T1 + T2 + T3 + T4` | Từ lúc ngồi đến lúc ra về |

**Loại chart:** Bar Chart nhóm theo ca (Sáng / Trưa / Chiều / Tối) hoặc theo ngày trong tuần

**Bảng:**

| Ca | T2 (chờ món) TB | Tổng TB | Bàn quay vòng TB/ngày |
|----|----------------|---------|----------------------|
| Sáng (7-11h) | 8 phút | 35 phút | 4 lượt |
| Trưa (11-14h) | 12 phút | 42 phút | 5 lượt |
| Chiều (14-17h) | 7 phút | 30 phút | 2 lượt |
| Tối (17-22h) | 15 phút | 55 phút | 3 lượt |

**Lưu ý thực tế:** Cần ghi nhận `thoi_gian_khach_ngoi` lúc nhân viên mở bàn và `thoi_gian_thanh_toan` lúc hoàn tất. Các mốc giữa dựa vào timestamp của order và hóa đơn.

---

### 5.3 Công suất Sử dụng Bàn (Table Utilization)

**Công thức:**
```
Công suất sử dụng (%) = (Số giờ bàn có khách / Tổng số giờ mở cửa) * 100

Ví dụ:
- Quán mở 15 tiếng/ngày (7:00 - 22:00)
- Bàn 01 có khách tổng 9 tiếng trong ngày
- Công suất Bàn 01 = 9/15 * 100 = 60%
```

**Công suất trung bình toàn quán:**
```
Công suất TB = Trung bình cộng công suất của tất cả 14 bàn
```

**Loại chart:** Horizontal Bar Chart — mỗi dòng là 1 bàn, độ dài thanh = % công suất

**Màu sắc ngưỡng:**
- Xanh lá: 60–80% (tối ưu)
- Vàng: 40–60% (còn dư địa)
- Đỏ: < 40% (khai thác kém)
- Tím: > 80% (quá tải, cần xem xét tăng bàn hoặc giảm thời gian phục vụ)

**Bảng theo khu vực:**

| Khu vực | Số bàn | Công suất TB | So tuần trước |
|---------|--------|-------------|--------------|
| Tầng 1 | 6 | 65% | +3% |
| Tầng 2 - Phòng A | 4 | 72% | +8% |
| Tầng 2 - Phòng B | 4 | 58% | -2% |
| **Toàn quán** | **14** | **65%** | **+3%** |

---

### 5.4 Revenue per Table per Day (RevPTD)

**Công thức:**
```
RevPTD = Tổng doanh thu trong kỳ / (Số bàn * Số ngày trong kỳ)

Ví dụ (tháng có 30 ngày, 14 bàn):
RevPTD = 42.500.000 / (14 * 30) = 101.190 đ/bàn/ngày
```

**Loại chart:** Line Chart theo tháng — đường RevPTD tổng quán + đường mục tiêu (nếu cài)

**Breakdown RevPTD theo khu vực:**

| Khu vực | Số bàn | Tổng DT kỳ | RevPTD | Đánh giá |
|---------|--------|-----------|--------|---------|
| Tầng 1 | 6 | 21.000.000đ | 116.667đ | Cao nhất |
| Phòng A | 4 | 13.000.000đ | 108.333đ | Tốt |
| Phòng B | 4 | 8.500.000đ | 70.833đ | Cần cải thiện |

**Ứng dụng:** So sánh RevPTD giữa các khu vực để quyết định phân bổ nhân viên, trang trí, hoặc điều chỉnh menu khuyến mãi cho khu kém hiệu suất.

---

## 6. Export & In báo cáo

---

### 6.1 Export PDF

**Áp dụng cho:** Tất cả các trang báo cáo

**Cách thực hiện:** Nút `[Xuất PDF]` ở góc phải trên mỗi trang báo cáo

**Nội dung file PDF bao gồm:**
- Header: Logo quán, tên báo cáo, khoảng thời gian, ngày xuất
- Các KPI Cards (dạng bảng trong PDF)
- Biểu đồ (render thành ảnh PNG trước khi nhúng vào PDF)
- Bảng dữ liệu chi tiết
- Footer: "Xuất ngày [datetime] bởi [tên người dùng]"

**Thư viện gợi ý:** `jsPDF` + `html2canvas` (frontend) hoặc `Puppeteer` / `wkhtmltopdf` (backend render)

**Kích thước giấy:** A4, chiều dọc (Portrait). Nếu bảng quá rộng, tự động chuyển A4 ngang (Landscape).

---

### 6.2 Export Excel

**Áp dụng cho:** Tất cả các trang báo cáo có bảng dữ liệu

**Cách thực hiện:** Nút `[Xuất Excel]` bên cạnh nút xuất PDF

**Cấu trúc file Excel (.xlsx):**
- Sheet 1: `Tổng quan` — các KPI Cards dạng bảng đơn giản
- Sheet 2: `Chi tiết` — toàn bộ dữ liệu thô của báo cáo
- Sheet 3: `Biểu đồ` — nếu thư viện hỗ trợ nhúng chart (tùy chọn)

**Header mỗi sheet:**
- Dòng 1: Tên quán
- Dòng 2: Tên báo cáo + khoảng thời gian
- Dòng 3: Ngày xuất
- Dòng 4: Trống (separator)
- Dòng 5 trở đi: Dữ liệu với header cột

**Định dạng số trong Excel:**
- Tiền tệ: `#,##0` (không thêm đ, để người dùng tự thêm đơn vị nếu cần)
- Phần trăm: `0.0%`
- Ngày: `DD/MM/YYYY`

**Thư viện gợi ý:** `SheetJS (xlsx)` cho frontend, hoặc `openpyxl` / `ExcelJS` nếu xử lý ở backend.

---

### 6.3 In Báo cáo Cuối Ngày

**Trigger:** Nút `[In báo cáo ngày]` hoặc tự động vào cuối ngày (nếu cài lịch tự động)

**Nội dung báo cáo cuối ngày (in nhiệt hoặc A4):**

```
================================================
        BÁO CÁO CUỐI NGÀY
        Quán Mỳ Quảng - [Tên quán]
        Ngày: [DD/MM/YYYY]
        In lúc: [HH:MM]
================================================

TỔNG KẾT DOANH THU
-------------------
Tổng doanh thu:          xx.xxx.xxxđ
Số hóa đơn:              xx hóa đơn
Giá trị TB/hóa đơn:      xxx.xxxđ
Số bàn phục vụ:          xx / 14 bàn

PHÂN THEO THANH TOÁN
-------------------
Tiền mặt:    xx.xxx.xxxđ  (xx%)
Chuyển khoản: xx.xxx.xxxđ (xx%)
Ví điện tử:  xx.xxx.xxxđ  (xx%)

TOP 5 MÓN BÁN CHẠY
-------------------
1. [Tên món]     - xxx suất - xx.xxx.xxxđ
2. [Tên món]     - xxx suất - xx.xxx.xxxđ
3. [Tên món]     - xxx suất - xx.xxx.xxxđ
4. [Tên món]     - xxx suất - xx.xxx.xxxđ
5. [Tên món]     - xxx suất - xx.xxx.xxxđ

DOANH THU THEO GIỜ
-------------------
07-08h: xxx.xxxđ
08-09h: xxx.xxxđ
...
21-22h: xxx.xxxđ

================================================
         Cảm ơn! Hẹn gặp lại!
================================================
```

---

### 6.4 In Báo cáo Cuối Tháng

**Nội dung báo cáo tháng (A4, nhiều trang):**
- Trang 1: Tổng quan tháng (KPIs, so sánh tháng trước)
- Trang 2: Doanh thu theo ngày (bảng)
- Trang 3: Top món bán chạy
- Trang 4: Thu chi tóm tắt + Lợi nhuận
- Trang 5: Hiệu suất bàn (nếu cần)

---

### 6.5 Lọc Theo Khoảng Thời gian Tùy chỉnh

**Component:** Date Range Picker với các preset nhanh

**Preset nhanh:**

| Label | Từ ngày | Đến ngày |
|-------|---------|---------|
| Hôm nay | TODAY | TODAY |
| Hôm qua | TODAY-1 | TODAY-1 |
| 7 ngày qua | TODAY-6 | TODAY |
| Tuần này | Thứ 2 tuần này | TODAY |
| Tuần trước | Thứ 2 tuần trước | CN tuần trước |
| Tháng này | 01/MM/YYYY | TODAY |
| Tháng trước | 01/MM-1/YYYY | Ngày cuối tháng trước |
| Quý này | Ngày đầu quý | TODAY |
| Năm nay | 01/01/YYYY | TODAY |
| Tùy chỉnh | [Date picker] | [Date picker] |

**Validation:**
- Ngày bắt đầu không được lớn hơn ngày kết thúc
- Khoảng thời gian tối đa khi xuất Excel: 365 ngày (để tránh file quá lớn)
- Khoảng thời gian tối đa khi xem chart: không giới hạn, nhưng tự động gom nhóm (> 90 ngày thì hiển thị theo tuần, > 365 ngày thì hiển thị theo tháng)

---

## 7. Phụ lục: Công thức & Định nghĩa

### 7.1 Định nghĩa Trạng thái

| Đối tượng | Trạng thái | Mô tả |
|-----------|-----------|-------|
| Bàn | `trong` | Không có khách, sẵn sàng |
| Bàn | `co_khach` | Đang có order mở, chưa thanh toán |
| Bàn | `cho_thanh_toan` | Đã gọi bill, đang xử lý thanh toán |
| Bàn | `dat_truoc` | Được đặt trước, chưa đến giờ |
| Hóa đơn | `da_thanh_toan` | Hoàn tất, tính vào doanh thu |
| Hóa đơn | `huy` | Bị hủy, không tính doanh thu |
| Order item | `cho_bep` | Gửi bếp, chưa chế biến |
| Order item | `dang_nau` | Đang chế biến |
| Order item | `da_ra_mon` | Đã phục vụ cho khách |
| Order item | `huy` | Bị hủy |

### 7.2 Công thức Tổng hợp

| Tên chỉ số | Công thức |
|-----------|-----------|
| Doanh thu thuần | `SUM(hoa_don.tong_tien)` WHERE `trang_thai = 'da_thanh_toan'` |
| Giá trị TB/hóa đơn | `Doanh thu thuần / Số hóa đơn` |
| Tăng trưởng (%) | `(Kỳ hiện tại - Kỳ trước) / Kỳ trước * 100` |
| Công suất bàn (%) | `Giờ có khách / Giờ mở cửa * 100` |
| RevPTD | `Doanh thu / (Số bàn * Số ngày)` |
| Tỷ lệ hủy món (%) | `SL hủy / Tổng SL order * 100` |
| Biên lợi nhuận (%) | `Lợi nhuận gộp / Doanh thu * 100` |
| Moving Average 7 ngày | `Trung bình cộng 7 giá trị liên tiếp` |

### 7.3 Quy tắc Tính Doanh thu

1. **Chỉ tính hóa đơn `da_thanh_toan`** — hóa đơn hủy không được tính
2. **Giảm giá:** `Tổng tiền = Tổng giá gốc - Giảm giá` — doanh thu ghi nhận sau giảm giá
3. **Thời gian ghi nhận:** Theo `thoi_gian_thanh_toan`, không phải thời gian tạo order
4. **Đơn vị tiền tệ:** Tất cả đều là VND, không có phân xu

### 7.4 Gợi ý Cấu trúc Bảng Cần Thiết

Để chạy được tất cả báo cáo trên, cần đảm bảo các bảng CSDL có đủ các cột:

```
ban: id, ten_ban, khu_vuc (tang1/tang2a/tang2b), so_ghe, trang_thai
order: id, ban_id, nhan_vien_id, thoi_gian_tao, trang_thai, ghi_chu
order_item: id, order_id, mon_an_id, so_luong, don_gia, trang_thai, ly_do_huy, thoi_gian_tao, thoi_gian_cap_nhat
mon_an: id, ten_mon, danh_muc_id, gia_ban, trang_thai
danh_muc: id, ten_danh_muc
hoa_don: id, order_id, ban_id, tong_tien_goc, giam_gia, tong_tien, phuong_thuc_thanh_toan, thoi_gian_thanh_toan, trang_thai, nhan_vien_id
chi_phi: id, danh_muc_chi_phi, so_tien, ngay_chi, mo_ta, nguoi_nhap
```

---

*Tài liệu này là đặc tả kỹ thuật cho team phát triển. Mọi thay đổi về nghiệp vụ cần được xác nhận với chủ quán trước khi cập nhật spec.*
