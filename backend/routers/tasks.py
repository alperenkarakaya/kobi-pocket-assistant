from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import crud, schemas

router = APIRouter(tags=["Tasks"])


@router.get("/tasks", response_model=list[schemas.TaskOut])
def list_tasks(db: Session = Depends(get_db)):
    return crud.get_tasks(db)


@router.post("/tasks", response_model=schemas.TaskOut, status_code=201)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    return crud.create_task(db, task)


@router.patch("/tasks/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: int, update: schemas.TaskStatusUpdate, db: Session = Depends(get_db)):
    task = crud.update_task_status(db, task_id, update.status)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    if not crud.delete_task(db, task_id):
        raise HTTPException(status_code=404, detail="Task not found")
