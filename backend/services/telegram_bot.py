"""
Telegram Bot — stock updates, customer queries, and daily briefings.

Commands:
  /start    → Welcome + register chat for morning briefings
  /status   → All products with stock indicators (manager view)
  /stok     → Same as /status (customer-friendly alias)
  /briefing → Manual morning briefing report
  /yardim   → Command help menu
  text      → Gemini parses → fuzzy match → StockMovement appended
  photo     → Gemini Vision reads invoice → same flow

Morning briefing is sent daily at 08:00 to all registered chats.
"""

import logging
import os
from datetime import datetime, timedelta

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

# Track all chat IDs that have interacted with the bot for morning briefings
_active_chat_ids: set[int] = set()


def get_active_chat_ids() -> set[int]:
    return _active_chat_ids.copy()


def _register_chat(update: Update) -> None:
    if update.effective_chat:
        _active_chat_ids.add(update.effective_chat.id)


# ── Briefing builder ───────────────────────────────────────────────────────

async def send_briefing(bot, chat_id: int) -> None:
    """Build and send the stock briefing report to a specific chat."""
    db = SessionLocal()
    try:
        products = db.query(models.Product).all()
        if not products:
            await bot.send_message(chat_id=chat_id, text="📦 Henüz ürün eklenmemiş.")
            return

        critical, warning, ok_items = [], [], []

        for p in products:
            stock = (
                db.query(func.sum(models.StockMovement.quantity))
                .filter(models.StockMovement.product_id == p.id)
                .scalar() or 0.0
            )
            ratio = stock / p.threshold if p.threshold > 0 else 1.0

            since_7d = datetime.utcnow() - timedelta(days=7)
            total_out = (
                db.query(func.sum(models.StockMovement.quantity))
                .filter(
                    models.StockMovement.product_id == p.id,
                    models.StockMovement.type == "out",
                    models.StockMovement.timestamp >= since_7d,
                )
                .scalar() or 0.0
            )
            daily_avg = abs(total_out) / 7
            days_left = round(stock / daily_avg, 0) if daily_avg > 0 else None

            item = {
                "name": p.name,
                "stock": stock,
                "threshold": p.threshold,
                "unit": p.unit,
                "ratio": ratio,
                "days_left": days_left,
            }

            if ratio < 0.3:
                critical.append(item)
            elif ratio < 0.6:
                warning.append(item)
            else:
                ok_items.append(item)

        today = datetime.now().strftime("%d %B %Y")
        lines = [f"🌅 *Günlük Stok Brifing — {today}*\n"]

        if critical:
            lines.append("🔴 *KRİTİK STOKLAR:*")
            for it in critical:
                days_str = f" (~{int(it['days_left'])} gün kaldı)" if it["days_left"] else ""
                pct = int(it["ratio"] * 100)
                lines.append(f"  • *{it['name']}*: {it['stock']:.0f}/{it['threshold']} {it['unit']} ({pct}%){days_str}")

        if warning:
            lines.append("\n🟡 *DİKKAT GEREKTİREN:*")
            for it in warning:
                days_str = f" (~{int(it['days_left'])} gün)" if it["days_left"] else ""
                pct = int(it["ratio"] * 100)
                lines.append(f"  • *{it['name']}*: {it['stock']:.0f}/{it['threshold']} {it['unit']} ({pct}%){days_str}")

        if ok_items:
            lines.append("\n🟢 *NORMAL SEVİYEDE:*")
            for it in ok_items:
                lines.append(f"  • {it['name']}: ✓")

        lines.append("")
        if critical:
            lines.append(f"⚠️ *{len(critical)} ürün kritik seviyede!*")
            lines.append("Dashboard'dan *AI Crew Analizi Başlat*'a tıklayarak tedarik e-postaları oluşturun.")
        elif warning:
            lines.append(f"ℹ️ {len(warning)} ürün eşiğe yaklaşıyor. Takipte kalın.")
        else:
            lines.append("✅ Tüm stoklar yeterli seviyede. İyi günler!")

        await bot.send_message(
            chat_id=chat_id,
            text="\n".join(lines),
            parse_mode="Markdown",
        )
    except Exception as exc:
        logger.error("send_briefing error for chat %s: %s", chat_id, exc)
    finally:
        db.close()


# ── Command Handlers ───────────────────────────────────────────────────────

async def handle_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    _register_chat(update)
    await update.message.reply_text(
        "🤖 *KOBI Stok Asistanı*'na hoş geldiniz!\n\n"
        "Bu bot Tire Tarım Kooperatifi stok yönetim sistemine bağlıdır.\n\n"
        "Komutlar için /yardim yazın.",
        parse_mode="Markdown",
    )


async def handle_yardim(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    _register_chat(update)
    await update.message.reply_text(
        "📋 *Kullanılabilir Komutlar:*\n\n"
        "*/status* — Tüm ürünlerin stok durumu\n"
        "*/stok* — Stok durumu (kısa özet)\n"
        "*/briefing* — Günlük stok brifingini şimdi al\n"
        "*/yardim* — Bu yardım menüsü\n\n"
        "📝 *Stok Güncellemek İçin:*\n"
        "Metin mesajı gönderin:\n"
        "`250 kg buğday teslim alındı`\n"
        "`30 litre mazot kullanıldı`\n\n"
        "📸 *İrsaliye Göndermek İçin:*\n"
        "Fatura/irsaliye fotoğrafı gönderin — AI otomatik okur.\n\n"
        "🌅 *Sabah Brifing:*\n"
        "Her sabah 08:00'de otomatik stok özeti gönderilir.",
        parse_mode="Markdown",
    )


async def handle_briefing(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    _register_chat(update)
    await update.message.reply_text("📊 Brifing hazırlanıyor...")
    await send_briefing(context.bot, update.effective_chat.id)


async def handle_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    _register_chat(update)
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


_QUERY_SIGNALS = [
    "?", "ne kadar", "var mı", "var mi", "mevcut mu", "mevcut mi",
    "kaç", "kac", "stok durumu", "stokta", "bakiye", "seviye nedir",
    "ne zaman", "biter mi", "bitiyor mu", "tükeniyor", "tükendi",
]


def _is_customer_query(text: str) -> bool:
    t = text.lower()
    return any(sig in t for sig in _QUERY_SIGNALS)


async def _handle_customer_query(
    update: Update, db, text: str
) -> None:
    """Answer a natural-language stock availability question using Gemini."""
    products = db.query(models.Product).all()
    if not products:
        await update.message.reply_text("📦 Henüz ürün eklenmemiş.")
        return

    stock_lines = []
    for p in products:
        stock = (
            db.query(func.sum(models.StockMovement.quantity))
            .filter(models.StockMovement.product_id == p.id)
            .scalar() or 0.0
        )
        status = "KRİTİK" if stock < p.threshold else "YETERLİ"
        stock_lines.append(f"- {p.name} ({p.sku}): {stock:.1f} {p.unit} [{status}]")

    stock_context = "\n".join(stock_lines)
    prompt = (
        f"Sen Tire Tarım Kooperatifi'nin stok asistanısın. "
        f"Mevcut stok bilgileri:\n{stock_context}\n\n"
        f"Kullanıcı sorusu: '{text}'\n\n"
        f"Kısa, Türkçe, dostane bir cevap ver. Sadece soruya ilgili bilgiyi paylaş."
    )

    try:
        import google.generativeai as genai
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        answer = response.text.strip()
        await update.message.reply_text(f"🤖 {answer}")
    except Exception as exc:
        logger.error("Chatbot Gemini error: %s", exc)
        await update.message.reply_text(
            "📦 *Stok Durumu:*\n" + stock_context, parse_mode="Markdown"
        )


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    _register_chat(update)
    text = update.message.text
    db = SessionLocal()
    try:
        if _is_customer_query(text):
            await _handle_customer_query(update, db, text)
            return

        parsed = ai_service.parse_text(text)
        product = find_product(db, parsed.product_name)
        if not product:
            await update.message.reply_text(
                f"⚠️ *'{parsed.product_name}'* ürünü bulunamadı.\n"
                "Lütfen ürünü Dashboard'daki Stok Yönetimi sayfasından ekleyin.",
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

        # Create notification for Telegram stock update
        import crud as _crud
        verb_tr = "Stok girişi" if parsed.action == "in" else "Stok çıkışı"
        _crud.create_notification(
            db,
            title=f"{verb_tr} (Telegram): {parsed.quantity} {product.unit} {product.name}",
            body=parsed.reason,
            type="stock_update",
        )

        verb = "stoka eklendi ✅" if parsed.action == "in" else "stoktan düşüldü 📤"
        await update.message.reply_text(
            f"*{parsed.quantity} {product.unit} {product.name}* {verb}\n"
            f"_{parsed.reason}_",
            parse_mode="Markdown",
        )
    except ai_service.AIParsingError:
        await _handle_customer_query(update, db, text)
    except Exception as exc:
        logger.error("Telegram text handler error: %s", exc)
        await update.message.reply_text("❌ Bir hata oluştu, tekrar deneyin.")
    finally:
        db.close()


async def _process_image_bytes(
    update: Update, db, image_bytes: bytes, mime_type: str = "image/jpeg"
) -> None:
    """Shared logic for photo and document image handlers."""
    await update.message.reply_text("🔍 Görsel analiz ediliyor...")
    parsed = ai_service.parse_image(image_bytes, mime_type)
    product = find_product(db, parsed.product_name)
    if not product:
        await update.message.reply_text(
            f"📄 İrsaliye okundu — ama *'{parsed.product_name}'* bulunamadı.\n"
            "Lütfen ürünü Stok Yönetimi sayfasından ekleyin.",
            parse_mode="Markdown",
        )
        return

    signed_qty = parsed.quantity if parsed.action == "in" else -parsed.quantity
    movement = models.StockMovement(
        product_id=product.id,
        quantity=signed_qty,
        type=parsed.action,
        source="telegram_photo",
        notes=parsed.reason,
    )
    db.add(movement)

    import crud as _crud
    verb_tr = "Stok girişi" if parsed.action == "in" else "Stok çıkışı"
    _crud.create_notification(
        db,
        title=f"{verb_tr} (Telegram Fotoğraf): {parsed.quantity} {product.unit} {product.name}",
        body=parsed.reason,
        type="stock_update",
    )
    db.commit()

    verb = "stoka eklendi ✅" if parsed.action == "in" else "stoktan düşüldü 📤"
    await update.message.reply_text(
        f"📄 İrsaliye okundu!\n"
        f"*{parsed.quantity} {product.unit} {product.name}* {verb}\n"
        f"_{parsed.reason}_",
        parse_mode="Markdown",
    )


async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    _register_chat(update)
    db = SessionLocal()
    try:
        photo = update.message.photo[-1]
        tg_file = await context.bot.get_file(photo.file_id)
        image_bytes = bytes(await tg_file.download_as_bytearray())
        await _process_image_bytes(update, db, image_bytes, "image/jpeg")
    except ai_service.AIParsingError as exc:
        await update.message.reply_text(f"❌ Fotoğraf okunamadı: {exc}")
    except Exception as exc:
        logger.error("Telegram photo handler error: %s", exc)
        await update.message.reply_text("❌ Fotoğraf işlenemedi, tekrar deneyin.")
    finally:
        db.close()


async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle images sent as files (uncompressed) via Telegram."""
    _register_chat(update)
    doc = update.message.document
    if not doc or not doc.mime_type or not doc.mime_type.startswith("image/"):
        await update.message.reply_text(
            "📎 Sadece görsel dosyalar (jpg, png, webp) işlenebilir."
        )
        return

    db = SessionLocal()
    try:
        tg_file = await context.bot.get_file(doc.file_id)
        image_bytes = bytes(await tg_file.download_as_bytearray())
        await _process_image_bytes(update, db, image_bytes, doc.mime_type)
    except ai_service.AIParsingError as exc:
        await update.message.reply_text(f"❌ Dosya okunamadı: {exc}")
    except Exception as exc:
        logger.error("Telegram document handler error: %s", exc)
        await update.message.reply_text("❌ Dosya işlenemedi, tekrar deneyin.")
    finally:
        db.close()


# ── Builder ────────────────────────────────────────────────────────────────

def build_application() -> Application | None:
    if not _TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN not set — Telegram bot disabled.")
        return None

    app = ApplicationBuilder().token(_TOKEN).build()
    app.add_handler(CommandHandler("start", handle_start))
    app.add_handler(CommandHandler("yardim", handle_yardim))
    app.add_handler(CommandHandler("briefing", handle_briefing))
    app.add_handler(CommandHandler("status", handle_status))
    app.add_handler(CommandHandler("stok", handle_status))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    app.add_handler(MessageHandler(filters.Document.IMAGE, handle_document))
    logger.info("Telegram bot configured with token ...%s", _TOKEN[-6:])
    return app
