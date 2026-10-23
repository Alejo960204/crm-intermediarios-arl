-- Requerimiento 8: verificación por correo en el inicio de sesión (contraseña + código de 6 dígitos)
-- Un registro por intento de inicio de sesión. El código nunca se guarda en claro (solo su huella HMAC). Idempotente.

CREATE TABLE IF NOT EXISTS codigos_acceso (
    id            SERIAL PRIMARY KEY,
    usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    codigo_hash   VARCHAR(64) NOT NULL,
    intentos      INTEGER NOT NULL DEFAULT 0,       -- intentos fallidos del código vigente
    reenvios      INTEGER NOT NULL DEFAULT 0,
    usado         BOOLEAN NOT NULL DEFAULT FALSE,
    enviado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_en     TIMESTAMPTZ NOT NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_codigos_acceso_usuario ON codigos_acceso(usuario_id);
