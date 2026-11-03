"use client";
import { useEffect, useState } from "react";
import { listarHistorialEmpresa, type CambioHistorial, type CategoriaHistorial } from "@/lib/api";

const CATEGORIAS: Record<CategoriaHistorial, string> = {
  datos: "Datos de la empresa", documento: "Documentos", diagnostico: "Diagnósticos", empleado: "Empleados", acceso: "Acceso",
};
const fmt = (d: string) => new Date(d).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });

/** Historial de cambios de la empresa: quién, cuándo y qué (una fila por campo cambiado). Lo ven administrador, intermediario y empresa. */
export default function HistorialEmpresa({ empresaId }: { empresaId: number }) {
  const [filas, setFilas] = useState<CambioHistorial[] | null>(null);
  const [error, setError] = useState("");
  const [categoria, setCategoria] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    listarHistorialEmpresa(empresaId).then(setFilas).catch((e) => setError((e as Error).message));
  }, [empresaId]);

  const visibles = filas?.filter((f) =>
    (!categoria || f.categoria === categoria) &&
    `${f.usuario} ${f.campo ?? ""} ${f.accion} ${f.detalle ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <section className="mt-6 rounded-lg bg-white p-6 shadow" aria-label="Historial de cambios" data-testid="historial">
      <h2 className="text-lg font-semibold">Historial de cambios</h2>
      <p className="text-xs text-slate-500">Quién hizo cada cambio, cuándo y qué modificó. Se registra desde la versión 21C.</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <select aria-label="Filtrar por tipo" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm">
          <option value="">Todos los tipos</option>
          {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input aria-label="Buscar en el historial" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por usuario, campo o acción"
          className="w-full max-w-xs rounded border border-slate-300 px-2 py-1 text-sm" />
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600">
            <tr><th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Usuario</th><th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Cambio</th><th className="px-3 py-2">Valor anterior</th><th className="px-3 py-2">Valor nuevo</th></tr>
          </thead>
          <tbody>
            {filas === null && !error && <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-500">Cargando...</td></tr>}
            {visibles?.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-500">No hay cambios registrados.</td></tr>}
            {visibles?.map((f) => (
              <tr key={f.id} className="border-t border-slate-100 align-top">
                <td className="whitespace-nowrap px-3 py-2 text-xs">{fmt(f.fecha)}</td>
                <td className="px-3 py-2">{f.usuario}<span className="block text-xs text-slate-500">{f.rol}</span></td>
                <td className="px-3 py-2 text-xs">{CATEGORIAS[f.categoria]}</td>
                <td className="px-3 py-2">{f.campo ?? f.accion}{f.campo && <span className="block text-xs text-slate-500">{f.accion}</span>}
                  {!f.campo && f.detalle && <span className="block text-xs text-slate-500">{f.detalle}</span>}</td>
                <td className="px-3 py-2">{f.campo ? (f.valor_anterior || <span className="text-slate-400">(vacío)</span>) : ""}</td>
                <td className="px-3 py-2">{f.campo ? (f.valor_nuevo || <span className="text-slate-400">(vacío)</span>) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
