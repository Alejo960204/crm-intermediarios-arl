from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..constantes import ROL_CLIENTE
from ..database import get_cursor
from ..dependencies import get_current_user
from ..repositories.empresas_repository import POR_VENCER_DIAS

router = APIRouter(prefix="/mi-panel", tags=["Mi panel (cliente)"])

ESTADOS_REGISTRO = ["Borrador", "En revisión", "Aprobado", "Rechazado"]


class EmpresaPanel(BaseModel):
    id: int
    nombre: str
    nit: str
    proceso_id: int | None = None
    estado: str | None = None           # Pendiente | En proceso | Vigente | Caducado | None (sin proceso)
    arl_destino: str | None = None
    fecha_vencimiento: date | None = None
    dias_restantes: int | None = None   # solo si está Vigente
    empleado: str | None = None
    alerta: str | None = None           # por_vencer | caducado


class ResumenPanel(BaseModel):
    total_empresas: int
    en_curso: int
    vigente: int
    caducado: int
    sin_proceso: int
    por_vencer: int


class PanelOut(BaseModel):
    por_vencer_dias: int
    resumen: ResumenPanel
    empresas: list[EmpresaPanel]
    registros: dict[str, int]  # estado -> cantidad (todas las claves siempre presentes)
    total_registros: int


@router.get("", response_model=PanelOut)
def mi_panel(usuario: dict = Depends(get_current_user)):
    """Inicio del cliente: sus empresas con el estado de su proceso más reciente y el resumen de sus registros."""
    if usuario["rol"] != ROL_CLIENTE:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Mi panel es solo para clientes")
    with get_cursor() as cur:
        cur.execute(
            """SELECT e.id, e.nombre, e.nit, up.id AS proceso_id, up.estado, up.arl_destino, up.fecha_vencimiento,
                      CASE WHEN up.estado = 'Vigente' THEN up.fecha_vencimiento - CURRENT_DATE END AS dias_restantes,
                      up.empleado
               FROM empresas e
               LEFT JOIN LATERAL (
                   SELECT p.id, p.arl_destino, p.fecha_vencimiento, emp.nombre AS empleado,
                          CASE WHEN p.estado = 'Vigente' AND p.fecha_vencimiento <= CURRENT_DATE THEN 'Caducado' ELSE p.estado END AS estado
                   FROM procesos_afiliacion p LEFT JOIN usuarios emp ON emp.id = p.empleado_id
                   WHERE p.empresa_id = e.id ORDER BY p.fecha_creacion DESC, p.id DESC LIMIT 1
               ) up ON TRUE
               WHERE e.usuario_id = %s AND e.eliminado = FALSE
               ORDER BY e.nombre""", (usuario["id"],))
        empresas = cur.fetchall()
        cur.execute("SELECT estado, count(*) AS n FROM registros_intermediarios WHERE usuario_id = %s AND eliminado = FALSE GROUP BY estado",
                    (usuario["id"],))
        conteo = {r["estado"]: r["n"] for r in cur.fetchall()}
    for e in empresas:
        d = e["dias_restantes"]
        e["alerta"] = ("caducado" if e["estado"] == "Caducado"
                       else "por_vencer" if e["estado"] == "Vigente" and d is not None and d <= POR_VENCER_DIAS else None)
    cuenta = lambda f: sum(1 for e in empresas if f(e))  # noqa: E731
    registros = {k: conteo.get(k, 0) for k in ESTADOS_REGISTRO}
    return {
        "por_vencer_dias": POR_VENCER_DIAS,
        "resumen": {
            "total_empresas": len(empresas),
            "en_curso": cuenta(lambda e: e["estado"] in ("Pendiente", "En proceso")),
            "vigente": cuenta(lambda e: e["estado"] == "Vigente"),
            "caducado": cuenta(lambda e: e["estado"] == "Caducado"),
            "sin_proceso": cuenta(lambda e: e["estado"] is None),
            "por_vencer": cuenta(lambda e: e["alerta"] == "por_vencer"),
        },
        "empresas": empresas,
        "registros": registros,
        "total_registros": sum(registros.values()),
    }
