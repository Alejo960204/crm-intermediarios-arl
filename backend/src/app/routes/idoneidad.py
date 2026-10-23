import json

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

from ..dependencies import get_current_user
from ..schemas.idoneidad import PersonaOut
from ..services import idoneidad_service

router = APIRouter(prefix="/registros/{registro_id}/idoneidad", tags=["Pestaña 2: Idoneidad Profesional"])


@router.get("", response_model=list[PersonaOut])
def listar(registro_id: int, usuario: dict = Depends(get_current_user)):
    return idoneidad_service.listar(usuario, registro_id)


@router.put("", response_model=list[PersonaOut])
async def guardar(registro_id: int, request: Request, usuario: dict = Depends(get_current_user)):
    """multipart/form-data: campo 'personas' (JSON) + archivos en campos 'archivos__<clave de fila>'."""
    form = await request.form()
    try:
        personas = json.loads(form.get("personas") or "[]")
        if not isinstance(personas, list):
            raise ValueError
    except ValueError:
        raise HTTPException(422, detail=[{"loc": ["body", "personas"], "msg": "Formato de personas no válido"}])

    archivos: dict[str, list[tuple[str, bytes]]] = {}
    for campo, valor in form.multi_items():
        if campo.startswith("archivos__") and hasattr(valor, "filename"):
            archivos.setdefault(campo[len("archivos__"):], []).append((valor.filename or "archivo.pdf", await valor.read()))

    return await run_in_threadpool(idoneidad_service.guardar, usuario, registro_id, personas, archivos)


@router.get("/soportes/{soporte_id}")
def descargar(registro_id: int, soporte_id: int, usuario: dict = Depends(get_current_user)):
    ruta, nombre = idoneidad_service.obtener_ruta_soporte(usuario, registro_id, soporte_id)
    return FileResponse(ruta, media_type="application/pdf", filename=nombre)
