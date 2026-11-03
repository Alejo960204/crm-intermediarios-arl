-- Requerimiento 21C: historial de cambios por empresa (quién, cuándo, qué). Idempotente.
-- Ejecutar desde la carpeta backend:  psql -U postgres -d <base> -f sql\req21c_historial.sql
CREATE TABLE IF NOT EXISTS empresa_historial (
    id              BIGSERIAL PRIMARY KEY,
    empresa_id      INTEGER NOT NULL REFERENCES empresas(id),
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
    rol_usuario     VARCHAR(20) NOT NULL,          -- rol que tenía al momento del cambio
    categoria       VARCHAR(20) NOT NULL CHECK (categoria IN ('datos','documento','diagnostico','empleado','acceso')),
    accion          VARCHAR(150) NOT NULL,
    campo           VARCHAR(150),
    valor_anterior  TEXT,
    valor_nuevo     TEXT,
    detalle         TEXT,
    fecha           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_empresa_historial_empresa ON empresa_historial(empresa_id, fecha DESC, id DESC);
