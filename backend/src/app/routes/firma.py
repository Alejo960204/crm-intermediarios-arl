import json

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

from ..dependencies import get_current_user
from ..schemas.firma import FirmaOut
from ..services import firma_service

router = APIRouter(prefix="/registros/{registro_id}/firma", tags=["Pestaña 5: Firma Digitalizada"])


@router.get("", response_model=FirmaOut)
def obtener(registro_id: int, usuario: dict = Depends(get_current_user)):
    return firma_service.obtener(usuario, registro_id)


@router.put("", response_model=FirmaOut)
async def guardar(registro_id: int, request: Request, usuario: dict = Depends(get_current_user)):
    """multipart/form-data: campo 'datos' (JSON) + imagen opcional de la firma en el campo 'firma'."""
    form = await request.form()
    try:
        datos = json.loads(form.get("datos") or "{}")
        if not isinstance(datos, dict):
            raise ValueError
    except ValueError:
        raise HTTPException(422, detail=[{"loc": ["body", "datos"], "msg": "Formato de datos no válido"}])

    archivo = None
    valor = form.get("firma")
    if valor is not None and hasattr(valor, "filename"):
        archivo = (valor.filename or "firma.png", await valor.read())

    return await run_in_threadpool(firma_service.guardar, usuario, registro_id, datos, archivo)


@router.get("/imagen")
def imagen(registro_id: int, usuario: dict = Depends(get_current_user)):
    ruta, tipo, nombre = firma_service.obtener_ruta_firma(usuario, registro_id)
    return FileResponse(ruta, media_type=tipo, filename=nombre)
