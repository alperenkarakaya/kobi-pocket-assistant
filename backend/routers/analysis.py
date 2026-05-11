"""
AI Stock Analysis — Phase 4 (CrewAI multi-agent).

POST /api/analyze-stocks
  Runs a 3-agent CrewAI crew (Analyst → Planner → Email Drafter).
  Each critical product below threshold gets a richer ActionApproval with
  urgency scoring, recommended order quantities, and Turkish reasoning.
  Idempotent: skips products that already have a pending approval.
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud, schemas
from database import get_db
from services import ai_service, crew_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["AI Analysis"])


def _pending_as_out(db: Session) -> list[schemas.ActionApprovalOut]:
    result = []
    for a in crud.get_pending_approvals(db):
        try:
            p = json.loads(a.payload) if a.payload else {}
        except Exception:
            p = {}
        result.append(schemas.ActionApprovalOut(
            id=a.id, type=a.type, payload=p, status=a.status,
            created_at=a.created_at, updated_at=a.updated_at,
        ))
    return result


@router.post("/analyze-stocks", response_model=list[schemas.ActionApprovalOut])
def analyze_stocks(db: Session = Depends(get_db)):
    """
    Trigger the AI Crew analysis. Takes ~30 seconds.

    Runs 3 specialized agents in sequence:
      1. Stock Analyst  — queries DB tools, scores urgency
      2. Supply Planner — calculates order quantities & reasoning
      3. Email Drafter  — writes professional Turkish supplier emails

    Returns all currently pending supply approvals (including pre-existing ones).
    Safe to call multiple times — duplicate approvals are suppressed.
    """
    if not ai_service._API_KEY:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY yapılandırılmamış. Lütfen backend/.env dosyasını kontrol edin.",
        )

    # Collect product IDs that already have a pending supply_email
    already_pending: set[int] = set()
    for approval in crud.get_pending_approvals(db):
        if approval.type != "supply_email":
            continue
        try:
            pid = json.loads(approval.payload).get("product_id")
            if pid is not None:
                already_pending.add(int(pid))
        except Exception:
            pass

    # Run the crew
    try:
        items = crew_service.run_crew(db)
    except Exception as exc:
        logger.error("CrewAI run failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"AI Crew analiz hatası: {exc}",
        )

    # Persist new approvals (skip already-pending products)
    created = 0
    for item in items:
        pid = item.get("product_id")
        if pid is not None and int(pid) in already_pending:
            logger.info("Skipping product_id=%s (already pending)", pid)
            continue
        crud.create_action_approval(
            db,
            schemas.ActionApprovalCreate(type="supply_email", payload=item),
        )
        created += 1
        logger.info("✅ CrewAI supply_email created for '%s'", item.get("product_name"))

    logger.info("analyze-stocks: %d new approval(s) created by AI Crew", created)

    if created > 0:
        crud.create_notification(
            db,
            title=f"AI Crew analizi tamamlandı — {created} tedarik talebi oluşturuldu",
            body="Kritik ürünler için e-posta taslağı hazır. Lütfen onay panelini kontrol edin.",
            type="ai_analysis",
        )
    else:
        crud.create_notification(
            db,
            title="AI Crew analizi tamamlandı — tüm stoklar yeterli seviyede",
            body=None,
            type="info",
        )

    return _pending_as_out(db)
