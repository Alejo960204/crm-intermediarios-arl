"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FormularioPaquete, { PAQUETE_VACIO } from "@/components/FormularioPaquete";
import {
  ApiError, asignarPaquete, atenderSolicitudPaquete, cambiarActivoUsuario, cambiarRolUsuario, cargarUsuariosExcel, crearIntermediario, historialPaquetes, clearToken, descargarPlantillaUsuarios,
  getToken, listarUsuarios, obtenerUsuarioActual, type PaqueteEntrada, type PaqueteHistorial, type ResultadoCarga, type UsuarioListado,
} from "@/lib/api";

const BTN = "rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50";
const COLOR_ESTADO = { creado: "text-green-700", omitido: "text-amber-700", error: "text-red-700" } as const;
const fmt = (d: string) => new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("es-CO");

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
  const [nuevo, setNuevo] = useState<{ nombre: string; email: string; password: string; paquete: PaqueteEntrada } | null>(null);
  const [asignando, setAsignando] = useState<{ id: number; paquete: PaqueteEntrada } | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [hist, setHist] = useState<{ id: number; filas: PaqueteHistorial[] } | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const manejar = useCallback((e: unknown) => {
    const err = e as ApiError;
    if (err.message === "UNAUTHORIZED") { clearToken(); router.replace("/login"); }
    else setError(err.message);
  }, [router]);

  const cargar = useCallback(async () => {
    try {
      const u = await obtenerUsuarioActual();
      if (u.rol !== "administrador") { router.replace("/registros"); return; }
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

  function fallo(e: unknown) {
    const err = e as ApiError;
    if (err.message === "UNAUTHORIZED") { clearToken(); router.replace("/login"); return; }
    setErrores(err.campos ?? {});
    setAviso({ ok: false, texto: err.message });
  }

  async function guardarNuevo(ev: React.FormEvent) {
    ev.preventDefault();
    if (!nuevo) return;
    setGuardando(true); setErrores({}); setAviso(null);
    try {
      const r = await crearIntermediario(nuevo);
      setUsuarios(await listarUsuarios());
      setAviso({ ok: true, texto: `Intermediario ${r.nombre} creado con el paquete «${r.paquete?.nombre}».` });
      setNuevo(null);
    } catch (e) { fallo(e); } finally { setGuardando(false); }
  }

  async function guardarPaquete(ev: React.FormEvent) {
    ev.preventDefault();
    if (!asignando) return;
    setGuardando(true); setErrores({}); setAviso(null);
    try {
      const r = await asignarPaquete(asignando.id, asignando.paquete);
      setUsuarios((l) => l && l.map((x) => (x.id === r.id ? r : x)));
      setAviso({ ok: true, texto: `Paquete «${r.paquete?.nombre}» asignado a ${r.nombre}. Su cupo empieza de cero; las empresas anteriores se siguen administrando.` });
      setAsignando(null); setHist(null);
    } catch (e) { fallo(e); } finally { setGuardando(false); }
  }

  async function verHistorial(id: number) {
    if (hist?.id === id) { setHist(null); return; }
    try { setHist({ id, filas: await historialPaquetes(id) }); } catch (e) { fallo(e); }
  }

  async function atender(id: number) {
    try {
      const r = await atenderSolicitudPaquete(id);
      setUsuarios((l) => l && l.map((x) => (x.id === r.id ? r : x)));
    } catch (e) { fallo(e); }
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
        <h1 className="text-2xl font-semibold">Intermediarios</h1>
        <div className="flex gap-2">
          <button type="button" className="rounded bg-blue-700 px-3 py-1 text-xs text-white"
            onClick={() => { setAviso(null); setErrores({}); setNuevo({ nombre: "", email: "", password: "", paquete: PAQUETE_VACIO() }); }}>
            + Nuevo intermediario
          </button>
          <Link href="/registros" className={BTN}>Volver a Mis Registros</Link>
        </div>
      </header>

      {nuevo && (
        <form onSubmit={guardarNuevo} className="mb-6 space-y-4 rounded-lg bg-white p-6 shadow" aria-label="Nuevo intermediario">
          <h2 className="text-lg font-semibold">Nuevo intermediario</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">Nombre <span className="text-red-600">*</span>
              <input className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
              {errores.nombre && <span className="block text-xs text-red-600">{errores.nombre}</span>}
            </label>
            <label className="block text-sm">Correo <span className="text-red-600">*</span>
              <input type="email" className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} />
              {errores.email && <span className="block text-xs text-red-600">{errores.email}</span>}
            </label>
            <label className="block text-sm">Contraseña inicial <span className="text-red-600">*</span>
              <input type="password" autoComplete="new-password" className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" value={nuevo.password} onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })} />
              {errores.password ? <span className="block text-xs text-red-600">{errores.password}</span> : <span className="block text-xs text-slate-500">Mínimo 8 caracteres</span>}
            </label>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-600">Paquete de empresas</h3>
            <FormularioPaquete valor={nuevo.paquete} onChange={(paquete) => setNuevo({ ...nuevo, paquete })} errores={errores} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className={BTN} onClick={() => setNuevo(null)}>Cancelar</button>
            <button disabled={guardando} className="rounded bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-60">{guardando ? "Guardando..." : "Crear intermediario"}</button>
          </div>
        </form>
      )}

      {asignando && (
        <form onSubmit={guardarPaquete} className="mb-6 space-y-4 rounded-lg bg-white p-6 shadow" aria-label="Asignar paquete">
          <h2 className="text-lg font-semibold">Asignar paquete a {usuarios?.find((x) => x.id === asignando.id)?.nombre}</h2>
          <p className="text-xs text-slate-500">Sirve para renovar o ampliar: el nuevo paquete empieza con el cupo en cero y las empresas ya creadas se siguen administrando.</p>
          <FormularioPaquete valor={asignando.paquete} onChange={(paquete) => setAsignando({ ...asignando, paquete })} errores={errores} />
          <div className="flex justify-end gap-2">
            <button type="button" className={BTN} onClick={() => setAsignando(null)}>Cancelar</button>
            <button disabled={guardando} className="rounded bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-60">{guardando ? "Guardando..." : "Asignar paquete"}</button>
          </div>
        </form>
      )}

      <section className="mb-6 rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold">Carga masiva desde Excel</h2>
        <p className="mt-1 text-sm text-slate-600">
          Descargue la plantilla, complete una fila por intermediario (nombre, correo, contraseña de al menos 8 caracteres y rol opcional: solo «intermediario»;
          vacío = intermediario) y súbala. Los correos que ya existen se omiten.
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
        Para cambiar el rol de un usuario no debe tener datos asociados (empresas o registros). Los usuarios de empresa y los empleados se crean desde la empresa y no cambian de rol. Un usuario desactivado pierde el acceso
        de inmediato; sus datos se conservan.
      </p>
      {aviso && <p role="status" className={`mb-3 text-sm ${aviso.ok ? "text-green-700" : "text-red-600"}`}>{aviso.texto}</p>}

      <section className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600">
            <tr><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Correo</th><th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Estado</th><th className="px-4 py-3">Creado</th>
              <th className="px-4 py-3">Paquete</th><th className="px-4 py-3">Datos asociados</th><th className="px-4 py-3">Acciones</th></tr>
          </thead>
          <tbody>
            {usuarios === null && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">Cargando...</td></tr>}
            {usuarios?.map((u) => {
              const propio = u.id === yo;
              const datos = [u.empresas && `${u.empresas} empresa(s)`, u.registros && `${u.registros} registro(s)`].filter(Boolean).join(" · ");
              const p = pendiente?.id === u.id ? pendiente : null;
              return (
                <tr key={u.id} className={`border-t border-slate-100 ${u.activo ? "" : "bg-slate-50 text-slate-500"}`}>
                  <td className="px-4 py-2">{u.nombre}{propio && <span className="ml-1 text-xs text-slate-400">(usted)</span>}</td>
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2">
                    {u.rol === "empresa" || u.rol === "empleado"
                      ? <span className="text-xs">{u.rol}{u.empresa_nombre && <span className="block text-slate-500">{u.empresa_nombre}</span>}</span>
                      : <select aria-label={`Rol de ${u.nombre}`} disabled={propio} value={p?.tipo === "rol" ? (p.valor as string) : u.rol}
                      title={propio ? "No puede cambiar su propio rol" : ""}
                      className="rounded border border-slate-300 px-2 py-1 text-xs disabled:bg-slate-100"
                      onChange={(e) => { setAviso(null); setPendiente(e.target.value === u.rol ? null : { id: u.id, tipo: "rol", valor: e.target.value }); }}>
                      <option value="intermediario">intermediario</option>
                      <option value="administrador">administrador</option>
                    </select>}
                  </td>
                  <td className="px-4 py-2">{u.activo ? "Activo" : "Inactivo"}</td>
                  <td className="px-4 py-2 text-xs">{fmt(u.fecha_creacion)}</td>
                  <td className="px-4 py-2 text-xs">
                    {u.rol !== "intermediario" ? "—" : !u.paquete ? <span className="text-slate-500">Sin paquete (sin límite)</span> : (
                      <div>
                        <p className="font-medium">{u.paquete.nombre}</p>
                        <p>{u.paquete.usadas} de {u.paquete.cantidad_empresas} empresas
                          {u.paquete.alerta === "agotado" && <span className="ml-1 text-red-600">(agotado)</span>}
                          {u.paquete.alerta === "poco" && <span className="ml-1 text-amber-700">(poco cupo)</span>}</p>
                        <p className={u.paquete.vencido ? "text-red-600" : "text-slate-500"}>
                          {u.paquete.fecha_vencimiento ? `${u.paquete.vencido ? "Venció" : "Vence"} ${fmt(u.paquete.fecha_vencimiento)}` : "Sin vencimiento"}
                        </p>
                        {u.paquete.solicitud_pendiente && (
                          <p className="mt-1"><span className="rounded-full bg-red-100 px-2 py-0.5 text-red-800">Solicita ampliación</span>{" "}
                            <button type="button" className="underline" onClick={() => atender(u.id)}>Marcar atendida</button></p>
                        )}
                      </div>
                    )}
                    {u.rol === "intermediario" && (
                      <div className="mt-1 flex gap-1">
                        <button type="button" className={BTN} onClick={() => { setAviso(null); setErrores({}); setNuevo(null); setAsignando({ id: u.id, paquete: PAQUETE_VACIO() }); }}>
                          {u.paquete ? "Renovar / ampliar" : "Asignar paquete"}
                        </button>
                        {u.paquete && <button type="button" className={BTN} onClick={() => verHistorial(u.id)}>{hist?.id === u.id ? "Ocultar historial" : "Historial"}</button>}
                      </div>
                    )}
                    {hist?.id === u.id && (
                      <ul className="mt-2 space-y-1 rounded border border-slate-200 bg-slate-50 p-2" aria-label="Historial de paquetes">
                        {hist.filas.map((h) => (
                          <li key={h.id}>
                            <strong>{h.nombre}</strong> · {h.usadas} de {h.cantidad_empresas} · {fmt(h.fecha_inicio)}{h.fecha_vencimiento ? ` → ${fmt(h.fecha_vencimiento)}` : " (sin vencimiento)"}
                            {h.asignado_por && ` · por ${h.asignado_por}`}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
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
