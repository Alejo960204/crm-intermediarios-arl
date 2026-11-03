from fastapi import APIRouter, Depends, HTTPException, status

from ..constantes import ROL_EMPRESA
from ..database import get_cursor
from ..dependencies import get_current_user
from ..repositories import historial_repository
from ..repositories.empresas_repository import POR_VENCER_DIAS
from ..services import diagnosticos_service, empresas_service

router = APIRouter(prefix="/mi-empresa", tags=["Dashboard del usuario Empresa"])


@router.get("/dashboard")
def dashboard(usuario: dict = Depends(get_current_user)):
    """Resumen de la empresa del usuario con rol «empresa»: proceso de afiliación, último diagnóstico, empleados y cupo,
    documentos y últimos cambios."""
    if usuario["rol"] != ROL_EMPRESA:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "El dashboard de empresa es solo para el usuario Empresa")
    eid = usuario.get("empresa_id")
    if not eid:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "El usuario no tiene empresa asignada")
    e = empresas_service.obtener_para_usuario(usuario, eid)
    with get_cursor() as cur:
        cur.execute(
            """SELECT p.id, p.arl_destino, p.numero_afiliacion, p.periodo, p.fecha_inicio, p.fecha_vencimiento,
                      CASE WHEN p.estado = 'Vigente' AND p.fecha_vencimiento <= CURRENT_DATE THEN 'Caducado' ELSE p.estado END AS estado,
                      CASE WHEN p.estado = 'Vigente' THEN p.fecha_vencimiento - CURRENT_DATE END AS dias_restantes,
                      (SELECT count(*) FROM procesos_afiliacion x WHERE x.empresa_id = p.empresa_id) AS total
               FROM procesos_afiliacion p WHERE p.empresa_id = %s ORDER BY p.fecha_creacion DESC, p.id DESC LIMIT 1""", (eid,))
        proceso = cur.fetchone()
        cur.execute(
            """SELECT count(*) AS total FROM documentos WHERE empresa_id = %s AND eliminado = FALSE""", (eid,))
        total_docs = cur.fetchone()["total"]
        cur.execute(
            """SELECT d.id, COALESCE(d.titulo, d.tipo) AS nombre, v.nombre_original AS archivo, v.fecha, u.nombre AS subido_por
               FROM documentos d
               JOIN LATERAL (SELECT * FROM documentos_versiones x WHERE x.documento_id = d.id ORDER BY x.version DESC LIMIT 1) v ON TRUE
               JOIN usuarios u ON u.id = v.subido_por
               WHERE d.empresa_id = %s AND d.eliminado = FALSE ORDER BY v.fecha DESC LIMIT 5""", (eid,))
        docs = cur.fetchall()
    if proceso:
        d = proceso["dias_restantes"]
        proceso["alerta"] = ("caducado" if proceso["estado"] == "Caducado"
                             else "por_vencer" if proceso["estado"] == "Vigente" and d is not None and d <= POR_VENCER_DIAS else None)
    diagnosticos = diagnosticos_service.listar(usuario, eid)  # más reciente primero
    ultimo = diagnosticos[0] if diagnosticos else None
    if ultimo:
        ultimo = {k: ultimo[k] for k in ("id", "fecha_diagnostico", "sgsst_puntos", "nivel_accidentalidad", "nivel_enfermedad_laboral")}
        from ..schemas.diagnostico import PREGUNTAS_SGSST
        ultimo["sgsst_total"] = len(PREGUNTAS_SGSST)
    return {
        "empresa": {"id": e["id"], "nombre": e["nombre"], "nit": e["nit"], "inactiva": e["inactiva"]},
        "por_vencer_dias": POR_VENCER_DIAS,
        "proceso": proceso,
        "diagnostico": ultimo,
        "total_diagnosticos": len(diagnosticos),
        "empleados": empresas_service.empleados(usuario, eid),
        "documentos": {"total": total_docs, "recientes": docs},
        "cambios": historial_repository.listar(eid, 5),
    }
