import type { EstadoProceso } from "@/lib/api";

const COLORES: Record<EstadoProceso, string> = {
  Pendiente: "bg-slate-200 text-slate-700",
  "En proceso": "bg-blue-100 text-blue-800",
  Vigente: "bg-green-100 text-green-800",
  Caducado: "bg-red-100 text-red-800",
};

export default function EstadoProcesoBadge({ estado }: { estado: EstadoProceso }) {
  return <span className={`rounded-full px-2 py-1 text-xs ${COLORES[estado]}`}>{estado}</span>;
}
