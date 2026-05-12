import json
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

import crud, models, schemas
from database import get_db

router = APIRouter(tags=["Dashboard"])


def _daily_consumption(db: Session, product_id: int, days: int = 7) -> float:
    since = datetime.utcnow() - timedelta(days=days)
    total_out = (
        db.query(func.sum(models.StockMovement.quantity))
        .filter(
            models.StockMovement.product_id == product_id,
            models.StockMovement.type == "out",
            models.StockMovement.timestamp >= since,
        )
        .scalar() or 0.0
    )
    return round(abs(total_out) / max(days, 1), 2)


@router.get("/dashboard", response_model=schemas.DashboardResponse)
def get_dashboard(db: Session = Depends(get_db)):
    products = crud.get_products(db)
    pending_approvals = crud.get_pending_approvals(db)

    stock_levels: list[schemas.ProductOut] = []
    below_threshold_count = 0

    for p in products:
        current_stock = crud.get_stock_level(db, p.id)
        is_below = current_stock < p.threshold
        if is_below:
            below_threshold_count += 1

        daily = _daily_consumption(db, p.id)
        days_to_empty = round(current_stock / daily, 1) if daily > 0 else None

        stock_levels.append(
            schemas.ProductOut(
                id=p.id,
                name=p.name,
                sku=p.sku,
                unit=p.unit,
                threshold=p.threshold,
                current_stock=current_stock,
                is_below_threshold=is_below,
                created_at=p.created_at,
                daily_consumption=daily,
                days_to_empty=days_to_empty,
            )
        )

    kpis = [
        schemas.KpiCard(label="Toplam Ürün", value=len(products)),
        schemas.KpiCard(
            label="Kritik Stok",
            value=below_threshold_count,
            alert=below_threshold_count > 0,
        ),
        schemas.KpiCard(
            label="E-posta Onayı Bekleyen",
            value=len(pending_approvals),
            alert=len(pending_approvals) > 0,
        ),
        schemas.KpiCard(
            label="Bugünkü Hareket",
            value=_count_todays_movements(db),
        ),
    ]

    parsed_approvals = []
    for a in pending_approvals:
        parsed_approvals.append(
            schemas.ActionApprovalOut(
                id=a.id,
                type=a.type,
                payload=json.loads(a.payload) if a.payload else {},
                status=a.status,
                created_at=a.created_at,
                updated_at=a.updated_at,
            )
        )

    return schemas.DashboardResponse(
        kpis=kpis,
        stock_levels=stock_levels,
        pending_approvals=parsed_approvals,
    )


def _count_todays_movements(db: Session) -> int:
    # Timestamps are stored as UTC (SQLite func.now() defaults to UTC) — compare
    # against UTC date to avoid the local-vs-UTC off-by-hours mismatch that
    # silently mis-counted movements near midnight.
    today_utc_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_utc_start = today_utc_start + timedelta(days=1)
    return (
        db.query(models.StockMovement)
        .filter(
            models.StockMovement.timestamp >= today_utc_start,
            models.StockMovement.timestamp < tomorrow_utc_start,
        )
        .count()
    )
