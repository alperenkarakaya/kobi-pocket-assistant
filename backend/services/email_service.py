"""
Gmail email sender using OAuth2 refresh-token flow.
No interactive auth required — credentials stored in .env.
"""

import base64
import logging
import os
from email.mime.text import MIMEText

import httpx

logger = logging.getLogger(__name__)

_CLIENT_ID = os.getenv("GMAIL_CLIENT_ID", "")
_CLIENT_SECRET = os.getenv("GMAIL_CLIENT_SECRET", "")
_REFRESH_TOKEN = os.getenv("GMAIL_REFRESH_TOKEN", "")
SENDER_ADDRESS = os.getenv("GMAIL_SENDER_ADDRESS", "")

_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"


def _get_access_token() -> str:
    resp = httpx.post(
        _TOKEN_URL,
        data={
            "grant_type": "refresh_token",
            "refresh_token": _REFRESH_TOKEN,
            "client_id": _CLIENT_ID,
            "client_secret": _CLIENT_SECRET,
        },
        timeout=15.0,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def send_gmail(to: str, subject: str, body: str) -> None:
    """Send an email via Gmail API. Raises on failure."""
    if not all([_CLIENT_ID, _CLIENT_SECRET, _REFRESH_TOKEN, SENDER_ADDRESS]):
        raise ValueError(
            "Gmail kimlik bilgileri eksik. GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, "
            "GMAIL_REFRESH_TOKEN ve GMAIL_SENDER_ADDRESS değerlerini .env'e ekleyin."
        )

    access_token = _get_access_token()

    msg = MIMEText(body, "plain", "utf-8")
    msg["To"] = to
    msg["From"] = f"KOBI Tarım Asistanı <{SENDER_ADDRESS}>"
    msg["Subject"] = subject

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()

    resp = httpx.post(
        _GMAIL_SEND_URL,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json={"raw": raw},
        timeout=30.0,
    )
    resp.raise_for_status()
    logger.info("Gmail gönderildi → %s | Konu: %s", to, subject)
