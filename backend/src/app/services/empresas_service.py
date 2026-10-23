from fastapi import HTTPException, status
from psycopg2.errors import UniqueViolation

from ..constantes import ROL_CLIENTE, ROL_EMPLEADO, ROL_ROOT
from ..repositories import catalogos_repository, empresas_repository, usuarios_repository
from ..schemas.empresa import EmpresaEntrada


def _error_campo(codigo: int, campo: str, mensaje: str) -> HTTPException:
    return HTTPException(codigo, detail=[{"loc": ["body", campo], "msg": mensaje}])


def listar(usuario: dict, categoria: str | None = None) -> list[dict]:
    if categoria is not None and categoria not in empresas_repository.CATEGORIAS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Filtro no válido")
    return empresas_repository.listar_para_usuario(usuario, categoria)


def obtener_para_usuario(usuario: dict, empresa_id: int, escritura: bool = False) -> dict:
    """root Admin accede a cualquiera; cliente solo a las suyas; empleado (solo lectura) a las de sus procesos
    asignados. Si no, 404 (no revela existencia)."""
    empresa = empresas_repository.obtener(empresa_id)
    if empresa and usuario["rol"] == ROL_EMPLEADO:
        if escritura:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Su rol solo puede consultar las empresas")
        if empresas_repository.empleado_tiene_proceso(usuario["id"], empresa_id):
            return empresa
        empresa = None
    if not empresa or (usuario["rol"] not in (ROL_ROOT,) and empresa["usuario_id"] != usuario["id"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Empresa no encontrada")
    return empresa


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
            raise _error_campo(422, "usuario_id", "Seleccione el cliente propietario de la empresa")
        return None
    dueno = usuarios_repository.obtener_por_id(d.usuario_id)
    if not dueno or dueno["rol"] != ROL_CLIENTE or not dueno["activo"]:
        raise _error_campo(422, "usuario_id", "Seleccione un cliente válido")
    return d.usuario_id


def _error_nit() -> HTTPException:
    return _error_campo(status.HTTP_409_CONFLICT, "nit", "Ya existe una empresa con ese NIT")


def crear(usuario: dict, d: EmpresaEntrada) -> dict:
    if usuario["rol"] == ROL_EMPLEADO:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Su rol solo puede consultar las empresas")
    _validar_ubicacion(d)
    dueno = _propietario(usuario, d, True)
    try:
        nuevo = empresas_repository.crear(dueno, d.model_dump(include=set(empresas_repository.CAMPOS)))
    except UniqueViolation:
        raise _error_nit()
    return obtener_para_usuario(usuario, nuevo)


def actualizar(usuario: dict, empresa_id: int, d: EmpresaEntrada) -> dict:
    obtener_para_usuario(usuario, empresa_id, escritura=True)
    _validar_ubicacion(d)
    dueno = _propietario(usuario, d, False) if usuario["rol"] == ROL_ROOT else None  # el cliente no reasigna
    try:
        empresas_repository.actualizar(empresa_id, dueno, d.model_dump(include=set(empresas_repository.CAMPOS)))
    except UniqueViolation:
        raise _error_nit()
    return obtener_para_usuario(usuario, empresa_id)


def eliminar(usuario: dict, empresa_id: int) -> None:
    obtener_para_usuario(usuario, empresa_id, escritura=True)
    empresas_repository.eliminar_logico(empresa_id)
