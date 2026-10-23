-- Requerimiento 14A: documentos por empresa y por proceso, con historial de versiones. Idempotente.
CREATE TABLE IF NOT EXISTS documentos (
    id             SERIAL PRIMARY KEY,
    empresa_id     INTEGER REFERENCES empresas(id),
    proceso_id     INTEGER REFERENCES procesos_afiliacion(id),
    tipo           VARCHAR NOT NULL,
    descripcion    TEXT,
    eliminado      BOOLEAN NOT NULL DEFAULT FALSE,   -- solo lo marca el root Admin
    creado_por     INTEGER NOT NULL REFERENCES usuarios(id),
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_documento_objetivo CHECK ((empresa_id IS NULL) <> (proceso_id IS NULL))  -- de una empresa O de un proceso
);
CREATE INDEX IF NOT EXISTS idx_documentos_empresa ON documentos(empresa_id) WHERE eliminado = FALSE;
CREATE INDEX IF NOT EXISTS idx_documentos_proceso ON documentos(proceso_id) WHERE eliminado = FALSE;

CREATE TABLE IF NOT EXISTS documentos_versiones (
    id              SERIAL PRIMARY KEY,
    documento_id    INTEGER NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
    version         INTEGER NOT NULL,
    nombre_original VARCHAR NOT NULL,
    ruta            VARCHAR NOT NULL,
    content_type    VARCHAR NOT NULL,
    tamano_bytes    INTEGER NOT NULL,
    subido_por      INTEGER NOT NULL REFERENCES usuarios(id),
    fecha           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (documento_id, version)
);
