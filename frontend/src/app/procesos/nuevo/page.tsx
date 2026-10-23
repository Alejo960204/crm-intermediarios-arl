"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError, clearToken, crearProceso, getToken, listarEmpresas, listarUsuarios, obtenerUsuarioActual,
  type EmpresaListItem, type UsuarioListado,
} from "@/lib/api";

const INPUT = "mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm";

export default function NuevoProceso() {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<EmpresaListItem[] | null>(null);
  const [empleados, setEmpleados] = useState<UsuarioListado[] | null>(null); // solo para root Admin
  const [f, setF] = useState({ empresa_id: "", empleado_id: "", arl_destino: "", numero_afiliacion: "" });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  function fallo(e: unknown) {
    if ((e as Error).message === "UNAUTHORIZED") { clearToken(); router.replace("/login"); return; }
    setError((e as Error).message);
    if (e instanceof ApiError) setErrores(e.campos ?? {});
  }

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    (async () => {
      try {
        const u = await obtenerUsuarioActual();
        if (u.rol === "empleado") { router.replace("/procesos"); return; }
        setEmpresas(await listarEmpresas());
        if (u.rol === "root Admin") setEmpleados((await listarUsuarios()).filter((x) => x.rol === "empleado" && x.activo));
      } catch (e) { fallo(e); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault(); setError(""); setErrores({}); setGuardando(true);
    try {
      const p = await crearProceso(f);
      router.push(`/procesos/${p.id}`);
    } catch (e) { fallo(e); } finally { setGuardando(false); }
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Nuevo proceso de afiliación</h1>
      <form onSubmit={guardar} className="space-y-4 rounded-lg bg-white p-6 shadow">
        <label className="block text-sm">
          <span className="font-medium">Empresa <span className="text-red-600">*</span></span>
          <select className={INPUT} value={f.empresa_id} onChange={(e) => { setF({ ...f, empresa_id: e.target.value }); setErrores({}); }}>
            <option value="">Seleccione...</option>
            {empresas?.map((e) => <option key={e.id} value={e.id}>{e.nombre} ({e.nit})</option>)}
          </select>
          {empresas?.length === 0 && (
            <span className="text-xs text-amber-700">Aún no tienes empresas. <Link href="/empresas/nueva" className="underline">Crea una primero</Link>.</span>
          )}
          {errores.empresa_id && <span className="block text-xs text-red-600">{errores.empresa_id}</span>}
        </label>
        {empleados && (
          <label className="block text-sm">
            <span className="font-medium">Empleado responsable</span>
            <select className={INPUT} value={f.empleado_id} onChange={(e) => { setF({ ...f, empleado_id: e.target.value }); setErrores({}); }}>
              <option value="">Sin asignar</option>
              {empleados.map((x) => <option key={x.id} value={x.id}>{x.nombre} ({x.email})</option>)}
            </select>
            {errores.empleado_id && <span className="block text-xs text-red-600">{errores.empleado_id}</span>}
          </label>
        )}
        <label className="block text-sm">
          <span className="font-medium">ARL destino</span>
          <input className={INPUT} value={f.arl_destino} onChange={(e) => setF({ ...f, arl_destino: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Número / referencia de afiliación</span>
          <input className={INPUT} value={f.numero_afiliacion} onChange={(e) => setF({ ...f, numero_afiliacion: e.target.value })} />
        </label>
        <p className="text-xs text-slate-500">El proceso se crea en estado «Pendiente». El administrador (o el empleado asignado) avanzará el estado.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Link href="/procesos" className="rounded border border-slate-300 px-3 py-2 text-sm">Cancelar</Link>
          <button disabled={guardando} className="rounded bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-60">
            {guardando ? "Guardando..." : "Crear proceso"}
          </button>
        </div>
      </form>
    </main>
  );
}
