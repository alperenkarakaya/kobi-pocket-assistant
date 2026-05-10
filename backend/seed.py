"""
Run once to populate the DB with demo data for the hackathon presentation.
  python seed.py
"""
from database import SessionLocal, engine, Base
import models, schemas, crud

Base.metadata.create_all(bind=engine)

SAMPLE_PRODUCTS = [
    {"name": "Buğday", "sku": "WHEAT-001", "unit": "ton", "threshold": 5.0},
    {"name": "Arpa", "sku": "BARLEY-001", "unit": "ton", "threshold": 3.0},
    {"name": "Gübre (Amonyum Nitrat)", "sku": "FERT-AN-001", "unit": "kg", "threshold": 500.0},
    {"name": "Mazot", "sku": "DIESEL-001", "unit": "liter", "threshold": 200.0},
    {"name": "Ayçiçeği Tohumu", "sku": "SEED-SF-001", "unit": "kg", "threshold": 100.0},
]

SAMPLE_MOVEMENTS = [
    # (sku, quantity, type, source, notes)
    ("WHEAT-001", 20.0, "in", "manual", "Açılış stoku"),
    ("WHEAT-001", -3.5, "out", "manual", "Üye dağıtımı"),
    ("BARLEY-001", 10.0, "in", "invoice_photo", "Tedarikçi irsaliyesi"),
    ("BARLEY-001", -8.0, "out", "whatsapp_text", "Hayvan yemi"),
    ("FERT-AN-001", 1200.0, "in", "manual", "Sezon başı temin"),
    ("FERT-AN-001", -850.0, "out", "manual", "Üye dağıtımı"),
    ("DIESEL-001", 500.0, "in", "invoice_photo", "Yakıt ikmali"),
    ("DIESEL-001", -420.0, "out", "whatsapp_text", "Traktör ve makine"),
    ("SEED-SF-001", 300.0, "in", "manual", "Ekim sezonu stoğu"),
    ("SEED-SF-001", -210.0, "out", "manual", "Üye dağıtımı"),
]

SAMPLE_APPROVALS = [
    {
        "type": "supply_recommendation",
        "payload": {
            "subject": "Acil Tedarik Talebi: Arpa Stoğu Kritik Seviyede",
            "recipient": "tedarikci@example.com",
            "body": "Sayın Tedarikçimiz, Arpa stoğumuz kritik eşiğin altına düşmüştür. "
                    "Lütfen 10 ton arpa için fiyat teklifi iletiniz. Saygılarımızla.",
            "product_sku": "BARLEY-001",
            "current_stock": 2.0,
            "threshold": 3.0,
        },
    }
]


def seed():
    db = SessionLocal()
    try:
        # Products
        product_map = {}
        for p_data in SAMPLE_PRODUCTS:
            existing = crud.get_product_by_sku(db, p_data["sku"])
            if not existing:
                product = crud.create_product(db, schemas.ProductCreate(**p_data))
                product_map[p_data["sku"]] = product.id
                print(f"  + Product: {p_data['name']}")
            else:
                product_map[p_data["sku"]] = existing.id
                print(f"  ~ Skipped (exists): {p_data['name']}")

        # Movements
        for sku, qty, mv_type, source, notes in SAMPLE_MOVEMENTS:
            pid = product_map.get(sku)
            if pid:
                crud.create_stock_movement(
                    db,
                    schemas.StockMovementCreate(
                        product_id=pid,
                        quantity=qty,
                        type=mv_type,
                        source=source,
                        notes=notes,
                    ),
                )
        print(f"  + {len(SAMPLE_MOVEMENTS)} stock movements created.")

        # Approvals
        for action in SAMPLE_APPROVALS:
            crud.create_action_approval(db, schemas.ActionApprovalCreate(**action))
        print(f"  + {len(SAMPLE_APPROVALS)} pending approval(s) created.")

        print("\nSeed complete. Visit http://localhost:8000/docs to explore the API.")
    finally:
        db.close()


if __name__ == "__main__":
    print("Seeding database...")
    seed()
