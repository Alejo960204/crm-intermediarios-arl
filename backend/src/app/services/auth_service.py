import hmac

from fastapi import HTTPException, status

from .. import mailer
from ..config import settings
from ..repositories import codigos_repository, usuarios_repository
from ..security import create_access_token, generar_codigo, hash_password, huella_codigo, verify_password

MAX_REENVIOS = 5
VERSION_POLITICA = "2026-10-v1"  # cambiar al modificar el texto de la política (frontend/src/components/TextoConsentimiento.tsx)
MIN_CLAVE = 8


def _enmascarar(email: str) -> str:
    local, _, dominio = email.partition("@")
    return f"{local[:1]}{'*' * max(2, len(local) - 1)}@{dominio}"


def _pendiente(codigo_id: int, email: str) -> dict:
    return {"requiere_verificacion": True, "verificacion_id": codigo_id, "correo": _enmascarar(email),
            "reenviar_en": settings.CODIGO_REENVIO_SEGUNDOS}


def _enviar_codigo(usuario: dict, codigo: str) -> None:
    texto = (
        f"Hola {usuario['nombre']},\n\n"
        f"Tu código de verificación para ingresar al CRM de Intermediarios ARL es:\n\n    {codigo}\n\n"
        f"Vence en {settings.CODIGO_MINUTOS} minutos. Si no fuiste tú, ignora este mensaje y no compartas el código.\n"
    )
    try:
        mailer.enviar(usuario["email"], "Tu código de verificación", texto)
    except mailer.CorreoNoEnviado:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY,
                            "No se pudo enviar el correo con el código. Intente de nuevo o contacte al administrador.")


def _token(usuario: dict) -> dict:
    return {
        "access_token": create_access_token(usuario["id"]),
        "token_type": "bearer",
        "usuario": {"id": usuario["id"], "nombre": usuario["nombre"], "email": usuario["email"], "rol": usuario["rol"]},
    }


def iniciar_login(email: str, password: str, acepta_datos: bool = False, ip: str | None = None) -> dict:
    if not acepta_datos:  # Req 18: sin aceptar la política no se inicia sesión
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Debe aceptar la política de tratamiento de datos personales para ingresar.")
    usuario = usuarios_repository.obtener_por_email(email)
    if not usuario or not usuario["activo"] or not verify_password(password, usuario["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenciales inválidas")
    usuarios_repository.registrar_consentimiento(usuario["id"], VERSION_POLITICA, ip)
    if not settings.VERIFICACION_CORREO:  # interruptor desactivado: acceso solo con contraseña
        return {"requiere_verificacion": False, **_token(usuario)}
    codigos_repository.limpiar_antiguos()
    codigo = generar_codigo()
    codigo_id = codigos_repository.crear(usuario["id"], huella_codigo(usuario["id"], codigo), settings.CODIGO_MINUTOS)
    _enviar_codigo(usuario, codigo)
    return _pendiente(codigo_id, usuario["email"])


def _obtener_vigente(verificacion_id: int) -> dict:
    c = codigos_repository.obtener(verificacion_id)
    if not c or c["usado"] or c["proposito"] != "login":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "La verificación ya no es válida. Inicie sesión de nuevo.")
    return c


def verificar_codigo(verificacion_id: int, codigo: str) -> dict:
    c = _obtener_vigente(verificacion_id)
    if c["vencido"]:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "El código venció. Solicite uno nuevo.")
    if c["intentos"] >= settings.CODIGO_MAX_INTENTOS:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "Demasiados intentos fallidos. Solicite un código nuevo o inicie sesión de nuevo.")
    esperado = huella_codigo(c["usuario_id"], codigo.strip())
    if not hmac.compare_digest(esperado, c["codigo_hash"]):
        codigos_repository.sumar_intento(verificacion_id)
        quedan = settings.CODIGO_MAX_INTENTOS - c["intentos"] - 1
        raise HTTPException(status.HTTP_401_UNAUTHORIZED,
                            f"Código incorrecto. Le quedan {quedan} intento(s)." if quedan > 0
                            else "Código incorrecto. Se agotaron los intentos: solicite un código nuevo.")
    usuario = usuarios_repository.obtener_por_id(c["usuario_id"])
    if not usuario or not usuario["activo"]:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenciales inválidas")
    codigos_repository.marcar_usado(verificacion_id)
    return _token(usuario)


def reenviar_codigo(verificacion_id: int) -> dict:
    c = _obtener_vigente(verificacion_id)
    espera = settings.CODIGO_REENVIO_SEGUNDOS - int(c["segundos_desde_envio"])
    if espera > 0:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, f"Espere {espera} segundos para pedir otro código.")
    if c["reenvios"] >= MAX_REENVIOS:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "Se alcanzó el máximo de reenvíos. Inicie sesión de nuevo.")
    usuario = usuarios_repository.obtener_por_id(c["usuario_id"])
    if not usuario or not usuario["activo"]:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenciales inválidas")
    codigo = generar_codigo()
    codigos_repository.renovar(verificacion_id, huella_codigo(usuario["id"], codigo), settings.CODIGO_MINUTOS)
    _enviar_codigo(usuario, codigo)
    return _pendiente(verificacion_id, usuario["email"])


# ---------- Req 18: «¿Olvidó su contraseña?» (código de 6 dígitos por correo) ----------
MENSAJE_RECUPERAR = "Si el correo está registrado, enviamos un código de verificación. Revise su bandeja de entrada."
ERROR_CODIGO = "El código es incorrecto o venció. Verifíquelo o solicite uno nuevo."


def solicitar_recuperacion(email: str) -> dict:
    """Responde siempre lo mismo, exista o no el correo (no revela qué correos están registrados)."""
    usuario = usuarios_repository.obtener_por_email(email)
    if usuario and usuario["activo"]:
        ultimo = codigos_repository.ultimo_recuperacion(usuario["id"])
        en_espera = ultimo and ultimo["segundos_desde_envio"] < settings.CODIGO_REENVIO_SEGUNDOS
        if not en_espera and codigos_repository.recuperaciones_ultima_hora(usuario["id"]) < MAX_REENVIOS:
            codigos_repository.limpiar_antiguos()
            codigo = generar_codigo()
            codigos_repository.crear(usuario["id"], huella_codigo(usuario["id"], codigo), settings.CODIGO_MINUTOS, "recuperacion")
            texto = (
                f"Hola {usuario['nombre']},\n\n"
                f"Recibimos una solicitud para restablecer tu contraseña del CRM de Intermediarios ARL. Tu código es:\n\n    {codigo}\n\n"
                f"Vence en {settings.CODIGO_MINUTOS} minutos. Si no fuiste tú, ignora este mensaje: tu contraseña no cambiará.\n"
            )
            try:
                mailer.enviar(usuario["email"], "Restablecer tu contraseña", texto)
            except mailer.CorreoNoEnviado:
                raise HTTPException(status.HTTP_502_BAD_GATEWAY,
                                    "No se pudo enviar el correo. Intente de nuevo o contacte al administrador.")
    return {"mensaje": MENSAJE_RECUPERAR}


def confirmar_recuperacion(email: str, codigo: str, password_nueva: str) -> dict:
    if len(password_nueva) < MIN_CLAVE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"La contraseña debe tener al menos {MIN_CLAVE} caracteres.")
    usuario = usuarios_repository.obtener_por_email(email)
    c = codigos_repository.ultimo_recuperacion(usuario["id"]) if usuario and usuario["activo"] else None
    if not c or c["vencido"] or c["intentos"] >= settings.CODIGO_MAX_INTENTOS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, ERROR_CODIGO)
    if not hmac.compare_digest(huella_codigo(usuario["id"], codigo.strip()), c["codigo_hash"]):
        codigos_repository.sumar_intento(c["id"])
        raise HTTPException(status.HTTP_400_BAD_REQUEST, ERROR_CODIGO)
    usuarios_repository.cambiar_password(usuario["id"], hash_password(password_nueva))
    codigos_repository.invalidar_todos(usuario["id"])  # el código no se reutiliza y se anulan los códigos de login pendientes
    return {"mensaje": "Contraseña actualizada. Ya puede iniciar sesión."}
