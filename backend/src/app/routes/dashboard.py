from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..dependencies import requiere_root
from ..repositories import empresas_repository, paquetes_repository, usuarios_repository

router = APIRouter(prefix="/dashboard", tags=["Dashboard (solo administrador)"], dependencies=[Depends(requiere_root)])


class Metricas(BaseModel):
    total: int
    en_curso: int
    vigente: int
    caducado: int
    sin_proceso: int
    por_vencer: int
    por_vencer_dias: int
    intermediarios: int  # intermediarios activos
    solicitudes_ampliacion: int  # solicitudes de ampliación de paquete pendientes


@router.get("", response_model=Metricas)
def metricas():
    return {**empresas_repository.contar_dashboard(), "intermediarios": usuarios_repository.contar_intermediarios_activos(),
            "solicitudes_ampliacion": paquetes_repository.contar_solicitudes_pendientes(), "por_vencer_dias": empresas_repository.POR_VENCER_DIAS}
