from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from starlette.concurrency import run_in_threadpool

from ..dependencies import requiere_root
from ..repositories import usuarios_repository
from ..schemas.usuarios import (CambioActivo, CambioRol, NuevoIntermediario, PaqueteEntrada, PaqueteHistorial, ResultadoCarga,
                                UsuarioListado)
from ..services import usuarios_service

router = APIRouter(prefix="/usuarios", tags=["Intermediarios y usuarios (solo administrador)"], dependencies=[Depends(requiere_root)])

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("", response_model=list[UsuarioListado])
def listar():
    return usuarios_service.listar()


@router.post("", response_model=UsuarioListado, status_code=status.HTTP_201_CREATED)
def crear_intermediario(datos: NuevoIntermediario, actor: dict = Depends(requiere_root)):
    """Crea un intermediario con su primer paquete (nombre, cantidad de empresas, periodicidad y fecha de inicio)."""
    return usuarios_service.crear_intermediario(actor, datos)


@router.get("/plantilla")
def plantilla():
    return Response(usuarios_service.plantilla_xlsx(), media_type=XLSX,
                    headers={"Content-Disposition": 'attachment; filename="plantilla_usuarios.xlsx"'})


@router.post("/carga-masiva", response_model=ResultadoCarga)
async def carga_masiva(request: Request):
    """multipart/form-data: archivo Excel (.xlsx) en el campo 'archivo'."""
    form = await request.form()
    archivo = form.get("archivo")
    if archivo is None or not hasattr(archivo, "filename"):
        raise HTTPException(422, "Seleccione un archivo Excel (.xlsx).")
    if not (archivo.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(422, "El archivo debe ser un Excel .xlsx.")
    return await run_in_threadpool(usuarios_service.cargar_excel, await archivo.read())


@router.patch("/{usuario_id}/rol", response_model=UsuarioListado)
def cambiar_rol(usuario_id: int, datos: CambioRol, actor: dict = Depends(requiere_root)):
    return usuarios_service.cambiar_rol(actor, usuario_id, datos.rol)


@router.get("/{usuario_id}/paquetes", response_model=list[PaqueteHistorial])
def historial_paquetes(usuario_id: int):
    return usuarios_service.historial_paquetes(usuario_id)


@router.post("/{usuario_id}/paquetes", response_model=UsuarioListado, status_code=status.HTTP_201_CREATED)
def asignar_paquete(usuario_id: int, datos: PaqueteEntrada, actor: dict = Depends(requiere_root)):
    """Nuevo paquete o renovación (el cupo empieza de cero; atiende la solicitud de ampliación pendiente)."""
    return usuarios_service.asignar_paquete(actor, usuario_id, datos)


@router.post("/{usuario_id}/solicitud/atender", response_model=UsuarioListado)
def atender_solicitud(usuario_id: int, actor: dict = Depends(requiere_root)):
    return usuarios_service.atender_solicitud(actor, usuario_id)


@router.patch("/{usuario_id}/activo", response_model=UsuarioListado)
def cambiar_activo(usuario_id: int, datos: CambioActivo, actor: dict = Depends(requiere_root)):
    return usuarios_service.cambiar_activo(actor, usuario_id, datos.activo)
