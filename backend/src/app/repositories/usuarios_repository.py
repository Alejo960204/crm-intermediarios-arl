from ..database import get_cursor


def obtener_por_email(email: str) -> dict | None:
    with get_cursor() as cur:
        cur.execute("SELECT * FROM usuarios WHERE lower(email) = lower(%s)", (email,))
        return cur.fetchone()


def obtener_por_id(usuario_id: int) -> dict | None:
    with get_cursor() as cur:
        cur.execute("SELECT * FROM usuarios WHERE id = %s", (usuario_id,))
        return cur.fetchone()


_DATOS = """
    (SELECT count(*) FROM empresas e WHERE e.usuario_id = u.id AND e.eliminado = FALSE) AS empresas,
    (SELECT count(*) FROM registros_intermediarios r WHERE r.usuario_id = u.id AND r.eliminado = FALSE) AS registros,
    (SELECT count(*) FROM procesos_afiliacion p WHERE p.empleado_id = u.id) AS procesos_asignados
"""


def listar() -> list[dict]:
    with get_cursor() as cur:
        cur.execute(f"SELECT u.id, u.nombre, u.email, u.rol, u.activo, u.fecha_creacion, {_DATOS} FROM usuarios u "
                    "ORDER BY u.fecha_creacion DESC, u.id DESC")
        return cur.fetchall()


def obtener_con_datos(usuario_id: int) -> dict | None:
    with get_cursor() as cur:
        cur.execute(f"SELECT u.id, u.nombre, u.email, u.rol, u.activo, u.fecha_creacion, {_DATOS} FROM usuarios u WHERE u.id = %s",
                    (usuario_id,))
        return cur.fetchone()


def cambiar_rol(usuario_id: int, rol: str) -> None:
    with get_cursor() as cur:
        cur.execute("UPDATE usuarios SET rol = %s WHERE id = %s", (rol, usuario_id))


def cambiar_activo(usuario_id: int, activo: bool) -> None:
    with get_cursor() as cur:
        cur.execute("UPDATE usuarios SET activo = %s WHERE id = %s", (activo, usuario_id))


def correos_existentes() -> set[str]:
    with get_cursor() as cur:
        cur.execute("SELECT lower(email) AS email FROM usuarios")
        return {r["email"] for r in cur.fetchall()}


def crear_varios(usuarios: list[dict]) -> set[str]:
    """Inserta (nombre, email, password_hash, rol) en una transacción. Devuelve los correos realmente creados;
    si alguno apareció entre tanto (carrera), se omite sin error."""
    creados: set[str] = set()
    with get_cursor() as cur:
        for u in usuarios:
            cur.execute(
                "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (%s, %s, %s, %s) "
                "ON CONFLICT (email) DO NOTHING RETURNING email",
                (u["nombre"], u["email"], u["password_hash"], u["rol"]),
            )
            if cur.fetchone():
                creados.add(u["email"])
    return creados
