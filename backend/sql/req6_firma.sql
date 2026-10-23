-- Requerimiento 6: Pestaña 5 — Firma Digitalizada del Representante Legal
-- Una fila por registro: datos del representante legal y la imagen de la firma (ruta en disco). Es idempotente.

CREATE TABLE IF NOT EXISTS firmas_representante (
    id                  SERIAL PRIMARY KEY,
    registro_id         INTEGER NOT NULL UNIQUE REFERENCES registros_intermediarios(id),
    nombres_apellidos   VARCHAR,
    tipo_documento      VARCHAR(20),
    numero_documento    VARCHAR,
    firma_ruta          VARCHAR,          -- ruta relativa dentro de UPLOADS_DIR
    firma_nombre        VARCHAR,
    firma_tipo          VARCHAR(20),      -- image/png | image/jpeg
    firma_tamano_bytes  INTEGER,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);
