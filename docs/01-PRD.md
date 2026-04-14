# Product Requirements Document (PRD)
# Hệ thống Quản lý Quán Ăn — MyQuang

**Phiên bản:** 1.0
**Ngày:** 14/04/2026
**Trạng thái:** Draft

---

## Mục lục

1. [Tổng quan sản phẩm & Mục tiêu](#1-tổng-quan-sản-phẩm--mục-tiêu)
2. [Đối tượng người dùng](#2-đối-tượng-người-dùng)
3. [User Stories theo từng Role](#3-user-stories-theo-từng-role)
4. [Danh sách tính năng theo Module](#4-danh-sách-tính-năng-theo-module)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Scope & Out of Scope](#6-scope--out-of-scope)
7. [Constraints & Assumptions](#7-constraints--assumptions)

---

## 1. Tổng quan sản phẩm & Mục tiêu

### 1.1 Mô tả sản phẩm

**MyQuang** là một web application quản lý quán ăn dành riêng cho một cơ sở kinh doanh duy nhất (single-tenant). Hệ thống hỗ trợ toàn bộ quy trình vận hành hàng ngày: từ quản lý bàn, ghi nhận order, tính tiền, đến theo dõi thu chi và báo cáo kinh doanh.

**Cấu trúc quán:**
- **Tầng 1:** 6 bàn ăn (T1-B01 đến T1-B06)
- **Tầng 2:** 2 phòng riêng biệt
  - Phòng A: 4 bàn (T2-PA-B01 đến T2-PA-B04)
  - Phòng B: 4 bàn (T2-PB-B01 đến T2-PB-B04)
- **Tổng:** 14 bàn

### 1.2 Mục tiêu kinh doanh

| # | Mục tiêu | Chỉ số đo lường |
|---|----------|-----------------|
| 1 | Giảm sai sót trong ghi order | Tỷ lệ order sai < 1% |
| 2 | Tăng tốc độ phục vụ | Thời gian từ gọi món đến bếp nhận < 1 phút |
| 3 | Minh bạch doanh thu hàng ngày | Chủ quán xem báo cáo ngay cuối ca |
| 4 | Giảm thời gian đào tạo nhân viên mới | Thành thạo sau < 30 phút hướng dẫn |
| 5 | Quản lý thu chi rõ ràng | Theo dõi lợi nhuận theo ngày/tháng |

### 1.3 Vấn đề hiện tại cần giải quyết

- Nhân viên ghi order bằng tay, dễ sai sót và khó đọc
- Không theo dõi được bàn trống/bàn đang phục vụ theo thời gian thực
- Tính tiền thủ công, dễ nhầm và mất thời gian
- Chủ quán thiếu dữ liệu phân tích: món bán chạy, giờ cao điểm
- Thu chi ghi sổ tay, khó tổng hợp cuối tháng

---

## 2. Đối tượng người dùng

### Role 1: Chủ quán (Owner / Admin)

| Thuộc tính | Chi tiết |
|-----------|----------|
| Số lượng | 1 người |
| Thiết bị | Máy tính bàn hoặc laptop |
| Kỹ năng | Trung bình (dùng smartphone, Facebook) |
| Thời gian dùng | Cuối ca, cuối ngày, đầu tháng |
| Mối quan tâm | Doanh thu, lợi nhuận, chi phí, món bán chạy |

**Quyền hạn:** Toàn quyền — quản lý thực đơn, nhân viên, báo cáo đầy đủ, thu chi, cài đặt hệ thống.

---

### Role 2: Thu ngân (Cashier)

| Thuộc tính | Chi tiết |
|-----------|----------|
| Số lượng | 1–2 người |
| Thiết bị | Máy tính tại quầy thu ngân |
| Kỹ năng | Trung bình thấp |
| Thời gian dùng | Suốt ca làm việc |
| Mối quan tâm | Tính tiền nhanh, in hóa đơn, tổng kết ca |

**Quyền hạn:** Xem bàn và order, tạo/chỉnh hóa đơn, xử lý thanh toán, in hóa đơn, báo cáo ca cơ bản.

---

### Role 3: Phục vụ (Waiter)

| Thuộc tính | Chi tiết |
|-----------|----------|
| Số lượng | 2–5 người |
| Thiết bị | Tablet hoặc smartphone |
| Kỹ năng | Thấp |
| Thời gian dùng | Liên tục trong ca |
| Mối quan tâm | Ghi order nhanh, biết trạng thái bàn |

**Quyền hạn:** Xem sơ đồ bàn, mở bàn, ghi/chỉnh sửa order chưa thanh toán, gửi bếp, yêu cầu thanh toán.

---

## 3. User Stories theo từng Role

### 3.1 Chủ quán (Owner)

**Quản lý thực đơn**
- **US-O01:** Là chủ quán, tôi muốn thêm/sửa/xóa món ăn (tên, giá, mô tả, ảnh, danh mục) để thực đơn luôn cập nhật.
- **US-O02:** Là chủ quán, tôi muốn phân loại món theo danh mục để nhân viên gọi món dễ tìm.
- **US-O03:** Là chủ quán, tôi muốn ẩn món tạm thời (hết nguyên liệu) mà không cần xóa.
- **US-O04:** Là chủ quán, tôi muốn đặt combo/khuyến mãi để thu hút khách.

**Quản lý nhân viên**
- **US-O05:** Là chủ quán, tôi muốn tạo tài khoản nhân viên với role và mật khẩu.
- **US-O06:** Là chủ quán, tôi muốn xem lịch sử hoạt động từng nhân viên để kiểm soát.
- **US-O07:** Là chủ quán, tôi muốn vô hiệu hóa tài khoản nhân viên nghỉ việc ngay lập tức.

**Thu chi & Báo cáo**
- **US-O08:** Là chủ quán, tôi muốn ghi nhận chi phí vận hành (nguyên liệu, điện nước, lương, sửa chữa).
- **US-O09:** Là chủ quán, tôi muốn xem tổng thu – tổng chi – lợi nhuận theo ngày/tuần/tháng.
- **US-O10:** Là chủ quán, tôi muốn xuất báo cáo thu chi ra Excel để lưu trữ.
- **US-O11:** Là chủ quán, tôi muốn thấy dashboard: doanh thu hôm nay, số bàn đang phục vụ, số hóa đơn.
- **US-O12:** Là chủ quán, tôi muốn xem top 10 món bán chạy trong khoảng thời gian tùy chọn.
- **US-O13:** Là chủ quán, tôi muốn xem biểu đồ doanh thu theo giờ để biết giờ cao điểm.
- **US-O14:** Là chủ quán, tôi muốn xem doanh thu so sánh giữa các ngày trong tuần/tháng.
- **US-O15:** Là chủ quán, tôi muốn xem báo cáo theo từng khu vực (Tầng 1, Phòng A, Phòng B).

---

### 3.2 Thu ngân (Cashier)

- **US-C01:** Là thu ngân, tôi muốn xem danh sách tất cả bàn đang có order.
- **US-C02:** Là thu ngân, tôi muốn mở hóa đơn và xem chi tiết món đã gọi, đơn giá, thành tiền.
- **US-C03:** Là thu ngân, tôi muốn áp dụng giảm giá (% hoặc số tiền cố định) khi cần.
- **US-C04:** Là thu ngân, tôi muốn chọn phương thức thanh toán: tiền mặt, chuyển khoản, hoặc kết hợp.
- **US-C05:** Là thu ngân, tôi muốn hệ thống tự tính tiền thừa khi khách trả tiền mặt.
- **US-C06:** Là thu ngân, tôi muốn in hoặc hiển thị hóa đơn điện tử (QR) cho khách.
- **US-C07:** Là thu ngân, tôi muốn tách hóa đơn khi một bàn có nhiều nhóm muốn trả riêng.
- **US-C08:** Là thu ngân, tôi muốn gộp bàn khi khách chuyển bàn hoặc hai nhóm nhập lại.
- **US-C09:** Là thu ngân, tôi muốn xem tổng kết ca: số hóa đơn, tổng tiền mặt, tổng chuyển khoản.
- **US-C10:** Là thu ngân, tôi muốn tìm lại hóa đơn đã thanh toán theo số hóa đơn hoặc bàn trong ngày.

---

### 3.3 Phục vụ (Waiter)

- **US-W01:** Là phục vụ, tôi muốn thấy sơ đồ bàn với màu sắc phân biệt: trống (xanh), đang phục vụ (đỏ), cần thanh toán (vàng).
- **US-W02:** Là phục vụ, tôi muốn bấm vào bàn trống để mở bàn.
- **US-W03:** Là phục vụ, tôi muốn gọi món từ thực đơn phân danh mục, tìm kiếm tên món nhanh.
- **US-W04:** Là phục vụ, tôi muốn ghi số lượng và ghi chú đặc biệt (ít cay, không hành) cho từng món.
- **US-W05:** Là phục vụ, tôi muốn gửi order xuống bếp bằng một nút bấm, có xác nhận trước khi gửi.
- **US-W06:** Là phục vụ, tôi muốn gọi thêm món cho bàn đang phục vụ mà không ảnh hưởng các món đã gửi bếp.
- **US-W07:** Là phục vụ, tôi muốn xem toàn bộ order của bàn kèm trạng thái từng món.
- **US-W08:** Là phục vụ, tôi muốn chuyển khách sang bàn khác mà order không bị mất.
- **US-W09:** Là phục vụ, tôi muốn đánh dấu "yêu cầu thanh toán" cho bàn, thu ngân nhận thông báo.

---

## 4. Danh sách tính năng theo Module

### Module 1: Xác thực & Phân quyền

| Mã | Tính năng | Priority |
|----|-----------|----------|
| F-AUTH-01 | Đăng nhập username/password | Must Have |
| F-AUTH-02 | Phân quyền theo role | Must Have |
| F-AUTH-03 | Đăng xuất | Must Have |
| F-AUTH-04 | Đổi mật khẩu | Should Have |
| F-AUTH-05 | Reset mật khẩu bởi Owner | Should Have |
| F-AUTH-06 | Timeout session tự động | Should Have |

---

### Module 2: Quản lý Sơ đồ Bàn

| Mã | Tính năng | Priority |
|----|-----------|----------|
| F-TABLE-01 | Hiển thị sơ đồ bàn theo tầng/phòng (Tab: Tầng 1 / Phòng A / Phòng B) | Must Have |
| F-TABLE-02 | Màu sắc trạng thái: Trống (xanh lá), Đang phục vụ (đỏ cam), Chờ thanh toán (vàng), Đặt trước (xanh dương) | Must Have |
| F-TABLE-03 | Mở bàn: bấm bàn trống → nhập số khách → xác nhận | Must Have |
| F-TABLE-04 | Chuyển bàn: giữ nguyên toàn bộ order | Must Have |
| F-TABLE-05 | Gộp bàn: merge hóa đơn của 2 bàn | Should Have |
| F-TABLE-06 | Cập nhật trạng thái real-time (không cần F5) | Must Have |
| F-TABLE-07 | Xem nhanh thông tin bàn: danh sách món, tổng tạm tính, thời gian ngồi | Should Have |

---

### Module 3: Quản lý Order

| Mã | Tính năng | Priority |
|----|-----------|----------|
| F-ORDER-01 | Tạo order mới cho bàn | Must Have |
| F-ORDER-02 | Tìm kiếm món theo tên (real-time) | Must Have |
| F-ORDER-03 | Thêm món: bấm +/- chỉnh số lượng, hiển thị tổng tạm tính | Must Have |
| F-ORDER-04 | Ghi chú từng món (ít đường, thêm đá, v.v.) | Must Have |
| F-ORDER-05 | Gửi order xuống bếp (có xác nhận) | Must Have |
| F-ORDER-06 | Gọi thêm món (phân biệt lần gọi 1, lần gọi 2) | Must Have |
| F-ORDER-07 | Hủy món trước khi gửi bếp | Must Have |
| F-ORDER-08 | Hủy món sau khi gửi bếp (chỉ Owner/Cashier, cần lý do) | Must Have |
| F-ORDER-09 | Xem lịch sử order của bàn | Should Have |
| F-ORDER-10 | Trạng thái món: Đang làm / Đã xong / Đã phục vụ | Could Have |

---

### Module 4: Quản lý Thực đơn

| Mã | Tính năng | Priority |
|----|-----------|----------|
| F-MENU-01 | Quản lý danh mục (thêm/sửa/xóa, sắp xếp thứ tự) | Must Have |
| F-MENU-02 | Thêm món mới: tên, giá, mô tả, danh mục, ảnh | Must Have |
| F-MENU-03 | Sửa thông tin món | Must Have |
| F-MENU-04 | Ẩn/Hiện món (toggle "Có sẵn / Tạm hết") | Must Have |
| F-MENU-05 | Xóa mềm (soft delete, không ảnh hưởng lịch sử order) | Must Have |
| F-MENU-06 | Upload ảnh món | Should Have |
| F-MENU-07 | Sắp xếp thứ tự món trong danh mục | Could Have |
| F-MENU-08 | Combo / set menu với giá trọn gói | Could Have |

---

### Module 5: Hóa đơn & Thanh toán

| Mã | Tính năng | Priority |
|----|-----------|----------|
| F-BILL-01 | Tạo hóa đơn từ order bàn | Must Have |
| F-BILL-02 | Xem chi tiết hóa đơn: món, đơn giá, số lượng, tổng | Must Have |
| F-BILL-03 | Áp dụng giảm giá (% hoặc tiền cố định, kèm lý do) | Must Have |
| F-BILL-04 | Chọn phương thức: Tiền mặt / Chuyển khoản / Kết hợp | Must Have |
| F-BILL-05 | Tính tiền thừa tự động | Must Have |
| F-BILL-06 | Xác nhận thanh toán → bàn tự chuyển "Trống" | Must Have |
| F-BILL-07 | In hóa đơn (máy in nhiệt 58mm/80mm) | Must Have |
| F-BILL-08 | Xem lại hóa đơn đã thanh toán | Must Have |
| F-BILL-09 | Tách hóa đơn (split bill) | Should Have |
| F-BILL-10 | Mã QR chuyển khoản (VietQR, số tiền tự động điền) | Should Have |
| F-BILL-11 | Hủy hóa đơn (chỉ Owner, cần lý do) | Should Have |

---

### Module 6: Thu Chi

| Mã | Tính năng | Priority |
|----|-----------|----------|
| F-FIN-01 | Ghi nhận khoản chi (ngày, danh mục, số tiền, ghi chú) | Must Have |
| F-FIN-02 | Quản lý danh mục chi phí | Must Have |
| F-FIN-03 | Xem danh sách thu chi theo ngày/tháng, lọc danh mục | Must Have |
| F-FIN-04 | Sửa/Xóa khoản chi (chỉ Owner) | Must Have |
| F-FIN-05 | Tổng kết: Doanh thu - Chi phí = Lợi nhuận | Must Have |
| F-FIN-06 | Xuất báo cáo thu chi ra Excel | Should Have |

---

### Module 7: Dashboard & Báo cáo

| Mã | Tính năng | Priority |
|----|-----------|----------|
| F-RPT-01 | Dashboard: doanh thu hôm nay, bàn đang dùng, số hóa đơn, lợi nhuận | Must Have |
| F-RPT-02 | Báo cáo doanh thu theo ngày | Must Have |
| F-RPT-03 | Báo cáo doanh thu theo tháng (biểu đồ cột) | Must Have |
| F-RPT-04 | Top 10 món bán chạy (số lượng & doanh thu) | Must Have |
| F-RPT-05 | Biểu đồ doanh thu theo giờ trong ngày | Should Have |
| F-RPT-06 | Báo cáo theo khu vực: Tầng 1 / Phòng A / Phòng B | Should Have |
| F-RPT-07 | Tổng kết ca làm việc | Should Have |
| F-RPT-08 | So sánh doanh thu ngày/tuần | Could Have |
| F-RPT-09 | Xuất báo cáo ra Excel | Should Have |

---

### Module 8: Cài đặt Hệ thống

| Mã | Tính năng | Priority |
|----|-----------|----------|
| F-SET-01 | Thông tin quán (tên, địa chỉ, SĐT, logo) | Must Have |
| F-SET-02 | Cấu hình máy in (khổ giấy 58mm/80mm) | Must Have |
| F-SET-03 | Quản lý tài khoản nhân viên | Must Have |
| F-SET-04 | Thông tin chuyển khoản (cho VietQR) | Should Have |
| F-SET-05 | Cấu hình footer hóa đơn | Could Have |
| F-SET-06 | Sao lưu dữ liệu thủ công | Could Have |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Yêu cầu | Mục tiêu |
|---------|----------|
| Tải trang đầu | < 3 giây trên WiFi thông thường |
| Phản hồi thao tác (gửi order, thanh toán) | < 1 giây |
| Cập nhật trạng thái bàn real-time | < 2 giây |
| Đồng thời | Tối thiểu 5 thiết bị cùng lúc không giật lag |
| In hóa đơn | < 3 giây từ khi bấm nút |

### 5.2 Security

| Yêu cầu | Chi tiết |
|---------|---------|
| Xác thực | Mật khẩu bcrypt, session-based hoặc JWT |
| Phân quyền | Mọi API endpoint kiểm tra role trước khi xử lý |
| HTTPS | Bắt buộc toàn bộ ứng dụng |
| Audit log | Ghi lại: hủy order, hủy hóa đơn, giảm giá, sửa giá |
| Session timeout | Tự động logout sau 4 giờ không hoạt động |

### 5.3 Usability

| Yêu cầu | Chi tiết |
|---------|---------|
| Responsive | Hoạt động tốt tablet (768px+) và desktop (1024px+) |
| Font chữ | Đủ lớn để đọc trong quán ăn |
| Touch-friendly | Nút tối thiểu 44×44px |
| Ngôn ngữ | 100% tiếng Việt |
| Xác nhận | Dialog xác nhận trước thao tác không thể hoàn tác |
| Đào tạo | Nhân viên phục vụ thành thạo sau < 30 phút |

### 5.4 Reliability

| Yêu cầu | Chi tiết |
|---------|---------|
| Uptime | 99% trong giờ hoạt động (7:00–23:00) |
| Dữ liệu | Không mất khi reload hoặc mất điện đột ngột |
| Backup | Tự động hàng ngày |
| Xử lý lỗi | Thông báo lỗi thân thiện (không hiện stack trace) |

### 5.5 Compatibility

| Yêu cầu | Chi tiết |
|---------|---------|
| Trình duyệt | Chrome (ưu tiên), Firefox, Edge — 2 năm gần nhất |
| Hệ điều hành | Windows 10+, Android 8+, iOS 13+ |
| Máy in | Hỗ trợ in qua Print API trình duyệt hoặc kết nối LAN |

---

## 6. Scope & Out of Scope

### Trong phạm vi (In Scope)
- [x] Quản lý 14 bàn theo 3 khu vực: Tầng 1, Phòng A, Phòng B
- [x] Quy trình: mở bàn → gọi món → gửi bếp → gọi thêm → thanh toán → đóng bàn
- [x] Quản lý thực đơn: danh mục, món ăn, giá, ảnh
- [x] Hóa đơn & thanh toán: tiền mặt, chuyển khoản, giảm giá, in hóa đơn
- [x] Thu chi: ghi nhận chi phí, tổng hợp lợi nhuận
- [x] Dashboard & báo cáo: doanh thu, món bán chạy, thống kê theo thời gian
- [x] Phân quyền 3 role: Owner, Cashier, Waiter
- [x] Single-tenant: chỉ 1 quán duy nhất
- [x] Web app chạy trên trình duyệt, không cần cài đặt

### Ngoài phạm vi (Out of Scope)
- [ ] **Multi-tenant:** Không hỗ trợ nhiều quán/chi nhánh
- [ ] **Mobile App native:** Không phát triển app iOS/Android native
- [ ] **Quản lý kho / Inventory:** Không theo dõi tồn kho nguyên liệu
- [ ] **Tích hợp kế toán:** Không kết nối MISA, Fast, v.v.
- [ ] **Đặt bàn online:** Không có module đặt bàn qua website/app
- [ ] **CRM / Loyalty:** Không lưu thông tin khách, không tích điểm
- [ ] **Food delivery:** Không kết nối GrabFood, ShopeeFood
- [ ] **Quản lý HR:** Không chấm công, không bảng lương chi tiết
- [ ] **Thanh toán thẻ POS:** Không tích hợp máy POS vật lý
- [ ] **Quản lý nhà cung cấp:** Không theo dõi đơn hàng mua vào
- [ ] **Kitchen Display System:** Không có màn hình bếp riêng (v1.0)
- [ ] **Đa ngôn ngữ:** Chỉ tiếng Việt

---

## 7. Constraints & Assumptions

### 7.1 Constraints (Ràng buộc)

**Kỹ thuật**
- Chạy trên một server duy nhất tại quán hoặc cloud hosting cơ bản
- WiFi nội bộ quán là điều kiện bắt buộc
- Máy in nhiệt (thermal printer) 58mm hoặc 80mm
- Ngân sách hosting ≤ 200.000 VNĐ/tháng

**Thời gian & Nguồn lực**
- 1–2 developer thực hiện
- Phiên bản 1.0 hoàn thành trong 8–12 tuần
- Tính năng "Must Have" bắt buộc trước khi go-live

**Pháp lý**
- Không phát hành hóa đơn VAT điện tử; bill in ra chỉ là phiếu nội bộ
- Không lưu thông tin tài chính nhạy cảm của khách

### 7.2 Assumptions (Giả định)

**Môi trường vận hành**
- Quán có WiFi ổn định bao phủ toàn bộ tầng 1 và tầng 2
- Nhân viên dùng tablet Android hoặc smartphone cá nhân
- Quầy thu ngân có máy tính kết nối máy in nhiệt
- Hoạt động 7:00–23:00 hàng ngày

**Người dùng**
- Chủ quán tự cập nhật thực đơn sau khi được hướng dẫn
- Nhân viên biết dùng smartphone/tablet mức cơ bản
- Tối đa 5 nhân viên dùng đồng thời
- Tài khoản Owner không chia sẻ

**Dữ liệu**
- Lưu trữ lịch sử tối thiểu 2 năm
- Không cần migration từ hệ thống cũ (bắt đầu mới hoàn toàn)
- Thực đơn không quá 200 món
- Trung bình 30–80 hóa đơn/ngày

**Nghiệp vụ**
- Giá đã bao gồm thuế, không tách VAT trên hóa đơn
- Không có tích điểm hay thẻ thành viên
- Giảm giá do thu ngân hoặc chủ quán quyết định, không tự động

---

## Phụ lục A: Luồng nghiệp vụ chính

### Luồng 1: Phục vụ khách ăn tại quán

```
Khách vào quán
    → Phục vụ chọn bàn trống trên app
    → Bấm "Mở bàn" (nhập số khách)
    → Chọn món từ thực đơn + ghi chú đặc biệt
    → Bấm "Gửi bếp" → xác nhận
    → [Bếp nhận order và chế biến]
    → Phục vụ mang món ra bàn
    → [Khách gọi thêm nếu cần → lặp lại]
    → Khách gọi tính tiền
    → Phục vụ đánh dấu "Yêu cầu thanh toán"
    → Thu ngân mở hóa đơn, xác nhận với khách
    → Xử lý thanh toán (chọn PTTT → xác nhận)
    → In hóa đơn (tùy chọn)
    → Bàn tự động chuyển về "Trống"
```

### Luồng 2: Ghi nhận chi phí

```
Chủ quán / Thu ngân
    → Vào module Thu Chi
    → Bấm "Thêm khoản chi"
    → Chọn danh mục + nhập số tiền, ngày, ghi chú
    → Lưu
    → Xem tổng kết: Doanh thu - Chi phí = Lợi nhuận
```

### Luồng 3: Xem báo cáo cuối ngày

```
Chủ quán
    → Vào Dashboard → xem doanh thu hôm nay
    → Vào Báo cáo → chọn "Theo ngày" → chọn ngày
    → Xem: tổng tiền, số hóa đơn, top món, giờ cao điểm
    → Xuất Excel nếu cần lưu trữ
```

---

## Phụ lục B: Danh sách màn hình chính

| # | Màn hình | Role truy cập | Mô tả |
|---|----------|---------------|-------|
| 1 | Đăng nhập | Tất cả | Form username/password |
| 2 | Dashboard | Owner, Cashier | KPI tổng quan, trạng thái hoạt động |
| 3 | Sơ đồ bàn | Tất cả | Tab Tầng 1 / Phòng A / Phòng B |
| 4 | Gọi món | Waiter, Cashier | Thực đơn, giỏ order, ghi chú |
| 5 | Chi tiết order bàn | Tất cả | Danh sách món, trạng thái, tổng tiền |
| 6 | Thanh toán | Cashier, Owner | Hóa đơn, giảm giá, PTTT, in |
| 7 | Lịch sử hóa đơn | Cashier, Owner | Tìm kiếm, xem lại, hủy |
| 8 | Quản lý thực đơn | Owner | CRUD danh mục và món ăn |
| 9 | Thu Chi | Owner | Ghi chi phí, xem tổng kết |
| 10 | Báo cáo | Owner | Doanh thu, biểu đồ, top món |
| 11 | Cài đặt | Owner | Thông tin quán, tài khoản, máy in |

---

*Tài liệu này là cơ sở để thiết kế UI/UX và phát triển kỹ thuật. Mọi thay đổi về scope cần xác nhận từ chủ quán.*
