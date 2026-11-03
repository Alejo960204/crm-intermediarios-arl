"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import FormularioEmpresa from "@/components/FormularioEmpresa";
import PanelDocumentos from "@/components/PanelDocumentos";
import HistorialEmpresa from "@/components/HistorialEmpresa";
import PanelEmpleados from "@/components/PanelEmpleados";
import { obtenerUsuarioActual, type Usuario } from "@/lib/api";

export default function EditarEmpresa() {
  const { id } = useParams<{ id: string }>();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  useEffect(() => { obtenerUsuarioActual().then(setUsuario).catch(() => setUsuario(null)); }, []);
  return (
    <>
      <FormularioEmpresa empresaId={Number(id)} />
      <div className="mx-auto max-w-4xl px-6 pb-6">
        {usuario && <PanelEmpleados empresaId={Number(id)} usuario={usuario} />}
        <PanelDocumentos objetivo="empresas" id={Number(id)} />
        {usuario && usuario.rol !== "empleado" && <HistorialEmpresa empresaId={Number(id)} />}
      </div>
    </>
  );
}
