from fastapi import HTTPException, status

from ..constantes import ROL_EMPLEADO, ROL_ROOT
from ..repositories import empresas_repository, procesos_repository, usuarios_repository
from ..schemas.proceso import AsignacionEntrada, CambioEstado, ProcesoEntrada


def _error_campo(codigo: int, campo: str, mensaje: str) -> HTTPException:
    return HTTPException(codigo, detail=[{"loc": ["body", campo], "msg": mensaje}])


def listar(usuario: dict, empresa_id: int | None) -> list[dict]:
    return procesos_repository.listar_para_usuario(usuario, empresa_id)


def _con_permisos(usuario: dict, p: dict) -> dict:
    es_root = usuario["rol"] == ROL_ROOT
    es_empleado_asignado = usuario["rol"] == ROL_EMPLEADO and p["empleado_id"] == usuario["id"]
    p["puede_asignar"] = es_root
    p["puede_cambiar_estado"] = es_root or es_empleado_asignado
    # Datos del proceso: root siempre; el cliente solo en «Pendiente»; el empleado no los modifica
    p["puede_editar_datos"] = es_root or (usuario["rol"] not in (ROL_ROOT, ROL_EMPLEADO) and p["estado"] == "Pendiente")
    return p


def obtener_para_usuario(usuario: dict, proceso_id: int) -> dict:
    """root ve todos; cliente los de sus empresas; empleado los asignados a él. Si no, 404."""
    p = procesos_repository.obtener(proceso_id)
    if p:
        if usuario["rol"] == ROL_EMPLEADO:
            permitido = p["empleado_id"] == usuario["id"]
        else:
            permitido = usuario["rol"] == ROL_ROOT or p["usuario_id"] == usuario["id"]
        if not permitido:
            p = None
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proceso no encontrado")
    p["historial"] = procesos_repository.historial(proceso_id)
    return _con_permisos(usuario, p)


def _empleado_valido(empleado_id: int) -> int:
    emp = usuarios_repository.obtener_por_id(empleado_id)
    if not emp or emp["rol"] != ROL_EMPLEADO or not emp["activo"]:
        raise _error_campo(422, "empleado_id", "Seleccione un empleado válido")
    return empleado_id


def crear(usuario: dict, d: ProcesoEntrada) -> dict:
    if usuario["rol"] == ROL_EMPLEADO:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Su rol no puede crear procesos")
    if d.empresa_id is None:
        raise _error_campo(422, "empresa_id", "Seleccione la empresa")
    empresa = empresas_repository.obtener(d.empresa_id)
    if not empresa or (usuario["rol"] != ROL_ROOT and empresa["usuario_id"] != usuario["id"]):
        raise _error_campo(422, "empresa_id", "Seleccione una empresa válida")
    empleado = None
    if usuario["rol"] == ROL_ROOT and d.empleado_id is not None:
        empleado = _empleado_valido(d.empleado_id)  # solo el root asigna; a los demás se les ignora
    pid = procesos_repository.crear(d.empresa_id, d.model_dump(), usuario["id"], empleado)
    return obtener_para_usuario(usuario, pid)


def actualizar(usuario: dict, proceso_id: int, d: ProcesoEntrada) -> dict:
    p = obtener_para_usuario(usuario, proceso_id)
    if not p["puede_editar_datos"]:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Los datos del proceso solo se pueden modificar mientras está «Pendiente».")
    procesos_repository.actualizar_datos(proceso_id, d.model_dump())
    return obtener_para_usuario(usuario, proceso_id)


def asignar(usuario: dict, proceso_id: int, a: AsignacionEntrada) -> dict:
    """Solo root Admin: asigna, reasigna o retira el empleado responsable."""
    p = obtener_para_usuario(usuario, proceso_id)
    if usuario["rol"] != ROL_ROOT:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo el administrador puede asignar procesos")
    empleado = _empleado_valido(a.empleado_id) if a.empleado_id is not None else None
    if empleado != p["empleado_id"]:
        procesos_repository.asignar(proceso_id, empleado, usuario["id"])
    return obtener_para_usuario(usuario, proceso_id)


def cambiar_estado(usuario: dict, proceso_id: int, c: CambioEstado) -> dict:
    """root Admin o el empleado asignado. Orden: Pendiente → En proceso → Vigente. Un proceso Caducado vuelve a
    Vigente (renovación) conservando todo el historial. Caducado se calcula solo al vencer."""
    p = obtener_para_usuario(usuario, proceso_id)
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
