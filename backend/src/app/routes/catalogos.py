from fastapi import APIRouter, Depends

from ..dependencies import get_current_user
from ..repositories import catalogos_repository
from ..schemas.catalogo import DepartamentoOut, MunicipioOut

router = APIRouter(prefix="/catalogos", tags=["Catálogos DANE"], dependencies=[Depends(get_current_user)])


@router.get("/departamentos", response_model=list[DepartamentoOut])
def departamentos():
    return catalogos_repository.listar_departamentos()


@router.get("/municipios", response_model=list[MunicipioOut])
def municipios(departamento_codigo: str):
    return catalogos_repository.listar_municipios(departamento_codigo)
