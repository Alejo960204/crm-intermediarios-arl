-- Requerimiento 21A: roles Administrador / Intermediario y límite de empresas por intermediario. Idempotente.
-- Ejecutar desde la carpeta backend:  psql -U postgres -d <base> -f sql\req21a_roles_limite.sql
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
UPDATE usuarios SET rol = 'administrador' WHERE rol = 'root Admin';
UPDATE usuarios SET rol = 'intermediario' WHERE rol = 'cliente';
ALTER TABLE usuarios ALTER COLUMN rol SET DEFAULT 'intermediario';
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('administrador','intermediario','empleado'));
-- Máximo de empresas activas que el administrador permite crear al intermediario (NULL = sin límite)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS max_empresas INTEGER;
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS ck_usuarios_max_empresas;
ALTER TABLE usuarios ADD CONSTRAINT ck_usuarios_max_empresas CHECK (max_empresas IS NULL OR max_empresas >= 0);
