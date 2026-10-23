from fastapi import APIRouter, Depends, HTTPException, Request, Response
from starlette.concurrency import run_in_threadpool

from ..dependencies import requiere_root
from ..repositories import usuarios_repository
from ..schemas.usuarios import CambioActivo, CambioRol, ResultadoCarga, UsuarioListado
from ..services import usuarios_service

router = APIRouter(prefix="/usuarios", tags=["Usuarios (solo root Admin)"], dependencies=[Depends(requiere_root)])

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("", response_model=list[UsuarioListado])
def listar():
    return usuarios_repository.listar()


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


@router.patch("/{usuario_id}/activo", response_model=UsuarioListado)
def cambiar_activo(usuario_id: int, datos: CambioActivo, actor: dict = Depends(requiere_root)):
    return usuarios_service.cambiar_activo(actor, usuario_id, datos.activo)
