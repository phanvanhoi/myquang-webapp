from datetime import datetime
from fastapi import APIRouter, Request, Depends, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Floor, Room, Table, Order, OrderItem, User

router = APIRouter(tags=["tables"])


def get_current_user(request: Request):
    """Return user_id from session or None."""
    return request.session.get("user_id")


def require_auth(request: Request):
    """Redirect to /login if not authenticated."""
    if not request.session.get("user_id"):
        return RedirectResponse(url="/login", status_code=302)
    return None


def _generate_order_code(db: Session) -> str:
    date_str = datetime.utcnow().strftime("%Y%m%d")
    prefix = f"ORD-{date_str}-"
    # Count orders created today to generate sequential code
    count = (
        db.query(Order)
        .filter(Order.order_code.like(f"{prefix}%"))
        .count()
    )
    return f"{prefix}{count + 1:03d}"


# ─────────────────────────────────────────────
# GET /tables  →  sơ đồ bàn
# ─────────────────────────────────────────────

@router.get("/tables", response_class=HTMLResponse)
async def tables_index(request: Request, db: Session = Depends(get_db)):
    redirect = require_auth(request)
    if redirect:
        return redirect

    templates = request.app.state.templates

    # Load all active floors with rooms and tables
    floors = (
        db.query(Floor)
        .filter(Floor.is_active == True)
        .order_by(Floor.sort_order, Floor.id)
        .options(
            joinedload(Floor.rooms),
            joinedload(Floor.tables).joinedload(Table.room),
            joinedload(Floor.tables).joinedload(Table.orders),
        )
        .all()
    )

    # For each table that is occupied/serving, attach the active order
    # Build: floor -> { rooms: [...], tables_by_room: { room_id: [...], None: [...] } }
    floors_data = []
    for floor in floors:
        tables_by_room: dict = {}
        for table in floor.tables:
            if not table.is_active:
                continue
            active_order = None
            for o in table.orders:
                if o.status in ("open", "serving"):
                    active_order = o
                    break
            entry = {
                "table": table,
                "active_order": active_order,
            }
            key = table.room_id  # None means no room (floor-level)
            tables_by_room.setdefault(key, []).append(entry)

        rooms = sorted(
            [r for r in floor.rooms if r.is_active],
            key=lambda r: (r.sort_order, r.id),
        )
        floors_data.append({
            "floor": floor,
            "rooms": rooms,
            "tables_by_room": tables_by_room,
        })

    return templates.TemplateResponse(
        "tables/index.html",
        {
            "request": request,
            "floors_data": floors_data,
        },
    )


# ─────────────────────────────────────────────
# POST /tables/{id}/open  →  mở bàn
# ─────────────────────────────────────────────

@router.post("/tables/{table_id}/open")
async def open_table(
    request: Request,
    table_id: int,
    guest_count: int = Form(default=1),
    db: Session = Depends(get_db),
):
    redirect = require_auth(request)
    if redirect:
        return redirect

    table = db.query(Table).filter(Table.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn")

    if table.status != "available":
        request.session.setdefault("flash", []).append(
            {"type": "error", "message": f"Bàn {table.name} hiện không trống."}
        )
        return RedirectResponse(url="/tables", status_code=302)

    user_id = request.session["user_id"]
    order_code = _generate_order_code(db)

    order = Order(
        table_id=table.id,
        user_id=user_id,
        order_code=order_code,
        status="open",
        guest_count=max(1, guest_count),
        total_amount=0,
        discount_amount=0,
        final_amount=0,
    )
    db.add(order)

    table.status = "occupied"
    db.commit()
    db.refresh(order)

    request.session.setdefault("flash", []).append(
        {"type": "success", "message": f"Đã mở bàn {table.name} — {order_code}"}
    )
    return RedirectResponse(url=f"/tables/{table_id}/order", status_code=302)


# ─────────────────────────────────────────────
# POST /tables/{id}/close  →  đóng bàn
# ─────────────────────────────────────────────

@router.post("/tables/{table_id}/close")
async def close_table(
    request: Request,
    table_id: int,
    db: Session = Depends(get_db),
):
    redirect = require_auth(request)
    if redirect:
        return redirect

    table = db.query(Table).filter(Table.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn")

    # Cancel open/serving orders for this table
    open_orders = (
        db.query(Order)
        .filter(Order.table_id == table_id, Order.status.in_(["open", "serving"]))
        .all()
    )
    for o in open_orders:
        o.status = "cancelled"

    table.status = "available"
    db.commit()

    request.session.setdefault("flash", []).append(
        {"type": "success", "message": f"Đã đóng bàn {table.name}."}
    )
    return RedirectResponse(url="/tables", status_code=302)


# ─────────────────────────────────────────────
# POST /tables/{id}/status  →  đổi trạng thái
# ─────────────────────────────────────────────

@router.post("/tables/{table_id}/status")
async def change_table_status(
    request: Request,
    table_id: int,
    status: str = Form(...),
    db: Session = Depends(get_db),
):
    redirect = require_auth(request)
    if redirect:
        return redirect

    valid_statuses = ("available", "occupied", "reserved", "cleaning")
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Trạng thái không hợp lệ")

    table = db.query(Table).filter(Table.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn")

    table.status = status
    db.commit()

    request.session.setdefault("flash", []).append(
        {"type": "success", "message": f"Đã cập nhật trạng thái bàn {table.name}."}
    )
    return RedirectResponse(url="/tables", status_code=302)


# ─────────────────────────────────────────────
# GET /tables/{id}/order  →  xem order hiện tại
# ─────────────────────────────────────────────

@router.get("/tables/{table_id}/order", response_class=HTMLResponse)
async def table_order(
    request: Request,
    table_id: int,
    db: Session = Depends(get_db),
):
    redirect = require_auth(request)
    if redirect:
        return redirect

    templates = request.app.state.templates

    table = (
        db.query(Table)
        .options(joinedload(Table.floor), joinedload(Table.room))
        .filter(Table.id == table_id)
        .first()
    )
    if not table:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn")

    order = (
        db.query(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.menu_item),
            joinedload(Order.user),
        )
        .filter(
            Order.table_id == table_id,
            Order.status.in_(["open", "serving"]),
        )
        .order_by(Order.created_at.desc())
        .first()
    )

    return templates.TemplateResponse(
        "tables/order_detail.html",
        {
            "request": request,
            "table": table,
            "order": order,
            "now": datetime.utcnow(),
        },
    )
