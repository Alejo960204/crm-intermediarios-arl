from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routes import auth, catalogos, dashboard, diagnosticos, documentos, empresas, firma, humana, idoneidad, mi_panel, operativa, procesos, registros, usuarios

app = FastAPI(title="CRM Intermediarios ARL")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",  # desarrollo local, cualquier puerto
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(registros.router)
app.include_router(catalogos.router)
app.include_router(idoneidad.router)
app.include_router(humana.router)
app.include_router(operativa.router)
app.include_router(firma.router)
app.include_router(usuarios.router)
app.include_router(empresas.router)
app.include_router(procesos.router)
app.include_router(diagnosticos.router)
app.include_router(dashboard.router)
app.include_router(documentos.router)
app.include_router(mi_panel.router)
