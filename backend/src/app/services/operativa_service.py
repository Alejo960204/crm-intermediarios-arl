from fastapi import HTTPException, status
from pydantic import TypeAdapter, ValidationError

from .. import storage
from ..repositories import operativa_repository
from ..schemas.operativa import OperativaEntrada
from . import registros_service

MAX_BYTES = 5 * 1024 * 1024  # 5 MB por archivo
_adapter = TypeAdapter(OperativaEntrada)


def _error(loc: list, mensaje: str) -> HTTPException:
    return HTTPException(422, detail=[{"loc": ["body", *loc], "msg": mensaje}])


def obtener(usuario: dict, registro_id: int) -> dict:
    registros_service.obtener_para_usuario(usuario, registro_id)
    return operativa_repository.obtener(registro_id)


def obtener_ruta_soporte(usuario: dict, registro_id: int, soporte_id: int):
    registros_service.obtener_para_usuario(usuario, registro_id)
    soporte = operativa_repository.obtener_soporte(registro_id, soporte_id)
    if not soporte:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Soporte no encontrado")
    ruta = storage.ruta_absoluta(soporte["ruta_archivo"])
    if not ruta.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "El archivo ya no está disponible")
    return ruta, soporte["nombre_original"]


def guardar(usuario: dict, registro_id: int, datos_json, archivos: list[tuple[str, bytes]]) -> dict:
    registros_service.obtener_editable(usuario, registro_id)

    try:
        datos = _adapter.validate_python(datos_json)
    except ValidationError as e:
        raise HTTPException(422, detail=[
            {"loc": ["body", *err["loc"]], "msg": str(err["msg"]).replace("Value error, ", "")} for err in e.errors()
        ])

    for nombre, contenido in archivos:  # validar todo antes de escribir nada
        if not nombre.lower().endswith(".pdf") or not contenido.startswith(b"%PDF-"):
            raise _error(["soportes"], f"'{nombre}' no es un PDF válido")
        if len(contenido) == 0:
            raise _error(["soportes"], f"'{nombre}' está vacío")
        if len(contenido) > MAX_BYTES:
            raise _error(["soportes"], f"'{nombre}' supera el máximo de 5 MB")

    creados: list[str] = []
    nuevos: list[dict] = []
    try:
        for nombre, contenido in archivos:
            ruta = storage.guardar_pdf(registro_id, contenido, carpeta="operativa")
            creados.append(ruta)
            nuevos.append({"nombre_original": nombre, "ruta": ruta, "tamano": len(contenido)})
        rutas_eliminadas = operativa_repository.sincronizar(
            registro_id, datos.model_dump(), [i.model_dump() for i in datos.software],
            [i.model_dump() for i in datos.equipos], datos.soportes_conservar, nuevos,
        )
    except ValueError as e:
        for r in creados:
            storage.eliminar(r)
        raise _error(["soportes"], str(e))
    except Exception:
        for r in creados:
            storage.eliminar(r)
        raise

    for r in rutas_eliminadas:
        storage.eliminar(r)
    return operativa_repository.obtener(registro_id)
