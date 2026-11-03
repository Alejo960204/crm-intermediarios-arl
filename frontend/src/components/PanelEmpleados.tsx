"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ApiError, cambiarActivoEmpleado, cambiarCupoEmpleados, crearEmpleado, crearLoginEmpresa, listarEmpleados, obtenerEmpresa,
  type EmpleadosEmpresa, type EmpresaDetalle, type Usuario,
} from "@/lib/api";

const INPUT = "mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm";
const BTN = "rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50";

/** Acceso de la empresa (login), cupo de empleados y lista de empleados. Qué puede hacer cada rol lo decide el servidor. */
export default function PanelEmpleados({ empresaId, usuario }: { empresaId: number; usuario: Usuario }) {
  const [e, setE] = useState<EmpresaDetalle | null>(null);
  const [lista, setLista] = useState<EmpleadosEmpresa | null>(null);
  const [error, setError] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState("");
  const [nuevo, setNuevo] = useState({ nombre: "", email: "", password: "" });
  const [login, setLogin] = useState({ email: "", password: "" });
  const [cupo, setCupo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const gestion = usuario.rol === "administrador" || usuario.rol === "intermediario"; // login y cupo
  const verLista = usuario.rol !== "empleado";

  const cargar = useCallback(async () => {
    try {
      const emp = await obtenerEmpresa(empresaId);
      setE(emp); setCupo(emp.max_empleados == null ? "" : String(emp.max_empleados));
      if (verLista) setLista(await listarEmpleados(empresaId));
    } catch (x) { setError((x as Error).message); }
  }, [empresaId, verLista]);
  useEffect(() => { cargar(); }, [cargar]);

  async function accion(fn: () => Promise<unknown>, ok: string) {
    setError(""); setErrores({}); setAviso(""); setOcupado(true);
    try { await fn(); setAviso(ok); await cargar(); }
    catch (x) { setError((x as Error).message); if (x instanceof ApiError) setErrores(x.campos ?? {}); }
    finally { setOcupado(false); }
  }

  if (!e || (!gestion && !verLista)) return null;
  const inactiva = e.inactiva;
  return (
    <section className="mt-6 rounded-lg bg-white p-6 shadow" aria-label="Acceso y empleados" data-testid="panel-empleados">
      <h2 className="text-lg font-semibold">Acceso y empleados</h2>
      {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
      {aviso && <p className="mt-2 text-sm text-green-700" role="status">{aviso}</p>}

      <div className="mt-3 text-sm" data-testid="login-empresa">
        <p className="font-medium">Usuario de la empresa</p>
        {e.login_email
          ? <p className="text-slate-600">{e.login_email}{e.login_activo === false && <span className="ml-2 text-xs text-amber-700">(inactivo)</span>}</p>
          : gestion && !inactiva
            ? (
              <form className="mt-1 grid gap-3 md:grid-cols-3" onSubmit={(ev) => { ev.preventDefault(); accion(() => crearLoginEmpresa(empresaId, login), "Usuario de la empresa creado."); }}>
                <p className="text-amber-700 md:col-span-3">Esta empresa aún no tiene usuario para ingresar. Créelo para que pueda acceder.</p>
                <label className="block text-sm"><span className="font-medium">Correo</span>
                  <input className={INPUT} type="email" autoComplete="off" value={login.email} onChange={(x) => setLogin({ ...login, email: x.target.value })} />
                  {errores.email && <span className="block text-xs text-red-600">{errores.email}</span>}</label>
                <label className="block text-sm"><span className="font-medium">Contraseña</span>
                  <input className={INPUT} type="password" autoComplete="new-password" value={login.password} onChange={(x) => setLogin({ ...login, password: x.target.value })} />
                  {errores.password && <span className="block text-xs text-red-600">{errores.password}</span>}</label>
                <div className="self-end"><button disabled={ocupado} className="rounded bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-60">Crear usuario</button></div>
              </form>
            )
            : <p className="text-amber-700">Sin usuario de acceso.</p>}
      </div>

      {verLista && lista && (
        <div className="mt-5 text-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p data-testid="cupo-empleados"><span className="font-medium">Empleados:</span> {lista.activos} de {lista.maximo ?? "sin límite"} activos
              {lista.disponibles !== null && <> · Disponibles: {lista.disponibles}</>}</p>
            {gestion && !inactiva && (
              <form className="flex items-end gap-2" onSubmit={(ev) => { ev.preventDefault(); accion(() => cambiarCupoEmpleados(empresaId, cupo), "Cupo de empleados actualizado."); }}>
                <label className="block text-xs"><span className="font-medium">Cupo de empleados</span>
                  <input aria-label="Cupo de empleados" className="mt-1 w-28 rounded border border-slate-300 px-2 py-1 text-sm" type="number" min={0} value={cupo} placeholder="sin límite" onChange={(x) => setCupo(x.target.value)} /></label>
                <button disabled={ocupado} className={BTN}>Guardar cupo</button>
              </form>
            )}
          </div>
          {errores.max_empleados && <span className="block text-xs text-red-600">{errores.max_empleados}</span>}
          {lista.maximo !== null && lista.disponibles === 0 && (
            <p role="alert" className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
              Se alcanzó el cupo de empleados. {usuario.rol === "empresa" ? "Solicite al intermediario ampliar el cupo." : usuario.rol === "intermediario" ? "Puede ampliar el cupo arriba." : "El administrador puede crear empleados sin límite."}
            </p>
          )}

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600"><tr><th className="px-3 py-2">Nombre</th><th className="px-3 py-2">Correo</th><th className="px-3 py-2">Estado</th>{(usuario.rol === "empresa" || usuario.rol === "administrador") && <th className="px-3 py-2">Acciones</th>}</tr></thead>
              <tbody>
                {lista.empleados.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-500">Aún no hay empleados.</td></tr>}
                {lista.empleados.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{m.nombre}</td><td className="px-3 py-2">{m.email}</td>
                    <td className="px-3 py-2">{m.activo ? "Activo" : <span className="text-amber-700">Inactivo</span>}</td>
                    {(usuario.rol === "empresa" || usuario.rol === "administrador") && (
                      <td className="px-3 py-2"><button disabled={ocupado || inactiva} className={BTN}
                        onClick={() => accion(() => cambiarActivoEmpleado(empresaId, m.id, !m.activo), m.activo ? "Empleado desactivado." : "Empleado reactivado.")}>{m.activo ? "Desactivar" : "Reactivar"}</button></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(usuario.rol === "empresa" || usuario.rol === "administrador") && (
            lista.puede_crear
              ? (
                <form className="mt-4 grid gap-3 md:grid-cols-4" onSubmit={(ev) => { ev.preventDefault(); accion(async () => { await crearEmpleado(empresaId, nuevo); setNuevo({ nombre: "", email: "", password: "" }); }, "Empleado creado."); }}>
                  <label className="block text-sm"><span className="font-medium">Nombre</span>
                    <input className={INPUT} value={nuevo.nombre} onChange={(x) => setNuevo({ ...nuevo, nombre: x.target.value })} />
                    {errores.nombre && <span className="block text-xs text-red-600">{errores.nombre}</span>}</label>
                  <label className="block text-sm"><span className="font-medium">Correo</span>
                    <input className={INPUT} type="email" autoComplete="off" value={nuevo.email} onChange={(x) => setNuevo({ ...nuevo, email: x.target.value })} />
                    {errores.email && <span className="block text-xs text-red-600">{errores.email}</span>}</label>
                  <label className="block text-sm"><span className="font-medium">Contraseña</span>
                    <input className={INPUT} type="password" autoComplete="new-password" value={nuevo.password} onChange={(x) => setNuevo({ ...nuevo, password: x.target.value })} />
                    {errores.password && <span className="block text-xs text-red-600">{errores.password}</span>}</label>
                  <div className="self-end"><button disabled={ocupado} className="rounded bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-60">+ Crear empleado</button></div>
                </form>
              )
              : <p className="mt-4 text-xs text-slate-500">{inactiva ? "La empresa está inactiva." : "No hay cupo disponible para crear más empleados."}</p>
          )}
          {usuario.rol === "intermediario" && <p className="mt-3 text-xs text-slate-500">Los empleados los crea la empresa desde su propio acceso.</p>}
        </div>
      )}
    </section>
  );
}
