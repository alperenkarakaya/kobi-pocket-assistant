import json
from sqlalchemy.orm import Session
from sqlalchemy import func
import models, schemas


# ── Products ───────────────────────────────────────────────────────────────

def get_products(db: Session) -> list[models.Product]:
    return db.query(models.Product).all()


def assign_supplier_to_product(
    db: Session, product_id: int, supplier_id: int | None
) -> models.Product | None:
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        return None
    product.supplier_id = supplier_id
    db.commit()
    db.refresh(product)
    return product


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


# ── Notifications ──────────────────────────────────────────────────────────

def create_notification(
    db: Session, title: str, body: str | None = None, type: str = "info"
) -> models.Notification:
    notif = models.Notification(title=title, body=body, type=type, is_read=False)
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


def get_notifications(db: Session, limit: int = 60) -> list[models.Notification]:
    return (
        db.query(models.Notification)
        .order_by(models.Notification.created_at.desc())
        .limit(limit)
        .all()
    )


def get_unread_count(db: Session) -> int:
    return db.query(models.Notification).filter(models.Notification.is_read == False).count()


def mark_all_notifications_read(db: Session) -> int:
    count = get_unread_count(db)
    db.query(models.Notification).filter(
        models.Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return count


# ── Suppliers ──────────────────────────────────────────────────────────────

def get_suppliers(db: Session) -> list[models.Supplier]:
    return db.query(models.Supplier).order_by(models.Supplier.created_at.desc()).all()


def create_supplier(db: Session, supplier: schemas.SupplierCreate) -> models.Supplier:
    db_supplier = models.Supplier(**supplier.model_dump())
    db.add(db_supplier)
    db.commit()
    db.refresh(db_supplier)
    return db_supplier


def update_supplier(
    db: Session, supplier_id: int, data: schemas.SupplierCreate
) -> models.Supplier | None:
    supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not supplier:
        return None
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(supplier, k, v)
    db.commit()
    db.refresh(supplier)
    return supplier


def delete_supplier(db: Session, supplier_id: int) -> bool:
    supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not supplier:
        return False
    db.delete(supplier)
    db.commit()
    return True
