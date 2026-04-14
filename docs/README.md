# Tài liệu Thiết kế Web App — Quán Ăn MyQuang

> **Single-tenant · Web Application · Quản lý quán ăn 14 bàn (2 tầng, 3 khu vực)**

---

## Cấu trúc quán

```
Tầng 1 ─── 6 bàn (T1-B01 đến T1-B06)
Tầng 2 ─┬─ Phòng A: 4 bàn (T2-PA-B01 đến T2-PA-B04)
         └─ Phòng B: 4 bàn (T2-PB-B01 đến T2-PB-B04)
                          Tổng: 14 bàn
```

---

## Danh sách tài liệu

| File | Nội dung | Agent phụ trách |
|------|----------|-----------------|
| [01-PRD.md](./01-PRD.md) | Product Requirements Document — Tổng quan, User Stories, Feature List (62 tính năng, 8 module), NFR, Scope | Business Analyst |
| [02-UI-UX-SPEC.md](./02-UI-UX-SPEC.md) | UI/UX Specification — Design System, Wireframe ASCII 9 màn hình, Component Library, Responsive, Accessibility | UI/UX Designer |
| [03-DATABASE-SCHEMA.md](./03-DATABASE-SCHEMA.md) | Database Schema — ERD, DDL (14 bảng), Indexes, Foreign Keys, Sample Data, Migration Strategy (SQLite → PostgreSQL) | Database Architect |
| [04-FEATURE-SPECS.md](./04-FEATURE-SPECS.md) | Feature Specifications — Nghiệp vụ chi tiết 6 module: Bàn, Order, Thanh toán, Thực đơn, Thu chi, Phân quyền | Product Manager |
| [05-DASHBOARD-REPORTS.md](./05-DASHBOARD-REPORTS.md) | Dashboard & Reports — Real-time dashboard, 5 loại báo cáo, biểu đồ, công thức tính, Export PDF/Excel | Data Analyst |

---

## Tóm tắt kiến trúc hệ thống

### Tech Stack đề xuất (nhẹ, đơn giản)

```
Frontend:  HTML + CSS (Tailwind) + Vanilla JS / Alpine.js
Backend:   Python (FastAPI) hoặc Node.js (Express)
Database:  SQLite (MVP) → PostgreSQL (khi scale)
Auth:      Session-based hoặc JWT
Print:     Browser Print API + jsPDF
Realtime:  Server-Sent Events (SSE) hoặc Polling 5s
Hosting:   VPS đơn giản hoặc Raspberry Pi tại quán
```

### Các module chính

```
┌─────────────────────────────────────────────┐
│              Web App MyQuang                │
├──────────┬──────────┬──────────┬────────────┤
│  Auth &  │  Table   │  Order   │   Menu     │
│  Roles   │   Map    │  Mgmt    │   Mgmt     │
├──────────┼──────────┼──────────┼────────────┤
│ Billing  │ Finance  │Dashboard │  Settings  │
│ Payment  │ (Thu Chi)│ Reports  │            │
└──────────┴──────────┴──────────┴────────────┘
```

### Phân quyền 3 Role

| Quyền | Owner | Cashier | Waiter |
|-------|:-----:|:-------:|:------:|
| Xem sơ đồ bàn | ✓ | ✓ | ✓ |
| Mở bàn / Gọi món | ✓ | ✓ | ✓ |
| Thanh toán | ✓ | ✓ | — |
| Hủy order/hóa đơn | ✓ | — | — |
| Quản lý thực đơn | ✓ | — | — |
| Ghi nhận thu chi | ✓ | — | — |
| Báo cáo đầy đủ | ✓ | Cơ bản | — |
| Quản lý nhân viên | ✓ | — | — |
| Cài đặt hệ thống | ✓ | — | — |

---

## Roadmap

### Phiên bản 1.0 (MVP) — 8–12 tuần
- [x] Xác thực & phân quyền
- [x] Sơ đồ bàn real-time
- [x] Order management đầy đủ
- [x] Hóa đơn & thanh toán (tiền mặt + chuyển khoản)
- [x] In hóa đơn
- [x] Quản lý thực đơn
- [x] Ghi nhận thu chi
- [x] Dashboard & báo cáo cơ bản

### Phiên bản 1.1
- [ ] QR VietQR động cho từng hóa đơn
- [ ] Tách hóa đơn (split bill)
- [ ] Báo cáo nâng cao (heatmap, so sánh kỳ)
- [ ] Export Excel/PDF

### Phiên bản 1.2+
- [ ] Kitchen Display System (màn hình bếp)
- [ ] Đặt bàn trước (reservation)
- [ ] Combo / set menu
- [ ] Backup tự động lên cloud

---

*Ngày tạo: 14/04/2026 — Tạo bởi Agent Team (5 agents song song)*
