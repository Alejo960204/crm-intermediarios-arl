"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { clearToken, getToken, MENU_SGSST, obtenerUsuarioActual, SECCIONES, type Usuario } from "@/lib/api";

const ITEM = "block rounded-md border-l-2 border-transparent px-3 py-1.5 text-sm hover:bg-white/10 hover:text-white";

/** Menú lateral izquierdo (todas las pantallas excepto el login). Los ítems dependen del rol. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [sgsst, setSgsst] = useState(true);
  const enLogin = pathname.startsWith("/login") || pathname.startsWith("/recuperar");

  useEffect(() => {
    if (enLogin || !getToken()) { setUsuario(null); return; }
    obtenerUsuarioActual().then(setUsuario).catch(() => setUsuario(null));
  }, [enLogin, pathname]);

  useEffect(() => { setAbierto(false); }, [pathname]);

  if (enLogin) return <>{children}<ThemeToggle className="fixed right-4 top-4 z-10 border border-slate-300 bg-white/80 text-slate-700 shadow backdrop-blur hover:bg-white" /></>;
  if (!usuario) return <>{children}</>;

  const root = usuario.rol === "root Admin";
  const empleado = usuario.rol === "empleado";
  const enlace = (href: string, texto: string, extra = "") => {
    const activo = pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
    return (
      <Link key={href} href={href} className={`${ITEM} ${extra} ${activo ? "border-marca-cielo bg-white/15 font-medium text-white" : "text-white/75"}`}>
        {texto}
      </Link>
    );
  };
  const sec = (k: string, extra = "") => enlace(`/secciones/${k}`, SECCIONES[k], extra);

  return (
    <div className="md:flex md:min-h-screen">
      <div className="flex items-center justify-between bg-gradient-to-r from-marca-marino to-[#0b2a40] px-4 py-2 text-white md:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Progrescol BIC S.A.S." className="h-9 w-auto rounded bg-white px-2 py-0.5" />
        <div className="flex items-center gap-2">
          <ThemeToggle className="text-white/80 hover:bg-white/10" />
          <button type="button" aria-label="Abrir menú" className="rounded border border-white/30 px-2 py-1 text-xs"
            onClick={() => setAbierto(!abierto)}>{abierto ? "Cerrar" : "Menú"}</button>
        </div>
      </div>
      <aside aria-label="Menú principal"
        className={`${abierto ? "block" : "hidden"} w-full shrink-0 bg-gradient-to-b from-marca-marino via-[#103a56] to-[#0a2536] p-3 text-white md:sticky md:top-0 md:block md:h-screen md:w-64 md:overflow-y-auto`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Progrescol BIC S.A.S." className="mb-4 hidden w-full rounded-xl bg-white p-2 shadow-lg ring-1 ring-white/20 md:block" />
        <nav className="space-y-0.5">
          {root && enlace("/dashboard", "Dashboard")}
          {usuario.rol === "cliente" && enlace("/mi-panel", "Mi panel")}
          {!empleado && enlace("/registros", "Mis Registros")}
          {enlace("/empresas", "Empresas")}
          {enlace("/procesos", "Procesos")}
          {enlace("/diagnosticos", "Diagnósticos")}
          {root && enlace("/usuarios", "Usuarios")}
          <div className="my-2 border-t border-white/15" />
          {sec("rui")}
          <button type="button" onClick={() => setSgsst(!sgsst)} aria-expanded={sgsst}
            className={`${ITEM} flex w-full items-center justify-between text-left text-white/75`}>
            <span>SG-SST <span className="text-xs text-white/50">(seguridad en el trabajo)</span></span><span>{sgsst ? "−" : "+"}</span>
          </button>
          {sgsst && (
            <div className="ml-3 border-l border-white/15 pl-2">
              {MENU_SGSST.map((g) => g.items.length === 1 && g.grupo === SECCIONES[g.items[0]]
                ? sec(g.items[0])
                : (
                  <div key={g.grupo} className="mt-1">
                    <p className="px-3 pt-1 text-xs uppercase tracking-wide text-marca-verde">{g.grupo}</p>
                    {g.items.map((k) => sec(k, "pl-5"))}
                  </div>
                ))}
            </div>
          )}
        </nav>
        <div className="mt-4 border-t border-white/15 pt-3">
          <div className="flex items-center justify-between gap-2 px-3">
            <p className="truncate text-xs text-white/60">{usuario.nombre} · {usuario.rol}</p>
            <ThemeToggle className="hidden shrink-0 text-white/80 hover:bg-white/10 md:inline-flex" />
          </div>
          <button type="button" className={`${ITEM} w-full text-left text-white/75`}
            onClick={() => { clearToken(); setUsuario(null); router.push("/login"); }}>Cerrar sesión</button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
