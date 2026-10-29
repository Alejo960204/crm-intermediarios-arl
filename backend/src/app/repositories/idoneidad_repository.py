from ..database import get_cursor


def listar(registro_id: int) -> list[dict]:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, nombres_apellidos, tipo_documento, numero_documento, cargo, nivel_educativo, descripcion_nivel_educativo,
                   correo, telefono
            FROM personas_idoneidad WHERE registro_id = %s ORDER BY id
            """,
            (registro_id,),
        )
        personas = cur.fetchall()
        cur.execute(
            """
            SELECT s.id, s.persona_id, s.nombre_original, s.tamano_bytes
            FROM soportes_idoneidad s JOIN personas_idoneidad p ON p.id = s.persona_id
            WHERE p.registro_id = %s ORDER BY s.id
            """,
            (registro_id,),
        )
        soportes = cur.fetchall()
    por_persona: dict[int, list[dict]] = {}
    for s in soportes:
        por_persona.setdefault(s["persona_id"], []).append(
            {"id": s["id"], "nombre_original": s["nombre_original"], "tamano_bytes": s["tamano_bytes"]}
        )
    for p in personas:
        p["soportes"] = por_persona.get(p["id"], [])
    return personas


def obtener_soporte(registro_id: int, soporte_id: int) -> dict | None:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT s.id, s.nombre_original, s.ruta_archivo
            FROM soportes_idoneidad s JOIN personas_idoneidad p ON p.id = s.persona_id
            WHERE s.id = %s AND p.registro_id = %s
            """,
            (soporte_id, registro_id),
        )
        return cur.fetchone()


def sincronizar(registro_id: int, personas: list[dict], archivos_nuevos: dict[str, list[dict]]) -> list[str]:
    """Deja la tabla de personas y soportes del registro exactamente como la envía la pantalla.

    Todo ocurre en una sola transacción. Devuelve las rutas de archivos que ya no se usan
    (para borrarlas del disco después del commit). Lanza ValueError si un id no pertenece al registro.
    """
    rutas_eliminadas: list[str] = []
    with get_cursor() as cur:
        cur.execute("SELECT id FROM personas_idoneidad WHERE registro_id = %s", (registro_id,))
        existentes = {r["id"] for r in cur.fetchall()}
        enviados = {p["id"] for p in personas if p["id"] is not None}
        if not enviados <= existentes:
            raise ValueError("Una de las personas no pertenece a este registro")

        # Personas quitadas en pantalla
        for persona_id in existentes - enviados:
            cur.execute("SELECT ruta_archivo FROM soportes_idoneidad WHERE persona_id = %s", (persona_id,))
            rutas_eliminadas += [r["ruta_archivo"] for r in cur.fetchall()]
            cur.execute("DELETE FROM personas_idoneidad WHERE id = %s", (persona_id,))  # cascada a soportes

        for p in personas:
            campos = {k: p[k] for k in ("nombres_apellidos", "tipo_documento", "numero_documento", "cargo", "nivel_educativo",
                                      "descripcion_nivel_educativo", "correo", "telefono")}
            if p["id"] is None:
                cur.execute(
                    """
                    INSERT INTO personas_idoneidad
                        (registro_id, nombres_apellidos, tipo_documento, numero_documento, cargo, nivel_educativo,
                         descripcion_nivel_educativo, correo, telefono)
                    VALUES (%(registro_id)s, %(nombres_apellidos)s, %(tipo_documento)s, %(numero_documento)s,
                            %(cargo)s, %(nivel_educativo)s, %(descripcion_nivel_educativo)s, %(correo)s, %(telefono)s) RETURNING id
                    """,
                    {**campos, "registro_id": registro_id},
                )
                persona_id = cur.fetchone()["id"]
            else:
                persona_id = p["id"]
                cur.execute(
                    """
                    UPDATE personas_idoneidad SET nombres_apellidos = %(nombres_apellidos)s,
                        tipo_documento = %(tipo_documento)s, numero_documento = %(numero_documento)s,
                        cargo = %(cargo)s, nivel_educativo = %(nivel_educativo)s,
                        descripcion_nivel_educativo = %(descripcion_nivel_educativo)s, correo = %(correo)s, telefono = %(telefono)s
                    WHERE id = %(id)s
                    """,
                    {**campos, "id": persona_id},
                )
                # Soportes que el usuario quitó de esta persona
                conservar = p["soportes_conservar"] or [0]
                cur.execute(
                    "SELECT id, ruta_archivo FROM soportes_idoneidad WHERE persona_id = %s AND id <> ALL(%s)",
                    (persona_id, conservar),
                )
                quitados = cur.fetchall()
                rutas_eliminadas += [r["ruta_archivo"] for r in quitados]
                if quitados:
                    cur.execute("DELETE FROM soportes_idoneidad WHERE id = ANY(%s)", ([r["id"] for r in quitados],))

            for a in archivos_nuevos.get(p["clave"], []):
                cur.execute(
                    "INSERT INTO soportes_idoneidad (persona_id, nombre_original, ruta_archivo, tamano_bytes) "
                    "VALUES (%s, %s, %s, %s)",
                    (persona_id, a["nombre_original"], a["ruta"], a["tamano"]),
                )

        # Marca el registro como modificado (dispara fecha_actualizacion)
        cur.execute("UPDATE registros_intermediarios SET eliminado = eliminado WHERE id = %s", (registro_id,))
    return rutas_eliminadas
