"use client";
import { useParams } from "next/navigation";
import FormularioEmpresa from "@/components/FormularioEmpresa";
import PanelDocumentos from "@/components/PanelDocumentos";

export default function EditarEmpresa() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <FormularioEmpresa empresaId={Number(id)} />
      <div className="mx-auto max-w-4xl px-6 pb-6"><PanelDocumentos objetivo="empresas" id={Number(id)} /></div>
    </>
  );
}
