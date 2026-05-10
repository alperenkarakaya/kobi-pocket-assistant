from sqlalchemy.orm import Session
import models


def find_product(db: Session, product_name: str) -> models.Product | None:
    """
    Two-pass fuzzy match against the products table.
    Pass 1: full name substring  (e.g. 'Buğday' hits 'Sert Buğday')
    Pass 2: word-by-word         (e.g. 'Amonyum Nitrat' → tries 'Amonyum', then 'Nitrat')
    """
    hit = (
        db.query(models.Product)
        .filter(models.Product.name.ilike(f"%{product_name}%"))
        .first()
    )
    if hit:
        return hit

    for word in product_name.split():
        if len(word) < 3:
            continue
        hit = (
            db.query(models.Product)
            .filter(models.Product.name.ilike(f"%{word}%"))
            .first()
        )
        if hit:
            return hit

    return None
