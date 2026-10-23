-- Para quien ya ejecutó el schema.sql anterior del Requerimiento 1
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'cliente'
    CHECK (rol IN ('root Admin','cliente'));

DROP INDEX IF EXISTS uq_registros_nit;
CREATE INDEX IF NOT EXISTS idx_registros_nit ON registros_intermediarios(nit) WHERE eliminado = FALSE;

ALTER TABLE registros_intermediarios DROP CONSTRAINT IF EXISTS ck_registro_obligatorios;
ALTER TABLE registros_intermediarios ADD CONSTRAINT ck_registro_obligatorios CHECK (
    estado = 'Borrador' OR (
        COALESCE(btrim(razon_social),'') <> '' AND departamento_codigo IS NOT NULL
        AND municipio_codigo IS NOT NULL AND COALESCE(btrim(direccion),'') <> ''
        AND COALESCE(btrim(correo),'') <> '' AND COALESCE(btrim(telefono_fijo),'') <> ''
    )
) NOT VALID;  -- NOT VALID: no revisa filas ya existentes (p. ej. los registros demo)
-- Para el rol de tu usuario actual (si lo creaste con el script anterior):
-- UPDATE usuarios SET rol = 'root Admin' WHERE email = 'tu@correo.com';
