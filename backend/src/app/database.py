from contextlib import contextmanager

import psycopg2
from psycopg2.extras import RealDictCursor

from .config import settings


@contextmanager
def get_cursor():
    """Entrega un cursor RealDictCursor; hace commit al salir o rollback si hay error."""
    conn = psycopg2.connect(settings.DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        with conn.cursor() as cur:
            yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
