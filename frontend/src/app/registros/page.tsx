"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearToken, eliminarRegistro, getToken, listarMisRegistros, obtenerUsuarioActual,
  type Estado, type Registro, type Usuario,
} from "@/lib/api";

const COLORES: Record<Estado, string> = {
  Borrador: "bg-slate-200 text-slate-700",
  "En revisión": "bg-amber-100 text-amber-800",
  Aprobado: "bg-green-100 text-green-800",
  Rechazado: "bg-red-100 text-red-800",
};

const fmt = (d: string) => new Date(d).toLocaleDateString("es-CO");
const BTN = "rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50";

export default function RegistrosPage() {
  const router = useRouter();
  const [registros, setRegistros] = useState<Registro[] | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [error, setError] = useState("");
  const [aEliminar, setAEliminar] = useState<Registro | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const manejar = useCallback((e: Error) => {
    if (e.message === "UNAUTHORIZED") { clearToken(); router.replace("/login"); }
    else setError(e.message);
  }, [router]);

  const cargar = useCallback(async () => {
    try {
      const u = await obtenerUsuarioActual();
      if (u.rol === "empleado") { router.replace("/procesos"); return; } // el empleado no usa este módulo
      const r = await listarMisRegistros();
      setUsuario(u); setRegistros(r);
    } catch (e) { manejar(e as Error); }
  }, [manejar]);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    cargar();
  }, [router, cargar]);

  async function confirmarEliminar() {
    if (!aEliminar) return;
    setEliminando(true); setError("");
    try {
      await eliminarRegistro(aEliminar.id);
      setAEliminar(null);
      await cargar();
    } catch (e) { setAEliminar(null); manejar(e as Error); }
    finally { setEliminando(false); }
  }

  const esRoot = usuario?.rol === "root Admin";
  const columnas = esRoot ? 9 : 8;

  return (
    <main className="mx-auto max-w-7xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mis Registros</h1>
          {usuario && <p className="text-xs text-slate-500">{usuario.nombre} · {usuario.rol}</p>}
        </div>
        <div className="flex gap-2">
          <Link href="/registros/nuevo" className="rounded bg-blue-700 px-3 py-1 text-xs text-white">+ Crear nuevo</Link>
        </div>
      </header>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">RUI</th>
              <th className="px-4 py-3">NIT</th>
              <th className="px-4 py-3">Razón Social</th>
              <th className="px-4 py-3">Ciudad</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Fecha de creación</th>
              <th className="px-4 py-3">Fecha de actualización</th>
              {esRoot && <th className="px-4 py-3">Propietario</th>}
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {registros === null && !error && (
              <tr><td colSpan={columnas} className="px-4 py-6 text-center text-slate-500">Cargando...</td></tr>
            )}
            {registros?.length === 0 && (
              <tr><td colSpan={columnas} className="px-4 py-6 text-center text-slate-500">No tienes registros.</td></tr>
            )}
            {registros?.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{r.rui}</td>
                <td className="px-4 py-3">{r.nit}</td>
                <td className="px-4 py-3">{r.razon_social ?? "—"}</td>
                <td className="px-4 py-3">{r.ciudad ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs ${COLORES[r.estado]}`}>{r.estado}</span>
                  {r.decision_comentario && (r.estado === "Aprobado" || r.estado === "Rechazado") && (
                    <p title={r.decision_comentario} className="mt-1 max-w-[16rem] truncate text-xs text-slate-500">
                      {r.decision_comentario}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">{fmt(r.fecha_creacion)}</td>
                <td className="px-4 py-3">{fmt(r.fecha_actualizacion)}</td>
                {esRoot && <td className="px-4 py-3">{r.propietario}</td>}
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Link href={`/registros/${r.id}`} className={BTN}>Ver</Link>
                    <Link href={`/registros/${r.id}/editar`} className={BTN}>Editar</Link>
                    <button onClick={() => setAEliminar(r)} className={`${BTN} text-red-700`}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {aEliminar && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Eliminar registro</h2>
            <p className="mt-2 text-sm text-slate-600">
              ¿Eliminar el registro con RUI <strong>{aEliminar.rui}</strong>? Dejará de aparecer en la tabla.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setAEliminar(null)} className={BTN}>Cancelar</button>
              <button onClick={confirmarEliminar} disabled={eliminando}
                className="rounded bg-red-700 px-3 py-1 text-xs text-white disabled:opacity-60">
                {eliminando ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
