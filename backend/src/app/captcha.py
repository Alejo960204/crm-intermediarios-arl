"""Captcha Cloudflare Turnstile: valida en el servidor el token que genera el widget del navegador."""
import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from fastapi import HTTPException, status

from .config import settings

log = logging.getLogger(__name__)


def activo() -> bool:
    return bool(settings.TURNSTILE_SECRET_KEY)


def verificar(token: str | None, ip: str | None = None) -> None:
    """Sin clave secreta configurada no se exige (captcha desactivado). Con clave: el token es obligatorio y se valida
    con Cloudflare; cada token sirve una sola vez."""
    if not activo():
        return
    if not token or not token.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Confirme que no es un robot.")
    datos = {"secret": settings.TURNSTILE_SECRET_KEY, "response": token.strip()}
    if ip:
        datos["remoteip"] = ip
    req = urllib.request.Request(settings.TURNSTILE_VERIFY_URL, data=urllib.parse.urlencode(datos).encode(), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=8) as r:  # noqa: S310 (URL fija por configuración)
            ok = bool(json.loads(r.read().decode()).get("success"))
    except (urllib.error.URLError, TimeoutError, ValueError):
        log.exception("No se pudo consultar el servicio de captcha")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "No se pudo validar el captcha. Intente de nuevo en unos minutos.")
    if not ok:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No se pudo verificar el captcha. Inténtelo de nuevo.")
