import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .constantes import ROL_CLIENTE, ROL_ROOT, ROLES_DE_EMPRESA
from .repositories import usuarios_repository
from .security import decode_access_token

bearer = HTTPBearer(auto_error=False)


def get_current_user_sin_bloqueo(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    error = HTTPException(status.HTTP_401_UNAUTHORIZED, "No autenticado")
    if creds is None:
        raise error
    try:
        usuario_id = decode_access_token(creds.credentials)
    except jwt.PyJWTError:
        raise error
    usuario = usuarios_repository.obtener_por_id(usuario_id)
    if not usuario or not usuario["activo"]:
        raise error
    return usuario


def get_current_user(request: Request, usuario: dict = Depends(get_current_user_sin_bloqueo)) -> dict:
    """Usuario autenticado. Si es un intermediario con el paquete vencido, solo puede consultar (GET): cualquier
    escritura se rechaza con 403."""
    if request.method not in ("GET", "HEAD", "OPTIONS") and usuario["rol"] == ROL_CLIENTE:
        from .services import paquetes_service  # import local: evita ciclos
        mensaje = paquetes_service.bloqueo_por_vencimiento(usuario["id"])
        if mensaje:
            raise HTTPException(status.HTTP_403_FORBIDDEN, mensaje)
    return usuario


def requiere_root(usuario: dict = Depends(get_current_user)) -> dict:
    """Solo para rutas de administración: exige rol 'administrador'."""
    if usuario["rol"] != ROL_ROOT:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo el administrador puede realizar esta acción")
    return usuario


def no_empleado(usuario: dict = Depends(get_current_user)) -> dict:
    """Los roles Empresa y Empleado solo trabajan con los datos de su empresa (no con Mis Registros)."""
    if usuario["rol"] in ROLES_DE_EMPRESA:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Su rol no tiene acceso a este módulo")
    return usuario
