"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import AvisoPaquete from "@/components/AvisoPaquete";
import {
  esDeEmpresa,   cambiarActivaEmpresa, clearToken, getToken, listarEmpresas, obtenerCupo, obtenerUsuarioActual, type Cupo, type EmpresaListItem, type Usuario,
} from "@/lib/api";

const fmt = (d: string) => new Date(d).toLocaleDateString("es-CO");
const BTN = "rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50";

const FILTROS: Record<string, string> = {
  en_curso: "Con proceso en curso", vigente: "Con proceso vigente", caducado: "Con proceso caducado",
  sin_proceso: "Sin ningún proceso", por_vencer: "Vigencia por vencer",
};
const COLOR_PROCESO: Record<string, string> = {
  Pendiente: "bg-slate-200 text-slate-700", "En proceso": "bg-blue-100 text-blue-800",
  Vigente: "bg-green-100 text-green-800", Caducado: "bg-red-100 text-red-800",
};

function EmpresasContenido() {
  const router = useRouter();
  const filtro = useSearchParams().get("estado") ?? undefined;
  const [empresas, setEmpresas] = useState<EmpresaListItem[] | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [error, setError] = useState("");
  const [aCambiar, setACambiar] = useState<EmpresaListItem | null>(null);
  const [cambiando, setCambiando] = useState(false);
  const [q, setQ] = useState("");
  const [cupo, setCupo] = useState<Cupo | null>(null);

  const manejar = useCallback((e: Error) => {
    if (e.message === "UNAUTHORIZED") { clearToken(); router.replace("/login"); } else setError(e.message);
  }, [router]);

  const cargar = useCallback(async () => {
    try {
      const [u, l] = await Promise.all([obtenerUsuarioActual(), listarEmpresas(filtro)]);
      setUsuario(u); setEmpresas(l);
      setCupo(u.rol === "intermediario" ? await obtenerCupo() : null);
    } catch (e) { manejar(e as Error); }
  }, [manejar, filtro]);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    cargar();
  }, [router, cargar]);

  async function confirmar() {
    if (!aCambiar) return;
    setCambiando(true);
    try { await cambiarActivaEmpresa(aCambiar.id, aCambiar.inactiva); setACambiar(null); await cargar(); }
    catch (e) { setACambiar(null); manejar(e as Error); } finally { setCambiando(false); }
  }

  const esRoot = usuario?.rol === "administrador";
  const sinCupo = !!cupo && !cupo.puede_crear;
  const filtradas = empresas?.filter((e) => `${e.nombre} ${e.nit}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <main className="mx-auto max-w-7xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Empresas</h1>
          {usuario && <p className="text-xs capitalize text-slate-500">{usuario.nombre} · {usuario.rol}</p>}
        </div>
        <div className="flex gap-2">
          {usuario?.rol === "intermediario" && cupo && (
            <span className="self-center text-xs text-slate-600" data-testid="cupo">Empresas creadas: {cupo.usadas} de {cupo.maximo ?? "sin límite"}{cupo.disponibles !== null && ` · Disponibles: ${cupo.disponibles}`}</span>
          )}
          {usuario && !esDeEmpresa(usuario) && (sinCupo
            ? <span title={cupo?.paquete?.vencido ? "Su paquete venció. Renuévelo para crear empresas." : "Alcanzó el límite de su paquete. Actualice su paquete para crear más empresas."} aria-disabled="true"
                className="cursor-not-allowed rounded bg-slate-300 px-3 py-1 text-xs text-slate-600">+ Nueva empresa (no disponible)</span>
            : <Link href="/empresas/nueva" className="rounded bg-blue-700 px-3 py-1 text-xs text-white">+ Nueva empresa</Link>)}
        </div>
      </header>
      {cupo && <AvisoPaquete cupo={cupo} onCambio={setCupo} />}
      {filtro && (
        <p className="mb-3 text-sm">
          Filtro: <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">{FILTROS[filtro] ?? filtro}</span>{" "}
          <Link href="/empresas" className="text-xs text-blue-700 underline">Quitar filtro</Link>
        </p>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o NIT"
        className="mb-3 w-full max-w-sm rounded border border-slate-300 px-3 py-2 text-sm" />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Empresa</th><th className="px-4 py-3">NIT</th><th className="px-4 py-3">Ciudad</th>
              <th className="px-4 py-3">Gerente</th><th className="px-4 py-3">Proceso</th><th className="px-4 py-3">Trabajadores</th>{!esDeEmpresa(usuario) && <th className="px-4 py-3">Acceso</th>}
              <th className="px-4 py-3">Fecha de creación</th><th className="px-4 py-3">Fecha de actualización</th>
              {esRoot && <th className="px-4 py-3">Propietario</th>}
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {empresas === null && !error && <tr><td colSpan={11} className="px-4 py-6 text-center text-slate-500">Cargando...</td></tr>}
            {filtradas?.length === 0 && <tr><td colSpan={11} className="px-4 py-6 text-center text-slate-500">No hay empresas.</td></tr>}
            {filtradas?.map((e) => (
              <tr key={e.id} className={`border-t border-slate-100 ${e.inactiva ? "bg-slate-50 text-slate-500" : ""}`}>
                <td className="px-4 py-3 font-medium">{e.nombre}{e.inactiva && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-normal text-slate-600">Inactiva</span>}</td>
                <td className="px-4 py-3">{e.nit}</td>
                <td className="px-4 py-3">{e.ciudad ?? "—"}</td>
                <td className="px-4 py-3">{e.gerente ?? "—"}</td>
                <td className="px-4 py-3">
                  {e.estado_proceso
                    ? <span className={`rounded-full px-2 py-1 text-xs ${COLOR_PROCESO[e.estado_proceso]}`}>{e.estado_proceso}</span>
                    : <span className="text-xs text-slate-500">Sin proceso</span>}
                </td>
                <td className="px-4 py-3">{e.trabajadores_directos ?? "—"}</td>
                {!esDeEmpresa(usuario) && (
                  <td className="px-4 py-3 text-xs">
                    {e.tiene_login ? <>Empleados: {e.empleados} de {e.max_empleados ?? "sin límite"}</> : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Sin usuario de acceso</span>}
                  </td>
                )}
                <td className="px-4 py-3">{fmt(e.fecha_creacion)}</td>
                <td className="px-4 py-3">{fmt(e.fecha_actualizacion)}</td>
                {esRoot && <td className="px-4 py-3">{e.propietario}</td>}
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Link href={`/empresas/${e.id}`} className={BTN}>{e.inactiva ? "Ver" : "Editar"}</Link>
                    {!esDeEmpresa(usuario) && (
                      <button onClick={() => setACambiar(e)} className={`${BTN} ${e.inactiva ? "text-green-700" : "text-amber-700"}`}>{e.inactiva ? "Reactivar" : "Inactivar"}</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {aCambiar && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold">{aCambiar.inactiva ? "Reactivar empresa" : "Inactivar empresa"}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {aCambiar.inactiva
                ? <>¿Reactivar <strong>{aCambiar.nombre}</strong>? Volverá a poder editarse y a contar en el Dashboard.</>
                : <>¿Inactivar <strong>{aCambiar.nombre}</strong>? Se conservan todos sus registros e historial, pero queda solo de consulta. <strong>Inactivar no libera cupo de su paquete.</strong></>}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setACambiar(null)} className={BTN}>Cancelar</button>
              <button onClick={confirmar} disabled={cambiando} className="rounded bg-blue-700 px-3 py-1 text-xs text-white disabled:opacity-60">
                {cambiando ? "Guardando..." : aCambiar.inactiva ? "Reactivar" : "Inactivar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function EmpresasPage() {
  return <Suspense fallback={null}><EmpresasContenido /></Suspense>;
}
