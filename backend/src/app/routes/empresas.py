from fastapi import APIRouter, Depends, status

from ..dependencies import get_current_user, get_current_user_sin_bloqueo
from ..schemas.empresa import (ActivaEntrada, CupoEmpleadosEntrada, EmpleadoEntrada, EmpleadosOut, EmpresaDetalle,
                               EmpresaEntrada, EmpresaListItem, EmpresaNueva, LoginEmpresaEntrada)
from ..services import empresas_service, paquetes_service

router = APIRouter(prefix="/empresas", tags=["Empresas"])


@router.get("", response_model=list[EmpresaListItem])
def listar(estado: str | None = None, usuario: dict = Depends(get_current_user)):
    """estado (opcional): en_curso | vigente | caducado | sin_proceso | por_vencer (según el proceso más reciente)."""
    return empresas_service.listar(usuario, estado)


@router.post("", response_model=EmpresaDetalle, status_code=status.HTTP_201_CREATED)
def crear(datos: EmpresaNueva, usuario: dict = Depends(get_current_user)):
    return empresas_service.crear(usuario, datos)


@router.get("/cupo")
def cupo(usuario: dict = Depends(get_current_user)):
    """Empresas activas del usuario y su límite (maximo = null: sin límite)."""
    return empresas_service.cupo(usuario)


@router.post("/cupo/solicitud")
def solicitar_ampliacion(usuario: dict = Depends(get_current_user_sin_bloqueo)):
    """El intermediario pide ampliar o renovar su paquete (funciona aunque el paquete esté vencido)."""
    return paquetes_service.solicitar_ampliacion(usuario)


@router.get("/{empresa_id}", response_model=EmpresaDetalle)
def ver(empresa_id: int, usuario: dict = Depends(get_current_user)):
    return empresas_service.obtener_para_usuario(usuario, empresa_id)


@router.put("/{empresa_id}", response_model=EmpresaDetalle)
def actualizar(empresa_id: int, datos: EmpresaEntrada, usuario: dict = Depends(get_current_user)):
    return empresas_service.actualizar(usuario, empresa_id, datos)


@router.patch("/{empresa_id}/activa", response_model=EmpresaDetalle)
def cambiar_activa(empresa_id: int, datos: ActivaEntrada, usuario: dict = Depends(get_current_user)):
    """Inactivar o reactivar una empresa (no se elimina: conserva registros e historial y no libera cupo)."""
    return empresas_service.cambiar_activa(usuario, empresa_id, datos.activa)


@router.post("/{empresa_id}/login", response_model=EmpresaDetalle, status_code=status.HTTP_201_CREATED)
def crear_login(empresa_id: int, datos: LoginEmpresaEntrada, usuario: dict = Depends(get_current_user)):
    """Crea el usuario de acceso de una empresa que no lo tiene (intermediario dueño o administrador)."""
    return empresas_service.crear_login(usuario, empresa_id, datos)


@router.patch("/{empresa_id}/cupo-empleados", response_model=EmpresaDetalle)
def cupo_empleados(empresa_id: int, datos: CupoEmpleadosEntrada, usuario: dict = Depends(get_current_user)):
    """Cambia el cupo de empleados de la empresa (null = sin límite)."""
    return empresas_service.cambiar_cupo_empleados(usuario, empresa_id, datos)


@router.get("/{empresa_id}/empleados", response_model=EmpleadosOut)
def listar_empleados(empresa_id: int, usuario: dict = Depends(get_current_user)):
    return empresas_service.empleados(usuario, empresa_id)


@router.post("/{empresa_id}/empleados", response_model=EmpleadosOut, status_code=status.HTTP_201_CREATED)
def crear_empleado(empresa_id: int, datos: EmpleadoEntrada, usuario: dict = Depends(get_current_user)):
    """Solo la empresa o el administrador; respeta el cupo de empleados (el administrador no tiene límite)."""
    return empresas_service.crear_empleado(usuario, empresa_id, datos)


@router.patch("/{empresa_id}/empleados/{empleado_id}/activo", response_model=EmpleadosOut)
def cambiar_activo_empleado(empresa_id: int, empleado_id: int, datos: ActivaEntrada, usuario: dict = Depends(get_current_user)):
    return empresas_service.cambiar_activo_empleado(usuario, empresa_id, empleado_id, datos.activa)


@router.get("/{empresa_id}/historial")
def historial(empresa_id: int, usuario: dict = Depends(get_current_user)):
    """Historial de cambios de la empresa (administrador, intermediario dueño y usuario Empresa)."""
    return empresas_service.historial(usuario, empresa_id)
