from ..database import get_cursor

_CAMPOS_RESP = ("nombres_apellidos", "tipo_documento", "numero_documento", "cargo", "correo", "telefono")


def obtener(registro_id: int) -> dict:
    with get_cursor() as cur:
        cur.execute(
            f"SELECT {', '.join(_CAMPOS_RESP)} FROM responsables_humana WHERE registro_id = %s", (registro_id,)
        )
        responsable = cur.fetchone() or {c: None for c in _CAMPOS_RESP}
        cur.execute(
            """
            SELECT id, empresa, cargo, fecha_inicio, fecha_fin, cargo_actual, funciones
            FROM experiencias_humana WHERE registro_id = %s ORDER BY id
            """,
            (registro_id,),
        )
        experiencias = cur.fetchall()
        cur.execute(
            """
            SELECT s.id, s.experiencia_id, s.nombre_original, s.tamano_bytes
            FROM soportes_experiencia s JOIN experiencias_humana e ON e.id = s.experiencia_id
            WHERE e.registro_id = %s ORDER BY s.id
            """,
            (registro_id,),
        )
        soportes = cur.fetchall()
    por_exp: dict[int, list[dict]] = {}
    for s in soportes:
        por_exp.setdefault(s["experiencia_id"], []).append(
            {"id": s["id"], "nombre_original": s["nombre_original"], "tamano_bytes": s["tamano_bytes"]}
        )
    for e in experiencias:
        e["soportes"] = por_exp.get(e["id"], [])
    return {"responsable": responsable, "experiencias": experiencias}


def obtener_soporte(registro_id: int, soporte_id: int) -> dict | None:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT s.id, s.nombre_original, s.ruta_archivo
            FROM soportes_experiencia s JOIN experiencias_humana e ON e.id = s.experiencia_id
            WHERE s.id = %s AND e.registro_id = %s
            """,
            (soporte_id, registro_id),
        )
        return cur.fetchone()


def sincronizar(registro_id: int, responsable: dict, experiencias: list[dict],
                archivos_nuevos: dict[str, list[dict]]) -> list[str]:
    """Deja responsable, experiencias y soportes exactamente como los envía la pantalla (una transacción).

    Devuelve las rutas de archivos que ya no se usan. Lanza ValueError si un id no pertenece al registro.
    """
    rutas_eliminadas: list[str] = []
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO responsables_humana
                (registro_id, nombres_apellidos, tipo_documento, numero_documento, cargo, correo, telefono)
            VALUES (%(registro_id)s, %(nombres_apellidos)s, %(tipo_documento)s, %(numero_documento)s,
                    %(cargo)s, %(correo)s, %(telefono)s)
            ON CONFLICT (registro_id) DO UPDATE SET
                nombres_apellidos = EXCLUDED.nombres_apellidos, tipo_documento = EXCLUDED.tipo_documento,
                numero_documento = EXCLUDED.numero_documento, cargo = EXCLUDED.cargo,
                correo = EXCLUDED.correo, telefono = EXCLUDED.telefono, fecha_actualizacion = now()
            """,
            {**responsable, "registro_id": registro_id},
        )

        cur.execute("SELECT id FROM experiencias_humana WHERE registro_id = %s", (registro_id,))
        existentes = {r["id"] for r in cur.fetchall()}
        enviadas = {e["id"] for e in experiencias if e["id"] is not None}
        if not enviadas <= existentes:
            raise ValueError("Una de las experiencias no pertenece a este registro")

        for exp_id in existentes - enviadas:  # quitadas en pantalla
            cur.execute("SELECT ruta_archivo FROM soportes_experiencia WHERE experiencia_id = %s", (exp_id,))
            rutas_eliminadas += [r["ruta_archivo"] for r in cur.fetchall()]
            cur.execute("DELETE FROM experiencias_humana WHERE id = %s", (exp_id,))  # cascada a soportes

        for e in experiencias:
            campos = {k: e[k] for k in ("empresa", "cargo", "fecha_inicio", "fecha_fin", "cargo_actual", "funciones")}
            if e["id"] is None:
                cur.execute(
                    """
                    INSERT INTO experiencias_humana (registro_id, empresa, cargo, fecha_inicio, fecha_fin, cargo_actual, funciones)
                    VALUES (%(registro_id)s, %(empresa)s, %(cargo)s, %(fecha_inicio)s, %(fecha_fin)s,
                            %(cargo_actual)s, %(funciones)s)
                    RETURNING id
                    """,
                    {**campos, "registro_id": registro_id},
                )
                exp_id = cur.fetchone()["id"]
            else:
                exp_id = e["id"]
                cur.execute(
                    """
                    UPDATE experiencias_humana SET empresa = %(empresa)s, cargo = %(cargo)s,
                        fecha_inicio = %(fecha_inicio)s, fecha_fin = %(fecha_fin)s,
                        cargo_actual = %(cargo_actual)s, funciones = %(funciones)s
                    WHERE id = %(id)s
                    """,
                    {**campos, "id": exp_id},
                )
                conservar = e["soportes_conservar"] or [0]
                cur.execute(
                    "SELECT id, ruta_archivo FROM soportes_experiencia WHERE experiencia_id = %s AND id <> ALL(%s)",
                    (exp_id, conservar),
                )
                quitados = cur.fetchall()
                rutas_eliminadas += [r["ruta_archivo"] for r in quitados]
                if quitados:
                    cur.execute("DELETE FROM soportes_experiencia WHERE id = ANY(%s)", ([r["id"] for r in quitados],))

            for a in archivos_nuevos.get(e["clave"], []):
                cur.execute(
                    "INSERT INTO soportes_experiencia (experiencia_id, nombre_original, ruta_archivo, tamano_bytes) "
                    "VALUES (%s, %s, %s, %s)",
                    (exp_id, a["nombre_original"], a["ruta"], a["tamano"]),
                )

        cur.execute("UPDATE registros_intermediarios SET eliminado = eliminado WHERE id = %s", (registro_id,))
    return rutas_eliminadas
