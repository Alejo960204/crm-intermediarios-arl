from ..database import get_cursor


def listar_departamentos() -> list[dict]:
    with get_cursor() as cur:
        cur.execute("SELECT codigo, nombre FROM departamentos ORDER BY nombre")
        return cur.fetchall()


def listar_municipios(departamento_codigo: str) -> list[dict]:
    with get_cursor() as cur:
        cur.execute(
            "SELECT codigo, nombre, departamento_codigo FROM municipios "
            "WHERE departamento_codigo = %s ORDER BY nombre",
            (departamento_codigo,),
        )
        return cur.fetchall()


def existe_departamento(codigo: str) -> bool:
    with get_cursor() as cur:
        cur.execute("SELECT 1 FROM departamentos WHERE codigo = %s", (codigo,))
        return cur.fetchone() is not None


def municipio_pertenece(municipio_codigo: str, departamento_codigo: str) -> bool:
    with get_cursor() as cur:
        cur.execute(
            "SELECT 1 FROM municipios WHERE codigo = %s AND departamento_codigo = %s",
            (municipio_codigo, departamento_codigo),
        )
        return cur.fetchone() is not None
