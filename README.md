# CRM Intermediarios ARL — Requerimientos 1 al 4

Modelo de datos y tabla "Mis Registros" del Formulario Único de Intermediarios de Seguros en el Ramo de Riesgos Laborales (ARL).

**Stack:** FastAPI + PostgreSQL (psycopg2, sin ORM) + Next.js 14 + TypeScript + Tailwind.

Esta guía está pensada para **Windows con PowerShell**. Los comandos se escriben uno por uno, en orden.

```
intermediarios-arl/
├── backend/      API (FastAPI) + scripts SQL y utilidades
└── frontend/     Interfaz (Next.js)
```

---

## 0. Requisitos previos

Verifica que tienes instalado (abre PowerShell y ejecuta cada comando):

| Programa | Comando de verificación | Versión esperada |
|---|---|---|
| Python | `python --version` | 3.10 o superior |
| Node.js | `node --version` | 18 o superior |
| npm | `npm --version` | cualquiera |
| PostgreSQL | ver paso 1 | 14 o superior |

> **Importante:** vas a necesitar **dos terminales de PowerShell abiertas al mismo tiempo**: una para el backend y otra para el frontend. Ambas deben quedarse abiertas mientras uses el sistema.

---

## 1. Crear la base de datos

### 1.1. Abrir psql

Si `psql` no está en tu PATH, usa la ruta completa (ajusta el número de versión si es distinto):

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres
```

Te pedirá la contraseña del usuario `postgres` (la que definiste al instalar PostgreSQL).

### 1.2. Crear la base y salir

Dentro de psql (el prompt dice `postgres=#`):

```sql
CREATE DATABASE crm_intermediarios_arl;
\q
```

### 1.3. Crear las tablas

Desde la carpeta raíz del proyecto (`intermediarios-arl`):

```powershell
cd ruta\a\intermediarios-arl
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d crm_intermediarios_arl -f backend\sql\schema.sql
```

Debe terminar sin líneas `ERROR`. Los avisos `NOTICE` se pueden ignorar.

> **¿Ya tenías la base de los requerimientos 1 y 2?** Solo agrega las tablas nuevas de la Pestaña 2 (no borra nada):
>
> ```powershell
> & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d crm_intermediarios_arl -f backend\sql\req3_idoneidad.sql
> ```
>
> Además, en el backend instala la dependencia nueva: `pip install -r requirements.txt`.

> **¿Ya tenías la base del Requerimiento 3?** Agrega solo las tablas de la Pestaña 3 (no borra nada):
>
> ```powershell
> & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d crm_intermediarios_arl -f backend\sql\req4_humana.sql
> ```

> **¿Ya habías creado la base con el primer envío?** En vez del `schema.sql`, ejecuta la migración:
>
> ```powershell
> & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d crm_intermediarios_arl -f backend\sql\migracion_ajustes_req1.sql
> ```
>
> Esto agrega la columna `rol`, vuelve repetible el NIT y agrega la regla de campos obligatorios.

---

## 2. Backend (terminal 1)

### 2.1. Entrar a la carpeta y crear el entorno virtual

```powershell
cd ruta\a\intermediarios-arl\backend
python -m venv venv
```

### 2.2. Activar el entorno virtual

```powershell
venv\Scripts\Activate.ps1
```

Si PowerShell dice que la ejecución de scripts está deshabilitada, ejecuta esto una sola vez y vuelve a activar:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Sabrás que quedó activo porque el prompt empieza con `(venv)`.

### 2.3. Instalar dependencias

```powershell
pip install -r requirements.txt
```

> **Si aparece `Failed building wheel for pydantic-core`:** tu versión de Python es muy nueva para las versiones fijadas y pip intenta compilar con Rust. Actualiza pip y vuelve a instalar (el `requirements.txt` actual ya permite versiones recientes):
>
> ```powershell
> python -m pip install --upgrade pip
> pip install -r requirements.txt
> ```
>
> Si persiste, usa Python 3.12 (`py -3.12 -m venv venv`).

### 2.4. Crear el archivo de configuración `.env`

```powershell
copy .env.example .env
notepad .env
```

Edita estos dos valores y guarda:

```
DATABASE_URL=postgresql://postgres:TU_CONTRASEÑA@localhost:5432/crm_intermediarios_arl
JWT_SECRET=escribe-aqui-una-frase-larga-y-aleatoria-de-mas-de-32-caracteres
```

- El archivo debe llamarse exactamente `.env`. Verifica con `dir -Force` que no quedó como `.env.txt` (el Bloc de notas a veces agrega `.txt`; si pasó, renómbralo con `ren .env.txt .env`).
- Reemplaza `TU_CONTRASEÑA` por la contraseña de `postgres`.
- Si la contraseña tiene caracteres especiales (`@`, `#`, `/`, `:`), hay que codificarlos (por ejemplo `@` se escribe `%40`).
- El resto de variables puedes dejarlas como están.

### 2.5. Crear los usuarios

Los comandos se ejecutan **desde `backend\src`**:

```powershell
cd src
```

Usuario administrador (rol **root Admin**, ve todos los registros):

```powershell
python ..\scripts\crear_usuario.py "Tu Nombre" admin@correo.com TuClave123 --rol "root Admin"
```

Usuario cliente (rol **cliente**, ve solo sus registros). Si no pones `--rol`, el rol es `cliente`. El parámetro `--demo` agrega 3 registros de ejemplo para ver la tabla con datos:

```powershell
python ..\scripts\crear_usuario.py "Cliente Demo" cliente@correo.com clave123 --demo
```

Debe mostrar: `Usuario ... creado con rol '...'`.

> Si dice `duplicate key ... usuarios_email_key`, ese correo ya existe: usa otro.

### 2.6. Cargar el catálogo DANE (necesario desde el Requerimiento 2)

Sin este paso, las listas de Departamento y Ciudad del formulario aparecen vacías.

**1. Descarga el archivo CSV.** Dataset oficial: [DIVIPOLA - Códigos municipios](https://www.datos.gov.co/Mapas-Nacionales/DIVIPOLA-C-digos-municipios/gdxc-w37w) en datos.gov.co. Puedes usar el botón **Exportar → CSV** de esa página, o bajarlo desde PowerShell:

```powershell
Invoke-WebRequest -Uri "https://www.datos.gov.co/api/views/gdxc-w37w/rows.csv?accessType=DOWNLOAD" -OutFile "$HOME\Downloads\divipola.csv"
```

Abre el archivo (con el Bloc de notas) y comprueba que tiene filas con departamentos y municipios, no una página de error.

**2. Cárgalo a la base de datos** (con el `(venv)` activo, desde `backend\src`):

```powershell
python ..\scripts\cargar_divipola.py "$HOME\Downloads\divipola.csv"
```

Debe terminar con `Cargados 33 departamentos y XXXX municipios` (cerca de 1.100 municipios; el número exacto depende del archivo). El script detecta solo las columnas, el separador y la codificación. Si no logra identificar las columnas, muestra cuáles tiene el archivo y las indicas así:

```powershell
python ..\scripts\cargar_divipola.py archivo.csv --col-cod-dpto "NOMBRE_COLUMNA" --col-dpto "NOMBRE_COLUMNA" --col-cod-mpio "NOMBRE_COLUMNA" --col-mpio "NOMBRE_COLUMNA"
```

Puedes ejecutarlo más de una vez: actualiza los datos sin duplicarlos. No hace falta reiniciar el backend.

### 2.7. Arrancar el backend

**Siempre desde `backend\src`** (no desde `backend`):

```powershell
uvicorn app.main:app --reload --port 8000
```

Debe aparecer `Uvicorn running on http://127.0.0.1:8000`. **Deja esta terminal abierta.**

### 2.8. Comprobar que funciona

Abre en el navegador: <http://localhost:8000/docs>

Si ves la documentación de la API (Swagger), el backend está bien. Puedes probar `POST /auth/login` con un usuario creado en el paso 2.5.

---

## 3. Frontend (terminal 2)

Abre una **segunda** terminal de PowerShell:

```powershell
cd ruta\a\intermediarios-arl\frontend
copy .env.local.example .env.local
npm install
npm run dev
```

- `.env.local` debe contener `NEXT_PUBLIC_API_URL=http://localhost:8000`.
- `npm install` tarda unos minutos la primera vez.
- Debe aparecer `Local: http://localhost:3000`. **Deja esta terminal abierta.**

---

## 4. Usar el sistema

1. Abre <http://localhost:3000> en el navegador.
2. Ingresa con el correo y la contraseña que creaste en el paso 2.5.
3. Verás la tabla **Mis Registros** con las columnas RUI, NIT, Razón Social, Ciudad, Estado, Fecha de creación y Fecha de actualización.

Qué esperar según el rol:

- **cliente:** ve únicamente sus propios registros.
- **root Admin:** ve todos los registros y una columna adicional "Propietario".
- **Crear nuevo** abre el formulario (Pestaña 1: Información General). **Ver** lo muestra solo lectura, **Editar** permite modificarlo y **Eliminar** lo marca como eliminado (borrado lógico) tras pedir confirmación.
- El **cliente** solo puede ver, editar y eliminar sus propios registros; el **root Admin** puede con todos.
- La **Pestaña 2: Competencia Profesional** se habilita cuando el registro ya existe (después de guardar la Pestaña 1). La **Pestaña 3: Talento Humano** se habilita igual: datos del responsable (nombres, tipo y número de documento, cargo, correo, teléfono) y su experiencia laboral previa (empresa, cargo, fechas de inicio y fin, funciones) con certificaciones en PDF. Las pestañas 4 y 5 siguen inactivas hasta sus requerimientos.
- En la Pestaña 2 agregas personas (nombres, tipo y número de documento, cargo, correo, teléfono) y adjuntas soportes PDF (máximo 5 MB cada uno). Todo se envía junto con el botón **Guardar** de esa pestaña. Los PDF se guardan en `backend\uploads` (puedes cambiar la carpeta con `UPLOADS_DIR` en el `.env`).

---

## 5. Uso diario (después de la primera instalación)

Cada vez que quieras trabajar:

**Terminal 1 (backend):**

```powershell
cd ruta\a\intermediarios-arl\backend
venv\Scripts\Activate.ps1
cd src
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 (frontend):**

```powershell
cd ruta\a\intermediarios-arl\frontend
npm run dev
```

---

## 6. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| **"Failed to fetch"** o "No se pudo conectar con el servidor" al iniciar sesión | El backend no está corriendo o no se pudo conectar | Revisa que la terminal 1 esté abierta con Uvicorn activo y que <http://localhost:8000/docs> abra. Abre el frontend siempre en `http://localhost:3000`. |
| `'uvicorn' no se reconoce` | La instalación del paso 2.3 falló o el entorno virtual no está activo | Revisa que el prompt muestre `(venv)` y repite `pip install -r requirements.txt` hasta que termine sin errores. |
| `Failed building wheel for pydantic-core` | Python muy nuevo para las versiones antiguas | Ver nota del paso 2.3. |
| `ModuleNotFoundError: No module named 'app'` | Uvicorn se ejecutó desde la carpeta equivocada | Ejecútalo desde `backend\src`. |
| `KeyError: 'DATABASE_URL'` o `'JWT_SECRET'` | Falta el archivo `.env` | Repite el paso 2.4 dentro de `backend`. |
| `password authentication failed for user "postgres"` | Contraseña incorrecta en `DATABASE_URL` | Corrige la contraseña en `.env` (codifica caracteres especiales). |
| `database "crm_intermediarios_arl" does not exist` | No se creó la base | Repite el paso 1.2. |
| `column "rol" does not exist` o error 500 al iniciar sesión | Base creada con el primer envío | Ejecuta la migración del paso 1.3. Luego asigna el rol a tu usuario: `UPDATE usuarios SET rol = 'root Admin' WHERE email = 'admin@correo.com';` |
| "Credenciales inválidas" | Correo o contraseña incorrectos | Verifica el usuario creado o crea otro con el script. |
| `relation "usuarios" does not exist` | No se ejecutó `schema.sql` | Repite el paso 1.3. |
| `Address already in use` / puerto ocupado | Otro programa usa el puerto 8000 o 3000 | Cierra el otro programa o usa otro puerto (`--port 8001` y actualiza `NEXT_PUBLIC_API_URL`). Después de cambiar `.env.local`, reinicia `npm run dev`. |
| `'pip' no se reconoce` | Python no está en el PATH | Reinstala Python marcando "Add Python to PATH", o usa `python -m pip install -r requirements.txt`. |
| El navegador queda en la pantalla de login tras ingresar | Token vencido o inválido | Cierra sesión, borra los datos del sitio `localhost:3000` y vuelve a ingresar. |

---

## 7. Notas de los Requerimientos 1 al 4

- **RUI:** obligatorio y único entre registros no eliminados, sin longitud fija.
- **NIT:** obligatorio, sin dígito de verificación, **puede repetirse**.
- **Campos obligatorios al enviar a revisión:** razón social, departamento, ciudad, dirección, correo y teléfono fijo. Un registro en estado `Borrador` puede estar incompleto.
- **Estados:** Borrador, En revisión, Aprobado, Rechazado.
- **Eliminación:** lógica (el registro se marca como eliminado, no se borra).
- **Requerimiento 2 (Pestaña 1):** al guardar, el registro queda en estado `Borrador`. Solo RUI y NIT son obligatorios (marcados con *); los demás campos se exigen al enviar a revisión (Requerimiento 7).
- **Validaciones de la Pestaña 1:** NIT solo números; correo con formato válido; teléfono fijo de 7 a 10 dígitos; la ciudad debe pertenecer al departamento elegido; el RUI no puede repetirse entre registros activos.
- **Requerimiento 3 (Pestaña 2):** nombres y apellidos, tipo de documento (CC, CE, Pasaporte, PEP) y número de documento son obligatorios por persona; correo con formato válido; teléfono de 7 a 10 dígitos. Solo se aceptan PDF reales de hasta 5 MB. Quitar una persona o un soporte borra también el archivo del disco.
- **Requerimiento 4 (Pestaña 3):** el responsable es uno por registro y todos sus datos son opcionales al guardar borrador (formato validado: correo y teléfono). Cada experiencia exige empresa y cargo; la fecha de inicio es obligatoria y se debe indicar la fecha de fin o marcar «Cargo actual» (que desactiva la fecha de fin; en consulta se muestra «Actualidad»). La fecha de fin no puede ser anterior a la de inicio. Si actualizas desde una versión anterior, vuelve a ejecutar `sql\req4_humana.sql` (agrega la columna `cargo_actual`). Certificaciones: PDF de hasta 5 MB, varias por experiencia.
- **Requerimiento 5 (Pestaña 4):** soportes de la Cámara de Comercio (uno o varios PDF de hasta 5 MB), lista de software/bases de datos y lista de equipos tecnológicos (cada ítem con nombre obligatorio y descripción), líneas telefónicas 1, 2 y 3, fax, correo y dirección de atención (texto libre, independientes de la pestaña 1). Teléfonos de 7 a 10 dígitos, solo números; la línea 1, la línea 2 y el correo llevan asterisco y se exigirán al enviar a revisión (Requerimiento 7). Si actualizas desde una versión anterior, ejecuta `sql\req5_operativa.sql` (es seguro repetirlo).
- **Requerimiento 6 (Pestaña 5):** datos del Representante Legal (nombres y apellidos, tipo y número de documento) y su firma digitalizada, que se puede subir como imagen PNG o JPG (máximo 2 MB; se valida el tipo real del archivo) o dibujar con el mouse/dedo en un lienzo. La firma se puede reemplazar o quitar. Los datos y la firma llevan asterisco y se exigirán al enviar a revisión (Requerimiento 7). Si actualizas desde una versión anterior, ejecuta `sql\req6_firma.sql` (es seguro repetirlo).
- **Requerimiento 7 (navegación y validaciones):** cada pestaña tiene Atrás y Siguiente. «Siguiente» guarda la pestaña actual como borrador (solo si hay cambios) y avanza únicamente si no hay errores; en un registro nuevo crea el registro y abre la pestaña 2. «Atrás» avisa si hay cambios sin guardar. En la pestaña 5, «Enviar a revisión» valida todo lo marcado con asterisco; si falta algo, muestra un resumen por pestaña, marca en rojo las pestañas incompletas y señala los campos. Si está completo, el estado pasa a «En revisión» y el cliente ya no puede modificarlo (el servidor también lo bloquea; root Admin sí puede). Un formulario «Rechazado» vuelve a ser editable y se puede reenviar. No requiere cambios de base de datos.
- **Requerimiento 8 (verificación por correo):** el inicio de sesión tiene dos pasos para los dos roles: 1) correo y contraseña; 2) código de 6 dígitos enviado al correo del usuario. El código vence a los 10 minutos, se bloquea tras 5 intentos fallidos y se puede reenviar pasados 60 segundos (máximo 5 reenvíos). Se pide en cada inicio de sesión. **Interruptor:** la variable `VERIFICACION_CORREO` del `.env` activa o desactiva este paso; por defecto está en `false` (se entra solo con contraseña, ideal para pruebas). Para exigir el código ponla en `true` y reinicia el backend; no hace falta tocar nada más. El código no se guarda en claro. **Actualiza así:** (1) ejecuta `sql\req8_verificacion.sql`; (2) agrega al final de tu `backend\.env` las variables `SMTP_*` y `CODIGO_*` que aparecen en `.env.example`; (3) reinicia el backend. Mientras `SMTP_HOST` esté vacío, **no se envía correo: el código aparece en la consola donde corre el backend** (útil para probar). Para Gmail usa `smtp.gmail.com`, puerto 587, `SMTP_SECURITY=starttls`, tu correo como `SMTP_USER` y una *contraseña de aplicación* (no la normal) como `SMTP_PASSWORD`. Los usuarios deben tener un correo real para recibir el código.
- **Requerimiento 9 (carga masiva de usuarios):** pantalla «Usuarios» (botón en Mis Registros, visible y accesible solo para root Admin) con la lista de usuarios, una plantilla de Excel descargable y el botón «Cargar desde Excel». El Excel lleva las columnas Nombre, Correo y Contraseña (mínimo 8 caracteres, máximo 500 filas y 2 MB por archivo). Todos los usuarios se crean con rol cliente. Los correos que ya existen o se repiten en el archivo se omiten, las filas con error se reportan con su número y motivo, y las válidas se crean igual; al final se muestra un resumen por fila. Una carga de 500 usuarios puede tardar cerca de un minuto (las contraseñas se cifran). **Actualiza así:** `python -m pip install -r requirements.txt` (agrega `openpyxl`), copia `backend\src` y `frontend\src`, y reinicia backend y frontend. No requiere cambios de base de datos.
- **Pendiente:** Req. 5 a 7 (resto de pestañas, navegación y validaciones), Req. 8 (login por correo, ambos roles) y Req. 9 (carga masiva de usuarios por Excel desde el admin).


## Requerimiento 10 — Empresas

Actualizar (desde la carpeta `backend`):

```
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d crm_intermediarios_arl -f sql\req10_empresas.sql
```

Reinicie el backend y el frontend. En «Mis Registros» aparece el botón **Empresas** (`/empresas`): listado con búsqueda por nombre/NIT, crear, editar y eliminar (lógico). Un cliente ve solo sus empresas; root Admin ve todas y elige el cliente propietario. El NIT es único en todo el sistema (entre empresas no eliminadas).

## Requerimiento 10B — Aprobar / Rechazar registros

Actualizar (desde `backend`):

```
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d crm_intermediarios_arl -f sql\req10b_decision.sql
```

Reinicie backend y frontend. El root Admin ve, dentro de un registro «En revisión», el panel **Decisión del administrador** con comentario y botones Aprobar / Rechazar (el rechazo exige comentario). El cliente ve un mensaje de aprobado o de rechazado (con el motivo) dentro del registro y el comentario bajo el estado en «Mis Registros». Al reenviar un registro rechazado a revisión, la decisión anterior se borra.

## Requerimiento 11 — Procesos de afiliación (con rol Empleado y asignación)

Actualizar (desde `backend`; es idempotente, sirve aunque ya hayas corrido una versión anterior):

```
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d crm_intermediarios_arl -f sql\req11_procesos.sql
```

Reinicie backend y frontend. Botón **Procesos** (`/procesos`).
- El cliente (o el root) crea procesos para empresas; quedan «Pendiente». Una empresa puede tener varios.
- Nuevo rol **empleado**: se crea con `python ..\scripts\crear_usuario.py "Nombre" correo clave --rol empleado` o con la columna opcional «Rol» del Excel de carga masiva (`cliente` o `empleado`; vacío = cliente).
- El root asigna un empleado a cada proceso (al crearlo o después, y puede reasignar o retirar). El empleado ve solo sus procesos asignados y la empresa de cada uno (solo lectura), y puede avanzar el estado. No accede a Mis Registros ni a Usuarios.
- Estados: Pendiente → En proceso → Vigente (fecha de inicio + periodo Mensual/Anual; el vencimiento se calcula). «Caducado» aparece solo al llegar el vencimiento; se renueva pasando a Vigente con nuevas fechas y el historial se conserva (incluye asignaciones).


## Requerimiento 12 — Formulario de Diagnóstico

Actualizar:

```
# 1) desde la carpeta backend
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d crm_intermediarios_arl -f sql\req12_diagnostico.sql
# 2) nueva dependencia (genera el PDF), con el (.venv) activo:
python -m pip install reportlab
```

Reinicie backend y frontend. Botón **Diagnósticos** (`/diagnosticos`): elija una empresa y pulse «Crear». Los datos generales se precargan de la empresa (y se guardan como copia en el diagnóstico); el intermediario se elige entre los registros del Formulario Único del cliente dueño de la empresa. Una empresa puede tener varios diagnósticos (historial por fecha). Lo diligencian cliente, root y el empleado con la empresa asignada.

Reglas del resultado (se recalculan al abrir): SG-SST = cantidad de «Sí» sobre 9 (nivel pendiente de definir); Accidentalidad: Alta si hay AT mortales/invalidez, Media si hay AT, Baja si no; Enfermedad laboral: Alta si hay calificadas, Media si hay en calificación, Baja si no; Factores de riesgo: se listan los existentes. El resultado se descarga en PDF.

## Requerimiento 13 — Dashboard del administrador

No requiere SQL nuevo. Reemplace los archivos y reinicie backend y frontend. Al iniciar sesión, el root Admin entra al **Dashboard** (`/dashboard`); el cliente a «Mis Registros» y el empleado a «Procesos». Tarjetas: Total de empresas, con proceso en curso (Pendiente o En proceso), vigente, caducado, sin ningún proceso y vigencia por vencer (próximos 30 días). Cada empresa cuenta una sola vez según su proceso más reciente (por fecha de creación), así que en curso + vigente + caducado + sin proceso = total; «por vencer» es un subconjunto de vigente. Al pulsar una tarjeta se abre la lista de Empresas filtrada (también se puede usar `/empresas?estado=en_curso|vigente|caducado|sin_proceso|por_vencer`); la lista ahora muestra el estado del proceso de cada empresa.

## Requerimiento 14A — Documentos por empresa y por proceso

Actualizar (desde `backend`):

```
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d crm_intermediarios_arl -f sql\req14a_documentos.sql
```

Reinicie backend y frontend. Los documentos aparecen al final de la pantalla de **editar empresa** y del **detalle de un proceso**. PDF, PNG o JPG de hasta 5 MB; tipo de documento (Cámara de Comercio, RUT, Formulario de afiliación, Cédula del representante legal, Otro) y descripción opcional. Suben y reemplazan el cliente dueño, el root y el empleado asignado; **Reemplazar** crea una versión nueva y conserva las anteriores (historial descargable). Solo el root elimina (eliminación lógica). Los archivos se guardan en la carpeta `uploads` del backend.

## Requerimiento 14B — Gestión de usuarios (rol y activación)

No requiere SQL nuevo. Reemplace los archivos y reinicie backend y frontend. En **Usuarios** (solo root Admin) cada fila tiene un selector de rol (cliente, empleado, root Admin) y el botón **Desactivar / Activar**, ambos con confirmación en la misma fila.

- **Cambio de rol:** se bloquea mientras el usuario tenga datos asociados: empresas activas, registros activos o procesos asignados como empleado (la columna «Datos asociados» lo muestra). Primero hay que reasignar o retirar esos datos. Nadie puede cambiar su propio rol.
- **Desactivar:** el usuario pierde el acceso de inmediato (su sesión actual deja de funcionar y no puede iniciar sesión). Sus datos y las asignaciones de procesos se conservan; esos procesos se marcan «(inactivo)» junto al empleado, con un aviso para reasignar. No se puede reasignar a un empleado inactivo. Nadie puede desactivar su propia cuenta.
- Endpoints (solo root): `PATCH /usuarios/{id}/rol` y `PATCH /usuarios/{id}/activo`.

## Requerimiento 15 — Menú lateral y repositorio de documentos (RUI y SG-SST)

Actualizar (desde `backend`, con el SQL idempotente):

```
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d crm_intermediarios_arl -f sql\req15_secciones.sql
```

Reinicie backend y frontend. Todas las pantallas (menos el login) tienen un **menú lateral izquierdo**; reemplaza los botones de navegación que había arriba de cada pantalla (en celular se abre con el botón «Menú»). Ítems según el rol:

- root Admin: Dashboard, Mis Registros, Empresas, Procesos, Diagnósticos, Usuarios. Cliente: sin Dashboard ni Usuarios. Empleado: sin Dashboard, Mis Registros ni Usuarios.
- Todos los roles: **RUI** y **SG-SST** (Programas: Medicina Laboral, Higiene y Seguridad Industrial, Riesgo Psicosocial, Trabajo en Alturas, Trabajo Seguro, Inspecciones · Planes: PESV · Políticas · Matrices: identificación de peligros y valoración de riesgos, Matriz legal).

Cada ítem de RUI/SG-SST abre un repositorio de documentos: se elige la **empresa** (cada rol ve las que ya podía ver: root todas, cliente las suyas, empleado las de sus procesos asignados) y se suben varios documentos con **título** y descripción opcional. Reglas iguales a 14A: PDF/PNG/JPG hasta 5 MB, «Reemplazar» crea una versión nueva con historial, cliente y empleado no eliminan y solo el root elimina. Los documentos de cada sección están separados entre sí y de los documentos por tipo de 14A. Endpoints: `GET|POST /empresas/{id}/secciones/{seccion}/documentos`.
