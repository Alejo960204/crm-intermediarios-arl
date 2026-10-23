"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import EstadoProcesoBadge from "@/components/EstadoProcesoBadge";
import PanelDocumentos from "@/components/PanelDocumentos";
import {
  actualizarProceso, ApiError, asignarProceso, cambiarEstadoProceso, clearToken, getToken, listarUsuarios, obtenerProceso,
  type ProcesoDetalle, type UsuarioListado,
} from "@/lib/api";

const fmt = (d: string | null) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString("es-CO") : "—");
const fmtHora = (d: string) => new Date(d).toLocaleString("es-CO");
const INPUT = "mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm";

export default function ProcesoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [p, setP] = useState<ProcesoDetalle | null>(null);
  const [error, setError] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [arl, setArl] = useState("");
  const [num, setNum] = useState("");
  const [msg, setMsg] = useState("");
  const [cambio, setCambio] = useState({ fecha_inicio: "", periodo: "", observacion: "" });
  const [ocupado, setOcupado] = useState(false);
  const [empleados, setEmpleados] = useState<UsuarioListado[]>([]);
  const [empSel, setEmpSel] = useState("");

  const fallo = useCallback((e: unknown) => {
    if ((e as Error).message === "UNAUTHORIZED") { clearToken(); router.replace("/login"); return; }
    setError((e as Error).message);
    if (e instanceof ApiError) setErrores(e.campos ?? {});
  }, [router]);

  const aplicar = (d: ProcesoDetalle) => {
    setP(d); setArl(d.arl_destino ?? ""); setNum(d.numero_afiliacion ?? ""); setEmpSel(d.empleado_id ? String(d.empleado_id) : "");
  };

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    (async () => {
      try {
        const d = await obtenerProceso(Number(id));
        aplicar(d);
        if (d.puede_asignar) setEmpleados((await listarUsuarios()).filter((x) => x.rol === "empleado" && x.activo));
      } catch (e) { fallo(e); }
    })();
  }, [id, router, fallo]);

  async function guardarDatos(ev: React.FormEvent) {
    ev.preventDefault(); setError(""); setMsg(""); setOcupado(true);
    try { aplicar(await actualizarProceso(Number(id), { empresa_id: "", arl_destino: arl, numero_afiliacion: num })); setMsg("Datos guardados."); }
    catch (e) { fallo(e); } finally { setOcupado(false); }
  }

  async function asignar() {
    setError(""); setErrores({}); setMsg(""); setOcupado(true);
    try { aplicar(await asignarProceso(Number(id), empSel)); setMsg("Asignación guardada."); }
    catch (e) { fallo(e); } finally { setOcupado(false); }
  }

  async function avanzar(estado: "En proceso" | "Vigente") {
    setError(""); setErrores({}); setMsg(""); setOcupado(true);
    try {
      aplicar(await cambiarEstadoProceso(Number(id), { estado, ...cambio }));
      setCambio({ fecha_inicio: "", periodo: "", observacion: "" });
    } catch (e) { fallo(e); } finally { setOcupado(false); }
  }

  if (!p) return <main className="p-6 text-sm text-slate-500">{error || "Cargando..."}</main>;

  const siguiente: "En proceso" | "Vigente" | null =
    p.estado === "Pendiente" ? "En proceso" : p.estado === "En proceso" || p.estado === "Caducado" ? "Vigente" : null;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{p.empresa}</h1>
          <p className="text-xs text-slate-500">NIT {p.nit}{p.propietario ? ` · ${p.propietario}` : ""} · Empleado: {p.empleado ?? "sin asignar"}{p.empleado && p.empleado_activo === false ? " (inactivo)" : ""}</p>
          {p.empleado_activo === false && p.puede_asignar && (
            <p className="mt-1 text-xs text-amber-700">El empleado asignado está desactivado y no puede ingresar. Reasigne el proceso a otro empleado.</p>
          )}
          <Link href={`/empresas/${p.empresa_id}`} className="text-xs text-blue-700 underline">Ver datos de la empresa</Link>
          {" · "}<Link href={`/diagnosticos?empresa_id=${p.empresa_id}`} className="text-xs text-blue-700 underline">Diagnósticos de la empresa</Link>
        </div>
        <EstadoProcesoBadge estado={p.estado} />
      </header>

      {p.estado === "Vigente" && (
        <p className="mb-4 rounded border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          ✔ Afiliación vigente hasta el {fmt(p.fecha_vencimiento)}.
        </p>
      )}
      {p.estado === "Caducado" && (
        <p className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          ✖ La vigencia caducó el {fmt(p.fecha_vencimiento)}. El administrador puede renovarla.
        </p>
      )}
      {p.observacion && (
        <p className="mb-4 rounded bg-slate-100 px-4 py-3 text-sm"><span className="font-medium">Observación del administrador:</span> {p.observacion}</p>
      )}

      <section className="mb-4 rounded-lg bg-white p-6 shadow">
        <form onSubmit={guardarDatos} className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm"><span className="font-medium">ARL destino</span>
            <input className={INPUT} value={arl} disabled={!p.puede_editar_datos} onChange={(e) => setArl(e.target.value)} />
          </label>
          <label className="block text-sm"><span className="font-medium">Número / referencia de afiliación</span>
            <input className={INPUT} value={num} disabled={!p.puede_editar_datos} onChange={(e) => setNum(e.target.value)} />
          </label>
          <div className="text-sm"><span className="font-medium">Inicio de vigencia:</span> {fmt(p.fecha_inicio)}</div>
          <div className="text-sm"><span className="font-medium">Periodo:</span> {p.periodo ?? "—"} · <span className="font-medium">Vencimiento:</span> {fmt(p.fecha_vencimiento)}</div>
          {p.puede_editar_datos && (
            <div className="sm:col-span-2 flex items-center justify-end gap-3">
              {msg && <span className="text-sm text-green-700">{msg}</span>}
              <button disabled={ocupado} className="rounded bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-60">Guardar datos</button>
            </div>
          )}
        </form>
      </section>

      {p.puede_asignar && (
        <section className="mb-4 rounded-lg bg-white p-4 text-sm shadow">
          <label className="block"><span className="font-medium">Empleado responsable</span>
            <select className={INPUT} value={empSel} onChange={(e) => setEmpSel(e.target.value)}>
              <option value="">Sin asignar</option>
              {empleados.map((x) => <option key={x.id} value={x.id}>{x.nombre} ({x.email})</option>)}
            </select>
            {errores.empleado_id && <span className="text-xs text-red-600">{errores.empleado_id}</span>}
          </label>
          <button disabled={ocupado} onClick={asignar} className="mt-2 rounded bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-60">Guardar asignación</button>
        </section>
      )}

      {p.puede_cambiar_estado && siguiente && (
        <section className="mb-4 rounded border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-amber-900">
            {p.estado === "Caducado" ? "Renovar: pasar a Vigente" : `Pasar a «${siguiente}»`}
          </p>
          {siguiente === "Vigente" && (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="block">Fecha de inicio <span className="text-red-600">*</span>
                <input type="date" className={INPUT} value={cambio.fecha_inicio}
                  onChange={(e) => setCambio({ ...cambio, fecha_inicio: e.target.value })} />
                {errores.fecha_inicio && <span className="text-xs text-red-600">{errores.fecha_inicio}</span>}
              </label>
              <label className="block">Periodo <span className="text-red-600">*</span>
                <select className={INPUT} value={cambio.periodo} onChange={(e) => setCambio({ ...cambio, periodo: e.target.value })}>
                  <option value="">Seleccione...</option><option>Mensual</option><option>Anual</option>
                </select>
                {errores.periodo && <span className="text-xs text-red-600">{errores.periodo}</span>}
              </label>
              <p className="sm:col-span-2 text-xs text-amber-900">El vencimiento se calcula solo: inicio + 1 mes (Mensual) o + 1 año (Anual).</p>
            </div>
          )}
          <label className="mt-2 block">Observación (opcional, la ve el cliente)
            <textarea rows={2} maxLength={1000} className={INPUT} value={cambio.observacion}
              onChange={(e) => setCambio({ ...cambio, observacion: e.target.value })} />
          </label>
          <button disabled={ocupado} onClick={() => avanzar(siguiente)}
            className="mt-3 rounded bg-amber-700 px-4 py-2 text-sm text-white disabled:opacity-60">
            {p.estado === "Caducado" ? "Renovar (Vigente)" : `Pasar a ${siguiente}`}
          </button>
        </section>
      )}

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Historial</h2>
        <ul className="space-y-2 text-sm">
          {p.historial.map((h) => (
            <li key={h.id} className="border-t border-slate-100 pt-2">
              <span className="font-medium">{h.accion}</span> → {h.estado}
              {h.fecha_inicio && <> · {fmt(h.fecha_inicio)} a {fmt(h.fecha_vencimiento)} ({h.periodo})</>}
              <span className="block text-xs text-slate-500">{fmtHora(h.fecha)} · {h.usuario}</span>
              {h.observacion && <span className="block text-xs">{h.observacion}</span>}
            </li>
          ))}
        </ul>
      </section>

      <PanelDocumentos objetivo="procesos" id={p.id} />

      <div className="mt-4"><Link href="/procesos" className="rounded border border-slate-300 px-3 py-2 text-sm">Volver al listado</Link></div>
    </main>
  );
}
