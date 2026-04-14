from fastapi import APIRouter, Request, Depends, Form
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import json

from ..database import get_db
from ..models import Order, OrderItem, MenuItem, MenuCategory, Table

router = APIRouter(prefix="/orders", tags=["orders"])


def require_login(request: Request):
    if not request.session.get("user_id"):
        return RedirectResponse(url="/login", status_code=302)
    return None


def flash(request: Request, message: str, type: str = "success"):
    if "flash" not in request.session:
        request.session["flash"] = []
    request.session["flash"].append({"message": message, "type": type})


def recalc_order(order: Order, db: Session):
    """Recalculate total_amount and final_amount from active order items."""
    active_items = [i for i in order.items if i.status != "cancelled"]
    total = sum(i.subtotal for i in active_items)
    order.total_amount = total
    order.final_amount = total - order.discount_amount
    db.commit()


# ── GET /orders ────────────────────────────────────────────────────────────────
@router.get("", response_class=HTMLResponse)
async def orders_index(
    request: Request,
    db: Session = Depends(get_db),
):
    redirect = require_login(request)
    if redirect:
        return redirect

    orders = (
        db.query(Order)
        .options(
            joinedload(Order.table),
            joinedload(Order.items),
        )
        .filter(Order.status.in_(["open", "serving"]))
        .order_by(Order.created_at.desc())
        .all()
    )

    templates = request.app.state.templates
    return templates.TemplateResponse(
        "orders/index.html",
        {"request": request, "orders": orders},
    )


# ── GET /orders/{id} ───────────────────────────────────────────────────────────
@router.get("/{order_id}", response_class=HTMLResponse)
async def order_detail(
    order_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    redirect = require_login(request)
    if redirect:
        return redirect

    order = (
        db.query(Order)
        .options(
            joinedload(Order.table),
            joinedload(Order.user),
            joinedload(Order.items).joinedload(OrderItem.menu_item),
        )
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        flash(request, "Không tìm thấy order.", "error")
        return RedirectResponse(url="/orders", status_code=302)

    templates = request.app.state.templates
    return templates.TemplateResponse(
        "orders/detail.html",
        {"request": request, "order": order},
    )


# ── GET /orders/{id}/add-items ─────────────────────────────────────────────────
@router.get("/{order_id}/add-items", response_class=HTMLResponse)
async def add_items_page(
    order_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    redirect = require_login(request)
    if redirect:
        return redirect

    order = (
        db.query(Order)
        .options(
            joinedload(Order.table),
            joinedload(Order.items).joinedload(OrderItem.menu_item),
        )
        .filter(Order.id == order_id)
        .first()
    )
    if not order or order.status not in ("open", "serving"):
        flash(request, "Order không hợp lệ hoặc đã đóng.", "error")
        return RedirectResponse(url="/orders", status_code=302)

    categories = (
        db.query(MenuCategory)
        .filter(MenuCategory.is_active == True)
        .order_by(MenuCategory.sort_order, MenuCategory.name)
        .all()
    )
    items = (
        db.query(MenuItem)
        .filter(MenuItem.is_active == True)
        .order_by(MenuItem.category_id, MenuItem.sort_order, MenuItem.name)
        .all()
    )

    menu_json = json.dumps(
        [
            {
                "id": it.id,
                "name": it.name,
                "price": it.base_price,
                "cat_id": it.category_id,
                "available": it.is_available,
            }
            for it in items
        ],
        ensure_ascii=False,
    )

    templates = request.app.state.templates
    return templates.TemplateResponse(
        "orders/add_items.html",
        {
            "request": request,
            "order": order,
            "categories": categories,
            "menu_items": items,
            "menu_json": menu_json,
        },
    )


# ── POST /orders/{id}/add-items ────────────────────────────────────────────────
@router.post("/{order_id}/add-items")
async def add_items_post(
    order_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    redirect = require_login(request)
    if redirect:
        return redirect

    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or order.status not in ("open", "serving"):
        return JSONResponse({"error": "Order không hợp lệ."}, status_code=400)

    body = await request.json()
    cart: List[dict] = body if isinstance(body, list) else body.get("items", [])

    if not cart:
        flash(request, "Giỏ hàng trống.", "error")
        return RedirectResponse(url=f"/orders/{order_id}/add-items", status_code=302)

    for entry in cart:
        item_id = int(entry.get("item_id", 0))
        qty = max(1, int(entry.get("quantity", 1)))
        note = str(entry.get("note", "")).strip()

        menu_item = db.query(MenuItem).filter(
            MenuItem.id == item_id, MenuItem.is_active == True
        ).first()
        if not menu_item:
            continue

        order_item = OrderItem(
            order_id=order.id,
            item_id=menu_item.id,
            quantity=qty,
            unit_price=menu_item.base_price,
            subtotal=menu_item.base_price * qty,
            note=note or None,
            status="pending",
        )
        db.add(order_item)

    # Update order status to serving once items added
    if order.status == "open":
        order.status = "serving"

    db.flush()
    # Reload items for recalc
    db.refresh(order)
    recalc_order(order, db)

    flash(request, f"Đã thêm {len(cart)} món vào order.")
    return RedirectResponse(url=f"/orders/{order_id}", status_code=302)


# ── POST /orders/{id}/items/{item_id}/remove ──────────────────────────────────
@router.post("/{order_id}/items/{oi_id}/remove")
async def remove_order_item(
    order_id: int,
    oi_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    redirect = require_login(request)
    if redirect:
        return redirect

    oi = db.query(OrderItem).filter(
        OrderItem.id == oi_id, OrderItem.order_id == order_id
    ).first()

    if oi and oi.status == "pending":
        db.delete(oi)
        db.flush()
        order = db.query(Order).filter(Order.id == order_id).first()
        if order:
            recalc_order(order, db)
        flash(request, "Đã xóa món khỏi order.")
    else:
        flash(request, "Chỉ xóa được món chưa gửi bếp.", "error")

    return RedirectResponse(url=f"/orders/{order_id}", status_code=302)


# ── POST /orders/{id}/items/{oi_id}/cancel ────────────────────────────────────
@router.post("/{order_id}/items/{oi_id}/cancel")
async def cancel_order_item(
    order_id: int,
    oi_id: int,
    request: Request,
    reason: str = Form(""),
    db: Session = Depends(get_db),
):
    redirect = require_login(request)
    if redirect:
        return redirect

    oi = db.query(OrderItem).filter(
        OrderItem.id == oi_id, OrderItem.order_id == order_id
    ).first()

    if oi and oi.status in ("preparing", "served"):
        oi.status = "cancelled"
        if reason:
            oi.note = f"[HỦY: {reason}] " + (oi.note or "")
        db.flush()
        order = db.query(Order).filter(Order.id == order_id).first()
        if order:
            recalc_order(order, db)
        flash(request, "Đã hủy món.")
    elif oi and oi.status == "pending":
        flash(request, "Món chưa gửi bếp, hãy dùng chức năng Xóa.", "error")
    else:
        flash(request, "Không thể hủy món này.", "error")

    return RedirectResponse(url=f"/orders/{order_id}", status_code=302)


# ── POST /orders/{id}/send-to-kitchen ─────────────────────────────────────────
@router.post("/{order_id}/send-to-kitchen")
async def send_to_kitchen(
    order_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    redirect = require_login(request)
    if redirect:
        return redirect

    order = db.query(Order).options(joinedload(Order.items)).filter(Order.id == order_id).first()
    if not order:
        flash(request, "Không tìm thấy order.", "error")
        return RedirectResponse(url="/orders", status_code=302)

    count = 0
    for oi in order.items:
        if oi.status == "pending":
            oi.status = "preparing"
            count += 1

    if order.status == "open":
        order.status = "serving"

    db.commit()
    if count:
        flash(request, f"Đã gửi {count} món xuống bếp.")
    else:
        flash(request, "Không có món nào cần gửi bếp.", "error")

    return RedirectResponse(url=f"/orders/{order_id}", status_code=302)


# ── POST /orders/{id}/cancel ───────────────────────────────────────────────────
@router.post("/{order_id}/cancel")
async def cancel_order(
    order_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    redirect = require_login(request)
    if redirect:
        return redirect

    order = db.query(Order).options(joinedload(Order.items)).filter(Order.id == order_id).first()
    if not order or order.status not in ("open", "serving"):
        flash(request, "Order không thể hủy.", "error")
        return RedirectResponse(url="/orders", status_code=302)

    for oi in order.items:
        if oi.status != "cancelled":
            oi.status = "cancelled"

    order.status = "cancelled"
    order.total_amount = 0
    order.final_amount = 0
    db.commit()

    # Free the table
    table = db.query(Table).filter(Table.id == order.table_id).first()
    if table:
        table.status = "available"
        db.commit()

    flash(request, f"Đã hủy order {order.order_code}.")
    return RedirectResponse(url="/orders", status_code=302)
