-- Requerimiento 12: Formulario de Diagnóstico (varios por empresa, con historial por fecha). Idempotente.
CREATE TABLE IF NOT EXISTS diagnosticos (
    id                         SERIAL PRIMARY KEY,
    empresa_id                 INTEGER NOT NULL REFERENCES empresas(id),
    registro_id                INTEGER REFERENCES registros_intermediarios(id),  -- intermediario elegido (Formulario Único)
    fecha_diagnostico          DATE NOT NULL,
    datos_generales            JSONB NOT NULL DEFAULT '{}',   -- copia de los datos de la empresa en ese momento
    intermediario_nombre       VARCHAR,
    intermediario_rui          VARCHAR,
    intermediario_nit          VARCHAR,
    -- SG-SST (Sí/No)
    panorama_riesgos           BOOLEAN NOT NULL,
    copasst                    BOOLEAN NOT NULL,
    comite_convivencia         BOOLEAN NOT NULL,
    reglamento_hs              BOOLEAN NOT NULL,
    plan_trabajo               BOOLEAN NOT NULL,
    plan_emergencias           BOOLEAN NOT NULL,
    brigada_emergencias        BOOLEAN NOT NULL,
    patrocina_eventos          BOOLEAN NOT NULL,
    viajes_exterior            BOOLEAN NOT NULL,
    viajes_detalle             TEXT,                          -- cuántos y periodicidad
    -- Accidentalidad
    at_cantidad                INTEGER NOT NULL CHECK (at_cantidad >= 0),
    at_dias_incapacidad        INTEGER NOT NULL CHECK (at_dias_incapacidad >= 0),
    at_causas                  TEXT,
    at_mortales_invalidos      INTEGER NOT NULL CHECK (at_mortales_invalidos >= 0),
    -- Enfermedad laboral
    el_calificadas             INTEGER NOT NULL CHECK (el_calificadas >= 0),
    el_causas                  TEXT,
    el_en_calificacion         INTEGER NOT NULL CHECK (el_en_calificacion >= 0),
    programas_vigilancia       BOOLEAN NOT NULL,
    -- Factores de riesgo: {"fisicos": {"existe": true, "descripcion": "..."}, ...}
    factores_riesgo            JSONB NOT NULL DEFAULT '{}',
    expectativas               TEXT,
    observaciones              TEXT,
    creado_por                 INTEGER NOT NULL REFERENCES usuarios(id),
    fecha_creacion             TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_actualizacion        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_diagnosticos_empresa ON diagnosticos(empresa_id, fecha_diagnostico DESC);

DROP TRIGGER IF EXISTS trg_diagnosticos_fecha_actualizacion ON diagnosticos;
CREATE TRIGGER trg_diagnosticos_fecha_actualizacion
    BEFORE UPDATE ON diagnosticos
    FOR EACH ROW EXECUTE FUNCTION set_fecha_actualizacion();
