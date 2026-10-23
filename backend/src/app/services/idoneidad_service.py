from fastapi import HTTPException, status
from pydantic import TypeAdapter, ValidationError

from .. import storage
from ..repositories import idoneidad_repository
from ..schemas.idoneidad import PersonaEntrada
from . import registros_service

MAX_BYTES = 5 * 1024 * 1024  # 5 MB por archivo
_personas_adapter = TypeAdapter(list[PersonaEntrada])


def _error(loc: list, mensaje: str, codigo: int = 422) -> HTTPException:
    return HTTPException(codigo, detail=[{"loc": ["body", *loc], "msg": mensaje}])


def listar(usuario: dict, registro_id: int) -> list[dict]:
    registros_service.obtener_para_usuario(usuario, registro_id)
    return idoneidad_repository.listar(registro_id)


def obtener_ruta_soporte(usuario: dict, registro_id: int, soporte_id: int):
    registros_service.obtener_para_usuario(usuario, registro_id)
    soporte = idoneidad_repository.obtener_soporte(registro_id, soporte_id)
    if not soporte:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Soporte no encontrado")
    ruta = storage.ruta_absoluta(soporte["ruta_archivo"])
    if not ruta.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "El archivo ya no está disponible")
    return ruta, soporte["nombre_original"]


def guardar(usuario: dict, registro_id: int, personas_json, archivos: dict[str, list[tuple[str, bytes]]]) -> list[dict]:
    """personas_json: lista ya decodificada. archivos: clave de fila -> [(nombre, contenido)]."""
    registros_service.obtener_editable(usuario, registro_id)

    try:
        personas = _personas_adapter.validate_python(personas_json)
    except ValidationError as e:
        detalle = [
            {"loc": ["body", "personas", *err["loc"]], "msg": str(err["msg"]).replace("Value error, ", "")}
            for err in e.errors()
        ]
        raise HTTPException(422, detail=detalle)

    claves = [p.clave for p in personas]
    if len(set(claves)) != len(claves):
        raise _error(["personas"], "Filas duplicadas en el envío")
    indice = {c: i for i, c in enumerate(claves)}

    # 1) Validar todos los archivos antes de escribir nada
    for clave, lista in archivos.items():
        if clave not in indice:
            raise _error(["personas"], "Se recibieron archivos de una fila desconocida")
        for nombre, contenido in lista:
            loc = ["personas", indice[clave], "soportes"]
            if not nombre.lower().endswith(".pdf") or not contenido.startswith(b"%PDF-"):
                raise _error(loc, f"'{nombre}' no es un PDF válido")
            if len(contenido) == 0:
                raise _error(loc, f"'{nombre}' está vacío")
            if len(contenido) > MAX_BYTES:
                raise _error(loc, f"'{nombre}' supera el máximo de 5 MB")

    # 2) Escribir archivos, 3) sincronizar en una transacción, 4) limpiar
    creados: list[str] = []
    nuevos: dict[str, list[dict]] = {}
    try:
        for clave, lista in archivos.items():
            for nombre, contenido in lista:
                ruta = storage.guardar_pdf(registro_id, contenido)
                creados.append(ruta)
                nuevos.setdefault(clave, []).append({"nombre_original": nombre, "ruta": ruta, "tamano": len(contenido)})
        filas = [p.model_dump() for p in personas]
        rutas_eliminadas = idoneidad_repository.sincronizar(registro_id, filas, nuevos)
    except ValueError as e:
        for r in creados:
            storage.eliminar(r)
        raise _error(["personas"], str(e))
    except Exception:
        for r in creados:
            storage.eliminar(r)
        raise

    for r in rutas_eliminadas:
        storage.eliminar(r)
    return idoneidad_repository.listar(registro_id)
