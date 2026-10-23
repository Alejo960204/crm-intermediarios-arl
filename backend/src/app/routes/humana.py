import json

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

from ..dependencies import get_current_user
from ..schemas.humana import HumanaOut
from ..services import humana_service

router = APIRouter(prefix="/registros/{registro_id}/infraestructura-humana",
                   tags=["Pestaña 3: Infraestructura Humana"])


@router.get("", response_model=HumanaOut)
def obtener(registro_id: int, usuario: dict = Depends(get_current_user)):
    return humana_service.obtener(usuario, registro_id)


@router.put("", response_model=HumanaOut)
async def guardar(registro_id: int, request: Request, usuario: dict = Depends(get_current_user)):
    """multipart/form-data: campo 'datos' (JSON) + archivos en campos 'archivos__<clave de experiencia>'."""
    form = await request.form()
    try:
        datos = json.loads(form.get("datos") or "{}")
        if not isinstance(datos, dict):
            raise ValueError
    except ValueError:
        raise HTTPException(422, detail=[{"loc": ["body", "datos"], "msg": "Formato de datos no válido"}])

    archivos: dict[str, list[tuple[str, bytes]]] = {}
    for campo, valor in form.multi_items():
        if campo.startswith("archivos__") and hasattr(valor, "filename"):
            archivos.setdefault(campo[len("archivos__"):], []).append((valor.filename or "archivo.pdf", await valor.read()))

    return await run_in_threadpool(humana_service.guardar, usuario, registro_id, datos, archivos)


@router.get("/soportes/{soporte_id}")
def descargar(registro_id: int, soporte_id: int, usuario: dict = Depends(get_current_user)):
    ruta, nombre = humana_service.obtener_ruta_soporte(usuario, registro_id, soporte_id)
    return FileResponse(ruta, media_type="application/pdf", filename=nombre)
