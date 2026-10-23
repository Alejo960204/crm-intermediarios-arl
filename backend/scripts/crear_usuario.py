"""Crea un usuario. Uso (desde backend/src):
    python ../scripts/crear_usuario.py "Nombre" correo@dominio.com clave [--rol "root Admin"] [--demo]
Sin --rol, el usuario se crea con rol 'cliente'. 'root Admin' solo se asigna con --rol explícito.
--demo inserta además 3 registros de ejemplo para ver la tabla.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from app.constantes import ROL_CLIENTE, ROL_EMPLEADO, ROL_ROOT  # noqa: E402
from app.database import get_cursor  # noqa: E402
from app.security import hash_password  # noqa: E402


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("nombre")
    p.add_argument("email")
    p.add_argument("clave")
    p.add_argument("--rol", choices=[ROL_CLIENTE, ROL_EMPLEADO, ROL_ROOT], default=ROL_CLIENTE)
    p.add_argument("--demo", action="store_true")
    a = p.parse_args()
    with get_cursor() as cur:
        cur.execute(
            "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (%s,%s,%s,%s) RETURNING id",
            (a.nombre, a.email, hash_password(a.clave), a.rol),
        )
        uid = cur.fetchone()["id"]
        if a.demo:
            n = uid * 10
            demo = [
                (f"RUI-{n+1}", "900111222", "Asesores Demo S.A.S.", "Borrador"),
                (f"RUI-{n+2}", "900111222", "Corredores Demo Ltda.", "Borrador"),
                (f"RUI-{n+3}", "900555666", "Intermediación Demo S.A.", "Borrador"),
            ]
            for rui, nit, rs, est in demo:
                cur.execute(
                    "INSERT INTO registros_intermediarios (usuario_id, rui, nit, razon_social, estado) "
                    "VALUES (%s,%s,%s,%s,%s)",
                    (uid, rui, nit, rs, est),
                )
    print(f"Usuario {a.email} creado con rol '{a.rol}' (id={uid}).")


if __name__ == "__main__":
    main()
