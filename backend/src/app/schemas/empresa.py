from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator

_TEXTOS = ("direccion", "departamento_codigo", "municipio_codigo", "contacto_nombre", "contacto_cargo",
           "responsable_sgsst_nombre", "responsable_sgsst_cargo", "gerente", "actividad_economica",
           "arl_actual", "tiempo_afiliacion_arl")


def _limpio(v):
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


class EmpresaEntrada(BaseModel):
    """Datos generales de la empresa. Solo nombre y NIT son obligatorios."""

    usuario_id: int | None = None  # solo lo usa root Admin (cliente propietario); el cliente siempre es su propio dueño
    nombre: str
    nit: str
    direccion: str | None = None
    telefono_fijo: str | None = None
    celular: str | None = None
    departamento_codigo: str | None = None
    municipio_codigo: str | None = None
    contacto_nombre: str | None = None
    contacto_cargo: str | None = None
    responsable_sgsst_nombre: str | None = None
    responsable_sgsst_cargo: str | None = None
    gerente: str | None = None
    actividad_economica: str | None = None
    trabajadores_directos: int | None = None
    contratistas_independientes: int | None = None
    estudiantes_decreto_055: int | None = None
    tasa_cotizacion: Decimal | None = None
    arl_actual: str | None = None
    tiempo_afiliacion_arl: str | None = None
    valor_cotizacion_arl: Decimal | None = None

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El nombre de la empresa es obligatorio")
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

    @field_validator(*_TEXTOS, "telefono_fijo", "celular", "usuario_id", "trabajadores_directos",
                     "contratistas_independientes", "estudiantes_decreto_055", "tasa_cotizacion",
                     "valor_cotizacion_arl", mode="before")
    @classmethod
    def _vacios(cls, v):
        return _limpio(v)

    @field_validator("telefono_fijo")
    @classmethod
    def _fijo(cls, v):
        if v is not None and not (v.isdigit() and 7 <= len(v) <= 10):
            raise ValueError("El teléfono fijo debe tener entre 7 y 10 dígitos, solo números")
        return v

    @field_validator("celular")
    @classmethod
    def _celular(cls, v):
        if v is not None and not (v.isdigit() and len(v) == 10):
            raise ValueError("El celular debe tener 10 dígitos, solo números")
        return v

    @field_validator("trabajadores_directos", "contratistas_independientes", "estudiantes_decreto_055",
                     "valor_cotizacion_arl", "tasa_cotizacion")
    @classmethod
    def _no_negativos(cls, v):
        if v is not None and v < 0:
            raise ValueError("No puede ser negativo")
        return v

    @field_validator("tasa_cotizacion")
    @classmethod
    def _tasa(cls, v):
        if v is not None and v >= 100:
            raise ValueError("Tasa no válida")
        return v


class EmpresaListItem(BaseModel):
    id: int
    nombre: str
    nit: str
    ciudad: str | None
    gerente: str | None
    trabajadores_directos: int | None
    fecha_creacion: datetime
    fecha_actualizacion: datetime
    propietario: str | None = None
    estado_proceso: str | None = None  # del proceso más reciente (None = sin proceso)
    fecha_vencimiento: date | None = None


class EmpresaDetalle(EmpresaEntrada):
    id: int
    usuario_id: int
    fecha_creacion: datetime
    fecha_actualizacion: datetime
    propietario: str | None = None
