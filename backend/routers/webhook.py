"""
Webhook router — two surface areas:

  POST /api/webhook/message      ← AI-powered, JSON body, testable via Swagger
  POST /api/webhook/whatsapp     ← Twilio WhatsApp (form-encoded, TwiML response)

WhatsApp flow (the core demo):
  1. User sends invoice photo or text via WhatsApp
  2. Twilio POSTs here with form data + MediaUrl
  3. We download the image (Twilio auth) → Gemini Vision parses the invoice
  4. Stock movement recorded in DB
  5. Rich TwiML reply: new total, threshold status, warning if critical
  6. If stock just crossed below threshold → background task:
       a. AI Crew runs (~30s) and creates ActionApproval email drafts
       b. Outbound WhatsApp sent: "Email draft ready, go approve it"
  7. Dashboard auto-refreshes and shows approval panel with the email
"""

import base64
import json
import logging
import os
import threading

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import Response as HTTPResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

import crud as _crud
import models, schemas
from database import SessionLocal, get_db
from services import ai_service
from services.ai_service import AIParsingError, APIKeyMissingError
from services.product_service import find_product as _find_product

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Webhook"])

_TWILIO_AUTH_TOKEN    = os.getenv("TWILIO_AUTH_TOKEN", "")
_TWILIO_ACCOUNT_SID   = os.getenv("TWILIO_ACCOUNT_SID", "")
_TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "")
_DASHBOARD_URL        = os.getenv("DASHBOARD_URL", "http://localhost:3000")


# ── Helpers ────────────────────────────────────────────────────────────────

def _twiml(message: str) -> HTTPResponse:
    """Wrap a plain-text message in a TwiML MessagingResponse."""
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response>"
        f"<Message>{message}</Message>"
        "</Response>"
    )
    return HTTPResponse(content=body, media_type="text/xml")


def _fmt(n: float) -> str:
    """Format a number without trailing .0 for clean Turkish display."""
    return f"{int(n):,}".replace(",", ".") if n == int(n) else f"{n:.1f}"


def _build_stock_reply(
    product_name: str,
    unit: str,
    quantity: float,
    action: str,
    reason: str,
    new_stock: float,
    threshold: float,
) -> str:
    """Build the rich WhatsApp confirmation message shown after a stock update."""
    verb = "stoka eklendi ✅" if action == "in" else "stoktan düşüldü 📤"

    lines = [
        f"{_fmt(quantity)} {unit} {product_name} {verb}",
        "─" * 26,
        f"📦 Yeni stok: {_fmt(new_stock)} {unit}",
        f"📊 Eşik:      {_fmt(threshold)} {unit}",
    ]

    if threshold > 0:
        ratio = new_stock / threshold
        if ratio < 0.3:
            lines.append("🔴 KRİTİK — acil sipariş gerekiyor!")
            lines.append("   AI analiz başlatılıyor...")
        elif new_stock < threshold:
            lines.append(f"⚠️  Eşiğin altında (%{int(ratio * 100)}) — yakında sipariş verin")
        else:
            lines.append(f"✅ Yeterli (%{int(ratio * 100)})")

    if reason and reason.lower() not in {
        "irsaliye okundu", "giriş yapıldı", "çıkış yapıldı", "manuel giriş",
    }:
        lines.append(f"📝 {reason}")

    return "\n".join(lines)


def _send_outbound_whatsapp(to: str, message: str) -> None:
    """Send a proactive WhatsApp message via Twilio REST client."""
    if not (_TWILIO_ACCOUNT_SID and _TWILIO_AUTH_TOKEN and _TWILIO_WHATSAPP_FROM):
        logger.warning("Outbound WhatsApp skipped — TWILIO_WHATSAPP_FROM / credentials not set")
        return
    try:
        from twilio.rest import Client
        Client(_TWILIO_ACCOUNT_SID, _TWILIO_AUTH_TOKEN).messages.create(
            from_=f"whatsapp:{_TWILIO_WHATSAPP_FROM}",
            to=to,
            body=message,
        )
        logger.info("Outbound WhatsApp sent to %s", to)
    except Exception as exc:
        logger.error("Outbound WhatsApp failed: %s", exc)


# ── Background task: auto-run AI Crew when stock goes critical ─────────────

# In-flight tracker to prevent overlapping crew runs (e.g. multi-item invoice
# fires several triggers within milliseconds). Module-level, single-process.
_crew_lock = threading.Lock()
_crew_running = False


def _auto_crew_and_notify(sender: str, trigger_label: str) -> None:
    """
    Triggered in the background when a WhatsApp stock update pushes any product
    below its threshold. Runs the full AI Crew pipeline then notifies the sender.

    Coalesces concurrent triggers — if a crew run is already in flight (e.g. a
    multi-item invoice fired several triggers), later calls return immediately.
    The single run sees the up-to-date DB state and covers every critical product.

    Uses its own DB session — safe to run after the HTTP response is sent.
    """
    global _crew_running
    from services.crew_service import run_crew

    with _crew_lock:
        if _crew_running:
            logger.info("Auto-crew already in flight — skipping duplicate trigger (%s)", trigger_label)
            return
        _crew_running = True

    db = SessionLocal()
    try:
        # Idempotency: collect product IDs that already have a pending approval
        already_pending: set[int] = set()
        for approval in _crud.get_pending_approvals(db):
            if approval.type != "supply_email":
                continue
            try:
                pid = json.loads(approval.payload).get("product_id")
                if pid is not None:
                    already_pending.add(int(pid))
            except Exception:
                pass

        logger.info("Auto-crew starting for critical stock after WhatsApp update (%s)", trigger_label)
        items = run_crew(db)

        created = 0
        for item in items:
            pid = item.get("product_id")
            if pid is not None and int(pid) in already_pending:
                logger.info("Skipping product_id=%s — approval already pending", pid)
                continue
            _crud.create_action_approval(
                db,
                schemas.ActionApprovalCreate(type="supply_email", payload=item),
            )
            created += 1

        if created > 0:
            _crud.create_notification(
                db,
                title=f"🤖 AI Crew: {created} tedarik e-postası hazırlandı",
                body=f"{trigger_label} stoku kritik. WhatsApp üzerinden tetiklendi.",
                type="ai_analysis",
            )
            db.commit()

            _send_outbound_whatsapp(
                to=sender,
                message=(
                    f"🤖 AI Tedarik Analizi Tamamlandı!\n"
                    f"{'─' * 28}\n"
                    f"📦 Kritik stok tespit edildi.\n"
                    f"✉️  {created} tedarikçi e-posta taslağı hazırlandı.\n\n"
                    f"▶️ Dashboard'dan onaylayıp gönderin:\n{_DASHBOARD_URL}"
                ),
            )
        else:
            db.commit()
            logger.info("Auto-crew: no new approvals (all already pending)")

    except Exception as exc:
        logger.error("Auto-crew background task failed: %s", exc)
        try:
            db.rollback()
        except Exception:
            pass
    finally:
        db.close()
        with _crew_lock:
            _crew_running = False


# ── POST /api/webhook/message — direct AI endpoint (Swagger testable) ──────

@router.post("/webhook/message", response_model=schemas.WebhookMessageResponse)
async def receive_message(
    payload: schemas.WebhookMessagePayload,
    db: Session = Depends(get_db),
):
    """
    AI-powered stock update via text or invoice photo.
    Test via Swagger UI (/docs):
      {"text": "250 kg buğday teslim alındı"}
      {"image_base64": "<base64>", "mime_type": "image/jpeg"}
    """
    if not payload.text and not payload.image_base64:
        raise HTTPException(
            status_code=422,
            detail="'text' veya 'image_base64' alanlarından biri zorunludur.",
        )

    try:
        if payload.image_base64:
            try:
                image_bytes = base64.b64decode(payload.image_base64)
            except Exception:
                raise HTTPException(status_code=422, detail="Geçersiz base64 görseli.")
            parsed = ai_service.parse_image(image_bytes, payload.mime_type)
        else:
            parsed = ai_service.parse_text(payload.text)  # type: ignore[arg-type]
    except APIKeyMissingError:
        if payload.image_base64:
            raise HTTPException(status_code=503, detail="GEMINI_API_KEY yapılandırılmamış.")
        return schemas.WebhookMessageResponse(
            status="chat",
            message="Merhaba! Ben KOBI asistanınızım. Şu an AI servisi yapılandırılmamış — lütfen sistem yöneticisiyle iletişime geçin.",
        )
    except AIParsingError:
        if payload.image_base64:
            raise HTTPException(status_code=422, detail="Fotoğraf ayrıştırılamadı — daha net bir görsel deneyin.")
        # Text message didn't match a stock command — treat as general chat
        reply = ai_service.chat_reply(payload.text or "")
        return schemas.WebhookMessageResponse(status="chat", message=reply)

    logger.info("AI parsed: product=%s qty=%s action=%s", parsed.product_name, parsed.quantity, parsed.action)

    product = _find_product(db, parsed.product_name)
    if not product:
        all_products = db.query(models.Product).all()
        names = ", ".join(p.name for p in all_products[:5]) if all_products else "—"
        return schemas.WebhookMessageResponse(
            status="warning",
            message=(
                f"⚠️ '{parsed.product_name}' ürünü veritabanında bulunamadı. "
                f"Kayıtlı ürünler: {names}. "
                "Lütfen ürünü Stok Yönetimi sayfasından önce ekleyin."
            ),
            parsed=parsed.model_dump(),
        )

    signed_qty = parsed.quantity if parsed.action == "in" else -parsed.quantity
    source = "invoice_photo" if payload.image_base64 else "whatsapp_text"
    movement = models.StockMovement(
        product_id=product.id, quantity=signed_qty,
        type=parsed.action, source=source, notes=parsed.reason,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)

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


# ── POST /api/webhook/whatsapp — Twilio WhatsApp ──────────────────────────

@router.post("/webhook/whatsapp")
async def receive_whatsapp(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Twilio WhatsApp webhook (form-encoded POST).

    Validates X-Twilio-Signature when TWILIO_AUTH_TOKEN is set.
    Supports text messages and image attachments (invoice photos).
    Returns TwiML so the reply goes back to the WhatsApp sender.

    When the update pushes stock below threshold, an AI Crew analysis
    runs in the background and the sender gets a follow-up WhatsApp
    when the supplier email draft is ready.
    """
    form = dict(await request.form())

    # ── Twilio signature validation ────────────────────────────────────────
    if _TWILIO_AUTH_TOKEN:
        try:
            from twilio.request_validator import RequestValidator
            validator = RequestValidator(_TWILIO_AUTH_TOKEN)
            signature = request.headers.get("X-Twilio-Signature", "")
            if not validator.validate(str(request.url), form, signature):
                logger.warning("Invalid Twilio signature — request rejected")
                raise HTTPException(status_code=403, detail="Geçersiz Twilio imzası.")
        except ImportError:
            logger.warning("twilio package not installed — skipping signature validation")
    else:
        logger.debug("TWILIO_AUTH_TOKEN not set — validation skipped (dev/ngrok mode)")

    From: str = form.get("From", "")
    Body: str = form.get("Body", "").strip()
    MediaUrl0: str | None = form.get("MediaUrl0")
    MediaContentType0: str | None = form.get("MediaContentType0")

    logger.info("WhatsApp from=%s body=%r has_media=%s", From, Body[:60], bool(MediaUrl0))

    # ── Photo: multi-item parse ────────────────────────────────────────────
    if MediaUrl0 and MediaContentType0 and MediaContentType0.startswith("image/"):
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                auth = (
                    (_TWILIO_ACCOUNT_SID, _TWILIO_AUTH_TOKEN)
                    if _TWILIO_ACCOUNT_SID and _TWILIO_AUTH_TOKEN
                    else None
                )
                resp = await client.get(MediaUrl0, auth=auth, follow_redirects=True)
                resp.raise_for_status()
                image_bytes = resp.content
        except httpx.HTTPError as exc:
            logger.error("Media download failed: %s", exc)
            return _twiml("❌ Fotoğraf indirilemedi. Lütfen tekrar gönderin.")

        try:
            parsed_list = ai_service.parse_image_multi(image_bytes, MediaContentType0)
        except APIKeyMissingError:
            return _twiml("❌ Sistem yapılandırma hatası. Yöneticiye bildirin.")
        except AIParsingError:
            return _twiml(
                "❌ Fotoğraf okunamadı.\n\n"
                "💡 İpuçları:\n"
                "• Belgeyi düz, aydınlık bir ortamda çekin\n"
                "• Tüm metin görünür olsun\n"
                "• Veya miktarı yazarak gönderin:\n"
                "  '2 ton buğday teslim alındı'"
            )

        reply_lines = [f"📋 {len(parsed_list)} ürün okundu:\n"]
        critical_names: list[str] = []
        for parsed in parsed_list:
            product = _find_product(db, parsed.product_name)
            if not product:
                reply_lines.append(f"⚠️ {parsed.product_name} — kayıtlı değil, atlandı")
                continue

            signed_qty = parsed.quantity if parsed.action == "in" else -parsed.quantity
            db.add(models.StockMovement(
                product_id=product.id,
                quantity=signed_qty,
                type=parsed.action,
                source="whatsapp_photo",
                notes=parsed.reason,
            ))
            db.commit()

            new_stock: float = (
                db.query(func.sum(models.StockMovement.quantity))
                .filter(models.StockMovement.product_id == product.id)
                .scalar() or 0.0
            )

            verb_tr = "Stok girişi" if parsed.action == "in" else "Stok çıkışı"
            _crud.create_notification(
                db,
                title=f"{verb_tr} (WhatsApp foto): {_fmt(parsed.quantity)} {product.unit} {product.name}",
                body=f"Gönderen: {From}",
                type="stock_update",
            )

            if new_stock < float(product.threshold):
                critical_names.append(product.name)

            verb = "✅ girdi" if parsed.action == "in" else "📤 çıktı"
            status = ""
            if float(product.threshold) > 0:
                ratio = new_stock / float(product.threshold)
                if ratio < 0.3:
                    status = " 🔴 KRİTİK"
                elif new_stock < float(product.threshold):
                    status = " ⚠️ eşik altı"
            reply_lines.append(
                f"{verb} {_fmt(parsed.quantity)} {product.unit} {product.name}"
                f" → {_fmt(new_stock)} {product.unit}{status}"
            )

        # One crew run for the whole invoice — the run sees the final state of
        # every product it touched and creates approvals for any below threshold.
        if critical_names:
            label = ", ".join(critical_names[:3]) + ("…" if len(critical_names) > 3 else "")
            background_tasks.add_task(_auto_crew_and_notify, From, label)
            logger.info("Stock critical after photo for %s — single AI Crew queued", label)

        return _twiml("\n".join(reply_lines))

    # ── Text: single-item parse ────────────────────────────────────────────
    if not Body:
        return _twiml(
            "Merhaba! 👋\n"
            "Stok güncellemek için:\n"
            "• Metin: '2 ton buğday teslim alındı'\n"
            "• Fotoğraf: irsaliye veya fiş görseli gönderin"
        )

    try:
        parsed = ai_service.parse_text(Body)
    except APIKeyMissingError:
        return _twiml("❌ Sistem yapılandırma hatası. Yöneticiye bildirin.")
    except AIParsingError:
        return _twiml(
            "❌ Mesaj anlaşılamadı.\n"
            "Miktar, birim ve ürün adını doğal Türkçe ile yazın:\n"
            "• '2 ton buğday teslim alındı'\n"
            "• '500 litre mazot kullanıldı'\n"
            "• '50 adet çuval verildi'"
        )

    # ── Match product in DB ────────────────────────────────────────────────
    product = _find_product(db, parsed.product_name)
    if not product:
        all_products = db.query(models.Product).all()
        names = ", ".join(p.name for p in all_products[:5]) if all_products else "—"
        return _twiml(
            f"⚠️ '{parsed.product_name}' bulunamadı.\n"
            f"Kayıtlı ürünler: {names}\n\n"
            "Tam ürün adını yazarak tekrar deneyin."
        )

    # ── Record the stock movement ──────────────────────────────────────────
    signed_qty = parsed.quantity if parsed.action == "in" else -parsed.quantity
    db.add(models.StockMovement(
        product_id=product.id,
        quantity=signed_qty,
        type=parsed.action,
        source="whatsapp_text",
        notes=parsed.reason,
    ))
    db.commit()

    new_stock = (
        db.query(func.sum(models.StockMovement.quantity))
        .filter(models.StockMovement.product_id == product.id)
        .scalar() or 0.0
    )

    verb_tr = "Stok girişi" if parsed.action == "in" else "Stok çıkışı"
    _crud.create_notification(
        db,
        title=f"{verb_tr} (WhatsApp): {_fmt(parsed.quantity)} {product.unit} {product.name}",
        body=f"Gönderen: {From}" + (f" | Not: {parsed.reason}" if parsed.reason else ""),
        type="stock_update",
    )

    if new_stock < float(product.threshold):
        background_tasks.add_task(_auto_crew_and_notify, From, product.name)
        logger.info("Stock critical for '%s' — AI Crew queued", product.name)

    return _twiml(_build_stock_reply(
        product_name=product.name,
        unit=product.unit,
        quantity=parsed.quantity,
        action=parsed.action,
        reason=parsed.reason or "",
        new_stock=new_stock,
        threshold=float(product.threshold),
    ))
