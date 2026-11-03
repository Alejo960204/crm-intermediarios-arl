from fastapi import HTTPException, status

from .. import storage
from ..constantes import ROL_ROOT
from ..repositories import documentos_repository as repo
from ..schemas.documento import SECCIONES, TIPOS_DOCUMENTO
from . import empresas_service, historial_service, procesos_service
from ..repositories import procesos_repository

MAX_BYTES = 5 * 1024 * 1024  # 5 MB


def _error(campo: str, mensaje: str) -> HTTPException:
    return HTTPException(422, detail=[{"loc": ["body", campo], "msg": mensaje}])


def _tipo_archivo(contenido: bytes) -> tuple[str, str] | None:
    """Tipo real por los primeros bytes: (mime, extensión). Solo PDF, PNG o JPG."""
    if contenido.startswith(b"%PDF"):
        return "application/pdf", "pdf"
    if contenido.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if contenido.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    return None


def _validar_archivo(archivo: tuple[str, bytes] | None) -> tuple[str, bytes, str, str]:
    if not archivo:
        raise _error("archivo", "Seleccione un archivo")
    nombre, contenido = archivo
    if not contenido:
        raise _error("archivo", f"'{nombre}' está vacío")
    if len(contenido) > MAX_BYTES:
        raise _error("archivo", f"'{nombre}' supera el máximo de 5 MB")
    t = _tipo_archivo(contenido)
    if not t or not nombre.lower().endswith((".pdf", ".png", ".jpg", ".jpeg")):
        raise _error("archivo", f"'{nombre}' no es un PDF, PNG o JPG válido")
    return nombre, contenido, t[0], t[1]


def _salida(usuario: dict, d: dict) -> dict:
    actual = d["versiones"][0]
    return {
        "id": d["id"], "tipo": d["tipo"], "titulo": d["titulo"], "seccion": d["seccion"], "descripcion": d["descripcion"], "version_actual": actual["version"],
        "nombre_original": actual["nombre_original"], "tamano_bytes": actual["tamano_bytes"],
        "content_type": actual["content_type"], "subido_por": actual["subido_por"], "fecha": actual["fecha"],
        "fecha_creacion": d["fecha_creacion"], "versiones": d["versiones"],
        "puede_eliminar": usuario["rol"] == ROL_ROOT,
    }


def _acceso_objetivo(usuario: dict, empresa_id: int | None, proceso_id: int | None, escritura: bool = False) -> None:
    """Misma regla que ver la empresa o el proceso (404 si no corresponde). Para escribir, la empresa debe estar activa."""
    if empresa_id is not None:
        e = empresas_service.obtener_para_usuario(usuario, empresa_id)
        if escritura:
            empresas_service.exigir_activa(e)
    else:
        p = procesos_service.obtener_para_usuario(usuario, proceso_id)
        if escritura:
            empresas_service.exigir_activa({"inactiva": p.get("empresa_inactiva")})


def _historial(usuario: dict, accion: str, d: dict, archivo: str | None = None) -> None:
    """Deja constancia en el historial de la empresa (también para documentos de un proceso)."""
    empresa_id = d["empresa_id"]
    de_proceso = ""
    if empresa_id is None:
        p = procesos_repository.obtener(d["proceso_id"])
        empresa_id, de_proceso = (p["empresa_id"] if p else None), f" · proceso #{d['proceso_id']}"
    if empresa_id is None:
        return
    nombre = d.get("titulo") or d.get("tipo") or "Documento"
    historial_service.registrar(usuario, empresa_id, "documento", accion,
                                detalle=f"{nombre}" + (f" — {archivo}" if archivo else "") + de_proceso)


def _documento(usuario: dict, documento_id: int) -> dict:
    d = repo.obtener(documento_id)
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Documento no encontrado")
    _acceso_objetivo(usuario, d["empresa_id"], d["proceso_id"])
    return d


def _seccion_valida(seccion: str | None) -> None:
    if seccion is not None and seccion not in SECCIONES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sección no encontrada")


def listar(usuario: dict, empresa_id: int | None, proceso_id: int | None, seccion: str | None = None) -> list[dict]:
    _seccion_valida(seccion)
    _acceso_objetivo(usuario, empresa_id, proceso_id)
    return [_salida(usuario, d) for d in repo.listar(empresa_id, proceso_id, seccion)]


def subir(usuario: dict, empresa_id: int | None, proceso_id: int | None, tipo: str, descripcion: str | None,
          archivo: tuple[str, bytes] | None, seccion: str | None = None, titulo: str | None = None) -> dict:
    _seccion_valida(seccion)
    _acceso_objetivo(usuario, empresa_id, proceso_id, escritura=True)
    if seccion:  # Req 15: título libre en lugar del tipo
        titulo = (titulo or "").strip()
        if not titulo:
            raise _error("titulo", "El título es obligatorio")
        if len(titulo) > 150:
            raise _error("titulo", "Máximo 150 caracteres")
        tipo = None
    else:
        titulo = None
        tipo = (tipo or "").strip()
        if tipo not in TIPOS_DOCUMENTO:
            raise _error("tipo", "Seleccione el tipo de documento")
    descripcion = (descripcion or "").strip() or None
    if descripcion and len(descripcion) > 500:
        raise _error("descripcion", "Máximo 500 caracteres")
    nombre, contenido, mime, ext = _validar_archivo(archivo)
    ruta = None
    try:
        # La carpeta se identifica con un id provisional; el archivo se guarda antes de confirmar la transacción
        ruta = storage.guardar_pdf(empresa_id or proceso_id, contenido,
                                   carpeta="documentos_empresa" if empresa_id else "documentos_proceso", extension=ext)
        did = repo.crear(empresa_id, proceso_id, tipo, descripcion, usuario["id"],
                         {"nombre_original": nombre, "ruta": ruta, "content_type": mime, "tamano_bytes": len(contenido)},
                         seccion, titulo)
    except Exception:
        if ruta:
            storage.eliminar(ruta)
        raise
    nuevo = repo.obtener(did)
    _historial(usuario, "Documento subido", nuevo, nombre)
    return _salida(usuario, nuevo)


def reemplazar(usuario: dict, documento_id: int, archivo: tuple[str, bytes] | None) -> dict:
    """Agrega una versión nueva (las anteriores se conservan). Quien tiene acceso al documento puede reemplazar."""
    d = _documento(usuario, documento_id)
    _acceso_objetivo(usuario, d["empresa_id"], d["proceso_id"], escritura=True)
    nombre, contenido, mime, ext = _validar_archivo(archivo)
    carpeta = "documentos_empresa" if d["empresa_id"] else "documentos_proceso"
    ruta = None
    try:
        ruta = storage.guardar_pdf(d["empresa_id"] or d["proceso_id"], contenido, carpeta=carpeta, extension=ext)
        repo.agregar_version(documento_id, {"nombre_original": nombre, "ruta": ruta, "content_type": mime,
                                            "tamano_bytes": len(contenido)}, usuario["id"])
    except Exception:
        if ruta:
            storage.eliminar(ruta)
        raise
    actual = repo.obtener(documento_id)
    _historial(usuario, f"Nueva versión de documento (v{actual['versiones'][0]['version']})", actual, nombre)
    return _salida(usuario, actual)


def eliminar(usuario: dict, documento_id: int) -> None:
    """Solo root Admin (eliminación lógica: los archivos y versiones se conservan)."""
    d = _documento(usuario, documento_id)
    if usuario["rol"] != ROL_ROOT:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo el administrador puede eliminar documentos")
    repo.eliminar_logico(documento_id)
    _historial(usuario, "Documento eliminado", d)


def ruta_descarga(usuario: dict, documento_id: int, version: int):
    d = _documento(usuario, documento_id)
    v = next((x for x in d["versiones"] if x["version"] == version), None)
    if not v:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Versión no encontrada")
    ruta = storage.ruta_absoluta(v["ruta"])
    if not ruta.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "El archivo ya no está disponible")
    return ruta, v["content_type"], v["nombre_original"]
