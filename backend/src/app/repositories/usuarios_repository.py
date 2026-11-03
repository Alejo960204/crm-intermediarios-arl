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
    (SELECT e.nombre FROM empresas e WHERE e.id = u.empresa_id) AS empresa_nombre
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


def crear(nombre: str, email: str, password_hash: str, rol: str) -> int:
    with get_cursor() as cur:
        cur.execute("INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (%s,%s,%s,%s) RETURNING id",
                    (nombre, email, password_hash, rol))
        return cur.fetchone()["id"]


def crear_de_empresa(nombre: str, email: str, password_hash: str, rol: str, empresa_id: int) -> int:
    """Usuario «empresa» (login de la empresa) o «empleado» de esa empresa."""
    with get_cursor() as cur:
        cur.execute("INSERT INTO usuarios (nombre, email, password_hash, rol, empresa_id) VALUES (%s,%s,%s,%s,%s) RETURNING id",
                    (nombre, email, password_hash, rol, empresa_id))
        return cur.fetchone()["id"]


def listar_empleados(empresa_id: int) -> list[dict]:
    with get_cursor() as cur:
        cur.execute("SELECT id, nombre, email, activo, fecha_creacion FROM usuarios WHERE empresa_id = %s AND rol = 'empleado' "
                    "ORDER BY fecha_creacion DESC, id DESC", (empresa_id,))
        return cur.fetchall()


def contar_intermediarios_activos() -> int:
    with get_cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM usuarios WHERE rol = 'intermediario' AND activo = TRUE")
        return cur.fetchone()["n"]


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


def cambiar_password(usuario_id: int, password_hash: str) -> None:
    with get_cursor() as cur:
        cur.execute("UPDATE usuarios SET password_hash = %s WHERE id = %s", (password_hash, usuario_id))


def registrar_consentimiento(usuario_id: int, version: str, ip: str | None) -> None:
    with get_cursor() as cur:
        cur.execute("INSERT INTO consentimientos_datos (usuario_id, version, ip) VALUES (%s, %s, %s)",
                    (usuario_id, version, ip))
