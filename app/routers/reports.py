from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Request, Query
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from sqlalchemy import func, cast, Date
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Order, OrderItem, MenuItem, MenuCategory,
    Payment, Expense, ExpenseCategory, Table, Floor, Room
)

router = APIRouter(tags=["reports"])


def require_login(request: Request):
    if not request.session.get("user_id"):
        return RedirectResponse(url="/login", status_code=302)
    return None


# ─────────────────────────────────────────────
# DASHBOARD
# ─────────────────────────────────────────────

@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request, db: Session = Depends(get_db)):
    redir = require_login(request)
    if redir:
        return redir

    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())

    # Doanh thu hôm nay (từ payments của orders completed hôm nay)
    today_revenue = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.paid_at >= today_start,
        Payment.paid_at <= today_end,
    ).scalar() or 0

    # Số hóa đơn hôm nay (orders completed)
    today_orders = db.query(func.count(Order.id)).filter(
        Order.created_at >= today_start,
        Order.created_at <= today_end,
        Order.status.in_(["completed"]),
    ).scalar() or 0

    # Số bàn đang có khách
    occupied_count = db.query(func.count(Table.id)).filter(
        Table.status == "occupied",
        Table.is_active == True,
    ).scalar() or 0

    total_tables = db.query(func.count(Table.id)).filter(
        Table.is_active == True
    ).scalar() or 0

    # Tổng chi hôm nay
    today_expense = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
        Expense.occurred_at >= today_start,
        Expense.occurred_at <= today_end,
    ).scalar() or 0

    # Top 5 món bán chạy hôm nay
    top_items = (
        db.query(
            MenuItem.name,
            MenuCategory.name.label("category"),
            func.sum(OrderItem.quantity).label("total_qty"),
            func.sum(OrderItem.subtotal).label("total_revenue"),
        )
        .join(MenuItem, OrderItem.item_id == MenuItem.id)
        .join(MenuCategory, MenuItem.category_id == MenuCategory.id)
        .join(Order, OrderItem.order_id == Order.id)
        .filter(
            Order.created_at >= today_start,
            Order.created_at <= today_end,
            Order.status != "cancelled",
        )
        .group_by(MenuItem.id, MenuItem.name, MenuCategory.name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(5)
        .all()
    )

    # Doanh thu 7 ngày gần nhất
    chart_labels = []
    chart_data = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        d_start = datetime.combine(d, datetime.min.time())
        d_end = datetime.combine(d, datetime.max.time())
        rev = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
            Payment.paid_at >= d_start,
            Payment.paid_at <= d_end,
        ).scalar() or 0
        chart_labels.append(d.strftime("%d/%m"))
        chart_data.append(float(rev))

    # Danh sách bàn đang occupied với thông tin floor
    occupied_tables = (
        db.query(Table, Floor.name.label("floor_name"))
        .join(Floor, Table.floor_id == Floor.id)
        .filter(Table.status == "occupied", Table.is_active == True)
        .order_by(Floor.sort_order, Table.code)
        .all()
    )

    # Tất cả bàn với floor info cho sơ đồ mini
    all_tables = (
        db.query(Table, Floor.name.label("floor_name"), Floor.id.label("floor_id_val"))
        .join(Floor, Table.floor_id == Floor.id)
        .filter(Table.is_active == True)
        .order_by(Floor.sort_order, Table.code)
        .all()
    )

    # Group bàn theo tầng
    floors_map: dict = {}
    for tbl, floor_name, floor_id_val in all_tables:
        if floor_id_val not in floors_map:
            floors_map[floor_id_val] = {"name": floor_name, "tables": []}
        floors_map[floor_id_val]["tables"].append(tbl)

    templates = request.app.state.templates
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "today_revenue": today_revenue,
        "today_orders": today_orders,
        "occupied_count": occupied_count,
        "total_tables": total_tables,
        "today_expense": today_expense,
        "top_items": top_items,
        "chart_labels": chart_labels,
        "chart_data": chart_data,
        "occupied_tables": occupied_tables,
        "floors_map": floors_map,
        "today": today,
    })


# ─────────────────────────────────────────────
# REPORTS INDEX
# ─────────────────────────────────────────────

@router.get("/reports", response_class=HTMLResponse)
async def reports_index(request: Request, db: Session = Depends(get_db)):
    redir = require_login(request)
    if redir:
        return redir

    templates = request.app.state.templates
    return templates.TemplateResponse("reports/index.html", {
        "request": request,
    })


# ─────────────────────────────────────────────
# REVENUE REPORT (JSON for Chart.js)
# ─────────────────────────────────────────────

@router.get("/reports/revenue")
async def reports_revenue(
    request: Request,
    period: str = Query("day", regex="^(day|week|month)$"),
    date_str: Optional[str] = Query(None, alias="date"),
    db: Session = Depends(get_db),
):
    if not request.session.get("user_id"):
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    # Parse date
    try:
        ref_date = datetime.strptime(date_str, "%Y-%m-%d").date() if date_str else date.today()
    except ValueError:
        ref_date = date.today()

    labels = []
    data = []

    if period == "day":
        # 24 giờ trong ngày
        for hour in range(24):
            h_start = datetime.combine(ref_date, datetime.min.time()).replace(hour=hour)
            h_end = h_start + timedelta(hours=1)
            rev = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
                Payment.paid_at >= h_start,
                Payment.paid_at < h_end,
            ).scalar() or 0
            labels.append(f"{hour:02d}:00")
            data.append(float(rev))

    elif period == "week":
        # 7 ngày của tuần chứa ref_date
        week_start = ref_date - timedelta(days=ref_date.weekday())
        for i in range(7):
            d = week_start + timedelta(days=i)
            d_start = datetime.combine(d, datetime.min.time())
            d_end = datetime.combine(d, datetime.max.time())
            rev = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
                Payment.paid_at >= d_start,
                Payment.paid_at <= d_end,
            ).scalar() or 0
            labels.append(d.strftime("%d/%m"))
            data.append(float(rev))

    elif period == "month":
        # Từng ngày trong tháng của ref_date
        import calendar
        year, month = ref_date.year, ref_date.month
        days_in_month = calendar.monthrange(year, month)[1]
        for day_num in range(1, days_in_month + 1):
            d = date(year, month, day_num)
            d_start = datetime.combine(d, datetime.min.time())
            d_end = datetime.combine(d, datetime.max.time())
            rev = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
                Payment.paid_at >= d_start,
                Payment.paid_at <= d_end,
            ).scalar() or 0
            labels.append(str(day_num))
            data.append(float(rev))

    total = sum(data)
    avg = total / len(data) if data else 0
    max_val = max(data) if data else 0
    min_val = min(d for d in data if d > 0) if any(d > 0 for d in data) else 0

    return JSONResponse({
        "labels": labels,
        "data": data,
        "summary": {
            "total": total,
            "avg": avg,
            "max": max_val,
            "min": min_val,
        }
    })


# ─────────────────────────────────────────────
# ITEMS REPORT (JSON)
# ─────────────────────────────────────────────

@router.get("/reports/items")
async def reports_items(
    request: Request,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    if not request.session.get("user_id"):
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    try:
        s = datetime.strptime(start_date, "%Y-%m-%d") if start_date else datetime.combine(date.today(), datetime.min.time())
        e = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59) if end_date else datetime.combine(date.today(), datetime.max.time())
    except ValueError:
        s = datetime.combine(date.today(), datetime.min.time())
        e = datetime.combine(date.today(), datetime.max.time())

    rows = (
        db.query(
            MenuItem.name,
            MenuCategory.name.label("category"),
            func.sum(OrderItem.quantity).label("total_qty"),
            func.sum(OrderItem.subtotal).label("total_revenue"),
        )
        .join(MenuItem, OrderItem.item_id == MenuItem.id)
        .join(MenuCategory, MenuItem.category_id == MenuCategory.id)
        .join(Order, OrderItem.order_id == Order.id)
        .filter(
            Order.created_at >= s,
            Order.created_at <= e,
            Order.status != "cancelled",
        )
        .group_by(MenuItem.id, MenuItem.name, MenuCategory.name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(20)
        .all()
    )

    total_revenue = sum(r.total_revenue for r in rows)

    items = []
    for r in rows:
        pct = (r.total_revenue / total_revenue * 100) if total_revenue > 0 else 0
        items.append({
            "name": r.name,
            "category": r.category,
            "qty": int(r.total_qty),
            "revenue": float(r.total_revenue),
            "pct": round(pct, 1),
        })

    return JSONResponse({
        "items": items,
        "total_revenue": total_revenue,
    })


# ─────────────────────────────────────────────
# FINANCE REPORT (JSON)
# ─────────────────────────────────────────────

@router.get("/reports/finance")
async def reports_finance(
    request: Request,
    month: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    if not request.session.get("user_id"):
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    import calendar
    try:
        if month:
            year, mon = map(int, month.split("-"))
        else:
            today = date.today()
            year, mon = today.year, today.month
    except (ValueError, AttributeError):
        today = date.today()
        year, mon = today.year, today.month

    days_in_month = calendar.monthrange(year, mon)[1]
    m_start = datetime(year, mon, 1)
    m_end = datetime(year, mon, days_in_month, 23, 59, 59)

    # Tổng thu (payments trong tháng)
    total_income = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.paid_at >= m_start,
        Payment.paid_at <= m_end,
    ).scalar() or 0

    # Tổng chi (expenses trong tháng)
    total_expense = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
        Expense.occurred_at >= m_start,
        Expense.occurred_at <= m_end,
    ).scalar() or 0

    # Chi theo danh mục
    expense_by_cat = (
        db.query(
            ExpenseCategory.name,
            func.sum(Expense.amount).label("total"),
        )
        .join(ExpenseCategory, Expense.category_id == ExpenseCategory.id)
        .filter(
            Expense.occurred_at >= m_start,
            Expense.occurred_at <= m_end,
        )
        .group_by(ExpenseCategory.id, ExpenseCategory.name)
        .order_by(func.sum(Expense.amount).desc())
        .all()
    )

    # Chi tiết chi phí
    expenses_detail = (
        db.query(Expense, ExpenseCategory.name.label("cat_name"))
        .join(ExpenseCategory, Expense.category_id == ExpenseCategory.id)
        .filter(
            Expense.occurred_at >= m_start,
            Expense.occurred_at <= m_end,
        )
        .order_by(Expense.occurred_at.desc())
        .all()
    )

    return JSONResponse({
        "total_income": float(total_income),
        "total_expense": float(total_expense),
        "profit": float(total_income) - float(total_expense),
        "expense_by_cat": [
            {"name": r.name, "total": float(r.total)} for r in expense_by_cat
        ],
        "expenses_detail": [
            {
                "id": e.Expense.id,
                "date": e.Expense.occurred_at.strftime("%d/%m/%Y"),
                "category": e.cat_name,
                "description": e.Expense.description,
                "amount": float(e.Expense.amount),
            }
            for e in expenses_detail
        ],
    })
