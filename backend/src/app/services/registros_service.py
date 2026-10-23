from fastapi import HTTPException, status
from psycopg2.errors import UniqueViolation

from ..constantes import ROL_ROOT
from ..repositories import catalogos_repository, registros_repository
from ..schemas.registro import DecisionEntrada, RegistroEntrada
from . import revision_service

ESTADOS_BLOQUEADOS = ("En revisión", "Aprobado")  # el cliente no puede editar en estos estados
ESTADOS_ENVIABLES = ("Borrador", "Rechazado")


def _error_campo(codigo: int, campo: str, mensaje: str) -> HTTPException:
    return HTTPException(codigo, detail=[{"loc": ["body", campo], "msg": mensaje}])


def _error_rui_duplicado() -> HTTPException:
    return _error_campo(status.HTTP_409_CONFLICT, "rui", "Ya existe un registro con ese RUI")


def listar_mis_registros(usuario: dict) -> list[dict]:
    return registros_repository.listar_para_usuario(usuario)


def obtener_para_usuario(usuario: dict, registro_id: int) -> dict:
    """root Admin accede a cualquiera; cliente solo a los suyos. Si no, 404 (no revela existencia)."""
    registro = registros_repository.obtener(registro_id)
    if not registro or (usuario["rol"] != ROL_ROOT and registro["usuario_id"] != usuario["id"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Registro no encontrado")
    registro["editable"] = _es_editable(usuario, registro)
    registro["puede_decidir"] = usuario["rol"] == ROL_ROOT and registro["estado"] == "En revisión"
    return registro


def _es_editable(usuario: dict, registro: dict) -> bool:
    """El cliente solo edita en Borrador o Rechazado; root Admin siempre."""
    return usuario["rol"] == ROL_ROOT or registro["estado"] not in ESTADOS_BLOQUEADOS


def obtener_editable(usuario: dict, registro_id: int) -> dict:
    """Igual que obtener_para_usuario, pero además exige que el formulario se pueda modificar."""
    registro = obtener_para_usuario(usuario, registro_id)
    if not registro["editable"]:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            f"El formulario está en estado «{registro['estado']}» y no se puede modificar.")
    return registro


def _validar_ubicacion(datos: RegistroEntrada) -> None:
    if datos.municipio_codigo and not datos.departamento_codigo:
        raise _error_campo(422, "departamento_codigo", "Seleccione primero el departamento")
    if datos.departamento_codigo and not catalogos_repository.existe_departamento(datos.departamento_codigo):
        raise _error_campo(422, "departamento_codigo", "Departamento no válido")
    if datos.municipio_codigo and not catalogos_repository.municipio_pertenece(
        datos.municipio_codigo, datos.departamento_codigo
    ):
        raise _error_campo(422, "municipio_codigo", "La ciudad no pertenece al departamento seleccionado")


def crear(usuario: dict, datos: RegistroEntrada) -> dict:
    _validar_ubicacion(datos)
    try:
        nuevo_id = registros_repository.crear(usuario["id"], datos.model_dump())
    except UniqueViolation:
        raise _error_rui_duplicado()
    return obtener_para_usuario(usuario, nuevo_id)


def actualizar(usuario: dict, registro_id: int, datos: RegistroEntrada) -> dict:
    obtener_editable(usuario, registro_id)
    _validar_ubicacion(datos)
    try:
        registros_repository.actualizar(registro_id, datos.model_dump())
    except UniqueViolation:
        raise _error_rui_duplicado()
    return obtener_para_usuario(usuario, registro_id)


def enviar_a_revision(usuario: dict, registro_id: int) -> dict:
    """Valida todas las pestañas; si están completas pasa el estado a 'En revisión'."""
    registro = obtener_para_usuario(usuario, registro_id)
    if registro["estado"] not in ESTADOS_ENVIABLES:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            f"El formulario está en estado «{registro['estado']}» y no se puede enviar a revisión.")
    pendientes = revision_service.faltantes(registro)
    if pendientes:
        raise HTTPException(422, detail={
            "mensaje": "Faltan campos obligatorios. Revise las pestañas marcadas.", "faltantes": pendientes,
        })
    registros_repository.cambiar_estado(registro_id, "En revisión")
    return obtener_para_usuario(usuario, registro_id)


def decidir(usuario: dict, registro_id: int, d: DecisionEntrada) -> dict:
    """root Admin aprueba o rechaza un registro 'En revisión' (el rechazo exige comentario)."""
    registro = obtener_para_usuario(usuario, registro_id)
    if usuario["rol"] != ROL_ROOT:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo el administrador puede aprobar o rechazar")
    if registro["estado"] != "En revisión" or not registros_repository.registrar_decision(
            registro_id, d.decision, d.comentario, usuario["id"]):
        raise HTTPException(status.HTTP_409_CONFLICT, "Solo se pueden aprobar o rechazar registros «En revisión».")
    return obtener_para_usuario(usuario, registro_id)


def eliminar(usuario: dict, registro_id: int) -> None:
    obtener_para_usuario(usuario, registro_id)
    registros_repository.eliminar_logico(registro_id)
