# Thiết kế Web App Quán Ăn MyQuang

## Mục tiêu chung
- Ứng dụng web nội bộ dành riêng cho 1 quán ăn.
- Giao diện nhẹ, thân thiện, hiện đại.
- Tập trung vào nghiệp vụ đặt bàn, quản lý thu chi và báo cáo.
- Đơn giản để nhân viên và quản lý sử dụng.

## Phạm vi sử dụng
- Chỉ dùng cho quán MyQuang.
- Quản lý duy nhất 1 cơ sở, 1 menu, 1 bộ bàn ghế.
- Không cần đa chi nhánh, không cần phân quyền phức tạp.

## Mô tả không gian quán
- Tầng 1: 6 bàn.
- Tầng 2: chia 2 phòng, mỗi phòng 4 bàn, tổng 8 bàn.
- Tổng: 14 bàn.

## Người dùng chính
- Nhân viên phục vụ: quản lý tình trạng bàn, tạo order, ghi chú.
- Quản lý/quản trị: xem báo cáo doanh thu, quản lý thu chi, thống kê.

## Luồng nghiệp vụ chính
1. Nhận khách và chọn bàn.
2. Khai báo thông tin bàn (số người, phòng/tầng).
3. Tạo order cho bàn, thêm món.
4. Cập nhật trạng thái bàn: trống, đã đặt, đang phục vụ, đã thanh toán.
5. Quản lý chi phí: thu tiền, chi phí nhập hàng, chi phí khác.
6. Xem báo cáo doanh thu, lãi lỗ, tình trạng bàn.

## Chức năng chính

### Quản lý bàn
- Danh sách bàn theo tầng/phòng.
- Màu sắc trạng thái trực quan:
  - Trống
  - Có khách
  - Đã đặt trước
  - Đang phục vụ
  - Chờ tính tiền
- Có thể chuyển bàn.
- Ghi chú bàn (yêu cầu đặc biệt, order nhóm).

### Quản lý order
- Tạo và thêm món cho bàn.
- Chỉnh sửa số lượng, ghi chú món.
- Xóa món hoặc điều chỉnh order.
- Hiện tổng tiền tạm tính.
- Ghi nhận yêu cầu đặc biệt (nêm nhạt, chay, không cay...).

### Thu chi
- Ghi nhận thu tiền bán hàng theo hóa đơn.
- Quản lý chi phí nhập hàng, điện nước, thuê nhân viên, chi phí khác.
- Lưu lịch sử thu chi theo ngày.
- Cho phép phân loại chi thân thiện: Nhập hàng, Tiền điện, Tiền nước, Lương, Khác.

### Dashboard & báo cáo
- Báo cáo doanh thu theo ngày/tuần/tháng.
- Tổng thu, tổng chi, lợi nhuận.
- Tỷ lệ bàn đang sử dụng.
- Doanh thu theo tầng/phòng.
- Báo cáo món bán chạy.
- Xuất báo cáo nhanh (PDF/Excel nếu cần mở rộng sau này).

### Quản lý menu
- Danh sách món ăn/kèm giá.
- Nhóm món: đồ uống, món chính, tráng miệng.
- Tùy chỉnh giá dễ dàng.
- Tìm kiếm món.

## Thiết kế UI/UX
- Giao diện đơn giản, dễ dùng cho điện thoại và máy tính bảng.
- Màu sắc nhẹ nhàng, tối ưu độ tương phản cho người phục vụ.
- Menu điều hướng rõ ràng:
  - Trang chính: bản đồ bàn
  - Order & Thanh toán
  - Thu chi
  - Báo cáo
  - Danh mục món
- Trình bày trực quan:
  - Bản đồ bàn dạng lưới/tầng
  - Thẻ bàn rõ trạng thái
  - Biểu đồ doanh thu đơn giản trên dashboard.

## Kiến trúc đề xuất
### Frontend
- HTML/CSS/JavaScript nhẹ hoặc framework nhỏ như Vue 3 / React nếu muốn mở rộng.
- UI component đơn giản: card, bảng, biểu đồ nhỏ.

### Backend
- Node.js + Express hoặc Python Flask/ FastAPI cho API nhẹ.
- Cơ sở dữ liệu SQLite hoặc MySQL để lưu bàn, order, thu chi.

### Lưu trữ dữ liệu
- Bảng `tables`: thông tin bàn, tầng/phòng, trạng thái.
- Bảng `orders`: lịch sử order, tổng tiền, trạng thái.
- Bảng `order_items`: chi tiết món.
- Bảng `menu_items`: danh sách món.
- Bảng `finance`: thu chi.

## Trang chính đề xuất
1. Dashboard tổng quan
2. Quản lý bàn/tầng
3. Quản lý order
4. Thu chi
5. Báo cáo
6. Menu

## Gợi ý hiển thị bản đồ bàn
- Tầng 1: 6 bàn theo lưới 2 cột x 3 hàng.
- Tầng 2: 2 phòng, mỗi phòng 4 bàn 2x2.
- Phân tầng/phòng rõ ràng, có lọc theo trạng thái bàn.

## Gợi ý dashboard
- Widget doanh thu ngày hôm nay.
- Widget tổng chi phí tuần này.
- Widget lợi nhuận.
- Biểu đồ cột đơn giản: doanh thu theo ngày.
- Bảng top 5 món bán chạy.

## Ưu tiên khi phát triển
- Tốc độ mở app nhanh.
- Giao diện thân thiện, dễ nhìn.
- Dễ học cho nhân viên mới.
- Tập trung vào nghiệp vụ bàn, order, thu chi và báo cáo.
- Hạn chế các chức năng không cần thiết.

## Kết luận
Đây là một ứng dụng nội bộ dành riêng cho quán MyQuang với:
- Quản lý bàn theo tầng/phòng.
- Quản lý order và thanh toán.
- Quản lý thu chi.
- Dashboard báo cáo doanh thu/lợi nhuận.
- UI nhẹ, thân thiện và tối ưu cho vận hành quán.

---

**Tiếp theo**: Có thể mở rộng bằng prototype màn hình hoặc mockup cho từng trang nếu bạn muốn.
