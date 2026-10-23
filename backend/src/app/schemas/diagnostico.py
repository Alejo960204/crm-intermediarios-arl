from datetime import date, datetime

from pydantic import BaseModel, field_validator

FACTORES = {
    "fisicos": "Físicos", "quimicos": "Químicos", "psicolaborales": "Psicolaborales", "ergonomicos": "Ergonómicos",
    "mecanicos": "Mecánicos", "electricos": "Eléctricos", "locativos": "Locativos",
    "incendio_explosion": "Incendio y explosión", "otros": "Otros",
}
PREGUNTAS_SGSST = {
    "panorama_riesgos": "¿Tiene panorama de riesgos actualizado?",
    "copasst": "¿Tiene COPASST o vigía de SST?",
    "comite_convivencia": "¿Tiene Comité de Convivencia?",
    "reglamento_hs": "¿Tiene reglamento de Higiene y Seguridad actualizado y publicado?",
    "plan_trabajo": "¿Cuenta con un plan de trabajo para la gestión de sus riesgos?",
    "plan_emergencias": "¿Cuenta con un plan de emergencias activo?",
    "brigada_emergencias": "¿Cuenta con brigada de emergencias conformada y capacitada?",
    "patrocina_eventos": "¿La empresa patrocina eventos deportivos, recreativos o culturales a sus empleados?",
    "viajes_exterior": "¿Tiene trabajadores que se desplacen por razones de trabajo fuera del país?",
}


def _limpio(v):
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


class DatosGenerales(BaseModel):
    """Copia (editable) de los datos de la empresa al momento del diagnóstico. Todo es texto libre."""
    nombre_empresa: str | None = None
    nit: str | None = None
    direccion: str | None = None
    telefono_fijo: str | None = None
    celular: str | None = None
    ciudad: str | None = None
    contacto_nombre: str | None = None
    contacto_cargo: str | None = None
    responsable_sgsst_nombre: str | None = None
    responsable_sgsst_cargo: str | None = None
    gerente: str | None = None
    actividad_economica: str | None = None
    trabajadores_directos: str | None = None
    contratistas_independientes: str | None = None
    estudiantes_decreto_055: str | None = None
    tasa_cotizacion: str | None = None
    arl_actual: str | None = None
    tiempo_afiliacion_arl: str | None = None
    valor_cotizacion_arl: str | None = None

    @field_validator("*", mode="before")
    @classmethod
    def _txt(cls, v):
        v = _limpio(None if v is None else str(v))
        if v is not None and len(v) > 300:
            raise ValueError("Máximo 300 caracteres")
        return v


class FactorRiesgo(BaseModel):
    existe: bool = False
    descripcion: str | None = None

    @field_validator("descripcion", mode="before")
    @classmethod
    def _d(cls, v):
        return _limpio(v)


class DiagnosticoEntrada(BaseModel):
    empresa_id: int | None = None  # obligatorio al crear; se ignora al editar
    registro_id: int | None = None
    fecha_diagnostico: date
    datos_generales: DatosGenerales = DatosGenerales()
    # SG-SST: todas obligatorias (Sí/No)
    panorama_riesgos: bool
    copasst: bool
    comite_convivencia: bool
    reglamento_hs: bool
    plan_trabajo: bool
    plan_emergencias: bool
    brigada_emergencias: bool
    patrocina_eventos: bool
    viajes_exterior: bool
    viajes_detalle: str | None = None
    # Accidentalidad y enfermedad laboral: números obligatorios (0 si no hay)
    at_cantidad: int
    at_dias_incapacidad: int
    at_causas: str | None = None
    at_mortales_invalidos: int
    el_calificadas: int
    el_causas: str | None = None
    el_en_calificacion: int
    programas_vigilancia: bool
    factores_riesgo: dict[str, FactorRiesgo] = {}
    expectativas: str | None = None
    observaciones: str | None = None

    @field_validator("viajes_detalle", "at_causas", "el_causas", "expectativas", "observaciones", mode="before")
    @classmethod
    def _textos(cls, v):
        v = _limpio(v)
        if v is not None and len(v) > 2000:
            raise ValueError("Máximo 2000 caracteres")
        return v

    @field_validator("at_cantidad", "at_dias_incapacidad", "at_mortales_invalidos", "el_calificadas",
                     "el_en_calificacion")
    @classmethod
    def _no_neg(cls, v):
        if v < 0:
            raise ValueError("No puede ser negativo (use 0 si no hay)")
        return v

    @field_validator("factores_riesgo")
    @classmethod
    def _factores(cls, v):
        desconocidos = set(v) - set(FACTORES)
        if desconocidos:
            raise ValueError("Factor de riesgo no válido")
        return v


class Bloque(BaseModel):
    nivel: str | None = None  # None = pendiente de definir la fórmula
    resumen: str
    hallazgos: list[str] = []


class ResultadoDiagnostico(BaseModel):
    sgsst: Bloque
    sgsst_puntos: int
    sgsst_total: int
    accidentalidad: Bloque
    enfermedad_laboral: Bloque
    factores_riesgo: Bloque
    factores_existentes: list[str]


class OpcionIntermediario(BaseModel):
    id: int
    rui: str
    nit: str
    razon_social: str | None
    estado: str


class Precarga(BaseModel):
    empresa_id: int
    empresa: str
    datos_generales: DatosGenerales
    intermediarios: list[OpcionIntermediario]


class DiagnosticoListItem(BaseModel):
    id: int
    empresa_id: int
    empresa: str
    nit: str
    fecha_diagnostico: date
    creado_por: str | None
    fecha_actualizacion: datetime
    sgsst_puntos: int
    nivel_accidentalidad: str
    nivel_enfermedad_laboral: str


class DiagnosticoDetalle(DiagnosticoEntrada):
    id: int
    empresa_id: int
    empresa: str
    creado_por: str | None
    intermediario_nombre: str | None
    intermediario_rui: str | None
    intermediario_nit: str | None
    fecha_creacion: datetime
    fecha_actualizacion: datetime
    resultado: ResultadoDiagnostico
