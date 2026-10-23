"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  clearToken, descargarDiagnosticoPdf, getToken, obtenerDiagnostico, type BloqueDx, type DiagnosticoDetalle,
} from "@/lib/api";

const NIVEL: Record<string, string> = {
  Baja: "bg-green-100 text-green-800", Media: "bg-amber-100 text-amber-800", Alta: "bg-red-100 text-red-800",
};
const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("es-CO");

function Tarjeta({ titulo, b, extra }: { titulo: string; b: BloqueDx; extra?: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-white p-6 shadow">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-700">{titulo}</h2>
        {b.nivel && <span className={`rounded-full px-3 py-1 text-xs ${NIVEL[b.nivel] ?? "bg-slate-200"}`}>Nivel {b.nivel}</span>}
        {!b.nivel && extra}
      </div>
      <p className="mt-2 text-sm text-slate-600">{b.resumen}</p>
      {b.hallazgos.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{b.hallazgos.map((h, i) => <li key={i}>{h}</li>)}</ul>}
    </section>
  );
}

export default function ResultadoDiagnostico() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<DiagnosticoDetalle | null>(null);
  const [error, setError] = useState("");

  const fallo = (e: unknown) => {
    if ((e as Error).message === "UNAUTHORIZED") { clearToken(); router.replace("/login"); return; }
    setError((e as Error).message);
  };
  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    obtenerDiagnostico(Number(id)).then(setD).catch(fallo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!d) return <main className="p-6 text-sm text-slate-500">{error || "Cargando..."}</main>;
  const r = d.resultado;
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Diagnóstico · {d.empresa}</h1>
          <p className="text-xs text-slate-500">Fecha {fmt(d.fecha_diagnostico)} · Registrado por {d.creado_por}</p>
        </div>
        <div className="flex gap-2 text-sm">
          <button onClick={() => descargarDiagnosticoPdf(d.id).catch(fallo)} className="rounded bg-blue-700 px-3 py-2 text-white">Descargar PDF</button>
          <Link href={`/diagnosticos/${d.id}/editar`} className="rounded border border-slate-300 px-3 py-2">Editar</Link>
          <Link href={`/diagnosticos?empresa_id=${d.empresa_id}`} className="rounded border border-slate-300 px-3 py-2">Historial</Link>
          <Link href="/diagnosticos" className="rounded border border-slate-300 px-3 py-2">Volver al listado</Link>
        </div>
      </header>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Tarjeta titulo="SG-SST" b={r.sgsst}
        extra={<span className="rounded-full bg-slate-200 px-3 py-1 text-xs">{r.sgsst_puntos}/{r.sgsst_total} · nivel pendiente</span>} />
      <Tarjeta titulo="Accidentalidad" b={r.accidentalidad} />
      <Tarjeta titulo="Enfermedad laboral" b={r.enfermedad_laboral} />
      <Tarjeta titulo="Factores de riesgo" b={r.factores_riesgo}
        extra={<span className="rounded-full bg-slate-200 px-3 py-1 text-xs">{r.factores_existentes.length} de 9</span>} />
      <section className="rounded-lg bg-white p-6 text-sm shadow">
        <h2 className="font-semibold text-slate-700">Intermediario</h2>
        <p className="mt-1">Nombre: {d.intermediario_nombre ?? "—"} · RUI: {d.intermediario_rui ?? "—"} · NIT: {d.intermediario_nit ?? "—"}</p>
      </section>
    </main>
  );
}
