from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, field_validator

EstadoProceso = Literal["Pendiente", "En proceso", "Vigente", "Caducado"]


def _limpio(v):
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


class ProcesoEntrada(BaseModel):
    empresa_id: int | None = None  # obligatorio al crear; se ignora al editar
    arl_destino: str | None = None
    numero_afiliacion: str | None = None

    @field_validator("arl_destino", "numero_afiliacion", "empresa_id", mode="before")
    @classmethod
    def _vacios(cls, v):
        return _limpio(v)


class CambioEstado(BaseModel):
    estado: Literal["En proceso", "Vigente"]
    fecha_inicio: date | None = None
    periodo: Literal["Mensual", "Anual"] | None = None
    observacion: str | None = None

    @field_validator("fecha_inicio", "periodo", "observacion", mode="before")
    @classmethod
    def _vacios(cls, v):
        return _limpio(v)

    @field_validator("observacion")
    @classmethod
    def _largo(cls, v):
        if v is not None and len(v) > 1000:
            raise ValueError("La observación no puede superar 1000 caracteres")
        return v


class HistorialItem(BaseModel):
    id: int
    accion: str
    estado: str
    fecha_inicio: date | None
    periodo: str | None
    fecha_vencimiento: date | None
    observacion: str | None
    usuario: str | None
    fecha: datetime


class ProcesoListItem(BaseModel):
    id: int
    empresa_id: int
    empresa: str
    nit: str
    arl_destino: str | None
    estado: EstadoProceso
    fecha_inicio: date | None
    fecha_vencimiento: date | None
    fecha_actualizacion: datetime
    propietario: str | None = None


class ProcesoDetalle(BaseModel):
    id: int
    empresa_id: int
    empresa: str
    nit: str
    arl_destino: str | None
    numero_afiliacion: str | None
    estado: EstadoProceso
    periodo: str | None
    fecha_inicio: date | None
    fecha_vencimiento: date | None
    observacion: str | None
    fecha_creacion: datetime
    fecha_actualizacion: datetime
    propietario: str | None = None
    puede_editar_datos: bool = False   # root siempre; cliente solo en Pendiente
    puede_cambiar_estado: bool = False  # solo el administrador
    historial: list[HistorialItem] = []
