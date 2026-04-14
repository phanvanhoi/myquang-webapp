from datetime import datetime, date
from fastapi import APIRouter, Request, Depends, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional

from ..database import get_db
from ..models import Order, OrderItem, Payment, PaymentMethod, Transaction, Table, Setting

router = APIRouter(tags=["payments"])


def require_auth(request: Request):
    if not request.session.get("user_id"):
        return RedirectResponse(url="/login", status_code=302)
    return None


# ─────────────────────────────────────────────
# GET /payments/history  →  lịch sử hóa đơn
# ─────────────────────────────────────────────

@router.get("/payments/history", response_class=HTMLResponse)
async def payment_history(
    request: Request,
    date_filter: Optional[str] = None,
    db: Session = Depends(get_db),
):
    redirect = require_auth(request)
    if redirect:
        return redirect

    templates = request.app.state.templates

    # Default to today
    if not date_filter:
        date_filter = date.today().isoformat()

    try:
        filter_date = date.fromisoformat(date_filter)
    except ValueError:
        filter_date = date.today()

    # Query completed orders for the day
    orders = (
        db.query(Order)
        .filter(
            Order.status == "completed",
            func.date(Order.updated_at) == filter_date,
        )
        .options(
            joinedload(Order.table),
            joinedload(Order.payments).joinedload(Payment.method),
        )
        .order_by(Order.updated_at.desc())
        .all()
    )

    # Summary totals
    total_revenue = sum(o.final_amount for o in orders)
    total_cash = 0.0
    total_transfer = 0.0
    for o in orders:
        for p in o.payments:
            if "tiền mặt" in p.method.name.lower() or "cash" in p.method.name.lower():
                total_cash += p.amount
            else:
                total_transfer += p.amount

    return templates.TemplateResponse(
        "payments/history.html",
        {
            "request": request,
            "orders": orders,
            "date_filter": date_filter,
            "total_revenue": total_revenue,
            "total_cash": total_cash,
            "total_transfer": total_transfer,
        },
    )


# ─────────────────────────────────────────────
# GET /payments/{order_id}  →  màn hình thanh toán
# ─────────────────────────────────────────────

@router.get("/payments/{order_id}", response_class=HTMLResponse)
async def checkout_page(
    request: Request,
    order_id: int,
    db: Session = Depends(get_db),
):
    redirect = require_auth(request)
    if redirect:
        return redirect

    templates = request.app.state.templates

    order = (
        db.query(Order)
        .filter(Order.id == order_id)
        .options(
            joinedload(Order.table),
            joinedload(Order.items).joinedload(OrderItem.menu_item),
        )
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    payment_methods = (
        db.query(PaymentMethod).filter(PaymentMethod.is_active == True).all()
    )

    # Get QR/bank info from settings
    settings_rows = db.query(Setting).filter(
        Setting.key.in_(["bank_name", "bank_account", "bank_owner", "qr_image_url"])
    ).all()
    settings = {s.key: s.value for s in settings_rows}

    return templates.TemplateResponse(
        "payments/checkout.html",
        {
            "request": request,
            "order": order,
            "payment_methods": payment_methods,
            "settings": settings,
        },
    )


# ─────────────────────────────────────────────
# POST /payments/{order_id}/confirm  →  xác nhận thanh toán
# ─────────────────────────────────────────────

@router.post("/payments/{order_id}/confirm")
async def confirm_payment(
    request: Request,
    order_id: int,
    cash_amount: float = Form(default=0),
    transfer_amount: float = Form(default=0),
    discount_amount: float = Form(default=0),
    discount_reason: str = Form(default=""),
    db: Session = Depends(get_db),
):
    redirect = require_auth(request)
    if redirect:
        return redirect

    order = (
        db.query(Order)
        .filter(Order.id == order_id)
        .options(joinedload(Order.table))
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    now = datetime.utcnow()

    # 1. Cập nhật discount và final_amount
    order.discount_amount = discount_amount
    order.discount_reason = discount_reason if discount_reason else None
    order.final_amount = max(0, order.total_amount - discount_amount)

    # 2. Tạo Payment records
    cash_method = (
        db.query(PaymentMethod)
        .filter(PaymentMethod.name.ilike("%tiền mặt%"))
        .first()
    )
    transfer_method = (
        db.query(PaymentMethod)
        .filter(PaymentMethod.name.ilike("%chuyển khoản%"))
        .first()
    )

    # Fallback: lấy theo id nếu không tìm được theo tên
    all_methods = db.query(PaymentMethod).filter(PaymentMethod.is_active == True).all()
    if not cash_method and all_methods:
        cash_method = all_methods[0]
    if not transfer_method and len(all_methods) > 1:
        transfer_method = all_methods[1]
    elif not transfer_method and all_methods:
        transfer_method = all_methods[0]

    if cash_amount > 0 and cash_method:
        payment = Payment(
            order_id=order.id,
            method_id=cash_method.id,
            amount=cash_amount,
            paid_at=now,
        )
        db.add(payment)

    if transfer_amount > 0 and transfer_method:
        payment = Payment(
            order_id=order.id,
            method_id=transfer_method.id,
            amount=transfer_amount,
            paid_at=now,
        )
        db.add(payment)

    # 3. Cập nhật order status
    order.status = "completed"
    order.updated_at = now

    # 4. Cập nhật table status
    if order.table:
        order.table.status = "available"
        order.table.updated_at = now

    # 5. Tạo Transaction record
    user_id = request.session.get("user_id")
    transaction = Transaction(
        type="income",
        amount=order.final_amount,
        description=f"Thanh toán HĐ {order.order_code}",
        reference_id=order.id,
        reference_type="order",
        user_id=user_id,
        occurred_at=now,
    )
    db.add(transaction)

    db.commit()

    # Flash message
    flash = request.session.setdefault("flash", [])
    flash.append({"type": "success", "message": f"Thanh toán thành công HĐ {order.order_code}"})

    return RedirectResponse(url="/tables", status_code=302)


# ─────────────────────────────────────────────
# GET /payments/{order_id}/receipt  →  in hóa đơn
# ─────────────────────────────────────────────

@router.get("/payments/{order_id}/receipt", response_class=HTMLResponse)
async def receipt_page(
    request: Request,
    order_id: int,
    db: Session = Depends(get_db),
):
    redirect = require_auth(request)
    if redirect:
        return redirect

    templates = request.app.state.templates

    order = (
        db.query(Order)
        .filter(Order.id == order_id)
        .options(
            joinedload(Order.table),
            joinedload(Order.items).joinedload(OrderItem.menu_item),
            joinedload(Order.payments).joinedload(Payment.method),
        )
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    settings_rows = db.query(Setting).filter(
        Setting.key.in_(["restaurant_name", "address", "phone"])
    ).all()
    settings = {s.key: s.value for s in settings_rows}

    return templates.TemplateResponse(
        "payments/receipt.html",
        {
            "request": request,
            "order": order,
            "settings": settings,
        },
    )
