from datetime import datetime

from pydantic import BaseModel

TIPOS_DOCUMENTO = ["Cámara de Comercio", "RUT", "Formulario de afiliación", "Cédula del representante legal", "Otro"]


# Req 15: secciones del menú que guardan documentos por empresa (clave -> nombre)
SECCIONES = {
    "rui": "RUI",
    "medicina_laboral": "Medicina Laboral",
    "higiene_seguridad": "Higiene y Seguridad Industrial",
    "riesgo_psicosocial": "Riesgo Psicosocial",
    "trabajo_alturas": "Trabajo en Alturas",
    "trabajo_seguro": "Trabajo Seguro",
    "inspecciones": "Inspecciones",
    "pesv": "PESV (Plan de Seguridad Vial)",
    "politicas": "Políticas",
    "matriz_peligros": "Matriz de identificación de peligros y valoración de riesgos",
    "matriz_legal": "Matriz legal",
}


class VersionOut(BaseModel):
    version: int
    nombre_original: str
    tamano_bytes: int
    content_type: str
    subido_por: str | None
    fecha: datetime


class DocumentoOut(BaseModel):
    id: int
    tipo: str | None = None      # 14A: tipo de documento
    titulo: str | None = None    # 15: título libre (documentos de sección)
    seccion: str | None = None
    descripcion: str | None
    version_actual: int
    nombre_original: str
    tamano_bytes: int
    content_type: str
    subido_por: str | None
    fecha: datetime              # fecha de la versión actual
    fecha_creacion: datetime
    versiones: list[VersionOut]  # de la más reciente a la más antigua
    puede_eliminar: bool         # solo root Admin
