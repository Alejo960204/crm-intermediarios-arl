from ..database import get_cursor


def registrar(filas: list[dict]) -> None:
    """Inserta varias filas del historial en una transacción. Cada fila: empresa_id, usuario_id, rol_usuario,
    categoria, accion y, opcionalmente, campo, valor_anterior, valor_nuevo, detalle."""
    if not filas:
        return
    with get_cursor() as cur:
        for f in filas:
            cur.execute(
                """INSERT INTO empresa_historial (empresa_id, usuario_id, rol_usuario, categoria, accion, campo,
                                                  valor_anterior, valor_nuevo, detalle)
                   VALUES (%(empresa_id)s, %(usuario_id)s, %(rol_usuario)s, %(categoria)s, %(accion)s, %(campo)s,
                           %(valor_anterior)s, %(valor_nuevo)s, %(detalle)s)""",
                {"campo": None, "valor_anterior": None, "valor_nuevo": None, "detalle": None, **f})


def listar(empresa_id: int, limite: int = 1000) -> list[dict]:
    with get_cursor() as cur:
        cur.execute(
            """SELECT h.id, h.fecha, u.nombre AS usuario, h.rol_usuario AS rol, h.categoria, h.accion, h.campo,
                      h.valor_anterior, h.valor_nuevo, h.detalle
               FROM empresa_historial h JOIN usuarios u ON u.id = h.usuario_id
               WHERE h.empresa_id = %s ORDER BY h.fecha DESC, h.id DESC LIMIT %s""", (empresa_id, limite))
        return cur.fetchall()
