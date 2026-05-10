import json
from sqlalchemy.orm import Session
from sqlalchemy import func
import models, schemas


# ── Products ───────────────────────────────────────────────────────────────

def get_products(db: Session) -> list[models.Product]:
    return db.query(models.Product).all()


def get_product_by_sku(db: Session, sku: str) -> models.Product | None:
    return db.query(models.Product).filter(models.Product.sku == sku).first()


def create_product(db: Session, product: schemas.ProductCreate) -> models.Product:
    db_product = models.Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


# ── Stock Movements ────────────────────────────────────────────────────────

def create_stock_movement(
    db: Session, movement: schemas.StockMovementCreate
) -> models.StockMovement:
    # Ensure out-movements are stored as negative values
    quantity = movement.quantity
    if movement.type == schemas.MovementType.outgoing and quantity > 0:
        quantity = -quantity

    db_movement = models.StockMovement(
        product_id=movement.product_id,
        quantity=quantity,
        type=movement.type.value,
        source=movement.source.value,
        notes=movement.notes,
    )
    db.add(db_movement)
    db.commit()
    db.refresh(db_movement)
    return db_movement


def get_stock_level(db: Session, product_id: int) -> float:
    result = db.query(func.sum(models.StockMovement.quantity)).filter(
        models.StockMovement.product_id == product_id
    ).scalar()
    return result or 0.0


def get_recent_movements(db: Session, limit: int = 50) -> list[models.StockMovement]:
    return (
        db.query(models.StockMovement)
        .order_by(models.StockMovement.timestamp.desc())
        .limit(limit)
        .all()
    )


# ── Action Approvals ───────────────────────────────────────────────────────

def create_action_approval(
    db: Session, action: schemas.ActionApprovalCreate
) -> models.ActionApproval:
    db_action = models.ActionApproval(
        type=action.type,
        payload=json.dumps(action.payload),
        status="pending",
    )
    db.add(db_action)
    db.commit()
    db.refresh(db_action)
    return db_action


def get_pending_approvals(db: Session) -> list[models.ActionApproval]:
    return (
        db.query(models.ActionApproval)
        .filter(models.ActionApproval.status == "pending")
        .order_by(models.ActionApproval.created_at.desc())
        .all()
    )


def update_approval_status(
    db: Session, action_id: int, status: schemas.ApprovalStatus
) -> models.ActionApproval | None:
    db_action = db.query(models.ActionApproval).filter(
        models.ActionApproval.id == action_id
    ).first()
    if not db_action:
        return None
    db_action.status = status.value
    db.commit()
    db.refresh(db_action)
    return db_action


# ── Tasks ──────────────────────────────────────────────────────────────────

def get_tasks(db: Session) -> list[models.Task]:
    return db.query(models.Task).order_by(models.Task.created_at.asc()).all()


def create_task(db: Session, task: schemas.TaskCreate) -> models.Task:
    db_task = models.Task(title=task.title, status=task.status.value)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


def update_task_status(
    db: Session, task_id: int, status: schemas.TaskStatus
) -> models.Task | None:
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        return None
    task.status = status.value
    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, task_id: int) -> bool:
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        return False
    db.delete(task)
    db.commit()
    return True
