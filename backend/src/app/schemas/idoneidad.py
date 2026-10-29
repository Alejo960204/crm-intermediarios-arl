import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

TipoDocumento = Literal["CC", "CE", "Pasaporte", "PEP"]

NIVELES_EDUCATIVOS = ["Bachiller", "Técnico", "Tecnólogo", "Profesional", "Especialización", "Maestría", "Doctorado"]

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_TEL_RE = re.compile(r"^\d{7,10}$")


def _limpio(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    return v or None


class PersonaEntrada(BaseModel):
    """Una fila de la tabla dinámica. 'clave' identifica la fila en pantalla para asociar sus archivos nuevos."""

    id: int | None = None
    clave: str
    nombres_apellidos: str
    tipo_documento: TipoDocumento
    numero_documento: str
    cargo: str | None = None
    nivel_educativo: str = Field(default="", validate_default=True)
    descripcion_nivel_educativo: str | None = None
    correo: str | None = None
    telefono: str | None = None
    soportes_conservar: list[int] = []

    @field_validator("nombres_apellidos")
    @classmethod
    def _nombres(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Los nombres y apellidos son obligatorios")
        return v

    @field_validator("numero_documento")
    @classmethod
    def _documento(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El número de documento es obligatorio")
        return v

    @field_validator("cargo", mode="before")
    @classmethod
    def _cargo(cls, v):
        return _limpio(v)

    @field_validator("nivel_educativo", mode="before")
    @classmethod
    def _nivel(cls, v):
        v = (v or "").strip() if isinstance(v, str) or v is None else v
        if v not in NIVELES_EDUCATIVOS:
            raise ValueError("Seleccione el nivel educativo")
        return v

    @field_validator("descripcion_nivel_educativo", mode="before")
    @classmethod
    def _descripcion_nivel(cls, v):
        v = _limpio(v)
        if v is not None and len(v) > 200:
            raise ValueError("La descripción del nivel educativo no puede superar 200 caracteres")
        return v

    @field_validator("correo", mode="before")
    @classmethod
    def _correo(cls, v):
        v = _limpio(v)
        if v is not None and not _EMAIL_RE.match(v):
            raise ValueError("Ingrese un correo válido (ejemplo: nombre@dominio.com)")
        return v

    @field_validator("telefono", mode="before")
    @classmethod
    def _telefono(cls, v):
        v = _limpio(v)
        if v is not None and not _TEL_RE.match(v):
            raise ValueError("El teléfono debe tener entre 7 y 10 dígitos, solo números")
        return v


class SoporteOut(BaseModel):
    id: int
    nombre_original: str
    tamano_bytes: int


class PersonaOut(BaseModel):
    id: int
    nombres_apellidos: str
    tipo_documento: str
    numero_documento: str
    cargo: str | None
    nivel_educativo: str | None = None
    descripcion_nivel_educativo: str | None = None
    correo: str | None
    telefono: str | None
    soportes: list[SoporteOut]
