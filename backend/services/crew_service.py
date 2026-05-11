"""
CrewAI multi-agent stock analysis service.

Flow:
  Analyst (3 DB tools)  →  Planner (reasoning only)  →  Drafter (Turkish emails)
  Each agent's output is passed as context to the next via task.context.
  Final output: JSON array of per-product supply email payloads.
"""

import json
import logging
import os
import re
import uuid

from crewai import Agent, Crew, LLM, Process, Task
from sqlalchemy.orm import Session

from services.crew_tools import get_all_stock_status, get_consumption_rate, get_movement_history

logger = logging.getLogger(__name__)

_GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


def _make_llm() -> LLM:
    return LLM(
        model="gemini/gemini-2.5-flash",
        api_key=_GEMINI_API_KEY,
        temperature=0.3,
    )


def _build_supplier_map(db: Session) -> dict[int, dict]:
    """Returns {product_id: {name, email}} for products that have a supplier assigned."""
    from models import Product
    supplier_map: dict[int, dict] = {}
    products = db.query(Product).all()
    for p in products:
        if p.supplier_id and p.supplier:
            supplier_map[p.id] = {"name": p.supplier.name, "email": p.supplier.email}
    return supplier_map


def run_crew(db: Session) -> list[dict]:
    """
    Runs the 3-agent sequential crew.
    Returns a list of per-product dicts ready for ActionApproval payloads.
    Raises on unrecoverable failure.
    """
    llm = _make_llm()
    run_id = str(uuid.uuid4())[:8]
    supplier_map = _build_supplier_map(db)

    # ── Agent 1: Stock Analyst ─────────────────────────────────────────────
    analyst = Agent(
        role="Stok Zeka Analisti",
        goal=(
            "Tüm ürünlerin güncel stok durumunu araçlarla sorgula. "
            "Kritik ürünler için tüketim hızını ve hareket geçmişini analiz et. "
            "Her kritik ürün için aciliyet skoru (HIGH/MEDIUM/LOW) belirle."
        ),
        backstory=(
            "Tire Tarım Kooperatifi'nde 10 yıldır çalışan bir stok analistisin. "
            "Rakamların arkasındaki trendi okur, gerçekten acil olanı basit eşik "
            "kontrolünden çok daha iyi anlarsın."
        ),
        tools=[get_all_stock_status, get_consumption_rate, get_movement_history],
        llm=llm,
        verbose=True,
        allow_delegation=False,
    )

    # ── Agent 2: Supply Planner ────────────────────────────────────────────
    planner = Agent(
        role="Tedarik Stratejisti",
        goal=(
            "Analistin verilerini al. Her kritik ürün için: "
            "önerilen sipariş miktarını hesapla ve kısa Türkçe gerekçe yaz. "
            "Ürünleri aciliyet sırasına göre sırala."
        ),
        backstory=(
            "Kooperatifin bütçe ve tedarik planlamasından sorumlu müdürsün. "
            "Hem anlık eksiklikleri hem de sezonluk talepleri göz önünde "
            "bulundurarak akıllıca sipariş miktarları belirlersin."
        ),
        tools=[],
        llm=llm,
        verbose=True,
        allow_delegation=False,
    )

    # ── Agent 3: Email Drafter ─────────────────────────────────────────────
    drafter = Agent(
        role="Türkçe İş Yazışmaları Uzmanı",
        goal=(
            "Planlayıcının her kritik ürünü için profesyonel Türkçe tedarik "
            "e-postası yaz ve YALNIZCA geçerli JSON dizisi döndür."
        ),
        backstory=(
            "Tire Tarım Kooperatifi adına yıllarca tedarikçilerle yazışmış "
            "deneyimli bir idari müdürsün. Resmi ama dostane, net ama kibar "
            "bir Türkçe kullanırsın."
        ),
        tools=[],
        llm=llm,
        verbose=True,
        allow_delegation=False,
    )

    # ── Tasks ──────────────────────────────────────────────────────────────

    task_analyze = Task(
        description=(
            "1. get_all_stock_status aracını çağır — tüm ürünlerin listesini al.\n"
            "2. is_critical=true olan her ürün için:\n"
            "   - get_consumption_rate(product_id, days=7) çağır\n"
            "   - get_movement_history(product_id, limit=10) çağır\n"
            "3. Her kritik ürün için şunu hesapla:\n"
            "   - urgency_level: stock_ratio<0.3 → HIGH, <0.6 → MEDIUM, diğerleri → LOW\n"
            "   - days_to_empty: current_stock / daily_avg_consumption (0 ise 'hesaplanamadı')\n"
            "4. Kritik ürünlerin özetini JSON olarak çıkar:\n"
            "   [{id, name, unit, current_stock, threshold, stock_ratio, deficit,\n"
            "     urgency_level, daily_avg_consumption, days_to_empty}]"
        ),
        agent=analyst,
        expected_output="JSON array of critical products with urgency analysis",
    )

    task_plan = Task(
        description=(
            "Analistin JSON çıktısını al. Her ürün için:\n"
            "1. recommended_order_qty hesapla:\n"
            "   - Temel: (threshold * 2) - current_stock\n"
            "   - daily_avg_consumption > threshold/7 ise 1.5x çarp (yüksek tüketim)\n"
            "   - En az 1 birim olsun\n"
            "2. urgency_label ekle: HIGH→'Kritik', MEDIUM→'Orta', LOW→'Düşük'\n"
            "3. Türkçe reasoning yaz (2-3 cümle): neden acil, ne kadar süre kaldı\n"
            "4. stock_ratio en düşük ürün = en üstte olacak şekilde sırala\n"
            "Çıktı: aynı JSON dizisi, recommended_order_qty, urgency_label, reasoning eklenerek."
        ),
        agent=planner,
        expected_output="JSON array with order quantities, urgency labels, and Turkish reasoning",
        context=[task_analyze],
    )

    # Build supplier context string for the drafter
    if supplier_map:
        supplier_lines = "\n".join(
            f"  - Ürün ID {pid}: {s['name']} ({s['email']})"
            for pid, s in supplier_map.items()
        )
        supplier_hint = (
            f"\nTedarikçi rehberi (bu e-postaları firmaya ismiyle hitap ederek yaz):\n"
            f"{supplier_lines}\n"
            "recipient alanını bu tablodaki e-posta adreslerinden kullan. "
            "Tabloda olmayan ürünler için recipient olarak 'tedarikci@example.com' yaz.\n"
        )
    else:
        supplier_hint = (
            "\nHenüz ürünlere tedarikçi atanmamış. "
            "recipient alanı için 'tedarikci@example.com' kullan.\n"
        )

    task_draft = Task(
        description=(
            "Planlayıcının JSON çıktısındaki her ürün için tedarik e-postası yaz.\n\n"
            f"{supplier_hint}\n"
            "Her e-posta: tedarikçi firmasına ismiyle hitap et, aciliyeti belirt, "
            "önerilen miktarı say, 'Tire Tarım Kooperatifi Yönetimi' imzası koy.\n\n"
            "YALNIZCA şu JSON formatında bir dizi döndür — başka hiçbir şey olmadan:\n"
            "[\n"
            "  {\n"
            '    "product_id": <int>,\n'
            '    "product_name": "<str>",\n'
            '    "current_stock": <float>,\n'
            '    "threshold": <float>,\n'
            '    "unit": "<str>",\n'
            '    "email_subject": "<kısa ve net konu>",\n'
            '    "email_body": "<tam e-posta metni>",\n'
            '    "recipient": "<tedarikçi e-postası>",\n'
            '    "supplier_name": "<tedarikçi firma adı veya boş string>",\n'
            '    "agent_analysis": {\n'
            '      "stock_ratio": <float>,\n'
            '      "deficit": <float>,\n'
            '      "urgency_level": "<HIGH|MEDIUM|LOW>",\n'
            '      "urgency_label": "<Kritik|Orta|Düşük>",\n'
            '      "recommended_order_qty": <float>,\n'
            '      "reasoning": "<Türkçe gerekçe>"\n'
            "    }\n"
            "  }\n"
            "]\n\n"
            "Markdown, açıklama veya başka herhangi bir metin EKLEME."
        ),
        agent=drafter,
        expected_output="Valid JSON array — no markdown, no prose, only the array",
        context=[task_plan],
    )

    crew = Crew(
        agents=[analyst, planner, drafter],
        tasks=[task_analyze, task_plan, task_draft],
        process=Process.sequential,
        verbose=True,
        max_rpm=8,          # stay under Gemini free-tier limit (10 req/min)
    )

    result = crew.kickoff()

    # ── Parse crew output ──────────────────────────────────────────────────
    raw = result.raw if hasattr(result, "raw") else str(result)
    cleaned = raw.strip()

    # Strip markdown fences if present
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        cleaned = "\n".join(lines[1:-1]).strip()

    # Try direct parse, then regex fallback
    try:
        items: list[dict] = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if not match:
            raise ValueError(f"Crew produced unparseable output:\n{cleaned[:500]}")
        items = json.loads(match.group())

    if not isinstance(items, list):
        raise ValueError("Crew output was not a JSON array.")

    for item in items:
        item["generated_by"] = "crewai_v1"
        item["crew_run_id"] = run_id
        # Always override recipient with actual supplier email (crew can hallucinate)
        pid = item.get("product_id")
        if pid and int(pid) in supplier_map:
            s = supplier_map[int(pid)]
            item["recipient"] = s["email"]
            item["supplier_name"] = s["name"]

    logger.info("CrewAI run %s complete — %d items", run_id, len(items))
    return items
