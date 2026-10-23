from fastapi import HTTPException, status
from pydantic import TypeAdapter, ValidationError

from .. import storage
from ..repositories import firma_repository
from ..schemas.firma import FirmaEntrada
from . import registros_service

MAX_BYTES = 2 * 1024 * 1024  # 2 MB
_adapter = TypeAdapter(FirmaEntrada)


def _error(loc: list, mensaje: str) -> HTTPException:
    return HTTPException(422, detail=[{"loc": ["body", *loc], "msg": mensaje}])


def _tipo_imagen(contenido: bytes) -> tuple[str, str] | None:
    """Detecta el tipo real por los primeros bytes: (mime, extensión)."""
    if contenido.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if contenido.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    return None


def obtener(usuario: dict, registro_id: int) -> dict:
    registros_service.obtener_para_usuario(usuario, registro_id)
    return firma_repository.obtener(registro_id)


def obtener_ruta_firma(usuario: dict, registro_id: int):
    registros_service.obtener_para_usuario(usuario, registro_id)
    f = firma_repository.obtener_ruta_firma(registro_id)
    if not f:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No hay firma registrada")
    ruta = storage.ruta_absoluta(f["firma_ruta"])
    if not ruta.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "El archivo ya no está disponible")
    return ruta, f["firma_tipo"], f["firma_nombre"]


def guardar(usuario: dict, registro_id: int, datos_json, archivo: tuple[str, bytes] | None) -> dict:
    registros_service.obtener_editable(usuario, registro_id)

    try:
        datos = _adapter.validate_python(datos_json)
    except ValidationError as e:
        raise HTTPException(422, detail=[
            {"loc": ["body", *err["loc"]], "msg": str(err["msg"]).replace("Value error, ", "")} for err in e.errors()
        ])

    tipo = None
    if archivo:
        nombre, contenido = archivo
        if len(contenido) == 0:
            raise _error(["firma"], f"'{nombre}' está vacío")
        if len(contenido) > MAX_BYTES:
            raise _error(["firma"], f"'{nombre}' supera el máximo de 2 MB")
        tipo = _tipo_imagen(contenido)
        if not tipo or not nombre.lower().endswith((".png", ".jpg", ".jpeg")):
            raise _error(["firma"], f"'{nombre}' no es una imagen PNG o JPG válida")

    creada: str | None = None
    nueva = None
    try:
        if archivo and tipo:
            creada = storage.guardar_pdf(registro_id, archivo[1], carpeta="firma", extension=tipo[1])
            nueva = {"ruta": creada, "nombre_original": archivo[0], "tipo": tipo[0], "tamano": len(archivo[1])}
        retiradas = firma_repository.sincronizar(
            registro_id,
            {"nombres_apellidos": datos.nombres_apellidos, "tipo_documento": datos.tipo_documento,
             "numero_documento": datos.numero_documento},
            datos.quitar_firma, nueva,
        )
    except Exception:
        if creada:
            storage.eliminar(creada)
        raise

    for r in retiradas:
        storage.eliminar(r)
    return firma_repository.obtener(registro_id)
