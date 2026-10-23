from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .schemas.diagnostico import PREGUNTAS_SGSST

_ETIQUETAS_DG = [
    ("nombre_empresa", "Empresa"), ("nit", "NIT"), ("direccion", "Dirección principal"),
    ("telefono_fijo", "Teléfono fijo"), ("celular", "Celular"), ("ciudad", "Ciudad / Municipio"),
    ("contacto_nombre", "Persona que suministra la información"), ("contacto_cargo", "Cargo"),
    ("responsable_sgsst_nombre", "Responsable de SG-SST"), ("responsable_sgsst_cargo", "Cargo del responsable"),
    ("gerente", "Gerente"), ("actividad_economica", "Actividad económica principal"),
    ("trabajadores_directos", "Trabajadores directos"), ("contratistas_independientes", "Contratistas independientes"),
    ("estudiantes_decreto_055", "Estudiantes (Decreto 055/2015)"), ("tasa_cotizacion", "Tasa de cotización"),
    ("arl_actual", "ARL actual"), ("tiempo_afiliacion_arl", "Tiempo de afiliación a la ARL actual"),
    ("valor_cotizacion_arl", "Valor de la cotización actual"),
]


def generar(d: dict) -> bytes:
    """PDF del diagnóstico. `d` es el detalle con el resultado ya calculado."""
    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Title"], fontSize=16, spaceAfter=4)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], fontSize=12, spaceBefore=10, spaceAfter=4, textColor=colors.HexColor("#1d4ed8"))
    n = ParagraphStyle("n", parent=ss["BodyText"], fontSize=9, leading=12)
    p = lambda t, s=n: Paragraph(escape(str(t)), s)  # noqa: E731
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=1.8 * cm,
                            bottomMargin=1.8 * cm, title=f"Diagnóstico ARL - {d['empresa']}")
    r = d["resultado"]
    el = [p("Diagnóstico del proceso de afiliación a la ARL", h1),
          p(f"{d['empresa']} · NIT {d['empresa_nit']} · Fecha del diagnóstico: {d['fecha_diagnostico'].strftime('%d/%m/%Y')}"),
          Spacer(1, 6)]

    el.append(p("Resultado por bloque", h2))
    filas = [["Bloque", "Resultado"],
             ["SG-SST", f"{r['sgsst_puntos']} de {r['sgsst_total']} en «Sí» (nivel pendiente de definir)"],
             ["Accidentalidad", f"Nivel {r['accidentalidad']['nivel']}"],
             ["Enfermedad laboral", f"Nivel {r['enfermedad_laboral']['nivel']}"],
             ["Factores de riesgo", r["factores_riesgo"]["resumen"]]]
    t = Table([[p(c) for c in f] for f in filas], colWidths=[4 * cm, 13 * cm])
    t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.4, colors.grey), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                           ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    el.append(t)

    for titulo, clave in (("Hallazgos SG-SST", "sgsst"), ("Hallazgos de accidentalidad", "accidentalidad"),
                          ("Hallazgos de enfermedad laboral", "enfermedad_laboral"),
                          ("Factores de riesgo identificados", "factores_riesgo")):
        el.append(p(titulo, h2))
        hall = r[clave]["hallazgos"]
        el.extend([p("• " + h) for h in hall] or [p("Sin hallazgos.")])

    el.append(p("Respuestas SG-SST", h2))
    sg = [[p(PREGUNTAS_SGSST[k]), p("Sí" if d[k] else "No")] for k in PREGUNTAS_SGSST]
    t = Table(sg, colWidths=[14 * cm, 3 * cm])
    t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.4, colors.grey), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    el.append(t)
    if d.get("viajes_detalle"):
        el.append(p(f"Viajes al exterior (cuántos y periodicidad): {d['viajes_detalle']}"))

    el.append(p("Datos generales", h2))
    dg = d["datos_generales"]
    t = Table([[p(e), p(dg.get(k) or "—")] for k, e in _ETIQUETAS_DG], colWidths=[7 * cm, 10 * cm])
    t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.4, colors.lightgrey), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    el.append(t)

    if d.get("expectativas"):
        el += [p("Expectativas al trasladarse a la ARL", h2), p(d["expectativas"])]
    if d.get("observaciones"):
        el += [p("Observaciones importantes para la oferta por sector económico", h2), p(d["observaciones"])]

    el.append(p("Intermediario", h2))
    el.append(p(f"Nombre: {d.get('intermediario_nombre') or '—'} · RUI: {d.get('intermediario_rui') or '—'} · "
                f"NIT: {d.get('intermediario_nit') or '—'}"))
    doc.build(el)
    return buf.getvalue()
