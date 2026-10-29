-- Requerimiento 16: nivel educativo de cada persona de la Pestaña 2 (Competencia Profesional). Idempotente.
-- Quedan nulas en los registros anteriores: se exigen al volver a guardar la pestaña y para enviar a revisión.
ALTER TABLE personas_idoneidad ADD COLUMN IF NOT EXISTS nivel_educativo             VARCHAR(30);
ALTER TABLE personas_idoneidad ADD COLUMN IF NOT EXISTS descripcion_nivel_educativo VARCHAR(200);
