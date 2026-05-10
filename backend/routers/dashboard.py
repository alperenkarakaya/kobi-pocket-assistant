import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
import crud, schemas

router = APIRouter(tags=["Dashboard"])


@router.get("/dashboard", response_model=schemas.DashboardResponse)
def get_dashboard(db: Session = Depends(get_db)):
    """
    Returns live KPIs and current stock levels by summing all StockMovements.
    This is the main data feed for the web dashboard.
    """
    products = crud.get_products(db)
    pending_approvals = crud.get_pending_approvals(db)

    stock_levels: list[schemas.ProductOut] = []
    below_threshold_count = 0

    for p in products:
        current_stock = crud.get_stock_level(db, p.id)
        is_below = current_stock < p.threshold
        if is_below:
            below_threshold_count += 1

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
            )
        )

    kpis = [
        schemas.KpiCard(label="Total Products", value=len(products)),
        schemas.KpiCard(
            label="Low Stock Alerts",
            value=below_threshold_count,
            alert=below_threshold_count > 0,
        ),
        schemas.KpiCard(
            label="Pending Approvals",
            value=len(pending_approvals),
            alert=len(pending_approvals) > 0,
        ),
        schemas.KpiCard(
            label="Today's Movements",
            value=_count_todays_movements(db),
        ),
    ]

    # Parse JSON payloads so the response is clean objects, not raw strings
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
    from sqlalchemy import func, cast, Date
    from models import StockMovement
    from datetime import date

    return (
        db.query(StockMovement)
        .filter(cast(StockMovement.timestamp, Date) == date.today())
        .count()
    )
