from ..database import get_cursor

_CAMPOS = ("linea_1", "linea_2", "whatsapp", "enlace_web", "correo", "direccion_atencion")


def obtener(registro_id: int) -> dict:
    with get_cursor() as cur:
        cur.execute(f"SELECT {', '.join(_CAMPOS)} FROM infraestructura_operativa WHERE registro_id = %s", (registro_id,))
        datos = cur.fetchone() or {c: None for c in _CAMPOS}
        cur.execute(
            "SELECT tipo, nombre, descripcion, serie, ubicacion FROM items_tecnologia WHERE registro_id = %s ORDER BY id", (registro_id,)
        )
        items = cur.fetchall()
        cur.execute(
            "SELECT id, nombre_original, tamano_bytes FROM soportes_camara_comercio WHERE registro_id = %s ORDER BY id",
            (registro_id,),
        )
        soportes = cur.fetchall()
    datos["software"] = [{"nombre": i["nombre"], "descripcion": i["descripcion"]} for i in items if i["tipo"] == "software"]
    datos["equipos"] = [{"nombre": i["nombre"], "descripcion": i["descripcion"], "serie": i["serie"], "ubicacion": i["ubicacion"]}
                        for i in items if i["tipo"] == "equipo"]
    datos["soportes"] = soportes
    return datos


def obtener_soporte(registro_id: int, soporte_id: int) -> dict | None:
    with get_cursor() as cur:
        cur.execute(
            "SELECT id, nombre_original, ruta_archivo FROM soportes_camara_comercio WHERE id = %s AND registro_id = %s",
            (soporte_id, registro_id),
        )
        return cur.fetchone()


def sincronizar(registro_id: int, datos: dict, software: list[dict], equipos: list[dict],
                soportes_conservar: list[int], archivos_nuevos: list[dict]) -> list[str]:
    """Deja la pestaña exactamente como la envía la pantalla (una transacción). Devuelve rutas de archivos retirados."""
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO infraestructura_operativa
                (registro_id, linea_1, linea_2, whatsapp, enlace_web, correo, direccion_atencion)
            VALUES (%(registro_id)s, %(linea_1)s, %(linea_2)s, %(whatsapp)s, %(enlace_web)s, %(correo)s, %(direccion_atencion)s)
            ON CONFLICT (registro_id) DO UPDATE SET
                linea_1 = EXCLUDED.linea_1, linea_2 = EXCLUDED.linea_2, whatsapp = EXCLUDED.whatsapp,
                enlace_web = EXCLUDED.enlace_web, correo = EXCLUDED.correo, direccion_atencion = EXCLUDED.direccion_atencion,
                fecha_actualizacion = now()
            """,
            {**{c: datos[c] for c in _CAMPOS}, "registro_id": registro_id},
        )

        cur.execute("DELETE FROM items_tecnologia WHERE registro_id = %s", (registro_id,))
        for tipo, lista in (("software", software), ("equipo", equipos)):
            for it in lista:
                cur.execute(
                    "INSERT INTO items_tecnologia (registro_id, tipo, nombre, descripcion, serie, ubicacion) VALUES (%s, %s, %s, %s, %s, %s)",
                    (registro_id, tipo, it["nombre"], it["descripcion"],
                     it.get("serie") if tipo == "equipo" else None, it.get("ubicacion") if tipo == "equipo" else None),
                )

        cur.execute("SELECT id, ruta_archivo FROM soportes_camara_comercio WHERE registro_id = %s", (registro_id,))
        existentes = cur.fetchall()
        ids = {r["id"] for r in existentes}
        if not set(soportes_conservar) <= ids:
            raise ValueError("Uno de los soportes no pertenece a este registro")
        quitados = [r for r in existentes if r["id"] not in set(soportes_conservar)]
        if quitados:
            cur.execute("DELETE FROM soportes_camara_comercio WHERE id = ANY(%s)", ([r["id"] for r in quitados],))
        for a in archivos_nuevos:
            cur.execute(
                "INSERT INTO soportes_camara_comercio (registro_id, nombre_original, ruta_archivo, tamano_bytes) "
                "VALUES (%s, %s, %s, %s)",
                (registro_id, a["nombre_original"], a["ruta"], a["tamano"]),
            )
        cur.execute("UPDATE registros_intermediarios SET eliminado = eliminado WHERE id = %s", (registro_id,))
    return [r["ruta_archivo"] for r in quitados]
