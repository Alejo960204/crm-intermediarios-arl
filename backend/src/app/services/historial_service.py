"""Req 21C: historial de cambios de una empresa. Registra quién, cuándo y qué cambió (una fila por campo en los datos)."""
import logging
from datetime import date, datetime
from decimal import Decimal

from ..database import get_cursor
from ..repositories import historial_repository

log = logging.getLogger(__name__)

ETIQUETAS_EMPRESA = {
    "nombre": "Nombre de la empresa", "nit": "NIT", "direccion": "Dirección principal", "telefono_fijo": "Teléfono fijo",
    "celular": "Celular", "departamento_codigo": "Departamento", "municipio_codigo": "Ciudad / Municipio",
    "contacto_nombre": "Persona que suministra la información", "contacto_cargo": "Cargo del contacto",
    "responsable_sgsst_nombre": "Responsable de SG-SST", "responsable_sgsst_cargo": "Cargo del responsable de SG-SST",
    "gerente": "Nombre del gerente", "actividad_economica": "Actividad económica principal",
    "trabajadores_directos": "Trabajadores directos", "contratistas_independientes": "Contratistas independientes",
    "estudiantes_decreto_055": "Estudiantes Decreto 055 de 2015", "tasa_cotizacion": "Tasa de cotización",
    "arl_actual": "ARL actual", "tiempo_afiliacion_arl": "Tiempo de afiliación a la ARL",
    "valor_cotizacion_arl": "Valor de la cotización a la ARL", "usuario_id": "Intermediario propietario",
}
ETIQUETAS_DIAGNOSTICO = {
    "panorama_riesgos": "Panorama de riesgos", "copasst": "COPASST o vigía", "comite_convivencia": "Comité de convivencia",
    "reglamento_hs": "Reglamento de higiene y seguridad", "plan_trabajo": "Plan de trabajo anual",
    "plan_emergencias": "Plan de emergencias", "brigada_emergencias": "Brigada de emergencias",
    "patrocina_eventos": "Patrocina eventos", "viajes_exterior": "Viajes al exterior", "programas_vigilancia": "Programas de vigilancia epidemiológica",
    "viajes_detalle": "Detalle de viajes", "at_cantidad": "Accidentes de trabajo", "at_dias_incapacidad": "Días de incapacidad por AT",
    "at_causas": "Causas de accidentes", "at_mortales_invalidos": "AT mortales o con invalidez", "el_calificadas": "Enfermedades laborales calificadas",
    "el_causas": "Causas de enfermedad laboral", "el_en_calificacion": "Enfermedades laborales en calificación",
    "expectativas": "Expectativas", "observaciones": "Observaciones", "fecha_diagnostico": "Fecha del diagnóstico",
    "registro_id": "Registro de intermediario",
}
BLOQUES_DIAGNOSTICO = {"datos_generales": "Datos generales", "factores_riesgo": "Factores de riesgo"}


def _texto(v) -> str:
    if v is None:
        return ""
    if isinstance(v, bool):
        return "Sí" if v else "No"
    if isinstance(v, Decimal):
        v = v.normalize()
        return format(v, "f")
    if isinstance(v, datetime):
        return v.strftime("%d/%m/%Y %H:%M")
    if isinstance(v, date):
        return v.strftime("%d/%m/%Y")
    return str(v).strip()


def diferencias(antes: dict, despues: dict, etiquetas: dict, bloques: dict | None = None) -> list[tuple[str, str, str]]:
    """[(campo legible, valor anterior, valor nuevo)] solo de lo que cambió. Los bloques (JSON) solo indican que cambiaron."""
    out = []
    for k, et in etiquetas.items():
        if k not in despues:
            continue
        a, n = _texto(antes.get(k)), _texto(despues.get(k))
        if a != n:
            out.append((et, a, n))
    for k, et in (bloques or {}).items():
        if k in despues and antes.get(k) != despues.get(k):
            out.append((et, "", "modificado"))
    return out


def nombre_departamento(codigo) -> str:
    if not codigo:
        return ""
    with get_cursor() as cur:
        cur.execute("SELECT nombre FROM departamentos WHERE codigo = %s", (codigo,))
        r = cur.fetchone()
        return r["nombre"] if r else str(codigo)


def nombre_municipio(codigo) -> str:
    if not codigo:
        return ""
    with get_cursor() as cur:
        cur.execute("SELECT nombre FROM municipios WHERE codigo = %s", (codigo,))
        r = cur.fetchone()
        return r["nombre"] if r else str(codigo)


def nombre_usuario(usuario_id) -> str:
    if not usuario_id:
        return ""
    with get_cursor() as cur:
        cur.execute("SELECT nombre FROM usuarios WHERE id = %s", (usuario_id,))
        r = cur.fetchone()
        return r["nombre"] if r else str(usuario_id)


def registrar(usuario: dict, empresa_id: int, categoria: str, accion: str, campo: str | None = None,
              anterior: str | None = None, nuevo: str | None = None, detalle: str | None = None) -> None:
    registrar_varios(usuario, empresa_id, categoria, accion, [(campo, anterior, nuevo)], detalle)


def registrar_varios(usuario: dict, empresa_id: int, categoria: str, accion: str,
                     cambios: list[tuple[str | None, str | None, str | None]], detalle: str | None = None) -> None:
    """El historial no debe tumbar la operación ya hecha: si falla, se deja constancia en el log del servidor."""
    try:
        historial_repository.registrar([
            {"empresa_id": empresa_id, "usuario_id": usuario["id"], "rol_usuario": usuario["rol"], "categoria": categoria,
             "accion": accion, "campo": c, "valor_anterior": a, "valor_nuevo": n, "detalle": detalle}
            for c, a, n in cambios])
    except Exception:  # noqa: BLE001
        log.exception("No se pudo registrar el historial de la empresa %s", empresa_id)


def cambios_empresa(antes: dict, despues: dict) -> list[tuple[str, str, str]]:
    """Diferencias de los datos de la empresa; departamento, ciudad y propietario se muestran con su nombre."""
    a, d = dict(antes), dict(despues)
    for dic in (a, d):
        dic["departamento_codigo"] = nombre_departamento(dic.get("departamento_codigo")) if dic.get("departamento_codigo") else None
        dic["municipio_codigo"] = nombre_municipio(dic.get("municipio_codigo")) if dic.get("municipio_codigo") else None
        dic["usuario_id"] = nombre_usuario(dic.get("usuario_id"))
    return diferencias(a, d, ETIQUETAS_EMPRESA)
