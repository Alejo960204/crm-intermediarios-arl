from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..dependencies import requiere_root
from ..repositories import empresas_repository

router = APIRouter(prefix="/dashboard", tags=["Dashboard (solo root Admin)"], dependencies=[Depends(requiere_root)])


class Metricas(BaseModel):
    total: int
    en_curso: int
    vigente: int
    caducado: int
    sin_proceso: int
    por_vencer: int
    por_vencer_dias: int


@router.get("", response_model=Metricas)
def metricas():
    return {**empresas_repository.contar_dashboard(), "por_vencer_dias": empresas_repository.POR_VENCER_DIAS}
