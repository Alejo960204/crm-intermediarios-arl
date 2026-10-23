-- Requerimiento 15: repositorio de documentos por sección (RUI y SG-SST) y por empresa. Idempotente.
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS seccion VARCHAR(30);
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS titulo  VARCHAR(150);
ALTER TABLE documentos ALTER COLUMN tipo DROP NOT NULL;
ALTER TABLE documentos DROP CONSTRAINT IF EXISTS ck_documento_seccion;
ALTER TABLE documentos ADD CONSTRAINT ck_documento_seccion CHECK (
    (seccion IS NULL AND tipo IS NOT NULL)                                          -- 14A: por tipo
    OR (seccion IS NOT NULL AND titulo IS NOT NULL AND empresa_id IS NOT NULL)      -- 15: por sección (solo empresa)
);
CREATE INDEX IF NOT EXISTS idx_documentos_seccion ON documentos(empresa_id, seccion) WHERE eliminado = FALSE;
