import json

from ..constantes import ROL_EMPLEADO, ROL_ROOT
from ..database import get_cursor

CAMPOS_BOOL = ("panorama_riesgos", "copasst", "comite_convivencia", "reglamento_hs", "plan_trabajo",
               "plan_emergencias", "brigada_emergencias", "patrocina_eventos", "viajes_exterior",
               "programas_vigilancia")
CAMPOS = (*CAMPOS_BOOL, "viajes_detalle", "at_cantidad", "at_dias_incapacidad", "at_causas", "at_mortales_invalidos",
          "el_calificadas", "el_causas", "el_en_calificacion", "expectativas", "observaciones", "fecha_diagnostico")

_BASE = """
    SELECT d.*, e.nombre AS empresa, e.nit AS empresa_nit, e.usuario_id AS empresa_usuario_id, u.nombre AS creado_por_nombre
    FROM diagnosticos d
    JOIN empresas e ON e.id = d.empresa_id AND e.eliminado = FALSE
    JOIN usuarios u ON u.id = d.creado_por
"""


def listar_para_usuario(usuario: dict, empresa_id: int | None) -> list[dict]:
    cond, params = [], []
    if usuario["rol"] == ROL_EMPLEADO:
        cond.append("d.empresa_id IN (SELECT empresa_id FROM procesos_afiliacion WHERE empleado_id = %s)")
        params.append(usuario["id"])
    elif usuario["rol"] != ROL_ROOT:
        cond.append("e.usuario_id = %s"); params.append(usuario["id"])
    if empresa_id is not None:
        cond.append("d.empresa_id = %s"); params.append(empresa_id)
    where = ("WHERE " + " AND ".join(cond)) if cond else ""
    with get_cursor() as cur:
        cur.execute(f"{_BASE} {where} ORDER BY d.fecha_diagnostico DESC, d.id DESC", params)
        return cur.fetchall()


def obtener(diagnostico_id: int) -> dict | None:
    with get_cursor() as cur:
        cur.execute(f"{_BASE} WHERE d.id = %s", (diagnostico_id,))
        return cur.fetchone()


def nombre_municipio(codigo: str | None) -> str | None:
    if not codigo:
        return None
    with get_cursor() as cur:
        cur.execute("SELECT nombre FROM municipios WHERE codigo = %s", (codigo,))
        r = cur.fetchone()
        return r["nombre"] if r else None


def registros_del_usuario(usuario_id: int) -> list[dict]:
    with get_cursor() as cur:
        cur.execute("SELECT id, rui, nit, razon_social, estado FROM registros_intermediarios "
                    "WHERE usuario_id = %s AND eliminado = FALSE ORDER BY fecha_actualizacion DESC, id DESC",
                    (usuario_id,))
        return cur.fetchall()


def _valores(datos: dict, intermediario: dict | None) -> dict:
    v = {c: datos[c] for c in CAMPOS}
    v["registro_id"] = datos.get("registro_id")
    v["datos_generales"] = json.dumps(datos["datos_generales"])
    v["factores_riesgo"] = json.dumps(datos["factores_riesgo"])
    v["intermediario_nombre"] = intermediario["razon_social"] if intermediario else None
    v["intermediario_rui"] = intermediario["rui"] if intermediario else None
    v["intermediario_nit"] = intermediario["nit"] if intermediario else None
    return v


def crear(empresa_id: int, usuario_id: int, datos: dict, intermediario: dict | None) -> int:
    v = _valores(datos, intermediario)
    cols = [*v.keys(), "empresa_id", "creado_por"]
    with get_cursor() as cur:
        cur.execute(f"INSERT INTO diagnosticos ({', '.join(cols)}) VALUES ({', '.join('%(' + c + ')s' for c in cols)}) RETURNING id",
                    {**v, "empresa_id": empresa_id, "creado_por": usuario_id})
        return cur.fetchone()["id"]


def actualizar(diagnostico_id: int, datos: dict, intermediario: dict | None) -> None:
    v = _valores(datos, intermediario)
    sets = ", ".join(f"{c} = %({c})s" for c in v)
    with get_cursor() as cur:
        cur.execute(f"UPDATE diagnosticos SET {sets} WHERE id = %(id)s", {**v, "id": diagnostico_id})
