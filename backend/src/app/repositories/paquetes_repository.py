from datetime import date

from ..database import get_cursor


def actual(usuario_id: int) -> dict | None:
    """Paquete vigente de trabajo del intermediario = el asignado más recientemente (None = sin paquete: sin límite)."""
    with get_cursor() as cur:
        cur.execute("SELECT * FROM paquetes_intermediario WHERE usuario_id = %s ORDER BY id DESC LIMIT 1", (usuario_id,))
        return cur.fetchone()


def usadas(paquete_id: int) -> int:
    """Empresas creadas con este paquete. Incluye las inactivas: inactivar no libera cupo."""
    with get_cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM empresas WHERE paquete_id = %s", (paquete_id,))
        return cur.fetchone()["n"]


def crear(usuario_id: int, nombre: str, cantidad: int, periodicidad: str, inicio: date, vencimiento: date | None,
          creado_por: int | None) -> int:
    with get_cursor() as cur:
        cur.execute(
            """INSERT INTO paquetes_intermediario (usuario_id, nombre, cantidad_empresas, periodicidad, fecha_inicio, fecha_vencimiento, creado_por)
               VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
            (usuario_id, nombre, cantidad, periodicidad, inicio, vencimiento, creado_por))
        pid = cur.fetchone()["id"]
        # Una asignación nueva atiende cualquier solicitud de ampliación pendiente
        cur.execute("UPDATE solicitudes_ampliacion SET estado = 'atendida', fecha_atencion = now(), atendida_por = %s "
                    "WHERE usuario_id = %s AND estado = 'pendiente'", (creado_por, usuario_id))
        return pid


def historial(usuario_id: int) -> list[dict]:
    with get_cursor() as cur:
        cur.execute(
            """SELECT p.*, (SELECT count(*) FROM empresas e WHERE e.paquete_id = p.id) AS usadas, u.nombre AS asignado_por
               FROM paquetes_intermediario p LEFT JOIN usuarios u ON u.id = p.creado_por
               WHERE p.usuario_id = %s ORDER BY p.id DESC""", (usuario_id,))
        return cur.fetchall()


# ---------- Solicitudes de ampliación ----------
def solicitud_pendiente(usuario_id: int) -> dict | None:
    with get_cursor() as cur:
        cur.execute("SELECT * FROM solicitudes_ampliacion WHERE usuario_id = %s AND estado = 'pendiente'", (usuario_id,))
        return cur.fetchone()


def crear_solicitud(usuario_id: int) -> None:
    with get_cursor() as cur:
        cur.execute("INSERT INTO solicitudes_ampliacion (usuario_id) VALUES (%s) ON CONFLICT DO NOTHING", (usuario_id,))


def atender_solicitud(usuario_id: int, admin_id: int) -> None:
    with get_cursor() as cur:
        cur.execute("UPDATE solicitudes_ampliacion SET estado = 'atendida', fecha_atencion = now(), atendida_por = %s "
                    "WHERE usuario_id = %s AND estado = 'pendiente'", (admin_id, usuario_id))


def contar_solicitudes_pendientes() -> int:
    with get_cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM solicitudes_ampliacion s JOIN usuarios u ON u.id = s.usuario_id "
                    "WHERE s.estado = 'pendiente' AND u.activo = TRUE")
        return cur.fetchone()["n"]
