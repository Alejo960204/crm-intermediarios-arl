-- Requerimiento 18: serie y ubicación de equipos, consentimiento de tratamiento de datos y recuperación de contraseña. Idempotente.
ALTER TABLE items_tecnologia ADD COLUMN IF NOT EXISTS serie     VARCHAR(100);
ALTER TABLE items_tecnologia ADD COLUMN IF NOT EXISTS ubicacion VARCHAR(150);

-- Aceptaciones de la política de tratamiento de datos personales (una fila por inicio de sesión)
CREATE TABLE IF NOT EXISTS consentimientos_datos (
    id          SERIAL PRIMARY KEY,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    version     VARCHAR(30) NOT NULL,
    ip          VARCHAR(64),
    aceptado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consentimientos_usuario ON consentimientos_datos(usuario_id, aceptado_en DESC);

-- Los códigos por correo sirven para dos propósitos: 'login' (verificación, Req 8) y 'recuperacion' (olvidó su contraseña)
ALTER TABLE codigos_acceso ADD COLUMN IF NOT EXISTS proposito VARCHAR(20) NOT NULL DEFAULT 'login';
