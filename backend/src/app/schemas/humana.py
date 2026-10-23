import re
from datetime import date

from pydantic import BaseModel, Field, ValidationInfo, field_validator

from .idoneidad import SoporteOut, TipoDocumento

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_TEL_RE = re.compile(r"^\d{7,10}$")


def _limpio(v):
    if v is None:
        return None
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


class ResponsableEntrada(BaseModel):
    """Datos del responsable. Todos opcionales al guardar el borrador; se exigen al enviar a revisión (Req. 7)."""

    nombres_apellidos: str | None = None
    tipo_documento: TipoDocumento | None = None
    numero_documento: str | None = None
    cargo: str | None = None
    correo: str | None = None
    telefono: str | None = None

    @field_validator("nombres_apellidos", "tipo_documento", "numero_documento", "cargo", mode="before")
    @classmethod
    def _opcionales(cls, v):
        return _limpio(v)

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


class ExperienciaEntrada(BaseModel):
    id: int | None = None
    clave: str
    empresa: str
    cargo: str
    fecha_inicio: date | None = None
    cargo_actual: bool = False
    fecha_fin: date | None = Field(default=None, validate_default=True)
    funciones: str | None = None
    soportes_conservar: list[int] = []

    @field_validator("empresa")
    @classmethod
    def _empresa(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("La empresa es obligatoria")
        return v

    @field_validator("cargo")
    @classmethod
    def _cargo(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El cargo desempeñado es obligatorio")
        return v

    @field_validator("fecha_inicio", "fecha_fin", "funciones", mode="before")
    @classmethod
    def _vacios(cls, v):
        return _limpio(v)

    @field_validator("fecha_inicio")
    @classmethod
    def _inicio(cls, v: date | None) -> date:
        if v is None:
            raise ValueError("La fecha de inicio es obligatoria")
        return v

    @field_validator("fecha_fin")
    @classmethod
    def _fin(cls, v: date | None, info: ValidationInfo) -> date | None:
        if info.data.get("cargo_actual"):
            return None  # cargo vigente: no hay fecha de fin
        if v is None:
            raise ValueError("Indique la fecha de fin o marque 'Cargo actual'")
        inicio = info.data.get("fecha_inicio")
        if inicio is not None and v < inicio:
            raise ValueError("La fecha de fin no puede ser anterior a la de inicio")
        return v


class HumanaEntrada(BaseModel):
    responsable: ResponsableEntrada
    experiencias: list[ExperienciaEntrada] = []


class ResponsableOut(BaseModel):
    nombres_apellidos: str | None = None
    tipo_documento: str | None = None
    numero_documento: str | None = None
    cargo: str | None = None
    correo: str | None = None
    telefono: str | None = None


class ExperienciaOut(BaseModel):
    id: int
    empresa: str
    cargo: str
    fecha_inicio: date | None
    fecha_fin: date | None
    cargo_actual: bool
    funciones: str | None
    soportes: list[SoporteOut]


class HumanaOut(BaseModel):
    responsable: ResponsableOut
    experiencias: list[ExperienciaOut]
