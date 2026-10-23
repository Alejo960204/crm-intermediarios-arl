from datetime import datetime

from pydantic import BaseModel


class UsuarioListado(BaseModel):
    id: int
    nombre: str
    email: str
    rol: str
    activo: bool
    fecha_creacion: datetime
    empresas: int = 0            # empresas activas de las que es propietario
    registros: int = 0           # registros (formulario único) activos
    procesos_asignados: int = 0  # procesos en los que figura como empleado responsable


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


class CambioActivo(BaseModel):
    activo: bool
