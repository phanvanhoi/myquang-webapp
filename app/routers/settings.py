import secrets
import string
from typing import Optional

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Setting, User, Role

router = APIRouter(tags=["settings"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def require_login(request: Request):
    if not request.session.get("user_id"):
        return RedirectResponse(url="/login", status_code=302)
    return None


def require_admin(request: Request):
    if not request.session.get("user_id"):
        return RedirectResponse(url="/login", status_code=302)
    if request.session.get("role") != "admin":
        return RedirectResponse(url="/dashboard", status_code=302)
    return None


def get_setting(db: Session, key: str, default: str = "") -> str:
    s = db.query(Setting).filter(Setting.key == key).first()
    return s.value if s else default


def set_setting(db: Session, key: str, value: str, description: str = ""):
    s = db.query(Setting).filter(Setting.key == key).first()
    if s:
        s.value = value
    else:
        s = Setting(key=key, value=value, description=description)
        db.add(s)


def flash(request: Request, message: str, msg_type: str = "success"):
    if "flash" not in request.session:
        request.session["flash"] = []
    request.session["flash"].append({"message": message, "type": msg_type})


# ─────────────────────────────────────────────
# SETTINGS INDEX
# ─────────────────────────────────────────────

@router.get("/settings", response_class=HTMLResponse)
async def settings_page(request: Request, db: Session = Depends(get_db)):
    redir = require_login(request)
    if redir:
        return redir

    settings_map = {
        "restaurant_name": get_setting(db, "restaurant_name", "MyQuang"),
        "address": get_setting(db, "address"),
        "phone": get_setting(db, "phone"),
        "bank_account": get_setting(db, "bank_account"),
        "bank_name": get_setting(db, "bank_name"),
        "bank_owner": get_setting(db, "bank_owner"),
        "receipt_footer_note": get_setting(db, "receipt_footer_note"),
    }

    users = []
    roles = []
    if request.session.get("role") == "admin":
        users = (
            db.query(User, Role.name.label("role_name"))
            .join(Role, User.role_id == Role.id)
            .order_by(User.id)
            .all()
        )
        roles = db.query(Role).filter(Role.name != "").order_by(Role.id).all()

    templates = request.app.state.templates
    return templates.TemplateResponse("settings/index.html", {
        "request": request,
        "settings": settings_map,
        "users": users,
        "roles": roles,
    })


@router.post("/settings")
async def settings_save(
    request: Request,
    restaurant_name: str = Form(""),
    address: str = Form(""),
    phone: str = Form(""),
    bank_account: str = Form(""),
    bank_name: str = Form(""),
    bank_owner: str = Form(""),
    receipt_footer_note: str = Form(""),
    db: Session = Depends(get_db),
):
    redir = require_login(request)
    if redir:
        return redir

    fields = {
        "restaurant_name": restaurant_name,
        "address": address,
        "phone": phone,
        "bank_account": bank_account,
        "bank_name": bank_name,
        "bank_owner": bank_owner,
        "receipt_footer_note": receipt_footer_note,
    }
    for key, value in fields.items():
        set_setting(db, key, value)
    db.commit()

    flash(request, "Đã lưu cài đặt thành công!")
    return RedirectResponse(url="/settings", status_code=302)


# ─────────────────────────────────────────────
# USER MANAGEMENT (admin only)
# ─────────────────────────────────────────────

@router.get("/settings/users", response_class=HTMLResponse)
async def settings_users(request: Request, db: Session = Depends(get_db)):
    redir = require_admin(request)
    if redir:
        return redir
    return RedirectResponse(url="/settings?tab=users", status_code=302)


@router.post("/settings/users")
async def create_user(
    request: Request,
    username: str = Form(...),
    full_name: str = Form(...),
    role_id: int = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    redir = require_admin(request)
    if redir:
        return redir

    existing = db.query(User).filter(User.username == username).first()
    if existing:
        flash(request, f"Username '{username}' đã tồn tại!", "error")
        return RedirectResponse(url="/settings?tab=users", status_code=302)

    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        flash(request, "Vai trò không hợp lệ!", "error")
        return RedirectResponse(url="/settings?tab=users", status_code=302)

    new_user = User(
        username=username,
        full_name=full_name,
        role_id=role_id,
        password_hash=pwd_context.hash(password),
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    flash(request, f"Đã tạo tài khoản '{full_name}' thành công!")
    return RedirectResponse(url="/settings?tab=users", status_code=302)


@router.post("/settings/users/{user_id}/toggle")
async def toggle_user(
    request: Request,
    user_id: int,
    db: Session = Depends(get_db),
):
    redir = require_admin(request)
    if redir:
        return redir

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        flash(request, "Không tìm thấy tài khoản!", "error")
    elif user.username == request.session.get("username"):
        flash(request, "Không thể vô hiệu hóa tài khoản đang đăng nhập!", "error")
    else:
        user.is_active = not user.is_active
        db.commit()
        status_text = "kích hoạt" if user.is_active else "vô hiệu hóa"
        flash(request, f"Đã {status_text} tài khoản '{user.full_name}'!")

    return RedirectResponse(url="/settings?tab=users", status_code=302)


@router.post("/settings/users/{user_id}/reset-password")
async def reset_password(
    request: Request,
    user_id: int,
    db: Session = Depends(get_db),
):
    redir = require_admin(request)
    if redir:
        return redir

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        flash(request, "Không tìm thấy tài khoản!", "error")
    else:
        # Generate random 8-char password
        alphabet = string.ascii_letters + string.digits
        new_pw = "".join(secrets.choice(alphabet) for _ in range(8))
        user.password_hash = pwd_context.hash(new_pw)
        db.commit()
        flash(request, f"Mật khẩu mới của '{user.full_name}': {new_pw}", "success")

    return RedirectResponse(url="/settings?tab=users", status_code=302)
