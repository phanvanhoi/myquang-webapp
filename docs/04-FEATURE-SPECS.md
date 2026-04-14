# Feature Specification - Web App Quản Lý Quán Ăn "My Quang"

**Phiên bản:** 1.0  
**Ngày:** 2026-04-14  
**Loại hệ thống:** Single-tenant (1 quán duy nhất)  
**Cấu hình quán:**
- Tầng 1: 6 bàn (B1 - B6)
- Tầng 2: Phòng A (PA1 - PA4), Phòng B (PB1 - PB4)

---

## Mục lục

1. [Module 1: Quản lý Bàn & Tầng](#module-1)
2. [Module 2: Quản lý Order](#module-2)
3. [Module 3: Thanh toán](#module-3)
4. [Module 4: Quản lý Thực đơn](#module-4)
5. [Module 5: Thu Chi](#module-5)
6. [Module 6: Phân quyền](#module-6)

---

## Module 1: Quản lý Bàn & Tầng {#module-1}

### 1.1 Tổng quan

Module này cung cấp giao diện trực quan dạng sơ đồ mặt bằng, cho phép nhân viên nắm bắt tình trạng toàn bộ bàn trong quán theo thời gian thực. Đây là màn hình trung tâm mà nhân viên phục vụ và thu ngân mở đầu ca làm việc.

### 1.2 Sơ đồ bàn trực quan

#### 1.2.1 Bố cục giao diện

- Màn hình chia thành các **tab tầng**: [Tầng 1] [Tầng 2 - Phòng A] [Tầng 2 - Phòng B]
- Mỗi tab hiển thị sơ đồ bàn dạng lưới (grid layout), phản ánh vị trí thực tế của bàn trong quán
- Mỗi ô bàn hiển thị:
  - Mã bàn (B1, B2, PA1, PB3...)
  - Trạng thái bàn (màu sắc)
  - Số khách hiện tại (nếu có khách)
  - Thời gian ngồi (nếu có khách, tính từ lúc tạo order)
  - Tổng tiền tạm tính của order hiện tại (tùy cấu hình hiển thị)

#### 1.2.2 Trạng thái bàn

| Trạng thái | Màu hiển thị | Mô tả |
|---|---|---|
| Trống | Xanh lá | Bàn chưa có khách, sẵn sàng phục vụ |
| Có khách | Đỏ | Bàn đang có khách, order đang hoạt động |
| Đặt trước | Vàng | Bàn đã được đặt trước, chưa đến giờ |
| Đang dọn | Xám | Khách vừa rời, nhân viên đang dọn dẹp |

**Business rules trạng thái:**
- Bàn chỉ chuyển sang **Có khách** khi nhân viên tạo order mới hoặc xác nhận khách đến (đối với bàn đặt trước)
- Bàn chuyển sang **Đang dọn** ngay sau khi thanh toán hoàn tất
- Bàn chuyển về **Trống** khi nhân viên xác nhận đã dọn xong (nhấn nút "Đã dọn xong")
- Bàn **Đặt trước** hiển thị countdown đến giờ đặt; nếu quá 15 phút sau giờ đặt mà khách chưa đến, hệ thống cảnh báo và chủ quán/thu ngân quyết định hủy hay chờ thêm

#### 1.2.3 Thao tác nhanh từ sơ đồ bàn

- **Nhấn vào bàn Trống:** Mở popup chọn hành động: [Tạo order] [Đặt trước]
- **Nhấn vào bàn Có khách:** Mở popup chọn hành động: [Xem/Sửa order] [Gọi thêm món] [Thanh toán] [Chuyển bàn] [Gộp bàn]
- **Nhấn vào bàn Đặt trước:** Mở popup: [Xác nhận khách đến] [Chỉnh sửa đặt trước] [Hủy đặt trước]
- **Nhấn vào bàn Đang dọn:** Mở popup: [Đã dọn xong]

### 1.3 Gộp bàn

#### 1.3.1 Luồng gộp bàn

1. Nhân viên chọn bàn nguồn (bàn có khách muốn gộp)
2. Nhấn **"Gộp bàn"**
3. Màn hình hiển thị danh sách bàn có thể gộp (cùng tầng/phòng, đang trống hoặc cũng có khách)
4. Nhân viên chọn 1 hoặc nhiều bàn để gộp vào
5. Xác nhận gộp

#### 1.3.2 Business rules gộp bàn

- Chỉ gộp bàn trong **cùng tầng/phòng** (không gộp bàn tầng 1 với tầng 2)
- Khi gộp 2 bàn đều đang có khách: tất cả các món của 2 order được **hợp nhất vào 1 order duy nhất** (order của bàn được chọn làm bàn chính)
- Bàn phụ (bàn bị gộp vào) chuyển trạng thái thành **"Đã gộp"** - hiển thị dạng disabled trên sơ đồ, ghi chú "Đã gộp vào [Bàn chính]"
- Hóa đơn in ra ghi tên bàn chính và liệt kê tất cả bàn phụ đã gộp
- Khi thanh toán xong, tất cả bàn trong nhóm gộp đồng thời chuyển sang **Đang dọn**
- **Giới hạn:** Tối đa gộp 4 bàn vào 1 nhóm

#### 1.3.3 Edge cases gộp bàn

- Không cho phép gộp bàn đang ở trạng thái **Đặt trước** hoặc **Đang dọn**
- Nếu bàn phụ đã có order, hệ thống hiển thị chi tiết các món sẽ được merge để nhân viên xác nhận trước khi gộp
- Sau khi gộp, nếu có 2 món giống nhau (cùng tên, cùng ghi chú), hệ thống **không tự động cộng số lượng** mà giữ nguyên 2 dòng riêng biệt để tránh nhầm lẫn

### 1.4 Chuyển bàn

#### 1.4.1 Luồng chuyển bàn

1. Nhân viên chọn bàn có khách muốn chuyển
2. Nhấn **"Chuyển bàn"**
3. Màn hình hiển thị sơ đồ toàn bộ quán, highlight các bàn **Trống** có thể chuyển đến
4. Nhân viên chọn bàn đích
5. Xác nhận chuyển

#### 1.4.2 Business rules chuyển bàn

- Chỉ cho phép chuyển sang bàn đang **Trống**
- Toàn bộ order (bao gồm món đang chờ, đang làm, đã xong) được **giữ nguyên** khi chuyển bàn
- Bàn cũ chuyển sang trạng thái **Đang dọn**
- Bàn mới chuyển sang trạng thái **Có khách**
- Lịch sử order ghi nhận thao tác chuyển bàn (từ bàn nào, đến bàn nào, thời gian, nhân viên thực hiện)
- **Cho phép** chuyển bàn kể cả khi có món đang được bếp chế biến

### 1.5 Đặt bàn trước (Reservation)

#### 1.5.1 Thông tin đặt bàn

| Trường | Bắt buộc | Mô tả |
|---|---|---|
| Tên khách | Có | Tên người đặt |
| Số điện thoại | Có | Để liên hệ xác nhận/nhắc lịch |
| Ngày đặt | Có | Ngày khách đến |
| Giờ đến | Có | Giờ dự kiến khách đến |
| Số lượng khách | Có | Để chọn bàn phù hợp |
| Bàn đặt | Có | Chọn từ sơ đồ bàn |
| Ghi chú | Không | Yêu cầu đặc biệt (sinh nhật, có trẻ em...) |
| Đặt cọc | Không | Số tiền đặt cọc nếu có |

#### 1.5.2 Luồng đặt bàn

1. Nhân viên (hoặc chủ quán) nhập thông tin đặt bàn
2. Hệ thống kiểm tra bàn có bị trùng lịch không (trong vòng ±2 tiếng)
3. Xác nhận đặt bàn thành công
4. Bàn chuyển sang trạng thái **Đặt trước** vào ngày/giờ đặt (hệ thống tự động cập nhật)
5. Khi khách đến: nhân viên nhấn **"Xác nhận khách đến"** → tạo order mới → bàn chuyển sang **Có khách**

#### 1.5.3 Business rules đặt bàn

- Một bàn có thể có nhiều lịch đặt trong ngày, nhưng các khung giờ phải cách nhau tối thiểu **2 tiếng** (tính từ giờ đến dự kiến)
- Đặt bàn chỉ cho phép trong tương lai (không đặt cho giờ đã qua)
- Có thể đặt bàn cho ngày hôm nay nếu giờ đặt còn trong tương lai ít nhất 30 phút
- Chủ quán có thể xem danh sách tất cả lịch đặt theo ngày dạng timeline
- Hệ thống **không tự động nhắc nhở** qua SMS/email (single-tenant, nhân viên tự nhìn màn hình)
- Khi đến giờ đặt: bàn tự chuyển sang trạng thái Đặt trước trên sơ đồ, nhân viên thấy ngay

#### 1.5.4 Edge cases đặt bàn

- Nếu bàn đang **Có khách** mà đến giờ của lịch đặt kế tiếp: hệ thống hiển thị cảnh báo màu cam trên bàn đó để nhân viên chủ động xử lý
- Nếu hủy đặt bàn có tiền cọc: hệ thống yêu cầu nhân viên ghi nhận xử lý cọc (hoàn cọc / giữ cọc) trước khi hủy
- Không cho phép xóa lịch đặt bàn đã quá hạn (chỉ đánh dấu "Không đến" để lưu lịch sử)

---

## Module 2: Quản lý Order {#module-2}

### 2.1 Tổng quan

Module quản lý order là lõi nghiệp vụ của hệ thống. Mỗi order gắn với một bàn (hoặc một nhóm bàn gộp). Order được tạo khi khách ngồi vào bàn và đóng lại khi thanh toán xong.

### 2.2 Tạo order mới

#### 2.2.1 Luồng tạo order

1. Nhân viên chọn bàn trống trên sơ đồ → nhấn **"Tạo order"**
2. Hệ thống tạo order mới với:
   - Mã order tự động (định dạng: ORD-YYYYMMDD-NNN, ví dụ: ORD-20260414-001)
   - Bàn: bàn được chọn
   - Thời gian tạo: timestamp hiện tại
   - Nhân viên tạo: tài khoản đang đăng nhập
   - Số khách: nhân viên nhập (mặc định = 1)
3. Màn hình chuyển sang giao diện **chọn món**
4. Nhân viên chọn món từ thực đơn

#### 2.2.2 Giao diện chọn món

- Thực đơn hiển thị dạng **danh mục** (tabs hoặc sidebar trái): Khai vị, Món chính, Tráng miệng, Đồ uống, Combo...
- Mỗi món hiển thị: ảnh, tên, giá, trạng thái (còn hàng / hết)
- Nhấn vào món: thêm vào order với số lượng = 1
- Có thể tăng/giảm số lượng trực tiếp trên giao diện chọn món
- Ô **tìm kiếm nhanh** theo tên món
- Phần bên phải/dưới: hiển thị **giỏ hàng order** (các món đã chọn, số lượng, ghi chú, tạm tính)

### 2.3 Thêm / Sửa / Xóa món trong order

#### 2.3.1 Thêm món

- Có thể thêm món vào order bất kỳ lúc nào trong khi bàn còn khách
- Khi thêm món mới vào order đang có món đã gửi bếp: các món mới được thêm với trạng thái **"Đang chờ"** (chưa gửi bếp)
- Nhân viên phải nhấn **"Gửi bếp"** để gửi các món mới xuống bếp

#### 2.3.2 Sửa món

- Chỉ cho phép sửa **số lượng** và **ghi chú** của món có trạng thái **"Đang chờ"**
- Món đã chuyển sang **"Đang làm"** hoặc **"Đã xong"** → không cho sửa số lượng
- Nếu cần giảm số lượng món đang làm: phải dùng chức năng **Hủy món** (có lý do)

#### 2.3.3 Xóa món

- Chỉ xóa được món có trạng thái **"Đang chờ"** (chưa gửi bếp)
- Món đã gửi bếp (trạng thái Đang làm / Đã xong): phải dùng chức năng **Hủy món**
- Hủy món yêu cầu nhân viên **chọn lý do**: Khách đổi ý / Nhầm món / Hết nguyên liệu / Lý do khác
- Mọi lần hủy món đã gửi bếp đều được **ghi log** (thời gian, nhân viên, lý do)

### 2.4 Ghi chú đặc biệt

#### 2.4.1 Ghi chú theo từng món

- Mỗi dòng món trong order có trường ghi chú riêng
- Gợi ý nhanh (nhấn để chọn): "Ít cay", "Không cay", "Không hành", "Không mùi", "Thêm rau", "Ít đường", "Không đá"
- Nhân viên cũng có thể gõ tự do vào ô ghi chú

#### 2.4.2 Ghi chú theo order

- Trường ghi chú chung cho cả order (hiển thị trên Kitchen Display)
- Ví dụ: "Khách dị ứng hải sản", "Bàn có trẻ nhỏ", "Khách vội - ưu tiên phục vụ"

#### 2.4.3 Business rules ghi chú

- Ghi chú món được in trên phiếu bếp, hiển thị rõ ràng bên dưới tên món
- Độ dài ghi chú tối đa: 200 ký tự/món
- Ghi chú không ảnh hưởng đến giá tiền

### 2.5 Gửi order xuống bếp (Kitchen Display)

#### 2.5.1 Luồng gửi bếp

1. Nhân viên hoàn tất chọn món → nhấn **"Gửi bếp"**
2. Hệ thống gửi tất cả món có trạng thái "Đang chờ" (chưa gửi) xuống Kitchen Display
3. Các món được gửi chuyển sang trạng thái **"Đang làm"**
4. Màn hình bếp (Kitchen Display) hiển thị phiếu mới với: mã order, bàn, danh sách món + ghi chú, thời gian gửi

#### 2.5.2 Kitchen Display System (KDS)

- Giao diện dành riêng cho bếp, chạy trên màn hình/tablet ở khu vực bếp
- Không cần đăng nhập tài khoản riêng (dùng link/pin nội bộ)
- Hiển thị danh sách phiếu bếp đang chờ làm, sắp xếp theo thời gian gửi (cũ nhất trên cùng)
- Mỗi phiếu bếp hiển thị: mã bàn, danh sách món + số lượng + ghi chú, thời gian gửi, thời gian chờ (đồng hồ đếm lên)
- Bếp nhấn **"Đang làm"** khi bắt đầu chế biến → phiếu chuyển màu
- Bếp nhấn **"Xong"** khi món đã hoàn thành → món chuyển sang trạng thái "Đã xong" trên hệ thống
- Phiếu bếp chỉ biến mất khi **tất cả** các món trong phiếu đều "Đã xong"

#### 2.5.3 Business rules gửi bếp

- Không bắt buộc gửi tất cả món cùng lúc (ví dụ: gọi khai vị trước, gọi món chính sau)
- Mỗi lần nhấn "Gửi bếp": chỉ gửi các món **chưa gửi** (trạng thái "Đang chờ")
- Nếu nhân viên quên gửi bếp, món vẫn ở trạng thái "Đang chờ" và sẽ xuất hiện cảnh báo sau 10 phút
- Không thể thanh toán khi còn món ở trạng thái "Đang chờ" hoặc "Đang làm" (trừ khi chủ quán/thu ngân xác nhận bypass)

### 2.6 Trạng thái món

| Trạng thái | Mô tả | Hành động có thể |
|---|---|---|
| Đang chờ | Đã gọi, chưa gửi bếp | Sửa số lượng, sửa ghi chú, xóa |
| Đang làm | Đã gửi bếp, bếp đang chế biến | Hủy (có lý do), xem ghi chú |
| Đã xong | Bếp đã hoàn thành, đang chờ phục vụ | Hủy (có lý do, hiếm gặp) |
| Đã phục vụ | Nhân viên đã mang ra bàn | Chỉ xem |
| Hủy | Đã hủy | Xem lý do hủy |

**Lưu ý:** Trạng thái "Đã phục vụ" là tùy chọn (có thể bật/tắt trong cài đặt). Nếu tắt, món sẽ nhảy thẳng từ "Đã xong" sang không cần xác nhận.

### 2.7 Chia bill

#### 2.7.1 Luồng chia bill

1. Nhân viên/thu ngân mở order → nhấn **"Chia bill"**
2. Màn hình hiển thị danh sách tất cả món trong order
3. Nhân viên chọn số người chia (2-10 người)
4. Hệ thống hỗ trợ 2 cách chia:
   - **Chia đều:** tổng tiền / số người (làm tròn lên cho người cuối)
   - **Chia theo món:** kéo thả từng món vào "phần" của từng người
5. Xem trước kết quả từng phần
6. Tiến hành thanh toán từng phần độc lập

#### 2.7.2 Business rules chia bill

- Mỗi "phần" bill được thanh toán độc lập (có thể khác phương thức thanh toán)
- Phí dịch vụ / giảm giá áp dụng trên tổng bill **trước** khi chia (chia theo tỷ lệ)
- Chỉ được phép chia bill khi tất cả món đã ở trạng thái "Đã xong" hoặc "Hủy"
- Sau khi tất cả phần đã thanh toán: order đóng, bàn chuyển sang "Đang dọn"
- Nếu 1 phần đã thanh toán nhưng phần còn lại chưa: order vẫn ở trạng thái active, bàn vẫn "Có khách"

---

## Module 3: Thanh toán {#module-3}

### 3.1 Tổng quan

Module thanh toán xử lý việc tính tiền, áp dụng ưu đãi, ghi nhận phương thức thanh toán và xuất hóa đơn. Đây là bước cuối cùng của luồng phục vụ khách.

### 3.2 Tính tiền tự động

#### 3.2.1 Cấu trúc hóa đơn

```
Hóa đơn
├── Danh sách món (tên, số lượng, đơn giá, thành tiền)
├── Tạm tính (subtotal)
├── Giảm giá (nếu có)
├── Phí dịch vụ (nếu có, cài đặt toàn quán)
├── Thuế VAT (nếu có, cài đặt toàn quán)
└── Tổng cộng
```

#### 3.2.2 Business rules tính tiền

- Giá của mỗi món lấy từ **giá tại thời điểm tạo order** (snapshot), không bị ảnh hưởng nếu sau đó chủ quán thay đổi giá trong thực đơn
- Phí dịch vụ (service charge) được cấu hình toàn quán: tỷ lệ % (thường 5-10%) hoặc tắt
- Thuế VAT: tắt theo mặc định (phù hợp quán nhỏ chưa đăng ký VAT)
- Món đã **Hủy** không tính vào hóa đơn

### 3.3 Áp dụng giảm giá

#### 3.3.1 Các loại giảm giá

| Loại | Mô tả | Ví dụ |
|---|---|---|
| Giảm theo % | Giảm phần trăm trên tổng bill | 10%, 20%, 50% |
| Giảm tiền mặt | Trừ trực tiếp một số tiền | -50,000đ |
| Miễn phí (100%) | Tặng bàn/khách VIP | 100% |

#### 3.3.2 Business rules giảm giá

- Chỉ **chủ quán** và **thu ngân** mới được áp dụng giảm giá
- Giảm giá áp dụng trên **tạm tính** (trước phí dịch vụ và thuế)
- Giảm giá theo % không được vượt quá 100%
- Giảm tiền mặt không được vượt quá tổng bill (tổng cộng sau giảm giá tối thiểu = 0đ)
- Mọi lần áp dụng giảm giá đều được **ghi log** (ai áp dụng, lý do, mức giảm, thời gian)
- **Có trường "Lý do giảm giá"**: Khách VIP / Sự cố phục vụ / Khuyến mãi / Quà tặng / Lý do khác (bắt buộc điền)
- Chỉ được áp dụng **1 lần giảm giá** trên 1 bill (nếu cần sửa: xóa giảm giá cũ rồi áp dụng lại)

### 3.4 Phương thức thanh toán

| Phương thức | Mô tả |
|---|---|
| Tiền mặt | Nhập số tiền khách đưa → hệ thống tính tiền thừa |
| Chuyển khoản | Hiển thị QR code tài khoản ngân hàng của quán |
| Quẹt thẻ | Ghi nhận thanh toán thẻ (không tích hợp POS, chỉ ghi nhận) |

#### 3.4.1 Luồng thanh toán tiền mặt

1. Thu ngân chọn phương thức "Tiền mặt"
2. Nhập số tiền khách đưa
3. Hệ thống hiển thị: **Tiền thừa = Tiền nhận - Tổng cộng**
4. Xác nhận thanh toán

#### 3.4.2 Luồng thanh toán chuyển khoản

1. Thu ngân chọn phương thức "Chuyển khoản"
2. Hệ thống hiển thị QR code (VietQR) với số tiền cần thanh toán được điền sẵn
3. Khách quét QR và chuyển khoản
4. Thu ngân xác nhận đã nhận tiền (thủ công, không tự động verify qua API ngân hàng)
5. Xác nhận thanh toán

#### 3.4.3 Thanh toán kết hợp

- Hỗ trợ thanh toán kết hợp nhiều phương thức trên 1 bill
- Ví dụ: 200,000đ tiền mặt + 100,000đ chuyển khoản
- Tổng các phương thức phải bằng hoặc lớn hơn tổng bill

### 3.5 In hóa đơn / Gửi hóa đơn

#### 3.5.1 In hóa đơn

- Hỗ trợ in qua máy in nhiệt (thermal printer) khổ 80mm hoặc 58mm
- Nội dung hóa đơn:
  - Logo & tên quán, địa chỉ, số điện thoại
  - Mã hóa đơn, ngày giờ, bàn, thu ngân
  - Danh sách món (tên, SL, đơn giá, thành tiền)
  - Tạm tính, giảm giá (nếu có), phí dịch vụ (nếu có), tổng cộng
  - Phương thức thanh toán, tiền nhận, tiền thừa
  - Lời cảm ơn (có thể tùy chỉnh)
- **In nháp:** In phiếu tạm tính (chưa thanh toán) để khách xem trước
- **In chính thức:** In sau khi thanh toán xong

#### 3.5.2 Gửi hóa đơn

- Chưa hỗ trợ trong phiên bản 1.0 (roadmap tương lai: gửi qua Zalo/email)

### 3.6 Lịch sử giao dịch

#### 3.6.1 Màn hình lịch sử

- Danh sách tất cả giao dịch thanh toán, sắp xếp mới nhất trên cùng
- Bộ lọc: theo ngày, theo phương thức thanh toán, theo thu ngân, theo bàn
- Tìm kiếm: theo mã hóa đơn, mã order

#### 3.6.2 Chi tiết giao dịch

- Xem lại toàn bộ chi tiết hóa đơn
- Xem log giảm giá (nếu có)
- **In lại hóa đơn** (đánh dấu "In lại" trên phiếu in)

#### 3.6.3 Hoàn hóa đơn (Refund)

- Chỉ **chủ quán** mới được hoàn hóa đơn
- Hệ thống đánh dấu hóa đơn là "Đã hoàn" và tạo giao dịch hoàn tiền âm trong lịch sử
- Không tự động xử lý tiền, chủ quán phải hoàn tiền thủ công cho khách

---

## Module 4: Quản lý Thực đơn {#module-4}

### 4.1 Tổng quan

Module quản lý toàn bộ thực đơn của quán: danh mục, món ăn, giá cả, ảnh, combo. Đây là module chủ quán cấu hình một lần và cập nhật theo nhu cầu.

### 4.2 Danh mục món ăn

#### 4.2.1 Cấu trúc danh mục

- Danh mục có **2 cấp**: Danh mục chính → Danh mục con (tùy chọn)
- Ví dụ:
  - Khai vị → Gỏi cuốn, Chả giò, Súp...
  - Món chính → Bún bò, Cơm tấm, Mì Quảng...
  - Đồ uống → Nước ngọt, Bia, Nước ép...
  - Combo → Set gia đình, Set đôi...

#### 4.2.2 Thao tác danh mục

- Thêm / Sửa / Xóa danh mục
- Sắp xếp thứ tự hiển thị (kéo thả)
- Ẩn/hiện danh mục (ẩn danh mục sẽ ẩn tất cả món trong danh mục đó)
- **Không cho phép xóa danh mục** nếu còn món đang active trong danh mục đó

### 4.3 Thêm / Sửa / Ẩn món

#### 4.3.1 Thông tin của một món ăn

| Trường | Bắt buộc | Mô tả |
|---|---|---|
| Tên món | Có | Tên hiển thị trên thực đơn và phiếu bếp |
| Danh mục | Có | Chọn từ danh mục đã có |
| Giá | Có | Giá bán (VNĐ) |
| Mã món | Không | Mã nội bộ (tự sinh hoặc nhập tay) |
| Ảnh món | Không | Upload ảnh (JPG/PNG, tối đa 2MB) |
| Mô tả | Không | Mô tả ngắn về món |
| Thứ tự hiển thị | Không | Vị trí trong danh mục |
| Trạng thái | Có | Đang bán / Ẩn / Tạm hết |

#### 4.3.2 Business rules quản lý món

- **Ẩn món:** Món không xuất hiện trên giao diện chọn món, nhưng vẫn hiển thị trong lịch sử order cũ
- **Tạm hết:** Món vẫn hiển thị nhưng bị gạch chân và không thể chọn thêm vào order. Hiển thị badge "Hết"
- **Xóa món:** Chỉ được xóa món chưa từng có trong bất kỳ order nào. Nếu đã có trong order: chỉ được ẩn
- Thay đổi giá món **không ảnh hưởng** đến các order đang mở (đã snapshot giá lúc tạo order)

### 4.4 Combo / Set menu

#### 4.4.1 Cấu trúc combo

- Combo là một "món đặc biệt" bao gồm danh sách các món con
- Combo có giá riêng (thường thấp hơn tổng giá các món lẻ)
- Ví dụ: Set đôi = Mì Quảng x2 + Chả giò x4 + 2 nước ngọt = 180,000đ

#### 4.4.2 Hiển thị combo trong order

- Combo xuất hiện như 1 dòng trong order với tên combo và giá combo
- Trên phiếu bếp: in chi tiết từng món trong combo để bếp biết chế biến gì
- Trên hóa đơn khách: chỉ in tên combo và giá (không phân tích chi tiết)

#### 4.4.3 Business rules combo

- Combo có thể bao gồm combo khác (combo lồng nhau) - tối đa 2 cấp
- Khi 1 món trong combo bị ẩn/tạm hết: combo vẫn hiển thị nhưng hiển thị cảnh báo "Liên hệ nhân viên"
- Chủ quán có thể set thời gian hiệu lực của combo (ví dụ: chỉ áp dụng buổi trưa 11h-14h)

### 4.5 Tạm ngưng món hết nguyên liệu

#### 4.5.1 Luồng tạm ngưng

1. Nhân viên bếp hoặc chủ quán phát hiện nguyên liệu hết
2. Vào quản lý thực đơn → tìm món → nhấn **"Tạm hết"**
3. Hệ thống cập nhật trạng thái ngay lập tức
4. Món xuất hiện với badge "Hết" trên tất cả thiết bị

#### 4.5.2 Business rules tạm hết

- Khi đánh dấu tạm hết: hệ thống kiểm tra xem món đó có đang trong order nào chưa thanh toán không → hiển thị cảnh báo để nhân viên xử lý thủ công với bàn đó
- Cuối ngày/ca: chủ quán có thể **"Reset tất cả về Đang bán"** để chuẩn bị cho ca mới (kèm xác nhận)
- Không tự động reset lúc nửa đêm vì quán có thể thiếu nguyên liệu liên tục nhiều ngày

---

## Module 5: Thu Chi {#module-5}

### 5.1 Tổng quan

Module ghi nhận và theo dõi dòng tiền của quán: doanh thu từ bán hàng (tự động) và các khoản chi phí (thủ công). Mục tiêu giúp chủ quán biết lãi/lỗ trong kỳ.

### 5.2 Ghi nhận Thu

#### 5.2.1 Thu tự động từ bán hàng

- Mỗi giao dịch thanh toán thành công → hệ thống **tự động tạo bút toán thu** tương ứng
- Thông tin bút toán thu tự động:
  - Ngày giờ: thời điểm thanh toán
  - Loại: Doanh thu bán hàng
  - Số tiền: tổng bill (sau giảm giá, bao gồm phí dịch vụ)
  - Tham chiếu: mã hóa đơn
  - Phương thức: tiền mặt / chuyển khoản / thẻ

#### 5.2.2 Tổng hợp thu theo ngày

- Màn hình tổng hợp thu trong ngày:
  - Tổng doanh thu
  - Doanh thu theo phương thức thanh toán (tiền mặt, chuyển khoản, thẻ)
  - Số hóa đơn
  - Doanh thu theo danh mục món (bán được gì nhiều nhất)

#### 5.2.3 Xử lý hoàn tiền trong phần thu

- Khi chủ quán hoàn hóa đơn: hệ thống tạo bút toán thu **âm** (ghi giảm doanh thu)
- Báo cáo doanh thu phản ánh đúng doanh thu thuần sau hoàn tiền

### 5.3 Ghi nhận Chi

#### 5.3.1 Danh mục chi phí mặc định

| Danh mục | Ví dụ |
|---|---|
| Nguyên liệu & Thực phẩm | Thịt, rau, gia vị, bún, mì... |
| Đồ uống | Bia, nước ngọt, cà phê... |
| Lương nhân viên | Lương tháng, thưởng, phụ cấp |
| Mặt bằng | Tiền thuê nhà, phí quản lý tòa nhà |
| Điện - Nước - Gas | Hóa đơn điện, nước, bình gas |
| Thiết bị & Sửa chữa | Sửa máy lạnh, mua dụng cụ bếp |
| Marketing | In menu, banner, chạy ads |
| Bao bì & Đóng gói | Túi, hộp, ống hút |
| Chi phí khác | Các khoản phát sinh khác |

- Chủ quán có thể thêm/sửa/ẩn danh mục chi phí

#### 5.3.2 Thêm khoản chi

| Trường | Bắt buộc | Mô tả |
|---|---|---|
| Ngày chi | Có | Ngày thực tế phát sinh chi phí |
| Danh mục | Có | Chọn từ danh mục chi phí |
| Nội dung | Có | Mô tả ngắn gọn (mua gì, trả cho ai) |
| Số tiền | Có | Số tiền chi (VNĐ) |
| Người chi | Có | Tài khoản đăng ký chi (mặc định = người đang đăng nhập) |
| Phương thức | Không | Tiền mặt / Chuyển khoản |
| Ghi chú | Không | Thông tin bổ sung |
| Đính kèm hóa đơn | Không | Upload ảnh hóa đơn/biên lai (JPG/PNG/PDF) |

#### 5.3.3 Business rules ghi nhận chi

- **Chỉ chủ quán** mới được thêm/sửa/xóa khoản chi
- Khoản chi có thể ghi cho ngày trong quá khứ (chủ quán quên ghi hôm trước)
- Đính kèm hóa đơn: tối đa 3 file/khoản chi, mỗi file tối đa 5MB
- **Không cho phép xóa** khoản chi đã tạo quá 30 ngày (chỉ được đánh dấu "Đã hủy" + ghi lý do)

#### 5.3.4 Chỉnh sửa khoản chi

- Có thể sửa khoản chi trong vòng 30 ngày kể từ ngày tạo
- Mọi lần sửa đều ghi lại: ai sửa, thay đổi gì, lúc nào

### 5.4 Báo cáo Thu Chi

#### 5.4.1 Màn hình tổng quan

- Chọn kỳ báo cáo: Hôm nay / Tuần này / Tháng này / Tùy chọn
- Hiển thị:
  - Tổng Thu | Tổng Chi | Lãi/Lỗ
  - Biểu đồ thu chi theo ngày trong kỳ
  - Chi tiết chi theo danh mục (bánh tròn)

#### 5.4.2 Xuất báo cáo

- Xuất file Excel (CSV) danh sách thu chi trong kỳ
- Phiên bản 1.0 chưa hỗ trợ xuất PDF

---

## Module 6: Phân quyền {#module-6}

### 6.1 Tổng quan

Hệ thống phân quyền theo 3 vai trò cố định. Single-tenant nên không cần quản lý multi-store. Chủ quán là superadmin duy nhất.

### 6.2 Các vai trò (Roles)

#### 6.2.1 Chủ quán (Owner)

- **Full access** toàn bộ hệ thống
- Quyền đặc biệt:
  - Quản lý tài khoản nhân viên (tạo, sửa, đặt lại mật khẩu, khóa)
  - Xem và export tất cả báo cáo
  - Cấu hình hệ thống (tên quán, logo, thông tin ngân hàng, phí dịch vụ, VAT...)
  - Áp dụng giảm giá và hoàn hóa đơn
  - Quản lý thu chi
  - Xóa/sửa dữ liệu lịch sử (trong giới hạn)

#### 6.2.2 Thu ngân (Cashier)

- **Được phép:**
  - Xem sơ đồ bàn (tất cả tầng/phòng)
  - Tạo, xem, sửa order (thêm/sửa món chưa gửi bếp, ghi chú)
  - Gửi order xuống bếp
  - Thực hiện thanh toán (tất cả phương thức)
  - Áp dụng giảm giá (theo chính sách chủ quán cho phép)
  - In hóa đơn
  - Xem lịch sử giao dịch trong ngày
  - Xem báo cáo doanh thu cơ bản (tổng ngày, số hóa đơn)
  - Gộp bàn, chuyển bàn
  - Quản lý đặt bàn (tạo, sửa, hủy)
- **Không được phép:**
  - Xem/sửa thu chi
  - Xem báo cáo chi tiết (lãi/lỗ, so sánh)
  - Quản lý tài khoản nhân viên
  - Cấu hình hệ thống
  - Hoàn hóa đơn (refund)
  - Xóa dữ liệu lịch sử

#### 6.2.3 Phục vụ (Waiter)

- **Được phép:**
  - Xem sơ đồ bàn (tất cả tầng/phòng)
  - Tạo order mới
  - Thêm/xóa món vào order (chỉ món chưa gửi bếp)
  - Ghi chú món
  - Gửi order xuống bếp
  - Xem trạng thái món (để biết mang ra bàn nào)
  - Đánh dấu bàn "Đã dọn xong"
  - Xem lịch đặt bàn (chỉ xem)
- **Không được phép:**
  - Thực hiện thanh toán
  - Xem giá tiền và tổng bill (tùy cấu hình chủ quán - có thể bật/tắt)
  - Áp dụng giảm giá
  - Xem lịch sử giao dịch
  - Hủy món đã gửi bếp (phải nhờ thu ngân/chủ quán)
  - Gộp bàn, chuyển bàn (tùy cấu hình - có thể cho phép)
  - Mọi thao tác quản lý khác

### 6.3 Ma trận phân quyền chi tiết

| Chức năng | Chủ quán | Thu ngân | Phục vụ |
|---|:---:|:---:|:---:|
| Xem sơ đồ bàn | V | V | V |
| Tạo order | V | V | V |
| Thêm/sửa món (chưa gửi) | V | V | V |
| Gửi bếp | V | V | V |
| Hủy món đã gửi bếp | V | V | X |
| Thanh toán | V | V | X |
| Áp dụng giảm giá | V | V* | X |
| In hóa đơn | V | V | X |
| Gộp bàn / Chuyển bàn | V | V | X* |
| Quản lý đặt bàn | V | V | Xem |
| Quản lý thực đơn | V | X | X |
| Xem báo cáo doanh thu | V | Cơ bản | X |
| Quản lý thu chi | V | X | X |
| Báo cáo lãi/lỗ | V | X | X |
| Quản lý nhân viên | V | X | X |
| Cấu hình hệ thống | V | X | X |
| Hoàn hóa đơn | V | X | X |

*V* = Thu ngân được giảm giá nếu chủ quán bật quyền này trong cài đặt  
*X** = Phục vụ được gộp/chuyển bàn nếu chủ quán bật quyền này trong cài đặt

### 6.4 Quản lý tài khoản nhân viên

#### 6.4.1 Thông tin tài khoản

| Trường | Mô tả |
|---|---|
| Tên đăng nhập | Dùng để login (không đổi được sau khi tạo) |
| Mật khẩu | Tối thiểu 6 ký tự |
| Họ tên | Tên hiển thị |
| Vai trò | Chủ quán / Thu ngân / Phục vụ |
| Trạng thái | Đang hoạt động / Đã khóa |

#### 6.4.2 Business rules quản lý tài khoản

- **Chỉ có 1 tài khoản chủ quán**, không thể xóa hoặc thay đổi vai trò của tài khoản này
- Thu ngân và Phục vụ: số lượng không giới hạn
- Khi khóa tài khoản: nhân viên đang đăng nhập sẽ bị **đăng xuất ngay lập tức** trong vòng 5 phút
- Đặt lại mật khẩu: chủ quán nhập mật khẩu mới cho nhân viên (không gửi email)
- Tài khoản bị khóa không thể đăng nhập nhưng **lịch sử hoạt động vẫn giữ nguyên**
- Log đăng nhập: ghi lại IP, thiết bị, thời gian đăng nhập/đăng xuất của từng tài khoản

### 6.5 Bảo mật

#### 6.5.1 Xác thực

- Đăng nhập bằng tên đăng nhập + mật khẩu
- Phiên đăng nhập (session): tự động hết hạn sau **8 tiếng** không hoạt động
- Không hỗ trợ đăng nhập nhiều thiết bị cùng lúc (optional - có thể cấu hình)

#### 6.5.2 Audit log

- Ghi lại tất cả hành động quan trọng: áp dụng giảm giá, hủy món, hoàn hóa đơn, thay đổi giá, thay đổi quyền
- Log không thể xóa (kể cả chủ quán)
- Chủ quán có thể xem audit log trong 90 ngày gần nhất

---

## Phụ lục: Luồng nghiệp vụ tổng thể

```
[Khách đến] 
    → Nhân viên chọn bàn trống trên sơ đồ
    → Tạo order mới
    → Chọn món từ thực đơn + ghi chú
    → Gửi bếp (Kitchen Display nhận)
    → Bếp chế biến → đánh dấu "Xong"
    → Nhân viên phục vụ mang ra bàn
    → Khách gọi thêm? → Lặp lại từ bước chọn món
    → Khách yêu cầu tính tiền
    → Thu ngân mở bill → áp dụng giảm giá (nếu có)
    → Chọn phương thức thanh toán → Xác nhận
    → In hóa đơn
    → Bàn chuyển sang "Đang dọn"
    → Nhân viên dọn bàn → nhấn "Đã dọn xong"
    → Bàn chuyển về "Trống"
[Sẵn sàng đón khách tiếp theo]
```

---

*Tài liệu này là Feature Specification cho phiên bản 1.0. Các tính năng đánh dấu "roadmap" sẽ được phát triển ở phiên bản sau.*
