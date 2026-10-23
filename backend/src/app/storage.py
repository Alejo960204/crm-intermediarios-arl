"""Almacenamiento de archivos en disco local. Aislado aquí para migrar luego a almacenamiento en la nube."""
import uuid
from pathlib import Path

from .config import settings


def guardar_pdf(registro_id: int, contenido: bytes, carpeta: str = "idoneidad", extension: str = "pdf") -> str:
    """Guarda el archivo (PDF por defecto) y devuelve su ruta relativa a UPLOADS_DIR."""
    relativa = Path(carpeta) / str(registro_id) / f"{uuid.uuid4().hex}.{extension}"
    destino = settings.UPLOADS_DIR / relativa
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(contenido)
    return relativa.as_posix()


def ruta_absoluta(relativa: str) -> Path:
    base = settings.UPLOADS_DIR.resolve()
    ruta = (base / relativa).resolve()
    if base not in ruta.parents:
        raise ValueError("Ruta de archivo no válida")
    return ruta


def eliminar(relativa: str) -> None:
    try:
        ruta_absoluta(relativa).unlink(missing_ok=True)
    except (ValueError, OSError):
        pass  # un archivo huérfano no debe romper la operación
