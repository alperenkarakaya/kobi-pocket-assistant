import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base, SessionLocal
from routers import dashboard, webhook, actions, tasks, stock, analysis, analytics
from routers import notifications as notifications_router
from routers import suppliers as suppliers_router
from routers import auth as auth_router
from services.auth_service import require_auth
import models  # noqa: F401

logger = logging.getLogger(__name__)


async def _morning_briefing_loop(telegram_app) -> None:
    """Sends daily stock briefing at 08:00 to all registered chats."""
    from services.telegram_bot import send_briefing, get_active_chat_ids

    while True:
        now = datetime.now()
        next_8am = now.replace(hour=8, minute=0, second=0, microsecond=0)
        if now >= next_8am:
            next_8am += timedelta(days=1)

        wait_secs = (next_8am - now).total_seconds()
        logger.info("Morning briefing scheduled in %.1fh", wait_secs / 3600)
        await asyncio.sleep(wait_secs)

        chat_ids = get_active_chat_ids()
        if not chat_ids:
            logger.info("No registered chats — skipping morning briefing.")
            continue

        for chat_id in chat_ids:
            try:
                await send_briefing(telegram_app.bot, chat_id)
                logger.info("Morning briefing sent to chat %s", chat_id)
            except Exception as exc:
                logger.error("Briefing failed for chat %s: %s", chat_id, exc)


async def _proactive_stock_monitor(telegram_app) -> None:
    """
    Checks stock levels every 15 minutes.
    Sends a Telegram alert and creates a notification when a product
    newly drops below its threshold since the last check.
    """
    from services.telegram_bot import get_active_chat_ids
    from sqlalchemy import func
    import crud

    previously_critical: set[int] = set()
    # First pass establishes baseline silently — we don't know which products
    # were already critical before the process started, so emitting alerts for
    # all of them would flood Telegram + notifications on every restart.
    is_first_run = True
    await asyncio.sleep(60)  # let DB initialize before first check

    while True:
        db = SessionLocal()
        try:
            products = db.query(models.Product).all()
            now_critical: set[int] = set()
            newly_critical: list[tuple[str, float, float, str]] = []

            for p in products:
                stock = (
                    db.query(func.sum(models.StockMovement.quantity))
                    .filter(models.StockMovement.product_id == p.id)
                    .scalar() or 0.0
                )
                if p.threshold > 0 and stock < p.threshold:
                    now_critical.add(p.id)
                    if not is_first_run and p.id not in previously_critical:
                        newly_critical.append((p.name, stock, p.threshold, p.unit))

            previously_critical = now_critical
            is_first_run = False

            for name, stock, threshold, unit in newly_critical:
                pct = int(stock / threshold * 100) if threshold > 0 else 0
                crud.create_notification(
                    db,
                    title=f"Stok uyarısı: {name} kritik seviyeye düştü",
                    body=f"Mevcut: {stock:.0f} {unit} | Eşik: {threshold:.0f} {unit} | Doluluk: %{pct}",
                    type="alert",
                )

            if newly_critical and telegram_app:
                chat_ids = get_active_chat_ids()
                lines = ["🚨 *Stok Uyarısı!*\n"]
                for name, stock, threshold, unit in newly_critical:
                    lines.append(f"• *{name}*: {stock:.0f}/{threshold:.0f} {unit}")
                lines.append("\nDashboard'dan *Tedarik Analizi* başlatabilirsiniz.")
                msg = "\n".join(lines)

                for chat_id in chat_ids:
                    try:
                        await telegram_app.bot.send_message(
                            chat_id=chat_id, text=msg, parse_mode="Markdown"
                        )
                    except Exception as exc:
                        logger.error("Stock alert to chat %s failed: %s", chat_id, exc)

        except Exception as exc:
            logger.error("Proactive stock monitor error: %s", exc)
        finally:
            db.close()

        await asyncio.sleep(15 * 60)  # 15-minute intervals


def _run_migrations() -> None:
    """Add new columns to existing tables that were created before schema updates."""
    from sqlalchemy import text
    migrations = [
        "ALTER TABLE products ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id)",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
                logger.info("Migration applied: %s", sql[:60])
            except Exception:
                pass  # column already exists — safe to ignore


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_migrations()

    from services.telegram_bot import build_application
    telegram_app = build_application()
    briefing_task = None
    monitor_task = None

    if telegram_app:
        await telegram_app.initialize()
        await telegram_app.start()
        await telegram_app.updater.start_polling(drop_pending_updates=True)
        briefing_task = asyncio.create_task(_morning_briefing_loop(telegram_app))
        monitor_task = asyncio.create_task(_proactive_stock_monitor(telegram_app))
        print("🤖 Telegram botu başlatıldı. Brifing zamanlayıcısı + stok monitörü aktif.")

    yield

    if briefing_task:
        briefing_task.cancel()
    if monitor_task:
        monitor_task.cancel()
    if telegram_app:
        await telegram_app.updater.stop()
        await telegram_app.stop()
        await telegram_app.shutdown()
        print("🤖 Telegram botu durduruldu.")


app = FastAPI(
    title="KOBI Pocket Assistant API",
    description="Agricultural Cooperative SME Assistant — Telegram + CrewAI + Dashboard",
    version="4.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000",
                   "http://localhost:3001", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_auth_dep = [Depends(require_auth)]

app.include_router(auth_router.router, prefix="/api")  # public — no auth
app.include_router(webhook.router, prefix="/api")       # public — called by Twilio/WhatsApp/Telegram
app.include_router(dashboard.router, prefix="/api", dependencies=_auth_dep)
app.include_router(actions.router, prefix="/api", dependencies=_auth_dep)
app.include_router(tasks.router, prefix="/api", dependencies=_auth_dep)
app.include_router(stock.router, prefix="/api", dependencies=_auth_dep)
app.include_router(analysis.router, prefix="/api", dependencies=_auth_dep)
app.include_router(analytics.router, prefix="/api", dependencies=_auth_dep)
app.include_router(notifications_router.router, prefix="/api", dependencies=_auth_dep)
app.include_router(suppliers_router.router, prefix="/api", dependencies=_auth_dep)


@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "KOBI Pocket Assistant API",
        "version": "4.0.0",
        "status": "operational",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}
