"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AvisoPaquete from "@/components/AvisoPaquete";
import {
  actualizarEmpresa, ApiError, clearToken, crearEmpresa, listarDepartamentos, listarMunicipios, listarUsuarios,
  obtenerCupo, obtenerEmpresa, obtenerUsuarioActual, type Cupo, type Departamento, type EmpresaEntrada, type EmpresaNueva, type Municipio, type Usuario,
  type UsuarioListado,
} from "@/lib/api";

const VACIA: EmpresaEntrada = {
  usuario_id: "", nombre: "", nit: "", direccion: "", telefono_fijo: "", celular: "", departamento_codigo: "",
  municipio_codigo: "", contacto_nombre: "", contacto_cargo: "", responsable_sgsst_nombre: "",
  responsable_sgsst_cargo: "", gerente: "", actividad_economica: "", trabajadores_directos: "",
  contratistas_independientes: "", estudiantes_decreto_055: "", tasa_cotizacion: "", arl_actual: "",
  tiempo_afiliacion_arl: "", valor_cotizacion_arl: "",
};
const ACCESO_VACIO = { login_email: "", login_password: "", max_empleados: "" };
const INPUT = "mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm";

export default function FormularioEmpresa({ empresaId }: { empresaId?: number }) {
  const router = useRouter();
  const [f, setF] = useState<EmpresaEntrada>(VACIA);
  const [acceso, setAcceso] = useState(ACCESO_VACIO);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [clientes, setClientes] = useState<UsuarioListado[]>([]);
  const [deptos, setDeptos] = useState<Departamento[]>([]);
  const [munis, setMunis] = useState<Municipio[]>([]);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [inactiva, setInactiva] = useState(false);
  const [cupo, setCupo] = useState<Cupo | null>(null);

  function fallo(e: unknown) {
    if (e instanceof ApiError && e.status === 401) { clearToken(); router.replace("/login"); return; }
    setError((e as Error).message);
    if (e instanceof ApiError) setErrores(e.campos ?? {});
  }

  useEffect(() => {
    (async () => {
      try {
        const u = await obtenerUsuarioActual();
        setUsuario(u);
        const [d, cl] = await Promise.all([
          listarDepartamentos(), u.rol === "administrador" ? listarUsuarios() : Promise.resolve([]),
        ]);
        setDeptos(d); setClientes(cl.filter((x) => x.rol === "intermediario" && x.activo));
        if (!empresaId && u.rol === "intermediario") setCupo(await obtenerCupo());
        if (empresaId) {
          const e = await obtenerEmpresa(empresaId);
          setInactiva(e.inactiva);
          const nuevo = { ...VACIA };
          (Object.keys(VACIA) as (keyof EmpresaEntrada)[]).forEach((k) => { nuevo[k] = e[k] == null ? "" : String(e[k]); });
          setF(nuevo);
          if (nuevo.departamento_codigo) setMunis(await listarMunicipios(nuevo.departamento_codigo));
        }
      } catch (e) { fallo(e); } finally { setCargando(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const set = (k: keyof EmpresaEntrada, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrores((p) => ({ ...p, [k]: "" })); };

  async function cambiarDepto(codigo: string) {
    setF((p) => ({ ...p, departamento_codigo: codigo, municipio_codigo: "" })); setMunis([]);
    if (codigo) try { setMunis(await listarMunicipios(codigo)); } catch (e) { fallo(e); }
  }

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault(); setError(""); setErrores({}); setGuardando(true);
    try {
      if (empresaId) await actualizarEmpresa(empresaId, f); else await crearEmpresa({ ...f, ...acceso } as EmpresaNueva);
      router.push("/empresas");
    } catch (e) { fallo(e); } finally { setGuardando(false); }
  }

  const campo = (k: keyof EmpresaEntrada, etiqueta: string, opts: { req?: boolean; tipo?: string; ayuda?: string } = {}) => (
    <label className="block text-sm">
      <span className="font-medium">{etiqueta}{opts.req && <span className="text-red-600"> *</span>}</span>
      <input className={INPUT} type={opts.tipo ?? "text"} value={f[k]} min={opts.tipo === "number" ? 0 : undefined}
        step={opts.tipo === "number" ? "any" : undefined} onChange={(e) => set(k, e.target.value)} />
      {opts.ayuda && <span className="text-xs text-slate-500">{opts.ayuda}</span>}
      {errores[k] && <span className="block text-xs text-red-600">{errores[k]}</span>}
    </label>
  );

  if (cargando) return <main className="p-6 text-sm text-slate-500">Cargando...</main>;
  const esRoot = usuario?.rol === "administrador";
  const sinCupo = !empresaId && !!cupo && !cupo.puede_crear;
  const lectura = inactiva || sinCupo; // las empresas inactivas solo se consultan

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">{inactiva ? "Datos de la empresa" : empresaId ? "Editar empresa" : "Nueva empresa"}</h1>
      {inactiva && <p role="status" className="mb-3 rounded border border-slate-300 bg-slate-100 p-3 text-sm text-slate-700">Esta empresa está <strong>inactiva</strong>: solo se puede consultar. Reactívela desde el listado de empresas para modificarla.</p>}
      {cupo && <AvisoPaquete cupo={cupo} onCambio={setCupo} />}
      <form onSubmit={guardar} className="space-y-6 rounded-lg bg-white p-6 shadow">
       <fieldset disabled={lectura} className="space-y-6 border-0 p-0">
        {esRoot && (
          <label className="block text-sm">
            <span className="font-medium">Intermediario propietario <span className="text-red-600">*</span></span>
            <select className={INPUT} value={f.usuario_id} onChange={(e) => set("usuario_id", e.target.value)}>
              <option value="">Seleccione...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.email})</option>)}
            </select>
            {errores.usuario_id && <span className="block text-xs text-red-600">{errores.usuario_id}</span>}
          </label>
        )}

        <fieldset className="grid gap-4 md:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-slate-600">Identificación y ubicación</legend>
          {campo("nombre", "Nombre de la empresa", { req: true })}
          {campo("nit", "NIT de la empresa", { req: true, ayuda: "Solo números, sin dígito de verificación" })}
          {campo("direccion", "Dirección principal")}
          {campo("telefono_fijo", "Teléfono fijo", { ayuda: "7 a 10 dígitos" })}
          {campo("celular", "Celular", { ayuda: "10 dígitos" })}
          <div />
          <label className="block text-sm">
            <span className="font-medium">Departamento</span>
            <select className={INPUT} value={f.departamento_codigo} onChange={(e) => cambiarDepto(e.target.value)}>
              <option value="">Seleccione...</option>
              {deptos.map((d) => <option key={d.codigo} value={d.codigo}>{d.nombre}</option>)}
            </select>
            {errores.departamento_codigo && <span className="block text-xs text-red-600">{errores.departamento_codigo}</span>}
          </label>
          <label className="block text-sm">
            <span className="font-medium">Ciudad / Municipio principal</span>
            <select className={INPUT} value={f.municipio_codigo} disabled={!f.departamento_codigo}
              onChange={(e) => set("municipio_codigo", e.target.value)}>
              <option value="">Seleccione...</option>
              {munis.map((m) => <option key={m.codigo} value={m.codigo}>{m.nombre}</option>)}
            </select>
            {errores.municipio_codigo && <span className="block text-xs text-red-600">{errores.municipio_codigo}</span>}
          </label>
        </fieldset>

        {!empresaId && (
          <fieldset className="grid gap-4 md:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold text-slate-600">Acceso de la empresa y empleados</legend>
            <p className="text-xs text-slate-500 md:col-span-2">La empresa tendrá su propio usuario para ingresar al sistema, ver y editar sus datos, subir documentos y crear sus empleados.</p>
            <label className="block text-sm">
              <span className="font-medium">Correo del usuario de la empresa <span className="text-red-600">*</span></span>
              <input className={INPUT} type="email" autoComplete="off" value={acceso.login_email}
                onChange={(e) => { setAcceso({ ...acceso, login_email: e.target.value }); setErrores((p) => ({ ...p, login_email: "" })); }} />
              {errores.login_email && <span className="block text-xs text-red-600">{errores.login_email}</span>}
            </label>
            <label className="block text-sm">
              <span className="font-medium">Contraseña <span className="text-red-600">*</span></span>
              <input className={INPUT} type="password" autoComplete="new-password" value={acceso.login_password}
                onChange={(e) => { setAcceso({ ...acceso, login_password: e.target.value }); setErrores((p) => ({ ...p, login_password: "" })); }} />
              <span className="text-xs text-slate-500">Mínimo 8 caracteres</span>
              {errores.login_password && <span className="block text-xs text-red-600">{errores.login_password}</span>}
            </label>
            <label className="block text-sm">
              <span className="font-medium">Cupo de empleados</span>
              <input className={INPUT} type="number" min={0} value={acceso.max_empleados}
                onChange={(e) => { setAcceso({ ...acceso, max_empleados: e.target.value }); setErrores((p) => ({ ...p, max_empleados: "" })); }} />
              <span className="text-xs text-slate-500">Cuántos empleados puede crear la empresa. Vacío = sin límite</span>
              {errores.max_empleados && <span className="block text-xs text-red-600">{errores.max_empleados}</span>}
            </label>
          </fieldset>
        )}

        <fieldset className="grid gap-4 md:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-slate-600">Personas de contacto</legend>
          {campo("contacto_nombre", "Persona que suministra la información")}
          {campo("contacto_cargo", "Cargo")}
          {campo("responsable_sgsst_nombre", "Responsable de SG-SST")}
          {campo("responsable_sgsst_cargo", "Cargo del responsable de SG-SST")}
          {campo("gerente", "Nombre del gerente")}
        </fieldset>

        <fieldset className="grid gap-4 md:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-slate-600">Actividad y población</legend>
          {campo("actividad_economica", "Actividad económica principal")}
          {campo("trabajadores_directos", "Número de trabajadores directos", { tipo: "number" })}
          {campo("contratistas_independientes", "Contratistas independientes", { tipo: "number" })}
          {campo("estudiantes_decreto_055", "Estudiantes según Decreto 055 de 2015", { tipo: "number" })}
          {campo("tasa_cotizacion", "Tasa de cotización (clase de riesgo)", { tipo: "number", ayuda: "Porcentaje, ej. 1.044" })}
        </fieldset>

        <fieldset className="grid gap-4 md:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-slate-600">ARL actual</legend>
          {campo("arl_actual", "ARL actual", { ayuda: "Déjelo vacío si no tiene" })}
          {campo("tiempo_afiliacion_arl", "Tiempo de afiliación a la ARL actual", { ayuda: "Ej. 3 años" })}
          {campo("valor_cotizacion_arl", "Valor de la cotización a la ARL actual", { tipo: "number" })}
        </fieldset>

       </fieldset>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Link href="/empresas" className="rounded border border-slate-300 px-3 py-2 text-sm">{lectura ? "Volver" : "Cancelar"}</Link>
          {!lectura && (
            <button disabled={guardando} className="rounded bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-60">
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
