"""
Webhook router — two surface areas:

  POST /api/webhook/message      ← Phase 2: AI-powered, JSON body, testable via Swagger
  POST /api/webhook/whatsapp     ← Phase 3 placeholder (Twilio form-encoded signature)
"""

import base64
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models, schemas
from database import get_db
from services import ai_service
from services.ai_service import AIParsingError, APIKeyMissingError
from services.product_service import find_product as _find_product

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Webhook"])


# ── POST /api/webhook/message — Phase 2 AI endpoint ───────────────────────

@router.post("/webhook/message", response_model=schemas.WebhookMessageResponse)
async def receive_message(
    payload: schemas.WebhookMessagePayload,
    db: Session = Depends(get_db),
):
    """
    AI-powered stock update via text or invoice photo.

    Test with Swagger UI (/docs) or curl:
      {"text": "250 kg buğday teslim alındı"}
      {"image_base64": "<base64>", "mime_type": "image/jpeg"}

    Workflow:
      1. Send text/image to Gemini 2.5 Pro → get ParsedStockData
      2. Fuzzy-match product_name against DB
      3. Append StockMovement (never update existing rows)
      4. Return Turkish confirmation message
    """
    if not payload.text and not payload.image_base64:
        raise HTTPException(
            status_code=422,
            detail="'text' veya 'image_base64' alanlarından biri zorunludur.",
        )

    # ── Step 1: AI parsing ─────────────────────────────────────────────────
    try:
        if payload.image_base64:
            try:
                image_bytes = base64.b64decode(payload.image_base64)
            except Exception:
                raise HTTPException(status_code=422, detail="Geçersiz base64 görseli.")
            parsed = ai_service.parse_image(image_bytes, payload.mime_type)
        else:
            parsed = ai_service.parse_text(payload.text)  # type: ignore[arg-type]

    except APIKeyMissingError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except AIParsingError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    logger.info(
        "AI parsed: product=%s qty=%s action=%s",
        parsed.product_name, parsed.quantity, parsed.action,
    )

    # ── Step 2: Product match ──────────────────────────────────────────────
    product = _find_product(db, parsed.product_name)

    if not product:
        return schemas.WebhookMessageResponse(
            status="warning",
            message=(
                f"⚠️ '{parsed.product_name}' ürünü veritabanında bulunamadı. "
                "Lütfen ürünü Stok Yönetimi sayfasından önce ekleyin."
            ),
            parsed=parsed.model_dump(),
        )

    # ── Step 3: Append StockMovement ──────────────────────────────────────
    signed_qty = parsed.quantity if parsed.action == "in" else -parsed.quantity
    source = "invoice_photo" if payload.image_base64 else "whatsapp_text"

    movement = models.StockMovement(
        product_id=product.id,
        quantity=signed_qty,
        type=parsed.action,
        source=source,
        notes=parsed.reason,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)

    # ── Step 4: Create notification ──────────────────────────────────────
    import crud as _crud
    verb_tr = "Stok girişi" if parsed.action == "in" else "Stok çıkışı"
    _crud.create_notification(
        db,
        title=f"{verb_tr}: {parsed.quantity} {product.unit} {product.name}",
        body=f"Kaynak: {source}" + (f" | Not: {parsed.reason}" if parsed.reason else ""),
        type="stock_update",
    )

    verb = "sisteme eklendi" if parsed.action == "in" else "sistemden düşüldü"
    return schemas.WebhookMessageResponse(
        status="success",
        message=f"✅ {parsed.quantity} {product.unit} {product.name} {verb}.",
        parsed=parsed.model_dump(),
        movement_id=movement.id,
    )


# ── POST /api/webhook/whatsapp — Phase 3 Twilio placeholder ───────────────

@router.post("/webhook/whatsapp", response_model=schemas.WebhookResponse)
async def receive_whatsapp(
    From: str = "",
    Body: str = "",
    MediaUrl0: str = None,
    MediaContentType0: str = None,
    db: Session = Depends(get_db),
):
    """
    Twilio webhook (form-encoded). Phase 3: wire real Twilio signature validation
    and forward to receive_message() above.
    """
    if MediaUrl0:
        return schemas.WebhookResponse(
            status="queued",
            message="Fotoğraf alındı, AI işleme başlayacak.",
        )
    if Body.strip():
        return schemas.WebhookResponse(
            status="received",
            message=f"Mesaj alındı: '{Body[:80]}'. İşleniyor.",
        )
    return schemas.WebhookResponse(status="ignored", message="Boş mesaj.")
