from fastapi import APIRouter, Depends, Response, status

from ..dependencies import get_current_user
from ..pdf_diagnostico import generar
from ..schemas.diagnostico import DiagnosticoDetalle, DiagnosticoEntrada, DiagnosticoListItem, Precarga
from ..services import diagnosticos_service

router = APIRouter(prefix="/diagnosticos", tags=["Diagnósticos"])


@router.get("", response_model=list[DiagnosticoListItem])
def listar(empresa_id: int | None = None, usuario: dict = Depends(get_current_user)):
    return diagnosticos_service.listar(usuario, empresa_id)


@router.get("/precarga", response_model=Precarga)
def precarga(empresa_id: int, usuario: dict = Depends(get_current_user)):
    """Datos de la empresa y registros de intermediario disponibles, para precargar el formulario."""
    return diagnosticos_service.precarga(usuario, empresa_id)


@router.post("", response_model=DiagnosticoDetalle, status_code=status.HTTP_201_CREATED)
def crear(datos: DiagnosticoEntrada, usuario: dict = Depends(get_current_user)):
    return diagnosticos_service.crear(usuario, datos)


@router.get("/{diagnostico_id}", response_model=DiagnosticoDetalle)
def ver(diagnostico_id: int, usuario: dict = Depends(get_current_user)):
    return diagnosticos_service.obtener_para_usuario(usuario, diagnostico_id)


@router.put("/{diagnostico_id}", response_model=DiagnosticoDetalle)
def actualizar(diagnostico_id: int, datos: DiagnosticoEntrada, usuario: dict = Depends(get_current_user)):
    return diagnosticos_service.actualizar(usuario, diagnostico_id, datos)


@router.get("/{diagnostico_id}/pdf")
def pdf(diagnostico_id: int, usuario: dict = Depends(get_current_user)):
    d = diagnosticos_service.obtener_para_usuario(usuario, diagnostico_id)
    return Response(generar(d), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="diagnostico_{diagnostico_id}.pdf"'})
