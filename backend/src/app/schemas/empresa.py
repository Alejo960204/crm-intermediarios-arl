from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field, field_validator

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


class EmpresaNueva(EmpresaEntrada):
    """Alta de empresa: además de los datos generales, el usuario (login) de la empresa y su cupo de empleados."""

    login_email: EmailStr
    login_password: str = Field(default="", validate_default=True)
    max_empleados: int | None = None  # None = sin límite

    @field_validator("login_password")
    @classmethod
    def _clave(cls, v: str) -> str:
        if len(v or "") < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        return v

    @field_validator("max_empleados", mode="before")
    @classmethod
    def _max(cls, v):
        return _maximo(v)


def _maximo(v):
    v = _limpio(v)
    if v is None:
        return None
    if isinstance(v, str) and v.isdigit():
        v = int(v)
    if isinstance(v, bool) or not isinstance(v, int) or not 0 <= v <= 100000:
        raise ValueError("El cupo de empleados debe ser un número entero entre 0 y 100000 (vacío = sin límite)")
    return v


class LoginEmpresaEntrada(BaseModel):
    """Crea el usuario (login) de una empresa que aún no lo tiene."""

    email: EmailStr
    password: str = Field(default="", validate_default=True)

    @field_validator("password")
    @classmethod
    def _clave(cls, v: str) -> str:
        if len(v or "") < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        return v


class CupoEmpleadosEntrada(BaseModel):
    max_empleados: int | None = None

    @field_validator("max_empleados", mode="before")
    @classmethod
    def _max(cls, v):
        return _maximo(v)


class EmpleadoEntrada(BaseModel):
    nombre: str = Field(default="", validate_default=True)
    email: EmailStr
    password: str = Field(default="", validate_default=True)

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("El nombre es obligatorio")
        if len(v) > 150:
            raise ValueError("Máximo 150 caracteres")
        return v

    @field_validator("password")
    @classmethod
    def _clave(cls, v: str) -> str:
        if len(v or "") < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        return v


class EmpleadoOut(BaseModel):
    id: int
    nombre: str
    email: str
    activo: bool
    fecha_creacion: datetime


class EmpleadosOut(BaseModel):
    empleados: list[EmpleadoOut]
    activos: int
    maximo: int | None = None       # None = sin límite
    disponibles: int | None = None  # None = sin límite
    puede_crear: bool = False       # cupo disponible y el rol del usuario puede crear


class ActivaEntrada(BaseModel):
    activa: bool


class EmpresaListItem(BaseModel):
    id: int
    nombre: str
    nit: str
    inactiva: bool = False
    ciudad: str | None
    gerente: str | None
    trabajadores_directos: int | None
    fecha_creacion: datetime
    fecha_actualizacion: datetime
    propietario: str | None = None
    estado_proceso: str | None = None  # del proceso más reciente (None = sin proceso)
    fecha_vencimiento: date | None = None
    max_empleados: int | None = None
    empleados: int = 0
    tiene_login: bool = False


class EmpresaDetalle(EmpresaEntrada):
    id: int
    usuario_id: int
    inactiva: bool = False
    fecha_creacion: datetime
    fecha_actualizacion: datetime
    propietario: str | None = None
    max_empleados: int | None = None
    empleados: int = 0
    login_email: str | None = None
    login_activo: bool | None = None
