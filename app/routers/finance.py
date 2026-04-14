from datetime import datetime, date
from fastapi import APIRouter, Request, Depends, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract
from typing import Optional

from ..database import get_db
from ..models import Expense, ExpenseCategory, Payment, Transaction

router = APIRouter(tags=["finance"])


def require_auth(request: Request):
    if not request.session.get("user_id"):
        return RedirectResponse(url="/login", status_code=302)
    return None


def require_admin(request: Request):
    if not request.session.get("user_id"):
        return RedirectResponse(url="/login", status_code=302)
    if request.session.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Chỉ admin mới có quyền thực hiện thao tác này")
    return None


# ─────────────────────────────────────────────
# GET /finance  →  trang tổng quan thu chi
# ─────────────────────────────────────────────

@router.get("/finance", response_class=HTMLResponse)
async def finance_index(
    request: Request,
    month: Optional[str] = None,
    db: Session = Depends(get_db),
):
    redirect = require_auth(request)
    if redirect:
        return redirect

    templates = request.app.state.templates
    today = date.today()

    # Parse month filter (YYYY-MM)
    if month:
        try:
            year, mon = map(int, month.split("-"))
        except ValueError:
            year, mon = today.year, today.month
    else:
        year, mon = today.year, today.month
        month = today.strftime("%Y-%m")

    # Tổng thu hôm nay (từ payments của completed orders)
    total_income_today = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(func.date(Payment.paid_at) == today)
        .scalar()
    ) or 0.0

    # Tổng chi hôm nay
    total_expense_today = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(func.date(Expense.occurred_at) == today)
        .scalar()
    ) or 0.0

    profit_today = total_income_today - total_expense_today

    # Danh sách chi phí trong tháng được chọn
    expenses = (
        db.query(Expense)
        .filter(
            extract("year", Expense.occurred_at) == year,
            extract("month", Expense.occurred_at) == mon,
        )
        .options(joinedload(Expense.category), joinedload(Expense.user))
        .order_by(Expense.occurred_at.desc())
        .all()
    )

    # Danh mục chi
    categories = (
        db.query(ExpenseCategory)
        .filter(ExpenseCategory.is_active == True)
        .order_by(ExpenseCategory.name)
        .all()
    )

    return templates.TemplateResponse(
        "finance/index.html",
        {
            "request": request,
            "total_income_today": total_income_today,
            "total_expense_today": total_expense_today,
            "profit_today": profit_today,
            "expenses": expenses,
            "categories": categories,
            "month": month,
            "today": today.isoformat(),
        },
    )


# ─────────────────────────────────────────────
# POST /finance/expenses  →  tạo khoản chi mới
# ─────────────────────────────────────────────

@router.post("/finance/expenses")
async def create_expense(
    request: Request,
    category_id: int = Form(...),
    amount: float = Form(...),
    description: str = Form(...),
    occurred_at: str = Form(...),
    db: Session = Depends(get_db),
):
    redirect = require_auth(request)
    if redirect:
        return redirect

    user_id = request.session.get("user_id")

    try:
        occurred_dt = datetime.fromisoformat(occurred_at)
    except ValueError:
        occurred_dt = datetime.utcnow()

    expense = Expense(
        category_id=category_id,
        user_id=user_id,
        amount=amount,
        description=description,
        occurred_at=occurred_dt,
    )
    db.add(expense)

    # Tạo Transaction record cho khoản chi
    transaction = Transaction(
        type="expense",
        amount=amount,
        description=description,
        reference_type="expense",
        user_id=user_id,
        occurred_at=occurred_dt,
    )
    db.add(transaction)
    db.commit()

    flash = request.session.setdefault("flash", [])
    flash.append({"type": "success", "message": "Đã ghi nhận khoản chi"})

    return RedirectResponse(url="/finance", status_code=302)


# ─────────────────────────────────────────────
# GET /finance/expenses/{id}/edit  →  form sửa
# ─────────────────────────────────────────────

@router.get("/finance/expenses/{expense_id}/edit", response_class=HTMLResponse)
async def edit_expense_form(
    request: Request,
    expense_id: int,
    db: Session = Depends(get_db),
):
    redirect = require_auth(request)
    if redirect:
        return redirect

    templates = request.app.state.templates

    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Không tìm thấy khoản chi")

    categories = (
        db.query(ExpenseCategory)
        .filter(ExpenseCategory.is_active == True)
        .order_by(ExpenseCategory.name)
        .all()
    )

    return templates.TemplateResponse(
        "finance/edit_expense.html",
        {
            "request": request,
            "expense": expense,
            "categories": categories,
        },
    )


# ─────────────────────────────────────────────
# POST /finance/expenses/{id}/edit  →  lưu sửa
# ─────────────────────────────────────────────

@router.post("/finance/expenses/{expense_id}/edit")
async def update_expense(
    request: Request,
    expense_id: int,
    category_id: int = Form(...),
    amount: float = Form(...),
    description: str = Form(...),
    occurred_at: str = Form(...),
    db: Session = Depends(get_db),
):
    err = require_admin(request)
    if err:
        return err

    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Không tìm thấy khoản chi")

    try:
        occurred_dt = datetime.fromisoformat(occurred_at)
    except ValueError:
        occurred_dt = expense.occurred_at

    expense.category_id = category_id
    expense.amount = amount
    expense.description = description
    expense.occurred_at = occurred_dt
    expense.updated_at = datetime.utcnow()

    db.commit()

    flash = request.session.setdefault("flash", [])
    flash.append({"type": "success", "message": "Đã cập nhật khoản chi"})

    return RedirectResponse(url="/finance", status_code=302)


# ─────────────────────────────────────────────
# POST /finance/expenses/{id}/delete  →  xóa
# ─────────────────────────────────────────────

@router.post("/finance/expenses/{expense_id}/delete")
async def delete_expense(
    request: Request,
    expense_id: int,
    db: Session = Depends(get_db),
):
    err = require_admin(request)
    if err:
        return err

    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Không tìm thấy khoản chi")

    db.delete(expense)
    db.commit()

    flash = request.session.setdefault("flash", [])
    flash.append({"type": "success", "message": "Đã xóa khoản chi"})

    return RedirectResponse(url="/finance", status_code=302)


# ─────────────────────────────────────────────
# GET /finance/categories  →  quản lý danh mục
# ─────────────────────────────────────────────

@router.get("/finance/categories", response_class=HTMLResponse)
async def categories_page(
    request: Request,
    db: Session = Depends(get_db),
):
    redirect = require_auth(request)
    if redirect:
        return redirect

    templates = request.app.state.templates

    categories = (
        db.query(ExpenseCategory)
        .order_by(ExpenseCategory.name)
        .all()
    )

    return templates.TemplateResponse(
        "finance/categories.html",
        {
            "request": request,
            "categories": categories,
        },
    )


# ─────────────────────────────────────────────
# POST /finance/categories  →  tạo danh mục
# ─────────────────────────────────────────────

@router.post("/finance/categories")
async def create_category(
    request: Request,
    name: str = Form(...),
    description: str = Form(default=""),
    db: Session = Depends(get_db),
):
    redirect = require_auth(request)
    if redirect:
        return redirect

    cat = ExpenseCategory(
        name=name,
        description=description if description else None,
    )
    db.add(cat)
    db.commit()

    flash = request.session.setdefault("flash", [])
    flash.append({"type": "success", "message": f"Đã tạo danh mục '{name}'"})

    return RedirectResponse(url="/finance/categories", status_code=302)


# ─────────────────────────────────────────────
# POST /finance/categories/{id}/delete  →  xóa danh mục
# ─────────────────────────────────────────────

@router.post("/finance/categories/{cat_id}/delete")
async def delete_category(
    request: Request,
    cat_id: int,
    db: Session = Depends(get_db),
):
    err = require_admin(request)
    if err:
        return err

    cat = db.query(ExpenseCategory).filter(ExpenseCategory.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")

    # Kiểm tra có expense đang dùng không
    count = db.query(Expense).filter(Expense.category_id == cat_id).count()
    if count > 0:
        flash = request.session.setdefault("flash", [])
        flash.append({"type": "error", "message": f"Không thể xóa danh mục đang có {count} khoản chi"})
        return RedirectResponse(url="/finance/categories", status_code=302)

    db.delete(cat)
    db.commit()

    flash = request.session.setdefault("flash", [])
    flash.append({"type": "success", "message": "Đã xóa danh mục"})

    return RedirectResponse(url="/finance/categories", status_code=302)
