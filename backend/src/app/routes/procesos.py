from fastapi import APIRouter, Depends, status

from ..dependencies import get_current_user
from ..schemas.proceso import AsignacionEntrada, CambioEstado, ProcesoDetalle, ProcesoEntrada, ProcesoListItem
from ..services import procesos_service

router = APIRouter(prefix="/procesos", tags=["Procesos de afiliación"])


@router.get("", response_model=list[ProcesoListItem])
def listar(empresa_id: int | None = None, usuario: dict = Depends(get_current_user)):
    return procesos_service.listar(usuario, empresa_id)


@router.post("", response_model=ProcesoDetalle, status_code=status.HTTP_201_CREATED)
def crear(datos: ProcesoEntrada, usuario: dict = Depends(get_current_user)):
    return procesos_service.crear(usuario, datos)


@router.get("/{proceso_id}", response_model=ProcesoDetalle)
def ver(proceso_id: int, usuario: dict = Depends(get_current_user)):
    return procesos_service.obtener_para_usuario(usuario, proceso_id)


@router.put("/{proceso_id}", response_model=ProcesoDetalle)
def actualizar(proceso_id: int, datos: ProcesoEntrada, usuario: dict = Depends(get_current_user)):
    return procesos_service.actualizar(usuario, proceso_id, datos)


@router.post("/{proceso_id}/estado", response_model=ProcesoDetalle)
def cambiar_estado(proceso_id: int, datos: CambioEstado, usuario: dict = Depends(get_current_user)):
    return procesos_service.cambiar_estado(usuario, proceso_id, datos)


@router.put("/{proceso_id}/asignacion", response_model=ProcesoDetalle)
def asignar(proceso_id: int, datos: AsignacionEntrada, usuario: dict = Depends(get_current_user)):
    return procesos_service.asignar(usuario, proceso_id, datos)
