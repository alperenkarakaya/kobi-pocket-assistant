"""
CrewAI tools — DB-backed functions the Stock Analyst agent can call.
Each tool creates its own short-lived DB session to avoid lifecycle issues
with the FastAPI request session running concurrently with the crew.
"""

import json
import logging
from datetime import datetime, timedelta

from crewai.tools import tool
from sqlalchemy import func

import models
from database import SessionLocal

logger = logging.getLogger(__name__)


@tool("get_all_stock_status")
def get_all_stock_status() -> str:
    """
    Returns a JSON array of ALL products with their current stock levels,
    thresholds, stock_ratio, deficit, and whether they are critical.
    Always call this first before any other tool.
    """
    db = SessionLocal()
    try:
        products = db.query(models.Product).all()
        result = []
        for p in products:
            stock = db.query(func.sum(models.StockMovement.quantity)) \
                       .filter(models.StockMovement.product_id == p.id).scalar() or 0.0
            ratio = round(stock / p.threshold, 3) if p.threshold > 0 else 999.0
            is_critical = stock < p.threshold
            is_warning  = (not is_critical) and ratio < 1.2
            # Urgency is pre-computed from hard thresholds — agents must not override this.
            # HIGH:   stock below threshold (ratio < 1.0)
            # MEDIUM: stock within 20% above threshold (1.0 <= ratio < 1.2)
            # LOW:    stock comfortably above threshold (ratio >= 1.2)
            urgency = "HIGH" if is_critical else ("MEDIUM" if is_warning else "LOW")
            result.append({
                "id": p.id,
                "name": p.name,
                "unit": p.unit,
                "current_stock": round(stock, 2),
                "threshold": p.threshold,
                "stock_ratio": ratio,
                "deficit": round(max(0.0, p.threshold - stock), 2),
                "is_critical": is_critical,
                "is_warning": is_warning,
                "urgency": urgency,
            })
        return json.dumps(result, ensure_ascii=False)
    finally:
        db.close()


@tool("get_consumption_rate")
def get_consumption_rate(product_id: int, days: int = 7) -> str:
    """
    Returns the average daily consumption (outgoing movements) for a product
    over the past N days. Use this to understand how fast a product is being used.
    Input: product_id (int), days (int, default 7)
    """
    db = SessionLocal()
    try:
        since = datetime.utcnow() - timedelta(days=days)
        total_out = db.query(func.sum(models.StockMovement.quantity)) \
            .filter(
                models.StockMovement.product_id == product_id,
                models.StockMovement.type == "out",
                models.StockMovement.timestamp >= since,
            ).scalar() or 0.0
        daily_avg = round(abs(total_out) / max(days, 1), 3)
        return json.dumps({
            "product_id": product_id,
            "period_days": days,
            "total_outgoing": round(abs(total_out), 2),
            "daily_avg_consumption": daily_avg,
        })
    finally:
        db.close()


@tool("get_movement_history")
def get_movement_history(product_id: int, limit: int = 10) -> str:
    """
    Returns the most recent stock movements for a product as a formatted list.
    Use this to spot trends: repeated outgoing movements = high demand.
    Input: product_id (int), limit (int, default 10)
    """
    db = SessionLocal()
    try:
        rows = db.query(models.StockMovement) \
            .filter(models.StockMovement.product_id == product_id) \
            .order_by(models.StockMovement.timestamp.desc()) \
            .limit(limit).all()
        if not rows:
            return "Hareket kaydı bulunamadı."
        lines = [
            f"{r.timestamp.strftime('%Y-%m-%d')} | {r.type:3} | {r.quantity:+.1f} | {r.source}"
            for r in rows
        ]
        return "\n".join(lines)
    finally:
        db.close()
