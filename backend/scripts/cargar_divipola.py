"""Carga departamentos y municipios del DANE (DIVIPOLA) desde un CSV descargado de datos.gov.co.

Uso (con el (venv) activo, desde backend\\src):
    python ..\\scripts\\cargar_divipola.py C:\\ruta\\divipola.csv

Detecta solas las columnas (código/nombre de departamento y de municipio), el separador (coma o
punto y coma) y la codificación. Si no logra detectarlas, muestra las columnas del archivo y puedes
indicarlas con --col-cod-dpto, --col-dpto, --col-cod-mpio y --col-mpio.
Se puede ejecutar varias veces: actualiza sin duplicar.
"""
import argparse
import csv
import io
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))


def _norm(texto: str) -> str:
    sin_tildes = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", sin_tildes.lower().replace("_", " ")).strip()


def _leer(ruta: str) -> tuple[list[str], list[dict]]:
    crudo = Path(ruta).read_bytes()
    for codificacion in ("utf-8-sig", "latin-1"):
        try:
            texto = crudo.decode(codificacion)
            break
        except UnicodeDecodeError:
            continue
    primera = texto.splitlines()[0] if texto else ""
    delimitador = ";" if primera.count(";") > primera.count(",") else ","
    lector = csv.DictReader(io.StringIO(texto), delimiter=delimitador)
    return list(lector.fieldnames or []), list(lector)


def _detectar(columnas: list[str]) -> dict[str, str | None]:
    def buscar(incluye: list[str], excluye: list[str] = ()) -> str | None:
        for c in columnas:
            n = _norm(c)
            if all(i in n for i in incluye) and not any(e in n for e in excluye):
                return c
        return None

    return {
        "cod_dpto": buscar(["codigo", "departamento"]),
        "dpto": buscar(["departamento"], ["codigo", "cod "]),
        "cod_mpio": buscar(["codigo", "municipio"]),
        "mpio": buscar(["municipio"], ["codigo", "cod ", "tipo"]),
    }


def _solo_digitos(valor: str, ancho: int) -> str:
    return re.sub(r"\D", "", valor or "").zfill(ancho)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("csv_path")
    p.add_argument("--col-cod-dpto")
    p.add_argument("--col-dpto")
    p.add_argument("--col-cod-mpio")
    p.add_argument("--col-mpio")
    a = p.parse_args()

    columnas, filas = _leer(a.csv_path)
    auto = _detectar(columnas)
    elegidas = {
        "cod_dpto": a.col_cod_dpto or auto["cod_dpto"],
        "dpto": a.col_dpto or auto["dpto"],
        "cod_mpio": a.col_cod_mpio or auto["cod_mpio"],
        "mpio": a.col_mpio or auto["mpio"],
    }
    faltan = [k for k, v in elegidas.items() if not v or v not in columnas]
    if faltan:
        sys.exit(
            f"No pude identificar las columnas: {faltan}\n"
            f"Columnas del archivo: {columnas}\n"
            "Indícalas con --col-cod-dpto, --col-dpto, --col-cod-mpio y --col-mpio."
        )
    print("Columnas usadas:", elegidas)

    from app.database import get_cursor  # se importa aquí para que --help funcione sin configurar el .env

    deptos: dict[str, str] = {}
    mpios: dict[str, tuple[str, str]] = {}
    for r in filas:
        cd = _solo_digitos(r[elegidas["cod_dpto"]], 2)
        cm = _solo_digitos(r[elegidas["cod_mpio"]], 5)
        nd = (r[elegidas["dpto"]] or "").strip()
        nm = (r[elegidas["mpio"]] or "").strip()
        if not nd or not nm or cd == "00" or cm == "00000":
            continue
        deptos[cd] = nd
        mpios[cm] = (nm, cd)

    if not mpios:
        sys.exit("El archivo no tiene filas válidas de departamentos y municipios.")

    with get_cursor() as cur:
        for cd, nombre in deptos.items():
            cur.execute(
                "INSERT INTO departamentos (codigo, nombre) VALUES (%s,%s) "
                "ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre", (cd, nombre))
        for cm, (nombre, cd) in mpios.items():
            cur.execute(
                "INSERT INTO municipios (codigo, nombre, departamento_codigo) VALUES (%s,%s,%s) "
                "ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, departamento_codigo = EXCLUDED.departamento_codigo",
                (cm, nombre, cd))
    print(f"Cargados {len(deptos)} departamentos y {len(mpios)} municipios.")


if __name__ == "__main__":
    main()
