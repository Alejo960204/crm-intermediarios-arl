from ..constantes import ROL_EMPLEADO, ROL_ROOT
from ..database import get_cursor

# «Caducado» no se guarda: es un proceso Vigente cuya fecha de vencimiento ya llegó.
ESTADO_EFECTIVO = """CASE WHEN p.estado = 'Vigente' AND p.fecha_vencimiento <= CURRENT_DATE
                         THEN 'Caducado' ELSE p.estado END"""

_BASE = f"""
    SELECT p.id, p.empresa_id, e.nombre AS empresa, e.nit, e.usuario_id, p.arl_destino, p.numero_afiliacion,
           {ESTADO_EFECTIVO} AS estado, p.periodo, p.fecha_inicio, p.fecha_vencimiento, p.observacion,
           p.fecha_creacion, p.fecha_actualizacion, u.nombre AS propietario, p.empleado_id, emp.nombre AS empleado, emp.activo AS empleado_activo
    FROM procesos_afiliacion p
    JOIN empresas e ON e.id = p.empresa_id AND e.eliminado = FALSE
    JOIN usuarios u ON u.id = e.usuario_id
    LEFT JOIN usuarios emp ON emp.id = p.empleado_id
"""


def listar_para_usuario(usuario: dict, empresa_id: int | None = None) -> list[dict]:
    cond, params = [], []
    if usuario["rol"] == ROL_EMPLEADO:
        cond.append("p.empleado_id = %s"); params.append(usuario["id"])
    elif usuario["rol"] != ROL_ROOT:
        cond.append("e.usuario_id = %s"); params.append(usuario["id"])
    if empresa_id is not None:
        cond.append("p.empresa_id = %s"); params.append(empresa_id)
    where = ("WHERE " + " AND ".join(cond)) if cond else ""
    with get_cursor() as cur:
        cur.execute(f"{_BASE} {where} ORDER BY p.fecha_actualizacion DESC, p.id DESC", params)
        return cur.fetchall()


def obtener(proceso_id: int) -> dict | None:
    with get_cursor() as cur:
        cur.execute(f"{_BASE} WHERE p.id = %s", (proceso_id,))
        return cur.fetchone()


def historial(proceso_id: int) -> list[dict]:
    with get_cursor() as cur:
        cur.execute(
            """SELECT h.id, h.accion, h.estado, h.fecha_inicio, h.periodo, h.fecha_vencimiento, h.observacion,
                      u.nombre AS usuario, h.fecha
               FROM procesos_historial h JOIN usuarios u ON u.id = h.usuario_id
               WHERE h.proceso_id = %s ORDER BY h.fecha DESC, h.id DESC""", (proceso_id,))
        return cur.fetchall()


def crear(empresa_id: int, datos: dict, usuario_id: int, empleado_id: int | None = None) -> int:
    with get_cursor() as cur:
        cur.execute(
            """INSERT INTO procesos_afiliacion (empresa_id, arl_destino, numero_afiliacion, creado_por, empleado_id)
               VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (empresa_id, datos["arl_destino"], datos["numero_afiliacion"], usuario_id, empleado_id))
        pid = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO procesos_historial (proceso_id, accion, estado, usuario_id) VALUES (%s,'Creación','Pendiente',%s)",
            (pid, usuario_id))
        if empleado_id:
            cur.execute("""INSERT INTO procesos_historial (proceso_id, accion, estado, observacion, usuario_id)
                           SELECT %s, 'Asignación', 'Pendiente', 'Asignado a ' || nombre, %s FROM usuarios WHERE id = %s""",
                        (pid, usuario_id, empleado_id))
        return pid


def actualizar_datos(proceso_id: int, datos: dict) -> None:
    with get_cursor() as cur:
        cur.execute("UPDATE procesos_afiliacion SET arl_destino = %s, numero_afiliacion = %s WHERE id = %s",
                    (datos["arl_destino"], datos["numero_afiliacion"], proceso_id))


def cambiar_estado(proceso_id: int, accion: str, estado: str, fecha_inicio, periodo, observacion, usuario_id: int) -> None:
    """Aplica la transición y la registra en el historial. El vencimiento lo calcula la base de datos:
    inicio + 1 mes (Mensual) o + 1 año (Anual)."""
    with get_cursor() as cur:
        if estado == "Vigente":
            cur.execute(
                """UPDATE procesos_afiliacion SET estado = 'Vigente', fecha_inicio = %s, periodo = %s,
                       fecha_vencimiento = (%s::date + CASE WHEN %s = 'Anual' THEN interval '1 year'
                                                            ELSE interval '1 month' END)::date,
                       observacion = %s WHERE id = %s""",
                (fecha_inicio, periodo, fecha_inicio, periodo, observacion, proceso_id))
        else:
            cur.execute("UPDATE procesos_afiliacion SET estado = %s, observacion = %s WHERE id = %s",
                        (estado, observacion, proceso_id))
        cur.execute(
            """INSERT INTO procesos_historial
                   (proceso_id, accion, estado, fecha_inicio, periodo, fecha_vencimiento, observacion, usuario_id)
               SELECT id, %s, estado, fecha_inicio, periodo, fecha_vencimiento, observacion, %s
               FROM procesos_afiliacion WHERE id = %s""",
            (accion, usuario_id, proceso_id))


def asignar(proceso_id: int, empleado_id: int | None, usuario_id: int) -> None:
    """Asigna (o quita) el empleado responsable y lo deja en el historial."""
    with get_cursor() as cur:
        cur.execute("UPDATE procesos_afiliacion SET empleado_id = %s WHERE id = %s", (empleado_id, proceso_id))
        cur.execute(
            """INSERT INTO procesos_historial (proceso_id, accion, estado, fecha_inicio, periodo, fecha_vencimiento,
                                               observacion, usuario_id)
               SELECT p.id, 'Asignación', p.estado, p.fecha_inicio, p.periodo, p.fecha_vencimiento,
                      COALESCE('Asignado a ' || emp.nombre, 'Asignación retirada'), %s
               FROM procesos_afiliacion p LEFT JOIN usuarios emp ON emp.id = p.empleado_id WHERE p.id = %s""",
            (usuario_id, proceso_id))
