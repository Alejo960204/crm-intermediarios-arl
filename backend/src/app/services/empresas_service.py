from fastapi import HTTPException, status
from psycopg2.errors import UniqueViolation

from ..alcance import puede_ver_empresa
from ..constantes import ROL_CLIENTE, ROL_EMPLEADO, ROL_EMPRESA, ROL_ROOT, ROLES_DE_EMPRESA
from ..repositories import catalogos_repository, empresas_repository, historial_repository, paquetes_repository, usuarios_repository
from ..security import hash_password
from . import historial_service, paquetes_service
from ..schemas.empresa import (CupoEmpleadosEntrada, EmpleadoEntrada, EmpresaEntrada, EmpresaNueva, LoginEmpresaEntrada)


def _error_campo(codigo: int, campo: str, mensaje: str) -> HTTPException:
    return HTTPException(codigo, detail=[{"loc": ["body", campo], "msg": mensaje}])


def listar(usuario: dict, categoria: str | None = None) -> list[dict]:
    if categoria is not None and categoria not in empresas_repository.CATEGORIAS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Filtro no válido")
    return empresas_repository.listar_para_usuario(usuario, categoria)


def obtener_para_usuario(usuario: dict, empresa_id: int, escritura: bool = False) -> dict:
    """Administrador accede a cualquiera; intermediario a las suyas; empresa y empleado solo a su empresa.
    Si no, 404 (no revela existencia)."""
    empresa = empresas_repository.obtener(empresa_id)
    if not empresa or not puede_ver_empresa(usuario, empresa):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Empresa no encontrada")
    return empresa


def _solo_gestion(usuario: dict) -> None:
    """Crear, inactivar y administrar el acceso de empresas es de administrador e intermediario."""
    if usuario["rol"] in ROLES_DE_EMPRESA:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Su rol no puede realizar esta acción")


def _validar_ubicacion(d: EmpresaEntrada) -> None:
    if d.municipio_codigo and not d.departamento_codigo:
        raise _error_campo(422, "departamento_codigo", "Seleccione primero el departamento")
    if d.departamento_codigo and not catalogos_repository.existe_departamento(d.departamento_codigo):
        raise _error_campo(422, "departamento_codigo", "Departamento no válido")
    if d.municipio_codigo and not catalogos_repository.municipio_pertenece(d.municipio_codigo, d.departamento_codigo):
        raise _error_campo(422, "municipio_codigo", "La ciudad no pertenece al departamento seleccionado")


def _propietario(usuario: dict, d: EmpresaEntrada, obligatorio: bool) -> int | None:
    """Cliente: siempre él mismo (ignora usuario_id). Root: debe indicar el cliente propietario."""
    if usuario["rol"] != ROL_ROOT:
        return usuario["id"]
    if d.usuario_id is None:
        if obligatorio:
            raise _error_campo(422, "usuario_id", "Seleccione el intermediario propietario de la empresa")
        return None
    dueno = usuarios_repository.obtener_por_id(d.usuario_id)
    if not dueno or dueno["rol"] != ROL_CLIENTE or not dueno["activo"]:
        raise _error_campo(422, "usuario_id", "Seleccione un intermediario válido")
    return d.usuario_id


def _error_nit() -> HTTPException:
    return _error_campo(status.HTTP_409_CONFLICT, "nit", "Ya existe una empresa con ese NIT")


def _error_correo() -> HTTPException:
    return _error_campo(status.HTTP_409_CONFLICT, "login_email", "Ya existe un usuario con ese correo")


def crear(usuario: dict, d: EmpresaNueva) -> dict:
    _solo_gestion(usuario)
    _validar_ubicacion(d)
    dueno = _propietario(usuario, d, True)
    email = str(d.login_email).strip().lower()
    if email in usuarios_repository.correos_existentes():
        raise _error_correo()
    if usuario["rol"] == ROL_CLIENTE:  # el administrador no tiene límite; el intermediario, el de su paquete
        paquetes_service.verificar_puede_crear(usuario["id"])
    paquete = paquetes_repository.actual(dueno)  # la empresa se cuenta contra el paquete vigente de su intermediario
    try:
        nuevo = empresas_repository.crear(dueno, d.model_dump(include=set(empresas_repository.CAMPOS)),
                                          paquete["id"] if paquete else None, d.max_empleados)
    except UniqueViolation:
        raise _error_nit()
    usuarios_repository.crear_de_empresa(d.nombre, email, hash_password(d.login_password), ROL_EMPRESA, nuevo)
    historial_service.registrar(usuario, nuevo, "datos", "Empresa creada", detalle=f"{d.nombre} (NIT {d.nit})")
    historial_service.registrar(usuario, nuevo, "acceso", "Usuario de la empresa creado", detalle=email)
    if d.max_empleados is not None:
        historial_service.registrar(usuario, nuevo, "datos", "Cupo de empleados definido", "Cupo de empleados", "", str(d.max_empleados))
    return obtener_para_usuario(usuario, nuevo)


def actualizar(usuario: dict, empresa_id: int, d: EmpresaEntrada) -> dict:
    antes = obtener_para_usuario(usuario, empresa_id, escritura=True)
    exigir_activa(antes)
    _validar_ubicacion(d)
    dueno = _propietario(usuario, d, False) if usuario["rol"] == ROL_ROOT else None  # el cliente no reasigna
    try:
        empresas_repository.actualizar(empresa_id, dueno, d.model_dump(include=set(empresas_repository.CAMPOS)))
    except UniqueViolation:
        raise _error_nit()
    despues = obtener_para_usuario(usuario, empresa_id)
    cambios = historial_service.cambios_empresa(antes, despues)  # una fila por campo que cambió
    historial_service.registrar_varios(usuario, empresa_id, "datos", "Datos modificados", cambios)
    return despues


def cupo(usuario: dict) -> dict:
    return paquetes_service.cupo(usuario)


def exigir_activa(empresa: dict) -> None:
    """Una empresa inactiva solo se consulta: ninguna escritura sobre ella ni sobre sus procesos, documentos o diagnósticos."""
    if empresa.get("inactiva"):
        raise HTTPException(status.HTTP_409_CONFLICT, "La empresa está inactiva: solo se puede consultar. Reactívela para modificarla.")


def cambiar_activa(usuario: dict, empresa_id: int, activa: bool) -> dict:
    """Inactivar / reactivar (reemplaza a eliminar). No libera ni consume cupo."""
    _solo_gestion(usuario)
    obtener_para_usuario(usuario, empresa_id, escritura=True)
    empresas_repository.cambiar_inactiva(empresa_id, not activa)
    historial_service.registrar(usuario, empresa_id, "datos", "Empresa reactivada" if activa else "Empresa inactivada")
    return obtener_para_usuario(usuario, empresa_id)


# ---------- Req 21B: login de la empresa, cupo de empleados y empleados ----------
def crear_login(usuario: dict, empresa_id: int, d: LoginEmpresaEntrada) -> dict:
    """Para empresas que aún no tienen usuario de acceso (las creadas antes de la 21B)."""
    _solo_gestion(usuario)
    empresa = obtener_para_usuario(usuario, empresa_id)
    if empresa["login_email"]:
        raise HTTPException(status.HTTP_409_CONFLICT, "La empresa ya tiene usuario de acceso")
    email = str(d.email).strip().lower()
    if email in usuarios_repository.correos_existentes():
        raise _error_campo(status.HTTP_409_CONFLICT, "email", "Ya existe un usuario con ese correo")
    usuarios_repository.crear_de_empresa(empresa["nombre"], email, hash_password(d.password), ROL_EMPRESA, empresa_id)
    historial_service.registrar(usuario, empresa_id, "acceso", "Usuario de la empresa creado", detalle=email)
    return obtener_para_usuario(usuario, empresa_id)


def cambiar_cupo_empleados(usuario: dict, empresa_id: int, d: CupoEmpleadosEntrada) -> dict:
    """Intermediario dueño o administrador. Bajar el cupo por debajo de los empleados activos se permite:
    conservan el acceso, pero no se pueden crear más."""
    _solo_gestion(usuario)
    e = obtener_para_usuario(usuario, empresa_id)
    exigir_activa(e)
    empresas_repository.cambiar_max_empleados(empresa_id, d.max_empleados)
    ant, nue = historial_service._texto(e["max_empleados"]), historial_service._texto(d.max_empleados)
    if ant != nue:
        historial_service.registrar(usuario, empresa_id, "datos", "Cupo de empleados modificado", "Cupo de empleados", ant, nue)
    return obtener_para_usuario(usuario, empresa_id)


def _puede_gestionar_empleados(usuario: dict) -> bool:
    return usuario["rol"] in (ROL_ROOT, ROL_EMPRESA)


def empleados(usuario: dict, empresa_id: int) -> dict:
    if usuario["rol"] == ROL_EMPLEADO:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Su rol no puede ver los empleados")
    e = obtener_para_usuario(usuario, empresa_id)
    activos, maximo = e["empleados"], e["max_empleados"]
    disponibles = None if maximo is None else max(maximo - activos, 0)
    return {"empleados": usuarios_repository.listar_empleados(empresa_id), "activos": activos, "maximo": maximo,
            "disponibles": disponibles,
            "puede_crear": _puede_gestionar_empleados(usuario) and not e["inactiva"]
                           and (usuario["rol"] == ROL_ROOT or disponibles is None or disponibles > 0)}


def _verificar_cupo_empleados(usuario: dict, e: dict) -> None:
    if usuario["rol"] == ROL_ROOT:  # el administrador no tiene límite de cupo
        return
    if e["max_empleados"] is not None and e["empleados"] >= e["max_empleados"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            f"Alcanzó el cupo de empleados de la empresa ({e['empleados']} de {e['max_empleados']}). "
                            "Solicite al intermediario ampliar el cupo.")


def crear_empleado(usuario: dict, empresa_id: int, d: EmpleadoEntrada) -> dict:
    if not _puede_gestionar_empleados(usuario):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo la empresa o el administrador pueden crear empleados")
    e = obtener_para_usuario(usuario, empresa_id)
    exigir_activa(e)
    _verificar_cupo_empleados(usuario, e)
    email = str(d.email).strip().lower()
    if email in usuarios_repository.correos_existentes():
        raise _error_campo(status.HTTP_409_CONFLICT, "email", "Ya existe un usuario con ese correo")
    usuarios_repository.crear_de_empresa(d.nombre, email, hash_password(d.password), ROL_EMPLEADO, empresa_id)
    historial_service.registrar(usuario, empresa_id, "empleado", "Empleado creado", detalle=f"{d.nombre} ({email})")
    return empleados(usuario, empresa_id)


def cambiar_activo_empleado(usuario: dict, empresa_id: int, empleado_id: int, activo: bool) -> dict:
    """Desactivar corta el acceso al instante y libera cupo; reactivar respeta el cupo. No se elimina."""
    if not _puede_gestionar_empleados(usuario):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo la empresa o el administrador pueden administrar empleados")
    e = obtener_para_usuario(usuario, empresa_id)
    emp = usuarios_repository.obtener_por_id(empleado_id)
    if not emp or emp["rol"] != ROL_EMPLEADO or emp["empresa_id"] != empresa_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Empleado no encontrado")
    if emp["activo"] != activo:
        if activo:
            exigir_activa(e)
            _verificar_cupo_empleados(usuario, e)
        usuarios_repository.cambiar_activo(empleado_id, activo)
        historial_service.registrar(usuario, empresa_id, "empleado", "Empleado reactivado" if activo else "Empleado desactivado",
                                    detalle=f"{emp['nombre']} ({emp['email']})")
    return empleados(usuario, empresa_id)


def historial(usuario: dict, empresa_id: int) -> list[dict]:
    """Administrador, intermediario dueño y usuario Empresa. El empleado no lo ve."""
    if usuario["rol"] == ROL_EMPLEADO:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Su rol no puede ver el historial de cambios")
    obtener_para_usuario(usuario, empresa_id)
    return historial_repository.listar(empresa_id)
