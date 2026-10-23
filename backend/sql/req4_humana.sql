-- Requerimiento 4: Pestaña 3 — Infraestructura Humana
-- Responsable (uno por registro), su experiencia laboral previa y los soportes PDF de certificaciones.
-- Es idempotente: si ya ejecutaste el schema.sql actualizado, no hace nada.

CREATE TABLE IF NOT EXISTS responsables_humana (
    id                  SERIAL PRIMARY KEY,
    registro_id         INTEGER NOT NULL UNIQUE REFERENCES registros_intermediarios(id),
    nombres_apellidos   VARCHAR,
    tipo_documento      VARCHAR(20),
    numero_documento    VARCHAR,
    cargo               VARCHAR,
    correo              VARCHAR,
    telefono            VARCHAR,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS experiencias_humana (
    id           SERIAL PRIMARY KEY,
    registro_id  INTEGER NOT NULL REFERENCES registros_intermediarios(id),
    empresa      VARCHAR NOT NULL,
    cargo        VARCHAR NOT NULL,
    fecha_inicio DATE,
    fecha_fin    DATE,
    funciones    TEXT,
    CONSTRAINT ck_experiencia_fechas CHECK (fecha_inicio IS NULL OR fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);
CREATE INDEX IF NOT EXISTS idx_experiencias_humana_registro ON experiencias_humana(registro_id);

CREATE TABLE IF NOT EXISTS soportes_experiencia (
    id              SERIAL PRIMARY KEY,
    experiencia_id  INTEGER NOT NULL REFERENCES experiencias_humana(id) ON DELETE CASCADE,
    nombre_original VARCHAR NOT NULL,
    ruta_archivo    VARCHAR NOT NULL,     -- ruta relativa dentro de UPLOADS_DIR
    tamano_bytes    INTEGER NOT NULL,
    fecha_carga     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_soportes_experiencia_exp ON soportes_experiencia(experiencia_id);

-- Cargo actual: la experiencia sigue vigente (sin fecha de fin). Idempotente.
ALTER TABLE experiencias_humana ADD COLUMN IF NOT EXISTS cargo_actual BOOLEAN NOT NULL DEFAULT FALSE;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_experiencia_actual') THEN
        ALTER TABLE experiencias_humana
            ADD CONSTRAINT ck_experiencia_actual CHECK (NOT cargo_actual OR fecha_fin IS NULL);
    END IF;
END $$;
