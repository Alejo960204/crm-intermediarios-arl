-- Requerimiento 3: Pestaña 2 — Idoneidad Profesional
-- Personas que ejercen la intermediación y sus soportes (PDF de cursos SGRL).
-- Es idempotente: si ya ejecutaste el schema.sql actualizado, no hace nada.

CREATE TABLE IF NOT EXISTS personas_idoneidad (
    id                SERIAL PRIMARY KEY,
    registro_id       INTEGER NOT NULL REFERENCES registros_intermediarios(id),
    nombres_apellidos VARCHAR NOT NULL,
    tipo_documento    VARCHAR(20) NOT NULL,
    numero_documento  VARCHAR NOT NULL,
    cargo             VARCHAR,
    correo            VARCHAR,
    telefono          VARCHAR,
    fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_personas_idoneidad_registro ON personas_idoneidad(registro_id);

CREATE TABLE IF NOT EXISTS soportes_idoneidad (
    id              SERIAL PRIMARY KEY,
    persona_id      INTEGER NOT NULL REFERENCES personas_idoneidad(id) ON DELETE CASCADE,
    nombre_original VARCHAR NOT NULL,
    ruta_archivo    VARCHAR NOT NULL,     -- ruta relativa dentro de UPLOADS_DIR
    tamano_bytes    INTEGER NOT NULL,
    fecha_carga     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_soportes_idoneidad_persona ON soportes_idoneidad(persona_id);
