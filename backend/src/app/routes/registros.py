from fastapi import APIRouter, Depends, Response, status

from ..dependencies import get_current_user, no_empleado
from ..schemas.registro import DecisionEntrada, RegistroDetalle, RegistroEntrada, RegistroListItem
from ..services import registros_service

router = APIRouter(prefix="/registros", tags=["Mis Registros"], dependencies=[Depends(no_empleado)])


@router.get("", response_model=list[RegistroListItem])
def mis_registros(usuario: dict = Depends(get_current_user)):
    return registros_service.listar_mis_registros(usuario)


@router.post("", response_model=RegistroDetalle, status_code=status.HTTP_201_CREATED)
def crear_registro(datos: RegistroEntrada, usuario: dict = Depends(get_current_user)):
    return registros_service.crear(usuario, datos)


@router.get("/{registro_id}", response_model=RegistroDetalle)
def ver_registro(registro_id: int, usuario: dict = Depends(get_current_user)):
    return registros_service.obtener_para_usuario(usuario, registro_id)


@router.put("/{registro_id}", response_model=RegistroDetalle)
def actualizar_registro(registro_id: int, datos: RegistroEntrada, usuario: dict = Depends(get_current_user)):
    return registros_service.actualizar(usuario, registro_id, datos)


@router.post("/{registro_id}/enviar-revision", response_model=RegistroDetalle)
def enviar_revision(registro_id: int, usuario: dict = Depends(get_current_user)):
    return registros_service.enviar_a_revision(usuario, registro_id)


@router.post("/{registro_id}/decision", response_model=RegistroDetalle)
def decidir(registro_id: int, datos: DecisionEntrada, usuario: dict = Depends(get_current_user)):
    return registros_service.decidir(usuario, registro_id, datos)


@router.delete("/{registro_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_registro(registro_id: int, usuario: dict = Depends(get_current_user)):
    registros_service.eliminar(usuario, registro_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
