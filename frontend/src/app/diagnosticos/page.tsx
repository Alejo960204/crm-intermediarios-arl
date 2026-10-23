"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  clearToken, getToken, listarDiagnosticos, listarEmpresas, obtenerUsuarioActual, type DiagnosticoListItem,
  type EmpresaListItem, type Usuario,
} from "@/lib/api";

const NIVEL: Record<string, string> = {
  Baja: "bg-green-100 text-green-800", Media: "bg-amber-100 text-amber-800", Alta: "bg-red-100 text-red-800",
};
const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("es-CO");
const BTN = "rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50";

function Contenido() {
  const router = useRouter();
  const empresaId = Number(useSearchParams().get("empresa_id")) || undefined;
  const [lista, setLista] = useState<DiagnosticoListItem[] | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaListItem[]>([]);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [sel, setSel] = useState("");
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      const [u, l, e] = await Promise.all([obtenerUsuarioActual(), listarDiagnosticos(empresaId), listarEmpresas()]);
      setUsuario(u); setLista(l); setEmpresas(e);
    } catch (e) {
      if ((e as Error).message === "UNAUTHORIZED") { clearToken(); router.replace("/login"); } else setError((e as Error).message);
    }
  }, [router, empresaId]);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    cargar();
  }, [router, cargar]);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Diagnósticos</h1>
          {usuario && <p className="text-xs text-slate-500">{usuario.nombre} · {usuario.rol}</p>}
        </div>
        <div className="flex gap-2">
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-white p-4 text-sm shadow">
        <span className="font-medium">Nuevo diagnóstico para:</span>
        <select value={sel} onChange={(e) => setSel(e.target.value)} className="rounded border border-slate-300 px-3 py-2 text-sm">
          <option value="">Seleccione una empresa...</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre} ({e.nit})</option>)}
        </select>
        <button disabled={!sel} onClick={() => router.push(`/diagnosticos/nuevo?empresa_id=${sel}`)}
          className="rounded bg-blue-700 px-3 py-2 text-xs text-white disabled:opacity-50">+ Crear</button>
        {empresaId && <Link href="/diagnosticos" className={`${BTN} ml-auto`}>Ver todos</Link>}
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">NIT</th>
              <th className="px-4 py-3">SG-SST</th><th className="px-4 py-3">Accidentalidad</th>
              <th className="px-4 py-3">Enf. laboral</th><th className="px-4 py-3">Registrado por</th><th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lista === null && !error && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">Cargando...</td></tr>}
            {lista?.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">No hay diagnósticos.</td></tr>}
            {lista?.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{fmt(d.fecha_diagnostico)}</td>
                <td className="px-4 py-3 font-medium">{d.empresa}</td>
                <td className="px-4 py-3">{d.nit}</td>
                <td className="px-4 py-3">{d.sgsst_puntos}/9</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${NIVEL[d.nivel_accidentalidad]}`}>{d.nivel_accidentalidad}</span></td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${NIVEL[d.nivel_enfermedad_laboral]}`}>{d.nivel_enfermedad_laboral}</span></td>
                <td className="px-4 py-3">{d.creado_por}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Link href={`/diagnosticos/${d.id}`} className={BTN}>Resultado</Link>
                    <Link href={`/diagnosticos/${d.id}/editar`} className={BTN}>Editar</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function DiagnosticosPage() {
  return <Suspense fallback={null}><Contenido /></Suspense>;
}
