from fastapi import HTTPException, status
from pydantic import TypeAdapter, ValidationError

from .. import storage
from ..repositories import humana_repository
from ..schemas.humana import HumanaEntrada
from . import registros_service

MAX_BYTES = 5 * 1024 * 1024  # 5 MB por archivo
_adapter = TypeAdapter(HumanaEntrada)


def _error(loc: list, mensaje: str) -> HTTPException:
    return HTTPException(422, detail=[{"loc": ["body", *loc], "msg": mensaje}])


def obtener(usuario: dict, registro_id: int) -> dict:
    registros_service.obtener_para_usuario(usuario, registro_id)
    return humana_repository.obtener(registro_id)


def obtener_ruta_soporte(usuario: dict, registro_id: int, soporte_id: int):
    registros_service.obtener_para_usuario(usuario, registro_id)
    soporte = humana_repository.obtener_soporte(registro_id, soporte_id)
    if not soporte:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Soporte no encontrado")
    ruta = storage.ruta_absoluta(soporte["ruta_archivo"])
    if not ruta.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "El archivo ya no está disponible")
    return ruta, soporte["nombre_original"]


def guardar(usuario: dict, registro_id: int, datos_json, archivos: dict[str, list[tuple[str, bytes]]]) -> dict:
    """datos_json: dict ya decodificado. archivos: clave de experiencia -> [(nombre, contenido)]."""
    registros_service.obtener_editable(usuario, registro_id)

    try:
        datos = _adapter.validate_python(datos_json)
    except ValidationError as e:
        detalle = [
            {"loc": ["body", *err["loc"]], "msg": str(err["msg"]).replace("Value error, ", "")}
            for err in e.errors()
        ]
        raise HTTPException(422, detail=detalle)

    claves = [x.clave for x in datos.experiencias]
    if len(set(claves)) != len(claves):
        raise _error(["experiencias"], "Filas duplicadas en el envío")
    indice = {c: i for i, c in enumerate(claves)}

    for clave, lista in archivos.items():  # validar todo antes de escribir nada
        if clave not in indice:
            raise _error(["experiencias"], "Se recibieron archivos de una fila desconocida")
        for nombre, contenido in lista:
            loc = ["experiencias", indice[clave], "soportes"]
            if not nombre.lower().endswith(".pdf") or not contenido.startswith(b"%PDF-"):
                raise _error(loc, f"'{nombre}' no es un PDF válido")
            if len(contenido) == 0:
                raise _error(loc, f"'{nombre}' está vacío")
            if len(contenido) > MAX_BYTES:
                raise _error(loc, f"'{nombre}' supera el máximo de 5 MB")

    creados: list[str] = []
    nuevos: dict[str, list[dict]] = {}
    try:
        for clave, lista in archivos.items():
            for nombre, contenido in lista:
                ruta = storage.guardar_pdf(registro_id, contenido, carpeta="humana")
                creados.append(ruta)
                nuevos.setdefault(clave, []).append({"nombre_original": nombre, "ruta": ruta, "tamano": len(contenido)})
        rutas_eliminadas = humana_repository.sincronizar(
            registro_id, datos.responsable.model_dump(), [x.model_dump() for x in datos.experiencias], nuevos
        )
    except ValueError as e:
        for r in creados:
            storage.eliminar(r)
        raise _error(["experiencias"], str(e))
    except Exception:
        for r in creados:
            storage.eliminar(r)
        raise

    for r in rutas_eliminadas:
        storage.eliminar(r)
    return humana_repository.obtener(registro_id)
