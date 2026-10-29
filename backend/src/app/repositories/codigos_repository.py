from ..database import get_cursor


def limpiar_antiguos() -> None:
    with get_cursor() as cur:
        cur.execute("DELETE FROM codigos_acceso WHERE fecha_creacion < now() - interval '1 day'")


def crear(usuario_id: int, codigo_hash: str, minutos: int, proposito: str = "login") -> int:
    with get_cursor() as cur:
        cur.execute("UPDATE codigos_acceso SET usado = TRUE WHERE usuario_id = %s AND proposito = %s AND NOT usado",
                    (usuario_id, proposito))
        cur.execute(
            "INSERT INTO codigos_acceso (usuario_id, codigo_hash, expira_en, proposito) "
            "VALUES (%s, %s, now() + make_interval(mins => %s), %s) RETURNING id",
            (usuario_id, codigo_hash, minutos, proposito),
        )
        return cur.fetchone()["id"]


def ultimo_recuperacion(usuario_id: int) -> dict | None:
    """Código de recuperación más reciente aún sin usar (con vencimiento y segundos desde su envío)."""
    with get_cursor() as cur:
        cur.execute(
            "SELECT *, expira_en < now() AS vencido, EXTRACT(EPOCH FROM (now() - enviado_en)) AS segundos_desde_envio "
            "FROM codigos_acceso WHERE usuario_id = %s AND proposito = 'recuperacion' AND NOT usado "
            "ORDER BY id DESC LIMIT 1", (usuario_id,))
        return cur.fetchone()


def recuperaciones_ultima_hora(usuario_id: int) -> int:
    with get_cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM codigos_acceso WHERE usuario_id = %s AND proposito = 'recuperacion' "
                    "AND fecha_creacion > now() - interval '1 hour'", (usuario_id,))
        return cur.fetchone()["n"]


def invalidar_todos(usuario_id: int) -> None:
    with get_cursor() as cur:
        cur.execute("UPDATE codigos_acceso SET usado = TRUE WHERE usuario_id = %s AND NOT usado", (usuario_id,))


def obtener(codigo_id: int) -> dict | None:
    with get_cursor() as cur:
        cur.execute(
            "SELECT *, expira_en < now() AS vencido, EXTRACT(EPOCH FROM (now() - enviado_en)) AS segundos_desde_envio "
            "FROM codigos_acceso WHERE id = %s", (codigo_id,),
        )
        return cur.fetchone()


def sumar_intento(codigo_id: int) -> None:
    with get_cursor() as cur:
        cur.execute("UPDATE codigos_acceso SET intentos = intentos + 1 WHERE id = %s", (codigo_id,))


def marcar_usado(codigo_id: int) -> None:
    with get_cursor() as cur:
        cur.execute("UPDATE codigos_acceso SET usado = TRUE WHERE id = %s", (codigo_id,))


def renovar(codigo_id: int, codigo_hash: str, minutos: int) -> None:
    with get_cursor() as cur:
        cur.execute(
            "UPDATE codigos_acceso SET codigo_hash = %s, intentos = 0, reenvios = reenvios + 1, enviado_en = now(), "
            "expira_en = now() + make_interval(mins => %s) WHERE id = %s",
            (codigo_hash, minutos, codigo_id),
        )
