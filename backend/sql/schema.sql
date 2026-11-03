-- Módulo Intermediarios ARL — Requerimiento 1: modelo de datos (tabla principal)
-- Base de datos: crm_intermediarios_arl

CREATE TABLE IF NOT EXISTS usuarios (
    id             SERIAL PRIMARY KEY,
    nombre         VARCHAR(150) NOT NULL,
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    rol            VARCHAR(20) NOT NULL DEFAULT 'cliente'
                   CHECK (rol IN ('root Admin','cliente')),
    activo         BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Catálogos DANE (DIVIPOLA). Se cargan con scripts/cargar_divipola.py
CREATE TABLE IF NOT EXISTS departamentos (
    codigo VARCHAR(2) PRIMARY KEY,          -- código DANE, 2 dígitos
    nombre VARCHAR(150) NOT NULL
);

CREATE TABLE IF NOT EXISTS municipios (
    codigo              VARCHAR(5) PRIMARY KEY,   -- código DANE, 5 dígitos
    nombre              VARCHAR(150) NOT NULL,
    departamento_codigo VARCHAR(2) NOT NULL REFERENCES departamentos(codigo)
);
CREATE INDEX IF NOT EXISTS idx_municipios_departamento ON municipios(departamento_codigo);

-- Tabla principal ("Mis Registros") — campos de la Pestaña 1
CREATE TABLE IF NOT EXISTS registros_intermediarios (
    id                   SERIAL PRIMARY KEY,
    usuario_id           INTEGER NOT NULL REFERENCES usuarios(id),
    rui                  VARCHAR NOT NULL,      -- Registro Único del ARL (sin longitud fija)
    nit                  VARCHAR NOT NULL,      -- sin dígito de verificación
    razon_social         VARCHAR,
    departamento_codigo  VARCHAR(2) REFERENCES departamentos(codigo),
    municipio_codigo     VARCHAR(5) REFERENCES municipios(codigo),
    direccion            VARCHAR,
    correo               VARCHAR,
    telefono_fijo        VARCHAR,
    estado               VARCHAR(20) NOT NULL DEFAULT 'Borrador'
                         CHECK (estado IN ('Borrador','En revisión','Aprobado','Rechazado')),
    eliminado            BOOLEAN NOT NULL DEFAULT FALSE,   -- borrado lógico
    fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_actualizacion  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Campos obligatorios al enviar a revisión: fuera de 'Borrador' todos deben estar completos
    CONSTRAINT ck_registro_obligatorios CHECK (
        estado = 'Borrador' OR (
            COALESCE(btrim(razon_social),'') <> '' AND departamento_codigo IS NOT NULL
            AND municipio_codigo IS NOT NULL AND COALESCE(btrim(direccion),'') <> ''
            AND COALESCE(btrim(correo),'') <> '' AND COALESCE(btrim(telefono_fijo),'') <> ''
        )
    )
);

-- RUI único entre registros no eliminados. El NIT PUEDE repetirse (índice no único, solo para búsquedas)
CREATE UNIQUE INDEX IF NOT EXISTS uq_registros_rui ON registros_intermediarios(rui) WHERE eliminado = FALSE;
CREATE INDEX IF NOT EXISTS idx_registros_nit ON registros_intermediarios(nit) WHERE eliminado = FALSE;
CREATE INDEX IF NOT EXISTS idx_registros_usuario ON registros_intermediarios(usuario_id) WHERE eliminado = FALSE;

CREATE OR REPLACE FUNCTION set_fecha_actualizacion() RETURNS trigger AS $$
BEGIN
    NEW.fecha_actualizacion = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registros_fecha_actualizacion ON registros_intermediarios;
CREATE TRIGGER trg_registros_fecha_actualizacion
    BEFORE UPDATE ON registros_intermediarios
    FOR EACH ROW EXECUTE FUNCTION set_fecha_actualizacion();

-- Requerimiento 3: Pestaña 2 — Idoneidad Profesional
-- Personas que ejercen la intermediación y sus soportes (PDF de cursos SGRL).
-- Es idempotente: si ya ejecutaste el schema.sql actualizado, no hace nada.

CREATE TABLE IF NOT EXISTS personas_idoneidad (
    id                SERIAL PRIMARY KEY,
    registro_id       INTEGER NOT NULL REFERENCES registros_intermediarios(id),
    nombres_apellidos VARCHAR NOT NULL,
    tipo_documento    VARCHAR(20) NOT NULL,
    numero_documento  VARCHAR NOT NULL,
    cargo             VARCHAR,
    correo            VARCHAR,
    telefono          VARCHAR,
    fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_personas_idoneidad_registro ON personas_idoneidad(registro_id);

CREATE TABLE IF NOT EXISTS soportes_idoneidad (
    id              SERIAL PRIMARY KEY,
    persona_id      INTEGER NOT NULL REFERENCES personas_idoneidad(id) ON DELETE CASCADE,
    nombre_original VARCHAR NOT NULL,
    ruta_archivo    VARCHAR NOT NULL,     -- ruta relativa dentro de UPLOADS_DIR
    tamano_bytes    INTEGER NOT NULL,
    fecha_carga     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_soportes_idoneidad_persona ON soportes_idoneidad(persona_id);

-- Requerimiento 4: Pestaña 3 — Infraestructura Humana
-- Responsable (uno por registro), su experiencia laboral previa y los soportes PDF de certificaciones.
-- Es idempotente: si ya ejecutaste el schema.sql actualizado, no hace nada.

CREATE TABLE IF NOT EXISTS responsables_humana (
    id                  SERIAL PRIMARY KEY,
    registro_id         INTEGER NOT NULL UNIQUE REFERENCES registros_intermediarios(id),
    nombres_apellidos   VARCHAR,
    tipo_documento      VARCHAR(20),
    numero_documento    VARCHAR,
    cargo               VARCHAR,
    correo              VARCHAR,
    telefono            VARCHAR,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS experiencias_humana (
    id           SERIAL PRIMARY KEY,
    registro_id  INTEGER NOT NULL REFERENCES registros_intermediarios(id),
    empresa      VARCHAR NOT NULL,
    cargo        VARCHAR NOT NULL,
    fecha_inicio DATE,
    fecha_fin    DATE,
    funciones    TEXT,
    CONSTRAINT ck_experiencia_fechas CHECK (fecha_inicio IS NULL OR fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);
CREATE INDEX IF NOT EXISTS idx_experiencias_humana_registro ON experiencias_humana(registro_id);

CREATE TABLE IF NOT EXISTS soportes_experiencia (
    id              SERIAL PRIMARY KEY,
    experiencia_id  INTEGER NOT NULL REFERENCES experiencias_humana(id) ON DELETE CASCADE,
    nombre_original VARCHAR NOT NULL,
    ruta_archivo    VARCHAR NOT NULL,     -- ruta relativa dentro de UPLOADS_DIR
    tamano_bytes    INTEGER NOT NULL,
    fecha_carga     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_soportes_experiencia_exp ON soportes_experiencia(experiencia_id);

-- Cargo actual: la experiencia sigue vigente (sin fecha de fin). Idempotente.
ALTER TABLE experiencias_humana ADD COLUMN IF NOT EXISTS cargo_actual BOOLEAN NOT NULL DEFAULT FALSE;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_experiencia_actual') THEN
        ALTER TABLE experiencias_humana
            ADD CONSTRAINT ck_experiencia_actual CHECK (NOT cargo_actual OR fecha_fin IS NULL);
    END IF;
END $$;

-- ===== Requerimiento 5 (Pestaña 4) =====

CREATE TABLE IF NOT EXISTS infraestructura_operativa (
    id                  SERIAL PRIMARY KEY,
    registro_id         INTEGER NOT NULL UNIQUE REFERENCES registros_intermediarios(id),
    linea_1             VARCHAR,
    linea_2             VARCHAR,
    linea_3             VARCHAR,
    fax                 VARCHAR,
    correo              VARCHAR,
    direccion_atencion  VARCHAR,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS items_tecnologia (
    id          SERIAL PRIMARY KEY,
    registro_id INTEGER NOT NULL REFERENCES registros_intermediarios(id),
    tipo        VARCHAR(10) NOT NULL CHECK (tipo IN ('software', 'equipo')),
    nombre      VARCHAR NOT NULL,
    descripcion TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_tecnologia_registro ON items_tecnologia(registro_id);

CREATE TABLE IF NOT EXISTS soportes_camara_comercio (
    id              SERIAL PRIMARY KEY,
    registro_id     INTEGER NOT NULL REFERENCES registros_intermediarios(id),
    nombre_original VARCHAR NOT NULL,
    ruta_archivo    VARCHAR NOT NULL,     -- ruta relativa dentro de UPLOADS_DIR
    tamano_bytes    INTEGER NOT NULL,
    fecha_carga     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_soportes_camara_registro ON soportes_camara_comercio(registro_id);

-- ===== Requerimiento 6 (Pestaña 5) =====
CREATE TABLE IF NOT EXISTS firmas_representante (
    id                  SERIAL PRIMARY KEY,
    registro_id         INTEGER NOT NULL UNIQUE REFERENCES registros_intermediarios(id),
    nombres_apellidos   VARCHAR,
    tipo_documento      VARCHAR(20),
    numero_documento    VARCHAR,
    firma_ruta          VARCHAR,          -- ruta relativa dentro de UPLOADS_DIR
    firma_nombre        VARCHAR,
    firma_tipo          VARCHAR(20),      -- image/png | image/jpeg
    firma_tamano_bytes  INTEGER,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Requerimiento 8 (verificación por correo) =====
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

-- Requerimiento 10: Módulo de Empresas (datos generales del formato "Diagnóstico ARL")
-- Idempotente. Un usuario cliente puede tener varias empresas.
CREATE TABLE IF NOT EXISTS empresas (
    id                          SERIAL PRIMARY KEY,
    usuario_id                  INTEGER NOT NULL REFERENCES usuarios(id),
    nombre                      VARCHAR NOT NULL,
    nit                         VARCHAR NOT NULL,
    direccion                   VARCHAR,
    telefono_fijo               VARCHAR,
    celular                     VARCHAR,
    departamento_codigo         VARCHAR(2) REFERENCES departamentos(codigo),
    municipio_codigo            VARCHAR(5) REFERENCES municipios(codigo),
    contacto_nombre             VARCHAR,   -- persona que suministra la información
    contacto_cargo              VARCHAR,
    responsable_sgsst_nombre    VARCHAR,
    responsable_sgsst_cargo     VARCHAR,
    gerente                     VARCHAR,
    actividad_economica         VARCHAR,
    trabajadores_directos       INTEGER CHECK (trabajadores_directos >= 0),
    contratistas_independientes INTEGER CHECK (contratistas_independientes >= 0),
    estudiantes_decreto_055     INTEGER CHECK (estudiantes_decreto_055 >= 0),
    tasa_cotizacion             NUMERIC(7,5) CHECK (tasa_cotizacion >= 0),
    arl_actual                  VARCHAR,
    tiempo_afiliacion_arl       VARCHAR,
    valor_cotizacion_arl        NUMERIC(16,2) CHECK (valor_cotizacion_arl >= 0),
    eliminado                   BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_creacion              TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_actualizacion         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_empresas_nit ON empresas(nit) WHERE eliminado = FALSE;
CREATE INDEX IF NOT EXISTS idx_empresas_usuario ON empresas(usuario_id) WHERE eliminado = FALSE;

DROP TRIGGER IF EXISTS trg_empresas_fecha_actualizacion ON empresas;
CREATE TRIGGER trg_empresas_fecha_actualizacion
    BEFORE UPDATE ON empresas
    FOR EACH ROW EXECUTE FUNCTION set_fecha_actualizacion();

-- Requerimiento 10B: decisión del administrador (aprobar / rechazar) con comentario. Idempotente.
ALTER TABLE registros_intermediarios ADD COLUMN IF NOT EXISTS decision_comentario  TEXT;
ALTER TABLE registros_intermediarios ADD COLUMN IF NOT EXISTS decision_fecha       TIMESTAMPTZ;
ALTER TABLE registros_intermediarios ADD COLUMN IF NOT EXISTS decision_usuario_id  INTEGER REFERENCES usuarios(id);

-- Requerimiento 11: Procesos de afiliación (por empresa, con historial) + rol Empleado y asignación. Idempotente.
-- Nuevo rol 'empleado' (reemplaza la restricción de roles; el nombre es el que PostgreSQL asignó por defecto)
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('root Admin','cliente','empleado','administrador','intermediario'));

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

-- Requerimiento 12: Formulario de Diagnóstico (varios por empresa, con historial por fecha). Idempotente.
CREATE TABLE IF NOT EXISTS diagnosticos (
    id                         SERIAL PRIMARY KEY,
    empresa_id                 INTEGER NOT NULL REFERENCES empresas(id),
    registro_id                INTEGER REFERENCES registros_intermediarios(id),  -- intermediario elegido (Formulario Único)
    fecha_diagnostico          DATE NOT NULL,
    datos_generales            JSONB NOT NULL DEFAULT '{}',   -- copia de los datos de la empresa en ese momento
    intermediario_nombre       VARCHAR,
    intermediario_rui          VARCHAR,
    intermediario_nit          VARCHAR,
    -- SG-SST (Sí/No)
    panorama_riesgos           BOOLEAN NOT NULL,
    copasst                    BOOLEAN NOT NULL,
    comite_convivencia         BOOLEAN NOT NULL,
    reglamento_hs              BOOLEAN NOT NULL,
    plan_trabajo               BOOLEAN NOT NULL,
    plan_emergencias           BOOLEAN NOT NULL,
    brigada_emergencias        BOOLEAN NOT NULL,
    patrocina_eventos          BOOLEAN NOT NULL,
    viajes_exterior            BOOLEAN NOT NULL,
    viajes_detalle             TEXT,                          -- cuántos y periodicidad
    -- Accidentalidad
    at_cantidad                INTEGER NOT NULL CHECK (at_cantidad >= 0),
    at_dias_incapacidad        INTEGER NOT NULL CHECK (at_dias_incapacidad >= 0),
    at_causas                  TEXT,
    at_mortales_invalidos      INTEGER NOT NULL CHECK (at_mortales_invalidos >= 0),
    -- Enfermedad laboral
    el_calificadas             INTEGER NOT NULL CHECK (el_calificadas >= 0),
    el_causas                  TEXT,
    el_en_calificacion         INTEGER NOT NULL CHECK (el_en_calificacion >= 0),
    programas_vigilancia       BOOLEAN NOT NULL,
    -- Factores de riesgo: {"fisicos": {"existe": true, "descripcion": "..."}, ...}
    factores_riesgo            JSONB NOT NULL DEFAULT '{}',
    expectativas               TEXT,
    observaciones              TEXT,
    creado_por                 INTEGER NOT NULL REFERENCES usuarios(id),
    fecha_creacion             TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_actualizacion        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_diagnosticos_empresa ON diagnosticos(empresa_id, fecha_diagnostico DESC);

DROP TRIGGER IF EXISTS trg_diagnosticos_fecha_actualizacion ON diagnosticos;
CREATE TRIGGER trg_diagnosticos_fecha_actualizacion
    BEFORE UPDATE ON diagnosticos
    FOR EACH ROW EXECUTE FUNCTION set_fecha_actualizacion();

-- Requerimiento 14A: documentos por empresa y por proceso, con historial de versiones. Idempotente.
CREATE TABLE IF NOT EXISTS documentos (
    id             SERIAL PRIMARY KEY,
    empresa_id     INTEGER REFERENCES empresas(id),
    proceso_id     INTEGER REFERENCES procesos_afiliacion(id),
    tipo           VARCHAR NOT NULL,
    descripcion    TEXT,
    eliminado      BOOLEAN NOT NULL DEFAULT FALSE,   -- solo lo marca el root Admin
    creado_por     INTEGER NOT NULL REFERENCES usuarios(id),
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_documento_objetivo CHECK ((empresa_id IS NULL) <> (proceso_id IS NULL))  -- de una empresa O de un proceso
);
CREATE INDEX IF NOT EXISTS idx_documentos_empresa ON documentos(empresa_id) WHERE eliminado = FALSE;
CREATE INDEX IF NOT EXISTS idx_documentos_proceso ON documentos(proceso_id) WHERE eliminado = FALSE;

CREATE TABLE IF NOT EXISTS documentos_versiones (
    id              SERIAL PRIMARY KEY,
    documento_id    INTEGER NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
    version         INTEGER NOT NULL,
    nombre_original VARCHAR NOT NULL,
    ruta            VARCHAR NOT NULL,
    content_type    VARCHAR NOT NULL,
    tamano_bytes    INTEGER NOT NULL,
    subido_por      INTEGER NOT NULL REFERENCES usuarios(id),
    fecha           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (documento_id, version)
);

-- Requerimiento 15: repositorio de documentos por sección (RUI y SG-SST) y por empresa. Idempotente.
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS seccion VARCHAR(30);
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS titulo  VARCHAR(150);
ALTER TABLE documentos ALTER COLUMN tipo DROP NOT NULL;
ALTER TABLE documentos DROP CONSTRAINT IF EXISTS ck_documento_seccion;
ALTER TABLE documentos ADD CONSTRAINT ck_documento_seccion CHECK (
    (seccion IS NULL AND tipo IS NOT NULL)                                          -- 14A: por tipo
    OR (seccion IS NOT NULL AND titulo IS NOT NULL AND empresa_id IS NOT NULL)      -- 15: por sección (solo empresa)
);
CREATE INDEX IF NOT EXISTS idx_documentos_seccion ON documentos(empresa_id, seccion) WHERE eliminado = FALSE;

-- Requerimiento 16: nivel educativo de cada persona de la Pestaña 2 (Competencia Profesional). Idempotente.
-- Quedan nulas en los registros anteriores: se exigen al volver a guardar la pestaña y para enviar a revisión.
ALTER TABLE personas_idoneidad ADD COLUMN IF NOT EXISTS nivel_educativo             VARCHAR(30);
ALTER TABLE personas_idoneidad ADD COLUMN IF NOT EXISTS descripcion_nivel_educativo VARCHAR(200);

-- Requerimiento 17: ajustes de las pestañas 3 y 4. Idempotente.
-- «Línea telefónica 3» pasa a ser «Línea de atención vía WhatsApp» y «Fax» pasa a ser «Enlace web».
-- Los valores existentes se conservan; si no cumplen el nuevo formato se pedirá corregirlos al guardar la pestaña.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'infraestructura_operativa' AND column_name = 'linea_3') THEN
        ALTER TABLE infraestructura_operativa RENAME COLUMN linea_3 TO whatsapp;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'infraestructura_operativa' AND column_name = 'fax') THEN
        ALTER TABLE infraestructura_operativa RENAME COLUMN fax TO enlace_web;
    END IF;
END $$;

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
