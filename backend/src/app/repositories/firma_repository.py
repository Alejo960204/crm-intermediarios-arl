from ..database import get_cursor


def obtener(registro_id: int) -> dict:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT nombres_apellidos, tipo_documento, numero_documento,
                   firma_ruta, firma_nombre, firma_tipo, firma_tamano_bytes
            FROM firmas_representante WHERE registro_id = %s
            """,
            (registro_id,),
        )
        f = cur.fetchone()
    if not f:
        return {"nombres_apellidos": None, "tipo_documento": None, "numero_documento": None, "firma": None}
    firma = None
    if f["firma_ruta"]:
        firma = {"nombre_original": f["firma_nombre"], "tipo": f["firma_tipo"], "tamano_bytes": f["firma_tamano_bytes"]}
    return {"nombres_apellidos": f["nombres_apellidos"], "tipo_documento": f["tipo_documento"],
            "numero_documento": f["numero_documento"], "firma": firma}


def obtener_ruta_firma(registro_id: int) -> dict | None:
    with get_cursor() as cur:
        cur.execute(
            "SELECT firma_ruta, firma_nombre, firma_tipo FROM firmas_representante "
            "WHERE registro_id = %s AND firma_ruta IS NOT NULL", (registro_id,),
        )
        return cur.fetchone()


def sincronizar(registro_id: int, datos: dict, quitar: bool, nueva: dict | None) -> list[str]:
    """Guarda los datos y reemplaza/quita la firma (una transacción). Devuelve rutas de archivos retirados."""
    with get_cursor() as cur:
        cur.execute("SELECT firma_ruta FROM firmas_representante WHERE registro_id = %s", (registro_id,))
        previa = cur.fetchone()
        ruta_previa = previa["firma_ruta"] if previa else None

        cur.execute(
            """
            INSERT INTO firmas_representante (registro_id, nombres_apellidos, tipo_documento, numero_documento)
            VALUES (%(registro_id)s, %(nombres_apellidos)s, %(tipo_documento)s, %(numero_documento)s)
            ON CONFLICT (registro_id) DO UPDATE SET
                nombres_apellidos = EXCLUDED.nombres_apellidos, tipo_documento = EXCLUDED.tipo_documento,
                numero_documento = EXCLUDED.numero_documento, fecha_actualizacion = now()
            """,
            {**datos, "registro_id": registro_id},
        )
        retiradas: list[str] = []
        if nueva:
            cur.execute(
                "UPDATE firmas_representante SET firma_ruta = %s, firma_nombre = %s, firma_tipo = %s, "
                "firma_tamano_bytes = %s WHERE registro_id = %s",
                (nueva["ruta"], nueva["nombre_original"], nueva["tipo"], nueva["tamano"], registro_id),
            )
            if ruta_previa:
                retiradas.append(ruta_previa)
        elif quitar and ruta_previa:
            cur.execute(
                "UPDATE firmas_representante SET firma_ruta = NULL, firma_nombre = NULL, firma_tipo = NULL, "
                "firma_tamano_bytes = NULL WHERE registro_id = %s", (registro_id,),
            )
            retiradas.append(ruta_previa)
        cur.execute("UPDATE registros_intermediarios SET eliminado = eliminado WHERE id = %s", (registro_id,))
    return retiradas
