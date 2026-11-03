-- Requerimiento 21A (ampliación): paquetes de empresas por intermediario, empresas inactivas y solicitudes de ampliación. Idempotente.
-- Ejecutar desde la carpeta backend:  psql -U postgres -d <base> -f sql\req21a2_paquetes.sql
-- (requiere haber ejecutado antes sql\req21a_roles_limite.sql)

-- Cada asignación de paquete es una fila: el intermediario trabaja con el más reciente; el resto queda como historial.
CREATE TABLE IF NOT EXISTS paquetes_intermediario (
    id                SERIAL PRIMARY KEY,
    usuario_id        INTEGER NOT NULL REFERENCES usuarios(id),
    nombre            VARCHAR(100) NOT NULL,
    cantidad_empresas INTEGER NOT NULL CHECK (cantidad_empresas >= 1),
    periodicidad      VARCHAR(12) CHECK (periodicidad IN ('mensual','trimestral','semestral','anual')),  -- NULL = sin vencimiento (paquetes migrados)
    fecha_inicio      DATE NOT NULL,
    fecha_vencimiento DATE,
    creado_por        INTEGER REFERENCES usuarios(id),
    fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_paquetes_usuario ON paquetes_intermediario(usuario_id, id DESC);

-- Empresa inactiva: se conserva con todo su historial, queda solo de consulta y NO libera cupo.
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS inactiva   BOOLEAN NOT NULL DEFAULT FALSE;
-- Paquete con el que se creó la empresa (el cupo gastado se cuenta por paquete)
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS paquete_id INTEGER REFERENCES paquetes_intermediario(id);
CREATE INDEX IF NOT EXISTS idx_empresas_paquete ON empresas(paquete_id);

CREATE TABLE IF NOT EXISTS solicitudes_ampliacion (
    id              SERIAL PRIMARY KEY,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
    estado          VARCHAR(10) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','atendida')),
    fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_atencion  TIMESTAMPTZ,
    atendida_por    INTEGER REFERENCES usuarios(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitud_pendiente ON solicitudes_ampliacion(usuario_id) WHERE estado = 'pendiente';

-- Migración del límite simple de la parte 21A (usuarios.max_empresas) a un paquete sin vencimiento
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'max_empresas') THEN
        INSERT INTO paquetes_intermediario (usuario_id, nombre, cantidad_empresas, periodicidad, fecha_inicio, fecha_vencimiento)
            SELECT u.id, 'Paquete inicial', GREATEST(u.max_empresas, 1), NULL, CURRENT_DATE, NULL
            FROM usuarios u
            WHERE u.max_empresas IS NOT NULL AND NOT EXISTS (SELECT 1 FROM paquetes_intermediario p WHERE p.usuario_id = u.id);
        UPDATE empresas e SET paquete_id = (SELECT p.id FROM paquetes_intermediario p WHERE p.usuario_id = e.usuario_id ORDER BY p.id DESC LIMIT 1)
            WHERE e.paquete_id IS NULL AND e.eliminado = FALSE
              AND EXISTS (SELECT 1 FROM paquetes_intermediario p WHERE p.usuario_id = e.usuario_id);
        ALTER TABLE usuarios DROP COLUMN max_empresas;
    END IF;
END $$;
