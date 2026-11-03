from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    acepta_datos: bool = False  # Req 18: aceptación de la política de tratamiento de datos personales (no aplica al administrador)
    captcha_token: str | None = None  # Cloudflare Turnstile (si está activo en el servidor)


class UsuarioOut(BaseModel):
    id: int
    nombre: str
    email: EmailStr
    rol: str
    empresa_id: int | None = None  # roles empresa y empleado: la empresa a la que pertenecen


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


class ConsentimientoRequest(BaseModel):
    consentimiento_token: str
    acepta_datos: bool = False


class LoginResponse(BaseModel):
    """Con verificación activa: trae verificacion_id y correo. Con verificación desactivada: trae el token."""

    requiere_verificacion: bool
    requiere_consentimiento: bool = False  # credenciales correctas; falta aceptar la política de datos (no administradores)
    consentimiento_token: str | None = None
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
    captcha_token: str | None = None


class RecuperarConfirmar(BaseModel):
    email: EmailStr
    codigo: str
    password_nueva: str


class MensajeOut(BaseModel):
    mensaje: str
