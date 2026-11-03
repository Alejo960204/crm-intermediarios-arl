"use client";
/** Dashboard del usuario Empresa: proceso de afiliación, último diagnóstico, empleados y cupo, documentos y últimos cambios. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EstadoProcesoBadge from "@/components/EstadoProcesoBadge";
import { clearToken, getToken, obtenerDashboardEmpresa, type DashboardEmpresaDatos } from "@/lib/api";

const BTN = "rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50";
const fecha = (d: string) => new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString("es-CO");
const fechaHora = (d: string) => new Date(d).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
const NIVEL: Record<string, string> = { Alta: "bg-red-100 text-red-800", Media: "bg-amber-100 text-amber-800", Baja: "bg-green-100 text-green-800" };

function Caja({ titulo, children, testid }: { titulo: string; children: React.ReactNode; testid: string }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow" aria-label={titulo} data-testid={testid}>
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <div className="mt-3 text-sm">{children}</div>
    </section>
  );
}

export default function DashboardEmpresa() {
  const router = useRouter();
  const [d, setD] = useState<DashboardEmpresaDatos | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    obtenerDashboardEmpresa().then(setD).catch((e) => {
      if ((e as Error).message === "UNAUTHORIZED") { clearToken(); router.replace("/login"); } else setError((e as Error).message);
    });
  }, [router]);

  if (error) return <main className="p-6"><p className="text-red-600">{error}</p></main>;
  if (!d) return <main className="p-6 text-slate-500">Cargando...</main>;
  const { proceso: p, diagnostico: dg, empleados: em, documentos: docs } = d;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm text-slate-500">{d.empresa.nombre} · NIT {d.empresa.nit}</p>
      {d.empresa.inactiva && <p role="status" className="mt-3 rounded border border-slate-300 bg-slate-100 p-3 text-sm text-slate-700">Su empresa está <strong>inactiva</strong>: solo puede consultar la información.</p>}
      {p?.alerta && (
        <p role="alert" data-testid="alerta-proceso" className={`mt-3 rounded border p-3 text-sm ${p.alerta === "caducado" ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
          {p.alerta === "caducado"
            ? "Su afiliación está caducada. Comuníquese con su intermediario para renovarla."
            : `Su afiliación vence en ${p.dias_restantes} día(s) (${fecha(p.fecha_vencimiento as string)}). Comuníquese con su intermediario para renovarla.`}
        </p>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Caja titulo="Proceso de afiliación" testid="caja-proceso">
          {!p ? <p className="text-slate-500">Su empresa todavía no tiene un proceso de afiliación.</p> : (
            <>
              <div className="flex items-center justify-between gap-2"><EstadoProcesoBadge estado={p.estado} />
                <span className="text-xs text-slate-500">{p.total} proceso(s) en total</span></div>
              <dl className="mt-3 space-y-1 text-xs text-slate-600">
                <div><dt className="inline font-medium">ARL destino: </dt><dd className="inline">{p.arl_destino ?? "—"}</dd></div>
                <div><dt className="inline font-medium">N.º de afiliación: </dt><dd className="inline">{p.numero_afiliacion ?? "—"}</dd></div>
                <div><dt className="inline font-medium">Vigencia: </dt><dd className="inline">{p.fecha_inicio ? `${fecha(p.fecha_inicio)} → ${p.fecha_vencimiento ? fecha(p.fecha_vencimiento) : "—"}` : "—"}{p.periodo ? ` (${p.periodo})` : ""}</dd></div>
              </dl>
              <div className="mt-3"><Link href={`/procesos/${p.id}`} className={BTN}>Ver proceso</Link></div>
            </>
          )}
        </Caja>

        <Caja titulo="Último diagnóstico" testid="caja-diagnostico">
          {!dg ? (
            <><p className="text-slate-500">Aún no hay diagnósticos.</p><div className="mt-3"><Link href="/diagnosticos/nuevo" className={BTN}>+ Nuevo diagnóstico</Link></div></>
          ) : (
            <>
              <p className="text-xs text-slate-500">Del {fecha(dg.fecha_diagnostico)} · {d.total_diagnosticos} diagnóstico(s) en total</p>
              <dl className="mt-3 space-y-1 text-xs text-slate-600">
                <div><dt className="inline font-medium">SG-SST: </dt><dd className="inline">{dg.sgsst_puntos} de {dg.sgsst_total} aspectos cumplidos</dd></div>
                <div><dt className="inline font-medium">Accidentalidad: </dt><dd className="inline"><span className={`rounded-full px-2 py-0.5 ${NIVEL[dg.nivel_accidentalidad] ?? ""}`}>{dg.nivel_accidentalidad}</span></dd></div>
                <div><dt className="inline font-medium">Enfermedad laboral: </dt><dd className="inline"><span className={`rounded-full px-2 py-0.5 ${NIVEL[dg.nivel_enfermedad_laboral] ?? ""}`}>{dg.nivel_enfermedad_laboral}</span></dd></div>
              </dl>
              <div className="mt-3 flex gap-2"><Link href={`/diagnosticos/${dg.id}`} className={BTN}>Ver detalle</Link><Link href="/diagnosticos" className={BTN}>Todos</Link></div>
            </>
          )}
        </Caja>

        <Caja titulo="Empleados y cupo" testid="caja-empleados">
          <p><span className="text-3xl font-semibold">{em.activos}</span> <span className="text-slate-600">activos de {em.maximo ?? "sin límite"}</span></p>
          {em.maximo !== null && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded bg-slate-200" aria-hidden="true">
              <div className={`h-full ${em.disponibles === 0 ? "bg-red-500" : "bg-marca-verde"}`} style={{ width: `${Math.min(100, em.maximo ? (em.activos / em.maximo) * 100 : 100)}%` }} />
            </div>
          )}
          <p className="mt-2 text-xs text-slate-600">{em.disponibles === null ? "Sin límite de empleados." : em.disponibles === 0 ? "Alcanzó el cupo de empleados. Solicite al intermediario ampliarlo." : `Disponibles: ${em.disponibles}`}</p>
          <div className="mt-3"><Link href={`/empresas/${d.empresa.id}`} className={BTN}>{em.puede_crear ? "Crear / administrar empleados" : "Ver empleados"}</Link></div>
        </Caja>

        <Caja titulo="Documentos" testid="caja-documentos">
          <p><span className="text-3xl font-semibold">{docs.total}</span> <span className="text-slate-600">documento(s) cargados</span></p>
          {docs.recientes.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {docs.recientes.map((x) => <li key={x.id}><span className="font-medium">{x.nombre ?? "Documento"}</span> — {x.archivo} · {fechaHora(x.fecha)} · {x.subido_por}</li>)}
            </ul>
          )}
          <div className="mt-3"><Link href={`/empresas/${d.empresa.id}`} className={BTN}>Ver y subir documentos</Link></div>
        </Caja>
      </div>

      <section className="mt-4 rounded-lg bg-white p-5 shadow" aria-label="Últimos cambios" data-testid="caja-cambios">
        <h2 className="text-lg font-semibold">Últimos cambios</h2>
        {d.cambios.length === 0 ? <p className="mt-2 text-sm text-slate-500">Aún no hay cambios registrados.</p> : (
          <ul className="mt-2 space-y-1 text-sm">
            {d.cambios.map((c) => (
              <li key={c.id} className="text-xs text-slate-600">
                <span className="text-slate-500">{fechaHora(c.fecha)}</span> · <span className="font-medium">{c.usuario}</span> — {c.campo ? `${c.campo}: ${c.valor_anterior || "(vacío)"} → ${c.valor_nuevo || "(vacío)"}` : `${c.accion}${c.detalle ? ` (${c.detalle})` : ""}`}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3"><Link href={`/empresas/${d.empresa.id}`} className={BTN}>Ver historial completo</Link></div>
      </section>
    </main>
  );
}
