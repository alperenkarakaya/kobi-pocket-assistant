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


@router.get("/analytics/daily-history")
def get_daily_history(db: Session = Depends(get_db)):
    """Per-product daily in/out movements for last 7 days — used by the consumption chart."""
    products = db.query(models.Product).all()
    since = datetime.utcnow() - timedelta(days=7)
    result = []

    for p in products:
        current_stock = (
            db.query(func.sum(models.StockMovement.quantity))
            .filter(models.StockMovement.product_id == p.id)
            .scalar() or 0.0
        )
        total_out_7d = (
            db.query(func.sum(models.StockMovement.quantity))
            .filter(
                models.StockMovement.product_id == p.id,
                models.StockMovement.type == "out",
                models.StockMovement.timestamp >= since,
            )
            .scalar() or 0.0
        )
        daily_avg = round(abs(total_out_7d) / 7, 2)
        days_to_empty = round(float(current_stock) / daily_avg, 1) if daily_avg > 0 else None

        # Bucket movements by calendar day
        day_map: dict[str, dict] = {}
        for m in (
            db.query(models.StockMovement)
            .filter(
                models.StockMovement.product_id == p.id,
                models.StockMovement.timestamp >= since,
            )
            .all()
        ):
            day = m.timestamp.strftime("%Y-%m-%d")
            if day not in day_map:
                day_map[day] = {"in": 0.0, "out": 0.0}
            if m.type == "in":
                day_map[day]["in"] += float(m.quantity)
            else:
                day_map[day]["out"] += abs(float(m.quantity))

        tr_days = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]
        daily = []
        for i in range(6, -1, -1):
            dt = datetime.utcnow() - timedelta(days=i)
            day_str = dt.strftime("%Y-%m-%d")
            d = day_map.get(day_str, {"in": 0.0, "out": 0.0})
            daily.append({
                "date": day_str,
                "label": "Bugün" if i == 0 else tr_days[dt.weekday()],
                "in": round(d["in"], 2),
                "out": round(d["out"], 2),
            })

        result.append({
            "product_id": p.id,
            "name": p.name,
            "unit": p.unit,
            "threshold": float(p.threshold),
            "current_stock": round(float(current_stock), 2),
            "days_to_empty": days_to_empty,
            "daily_avg": daily_avg,
            "is_critical": float(current_stock) < float(p.threshold),
            "daily": daily,
        })

    result.sort(key=lambda x: (not x["is_critical"], x["days_to_empty"] or 9999))
    return result
