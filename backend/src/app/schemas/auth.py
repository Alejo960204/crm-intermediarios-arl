from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    acepta_datos: bool = False  # Req 18: aceptación de la política de tratamiento de datos personales


class UsuarioOut(BaseModel):
    id: int
    nombre: str
    email: EmailStr
    rol: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioOut


class VerificacionPendiente(BaseModel):
    """Respuesta del primer paso: credenciales correctas, falta el código enviado por correo."""

    requiere_verificacion: bool = True
    verificacion_id: int
    correo: str  # enmascarado, p. ej. a***@gmail.com
    reenviar_en: int  # segundos hasta poder pedir otro código


class LoginResponse(BaseModel):
    """Con verificación activa: trae verificacion_id y correo. Con verificación desactivada: trae el token."""

    requiere_verificacion: bool
    verificacion_id: int | None = None
    correo: str | None = None
    reenviar_en: int | None = None
    access_token: str | None = None
    token_type: str = "bearer"
    usuario: UsuarioOut | None = None


class VerificarRequest(BaseModel):
    verificacion_id: int
    codigo: str


class ReenviarRequest(BaseModel):
    verificacion_id: int


class RecuperarRequest(BaseModel):
    email: EmailStr


class RecuperarConfirmar(BaseModel):
    email: EmailStr
    codigo: str
    password_nueva: str


class MensajeOut(BaseModel):
    mensaje: str
