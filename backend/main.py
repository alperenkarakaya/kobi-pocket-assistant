from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import dashboard, webhook, actions, tasks, stock, analysis
import models  # noqa: F401 — ensures models are registered with Base before create_all


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create all tables on startup (idempotent — safe to run repeatedly)."""
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="KOBI Pocket Assistant API",
    description="Agricultural Cooperative SME Assistant — WhatsApp + AI + Dashboard",
    version="1.0.0",
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
        "version": "1.0.0",
        "status": "operational",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}
