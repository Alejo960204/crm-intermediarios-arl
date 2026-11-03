"""Alcance de datos por rol: qué empresas puede ver un usuario (se usa en los listados y en el acceso individual)."""
from .constantes import ROL_ROOT, ROLES_DE_EMPRESA


def condicion_empresa(usuario: dict, alias: str = "e") -> tuple[str | None, list]:
    """(condición SQL, parámetros) para filtrar por las empresas del usuario; None = sin filtro (administrador).
    Administrador: todas. Empresa y empleado: solo la suya. Intermediario: las que creó."""
    if usuario["rol"] == ROL_ROOT:
        return None, []
    if usuario["rol"] in ROLES_DE_EMPRESA:
        return f"{alias}.id = %s", [usuario.get("empresa_id")]  # sin empresa asignada no ve nada (id = NULL)
    return f"{alias}.usuario_id = %s", [usuario["id"]]


def puede_ver_empresa(usuario: dict, empresa: dict) -> bool:
    if usuario["rol"] == ROL_ROOT:
        return True
    if usuario["rol"] in ROLES_DE_EMPRESA:
        return usuario.get("empresa_id") == empresa["id"]
    return empresa["usuario_id"] == usuario["id"]
