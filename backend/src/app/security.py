import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from .config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_access_token(usuario_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    return jwt.encode({"sub": str(usuario_id), "exp": exp}, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> int:
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    if payload.get("pur"):  # los tickets de un solo propósito (p. ej. consentimiento) no sirven como sesión
        raise jwt.InvalidTokenError("Token no válido para sesión")
    return int(payload["sub"])


def create_ticket(usuario_id: int, proposito: str, minutos: int = 10) -> str:
    """Ticket firmado y de corta vida para continuar un paso intermedio del login (no abre sesión)."""
    exp = datetime.now(timezone.utc) + timedelta(minutes=minutos)
    return jwt.encode({"sub": str(usuario_id), "pur": proposito, "exp": exp}, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_ticket(token: str, proposito: str) -> int:
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    if payload.get("pur") != proposito:
        raise jwt.InvalidTokenError("Ticket no válido")
    return int(payload["sub"])


def generar_codigo() -> str:
    """Código numérico de 6 dígitos generado con una fuente criptográficamente segura."""
    return f"{secrets.randbelow(1_000_000):06d}"


def huella_codigo(usuario_id: int, codigo: str) -> str:
    """HMAC del código (ligado al usuario) para no guardarlo en claro."""
    mensaje = f"{usuario_id}:{codigo}".encode()
    return hmac.new(settings.JWT_SECRET.encode(), mensaje, hashlib.sha256).hexdigest()
