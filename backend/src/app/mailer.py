"""Envío de correo por SMTP. Sin SMTP_HOST configurado, el mensaje se imprime en la consola (modo de pruebas)."""
import logging
import smtplib
import ssl
from email.message import EmailMessage

from .config import settings

log = logging.getLogger("uvicorn.error")


class CorreoNoEnviado(Exception):
    pass


def enviar(destino: str, asunto: str, texto: str) -> None:
    if not settings.SMTP_HOST:
        log.warning("\n%s\n[MODO PRUEBAS - SMTP sin configurar] Correo para %s\nAsunto: %s\n%s\n%s",
                    "=" * 60, destino, asunto, texto, "=" * 60)
        return

    remitente = settings.SMTP_FROM or settings.SMTP_USER
    if not remitente:
        raise CorreoNoEnviado("Falta SMTP_FROM o SMTP_USER en el .env")
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = remitente, destino, asunto
    msg.set_content(texto)

    try:
        contexto = ssl.create_default_context()
        if settings.SMTP_SECURITY == "ssl":
            servidor = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15, context=contexto)
        else:
            servidor = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
        with servidor:
            if settings.SMTP_SECURITY == "starttls":
                servidor.starttls(context=contexto)
            if settings.SMTP_USER:
                servidor.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            servidor.send_message(msg)
    except (smtplib.SMTPException, OSError) as e:
        log.error("No se pudo enviar el correo a %s: %s", destino, e)
        raise CorreoNoEnviado(str(e)) from e
