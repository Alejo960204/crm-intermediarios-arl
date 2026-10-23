-- Requerimiento 5: Pestaña 4 — Infraestructura Operativa
-- Datos de contacto/atención (uno por registro), listas de software/bases de datos y de equipos tecnológicos,
-- y soportes PDF de la Cámara de Comercio. Es idempotente.

CREATE TABLE IF NOT EXISTS infraestructura_operativa (
    id                  SERIAL PRIMARY KEY,
    registro_id         INTEGER NOT NULL UNIQUE REFERENCES registros_intermediarios(id),
    linea_1             VARCHAR,
    linea_2             VARCHAR,
    linea_3             VARCHAR,
    fax                 VARCHAR,
    correo              VARCHAR,
    direccion_atencion  VARCHAR,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS items_tecnologia (
    id          SERIAL PRIMARY KEY,
    registro_id INTEGER NOT NULL REFERENCES registros_intermediarios(id),
    tipo        VARCHAR(10) NOT NULL CHECK (tipo IN ('software', 'equipo')),
    nombre      VARCHAR NOT NULL,
    descripcion TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_tecnologia_registro ON items_tecnologia(registro_id);

CREATE TABLE IF NOT EXISTS soportes_camara_comercio (
    id              SERIAL PRIMARY KEY,
    registro_id     INTEGER NOT NULL REFERENCES registros_intermediarios(id),
    nombre_original VARCHAR NOT NULL,
    ruta_archivo    VARCHAR NOT NULL,     -- ruta relativa dentro de UPLOADS_DIR
    tamano_bytes    INTEGER NOT NULL,
    fecha_carga     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_soportes_camara_registro ON soportes_camara_comercio(registro_id);
