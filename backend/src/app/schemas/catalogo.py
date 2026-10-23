from pydantic import BaseModel


class DepartamentoOut(BaseModel):
    codigo: str
    nombre: str


class MunicipioOut(BaseModel):
    codigo: str
    nombre: str
    departamento_codigo: str
