import calendar
from datetime import date

from fastapi import HTTPException

from ..constantes import ROL_CLIENTE
from ..repositories import paquetes_repository as repo

MESES = {"mensual": 1, "trimestral": 3, "semestral": 6, "anual": 12}


def sumar_meses(d: date, meses: int) -> date:
    m = d.month - 1 + meses
    anio, mes = d.year + m // 12, m % 12 + 1
    return date(anio, mes, min(d.day, calendar.monthrange(anio, mes)[1]))


def vencimiento(inicio: date, periodicidad: str) -> date:
    return sumar_meses(inicio, MESES[periodicidad])


def estado(usuario_id: int) -> dict | None:
    """Estado del paquete del intermediario: cupo gastado/disponible, vencimiento y nivel de alerta. None = sin paquete."""
    p = repo.actual(usuario_id)
    if not p:
        return None
    usadas = repo.usadas(p["id"])
    cantidad = p["cantidad_empresas"]
    disponibles = max(cantidad - usadas, 0)
    vencido = p["fecha_vencimiento"] is not None and p["fecha_vencimiento"] <= date.today()
    if vencido:
        alerta = "vencido"
    elif disponibles == 0:
        alerta = "agotado"
    elif disponibles <= 1 or disponibles <= cantidad * 0.2:
        alerta = "poco"
    else:
        alerta = None
    return {
        "id": p["id"], "nombre": p["nombre"], "cantidad_empresas": cantidad, "periodicidad": p["periodicidad"],
        "fecha_inicio": p["fecha_inicio"], "fecha_vencimiento": p["fecha_vencimiento"],
        "usadas": usadas, "disponibles": disponibles, "vencido": vencido, "alerta": alerta,
        "puede_crear": not vencido and disponibles > 0,
        "solicitud_pendiente": repo.solicitud_pendiente(usuario_id) is not None,
    }


def cupo(usuario: dict) -> dict:
    """Resumen para pantallas del intermediario. paquete = None -> sin límite (p. ej. administrador)."""
    p = estado(usuario["id"]) if usuario["rol"] == ROL_CLIENTE else None
    return {"usadas": p["usadas"] if p else 0, "maximo": p["cantidad_empresas"] if p else None,
            "disponibles": p["disponibles"] if p else None, "puede_crear": p["puede_crear"] if p else True, "paquete": p}


def verificar_puede_crear(usuario_id: int) -> None:
    p = estado(usuario_id)
    if p is None:
        return
    if p["vencido"]:
        raise HTTPException(403, f"Su paquete «{p['nombre']}» venció el {p['fecha_vencimiento'].strftime('%d/%m/%Y')}. "
                                 "Renueve o actualice su paquete para crear empresas.")
    if p["disponibles"] <= 0:
        raise HTTPException(403, f"Alcanzó el límite de su paquete «{p['nombre']}» ({p['usadas']} de {p['cantidad_empresas']} empresas). "
                                 "Actualice su paquete para crear más empresas.")


def bloqueo_por_vencimiento(usuario_id: int) -> str | None:
    """Mensaje si el paquete del intermediario venció (solo puede consultar); None si puede trabajar."""
    p = repo.actual(usuario_id)
    if p and p["fecha_vencimiento"] is not None and p["fecha_vencimiento"] <= date.today():
        return (f"Su paquete «{p['nombre']}» venció el {p['fecha_vencimiento'].strftime('%d/%m/%Y')}: por ahora solo puede consultar "
                "su información. Renueve su paquete con el administrador para volver a crear o editar.")
    return None


def solicitar_ampliacion(usuario: dict) -> dict:
    if usuario["rol"] != ROL_CLIENTE:
        raise HTTPException(403, "Solo los intermediarios solicitan ampliación de paquete")
    repo.crear_solicitud(usuario["id"])
    return cupo(usuario)
