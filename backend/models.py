from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Product(Base):
    """Master catalog of all cooperative products."""
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    sku = Column(String(100), unique=True, nullable=False, index=True)
    unit = Column(String(50), nullable=False)          # "kg", "unit", "liter", "ton"
    threshold = Column(Float, default=0.0)             # critical stock level — triggers alerts
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    movements = relationship("StockMovement", back_populates="product", lazy="dynamic")
    supplier = relationship("Supplier", lazy="select", foreign_keys=[supplier_id])

    @property
    def current_stock(self) -> float:
        """Append-only: stock is always the sum of all movements."""
        return sum(m.quantity for m in self.movements)


class StockMovement(Base):
    """
    Immutable ledger row. Never update or delete — only append.
    Positive quantity = stock in, negative = stock out.
    """
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    quantity = Column(Float, nullable=False)            # +/- value
    type = Column(String(20), nullable=False)           # "in" | "out" | "count"
    source = Column(String(50), nullable=False)         # "whatsapp_text" | "invoice_photo" | "manual"
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    product = relationship("Product", back_populates="movements")


class Task(Base):
    """Kanban task card — tracks cooperative work items through a 4-stage workflow."""
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    status = Column(String(20), default="pending", nullable=False)  # pending|accepted|in_progress|completed
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ActionApproval(Base):
    """
    Pending AI-generated actions waiting for manager approval
    (e.g., a supply recommendation email draft).
    """
    __tablename__ = "action_approvals"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(100), nullable=False)          # "supply_recommendation"
    payload = Column(Text, nullable=False)              # JSON-stringified action details
    status = Column(String(20), default="pending")      # "pending" | "approved" | "rejected"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Notification(Base):
    """System-wide activity log — every significant action creates a notification."""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=True)
    type = Column(String(50), nullable=False, default="info")  # stock_update|email_sent|ai_analysis|alert|rejection|info
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class Supplier(Base):
    """Cooperative supplier directory — linked to products for auto-fill in supply emails."""
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    product_category = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
