"""Seed initial data for MyQuang restaurant."""
from datetime import datetime
from passlib.context import CryptContext
from .database import SessionLocal, engine
from .models import Base, Floor, Room, Table, MenuCategory, MenuItem
from .models import PaymentMethod, ExpenseCategory, Role, User, Setting

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Skip if already seeded
        if db.query(Floor).count() > 0:
            print("Database already seeded. Skipping.")
            return

        print("Seeding database...")

        # ── Roles ──
        role_admin = Role(name="admin", description="Chủ quán - Toàn quyền",
            permissions='["all"]')
        role_cashier = Role(name="cashier", description="Thu ngân",
            permissions='["order.view","order.create","order.edit","payment.create","payment.view","menu.view"]')
        role_waiter = Role(name="waiter", description="Phục vụ",
            permissions='["order.view","order.create","order.edit","menu.view"]')
        db.add_all([role_admin, role_cashier, role_waiter])
        db.flush()

        # ── Users ──
        admin = User(role_id=role_admin.id, username="admin",
            full_name="Chủ quán MyQuang",
            password_hash=pwd_context.hash("admin123"),
            pin_code="1234")
        cashier = User(role_id=role_cashier.id, username="thungan",
            full_name="Thu ngân",
            password_hash=pwd_context.hash("thungan123"),
            pin_code="3456")
        waiter = User(role_id=role_waiter.id, username="phucvu",
            full_name="Phục vụ",
            password_hash=pwd_context.hash("phucvu123"),
            pin_code="4567")
        db.add_all([admin, cashier, waiter])
        db.flush()

        # ── Floors ──
        f1 = Floor(name="Tầng 1", sort_order=1)
        f2 = Floor(name="Tầng 2", sort_order=2)
        db.add_all([f1, f2])
        db.flush()

        # ── Rooms (Tầng 2) ──
        room_a = Room(floor_id=f2.id, name="Phòng A", capacity=16, sort_order=1)
        room_b = Room(floor_id=f2.id, name="Phòng B", capacity=16, sort_order=2)
        db.add_all([room_a, room_b])
        db.flush()

        # ── Tables ──
        tables = []
        # Tầng 1: 6 bàn
        for i in range(1, 7):
            tables.append(Table(
                floor_id=f1.id, room_id=None,
                code=f"T1-B{i:02d}", name=f"Bàn {i:02d}",
                capacity=4 if i <= 4 else 6
            ))
        # Phòng A: 4 bàn
        for i in range(1, 5):
            tables.append(Table(
                floor_id=f2.id, room_id=room_a.id,
                code=f"T2-PA-B{i:02d}", name=f"Bàn A{i:02d}",
                capacity=4
            ))
        # Phòng B: 4 bàn
        for i in range(1, 5):
            tables.append(Table(
                floor_id=f2.id, room_id=room_b.id,
                code=f"T2-PB-B{i:02d}", name=f"Bàn B{i:02d}",
                capacity=4
            ))
        db.add_all(tables)

        # ── Menu Categories ──
        cat_main = MenuCategory(name="Món chính", sort_order=1)
        cat_starter = MenuCategory(name="Khai vị", sort_order=2)
        cat_drink = MenuCategory(name="Đồ uống", sort_order=3)
        cat_dessert = MenuCategory(name="Tráng miệng", sort_order=4)
        db.add_all([cat_main, cat_starter, cat_drink, cat_dessert])
        db.flush()

        # ── Menu Items ──
        items = [
            MenuItem(category_id=cat_main.id, name="Cơm sườn nướng", base_price=65000, sort_order=1),
            MenuItem(category_id=cat_main.id, name="Cơm gà xào sả ớt", base_price=60000, sort_order=2),
            MenuItem(category_id=cat_main.id, name="Bún bò Huế", base_price=55000, sort_order=3),
            MenuItem(category_id=cat_main.id, name="Phở bò tái nạm", base_price=60000, sort_order=4),
            MenuItem(category_id=cat_main.id, name="Mì xào hải sản", base_price=70000, sort_order=5),
            MenuItem(category_id=cat_starter.id, name="Gỏi cuốn (2 cuốn)", base_price=35000, sort_order=1),
            MenuItem(category_id=cat_starter.id, name="Chả giò (4 cái)", base_price=40000, sort_order=2),
            MenuItem(category_id=cat_starter.id, name="Soup cua", base_price=45000, sort_order=3),
            MenuItem(category_id=cat_drink.id, name="Cà phê đen đá", base_price=25000, sort_order=1),
            MenuItem(category_id=cat_drink.id, name="Cà phê sữa đá", base_price=30000, sort_order=2),
            MenuItem(category_id=cat_drink.id, name="Trà đào cam sả", base_price=45000, sort_order=3),
            MenuItem(category_id=cat_drink.id, name="Nước ngọt lon", base_price=20000, sort_order=4),
            MenuItem(category_id=cat_drink.id, name="Bia Tiger lon", base_price=35000, sort_order=5),
            MenuItem(category_id=cat_drink.id, name="Nước suối", base_price=15000, sort_order=6),
            MenuItem(category_id=cat_dessert.id, name="Chè đậu xanh", base_price=25000, sort_order=1),
            MenuItem(category_id=cat_dessert.id, name="Kem ba màu", base_price=30000, sort_order=2),
        ]
        db.add_all(items)

        # ── Payment Methods ──
        db.add_all([
            PaymentMethod(name="Tiền mặt", description="Khách trả tiền mặt"),
            PaymentMethod(name="Chuyển khoản", description="Chuyển khoản / quét QR"),
            PaymentMethod(name="Momo", description="Ví điện tử Momo"),
        ])

        # ── Expense Categories ──
        db.add_all([
            ExpenseCategory(name="Nguyên vật liệu"),
            ExpenseCategory(name="Điện - Nước"),
            ExpenseCategory(name="Lương nhân viên"),
            ExpenseCategory(name="Thuê mặt bằng"),
            ExpenseCategory(name="Sửa chữa - Bảo trì"),
            ExpenseCategory(name="Marketing"),
            ExpenseCategory(name="Chi phí khác"),
        ])

        # ── Settings ──
        db.add_all([
            Setting(key="restaurant_name", value="Quán Ăn MyQuang", description="Tên quán"),
            Setting(key="restaurant_address", value="123 Đường ABC, TP.HCM", description="Địa chỉ"),
            Setting(key="restaurant_phone", value="0901234567", description="Số điện thoại"),
            Setting(key="tax_rate", value="0", description="Thuế suất (%)"),
            Setting(key="service_charge_rate", value="0", description="Phí phục vụ (%)"),
            Setting(key="currency", value="VND", description="Đơn vị tiền tệ"),
            Setting(key="receipt_footer_note", value="Cảm ơn quý khách đã dùng bữa tại MyQuang! ❤️", description="Ghi chú phiếu thu"),
            Setting(key="bank_account", value="", description="Số tài khoản ngân hàng"),
            Setting(key="bank_name", value="", description="Tên ngân hàng"),
            Setting(key="bank_owner", value="", description="Tên chủ tài khoản"),
        ])

        db.commit()
        print("✅ Database seeded successfully!")
        print("   Tài khoản: admin / admin123")
        print("   Thu ngân: thungan / thungan123")
        print("   Phục vụ: phucvu / phucvu123")

    except Exception as e:
        db.rollback()
        print(f"❌ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
