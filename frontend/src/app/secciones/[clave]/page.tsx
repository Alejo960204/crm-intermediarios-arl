"use client";
import { useEffect, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { clearToken, getToken, listarEmpresas, SECCIONES, type EmpresaListItem } from "@/lib/api";
import PanelDocumentos from "@/components/PanelDocumentos";

const INPUT = "mt-1 w-full max-w-md rounded border border-slate-300 px-3 py-2 text-sm";

/** Repositorio de documentos de una sección del menú (RUI, SG-SST...) para la empresa elegida. */
export default function SeccionPage() {
  const router = useRouter();
  const { clave } = useParams<{ clave: string }>();
  const titulo = SECCIONES[clave];
  const [empresas, setEmpresas] = useState<EmpresaListItem[] | null>(null);
  const [empresaId, setEmpresaId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    setEmpresaId("");
    listarEmpresas().then(setEmpresas).catch((e: Error) => {
      if (e.message === "UNAUTHORIZED") { clearToken(); router.replace("/login"); } else setError(e.message);
    });
  }, [router, clave]);

  if (!titulo) notFound();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      <p className="text-sm text-slate-500">Documentos de la empresa en esta sección.</p>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <label className="mt-4 block text-sm"><span className="block font-medium">Empresa</span>
        <select className={INPUT} value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} disabled={!empresas}>
          <option value="">{empresas ? (empresas.length ? "Seleccione una empresa..." : "No hay empresas disponibles") : "Cargando..."}</option>
          {empresas?.map((e) => <option key={e.id} value={e.id}>{e.nombre} (NIT {e.nit})</option>)}
        </select>
      </label>
      {empresaId
        ? <PanelDocumentos key={`${clave}-${empresaId}`} objetivo="empresas" id={Number(empresaId)} seccion={clave} />
        : <p className="mt-6 text-sm text-slate-500">Seleccione una empresa para ver y subir documentos.</p>}
    </main>
  );
}
