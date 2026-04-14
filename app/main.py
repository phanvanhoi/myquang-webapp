from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse
from starlette.middleware.sessions import SessionMiddleware
import os

from .database import engine
from .models import Base
from .seed import seed
from .routers import auth, tables, menu, orders, payments, finance, reports, settings as settings_router

# ── Create tables & seed ──
Base.metadata.create_all(bind=engine)
seed()

app = FastAPI(title="MyQuang Restaurant", docs_url=None, redoc_url=None)

# ── Middleware ──
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SECRET_KEY", "myquang-secret-key-2026"),
    max_age=14400,  # 4 hours
)

# ── Static files ──
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# ── Templates ──
templates = Jinja2Templates(directory="app/templates")

# ── Routers ──
app.include_router(auth.router)
app.include_router(tables.router)
app.include_router(menu.router)
app.include_router(orders.router)
app.include_router(payments.router)
app.include_router(finance.router)
app.include_router(reports.router)
app.include_router(settings_router.router)


@app.get("/")
async def root(request: Request):
    if not request.session.get("user_id"):
        return RedirectResponse(url="/login", status_code=302)
    return RedirectResponse(url="/dashboard", status_code=302)


# ── Jinja2 filters ──
def format_currency(value: float) -> str:
    return f"{int(value):,}đ".replace(",", ".")

def format_datetime(value) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return value.strftime("%d/%m/%Y %H:%M")

def format_date(value) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value[:10]
    return value.strftime("%d/%m/%Y")

templates.env.filters["currency"] = format_currency
templates.env.filters["dt"] = format_datetime
templates.env.filters["date"] = format_date

# Make templates accessible to routers
app.state.templates = templates
