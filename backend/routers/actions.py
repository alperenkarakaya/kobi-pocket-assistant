import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import crud, schemas

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Action Approvals"])


# ── Email simulation (Phase 3 — replace with Gmail API in Phase 4) ─────────

def _simulate_email_send(payload: dict) -> None:
    subject   = payload.get("email_subject", "Tedarik Talebi")
    recipient = payload.get("recipient", "tedarikci@example.com")
    product   = payload.get("product_name", "Bilinmeyen Ürün")
    body      = payload.get("email_body", "")

    banner = "=" * 64
    print(f"\n{banner}")
    print(f"📧  E-POSTA GÖNDERİLDİ  —  {product}")
    print(f"    To      : {recipient}")
    print(f"    Subject : {subject}")
    print(f"{'─' * 64}")
    print(body)
    print(f"{banner}\n")
    logger.info("📧 Simulated email sent → %s | Subject: %s", recipient, subject)


# ── Approve ────────────────────────────────────────────────────────────────

@router.post("/actions/{action_id}/approve", response_model=schemas.ActionApprovalOut)
async def approve_action(
    action_id: int,
    request: schemas.ApproveActionRequest,
    db: Session = Depends(get_db),
):
    """
    Manager approves a pending AI action.
    For supply_email type: simulates sending the email (prints to console).
    Phase 4: replace simulation with Gmail API call.
    """
    db_action = crud.update_approval_status(db, action_id, schemas.ApprovalStatus.approved)
    if not db_action:
        raise HTTPException(status_code=404, detail="Onay kaydı bulunamadı.")

    payload = json.loads(db_action.payload) if db_action.payload else {}

    # Apply manager edits if provided
    if request.email_subject:
        payload["email_subject"] = request.email_subject
    if request.email_body:
        payload["email_body"] = request.email_body
    if request.recipient:
        payload["recipient"] = request.recipient

    if db_action.type == "supply_email":
        _simulate_email_send(payload)

    return schemas.ActionApprovalOut(
        id=db_action.id,
        type=db_action.type,
        payload=payload,
        status=db_action.status,
        created_at=db_action.created_at,
        updated_at=db_action.updated_at,
    )


# ── Reject ─────────────────────────────────────────────────────────────────

@router.post("/actions/{action_id}/reject", response_model=schemas.ActionApprovalOut)
async def reject_action(
    action_id: int,
    request: schemas.ApproveActionRequest,
    db: Session = Depends(get_db),
):
    """Manager rejects a pending AI action — marks it rejected, no email sent."""
    db_action = crud.update_approval_status(db, action_id, schemas.ApprovalStatus.rejected)
    if not db_action:
        raise HTTPException(status_code=404, detail="Onay kaydı bulunamadı.")

    payload = json.loads(db_action.payload) if db_action.payload else {}

    return schemas.ActionApprovalOut(
        id=db_action.id,
        type=db_action.type,
        payload=payload,
        status=db_action.status,
        created_at=db_action.created_at,
        updated_at=db_action.updated_at,
    )


# ── List ───────────────────────────────────────────────────────────────────

@router.get("/actions", response_model=list[schemas.ActionApprovalOut])
def list_pending_actions(db: Session = Depends(get_db)):
    """Returns all pending approval actions for the dashboard."""
    result = []
    for a in crud.get_pending_approvals(db):
        result.append(
            schemas.ActionApprovalOut(
                id=a.id,
                type=a.type,
                payload=json.loads(a.payload) if a.payload else {},
                status=a.status,
                created_at=a.created_at,
                updated_at=a.updated_at,
            )
        )
    return result
