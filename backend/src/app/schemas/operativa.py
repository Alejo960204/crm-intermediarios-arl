import re

from pydantic import BaseModel, Field, field_validator

from .idoneidad import SoporteOut

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_TEL_RE = re.compile(r"^\d{7,10}$")
_WHATSAPP_RE = re.compile(r"^3\d{9}$")
_URL_RE = re.compile(r"^https?://[^\s/$.?#][^\s]*\.[^\s]{2,}$", re.IGNORECASE)



def _limpio(v):
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


class ItemEntrada(BaseModel):
    nombre: str
    descripcion: str | None = None
    serie: str | None = None       # solo equipos (Req 18)
    ubicacion: str | None = None   # solo equipos (Req 18)

    @field_validator("serie", "ubicacion", mode="before")
    @classmethod
    def _opcionales(cls, v):
        return _limpio(v)

    @field_validator("serie")
    @classmethod
    def _serie(cls, v):
        if v is not None and len(v) > 100:
            raise ValueError("La serie no puede superar 100 caracteres")
        return v

    @field_validator("ubicacion")
    @classmethod
    def _ubicacion(cls, v):
        if v is not None and len(v) > 150:
            raise ValueError("La ubicación no puede superar 150 caracteres")
        return v

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El nombre es obligatorio")
        return v

    @field_validator("descripcion", mode="before")
    @classmethod
    def _descripcion(cls, v):
        return _limpio(v)


class OperativaEntrada(BaseModel):
    """Línea 1, línea 2 y correo se exigen al enviar a revisión (Req. 7); WhatsApp y enlace web, al guardar (Req. 17)."""

    linea_1: str | None = None
    linea_2: str | None = None
    whatsapp: str | None = Field(default=None, validate_default=True)
    enlace_web: str | None = Field(default=None, validate_default=True)
    correo: str | None = None
    direccion_atencion: str | None = None
    software: list[ItemEntrada] = []
    equipos: list[ItemEntrada] = []
    soportes_conservar: list[int] = []

    @field_validator("linea_1", "linea_2", mode="before")
    @classmethod
    def _telefonos(cls, v):
        v = _limpio(v)
        if v is not None and not _TEL_RE.match(v):
            raise ValueError("Debe tener entre 7 y 10 dígitos, solo números")
        return v

    @field_validator("whatsapp", mode="before")
    @classmethod
    def _whatsapp(cls, v):
        v = _limpio(v)
        if v is None:
            raise ValueError("La línea de atención vía WhatsApp es obligatoria")
        if not _WHATSAPP_RE.match(v):
            raise ValueError("Debe ser un celular de 10 dígitos que empiece por 3 (ejemplo: 3001234567)")
        return v

    @field_validator("enlace_web", mode="before")
    @classmethod
    def _enlace(cls, v):
        v = _limpio(v)
        if v is None:
            raise ValueError("El enlace web es obligatorio")
        if len(v) > 300 or not _URL_RE.match(v):
            raise ValueError("Ingrese un enlace válido que empiece por http:// o https:// (ejemplo: https://www.miempresa.com)")
        return v

    @field_validator("correo", mode="before")
    @classmethod
    def _correo(cls, v):
        v = _limpio(v)
        if v is not None and not _EMAIL_RE.match(v):
            raise ValueError("Ingrese un correo válido (ejemplo: nombre@dominio.com)")
        return v

    @field_validator("direccion_atencion", mode="before")
    @classmethod
    def _direccion(cls, v):
        return _limpio(v)


class ItemOut(BaseModel):
    nombre: str
    descripcion: str | None
    serie: str | None = None
    ubicacion: str | None = None


class OperativaOut(BaseModel):
    linea_1: str | None
    linea_2: str | None
    whatsapp: str | None
    enlace_web: str | None
    correo: str | None
    direccion_atencion: str | None
    software: list[ItemOut]
    equipos: list[ItemOut]
    soportes: list[SoporteOut]
