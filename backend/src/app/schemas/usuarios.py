from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class UsuarioListado(BaseModel):
    id: int
    nombre: str
    email: str
    rol: str
    activo: bool
    fecha_creacion: datetime
    empresas: int = 0            # empresas activas de las que es propietario
    registros: int = 0           # registros (formulario único) activos
    empresa_nombre: str | None = None  # empresa a la que pertenece (roles empresa y empleado)
    paquete: "PaqueteOut | None" = None  # solo intermediarios; None = sin paquete (sin límite)


class FilaResultado(BaseModel):
    fila: int  # número de fila en el Excel
    correo: str
    estado: str  # creado | omitido | error
    detalle: str


class ResultadoCarga(BaseModel):
    total: int
    creados: int
    omitidos: int
    con_error: int
    filas: list[FilaResultado]


class CambioRol(BaseModel):
    rol: str


Periodicidad = Literal["mensual", "trimestral", "semestral", "anual"]


class PaqueteEntrada(BaseModel):
    nombre: str = Field(default="", validate_default=True)
    cantidad_empresas: int = Field(default=0, validate_default=True)
    periodicidad: Periodicidad
    fecha_inicio: date | None = None  # por defecto, hoy

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Escriba el nombre del paquete")
        if len(v) > 100:
            raise ValueError("Máximo 100 caracteres")
        return v

    @field_validator("cantidad_empresas")
    @classmethod
    def _cantidad(cls, v: int) -> int:
        if not 1 <= v <= 100000:
            raise ValueError("La cantidad de empresas debe ser un número entre 1 y 100000")
        return v


class NuevoIntermediario(BaseModel):
    nombre: str = Field(default="", validate_default=True)
    email: EmailStr
    password: str = Field(default="", validate_default=True)
    paquete: PaqueteEntrada

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("El nombre es obligatorio")
        return v

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        if len(v or "") < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        return v


class PaqueteOut(BaseModel):
    id: int
    nombre: str
    cantidad_empresas: int
    periodicidad: str | None = None
    fecha_inicio: date
    fecha_vencimiento: date | None = None
    usadas: int
    disponibles: int
    vencido: bool
    alerta: str | None = None  # poco | agotado | vencido
    puede_crear: bool
    solicitud_pendiente: bool = False


class PaqueteHistorial(BaseModel):
    id: int
    nombre: str
    cantidad_empresas: int
    periodicidad: str | None = None
    fecha_inicio: date
    fecha_vencimiento: date | None = None
    usadas: int
    asignado_por: str | None = None
    fecha_creacion: datetime


class CambioActivo(BaseModel):
    activo: bool
