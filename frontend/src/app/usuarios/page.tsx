"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError, cambiarActivoUsuario, cambiarRolUsuario, cargarUsuariosExcel, clearToken, descargarPlantillaUsuarios,
  getToken, listarUsuarios, obtenerUsuarioActual, type ResultadoCarga, type UsuarioListado,
} from "@/lib/api";

const BTN = "rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50";
const COLOR_ESTADO = { creado: "text-green-700", omitido: "text-amber-700", error: "text-red-700" } as const;
const fmt = (d: string) => new Date(d).toLocaleDateString("es-CO");

type Pendiente = { id: number; tipo: "rol" | "activo"; valor: string | boolean };

export default function UsuariosPage() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<UsuarioListado[] | null>(null);
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const [yo, setYo] = useState<number | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const manejar = useCallback((e: unknown) => {
    const err = e as ApiError;
    if (err.message === "UNAUTHORIZED") { clearToken(); router.replace("/login"); }
    else setError(err.message);
  }, [router]);

  const cargar = useCallback(async () => {
    try {
      const u = await obtenerUsuarioActual();
      if (u.rol !== "root Admin") { router.replace("/registros"); return; }
      setYo(u.id);
      setUsuarios(await listarUsuarios());
    } catch (e) { manejar(e); }
  }, [manejar, router]);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    cargar();
  }, [router, cargar]);

  async function aplicar() {
    if (!pendiente) return;
    setAviso(null);
    try {
      const r = pendiente.tipo === "rol"
        ? await cambiarRolUsuario(pendiente.id, pendiente.valor as string)
        : await cambiarActivoUsuario(pendiente.id, pendiente.valor as boolean);
      setUsuarios((l) => l && l.map((x) => (x.id === r.id ? r : x)));
      setAviso({
        ok: true,
        texto: pendiente.tipo === "rol" ? `Rol de ${r.nombre} cambiado a ${r.rol}.` : `${r.nombre} ahora está ${r.activo ? "activo" : "inactivo"}.`,
      });
    } catch (e) {
      const err = e as ApiError;
      if (err.message === "UNAUTHORIZED") { clearToken(); router.replace("/login"); return; }
      setAviso({ ok: false, texto: err.message });
    }
    setPendiente(null);
  }

  async function subir(lista: FileList | null) {
    const f = lista?.[0];
    if (!f) return;
    setError(""); setResultado(null);
    if (!f.name.toLowerCase().endsWith(".xlsx")) { setError("El archivo debe ser un Excel .xlsx."); return; }
    setCargando(true);
    try {
      setResultado(await cargarUsuariosExcel(f));
      setUsuarios(await listarUsuarios());
    } catch (e) { manejar(e); }
    finally { setCargando(false); if (entrada.current) entrada.current.value = ""; }
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <Link href="/registros" className={BTN}>Volver a Mis Registros</Link>
      </header>

      <section className="mb-6 rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold">Carga masiva desde Excel</h2>
        <p className="mt-1 text-sm text-slate-600">
          Descargue la plantilla, complete una fila por usuario (nombre, correo, contraseña de al menos 8 caracteres y rol opcional: «cliente» o «empleado»;
          vacío = cliente) y súbala. Los correos que ya existen se omiten.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className={BTN} onClick={() => descargarPlantillaUsuarios().catch(manejar)}>
            Descargar plantilla
          </button>
          <label className={`${BTN} cursor-pointer ${cargando ? "opacity-60" : ""}`}>
            {cargando ? "Procesando..." : "Cargar desde Excel"}
            <input ref={entrada} type="file" accept=".xlsx" className="hidden" disabled={cargando}
              onChange={(e) => subir(e.target.files)} />
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {resultado && (
          <div className="mt-4">
            <p className="text-sm">
              <span className="font-medium">{resultado.total} filas procesadas:</span>{" "}
              <span className="text-green-700">{resultado.creados} creadas</span>,{" "}
              <span className="text-amber-700">{resultado.omitidos} omitidas</span>,{" "}
              <span className="text-red-700">{resultado.con_error} con error</span>.
            </p>
            <div className="mt-2 max-h-72 overflow-auto rounded border border-slate-200">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-100 uppercase text-slate-600">
                  <tr><th className="px-3 py-2">Fila</th><th className="px-3 py-2">Correo</th>
                    <th className="px-3 py-2">Resultado</th><th className="px-3 py-2">Detalle</th></tr>
                </thead>
                <tbody>
                  {resultado.filas.map((f) => (
                    <tr key={f.fila} className="border-t border-slate-100">
                      <td className="px-3 py-1">{f.fila}</td>
                      <td className="px-3 py-1">{f.correo}</td>
                      <td className={`px-3 py-1 font-medium ${COLOR_ESTADO[f.estado]}`}>{f.estado}</td>
                      <td className="px-3 py-1">{f.detalle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <p className="mb-3 text-xs text-slate-500">
        Para cambiar el rol de un usuario no debe tener datos asociados (empresas, registros o procesos asignados). Un usuario desactivado pierde el acceso
        de inmediato; sus datos y las asignaciones de procesos se conservan hasta que usted las reasigne.
      </p>
      {aviso && <p role="status" className={`mb-3 text-sm ${aviso.ok ? "text-green-700" : "text-red-600"}`}>{aviso.texto}</p>}

      <section className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600">
            <tr><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Correo</th><th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Estado</th><th className="px-4 py-3">Creado</th>
              <th className="px-4 py-3">Datos asociados</th><th className="px-4 py-3">Acciones</th></tr>
          </thead>
          <tbody>
            {usuarios === null && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Cargando...</td></tr>}
            {usuarios?.map((u) => {
              const propio = u.id === yo;
              const datos = [u.empresas && `${u.empresas} empresa(s)`, u.registros && `${u.registros} registro(s)`,
                u.procesos_asignados && `${u.procesos_asignados} proceso(s) asignado(s)`].filter(Boolean).join(" · ");
              const p = pendiente?.id === u.id ? pendiente : null;
              return (
                <tr key={u.id} className={`border-t border-slate-100 ${u.activo ? "" : "bg-slate-50 text-slate-500"}`}>
                  <td className="px-4 py-2">{u.nombre}{propio && <span className="ml-1 text-xs text-slate-400">(usted)</span>}</td>
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2">
                    <select aria-label={`Rol de ${u.nombre}`} disabled={propio} value={p?.tipo === "rol" ? (p.valor as string) : u.rol}
                      title={propio ? "No puede cambiar su propio rol" : ""}
                      className="rounded border border-slate-300 px-2 py-1 text-xs disabled:bg-slate-100"
                      onChange={(e) => { setAviso(null); setPendiente(e.target.value === u.rol ? null : { id: u.id, tipo: "rol", valor: e.target.value }); }}>
                      <option value="cliente">cliente</option>
                      <option value="empleado">empleado</option>
                      <option value="root Admin">root Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">{u.activo ? "Activo" : "Inactivo"}</td>
                  <td className="px-4 py-2 text-xs">{fmt(u.fecha_creacion)}</td>
                  <td className="px-4 py-2 text-xs">{datos || "—"}</td>
                  <td className="px-4 py-2">
                    {p ? (
                      <span className="flex flex-wrap items-center gap-2 text-xs">
                        {p.tipo === "rol" ? `¿Cambiar a ${p.valor}?` : p.valor ? "¿Activar?" : "¿Desactivar? Perderá el acceso de inmediato."}
                        <button type="button" className="rounded bg-blue-700 px-2 py-1 text-white" onClick={aplicar}>Confirmar</button>
                        <button type="button" className={BTN} onClick={() => setPendiente(null)}>Cancelar</button>
                      </span>
                    ) : (
                      <button type="button" disabled={propio} className={`${BTN} disabled:opacity-40`}
                        title={propio ? "No puede desactivar su propia cuenta" : ""}
                        onClick={() => { setAviso(null); setPendiente({ id: u.id, tipo: "activo", valor: !u.activo }); }}>
                        {u.activo ? "Desactivar" : "Activar"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
