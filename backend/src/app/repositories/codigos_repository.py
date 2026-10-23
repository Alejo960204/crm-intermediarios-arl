from ..database import get_cursor


def limpiar_antiguos() -> None:
    with get_cursor() as cur:
        cur.execute("DELETE FROM codigos_acceso WHERE fecha_creacion < now() - interval '1 day'")


def crear(usuario_id: int, codigo_hash: str, minutos: int) -> int:
    with get_cursor() as cur:
        cur.execute("UPDATE codigos_acceso SET usado = TRUE WHERE usuario_id = %s AND NOT usado", (usuario_id,))
        cur.execute(
            "INSERT INTO codigos_acceso (usuario_id, codigo_hash, expira_en) "
            "VALUES (%s, %s, now() + make_interval(mins => %s)) RETURNING id",
            (usuario_id, codigo_hash, minutos),
        )
        return cur.fetchone()["id"]


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
