-- Requerimiento 10: Módulo de Empresas (datos generales del formato "Diagnóstico ARL")
-- Idempotente. Un usuario cliente puede tener varias empresas.
CREATE TABLE IF NOT EXISTS empresas (
    id                          SERIAL PRIMARY KEY,
    usuario_id                  INTEGER NOT NULL REFERENCES usuarios(id),
    nombre                      VARCHAR NOT NULL,
    nit                         VARCHAR NOT NULL,
    direccion                   VARCHAR,
    telefono_fijo               VARCHAR,
    celular                     VARCHAR,
    departamento_codigo         VARCHAR(2) REFERENCES departamentos(codigo),
    municipio_codigo            VARCHAR(5) REFERENCES municipios(codigo),
    contacto_nombre             VARCHAR,   -- persona que suministra la información
    contacto_cargo              VARCHAR,
    responsable_sgsst_nombre    VARCHAR,
    responsable_sgsst_cargo     VARCHAR,
    gerente                     VARCHAR,
    actividad_economica         VARCHAR,
    trabajadores_directos       INTEGER CHECK (trabajadores_directos >= 0),
    contratistas_independientes INTEGER CHECK (contratistas_independientes >= 0),
    estudiantes_decreto_055     INTEGER CHECK (estudiantes_decreto_055 >= 0),
    tasa_cotizacion             NUMERIC(7,5) CHECK (tasa_cotizacion >= 0),
    arl_actual                  VARCHAR,
    tiempo_afiliacion_arl       VARCHAR,
    valor_cotizacion_arl        NUMERIC(16,2) CHECK (valor_cotizacion_arl >= 0),
    eliminado                   BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_creacion              TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_actualizacion         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_empresas_nit ON empresas(nit) WHERE eliminado = FALSE;
CREATE INDEX IF NOT EXISTS idx_empresas_usuario ON empresas(usuario_id) WHERE eliminado = FALSE;

DROP TRIGGER IF EXISTS trg_empresas_fecha_actualizacion ON empresas;
CREATE TRIGGER trg_empresas_fecha_actualizacion
    BEFORE UPDATE ON empresas
    FOR EACH ROW EXECUTE FUNCTION set_fecha_actualizacion();
