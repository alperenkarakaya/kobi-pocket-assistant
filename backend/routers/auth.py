from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel

from services.auth_service import authenticate, create_access_token, verify_token

router = APIRouter(prefix="/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(data: LoginRequest):
    if not authenticate(data.username, data.password):
        raise HTTPException(status_code=401, detail="Hatalı kullanıcı adı veya şifre.")
    token = create_access_token(data.username)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
async def me(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Oturum bulunamadı.")
    username = verify_token(authorization[7:])
    return {"username": username}
