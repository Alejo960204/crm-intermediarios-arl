from ..constantes import ROL_EMPLEADO, ROL_ROOT
from ..database import get_cursor

CAMPOS = ("nombre", "nit", "direccion", "telefono_fijo", "celular", "departamento_codigo", "municipio_codigo",
          "contacto_nombre", "contacto_cargo", "responsable_sgsst_nombre", "responsable_sgsst_cargo", "gerente",
          "actividad_economica", "trabajadores_directos", "contratistas_independientes",
          "estudiantes_decreto_055", "tasa_cotizacion", "arl_actual", "tiempo_afiliacion_arl",
          "valor_cotizacion_arl")


# Proceso más reciente de cada empresa (por fecha de creación) con su estado efectivo:
# un proceso Vigente cuyo vencimiento ya llegó cuenta como «Caducado».
ULTIMO_PROCESO = """
    LEFT JOIN LATERAL (
        SELECT CASE WHEN p.estado = 'Vigente' AND p.fecha_vencimiento <= CURRENT_DATE THEN 'Caducado' ELSE p.estado END AS estado,
               p.fecha_vencimiento
        FROM procesos_afiliacion p WHERE p.empresa_id = e.id
        ORDER BY p.fecha_creacion DESC, p.id DESC LIMIT 1
    ) up ON TRUE
"""
POR_VENCER_DIAS = 30
CATEGORIAS = {  # categoría del dashboard -> condición sobre el proceso más reciente (up)
    "en_curso": "up.estado IN ('Pendiente', 'En proceso')",
    "vigente": "up.estado = 'Vigente'",
    "caducado": "up.estado = 'Caducado'",
    "sin_proceso": "up.estado IS NULL",
    "por_vencer": f"up.estado = 'Vigente' AND up.fecha_vencimiento <= CURRENT_DATE + {POR_VENCER_DIAS}",
}


def listar_para_usuario(usuario: dict, categoria: str | None = None) -> list[dict]:
    if usuario["rol"] == ROL_ROOT:
        filtro, params = "", ()
    elif usuario["rol"] == ROL_EMPLEADO:  # solo empresas con algún proceso asignado a él
        filtro, params = "AND e.id IN (SELECT empresa_id FROM procesos_afiliacion WHERE empleado_id = %s)", (usuario["id"],)
    else:
        filtro, params = "AND e.usuario_id = %s", (usuario["id"],)
    if categoria:
        filtro += f" AND ({CATEGORIAS[categoria]})"
    with get_cursor() as cur:
        cur.execute(
            f"""
            SELECT e.id, e.nombre, e.nit, m.nombre AS ciudad, e.gerente, e.trabajadores_directos,
                   e.fecha_creacion, e.fecha_actualizacion, u.nombre AS propietario,
                   up.estado AS estado_proceso, up.fecha_vencimiento
            FROM empresas e
            JOIN usuarios u ON u.id = e.usuario_id
            LEFT JOIN municipios m ON m.codigo = e.municipio_codigo
            {ULTIMO_PROCESO}
            WHERE e.eliminado = FALSE {filtro}
            ORDER BY e.fecha_actualizacion DESC, e.id DESC
            """,
            params,
        )
        return cur.fetchall()


def obtener(empresa_id: int) -> dict | None:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT e.*, u.nombre AS propietario FROM empresas e
            JOIN usuarios u ON u.id = e.usuario_id
            WHERE e.id = %s AND e.eliminado = FALSE
            """,
            (empresa_id,),
        )
        return cur.fetchone()


def crear(usuario_id: int, datos: dict) -> int:
    cols = ", ".join(CAMPOS)
    vals = ", ".join(f"%({c})s" for c in CAMPOS)
    with get_cursor() as cur:
        cur.execute(f"INSERT INTO empresas (usuario_id, {cols}) VALUES (%(usuario_id)s, {vals}) RETURNING id",
                    {**datos, "usuario_id": usuario_id})
        return cur.fetchone()["id"]


def actualizar(empresa_id: int, usuario_id: int | None, datos: dict) -> None:
    sets = ", ".join(f"{c} = %({c})s" for c in CAMPOS)
    if usuario_id is not None:
        sets += ", usuario_id = %(usuario_id)s"
    with get_cursor() as cur:
        cur.execute(f"UPDATE empresas SET {sets} WHERE id = %(id)s AND eliminado = FALSE",
                    {**datos, "id": empresa_id, "usuario_id": usuario_id})


def eliminar_logico(empresa_id: int) -> None:
    with get_cursor() as cur:
        cur.execute("UPDATE empresas SET eliminado = TRUE WHERE id = %s", (empresa_id,))


def empleado_tiene_proceso(empleado_id: int, empresa_id: int) -> bool:
    with get_cursor() as cur:
        cur.execute("SELECT 1 FROM procesos_afiliacion WHERE empleado_id = %s AND empresa_id = %s LIMIT 1",
                    (empleado_id, empresa_id))
        return cur.fetchone() is not None


def contar_dashboard() -> dict:
    """Totales globales (solo root). Cada empresa cuenta una vez, según su proceso más reciente, así que
    en_curso + vigente + caducado + sin_proceso = total. «por_vencer» es un subconjunto de «vigente»."""
    with get_cursor() as cur:
        cur.execute(
            f"""
            SELECT count(*) AS total,
                   count(*) FILTER (WHERE {CATEGORIAS['en_curso']}) AS en_curso,
                   count(*) FILTER (WHERE {CATEGORIAS['vigente']}) AS vigente,
                   count(*) FILTER (WHERE {CATEGORIAS['caducado']}) AS caducado,
                   count(*) FILTER (WHERE {CATEGORIAS['sin_proceso']}) AS sin_proceso,
                   count(*) FILTER (WHERE {CATEGORIAS['por_vencer']}) AS por_vencer
            FROM empresas e {ULTIMO_PROCESO}
            WHERE e.eliminado = FALSE
            """)
        return cur.fetchone()
