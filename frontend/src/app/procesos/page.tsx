"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EstadoProcesoBadge from "@/components/EstadoProcesoBadge";
import {
  clearToken, getToken, listarProcesos, obtenerUsuarioActual, type ProcesoListItem, type Usuario,
} from "@/lib/api";

const fmt = (d: string | null) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString("es-CO") : "—");
const BTN = "rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50";

export default function ProcesosPage() {
  const router = useRouter();
  const [procesos, setProcesos] = useState<ProcesoListItem[] | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  const cargar = useCallback(async () => {
    try {
      const [u, l] = await Promise.all([obtenerUsuarioActual(), listarProcesos()]);
      setUsuario(u); setProcesos(l);
    } catch (e) {
      if ((e as Error).message === "UNAUTHORIZED") { clearToken(); router.replace("/login"); } else setError((e as Error).message);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    cargar();
  }, [router, cargar]);

  const esRoot = usuario?.rol === "root Admin";
  const filtrados = procesos?.filter((p) => `${p.empresa} ${p.nit} ${p.arl_destino ?? ""} ${p.estado} ${p.empleado ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <main className="mx-auto max-w-7xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Procesos de afiliación</h1>
          {usuario && <p className="text-xs text-slate-500">{usuario.nombre} · {usuario.rol}</p>}
        </div>
        <div className="flex gap-2">
          {usuario?.rol !== "empleado" && <Link href="/procesos/nuevo" className="rounded bg-blue-700 px-3 py-1 text-xs text-white">+ Nuevo proceso</Link>}
        </div>
      </header>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por empresa, NIT, ARL, estado o empleado"
        className="mb-3 w-full max-w-sm rounded border border-slate-300 px-3 py-2 text-sm" />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Empresa</th><th className="px-4 py-3">NIT</th><th className="px-4 py-3">ARL destino</th>
              <th className="px-4 py-3">Estado</th><th className="px-4 py-3">Inicio vigencia</th>
              <th className="px-4 py-3">Vencimiento</th><th className="px-4 py-3">Actualización</th>
              {esRoot && <th className="px-4 py-3">Propietario</th>}
              {usuario?.rol !== "cliente" && <th className="px-4 py-3">Empleado</th>}
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {procesos === null && !error && <tr><td colSpan={10} className="px-4 py-6 text-center text-slate-500">Cargando...</td></tr>}
            {filtrados?.length === 0 && <tr><td colSpan={10} className="px-4 py-6 text-center text-slate-500">No hay procesos.</td></tr>}
            {filtrados?.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{p.empresa}</td>
                <td className="px-4 py-3">{p.nit}</td>
                <td className="px-4 py-3">{p.arl_destino ?? "—"}</td>
                <td className="px-4 py-3"><EstadoProcesoBadge estado={p.estado} /></td>
                <td className="px-4 py-3">{fmt(p.fecha_inicio)}</td>
                <td className="px-4 py-3">{fmt(p.fecha_vencimiento)}</td>
                <td className="px-4 py-3">{fmt(p.fecha_actualizacion)}</td>
                {esRoot && <td className="px-4 py-3">{p.propietario}</td>}
                {usuario?.rol !== "cliente" && <td className="px-4 py-3">{p.empleado ?? "Sin asignar"}{p.empleado && p.empleado_activo === false && <span className="ml-1 text-xs text-amber-700">(inactivo)</span>}</td>}
                <td className="px-4 py-3"><Link href={`/procesos/${p.id}`} className={BTN}>Ver</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
