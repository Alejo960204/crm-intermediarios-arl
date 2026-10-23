from fastapi import HTTPException, status

from ..repositories import diagnosticos_repository as repo
from ..schemas.diagnostico import FACTORES, PREGUNTAS_SGSST, DatosGenerales, DiagnosticoEntrada
from . import empresas_service


def _error_campo(codigo: int, campo: str, mensaje: str) -> HTTPException:
    return HTTPException(codigo, detail=[{"loc": ["body", campo], "msg": mensaje}])


# ---------- Reglas del diagnóstico automático (aprobadas por el cliente del proyecto) ----------
def calcular(d: dict) -> dict:
    """Calcula el resultado a partir de las respuestas (se recalcula siempre al leer; no se guarda)."""
    # SG-SST: cada «Sí» suma un punto (las 9 preguntas). Los umbrales de nivel están pendientes de definir
    # (el cliente indicó que se usará una fórmula más adelante), por eso este bloque no tiene nivel aún.
    puntos = sum(1 for k in PREGUNTAS_SGSST if d[k])
    faltantes = [PREGUNTAS_SGSST[k] for k in PREGUNTAS_SGSST if not d[k]]
    sgsst = {"nivel": None, "resumen": f"{puntos} de {len(PREGUNTAS_SGSST)} aspectos con respuesta «Sí». "
                                      "El nivel de cumplimiento se definirá con una fórmula (pendiente).",
             "hallazgos": [f"Respuesta «No»: {t}" for t in faltantes]}

    # Accidentalidad: Alta si hay AT mortales o con invalidez; Media si hay AT; Baja si no hubo.
    if d["at_mortales_invalidos"] > 0:
        nivel_at = "Alta"
    elif d["at_cantidad"] > 0:
        nivel_at = "Media"
    else:
        nivel_at = "Baja"
    h_at = []
    if d["at_cantidad"]:
        h_at.append(f"{d['at_cantidad']} accidente(s) de trabajo, con {d['at_dias_incapacidad']} día(s) de incapacidad.")
    if d["at_mortales_invalidos"]:
        h_at.append(f"{d['at_mortales_invalidos']} accidente(s) mortal(es) o con invalidez.")
    if d["at_causas"]:
        h_at.append(f"Causas: {d['at_causas']}")
    acc = {"nivel": nivel_at, "resumen": f"Nivel de accidentalidad: {nivel_at}.", "hallazgos": h_at}

    # Enfermedad laboral: Alta si hay calificadas; Media si hay en calificación; Baja si no hay casos.
    if d["el_calificadas"] > 0:
        nivel_el = "Alta"
    elif d["el_en_calificacion"] > 0:
        nivel_el = "Media"
    else:
        nivel_el = "Baja"
    h_el = []
    if d["el_calificadas"]:
        h_el.append(f"{d['el_calificadas']} trabajador(es) con enfermedad laboral calificada.")
    if d["el_en_calificacion"]:
        h_el.append(f"{d['el_en_calificacion']} trabajador(es) con enfermedad laboral en proceso de calificación.")
    if d["el_causas"]:
        h_el.append(f"Causas: {d['el_causas']}")
    if not d["programas_vigilancia"]:
        h_el.append("No cuenta con programas de vigilancia epidemiológica para los factores de riesgo más críticos.")
    enf = {"nivel": nivel_el, "resumen": f"Nivel de enfermedad laboral: {nivel_el}.", "hallazgos": h_el}

    # Factores de riesgo: se listan los que existen.
    fr = d.get("factores_riesgo") or {}
    existentes = [FACTORES[k] for k in FACTORES if (fr.get(k) or {}).get("existe")]
    detalle = [f"{FACTORES[k]}: {fr[k].get('descripcion') or 'sin descripción'}" for k in FACTORES
               if (fr.get(k) or {}).get("existe")]
    fact = {"nivel": None, "resumen": f"{len(existentes)} de {len(FACTORES)} factores de riesgo con fuentes identificadas.",
            "hallazgos": detalle}
    return {"sgsst": sgsst, "sgsst_puntos": puntos, "sgsst_total": len(PREGUNTAS_SGSST), "accidentalidad": acc,
            "enfermedad_laboral": enf, "factores_riesgo": fact, "factores_existentes": existentes}


# ---------- Acceso ----------
def _acceso(usuario: dict, empresa_id: int) -> dict:
    """root: cualquiera; cliente: sus empresas; empleado: empresas de sus procesos asignados (también edita)."""
    return empresas_service.obtener_para_usuario(usuario, empresa_id)


def listar(usuario: dict, empresa_id: int | None) -> list[dict]:
    filas = repo.listar_para_usuario(usuario, empresa_id)
    return [{**f, "creado_por": f["creado_por_nombre"], "empresa": f["empresa"], "nit": f["empresa_nit"],
             "sgsst_puntos": calcular(f)["sgsst_puntos"],
             "nivel_accidentalidad": calcular(f)["accidentalidad"]["nivel"],
             "nivel_enfermedad_laboral": calcular(f)["enfermedad_laboral"]["nivel"]} for f in filas]


def _detalle(f: dict) -> dict:
    f = dict(f)
    f["creado_por"] = f["creado_por_nombre"]
    f["resultado"] = calcular(f)
    return f


def obtener_para_usuario(usuario: dict, diagnostico_id: int) -> dict:
    f = repo.obtener(diagnostico_id)
    if not f:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Diagnóstico no encontrado")
    _acceso(usuario, f["empresa_id"])  # 404 si no tiene acceso a la empresa
    return _detalle(f)


def precarga(usuario: dict, empresa_id: int) -> dict:
    e = _acceso(usuario, empresa_id)
    num = lambda v: None if v is None else str(v)  # noqa: E731
    dg = DatosGenerales(
        nombre_empresa=e["nombre"], nit=e["nit"], direccion=e["direccion"], telefono_fijo=e["telefono_fijo"],
        celular=e["celular"], ciudad=repo.nombre_municipio(e["municipio_codigo"]),
        contacto_nombre=e["contacto_nombre"], contacto_cargo=e["contacto_cargo"],
        responsable_sgsst_nombre=e["responsable_sgsst_nombre"], responsable_sgsst_cargo=e["responsable_sgsst_cargo"],
        gerente=e["gerente"], actividad_economica=e["actividad_economica"],
        trabajadores_directos=num(e["trabajadores_directos"]),
        contratistas_independientes=num(e["contratistas_independientes"]),
        estudiantes_decreto_055=num(e["estudiantes_decreto_055"]), tasa_cotizacion=num(e["tasa_cotizacion"]),
        arl_actual=e["arl_actual"], tiempo_afiliacion_arl=e["tiempo_afiliacion_arl"],
        valor_cotizacion_arl=num(e["valor_cotizacion_arl"]))
    # El intermediario se elige entre los registros (Formulario Único) del cliente dueño de la empresa
    return {"empresa_id": e["id"], "empresa": e["nombre"], "datos_generales": dg,
            "intermediarios": repo.registros_del_usuario(e["usuario_id"])}


def _intermediario(empresa: dict, registro_id: int | None) -> dict | None:
    if registro_id is None:
        return None
    for r in repo.registros_del_usuario(empresa["usuario_id"]):
        if r["id"] == registro_id:
            return r
    raise _error_campo(422, "registro_id", "Seleccione un registro de intermediario válido")


def _datos(d: DiagnosticoEntrada) -> dict:
    datos = d.model_dump(mode="json")
    datos["fecha_diagnostico"] = d.fecha_diagnostico
    return datos


def crear(usuario: dict, d: DiagnosticoEntrada) -> dict:
    if d.empresa_id is None:
        raise _error_campo(422, "empresa_id", "Seleccione la empresa")
    try:
        empresa = _acceso(usuario, d.empresa_id)
    except HTTPException:
        raise _error_campo(422, "empresa_id", "Seleccione una empresa válida")
    nuevo = repo.crear(d.empresa_id, usuario["id"], _datos(d), _intermediario(empresa, d.registro_id))
    return obtener_para_usuario(usuario, nuevo)


def actualizar(usuario: dict, diagnostico_id: int, d: DiagnosticoEntrada) -> dict:
    actual = obtener_para_usuario(usuario, diagnostico_id)
    empresa = _acceso(usuario, actual["empresa_id"])
    repo.actualizar(diagnostico_id, _datos(d), _intermediario(empresa, d.registro_id))
    return obtener_para_usuario(usuario, diagnostico_id)
