from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, crud

router = APIRouter(tags=["Stock Management"])


def _product_out(p: models.Product, db: Session) -> schemas.ProductOut:
    stock = crud.get_stock_level(db, p.id)
    supplier_out = None
    if p.supplier:
        supplier_out = schemas.SupplierOut.model_validate(p.supplier)
    return schemas.ProductOut(
        id=p.id,
        name=p.name,
        sku=p.sku,
        unit=p.unit,
        threshold=p.threshold,
        current_stock=stock,
        is_below_threshold=stock < p.threshold,
        created_at=p.created_at,
        supplier_id=p.supplier_id,
        supplier=supplier_out,
    )


@router.post("/products", response_model=schemas.ProductOut, status_code=201)
def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db)):
    """Create a new product in the catalog."""
    if crud.get_product_by_sku(db, product.sku):
        raise HTTPException(status_code=409, detail=f"SKU '{product.sku}' already exists.")
    db_product = crud.create_product(db, product)
    return _product_out(db_product, db)


@router.delete("/products/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    """Delete a product and all its stock movements."""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.query(models.StockMovement).filter(
        models.StockMovement.product_id == product_id
    ).delete(synchronize_session=False)
    db.delete(product)
    db.commit()


@router.get("/products", response_model=list[schemas.ProductOut])
def list_products(db: Session = Depends(get_db)):
    """Returns all products with their live-calculated stock levels and supplier info."""
    return [_product_out(p, db) for p in crud.get_products(db)]


@router.patch("/products/{product_id}/supplier", response_model=schemas.ProductOut)
def assign_supplier(
    product_id: int,
    req: schemas.AssignSupplierRequest,
    db: Session = Depends(get_db),
):
    """Assign (or unassign) a supplier to a product."""
    if req.supplier_id is not None:
        supplier = db.query(models.Supplier).filter(
            models.Supplier.id == req.supplier_id
        ).first()
        if not supplier:
            raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı.")

    product = crud.assign_supplier_to_product(db, product_id, req.supplier_id)
    if not product:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")
    return _product_out(product, db)


@router.get("/stock/movements", response_model=list[schemas.StockMovementRow])
def list_movements(limit: int = 300, db: Session = Depends(get_db)):
    """Returns the most recent stock movements with product info for the history ledger UI."""
    rows = (
        db.query(models.StockMovement)
        .join(models.Product)
        .order_by(models.StockMovement.timestamp.desc())
        .limit(min(limit, 500))
        .all()
    )
    return [
        schemas.StockMovementRow(
            id=r.id,
            timestamp=r.timestamp,
            product_id=r.product_id,
            product_name=r.product.name,
            product_sku=r.product.sku,
            unit=r.product.unit,
            quantity=r.quantity,
            type=r.type,
            source=r.source,
            notes=r.notes,
        )
        for r in rows
    ]


@router.post("/stock/movement", response_model=schemas.StockMovementOut, status_code=201)
def create_manual_movement(req: schemas.ManualStockRequest, db: Session = Depends(get_db)):
    """
    Manual stock adjustment from the web dashboard.
    Positive quantity = stock in, negative = stock out.
    """
    product = db.query(models.Product).filter(models.Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db_movement = models.StockMovement(
        product_id=req.product_id,
        quantity=req.quantity,
        type="in" if req.quantity >= 0 else "out",
        source="manual",
        notes=req.notes,
    )
    db.add(db_movement)
    db.commit()
    db.refresh(db_movement)
    return db_movement
