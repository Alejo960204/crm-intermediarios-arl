"use client";
import { PERIODICIDADES, type PaqueteEntrada } from "@/lib/api";

const INPUT = "mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm";
export const hoy = () => new Date().toISOString().slice(0, 10);
export const PAQUETE_VACIO = (): PaqueteEntrada => ({ nombre: "", cantidad_empresas: "", periodicidad: "", fecha_inicio: hoy() });

/** Campos del paquete (nombre, cantidad de empresas, periodicidad y fecha de inicio). Los errores llegan por nombre de campo. */
export default function FormularioPaquete({ valor, onChange, errores }: {
  valor: PaqueteEntrada; onChange: (v: PaqueteEntrada) => void; errores: Record<string, string>;
}) {
  const set = (k: keyof PaqueteEntrada, v: string) => onChange({ ...valor, [k]: v });
  const err = (k: string) => errores[k] || errores[`paquete.${k}`];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm">Nombre del paquete <span className="text-red-600">*</span>
        <input className={INPUT} value={valor.nombre} maxLength={100} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej.: Paquete 10 empresas" />
        {err("nombre") && <span className="block text-xs text-red-600">{err("nombre")}</span>}
      </label>
      <label className="block text-sm">Cantidad de empresas <span className="text-red-600">*</span>
        <input className={INPUT} inputMode="numeric" value={valor.cantidad_empresas} onChange={(e) => set("cantidad_empresas", e.target.value.replace(/\D/g, ""))} placeholder="Ej.: 10" />
        {err("cantidad_empresas") && <span className="block text-xs text-red-600">{err("cantidad_empresas")}</span>}
      </label>
      <label className="block text-sm">Periodicidad <span className="text-red-600">*</span>
        <select className={INPUT} value={valor.periodicidad} onChange={(e) => set("periodicidad", e.target.value)}>
          <option value="">Seleccione...</option>
          {PERIODICIDADES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
        </select>
        {err("periodicidad") && <span className="block text-xs text-red-600">{err("periodicidad")}</span>}
      </label>
      <label className="block text-sm">Fecha de inicio
        <input type="date" className={INPUT} value={valor.fecha_inicio} onChange={(e) => set("fecha_inicio", e.target.value)} />
        {err("fecha_inicio") && <span className="block text-xs text-red-600">{err("fecha_inicio")}</span>}
        <span className="block text-xs text-slate-500">El vencimiento se calcula según la periodicidad.</span>
      </label>
    </div>
  );
}
