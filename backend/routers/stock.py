from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, crud

router = APIRouter(tags=["Stock Management"])


@router.post("/products", response_model=schemas.ProductOut, status_code=201)
def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db)):
    """Create a new product in the catalog."""
    if crud.get_product_by_sku(db, product.sku):
        raise HTTPException(status_code=409, detail=f"SKU '{product.sku}' already exists.")
    db_product = crud.create_product(db, product)
    return schemas.ProductOut(
        id=db_product.id,
        name=db_product.name,
        sku=db_product.sku,
        unit=db_product.unit,
        threshold=db_product.threshold,
        current_stock=0.0,
        is_below_threshold=False,
        created_at=db_product.created_at,
    )


@router.delete("/products/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    """Delete a product and all its stock movements."""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    # Delete child movements first to avoid FK issues
    db.query(models.StockMovement).filter(
        models.StockMovement.product_id == product_id
    ).delete(synchronize_session=False)
    db.delete(product)
    db.commit()


@router.get("/products", response_model=list[schemas.ProductOut])
def list_products(db: Session = Depends(get_db)):
    """Returns all products with their live-calculated stock levels."""
    products = crud.get_products(db)
    result = []
    for p in products:
        stock = crud.get_stock_level(db, p.id)
        result.append(
            schemas.ProductOut(
                id=p.id,
                name=p.name,
                sku=p.sku,
                unit=p.unit,
                threshold=p.threshold,
                current_stock=stock,
                is_below_threshold=stock < p.threshold,
                created_at=p.created_at,
            )
        )
    return result


@router.post("/stock/movement", response_model=schemas.StockMovementOut, status_code=201)
def create_manual_movement(req: schemas.ManualStockRequest, db: Session = Depends(get_db)):
    """
    Manual stock adjustment from the web dashboard.
    Positive quantity = stock in, negative = stock out.
    Returns the created movement (including its ID, which the frontend uses for undo).
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
