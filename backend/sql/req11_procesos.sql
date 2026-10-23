-- Requerimiento 11: Procesos de afiliación (por empresa, con historial) + rol Empleado y asignación. Idempotente.
-- Nuevo rol 'empleado' (reemplaza la restricción de roles; el nombre es el que PostgreSQL asignó por defecto)
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('root Admin','cliente','empleado'));

-- Estados guardados: Pendiente, En proceso, Vigente. «Caducado» se calcula: Vigente con vencimiento cumplido.
CREATE TABLE IF NOT EXISTS procesos_afiliacion (
    id                  SERIAL PRIMARY KEY,
    empresa_id          INTEGER NOT NULL REFERENCES empresas(id),
    arl_destino         VARCHAR,
    numero_afiliacion   VARCHAR,
    estado              VARCHAR(12) NOT NULL DEFAULT 'Pendiente'
                        CHECK (estado IN ('Pendiente','En proceso','Vigente')),
    fecha_inicio        DATE,
    periodo             VARCHAR(7) CHECK (periodo IN ('Mensual','Anual')),
    fecha_vencimiento   DATE,
    observacion         TEXT,
    creado_por          INTEGER NOT NULL REFERENCES usuarios(id),
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_proceso_vigente CHECK (
        estado <> 'Vigente' OR (fecha_inicio IS NOT NULL AND periodo IS NOT NULL AND fecha_vencimiento IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_procesos_empresa ON procesos_afiliacion(empresa_id);
-- Empleado responsable (uno por proceso; lo asigna el root Admin)
ALTER TABLE procesos_afiliacion ADD COLUMN IF NOT EXISTS empleado_id INTEGER REFERENCES usuarios(id);
CREATE INDEX IF NOT EXISTS idx_procesos_empleado ON procesos_afiliacion(empleado_id);

CREATE TABLE IF NOT EXISTS procesos_historial (
    id                SERIAL PRIMARY KEY,
    proceso_id        INTEGER NOT NULL REFERENCES procesos_afiliacion(id) ON DELETE CASCADE,
    accion            VARCHAR(20) NOT NULL,      -- Creación | Cambio de estado | Renovación | Asignación
    estado            VARCHAR(12) NOT NULL,
    fecha_inicio      DATE,
    periodo           VARCHAR(7),
    fecha_vencimiento DATE,
    observacion       TEXT,
    usuario_id        INTEGER NOT NULL REFERENCES usuarios(id),
    fecha             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_historial_proceso ON procesos_historial(proceso_id);

DROP TRIGGER IF EXISTS trg_procesos_fecha_actualizacion ON procesos_afiliacion;
CREATE TRIGGER trg_procesos_fecha_actualizacion
    BEFORE UPDATE ON procesos_afiliacion
    FOR EACH ROW EXECUTE FUNCTION set_fecha_actualizacion();
