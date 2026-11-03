"use client";
import { useState } from "react";
import { solicitarAmpliacion, type Cupo } from "@/lib/api";

const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("es-CO");

/** Estado del paquete del intermediario: aviso previo (queda poco), límite alcanzado o paquete vencido, con solicitud de ampliación. */
export default function AvisoPaquete({ cupo, onCambio }: { cupo: Cupo; onCambio?: (c: Cupo) => void }) {
  const p = cupo.paquete;
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  if (!p || !p.alerta) return null;

  async function solicitar() {
    setOcupado(true); setError("");
    try { onCambio?.(await solicitarAmpliacion()); } catch (e) { setError((e as Error).message); } finally { setOcupado(false); }
  }

  const rojo = p.alerta !== "poco";
  const titulo = p.alerta === "vencido" ? "Su paquete venció"
    : p.alerta === "agotado" ? "Alcanzó el límite de su paquete" : "Le queda poco cupo en su paquete";
  const texto = p.alerta === "vencido"
    ? `El paquete «${p.nombre}» venció el ${fmt(p.fecha_vencimiento!)}. Por ahora solo puede consultar su información; renueve su paquete para volver a crear y editar.`
    : p.alerta === "agotado"
      ? `Ya creó ${p.usadas} de ${p.cantidad_empresas} empresas del paquete «${p.nombre}». Actualice su paquete para crear más empresas.`
      : `Le quedan ${p.disponibles} de ${p.cantidad_empresas} empresas del paquete «${p.nombre}». Considere ampliar su paquete.`;

  return (
    <div role="alert" data-testid="aviso-paquete"
      className={`mt-3 rounded-lg border p-4 text-sm ${rojo ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
      <p className="font-semibold">{titulo}</p>
      <p className="mt-1">{texto}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {p.solicitud_pendiente
          ? <span className="text-xs font-medium">Solicitud enviada: el administrador la verá y se comunicará con usted.</span>
          : <button type="button" onClick={solicitar} disabled={ocupado} className="rounded border border-current px-3 py-1 text-xs font-medium disabled:opacity-60">
              {ocupado ? "Enviando..." : "Solicitar ampliación de paquete"}
            </button>}
        {error && <span className="text-xs">{error}</span>}
      </div>
    </div>
  );
}
