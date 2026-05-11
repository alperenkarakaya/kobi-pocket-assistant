from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
import crud, schemas

router = APIRouter(tags=["Notifications"])


@router.get("/notifications", response_model=list[schemas.NotificationOut])
def get_notifications(db: Session = Depends(get_db)):
    return crud.get_notifications(db)


@router.get("/notifications/unread-count")
def unread_count(db: Session = Depends(get_db)):
    return {"count": crud.get_unread_count(db)}


@router.patch("/notifications/read-all")
def mark_all_read(db: Session = Depends(get_db)):
    count = crud.mark_all_notifications_read(db)
    return {"marked_read": count}
