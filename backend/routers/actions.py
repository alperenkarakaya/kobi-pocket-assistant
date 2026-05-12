import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import crud, models, schemas
from services.email_service import send_gmail, SENDER_ADDRESS
from services import ai_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Action Approvals"])


# ── Approve ────────────────────────────────────────────────────────────────

@router.post("/actions/{action_id}/approve", response_model=schemas.ActionApprovalOut)
async def approve_action(
    action_id: int,
    request: schemas.ApproveActionRequest,
    db: Session = Depends(get_db),
):
    db_action = db.query(models.ActionApproval).filter(
        models.ActionApproval.id == action_id
    ).first()
    if not db_action:
        raise HTTPException(status_code=404, detail="Onay kaydı bulunamadı.")
    if db_action.status != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"Bu kayıt zaten '{db_action.status}' durumunda.",
        )

    payload = json.loads(db_action.payload) if db_action.payload else {}

    if request.email_subject:
        payload["email_subject"] = request.email_subject
    if request.email_body:
        payload["email_body"] = request.email_body
    if request.recipient:
        payload["recipient"] = request.recipient

    # Send email FIRST — only flip status to "approved" if it actually sent.
    if db_action.type == "supply_email":
        recipient = payload.get("recipient") or SENDER_ADDRESS
        subject = payload.get("email_subject", "Tedarik Talebi")
        body = payload.get("email_body", "")
        product = payload.get("product_name", "Ürün")

        try:
            send_gmail(to=recipient, subject=subject, body=body)
        except Exception as exc:
            logger.error("Gmail send failed: %s", exc)
            crud.create_notification(
                db,
                title=f"E-posta gönderilemedi: {product}",
                body=str(exc),
                type="alert",
            )
            raise HTTPException(
                status_code=502,
                detail=f"E-posta gönderilemedi: {exc}",
            )

        crud.create_notification(
            db,
            title=f"E-posta gönderildi: {product}",
            body=f"Alıcı: {recipient} | Konu: {subject}",
            type="email_sent",
        )
        logger.info("Gmail sent for product '%s' → %s", product, recipient)

    # Persist edited overrides + status atomically.
    db_action.payload = json.dumps(payload)
    db_action.status = schemas.ApprovalStatus.approved.value
    db.commit()
    db.refresh(db_action)

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
    db_action = db.query(models.ActionApproval).filter(
        models.ActionApproval.id == action_id
    ).first()
    if not db_action:
        raise HTTPException(status_code=404, detail="Onay kaydı bulunamadı.")
    if db_action.status != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"Bu kayıt zaten '{db_action.status}' durumunda.",
        )

    payload = json.loads(db_action.payload) if db_action.payload else {}
    product = payload.get("product_name", "Ürün")

    if request.notes:
        payload["rejection_notes"] = request.notes

    db_action.payload = json.dumps(payload)
    db_action.status = schemas.ApprovalStatus.rejected.value
    db.commit()
    db.refresh(db_action)

    crud.create_notification(
        db,
        title=f"Tedarik talebi reddedildi: {product}",
        body=request.notes,
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


# ── Regenerate email tone ──────────────────────────────────────────────────

@router.post("/actions/{action_id}/regenerate")
async def regenerate_action_email(
    action_id: int,
    request: schemas.RegenerateEmailRequest,
    db: Session = Depends(get_db),
):
    db_action = crud.get_pending_approvals(db)
    target = next((a for a in db_action if a.id == action_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Onay kaydı bulunamadı veya zaten işlendi.")

    payload = json.loads(target.payload) if target.payload else {}
    product_name = payload.get("product_name", "Ürün")
    unit = payload.get("unit", "adet")
    current_stock = float(payload.get("current_stock", 0))
    threshold = float(payload.get("threshold", 0))
    existing_subject = payload.get("email_subject", payload.get("subject", "Tedarik Talebi"))
    existing_body = payload.get("email_body", payload.get("body", ""))

    try:
        result = ai_service.regenerate_email_tone(
            product_name=product_name,
            unit=unit,
            current_stock=current_stock,
            threshold=threshold,
            existing_subject=existing_subject,
            existing_body=existing_body,
            tone=request.tone,
        )
        return {"subject": result["subject"], "body": result["body"]}
    except ai_service.AIParsingError as exc:
        raise HTTPException(status_code=500, detail=str(exc))


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
