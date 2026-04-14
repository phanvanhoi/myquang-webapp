from fastapi import APIRouter, Request, Depends, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from typing import Optional
import json

from ..database import get_db
from ..models import MenuCategory, MenuItem

router = APIRouter(prefix="/menu", tags=["menu"])


def require_admin(request: Request):
    if not request.session.get("user_id"):
        return RedirectResponse(url="/login", status_code=302)
    if request.session.get("role") != "admin":
        return RedirectResponse(url="/dashboard", status_code=302)
    return None


def flash(request: Request, message: str, type: str = "success"):
    if "flash" not in request.session:
        request.session["flash"] = []
    request.session["flash"].append({"message": message, "type": type})


# ── GET /menu ──────────────────────────────────────────────────────────────────
@router.get("", response_class=HTMLResponse)
async def menu_index(
    request: Request,
    db: Session = Depends(get_db),
):
    redirect = require_admin(request)
    if redirect:
        return redirect

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

    # Build JSON for Alpine.js
    cat_map = {c.id: c.name for c in categories}
    items_json = json.dumps([
        {
            "id": it.id,
            "name": it.name,
            "desc": it.description or "",
            "price": it.base_price,
            "cat_id": it.category_id,
            "cat_name": cat_map.get(it.category_id, ""),
            "available": it.is_available,
        }
        for it in items
    ], ensure_ascii=False)

    templates = request.app.state.templates
    return templates.TemplateResponse(
        "menu/index.html",
        {
            "request": request,
            "categories": categories,
            "items": items,
            "items_json": items_json,
        },
    )


# ── GET /menu/categories ───────────────────────────────────────────────────────
@router.get("/categories", response_class=HTMLResponse)
async def categories_index(
    request: Request,
    db: Session = Depends(get_db),
):
    redirect = require_admin(request)
    if redirect:
        return redirect

    categories = (
        db.query(MenuCategory)
        .filter(MenuCategory.is_active == True)
        .order_by(MenuCategory.sort_order, MenuCategory.name)
        .all()
    )

    templates = request.app.state.templates
    return templates.TemplateResponse(
        "menu/categories.html",
        {"request": request, "categories": categories},
    )


# ── POST /menu/categories ──────────────────────────────────────────────────────
@router.post("/categories")
async def create_category(
    request: Request,
    name: str = Form(...),
    description: str = Form(""),
    sort_order: int = Form(0),
    db: Session = Depends(get_db),
):
    redirect = require_admin(request)
    if redirect:
        return redirect

    cat = MenuCategory(name=name.strip(), description=description.strip() or None, sort_order=sort_order)
    db.add(cat)
    db.commit()
    flash(request, f"Đã thêm danh mục "{name}".")
    return RedirectResponse(url="/menu/categories", status_code=302)


# ── POST /menu/categories/{id}/edit ───────────────────────────────────────────
@router.post("/categories/{cat_id}/edit")
async def edit_category(
    cat_id: int,
    request: Request,
    name: str = Form(...),
    description: str = Form(""),
    sort_order: int = Form(0),
    db: Session = Depends(get_db),
):
    redirect = require_admin(request)
    if redirect:
        return redirect

    cat = db.query(MenuCategory).filter(MenuCategory.id == cat_id).first()
    if cat:
        cat.name = name.strip()
        cat.description = description.strip() or None
        cat.sort_order = sort_order
        db.commit()
        flash(request, f"Đã cập nhật danh mục "{name}".")
    return RedirectResponse(url="/menu/categories", status_code=302)


# ── POST /menu/categories/{id}/delete ─────────────────────────────────────────
@router.post("/categories/{cat_id}/delete")
async def delete_category(
    cat_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    redirect = require_admin(request)
    if redirect:
        return redirect

    cat = db.query(MenuCategory).filter(MenuCategory.id == cat_id).first()
    if cat:
        cat.is_active = False
        db.commit()
        flash(request, f"Đã ẩn danh mục "{cat.name}".")
    return RedirectResponse(url="/menu/categories", status_code=302)


# ── GET /menu/items/new ────────────────────────────────────────────────────────
@router.get("/items/new", response_class=HTMLResponse)
async def new_item_form(
    request: Request,
    db: Session = Depends(get_db),
):
    redirect = require_admin(request)
    if redirect:
        return redirect

    categories = (
        db.query(MenuCategory)
        .filter(MenuCategory.is_active == True)
        .order_by(MenuCategory.sort_order, MenuCategory.name)
        .all()
    )

    templates = request.app.state.templates
    return templates.TemplateResponse(
        "menu/form.html",
        {"request": request, "categories": categories, "item": None},
    )


# ── POST /menu/items ───────────────────────────────────────────────────────────
@router.post("/items")
async def create_item(
    request: Request,
    category_id: int = Form(...),
    name: str = Form(...),
    description: str = Form(""),
    base_price: float = Form(...),
    sort_order: int = Form(0),
    is_available: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    redirect = require_admin(request)
    if redirect:
        return redirect

    item = MenuItem(
        category_id=category_id,
        name=name.strip(),
        description=description.strip() or None,
        base_price=base_price,
        sort_order=sort_order,
        is_available=is_available == "on",
    )
    db.add(item)
    db.commit()
    flash(request, f"Đã thêm món "{name}".")
    return RedirectResponse(url="/menu", status_code=302)


# ── GET /menu/items/{id}/edit ──────────────────────────────────────────────────
@router.get("/items/{item_id}/edit", response_class=HTMLResponse)
async def edit_item_form(
    item_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    redirect = require_admin(request)
    if redirect:
        return redirect

    item = db.query(MenuItem).filter(MenuItem.id == item_id, MenuItem.is_active == True).first()
    if not item:
        flash(request, "Không tìm thấy món ăn.", "error")
        return RedirectResponse(url="/menu", status_code=302)

    categories = (
        db.query(MenuCategory)
        .filter(MenuCategory.is_active == True)
        .order_by(MenuCategory.sort_order, MenuCategory.name)
        .all()
    )

    templates = request.app.state.templates
    return templates.TemplateResponse(
        "menu/form.html",
        {"request": request, "categories": categories, "item": item},
    )


# ── POST /menu/items/{id}/edit ─────────────────────────────────────────────────
@router.post("/items/{item_id}/edit")
async def update_item(
    item_id: int,
    request: Request,
    category_id: int = Form(...),
    name: str = Form(...),
    description: str = Form(""),
    base_price: float = Form(...),
    sort_order: int = Form(0),
    is_available: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    redirect = require_admin(request)
    if redirect:
        return redirect

    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if item:
        item.category_id = category_id
        item.name = name.strip()
        item.description = description.strip() or None
        item.base_price = base_price
        item.sort_order = sort_order
        item.is_available = is_available == "on"
        db.commit()
        flash(request, f"Đã cập nhật món "{name}".")
    return RedirectResponse(url="/menu", status_code=302)


# ── POST /menu/items/{id}/toggle ──────────────────────────────────────────────
@router.post("/items/{item_id}/toggle")
async def toggle_item(
    item_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    redirect = require_admin(request)
    if redirect:
        return redirect

    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if item:
        item.is_available = not item.is_available
        db.commit()
        status = "Có sẵn" if item.is_available else "Tạm hết"
        flash(request, f"Món "{item.name}" → {status}.")
    return RedirectResponse(url="/menu", status_code=302)


# ── POST /menu/items/{id}/delete ──────────────────────────────────────────────
@router.post("/items/{item_id}/delete")
async def delete_item(
    item_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    redirect = require_admin(request)
    if redirect:
        return redirect

    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if item:
        item.is_active = False
        db.commit()
        flash(request, f"Đã ẩn món "{item.name}".")
    return RedirectResponse(url="/menu", status_code=302)
