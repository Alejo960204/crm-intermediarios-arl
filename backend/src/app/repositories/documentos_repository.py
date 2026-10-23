from ..database import get_cursor


def listar(empresa_id: int | None, proceso_id: int | None, seccion: str | None = None) -> list[dict]:
    """seccion=None: documentos por tipo (14A); con seccion: documentos de esa sección (Req 15)."""
    col, valor = ("empresa_id", empresa_id) if empresa_id is not None else ("proceso_id", proceso_id)
    with get_cursor() as cur:
        cur.execute(f"SELECT * FROM documentos WHERE {col} = %s AND eliminado = FALSE AND seccion IS NOT DISTINCT FROM %s "
                    "ORDER BY fecha_creacion DESC, id DESC", (valor, seccion))
        docs = cur.fetchall()
        for d in docs:
            d["versiones"] = _versiones(cur, d["id"])
        return docs


def _versiones(cur, documento_id: int) -> list[dict]:
    cur.execute(
        """SELECT v.version, v.nombre_original, v.tamano_bytes, v.content_type, v.ruta, u.nombre AS subido_por, v.fecha
           FROM documentos_versiones v JOIN usuarios u ON u.id = v.subido_por
           WHERE v.documento_id = %s ORDER BY v.version DESC""", (documento_id,))
    return cur.fetchall()


def obtener(documento_id: int) -> dict | None:
    with get_cursor() as cur:
        cur.execute("SELECT * FROM documentos WHERE id = %s AND eliminado = FALSE", (documento_id,))
        d = cur.fetchone()
        if d:
            d["versiones"] = _versiones(cur, documento_id)
        return d


def crear(empresa_id: int | None, proceso_id: int | None, tipo: str | None, descripcion: str | None, usuario_id: int,
          version: dict, seccion: str | None = None, titulo: str | None = None) -> int:
    with get_cursor() as cur:
        cur.execute(
            "INSERT INTO documentos (empresa_id, proceso_id, tipo, descripcion, creado_por, seccion, titulo) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (empresa_id, proceso_id, tipo, descripcion, usuario_id, seccion, titulo))
        did = cur.fetchone()["id"]
        _insertar_version(cur, did, 1, version, usuario_id)
        return did


def agregar_version(documento_id: int, version: dict, usuario_id: int) -> int:
    """Nueva versión: el número se calcula en la misma transacción (bloqueando el documento) para evitar duplicados."""
    with get_cursor() as cur:
        cur.execute("SELECT id FROM documentos WHERE id = %s FOR UPDATE", (documento_id,))
        cur.execute("SELECT COALESCE(MAX(version), 0) + 1 AS n FROM documentos_versiones WHERE documento_id = %s", (documento_id,))
        n = cur.fetchone()["n"]
        _insertar_version(cur, documento_id, n, version, usuario_id)
        return n


def _insertar_version(cur, documento_id: int, n: int, v: dict, usuario_id: int) -> None:
    cur.execute(
        """INSERT INTO documentos_versiones (documento_id, version, nombre_original, ruta, content_type, tamano_bytes, subido_por)
           VALUES (%s,%s,%s,%s,%s,%s,%s)""",
        (documento_id, n, v["nombre_original"], v["ruta"], v["content_type"], v["tamano_bytes"], usuario_id))


def eliminar_logico(documento_id: int) -> None:
    with get_cursor() as cur:
        cur.execute("UPDATE documentos SET eliminado = TRUE WHERE id = %s", (documento_id,))
