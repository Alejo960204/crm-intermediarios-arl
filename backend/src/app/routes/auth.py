from fastapi import APIRouter, Depends

from ..dependencies import get_current_user
from ..schemas.auth import (LoginRequest, LoginResponse, ReenviarRequest, TokenResponse, UsuarioOut,
                            VerificacionPendiente, VerificarRequest)
from ..services import auth_service

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/login", response_model=LoginResponse)
def login(datos: LoginRequest):
    """Valida correo y contraseña. Si VERIFICACION_CORREO está activa, envía un código de 6 dígitos al correo
    (paso 1); si no, entrega directamente el token."""
    return auth_service.iniciar_login(datos.email, datos.password)


@router.post("/verificar", response_model=TokenResponse)
def verificar(datos: VerificarRequest):
    """Paso 2: valida el código recibido por correo y entrega el token de sesión."""
    return auth_service.verificar_codigo(datos.verificacion_id, datos.codigo)


@router.post("/reenviar", response_model=VerificacionPendiente)
def reenviar(datos: ReenviarRequest):
    return auth_service.reenviar_codigo(datos.verificacion_id)


@router.get("/me", response_model=UsuarioOut)
def me(usuario: dict = Depends(get_current_user)):
    return usuario
