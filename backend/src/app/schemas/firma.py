from pydantic import BaseModel, field_validator

from .idoneidad import TipoDocumento


def _limpio(v):
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


class FirmaEntrada(BaseModel):
    """Todo opcional al guardar el borrador; la firma y los datos se exigen al enviar a revisión (Req. 7)."""

    nombres_apellidos: str | None = None
    tipo_documento: TipoDocumento | None = None
    numero_documento: str | None = None
    quitar_firma: bool = False

    @field_validator("nombres_apellidos", "tipo_documento", "numero_documento", mode="before")
    @classmethod
    def _opcionales(cls, v):
        return _limpio(v)


class FirmaInfo(BaseModel):
    nombre_original: str
    tipo: str
    tamano_bytes: int


class FirmaOut(BaseModel):
    nombres_apellidos: str | None
    tipo_documento: str | None
    numero_documento: str | None
    firma: FirmaInfo | None
