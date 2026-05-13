from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from enum import Enum


# ── Enums ──────────────────────────────────────────────────────────────────

class MovementType(str, Enum):
    incoming = "in"
    outgoing = "out"
    count = "count"


class SourceType(str, Enum):
    whatsapp_text = "whatsapp_text"
    invoice_photo = "invoice_photo"
    manual = "manual"


class ApprovalStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


# ── Suppliers (defined early so ProductOut can reference it) ───────────────

class SupplierBase(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    product_category: Optional[str] = None
    notes: Optional[str] = None


class SupplierCreate(SupplierBase):
    pass


class SupplierOut(SupplierBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Product ────────────────────────────────────────────────────────────────

class ProductBase(BaseModel):
    name: str
    sku: str
    unit: str
    threshold: float = 0.0


class ProductCreate(ProductBase):
    pass


class ProductOut(ProductBase):
    id: int
    current_stock: float
    is_below_threshold: bool
    created_at: datetime
    daily_consumption: float = 0.0
    days_to_empty: Optional[float] = None
    supplier_id: Optional[int] = None
    supplier: Optional[SupplierOut] = None

    model_config = {"from_attributes": True}


# ── StockMovement ──────────────────────────────────────────────────────────

class StockMovementBase(BaseModel):
    product_id: int
    quantity: float
    type: MovementType
    source: SourceType
    notes: Optional[str] = None


class StockMovementCreate(StockMovementBase):
    pass


class StockMovementOut(StockMovementBase):
    id: int
    timestamp: datetime

    model_config = {"from_attributes": True}


# ── ActionApproval ─────────────────────────────────────────────────────────

class ActionApprovalBase(BaseModel):
    type: str
    payload: Any  # will be serialized to JSON string before DB write


class ActionApprovalCreate(ActionApprovalBase):
    pass


class ActionApprovalOut(BaseModel):
    id: int
    type: str
    payload: Any
    status: ApprovalStatus
    created_at: datetime
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ── Dashboard KPIs ─────────────────────────────────────────────────────────

class KpiCard(BaseModel):
    label: str
    value: Any
    unit: Optional[str] = None
    alert: bool = False


class DashboardResponse(BaseModel):
    kpis: list[KpiCard]
    stock_levels: list[ProductOut]
    pending_approvals: list[ActionApprovalOut]


# ── WhatsApp Webhook ───────────────────────────────────────────────────────

class WhatsAppWebhookPayload(BaseModel):
    from_number: str = Field(..., alias="From")
    body: Optional[str] = Field(None, alias="Body")
    media_url: Optional[str] = Field(None, alias="MediaUrl0")
    media_content_type: Optional[str] = Field(None, alias="MediaContentType0")

    model_config = {"populate_by_name": True}


class WebhookResponse(BaseModel):
    status: str
    message: str


# ── Action Approval Request ────────────────────────────────────────────────

class ApproveActionRequest(BaseModel):
    notes: Optional[str] = None
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    recipient: Optional[str] = None


# ── Tasks (Kanban) ─────────────────────────────────────────────────────────

class TaskStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    in_progress = "in_progress"
    completed = "completed"


class TaskCreate(BaseModel):
    title: str
    status: TaskStatus = TaskStatus.pending


class TaskStatusUpdate(BaseModel):
    status: TaskStatus


class TaskOut(BaseModel):
    id: int
    title: str
    status: TaskStatus
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Notifications ─────────────────────────────────────────────────────────

class NotificationOut(BaseModel):
    id: int
    title: str
    body: Optional[str] = None
    type: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Manual Stock Movement ──────────────────────────────────────────────────

class ManualStockRequest(BaseModel):
    product_id: int
    quantity: float          # positive = add, negative = remove
    notes: Optional[str] = None


# ── AI Webhook Message ─────────────────────────────────────────────────────

class ConversationTurn(BaseModel):
    role: str   # "user" | "ai"
    text: str


class WebhookMessagePayload(BaseModel):
    """Payload for POST /api/webhook/message — simulate Twilio/Telegram."""
    text: Optional[str] = None
    image_base64: Optional[str] = None
    mime_type: str = "image/jpeg"    # used when image_base64 is provided
    history: Optional[list[ConversationTurn]] = None  # last N turns for context


class WebhookMessageResponse(BaseModel):
    status: str                       # "success" | "warning" | "error"
    message: str                      # human-readable Turkish response
    parsed: Optional[dict] = None     # the raw AI-extracted fields
    movement_id: Optional[int] = None # set on success


# ── Stock Movement History (for /stock/movements endpoint) ────────────────

class StockMovementRow(BaseModel):
    id: int
    timestamp: datetime
    product_id: int
    product_name: str
    product_sku: str
    unit: str
    quantity: float
    type: str        # loose str — DB may contain values beyond the enum
    source: str      # loose str — same reason
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Supplier assignment ────────────────────────────────────────────────────

class AssignSupplierRequest(BaseModel):
    supplier_id: Optional[int] = None  # null to unassign


# ── Email tone regeneration ────────────────────────────────────────────────

class RegenerateEmailRequest(BaseModel):
    tone: str = "formal"  # urgent | formal | friendly
