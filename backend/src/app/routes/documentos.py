from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

from ..dependencies import get_current_user
from ..schemas.documento import TIPOS_DOCUMENTO, DocumentoOut
from ..services import documentos_service

router = APIRouter(tags=["Documentos"])


async def _leer(request: Request) -> tuple[str, str | None, tuple[str, bytes] | None, str]:
    """multipart/form-data: campos 'tipo' (14A) o 'titulo' (secciones), 'descripcion' (opcional) y 'archivo'."""
    form = await request.form()
    archivo = None
    v = form.get("archivo")
    if v is not None and hasattr(v, "filename"):
        archivo = (v.filename or "documento", await v.read())
    return (str(form.get("tipo") or ""), (str(form["descripcion"]) if form.get("descripcion") else None), archivo,
            str(form.get("titulo") or ""))


@router.get("/documentos/tipos", response_model=list[str])
def tipos():
    return TIPOS_DOCUMENTO


@router.get("/empresas/{empresa_id}/documentos", response_model=list[DocumentoOut])
def listar_empresa(empresa_id: int, usuario: dict = Depends(get_current_user)):
    return documentos_service.listar(usuario, empresa_id, None)


@router.post("/empresas/{empresa_id}/documentos", response_model=DocumentoOut, status_code=status.HTTP_201_CREATED)
async def subir_empresa(empresa_id: int, request: Request, usuario: dict = Depends(get_current_user)):
    tipo, desc, archivo, _ = await _leer(request)
    return await run_in_threadpool(documentos_service.subir, usuario, empresa_id, None, tipo, desc, archivo)


@router.get("/empresas/{empresa_id}/secciones/{seccion}/documentos", response_model=list[DocumentoOut])
def listar_seccion(empresa_id: int, seccion: str, usuario: dict = Depends(get_current_user)):
    return documentos_service.listar(usuario, empresa_id, None, seccion)


@router.post("/empresas/{empresa_id}/secciones/{seccion}/documentos", response_model=DocumentoOut,
             status_code=status.HTTP_201_CREATED)
async def subir_seccion(empresa_id: int, seccion: str, request: Request, usuario: dict = Depends(get_current_user)):
    _, desc, archivo, titulo = await _leer(request)
    return await run_in_threadpool(documentos_service.subir, usuario, empresa_id, None, "", desc, archivo, seccion, titulo)


@router.get("/procesos/{proceso_id}/documentos", response_model=list[DocumentoOut])
def listar_proceso(proceso_id: int, usuario: dict = Depends(get_current_user)):
    return documentos_service.listar(usuario, None, proceso_id)


@router.post("/procesos/{proceso_id}/documentos", response_model=DocumentoOut, status_code=status.HTTP_201_CREATED)
async def subir_proceso(proceso_id: int, request: Request, usuario: dict = Depends(get_current_user)):
    tipo, desc, archivo, _ = await _leer(request)
    return await run_in_threadpool(documentos_service.subir, usuario, None, proceso_id, tipo, desc, archivo)


@router.post("/documentos/{documento_id}/versiones", response_model=DocumentoOut)
async def reemplazar(documento_id: int, request: Request, usuario: dict = Depends(get_current_user)):
    """Reemplazo: agrega una versión nueva y conserva las anteriores."""
    _, _, archivo, _ = await _leer(request)
    return await run_in_threadpool(documentos_service.reemplazar, usuario, documento_id, archivo)


@router.get("/documentos/{documento_id}/versiones/{version}/descargar")
def descargar(documento_id: int, version: int, usuario: dict = Depends(get_current_user)):
    ruta, mime, nombre = documentos_service.ruta_descarga(usuario, documento_id, version)
    return FileResponse(ruta, media_type=mime, filename=nombre)


@router.delete("/documentos/{documento_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(documento_id: int, usuario: dict = Depends(get_current_user)):
    documentos_service.eliminar(usuario, documento_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
