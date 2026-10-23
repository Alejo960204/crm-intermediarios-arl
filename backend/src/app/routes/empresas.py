from fastapi import APIRouter, Depends, Response, status

from ..dependencies import get_current_user
from ..schemas.empresa import EmpresaDetalle, EmpresaEntrada, EmpresaListItem
from ..services import empresas_service

router = APIRouter(prefix="/empresas", tags=["Empresas"])


@router.get("", response_model=list[EmpresaListItem])
def listar(estado: str | None = None, usuario: dict = Depends(get_current_user)):
    """estado (opcional): en_curso | vigente | caducado | sin_proceso | por_vencer (según el proceso más reciente)."""
    return empresas_service.listar(usuario, estado)


@router.post("", response_model=EmpresaDetalle, status_code=status.HTTP_201_CREATED)
def crear(datos: EmpresaEntrada, usuario: dict = Depends(get_current_user)):
    return empresas_service.crear(usuario, datos)


@router.get("/{empresa_id}", response_model=EmpresaDetalle)
def ver(empresa_id: int, usuario: dict = Depends(get_current_user)):
    return empresas_service.obtener_para_usuario(usuario, empresa_id)


@router.put("/{empresa_id}", response_model=EmpresaDetalle)
def actualizar(empresa_id: int, datos: EmpresaEntrada, usuario: dict = Depends(get_current_user)):
    return empresas_service.actualizar(usuario, empresa_id, datos)


@router.delete("/{empresa_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(empresa_id: int, usuario: dict = Depends(get_current_user)):
    empresas_service.eliminar(usuario, empresa_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
