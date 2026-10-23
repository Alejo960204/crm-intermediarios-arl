"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken, obtenerDashboard, obtenerUsuarioActual, type MetricasDashboard } from "@/lib/api";

const BTN = "rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50";

function Tarjeta({ titulo, valor, color, href, nota }: { titulo: string; valor: number; color: string; href: string; nota?: string }) {
  return (
    <Link href={href} className={`block rounded-lg border-l-4 bg-white p-5 shadow transition hover:shadow-md ${color}`}>
      <p className="text-sm text-slate-600">{titulo}</p>
      <p className="mt-1 text-4xl font-semibold">{valor}</p>
      {nota && <p className="mt-1 text-xs text-slate-500">{nota}</p>}
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [m, setM] = useState<MetricasDashboard | null>(null);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    (async () => {
      try {
        const u = await obtenerUsuarioActual();
        if (u.rol !== "root Admin") { router.replace("/"); return; }
        setNombre(u.nombre);
        setM(await obtenerDashboard());
      } catch (e) {
        if ((e as Error).message === "UNAUTHORIZED") { clearToken(); router.replace("/login"); } else setError((e as Error).message);
      }
    })();
  }, [router]);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-xs text-slate-500">{nombre} · root Admin</p>
        </div>
        <div className="flex gap-2">
        </div>
      </header>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {!m && !error && <p className="text-sm text-slate-500">Cargando...</p>}
      {m && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tarjeta titulo="Total de empresas" valor={m.total} color="border-slate-500" href="/empresas" />
            <Tarjeta titulo="Con proceso en curso" valor={m.en_curso} color="border-blue-500" href="/empresas?estado=en_curso"
              nota="Pendiente o En proceso" />
            <Tarjeta titulo="Con proceso vigente" valor={m.vigente} color="border-green-500" href="/empresas?estado=vigente" />
            <Tarjeta titulo="Con proceso caducado" valor={m.caducado} color="border-red-500" href="/empresas?estado=caducado" />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Tarjeta titulo="Sin ningún proceso" valor={m.sin_proceso} color="border-amber-400" href="/empresas?estado=sin_proceso" />
            <Tarjeta titulo={`Vigencia por vencer (próximos ${m.por_vencer_dias} días)`} valor={m.por_vencer} color="border-orange-400"
              href="/empresas?estado=por_vencer" nota="Incluidas en «vigente»" />
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Cada empresa se cuenta una sola vez según su proceso más reciente: en curso + vigente + caducado + sin proceso = total.
          </p>
        </>
      )}
    </main>
  );
}
