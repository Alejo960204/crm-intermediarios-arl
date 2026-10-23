"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearToken, getToken, MENU_SGSST, obtenerUsuarioActual, SECCIONES, type Usuario } from "@/lib/api";

const ITEM = "block rounded px-3 py-1.5 text-sm hover:bg-slate-700";

/** Menú lateral izquierdo (todas las pantallas excepto el login). Los ítems dependen del rol. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [sgsst, setSgsst] = useState(true);
  const enLogin = pathname.startsWith("/login");

  useEffect(() => {
    if (enLogin || !getToken()) { setUsuario(null); return; }
    obtenerUsuarioActual().then(setUsuario).catch(() => setUsuario(null));
  }, [enLogin, pathname]);

  useEffect(() => { setAbierto(false); }, [pathname]);

  if (enLogin || !usuario) return <>{children}</>;

  const root = usuario.rol === "root Admin";
  const empleado = usuario.rol === "empleado";
  const enlace = (href: string, texto: string, extra = "") => {
    const activo = pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
    return (
      <Link key={href} href={href} className={`${ITEM} ${extra} ${activo ? "bg-slate-700 font-medium text-white" : "text-slate-300"}`}>
        {texto}
      </Link>
    );
  };
  const sec = (k: string, extra = "") => enlace(`/secciones/${k}`, SECCIONES[k], extra);

  return (
    <div className="md:flex md:min-h-screen">
      <div className="flex items-center justify-between bg-slate-900 px-4 py-2 text-white md:hidden">
        <span className="text-sm font-semibold">CRM Intermediarios ARL</span>
        <button type="button" aria-label="Abrir menú" className="rounded border border-slate-600 px-2 py-1 text-xs"
          onClick={() => setAbierto(!abierto)}>{abierto ? "Cerrar" : "Menú"}</button>
      </div>
      <aside aria-label="Menú principal"
        className={`${abierto ? "block" : "hidden"} w-full shrink-0 bg-slate-900 p-3 text-white md:block md:w-64`}>
        <p className="mb-3 hidden px-3 text-sm font-semibold md:block">CRM Intermediarios ARL</p>
        <nav className="space-y-0.5">
          {root && enlace("/dashboard", "Dashboard")}
          {!empleado && enlace("/registros", "Mis Registros")}
          {enlace("/empresas", "Empresas")}
          {enlace("/procesos", "Procesos")}
          {enlace("/diagnosticos", "Diagnósticos")}
          {root && enlace("/usuarios", "Usuarios")}
          <div className="my-2 border-t border-slate-700" />
          {sec("rui")}
          <button type="button" onClick={() => setSgsst(!sgsst)} aria-expanded={sgsst}
            className={`${ITEM} flex w-full items-center justify-between text-left text-slate-300`}>
            <span>SG-SST <span className="text-xs text-slate-400">(seguridad en el trabajo)</span></span><span>{sgsst ? "−" : "+"}</span>
          </button>
          {sgsst && (
            <div className="ml-3 border-l border-slate-700 pl-2">
              {MENU_SGSST.map((g) => g.items.length === 1 && g.grupo === SECCIONES[g.items[0]]
                ? sec(g.items[0])
                : (
                  <div key={g.grupo} className="mt-1">
                    <p className="px-3 pt-1 text-xs uppercase tracking-wide text-slate-400">{g.grupo}</p>
                    {g.items.map((k) => sec(k, "pl-5"))}
                  </div>
                ))}
            </div>
          )}
        </nav>
        <div className="mt-4 border-t border-slate-700 pt-3">
          <p className="truncate px-3 text-xs text-slate-400">{usuario.nombre} · {usuario.rol}</p>
          <button type="button" className={`${ITEM} w-full text-left text-slate-300`}
            onClick={() => { clearToken(); setUsuario(null); router.push("/login"); }}>Cerrar sesión</button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
