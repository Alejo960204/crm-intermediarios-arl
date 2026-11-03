from fastapi import HTTPException, status

from ..alcance import puede_ver_empresa
from ..constantes import ROL_ROOT, ROLES_DE_EMPRESA
from ..repositories import empresas_repository, procesos_repository
from . import empresas_service
from ..schemas.proceso import CambioEstado, ProcesoEntrada


def _error_campo(codigo: int, campo: str, mensaje: str) -> HTTPException:
    return HTTPException(codigo, detail=[{"loc": ["body", campo], "msg": mensaje}])


def listar(usuario: dict, empresa_id: int | None) -> list[dict]:
    return procesos_repository.listar_para_usuario(usuario, empresa_id)


def _con_permisos(usuario: dict, p: dict) -> dict:
    es_root = usuario["rol"] == ROL_ROOT
    # Solo el administrador avanza los estados. El intermediario edita los datos mientras está «Pendiente»;
    # la empresa y sus empleados solo consultan los procesos.
    p["puede_cambiar_estado"] = es_root
    p["puede_editar_datos"] = es_root or (usuario["rol"] not in ((ROL_ROOT,) + ROLES_DE_EMPRESA) and p["estado"] == "Pendiente")
    return p


def obtener_para_usuario(usuario: dict, proceso_id: int) -> dict:
    """Administrador ve todos; intermediario los de sus empresas; empresa y empleado los de su empresa. Si no, 404."""
    p = procesos_repository.obtener(proceso_id)
    if p and not puede_ver_empresa(usuario, {"id": p["empresa_id"], "usuario_id": p["usuario_id"]}):
        p = None
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proceso no encontrado")
    p["historial"] = procesos_repository.historial(proceso_id)
    return _con_permisos(usuario, p)


def _activa(p: dict) -> None:
    empresas_service.exigir_activa({"inactiva": p.get("empresa_inactiva")})


def crear(usuario: dict, d: ProcesoEntrada) -> dict:
    if usuario["rol"] in ROLES_DE_EMPRESA:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Su rol no puede crear procesos")
    if d.empresa_id is None:
        raise _error_campo(422, "empresa_id", "Seleccione la empresa")
    empresa = empresas_repository.obtener(d.empresa_id)
    if not empresa or (usuario["rol"] != ROL_ROOT and empresa["usuario_id"] != usuario["id"]):
        raise _error_campo(422, "empresa_id", "Seleccione una empresa válida")
    empresas_service.exigir_activa(empresa)
    pid = procesos_repository.crear(d.empresa_id, d.model_dump(), usuario["id"])
    return obtener_para_usuario(usuario, pid)


def actualizar(usuario: dict, proceso_id: int, d: ProcesoEntrada) -> dict:
    p = obtener_para_usuario(usuario, proceso_id)
    _activa(p)
    if not p["puede_editar_datos"]:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Los datos del proceso solo se pueden modificar mientras está «Pendiente».")
    procesos_repository.actualizar_datos(proceso_id, d.model_dump())
    return obtener_para_usuario(usuario, proceso_id)


def cambiar_estado(usuario: dict, proceso_id: int, c: CambioEstado) -> dict:
    """Solo el administrador. Orden: Pendiente → En proceso → Vigente. Un proceso Caducado vuelve a
    Vigente (renovación) conservando todo el historial. Caducado se calcula solo al vencer."""
    p = obtener_para_usuario(usuario, proceso_id)
    _activa(p)
    if not p["puede_cambiar_estado"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tiene permiso para cambiar el estado de este proceso")
    actual = p["estado"]
    permitido = {("Pendiente", "En proceso"): "Cambio de estado", ("En proceso", "Vigente"): "Cambio de estado",
                 ("Caducado", "Vigente"): "Renovación"}
    accion = permitido.get((actual, c.estado))
    if not accion:
        raise HTTPException(status.HTTP_409_CONFLICT, f"No se puede pasar de «{actual}» a «{c.estado}».")
    if c.estado == "Vigente":
        if c.fecha_inicio is None:
            raise _error_campo(422, "fecha_inicio", "Indique la fecha de inicio de la vigencia")
        if c.periodo is None:
            raise _error_campo(422, "periodo", "Seleccione el periodo (Mensual o Anual)")
    procesos_repository.cambiar_estado(proceso_id, accion, c.estado, c.fecha_inicio, c.periodo,
                                       c.observacion, usuario["id"])
    return obtener_para_usuario(usuario, proceso_id)
