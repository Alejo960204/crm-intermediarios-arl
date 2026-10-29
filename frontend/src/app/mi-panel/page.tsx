"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken, obtenerMiPanel, obtenerUsuarioActual, type PanelCliente } from "@/lib/api";
import EstadoProcesoBadge from "@/components/EstadoProcesoBadge";

const BTN = "rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50";
const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("es-CO");
const COLOR_REG: Record<string, string> = {
  Borrador: "border-slate-400", "En revisión": "border-amber-500", Aprobado: "border-green-600", Rechazado: "border-red-600",
};

function Tarjeta({ titulo, valor, color, href }: { titulo: string; valor: number; color: string; href: string }) {
  return (
    <Link href={href} className={`block rounded-lg border-l-4 bg-white p-4 shadow transition hover:shadow-md ${color}`}>
      <p className="text-xs text-slate-600">{titulo}</p>
      <p className="mt-1 text-3xl font-semibold">{valor}</p>
    </Link>
  );
}

export default function MiPanelPage() {
  const router = useRouter();
  const [p, setP] = useState<PanelCliente | null>(null);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    (async () => {
      try {
        const u = await obtenerUsuarioActual();
        if (u.rol !== "cliente") { router.replace("/"); return; }
        setNombre(u.nombre);
        setP(await obtenerMiPanel());
      } catch (e) {
        if ((e as Error).message === "UNAUTHORIZED") { clearToken(); router.replace("/login"); } else setError((e as Error).message);
      }
    })();
  }, [router]);

  if (error) return <main className="p-6"><p className="text-red-600">{error}</p></main>;
  if (!p) return <main className="p-6 text-slate-500">Cargando...</main>;

  const alertas = p.empresas.filter((e) => e.alerta);
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold">Mi panel</h1>
      <p className="text-sm text-slate-500">Bienvenido, {nombre}.</p>

      {alertas.length > 0 && (
        <section aria-label="Alertas de vigencia" className="mt-4 space-y-2">
          {alertas.map((e) => (
            <div key={e.id} role="alert"
              className={`rounded border p-3 text-sm ${e.alerta === "caducado" ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
              <strong>{e.nombre}</strong>:{" "}
              {e.alerta === "caducado"
                ? `la vigencia caducó el ${fmt(e.fecha_vencimiento!)}. Solicite la renovación.`
                : `la vigencia vence el ${fmt(e.fecha_vencimiento!)} (${e.dias_restantes === 0 ? "hoy" : e.dias_restantes === 1 ? "en 1 día" : `en ${e.dias_restantes} días`}).`}
            </div>
          ))}
        </section>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-6">
        <Tarjeta titulo="Mis empresas" valor={p.resumen.total_empresas} color="border-slate-500" href="/empresas" />
        <Tarjeta titulo="Proceso en curso" valor={p.resumen.en_curso} color="border-blue-500" href="/empresas?estado=en_curso" />
        <Tarjeta titulo="Vigentes" valor={p.resumen.vigente} color="border-green-600" href="/empresas?estado=vigente" />
        <Tarjeta titulo="Caducados" valor={p.resumen.caducado} color="border-red-600" href="/empresas?estado=caducado" />
        <Tarjeta titulo="Sin proceso" valor={p.resumen.sin_proceso} color="border-slate-400" href="/empresas?estado=sin_proceso" />
        <Tarjeta titulo={`Vencen en ${p.por_vencer_dias} días`} valor={p.resumen.por_vencer} color="border-amber-500" href="/empresas?estado=por_vencer" />
      </section>

      <h2 className="mt-8 text-lg font-semibold">Mis empresas</h2>
      {p.empresas.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Aún no tiene empresas. <Link href="/empresas/nueva" className="text-blue-700 underline">Registrar una empresa</Link></p>
      ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {p.empresas.map((e) => (
            <article key={e.id} className="rounded-lg bg-white p-4 shadow">
              <div className="flex items-start justify-between gap-2">
                <div><h3 className="font-medium">{e.nombre}</h3><p className="text-xs text-slate-500">NIT {e.nit}</p></div>
                {e.estado ? <EstadoProcesoBadge estado={e.estado} /> : <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">Sin proceso</span>}
              </div>
              {e.estado ? (
                <dl className="mt-3 space-y-1 text-xs text-slate-600">
                  <div><dt className="inline font-medium">ARL destino: </dt><dd className="inline">{e.arl_destino ?? "—"}</dd></div>
                  <div><dt className="inline font-medium">Vence: </dt><dd className="inline">{e.fecha_vencimiento ? fmt(e.fecha_vencimiento) : "—"}</dd></div>
                  <div><dt className="inline font-medium">Responsable: </dt><dd className="inline">{e.empleado ?? "Sin asignar"}</dd></div>
                </dl>
              ) : <p className="mt-3 text-xs text-slate-500">Esta empresa todavía no tiene un proceso de afiliación.</p>}
              <div className="mt-3 flex gap-2">
                {e.proceso_id && <Link href={`/procesos/${e.proceso_id}`} className={BTN}>Ver proceso</Link>}
                {!e.proceso_id && <Link href="/procesos/nuevo" className={BTN}>Crear proceso</Link>}
              </div>
            </article>
          ))}
        </div>
      )}

      <h2 className="mt-8 text-lg font-semibold">Mis registros (Formulario Único)</h2>
      <section className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Object.entries(p.registros).map(([estado, n]) => (
          <Link key={estado} href="/registros" className={`block rounded-lg border-l-4 bg-white p-4 shadow transition hover:shadow-md ${COLOR_REG[estado]}`}>
            <p className="text-xs text-slate-600">{estado}</p><p className="mt-1 text-3xl font-semibold">{n}</p>
          </Link>
        ))}
      </section>
      <p className="mt-2 text-xs text-slate-500">Total de registros: {p.total_registros}.</p>
    </main>
  );
}
