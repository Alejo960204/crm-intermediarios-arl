import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# backend/.env (dos niveles arriba de src/app)
ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(ENV_PATH, encoding="utf-8-sig")


def _requerida(nombre: str) -> str:
    valor = os.environ.get(nombre, "").strip()
    if not valor:
        sys.exit(
            f"\nFalta la variable {nombre}.\n"
            f"Se buscó el archivo: {ENV_PATH}  (existe: {ENV_PATH.exists()})\n"
            "Debe llamarse exactamente '.env' (no '.env.txt' ni '.env.example') y contener DATABASE_URL y JWT_SECRET.\n"
        )
    return valor


class Settings:
    DATABASE_URL: str = _requerida("DATABASE_URL")
    JWT_SECRET: str = _requerida("JWT_SECRET")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
    UPLOADS_DIR: Path = Path(os.getenv("UPLOADS_DIR") or ENV_PATH.parent / "uploads")
    # Verificación por correo (Req. 8). Sin SMTP_HOST el código se imprime en la consola del backend.
    SMTP_HOST: str = os.getenv("SMTP_HOST", "").strip()
    SMTP_PORT: int = int(os.getenv("SMTP_PORT") or "587")
    SMTP_SECURITY: str = (os.getenv("SMTP_SECURITY") or "starttls").strip().lower()  # starttls | ssl | none
    SMTP_USER: str = os.getenv("SMTP_USER", "").strip()
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "").strip()
    # Interruptor del Req. 8: false = inicio de sesión solo con contraseña (útil mientras se hacen pruebas)
    VERIFICACION_CORREO: bool = os.getenv("VERIFICACION_CORREO", "false").strip().lower() in ("1", "true", "si", "sí", "yes")
    CODIGO_MINUTOS: int = int(os.getenv("CODIGO_MINUTOS") or "10")
    CODIGO_MAX_INTENTOS: int = int(os.getenv("CODIGO_MAX_INTENTOS") or "5")
    CODIGO_REENVIO_SEGUNDOS: int = int(os.getenv("CODIGO_REENVIO_SEGUNDOS") or "60")
    CORS_ORIGINS: list[str] = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")]


settings = Settings()
