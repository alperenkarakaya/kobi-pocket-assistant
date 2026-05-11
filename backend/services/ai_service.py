"""
Gemini AI Service — structured OCR for stock movements.

Accepts either a WhatsApp/Telegram text message or raw image bytes from an
invoice photo (irsaliye/fiş), and returns a validated ParsedStockData object.

Flow:
  Text  → parse_text()  → Gemini 2.5 Pro text → _parse_response() → ParsedStockData
  Image → parse_image() → Gemini 2.5 Pro Vision → _parse_response() → ParsedStockData
"""

import os
import json
import io
import logging
from typing import Optional

import google.generativeai as genai
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ── Init ───────────────────────────────────────────────────────────────────

_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

if _API_KEY:
    genai.configure(api_key=_API_KEY)

# ── Output schema ──────────────────────────────────────────────────────────

class ParsedStockData(BaseModel):
    """Structured output from Gemini — one stock movement event."""
    product_name: str = Field(description="Product name in Turkish, e.g. 'Buğday'")
    quantity: float = Field(description="Quantity (always a positive number)")
    action: str = Field(description="Strictly 'in' (incoming) or 'out' (outgoing)")
    reason: str = Field(description="Brief Turkish explanation, e.g. 'İrsaliye Okundu'")

# ── Exceptions ─────────────────────────────────────────────────────────────

class AIParsingError(Exception):
    """Raised when Gemini fails to produce valid structured output."""

class APIKeyMissingError(AIParsingError):
    """Raised when GEMINI_API_KEY is not set."""

# ── System prompt ──────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
Sen bir tarım kooperatifinin yapay zeka stok asistanısın.
Görevin: WhatsApp/Telegram metin mesajlarından veya irsaliye, fiş ve makbuz \
fotoğraflarından stok hareketi bilgilerini çıkarmak.

YALNIZCA aşağıdaki formatta geçerli JSON döndür — markdown, kod blokları veya \
açıklama OLMADAN:
{
  "product_name": "<Türkçe ürün adı, kısa ve net>",
  "quantity": <sıfırdan büyük pozitif sayı>,
  "action": "<tam olarak 'in' veya 'out'>",
  "reason": "<kısa Türkçe açıklama>"
}

Eylem Kuralları:
- 'in'  → teslim, sevk, giriş, alındı, geldi, satın alındı, temin edildi
- 'out' → satış, çıkış, tüketim, kullanıldı, verildi, dağıtıldı, harcandı

Fotoğraf Kuralları:
- Belgeden ürün adını, miktarı ve birimi oku
- Birimi reason alanına ekle (örn. 'İrsaliye Okundu — 250 kg')
- Eğer belge bir teslimat/alım fişiyse → action = 'in'
- Eğer belge bir satış/çıkış fişiyse → action = 'out'
- Belgede birden fazla ürün varsa: en büyük miktarlı veya ilk satırdaki ürünü seç
- MUTLAKA tek bir ürün için JSON döndür — dizi değil, tek nesne

product_name örnekleri: 'Buğday', 'Arpa', 'Mazot', 'Gübre', 'Ayçiçeği Tohumu'
"""

# ── Model factory ──────────────────────────────────────────────────────────

def _get_model() -> genai.GenerativeModel:
    if not _API_KEY:
        raise APIKeyMissingError(
            "GEMINI_API_KEY ortam değişkeni ayarlanmamış. "
            "Lütfen backend/.env dosyasına ekleyin."
        )
    return genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.1,
            max_output_tokens=512,
        ),
        system_instruction=_SYSTEM_PROMPT,
    )


def _get_image_model() -> genai.GenerativeModel:
    """Vision model — no response_mime_type; multimodal + JSON mode is unreliable."""
    if not _API_KEY:
        raise APIKeyMissingError(
            "GEMINI_API_KEY ortam değişkeni ayarlanmamış. "
            "Lütfen backend/.env dosyasına ekleyin."
        )
    return genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        generation_config=genai.GenerationConfig(
            temperature=0.1,
            max_output_tokens=2048,
        ),
        system_instruction=_SYSTEM_PROMPT,
    )

# ── Public API ─────────────────────────────────────────────────────────────

def parse_text(text: str) -> ParsedStockData:
    """
    Parse a WhatsApp/Telegram text message.
    e.g. '250 kg buğday teslim alındı' → ParsedStockData(product_name='Buğday', quantity=250, action='in', ...)
    """
    try:
        model = _get_model()
        prompt = f"Aşağıdaki mesajdan stok hareketi bilgisini çıkar:\n\n{text}"
        response = model.generate_content(prompt)
        return _parse_response(response.text)
    except AIParsingError:
        raise
    except Exception as exc:
        logger.error("Gemini text parse error: %s", exc)
        raise AIParsingError(f"Metin ayrıştırılamadı: {exc}") from exc


def parse_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> ParsedStockData:
    """Single-item image parse (used by the JSON /webhook/message endpoint)."""
    try:
        model = _get_image_model()
        prompt = (
            "Bu irsaliye/fiş/makbuz/fatura fotoğrafından stok hareketi bilgisini çıkar. "
            "Birden fazla ürün varsa yalnızca ilk satırdakini al. "
            "Tek bir JSON nesnesi döndür — dizi değil."
        )
        image_part = {"mime_type": mime_type, "data": image_bytes}
        response = model.generate_content([prompt, image_part])
        if not response.text:
            raise AIParsingError("Gemini boş yanıt döndürdü — görsel okunamadı.")
        return _parse_response(response.text)
    except AIParsingError:
        raise
    except Exception as exc:
        logger.error("Gemini vision parse error: %s", exc)
        raise AIParsingError(f"Fotoğraf ayrıştırılamadı: {exc}") from exc


def parse_image_multi(image_bytes: bytes, mime_type: str = "image/jpeg") -> list[ParsedStockData]:
    """
    Parse ALL line items from an invoice photo.
    Returns one ParsedStockData per product row found.
    """
    try:
        model = _get_image_model()
        prompt = (
            "Bu irsaliye/fiş/makbuz/fatura fotoğrafındaki HER ürün satırı için stok hareketi bilgisini çıkar. "
            "JSON dizisi (array) olarak döndür — her satır için bir nesne:\n"
            '[{"product_name":"...","quantity":...,"action":"in","reason":"..."}]'
        )
        image_part = {"mime_type": mime_type, "data": image_bytes}
        response = model.generate_content([prompt, image_part])
        try:
            raw_text = response.text
        except Exception as e:
            logger.error("Gemini response.text access failed (likely safety block): %s", e)
            raise AIParsingError("Gemini görseli güvenlik filtresiyle reddetti.") from e
        logger.info("Gemini multi-item raw response: %r", raw_text[:500] if raw_text else None)
        if not raw_text:
            raise AIParsingError("Gemini boş yanıt döndürdü — görsel okunamadı.")
        return _parse_multi_response(raw_text)
    except AIParsingError:
        raise
    except Exception as exc:
        logger.error("Gemini multi-item vision parse error: %s", exc)
        raise AIParsingError(f"Fotoğraf ayrıştırılamadı: {exc}") from exc

# ── Response parser ────────────────────────────────────────────────────────

def _extract_first_json_object(text: str) -> str | None:
    """Extract the first complete, balanced {...} object from text."""
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    in_string = False
    escape_next = False
    for i, ch in enumerate(text[start:], start):
        if escape_next:
            escape_next = False
            continue
        if ch == "\\" and in_string:
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def _parse_response(raw: str) -> ParsedStockData:
    """Validate and coerce Gemini's JSON output into ParsedStockData."""
    cleaned = raw.strip()

    # Strip markdown fences
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        cleaned = "\n".join(lines[1:-1]).strip()

    # Try direct parse; fall back to extracting the first balanced {...} block.
    # Using rfind("}") is wrong for multi-item responses — it grabs across multiple objects.
    try:
        data: dict = json.loads(cleaned)
    except json.JSONDecodeError:
        fragment = _extract_first_json_object(cleaned)
        if not fragment:
            raise AIParsingError(
                f"Gemini JSON bloğu bulunamadı.\nHam çıktı: {cleaned[:300]}"
            )
        try:
            data = json.loads(fragment)
        except json.JSONDecodeError as exc:
            raise AIParsingError(
                f"Gemini geçersiz JSON döndürdü: {exc}\nHam çıktı: {cleaned[:300]}"
            ) from exc

    # Normalize and validate fields
    action = str(data.get("action", "in")).lower().strip()
    data["action"] = action if action in ("in", "out") else "in"
    data["quantity"] = abs(float(data.get("quantity", 0) or 0))

    if data["quantity"] == 0:
        raise AIParsingError("Gemini sıfır miktar döndürdü — mesaj yeniden kontrol edilmeli.")

    try:
        return ParsedStockData(**data)
    except Exception as exc:
        raise AIParsingError(f"Çıktı doğrulaması başarısız: {exc}") from exc


def _parse_multi_response(raw: str) -> list[ParsedStockData]:
    """Parse Gemini's JSON array response into a list of ParsedStockData."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        cleaned = "\n".join(lines[1:-1]).strip()

    # Try as a JSON array; if that fails, extract every {...} object from the text
    try:
        items = json.loads(cleaned)
        if isinstance(items, dict):
            items = [items]
    except json.JSONDecodeError:
        items = []
        remaining = cleaned
        while True:
            fragment = _extract_first_json_object(remaining)
            if not fragment:
                break
            try:
                items.append(json.loads(fragment))
            except json.JSONDecodeError:
                pass
            idx = remaining.find(fragment) + len(fragment)
            remaining = remaining[idx:]

    if not items:
        raise AIParsingError("Fotoğrafta hiç ürün bulunamadı.")

    result = []
    for item in items:
        try:
            action = str(item.get("action", "in")).lower().strip()
            item["action"] = action if action in ("in", "out") else "in"
            item["quantity"] = abs(float(item.get("quantity", 0) or 0))
            if item["quantity"] == 0:
                continue
            result.append(ParsedStockData(**item))
        except Exception:
            continue

    if not result:
        raise AIParsingError("Geçerli stok hareketi bulunamadı.")
    return result


# ── Phase 3: Email draft generator ────────────────────────────────────────

_EMAIL_SYSTEM = (
    "Sen Tire Tarım Kooperatifi adına tedarikçilerle yazışan bir yönetici asistanısın. "
    "Profesyonel, resmi, nazik ve net Türkçe iş e-postaları yazarsın. "
    "Kısa ama eksiksiz ol — selamlama, talep, miktar, aciliyet ve imza mutlaka olsun."
)

def draft_supply_email(
    product_name: str,
    unit: str,
    current_stock: float,
    threshold: float,
) -> dict:
    """
    Generate a professional Turkish supplier restock email draft.
    Returns {"subject": str, "body": str}.
    """
    if not _API_KEY:
        raise APIKeyMissingError("GEMINI_API_KEY yapılandırılmamış.")

    model = genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.7,
            max_output_tokens=1024,
        ),
        system_instruction=_EMAIL_SYSTEM,
    )

    deficit = round(threshold - current_stock, 2)
    prompt = f"""
Aşağıdaki kritik stok durumu için tedarikçiye acil tedarik talebi e-postası oluştur:

Ürün       : {product_name}
Mevcut Stok: {current_stock} {unit}
Kritik Eşik: {threshold} {unit}
Açık Miktar: {deficit} {unit} eksik

Tam olarak şu JSON formatında döndür:
{{
  "subject": "<e-posta konusu — kısa ve net>",
  "body": "<tam e-posta metni — selamlama, talep, miktar, aciliyet ve 'Tire Tarım Kooperatifi Yönetimi' imzası>"
}}
"""
    try:
        response = model.generate_content(prompt)
        cleaned = response.text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            cleaned = "\n".join(lines[1:-1]).strip()
        result = json.loads(cleaned)
        if "subject" not in result or "body" not in result:
            raise AIParsingError("E-posta taslağında 'subject' veya 'body' alanı eksik.")
        return result
    except AIParsingError:
        raise
    except Exception as exc:
        logger.error("Email draft failed for %s: %s", product_name, exc)
        raise AIParsingError(f"E-posta taslağı oluşturulamadı: {exc}") from exc
