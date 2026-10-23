-- Requerimiento 10B: decisión del administrador (aprobar / rechazar) con comentario. Idempotente.
ALTER TABLE registros_intermediarios ADD COLUMN IF NOT EXISTS decision_comentario  TEXT;
ALTER TABLE registros_intermediarios ADD COLUMN IF NOT EXISTS decision_fecha       TIMESTAMPTZ;
ALTER TABLE registros_intermediarios ADD COLUMN IF NOT EXISTS decision_usuario_id  INTEGER REFERENCES usuarios(id);
