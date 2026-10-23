# Despliegue de la demo — CRM Intermediarios ARL

Resultado final: un link público (Vercel) que cualquiera puede abrir y probar.

```
Navegador  →  Vercel (frontend Next.js)  →  Render (backend FastAPI)  →  Neon (PostgreSQL)
```

Todo en planes gratuitos. Tiempo estimado: 45 a 60 minutos la primera vez.

> **Aviso de la demo:** (1) En Render gratis el backend se «duerme» tras 15 minutos sin uso; la primera visita después tarda ~50 segundos en responder. (2) Los PDF y firmas que se suban **se pierden** cuando Render reinicia o redespliega (el disco gratuito no es permanente). Para una demo está bien; para producción hay que pasar los archivos a almacenamiento en la nube. (3) Usa solo datos ficticios.

---

## Paso 1. Subir el código a GitHub (descomprimido)

Render y Vercel no leen un `.zip`: necesitan las carpetas `backend` y `frontend` sueltas.

1. Descomprime el proyecto. Deben verse las carpetas `backend` y `frontend` juntas dentro de una carpeta (por ejemplo `intermediarios-arl`).
2. En github.com crea un repositorio **nuevo y vacío** (por ejemplo `crm-intermediarios-arl`). Puede ser privado.
3. En PowerShell:

```powershell
cd ruta\a\intermediarios-arl
git init
git add .
git commit -m "CRM Intermediarios ARL - demo"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/crm-intermediarios-arl.git
git push -u origin main
```

4. Comprueba en GitHub que ves las carpetas `backend` y `frontend`, y que **no** aparecen `.env`, `venv` ni `node_modules` (los `.gitignore` ya los excluyen).

---

## Paso 2. Base de datos en Neon

1. Entra a <https://neon.tech> y crea una cuenta (puedes usar GitHub).
2. Crea un proyecto: nombre `crm-arl`, región lo más cercana posible (por ejemplo AWS US East).
3. En el panel pulsa **Connect** y copia la **connection string**. Se ve así:

```
postgresql://usuario:clave@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

   Guárdala: la usarás aquí y en Render. Debe terminar en `?sslmode=require`.

4. Crea las tablas (desde la carpeta raíz del proyecto, con tu `psql` de Windows):

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" "PEGA_AQUI_LA_CONNECTION_STRING" -f backend\sql\schema.sql
```

   `schema.sql` ya incluye todos los requerimientos hasta el 15, así que **no** ejecutes los `req*.sql`. No debe mostrar líneas `ERROR` (los `NOTICE` se ignoran).

---

## Paso 3. Cargar catálogo DANE y usuarios de prueba (desde tu PC, hacia Neon)

Estos scripts usan `DATABASE_URL`; aquí apuntan a Neon sin tocar tu base local.

```powershell
cd ruta\a\intermediarios-arl\backend
venv\Scripts\Activate.ps1
cd src
$env:DATABASE_URL = "PEGA_AQUI_LA_CONNECTION_STRING"
$env:JWT_SECRET = "solo-para-este-script-1234567890-abcdefghij"
python ..\scripts\cargar_divipola.py "$HOME\Downloads\divipola.csv"
python ..\scripts\crear_usuarios_demo.py
```

- Usa el mismo CSV de DIVIPOLA que ya tenías cargado en tu base local. Debe terminar con `Cargados 33 departamentos y XXXX municipios`.
- El segundo script crea: `admin@demo.com` (root Admin), `cliente@demo.com` (cliente, con 3 registros de ejemplo) y `empleado@demo.com` (empleado). Clave de los tres: `Demo2026!` (cámbiala con `--clave OtraClave` si quieres).
- Al cerrar la terminal, las variables `$env:` desaparecen: tu configuración local no se altera.

---

## Paso 4. Backend en Render

1. Entra a <https://render.com> y crea una cuenta con GitHub.
2. **New +** → **Web Service** → elige tu repositorio `crm-intermediarios-arl`.
3. Configura:

| Campo | Valor |
|---|---|
| Name | `crm-arl-api` (define el link) |
| Region | la más cercana a Neon |
| Branch | `main` |
| **Root Directory** | `backend` |
| Runtime | Python 3 |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `cd src && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | Free |

4. En **Environment Variables** agrega:

| Variable | Valor |
|---|---|
| `PYTHON_VERSION` | `3.12.7` |
| `DATABASE_URL` | la connection string de Neon (completa, con `?sslmode=require`) |
| `JWT_SECRET` | una frase larga y aleatoria **nueva** (mínimo 40 caracteres; distinta a la local) |
| `CORS_ORIGINS` | por ahora `http://localhost:3000` (lo cambias en el paso 6) |
| `VERIFICACION_CORREO` | `false` |

5. Pulsa **Create Web Service**. El primer despliegue tarda unos 3 a 5 minutos.
6. Cuando diga **Live**, abre `https://TU-SERVICIO.onrender.com/docs`. Si ves el Swagger, el backend funciona. Copia esa URL base (sin `/docs`).

---

## Paso 5. Frontend en Vercel

1. Entra a <https://vercel.com> y crea una cuenta con GitHub.
2. **Add New…** → **Project** → importa `crm-intermediarios-arl`.
3. Configura:
   - **Framework Preset:** Next.js (se detecta solo).
   - **Root Directory:** pulsa *Edit* y elige `frontend`.
   - **Environment Variables:** `NEXT_PUBLIC_API_URL` = la URL de Render del paso 4 (sin barra final, por ejemplo `https://crm-arl-api.onrender.com`).
4. Pulsa **Deploy**. En 1 a 2 minutos te da el link, por ejemplo `https://crm-intermediarios-arl.vercel.app`.

> `NEXT_PUBLIC_API_URL` se «hornea» al construir. Si la cambias después, debes hacer **Redeploy** en Vercel.

---

## Paso 6. Conectar los dos (CORS)

Sin este paso el login falla con «Failed to fetch».

1. En Render → tu servicio → **Environment** → edita `CORS_ORIGINS` y pon el link de Vercel, **sin barra final**:

```
https://crm-intermediarios-arl.vercel.app
```

2. Guarda: Render redespliega solo (1 a 2 minutos).

---

## Paso 7. Probar el link

1. Abre el link de Vercel. La primera vez espera hasta ~1 minuto (el backend se está despertando).
2. Ingresa con `admin@demo.com` / `Demo2026!` y recorre Dashboard, Empresas, Procesos y Diagnósticos.
3. Prueba también `cliente@demo.com` y `empleado@demo.com` para ver cada rol.

Ese link de Vercel es el que compartes. Entrégalo junto con los 3 usuarios de prueba.

---

## Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| «Failed to fetch» al iniciar sesión | CORS mal configurado o `NEXT_PUBLIC_API_URL` incorrecta | Revisa el paso 6 (sin barra final) y que `NEXT_PUBLIC_API_URL` apunte a Render; si la cambiaste, redespliega Vercel. |
| El login tarda ~1 minuto la primera vez | Render gratis dormido | Es normal; espera y reintenta. |
| Render: `Falta la variable DATABASE_URL` | Variable sin guardar | Revísala en Environment. |
| `SSL connection is required` o error de conexión a Neon | Falta `?sslmode=require` | Usa la connection string completa tal como la da Neon. |
| `ModuleNotFoundError: No module named 'app'` | Start Command sin `cd src` | Usa exactamente `cd src && uvicorn app.main:app --host 0.0.0.0 --port $PORT`. |
| Listas de departamento y ciudad vacías | No se cargó DIVIPOLA en Neon | Repite el paso 3. |
| Error al construir en Render con `pydantic-core` | Python demasiado nuevo | Verifica `PYTHON_VERSION` = `3.12.7`. |
| Los PDF subidos desaparecen | Disco efímero de Render | Esperado en la demo (ver aviso inicial). |

## Antes de pasar a producción real

- Pasar los archivos subidos a almacenamiento en la nube (S3 o similar); `storage.py` ya está aislado para ese cambio.
- Activar `VERIFICACION_CORREO=true` y configurar SMTP.
- Cambiar las claves de los usuarios demo o eliminarlos.
- Pasar Render y Neon a planes sin suspensión.
