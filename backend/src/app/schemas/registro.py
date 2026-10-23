import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, ValidationInfo, field_validator

Estado = Literal["Borrador", "En revisión", "Aprobado", "Rechazado"]

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_TEL_RE = re.compile(r"^\d{7,10}$")


def _limpio(valor: str | None) -> str | None:
    if valor is None:
        return None
    valor = valor.strip()
    return valor or None


class RegistroEntrada(BaseModel):
    """Datos de la Pestaña 1 (Información General). Solo RUI y NIT son obligatorios para guardar el borrador."""

    rui: str
    nit: str
    razon_social: str | None = None
    departamento_codigo: str | None = None
    municipio_codigo: str | None = None
    direccion: str | None = None
    correo: str | None = None
    telefono_fijo: str | None = None

    @field_validator("rui")
    @classmethod
    def _rui(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El RUI es obligatorio")
        return v

    @field_validator("nit")
    @classmethod
    def _nit(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El NIT es obligatorio")
        if not v.isdigit():
            raise ValueError("El NIT debe contener solo números, sin puntos, guiones ni dígito de verificación")
        return v

    @field_validator("razon_social", "departamento_codigo", "municipio_codigo", "direccion", mode="before")
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

    @field_validator("telefono_fijo", mode="before")
    @classmethod
    def _telefono(cls, v):
        v = _limpio(v)
        if v is not None and not _TEL_RE.match(v):
            raise ValueError("El teléfono fijo debe tener entre 7 y 10 dígitos, solo números")
        return v


class RegistroListItem(BaseModel):
    id: int
    rui: str
    nit: str
    razon_social: str | None
    ciudad: str | None
    estado: Estado
    fecha_creacion: datetime
    fecha_actualizacion: datetime
    propietario: str | None = None  # visible solo para root Admin en la interfaz
    decision_comentario: str | None = None


class RegistroDetalle(BaseModel):
    id: int
    rui: str
    nit: str
    razon_social: str | None
    departamento_codigo: str | None
    municipio_codigo: str | None
    direccion: str | None
    correo: str | None
    telefono_fijo: str | None
    estado: Estado
    fecha_creacion: datetime
    fecha_actualizacion: datetime
    propietario: str | None = None
    editable: bool = True
    decision_comentario: str | None = None
    decision_fecha: datetime | None = None
    decision_por: str | None = None
    puede_decidir: bool = False  # solo root Admin y con el registro 'En revisión'


class DecisionEntrada(BaseModel):
    decision: Literal["Aprobado", "Rechazado"]
    comentario: str | None = Field(default=None, validate_default=True)

    @field_validator("comentario", mode="before")
    @classmethod
    def _comentario(cls, v, info: ValidationInfo):
        v = _limpio(v)
        if v is None and info.data.get("decision") == "Rechazado":
            raise ValueError("Para rechazar debe explicar el motivo en el comentario")
        if v is not None and len(v) > 1000:
            raise ValueError("El comentario no puede superar 1000 caracteres")
        return v
