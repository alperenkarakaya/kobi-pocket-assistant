import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import crud, schemas
from services.email_service import send_gmail, SENDER_ADDRESS

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Action Approvals"])


# ── Approve ────────────────────────────────────────────────────────────────

@router.post("/actions/{action_id}/approve", response_model=schemas.ActionApprovalOut)
async def approve_action(
    action_id: int,
    request: schemas.ApproveActionRequest,
    db: Session = Depends(get_db),
):
    db_action = crud.update_approval_status(db, action_id, schemas.ApprovalStatus.approved)
    if not db_action:
        raise HTTPException(status_code=404, detail="Onay kaydı bulunamadı.")

    payload = json.loads(db_action.payload) if db_action.payload else {}

    if request.email_subject:
        payload["email_subject"] = request.email_subject
    if request.email_body:
        payload["email_body"] = request.email_body
    if request.recipient:
        payload["recipient"] = request.recipient

    if db_action.type == "supply_email":
        recipient = payload.get("recipient") or SENDER_ADDRESS
        subject = payload.get("email_subject", "Tedarik Talebi")
        body = payload.get("email_body", "")
        product = payload.get("product_name", "Ürün")

        try:
            send_gmail(to=recipient, subject=subject, body=body)
            crud.create_notification(
                db,
                title=f"E-posta gönderildi: {product}",
                body=f"Alıcı: {recipient} | Konu: {subject}",
                type="email_sent",
            )
            logger.info("Gmail sent for product '%s' → %s", product, recipient)
        except Exception as exc:
            logger.error("Gmail send failed: %s", exc)
            crud.create_notification(
                db,
                title=f"E-posta gönderilemedi: {product}",
                body=str(exc),
                type="alert",
            )

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
    db_action = crud.update_approval_status(db, action_id, schemas.ApprovalStatus.rejected)
    if not db_action:
        raise HTTPException(status_code=404, detail="Onay kaydı bulunamadı.")

    payload = json.loads(db_action.payload) if db_action.payload else {}
    product = payload.get("product_name", "Ürün")

    crud.create_notification(
        db,
        title=f"Tedarik talebi reddedildi: {product}",
        body=None,
        type="rejection",
    )

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
