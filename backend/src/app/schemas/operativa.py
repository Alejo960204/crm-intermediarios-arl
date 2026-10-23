import re

from pydantic import BaseModel, field_validator

from .idoneidad import SoporteOut

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_TEL_RE = re.compile(r"^\d{7,10}$")


def _limpio(v):
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


class ItemEntrada(BaseModel):
    nombre: str
    descripcion: str | None = None

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
    """Todo opcional al guardar el borrador; línea 1, línea 2 y correo se exigen al enviar a revisión (Req. 7)."""

    linea_1: str | None = None
    linea_2: str | None = None
    linea_3: str | None = None
    fax: str | None = None
    correo: str | None = None
    direccion_atencion: str | None = None
    software: list[ItemEntrada] = []
    equipos: list[ItemEntrada] = []
    soportes_conservar: list[int] = []

    @field_validator("linea_1", "linea_2", "linea_3", "fax", mode="before")
    @classmethod
    def _telefonos(cls, v):
        v = _limpio(v)
        if v is not None and not _TEL_RE.match(v):
            raise ValueError("Debe tener entre 7 y 10 dígitos, solo números")
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


class OperativaOut(BaseModel):
    linea_1: str | None
    linea_2: str | None
    linea_3: str | None
    fax: str | None
    correo: str | None
    direccion_atencion: str | None
    software: list[ItemOut]
    equipos: list[ItemOut]
    soportes: list[SoporteOut]
