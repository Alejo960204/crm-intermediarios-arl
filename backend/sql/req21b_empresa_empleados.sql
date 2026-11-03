-- Requerimiento 21B: rol «empresa» (login propio de cada empresa) y rol «empleado» (usuarios de una empresa) con cupo. Idempotente.
-- Ejecutar desde la carpeta backend:  psql -U postgres -d <base> -f sql\req21b_empresa_empleados.sql
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('administrador','intermediario','empresa','empleado'));

-- Empresa a la que pertenece un usuario «empresa» o «empleado»
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON usuarios(empresa_id);
-- Una empresa tiene un solo usuario «empresa»
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_empresa_login ON usuarios(empresa_id) WHERE rol = 'empresa';

-- Cupo de empleados por empresa (NULL = sin límite); lo fija el intermediario al crear la empresa
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS max_empleados INTEGER;
ALTER TABLE empresas DROP CONSTRAINT IF EXISTS ck_empresas_max_empleados;
ALTER TABLE empresas ADD CONSTRAINT ck_empresas_max_empleados CHECK (max_empleados IS NULL OR max_empleados >= 0);

-- El antiguo rol «empleado» (asignado por el administrador a procesos) desaparece:
-- se desactivan esos usuarios y se retiran las asignaciones (queda constancia en el historial del proceso).
INSERT INTO procesos_historial (proceso_id, accion, estado, fecha_inicio, periodo, fecha_vencimiento, observacion, usuario_id)
SELECT p.id, 'Asignación', p.estado, p.fecha_inicio, p.periodo, p.fecha_vencimiento,
       'Asignación retirada: el rol Empleado se redefinió (ahora pertenece a una empresa)', p.creado_por
FROM procesos_afiliacion p JOIN usuarios u ON u.id = p.empleado_id
WHERE u.rol = 'empleado' AND u.empresa_id IS NULL;
UPDATE procesos_afiliacion SET empleado_id = NULL
WHERE empleado_id IN (SELECT id FROM usuarios WHERE rol = 'empleado' AND empresa_id IS NULL);
UPDATE usuarios SET activo = FALSE WHERE rol = 'empleado' AND empresa_id IS NULL;
