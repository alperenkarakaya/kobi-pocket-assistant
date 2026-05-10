"""
Telegram Bot — stock updates via chat.

Handlers:
  /status   → lists all products with 🟢/🔴 stock indicators
  text      → Gemini parses → fuzzy product match → StockMovement appended
  photo     → Gemini Vision reads invoice → same flow

Run via FastAPI lifespan (non-blocking asyncio polling).
Token read from TELEGRAM_BOT_TOKEN env var; bot silently disabled if unset.
"""

import logging
import os

from sqlalchemy import func
from telegram import Update
from telegram.ext import (
    Application,
    ApplicationBuilder,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

import models
from database import SessionLocal
from services import ai_service
from services.product_service import find_product

logger = logging.getLogger(__name__)

_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")


# ── Handlers ───────────────────────────────────────────────────────────────

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = update.message.text
    db = SessionLocal()
    try:
        parsed = ai_service.parse_text(text)
        product = find_product(db, parsed.product_name)
        if not product:
            await update.message.reply_text(
                f"⚠️ *'{parsed.product_name}'* ürünü bulunamadı.\n"
                "Lütfen ürünü Stok Yönetimi sayfasından ekleyin.",
                parse_mode="Markdown",
            )
            return

        signed_qty = parsed.quantity if parsed.action == "in" else -parsed.quantity
        db.add(models.StockMovement(
            product_id=product.id,
            quantity=signed_qty,
            type=parsed.action,
            source="telegram_text",
            notes=parsed.reason,
        ))
        db.commit()

        verb = "stoka eklendi ✅" if parsed.action == "in" else "stoktan düşüldü 📤"
        await update.message.reply_text(
            f"*{parsed.quantity} {product.unit} {product.name}* {verb}\n"
            f"_{parsed.reason}_",
            parse_mode="Markdown",
        )
    except ai_service.AIParsingError as exc:
        await update.message.reply_text(f"❌ Anlayamadım: {exc}")
    except Exception as exc:
        logger.error("Telegram text handler error: %s", exc)
        await update.message.reply_text("❌ Bir hata oluştu, tekrar deneyin.")
    finally:
        db.close()


async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    db = SessionLocal()
    try:
        photo = update.message.photo[-1]       # highest resolution
        tg_file = await context.bot.get_file(photo.file_id)
        image_bytes = bytes(await tg_file.download_as_bytearray())

        parsed = ai_service.parse_image(image_bytes, "image/jpeg")
        product = find_product(db, parsed.product_name)
        if not product:
            await update.message.reply_text(
                f"📄 İrsaliye okundu — ama *'{parsed.product_name}'* bulunamadı.\n"
                "Lütfen ürünü Stok Yönetimi sayfasından ekleyin.",
                parse_mode="Markdown",
            )
            return

        signed_qty = parsed.quantity if parsed.action == "in" else -parsed.quantity
        db.add(models.StockMovement(
            product_id=product.id,
            quantity=signed_qty,
            type=parsed.action,
            source="telegram_photo",
            notes=parsed.reason,
        ))
        db.commit()

        await update.message.reply_text(
            f"📄 İrsaliye okundu!\n"
            f"*{parsed.quantity} {product.unit} {product.name}* stoka işlendi ✅\n"
            f"_{parsed.reason}_",
            parse_mode="Markdown",
        )
    except ai_service.AIParsingError as exc:
        await update.message.reply_text(f"❌ Fotoğraf okunamadı: {exc}")
    except Exception as exc:
        logger.error("Telegram photo handler error: %s", exc)
        await update.message.reply_text("❌ Fotoğraf işlenemedi, tekrar deneyin.")
    finally:
        db.close()


async def handle_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    db = SessionLocal()
    try:
        products = db.query(models.Product).all()
        if not products:
            await update.message.reply_text("📦 Henüz ürün eklenmemiş.")
            return

        lines = ["📦 *Güncel Stok Durumu*\n"]
        for p in products:
            stock = (
                db.query(func.sum(models.StockMovement.quantity))
                .filter(models.StockMovement.product_id == p.id)
                .scalar() or 0.0
            )
            icon = "🔴" if stock < p.threshold else "🟢"
            ratio = f"{int(stock / p.threshold * 100)}%" if p.threshold > 0 else "—"
            lines.append(
                f"{icon} *{p.name}*: `{stock:.1f}/{p.threshold} {p.unit}` ({ratio})"
            )

        await update.message.reply_text("\n".join(lines), parse_mode="Markdown")
    finally:
        db.close()


# ── Builder ────────────────────────────────────────────────────────────────

def build_application() -> Application | None:
    """Returns a configured Application, or None if token is not set."""
    if not _TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN not set — Telegram bot disabled.")
        return None

    app = ApplicationBuilder().token(_TOKEN).build()
    app.add_handler(CommandHandler("status", handle_status))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    logger.info("Telegram bot configured with token ...%s", _TOKEN[-6:])
    return app
