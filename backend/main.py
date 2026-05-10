from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import dashboard, webhook, actions, tasks, stock, analysis
import models  # noqa: F401 — ensures models are registered with Base before create_all


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create DB tables + start Telegram bot. Shutdown: stop bot gracefully."""
    Base.metadata.create_all(bind=engine)

    # ── Telegram bot (non-blocking asyncio polling) ─────────────────────────
    from services.telegram_bot import build_application
    telegram_app = build_application()
    if telegram_app:
        await telegram_app.initialize()
        await telegram_app.start()
        await telegram_app.updater.start_polling(drop_pending_updates=True)
        print("🤖 Telegram botu başlatıldı.")

    yield

    if telegram_app:
        await telegram_app.updater.stop()
        await telegram_app.stop()
        await telegram_app.shutdown()
        print("🤖 Telegram botu durduruldu.")


app = FastAPI(
    title="KOBI Pocket Assistant API",
    description="Agricultural Cooperative SME Assistant — Telegram + CrewAI + Dashboard",
    version="2.0.0",
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

app.include_router(dashboard.router, prefix="/api")
app.include_router(webhook.router, prefix="/api")
app.include_router(actions.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(stock.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")


@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "KOBI Pocket Assistant API",
        "version": "2.0.0",
        "status": "operational",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}
