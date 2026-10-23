import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .constantes import ROL_EMPLEADO, ROL_ROOT
from .repositories import usuarios_repository
from .security import decode_access_token

bearer = HTTPBearer(auto_error=False)


def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
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


def requiere_root(usuario: dict = Depends(get_current_user)) -> dict:
    """Solo para rutas de administración: exige rol 'root Admin'."""
    if usuario["rol"] != ROL_ROOT:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo el administrador puede realizar esta acción")
    return usuario


def no_empleado(usuario: dict = Depends(get_current_user)) -> dict:
    """El rol Empleado solo trabaja con procesos asignados, empresas de esos procesos y diagnósticos."""
    if usuario["rol"] == ROL_EMPLEADO:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Su rol no tiene acceso a este módulo")
    return usuario
