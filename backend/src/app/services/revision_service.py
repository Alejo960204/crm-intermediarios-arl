"""Verifica que el formulario esté completo para enviarlo a revisión (Requerimiento 7)."""
from ..repositories import firma_repository, humana_repository, idoneidad_repository, operativa_repository

PESTANAS = ["1. Información General", "2. Competencia Profesional", "3. Talento Humano",
            "4. Infraestructura Operativa", "5. Firma Digitalizada"]


def _vacio(v) -> bool:
    return v is None or (isinstance(v, str) and not v.strip())


def _revisar(valores: dict, requeridos: list[tuple[str, str, str]], prefijo: str = "") -> list[dict]:
    """requeridos: (clave en 'valores', etiqueta visible, nombre del campo en pantalla)."""
    return [
        {"campo": f"{prefijo}{campo}", "etiqueta": etiqueta, "mensaje": f"{etiqueta}: campo obligatorio"}
        for clave, etiqueta, campo in requeridos if _vacio(valores.get(clave))
    ]


def faltantes(registro: dict) -> list[dict]:
    """Devuelve [{pestana, nombre, campos:[{campo, etiqueta, mensaje}]}] solo con las pestañas incompletas."""
    rid = registro["id"]
    por_pestana: dict[int, list[dict]] = {}

    por_pestana[0] = _revisar(registro, [
        ("razon_social", "Razón social", "razon_social"),
        ("departamento_codigo", "Departamento", "departamento_codigo"),
        ("municipio_codigo", "Ciudad", "municipio_codigo"),
        ("direccion", "Dirección", "direccion"),
        ("correo", "Correo electrónico", "correo"),
        ("telefono_fijo", "Teléfono fijo", "telefono_fijo"),
    ])

    personas = idoneidad_repository.listar(rid)
    if not personas:
        por_pestana[1] = [{"campo": "personas", "etiqueta": "Equipo de intermediación",
                           "mensaje": "Registre al menos una persona en el equipo"}]
    else:  # Req 16: el nivel educativo es obligatorio (los registros anteriores quedan vacíos hasta que se edite la pestaña)
        sin_nivel = [{"campo": f"personas.{i}.nivel_educativo", "etiqueta": f"Nivel educativo de la persona {i + 1}",
                      "mensaje": "Seleccione el nivel educativo"}
                     for i, p in enumerate(personas) if _vacio(p.get("nivel_educativo"))]
        if sin_nivel:
            por_pestana[1] = sin_nivel

    humana = humana_repository.obtener(rid)
    por_pestana[2] = _revisar(humana["responsable"], [
        ("nombres_apellidos", "Nombres y apellidos del responsable", "nombres_apellidos"),
        ("tipo_documento", "Tipo de documento del responsable", "tipo_documento"),
        ("numero_documento", "Número de documento del responsable", "numero_documento"),
        ("cargo", "Cargo del responsable", "cargo"),
        ("correo", "Correo del responsable", "correo"),
        ("telefono", "Teléfono del responsable", "telefono"),
    ], prefijo="responsable.")
    # Req 17: al menos una experiencia y cada una con su certificado laboral
    if not humana["experiencias"]:
        por_pestana[2].append({"campo": "experiencias", "etiqueta": "Experiencia laboral",
                               "mensaje": "Registre al menos una experiencia laboral con su certificado"})
    por_pestana[2] += [{"campo": f"experiencias.{i}.soportes", "etiqueta": f"Certificado laboral de la experiencia {i + 1}",
                        "mensaje": "Adjunte al menos un certificado laboral (PDF)"}
                       for i, e in enumerate(humana["experiencias"]) if not e["soportes"]]

    por_pestana[3] = _revisar(operativa_repository.obtener(rid), [
        ("linea_1", "Línea telefónica 1", "linea_1"),
        ("linea_2", "Línea telefónica 2", "linea_2"),
        ("correo", "Correo electrónico de atención", "correo"),
        ("whatsapp", "Línea de atención vía WhatsApp", "whatsapp"),
        ("enlace_web", "Enlace web", "enlace_web"),
    ])

    firma = firma_repository.obtener(rid)
    por_pestana[4] = _revisar(firma, [
        ("nombres_apellidos", "Nombres y apellidos del Representante Legal", "nombres_apellidos"),
        ("tipo_documento", "Tipo de documento del Representante Legal", "tipo_documento"),
        ("numero_documento", "Número de documento del Representante Legal", "numero_documento"),
    ])
    if not firma["firma"]:
        por_pestana[4].append({"campo": "firma", "etiqueta": "Firma digitalizada",
                               "mensaje": "Firma digitalizada: campo obligatorio"})

    return [{"pestana": i, "nombre": PESTANAS[i], "campos": c} for i, c in sorted(por_pestana.items()) if c]
