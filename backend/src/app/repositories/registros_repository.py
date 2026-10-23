from ..constantes import ROL_ROOT
from ..database import get_cursor

_COLUMNAS_DETALLE = """
    r.id, r.usuario_id, r.rui, r.nit, r.razon_social, r.departamento_codigo, r.municipio_codigo,
    r.direccion, r.correo, r.telefono_fijo, r.estado, r.fecha_creacion, r.fecha_actualizacion,
    u.nombre AS propietario, r.decision_comentario, r.decision_fecha, d.nombre AS decision_por
"""


def listar_para_usuario(usuario: dict) -> list[dict]:
    """Registros no eliminados. root Admin ve todos; cliente solo los suyos."""
    filtro, params = ("", ()) if usuario["rol"] == ROL_ROOT else ("AND r.usuario_id = %s", (usuario["id"],))
    with get_cursor() as cur:
        cur.execute(
            f"""
            SELECT r.id, r.rui, r.nit, r.razon_social, m.nombre AS ciudad, r.estado,
                   r.fecha_creacion, r.fecha_actualizacion, u.nombre AS propietario, r.decision_comentario
            FROM registros_intermediarios r
            JOIN usuarios u ON u.id = r.usuario_id
            LEFT JOIN municipios m ON m.codigo = r.municipio_codigo
            WHERE r.eliminado = FALSE {filtro}
            ORDER BY r.fecha_actualizacion DESC, r.id DESC
            """,
            params,
        )
        return cur.fetchall()


def obtener(registro_id: int) -> dict | None:
    with get_cursor() as cur:
        cur.execute(
            f"""
            SELECT {_COLUMNAS_DETALLE}
            FROM registros_intermediarios r
            JOIN usuarios u ON u.id = r.usuario_id
            LEFT JOIN usuarios d ON d.id = r.decision_usuario_id
            WHERE r.id = %s AND r.eliminado = FALSE
            """,
            (registro_id,),
        )
        return cur.fetchone()


def crear(usuario_id: int, datos: dict) -> int:
    """Crea el registro en estado 'Borrador'. Lanza UniqueViolation si el RUI ya existe."""
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO registros_intermediarios
                (usuario_id, rui, nit, razon_social, departamento_codigo, municipio_codigo,
                 direccion, correo, telefono_fijo, estado)
            VALUES (%(usuario_id)s, %(rui)s, %(nit)s, %(razon_social)s, %(departamento_codigo)s,
                    %(municipio_codigo)s, %(direccion)s, %(correo)s, %(telefono_fijo)s, 'Borrador')
            RETURNING id
            """,
            {**datos, "usuario_id": usuario_id},
        )
        return cur.fetchone()["id"]


def actualizar(registro_id: int, datos: dict) -> None:
    """Actualiza los campos de la Pestaña 1. No modifica estado ni propietario."""
    with get_cursor() as cur:
        cur.execute(
            """
            UPDATE registros_intermediarios SET
                rui = %(rui)s, nit = %(nit)s, razon_social = %(razon_social)s,
                departamento_codigo = %(departamento_codigo)s, municipio_codigo = %(municipio_codigo)s,
                direccion = %(direccion)s, correo = %(correo)s, telefono_fijo = %(telefono_fijo)s
            WHERE id = %(id)s AND eliminado = FALSE
            """,
            {**datos, "id": registro_id},
        )


def eliminar_logico(registro_id: int) -> None:
    with get_cursor() as cur:
        cur.execute("UPDATE registros_intermediarios SET eliminado = TRUE WHERE id = %s", (registro_id,))


def cambiar_estado(registro_id: int, estado: str) -> None:
    """Cambio de estado sin decisión. Al volver a 'En revisión' se borra la decisión anterior."""
    limpiar = ", decision_comentario = NULL, decision_fecha = NULL, decision_usuario_id = NULL" if estado == "En revisión" else ""
    with get_cursor() as cur:
        cur.execute(f"UPDATE registros_intermediarios SET estado = %s{limpiar} WHERE id = %s", (estado, registro_id))


def registrar_decision(registro_id: int, estado: str, comentario: str | None, usuario_id: int) -> bool:
    """Aprueba o rechaza solo si el registro sigue 'En revisión' (evita carreras). Devuelve si se aplicó."""
    with get_cursor() as cur:
        cur.execute(
            """UPDATE registros_intermediarios
               SET estado = %s, decision_comentario = %s, decision_fecha = now(), decision_usuario_id = %s
               WHERE id = %s AND estado = 'En revisión' AND eliminado = FALSE RETURNING id""",
            (estado, comentario, usuario_id, registro_id),
        )
        return cur.fetchone() is not None
