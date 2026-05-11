"""
Analytics endpoint — 7-day stock consumption trends.

GET /api/analytics/trends
  Returns per-product consumption rates, days-to-empty forecasts,
  and weekly in/out summaries sorted by urgency.
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
from database import get_db

router = APIRouter(tags=["Analytics"])


@router.get("/analytics/trends")
def get_trends(db: Session = Depends(get_db)):
    products = db.query(models.Product).all()
    results = []

    for p in products:
        current_stock = (
            db.query(func.sum(models.StockMovement.quantity))
            .filter(models.StockMovement.product_id == p.id)
            .scalar() or 0.0
        )

        since_7d = datetime.utcnow() - timedelta(days=7)

        total_out = (
            db.query(func.sum(models.StockMovement.quantity))
            .filter(
                models.StockMovement.product_id == p.id,
                models.StockMovement.type == "out",
                models.StockMovement.timestamp >= since_7d,
            )
            .scalar() or 0.0
        )
        total_in = (
            db.query(func.sum(models.StockMovement.quantity))
            .filter(
                models.StockMovement.product_id == p.id,
                models.StockMovement.type == "in",
                models.StockMovement.timestamp >= since_7d,
            )
            .scalar() or 0.0
        )

        daily_avg = round(abs(total_out) / 7, 2)
        days_to_empty = round(current_stock / daily_avg, 1) if daily_avg > 0 else None
        stock_ratio = round(current_stock / p.threshold, 3) if p.threshold > 0 else 1.0

        movement_count = (
            db.query(models.StockMovement)
            .filter(
                models.StockMovement.product_id == p.id,
                models.StockMovement.timestamp >= since_7d,
            )
            .count()
        )

        results.append({
            "product_id": p.id,
            "product_name": p.name,
            "unit": p.unit,
            "current_stock": round(current_stock, 2),
            "threshold": p.threshold,
            "stock_ratio": stock_ratio,
            "is_critical": current_stock < p.threshold,
            "daily_avg_consumption": daily_avg,
            "days_to_empty": days_to_empty,
            "total_in_7d": round(abs(total_in), 2),
            "total_out_7d": round(abs(total_out), 2),
            "movement_count_7d": movement_count,
        })

    results.sort(key=lambda x: (not x["is_critical"], x["stock_ratio"]))
    return results
