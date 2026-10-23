"""Crea los 3 usuarios de la demo (uno por rol) y datos de ejemplo. Se puede ejecutar varias veces.

Uso (desde backend/src, con DATABASE_URL y JWT_SECRET definidos en el entorno o en .env):
    python ../scripts/crear_usuarios_demo.py [--clave ClaveDemo2026]

Crea (si no existen):
    admin@demo.com      root Admin
    cliente@demo.com    cliente   (con 3 registros de ejemplo)
    empleado@demo.com   empleado
Todos con la misma clave (por defecto «Demo2026!»). Solo para demos: no usar con datos reales.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from app.constantes import ROL_CLIENTE, ROL_EMPLEADO, ROL_ROOT  # noqa: E402
from app.database import get_cursor  # noqa: E402
from app.security import hash_password  # noqa: E402

USUARIOS = [
    ("Administrador Demo", "admin@demo.com", ROL_ROOT),
    ("Cliente Demo", "cliente@demo.com", ROL_CLIENTE),
    ("Empleado Demo", "empleado@demo.com", ROL_EMPLEADO),
]


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--clave", default="Demo2026!")
    a = p.parse_args()
    ids = {}
    with get_cursor() as cur:
        for nombre, email, rol in USUARIOS:
            cur.execute("SELECT id FROM usuarios WHERE email = %s", (email,))
            fila = cur.fetchone()
            if fila:
                ids[email] = fila["id"]
                print(f"Ya existe: {email}")
                continue
            cur.execute(
                "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (%s,%s,%s,%s) RETURNING id",
                (nombre, email, hash_password(a.clave), rol),
            )
            ids[email] = cur.fetchone()["id"]
            print(f"Creado: {email} (rol '{rol}')")

        uid = ids["cliente@demo.com"]
        cur.execute("SELECT COUNT(*) AS n FROM registros_intermediarios WHERE usuario_id = %s", (uid,))
        if cur.fetchone()["n"] == 0:
            n = uid * 10
            demo = [
                (f"RUI-{n+1}", "900111222", "Asesores Demo S.A.S."),
                (f"RUI-{n+2}", "900111222", "Corredores Demo Ltda."),
                (f"RUI-{n+3}", "900555666", "Intermediación Demo S.A."),
            ]
            for rui, nit, rs in demo:
                cur.execute(
                    "INSERT INTO registros_intermediarios (usuario_id, rui, nit, razon_social, estado) "
                    "VALUES (%s,%s,%s,%s,'Borrador')",
                    (uid, rui, nit, rs),
                )
            print("Registros de ejemplo creados para cliente@demo.com")
    print(f"\nListo. Clave de los 3 usuarios: {a.clave}")


if __name__ == "__main__":
    main()
