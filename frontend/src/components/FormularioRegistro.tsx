"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PestanaHumana from "@/components/PestanaHumana";
import PestanaOperativa from "@/components/PestanaOperativa";
import PestanaFirma from "@/components/PestanaFirma";
import PestanaIdoneidad from "@/components/PestanaIdoneidad";
import {
  ApiError, actualizarRegistro, clearToken, crearRegistro, decidirRegistro, enviarARevision, getToken, listarDepartamentos,
  listarMunicipios, obtenerRegistro, type Departamento, type Estado, type FaltantePestana, type Municipio,
  type RegistroDetalle, type RegistroEntrada,
} from "@/lib/api";
import { useSucio, type PestanaHandle } from "@/lib/pestanas";

const VACIO: RegistroEntrada = {
  rui: "", nit: "", razon_social: "", departamento_codigo: "", municipio_codigo: "",
  direccion: "", correo: "", telefono_fijo: "",
};

const PESTANAS = ["1. Información General", "2. Competencia Profesional", "3. Talento Humano",
  "4. Infraestructura Operativa", "5. Firma Digitalizada"];

const COLORES: Record<Estado, string> = {
  Borrador: "bg-slate-200 text-slate-700",
  "En revisión": "bg-amber-100 text-amber-800",
  Aprobado: "bg-green-100 text-green-800",
  Rechazado: "bg-red-100 text-red-800",
};

const INPUT = "mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-600";

interface Props { registroId?: number; soloLectura?: boolean }

export default function FormularioRegistro({ registroId, soloLectura = false }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<RegistroEntrada>(VACIO);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [deptos, setDeptos] = useState<Departamento[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [mensaje, setMensaje] = useState("");
  const [errorGeneral, setErrorGeneral] = useState("");
  const [pestana, setPestana] = useState(0);
  const [editable, setEditable] = useState(true);
  const [faltantes, setFaltantes] = useState<Record<number, Record<string, string>>>({});
  const [resumen, setResumen] = useState<FaltantePestana[]>([]);
  const [avisoEnvio, setAvisoEnvio] = useState("");
  const [errorEnvio, setErrorEnvio] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [confirmarAtras, setConfirmarAtras] = useState(false);
  const [decision, setDecision] = useState<Pick<RegistroDetalle, "decision_comentario" | "decision_fecha" | "decision_por" | "puede_decidir">>(
    { decision_comentario: null, decision_fecha: null, decision_por: null, puede_decidir: false });
  const [comentarioAdmin, setComentarioAdmin] = useState("");
  const [errorDecision, setErrorDecision] = useState("");
  const [decidiendo, setDecidiendo] = useState(false);
  const refs = [useRef<PestanaHandle>(null), useRef<PestanaHandle>(null), useRef<PestanaHandle>(null),
    useRef<PestanaHandle>(null)]; // pestañas 2 a 5
  const { sucio: sucio1, limpiar: limpiar1 } = useSucio(JSON.stringify(form), cargando);
  const bloqueado = soloLectura || !editable;

  function manejarError(e: unknown) {
    const err = e as ApiError;
    if (err.message === "UNAUTHORIZED") { clearToken(); router.replace("/login"); return; }
    setErrores(err.campos ?? {});
    setErrorGeneral(err.message);
  }

  useEffect(() => {
    // Tras crear el registro con «Siguiente» se vuelve a esta página indicando la pestaña a abrir
    const p = Number(new URLSearchParams(window.location.search).get("pestana"));
    if (p >= 1 && p <= 4) setPestana(p);
    if (!getToken()) { router.replace("/login"); return; }
    (async () => {
      try {
        setDeptos(await listarDepartamentos());
        if (registroId) {
          const r = await obtenerRegistro(registroId);
          setForm({
            rui: r.rui, nit: r.nit, razon_social: r.razon_social ?? "",
            departamento_codigo: r.departamento_codigo ?? "", municipio_codigo: r.municipio_codigo ?? "",
            direccion: r.direccion ?? "", correo: r.correo ?? "", telefono_fijo: r.telefono_fijo ?? "",
          });
          setEstado(r.estado);
          setEditable(r.editable);
          setDecision(r);
          limpiar1();
          if (r.departamento_codigo) setMunicipios(await listarMunicipios(r.departamento_codigo));
        }
      } catch (e) {
        manejarError(e);
      } finally {
        setCargando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registroId]);

  function cambiar(campo: keyof RegistroEntrada, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: "" }));
    setMensaje("");
  }

  async function cambiarDepartamento(codigo: string) {
    setForm((f) => ({ ...f, departamento_codigo: codigo, municipio_codigo: "" }));
    setErrores((e) => ({ ...e, departamento_codigo: "", municipio_codigo: "" }));
    setMunicipios([]);
    if (codigo) {
      try { setMunicipios(await listarMunicipios(codigo)); } catch (e) { manejarError(e); }
    }
  }

  /** Guarda la Pestaña 1. `avanzar` solo importa al crear: abre la pestaña 2 del registro recién creado. */
  async function guardarPestana1(avanzar = false): Promise<boolean> {
    setErrores({}); setErrorGeneral(""); setMensaje("");
    setGuardando(true);
    let ok = false;
    try {
      if (registroId) {
        await actualizarRegistro(registroId, form);
        limpiar1();
        setFaltantes((f) => ({ ...f, 0: {} }));
        setMensaje("Cambios guardados correctamente.");
        ok = true;
      } else {
        const nuevo = await crearRegistro(form);
        router.replace(`/registros/${nuevo.id}/editar${avanzar ? "?pestana=1" : ""}`);
      }
    } catch (e) {
      manejarError(e);
    } finally {
      setGuardando(false);
    }
    return ok;
  }

  function guardar(ev: React.FormEvent) {
    ev.preventDefault();
    guardarPestana1();
  }

  // ---- Navegación entre pestañas ----
  const hayCambios = (i: number) => (i === 0 ? sucio1 : !!refs[i - 1].current?.sucio());
  const guardarActual = (): Promise<boolean> => (pestana === 0 ? guardarPestana1() : refs[pestana - 1].current!.guardar());

  async function siguiente() {
    setConfirmarAtras(false);
    if (!bloqueado) {
      if (!registroId) { await guardarPestana1(true); return; } // crea el registro y abre la pestaña 2
      if (hayCambios(pestana) && !(await guardarActual())) return;
    }
    setPestana((p) => Math.min(4, p + 1));
  }

  function atras() {
    if (!bloqueado && hayCambios(pestana)) { setConfirmarAtras(true); return; }
    setPestana((p) => Math.max(0, p - 1));
  }

  async function guardarYVolver() {
    if (await guardarActual()) { setConfirmarAtras(false); setPestana((p) => Math.max(0, p - 1)); }
  }

  function limpiarFaltantes(i: number) {
    setFaltantes((f) => ({ ...f, [i]: {} }));
    setResumen((r) => r.filter((x) => x.pestana !== i));
  }

  async function decidir(d: "Aprobado" | "Rechazado") {
    if (!registroId) return;
    setErrorDecision("");
    if (d === "Rechazado" && !comentarioAdmin.trim()) {
      setErrorDecision("Para rechazar debe explicar el motivo en el comentario.");
      return;
    }
    setDecidiendo(true);
    try {
      const r = await decidirRegistro(registroId, d, comentarioAdmin);
      setEstado(r.estado); setEditable(r.editable); setDecision(r); setComentarioAdmin("");
    } catch (e) {
      const err = e as ApiError;
      if (err.message === "UNAUTHORIZED") { clearToken(); router.replace("/login"); return; }
      setErrorDecision(err.campos?.comentario || err.message);
    } finally { setDecidiendo(false); }
  }

  async function enviarRevision() {
    if (!registroId) return;
    setErrorEnvio(""); setAvisoEnvio(""); setResumen([]); setFaltantes({}); setErrores({});
    const pendientes = [0, 1, 2, 3, 4].filter((i) => hayCambios(i) && !(i === pestana && pestana >= 1));
    if (pendientes.length) {
      setErrorEnvio(`Hay cambios sin guardar en: ${pendientes.map((i) => PESTANAS[i]).join(", ")}. Guárdelos antes de enviar.`);
      return;
    }
    setEnviando(true);
    try {
      if (pestana >= 1 && hayCambios(pestana) && !(await refs[pestana - 1].current!.guardar())) return;
      const r = await enviarARevision(registroId);
      setEstado(r.estado); setEditable(r.editable); setDecision(r);
      setAvisoEnvio("El formulario fue enviado a revisión.");
    } catch (e) {
      const err = e as ApiError;
      if (err.message === "UNAUTHORIZED") { clearToken(); router.replace("/login"); return; }
      if (err.faltantes?.length) {
        const porPestana: Record<number, Record<string, string>> = {};
        for (const f of err.faltantes) {
          porPestana[f.pestana] = Object.fromEntries(
            f.campos.map((c) => [c.campo, c.campo === "personas" ? c.mensaje : "Campo obligatorio"]),
          );
        }
        setFaltantes(porPestana);
        setErrores(porPestana[0] ?? {});
        setResumen(err.faltantes);
      }
      setErrorEnvio(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const titulo = !registroId ? "Nuevo formulario" : soloLectura ? "Consultar formulario" : "Modificar formulario";

  // Función de render (no componente) para que los inputs no pierdan el foco al escribir
  function renderCampo({ campo, etiqueta, obligatorio, ayuda, tipo = "text" }: {
    campo: keyof RegistroEntrada; etiqueta: string; obligatorio?: boolean; ayuda?: string; tipo?: string;
  }) {
    return (
      <label key={campo} className="block text-sm">
        {etiqueta}{obligatorio && <span className="text-red-600"> *</span>}
        <input type={tipo} value={form[campo]} disabled={bloqueado}
          onChange={(e) => cambiar(campo, e.target.value)} className={INPUT} />
        {ayuda && !errores[campo] && <span className="text-xs text-slate-500">{ayuda}</span>}
        {errores[campo] && <span className="text-xs text-red-600">{errores[campo]}</span>}
      </label>
    );
  }

  if (cargando) return <main className="mx-auto max-w-4xl p-6 text-sm text-slate-500">Cargando...</main>;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{titulo}</h1>
        {estado && <span className={`rounded-full px-3 py-1 text-xs ${COLORES[estado]}`}>{estado}</span>}
      </header>

      {estado === "Aprobado" && (
        <section className="mb-4 rounded border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          <p className="font-medium">✔ Este formulario fue aprobado.</p>
          {decision.decision_comentario && (
            <p className="mt-1"><span className="font-medium">Comentario del administrador:</span> {decision.decision_comentario}</p>
          )}
        </section>
      )}
      {estado === "Rechazado" && (
        <section className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium">✖ Este formulario fue rechazado. Corríjalo y vuelva a enviarlo a revisión.</p>
          {decision.decision_comentario && (
            <p className="mt-1"><span className="font-medium">Motivo:</span> {decision.decision_comentario}</p>
          )}
        </section>
      )}
      {decision.puede_decidir && (
        <section className="mb-4 rounded border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-amber-900">Decisión del administrador</p>
          <label className="mt-2 block text-amber-900">Comentario (obligatorio para rechazar)
            <textarea value={comentarioAdmin} maxLength={1000} rows={3}
              onChange={(e) => { setComentarioAdmin(e.target.value); setErrorDecision(""); }}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </label>
          {errorDecision && <p className="mt-1 text-xs text-red-600">{errorDecision}</p>}
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={decidiendo} onClick={() => decidir("Aprobado")}
              className="rounded bg-green-700 px-4 py-2 text-sm text-white disabled:opacity-60">Aprobar</button>
            <button type="button" disabled={decidiendo} onClick={() => decidir("Rechazado")}
              className="rounded bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-60">Rechazar</button>
          </div>
        </section>
      )}

      {!soloLectura && !editable && (
        <p className="mb-4 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Este formulario está en estado «{estado}» y no se puede modificar.
        </p>
      )}

      <nav className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {PESTANAS.map((p, i) => {
          const habilitada = i === 0 || !!registroId;
          const activa = i === pestana;
          return (
            <button key={p} type="button" disabled={!habilitada} onClick={() => setPestana(i)}
              title={habilitada ? undefined : "Guarde primero la Información General"}
              className={activa
                ? "border-b-2 border-blue-700 px-3 py-2 text-sm font-medium text-blue-700"
                : habilitada
                  ? "px-3 py-2 text-sm text-slate-600 hover:text-blue-700"
                  : "cursor-not-allowed px-3 py-2 text-sm text-slate-400"}>
              {p}{faltantes[i] && Object.keys(faltantes[i]).length > 0 && <span className="ml-1 text-red-600" title="Campos obligatorios pendientes">●</span>}
            </button>
          );
        })}
      </nav>

      {/* Las pestañas permanecen montadas (solo se ocultan) para no perder lo que el usuario ya escribió */}
      <form onSubmit={guardar} className={`rounded-lg bg-white p-6 shadow ${pestana === 0 ? "" : "hidden"}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          {renderCampo({ campo: "rui", etiqueta: "Registro Único del ARL (RUI)", obligatorio: true })}
          {renderCampo({ campo: "nit", etiqueta: "NIT", obligatorio: true, ayuda: "Solo números, sin dígito de verificación." })}
          <div className="sm:col-span-2">{renderCampo({ campo: "razon_social", etiqueta: "Razón Social", obligatorio: true })}</div>

          <label className="block text-sm">Departamento <span className="text-red-600">*</span>
            <select value={form.departamento_codigo} disabled={bloqueado}
              onChange={(e) => cambiarDepartamento(e.target.value)} className={INPUT}>
              <option value="">Seleccione...</option>
              {deptos.map((d) => <option key={d.codigo} value={d.codigo}>{d.nombre}</option>)}
            </select>
            {deptos.length === 0 && (
              <span className="text-xs text-amber-700">El catálogo DANE está vacío. Cárgalo con cargar_divipola.py.</span>
            )}
            {errores.departamento_codigo && <span className="text-xs text-red-600">{errores.departamento_codigo}</span>}
          </label>

          <label className="block text-sm">Ciudad <span className="text-red-600">*</span>
            <select value={form.municipio_codigo} disabled={bloqueado || !form.departamento_codigo}
              onChange={(e) => cambiar("municipio_codigo", e.target.value)} className={INPUT}>
              <option value="">{form.departamento_codigo ? "Seleccione..." : "Seleccione primero el departamento"}</option>
              {municipios.map((m) => <option key={m.codigo} value={m.codigo}>{m.nombre}</option>)}
            </select>
            {errores.municipio_codigo && <span className="text-xs text-red-600">{errores.municipio_codigo}</span>}
          </label>

          <div className="sm:col-span-2">{renderCampo({ campo: "direccion", etiqueta: "Dirección", obligatorio: true })}</div>
          {renderCampo({ campo: "correo", etiqueta: "Correo electrónico", obligatorio: true, tipo: "email" })}
          {renderCampo({ campo: "telefono_fijo", etiqueta: "Teléfono fijo", obligatorio: true, ayuda: "Entre 7 y 10 dígitos, solo números." })}
        </div>

        {errorGeneral && <p className="mt-4 text-sm text-red-600">{errorGeneral}</p>}
        {mensaje && <p className="mt-4 text-sm text-green-700">{mensaje}</p>}

        <div className="mt-6 flex justify-end gap-2">
          {soloLectura && registroId && editable && (
            <Link href={`/registros/${registroId}/editar`} className="rounded bg-blue-700 px-4 py-2 text-sm text-white">Editar</Link>
          )}
          {!bloqueado && (
            <button disabled={guardando} className="rounded bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-60">
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          )}
        </div>
      </form>

      {registroId && (
        <>
          <div className={pestana === 1 ? "" : "hidden"}>
            <PestanaIdoneidad ref={refs[0]} registroId={registroId} soloLectura={bloqueado}
              faltantes={faltantes[1]} onGuardado={() => limpiarFaltantes(1)} />
          </div>
          <div className={pestana === 2 ? "" : "hidden"}>
            <PestanaHumana ref={refs[1]} registroId={registroId} soloLectura={bloqueado}
              faltantes={faltantes[2]} onGuardado={() => limpiarFaltantes(2)} />
          </div>
          <div className={pestana === 3 ? "" : "hidden"}>
            <PestanaOperativa ref={refs[2]} registroId={registroId} soloLectura={bloqueado}
              faltantes={faltantes[3]} onGuardado={() => limpiarFaltantes(3)} />
          </div>
          <div className={pestana === 4 ? "" : "hidden"}>
            <PestanaFirma ref={refs[3]} registroId={registroId} soloLectura={bloqueado}
              faltantes={faltantes[4]} onGuardado={() => limpiarFaltantes(4)} />
          </div>
        </>
      )}

      {resumen.length > 0 && (
        <section className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-sm">
          <p className="font-medium text-red-800">Faltan campos obligatorios para enviar a revisión:</p>
          <ul className="mt-2 space-y-1">
            {resumen.map((r) => (
              <li key={r.pestana}>
                <button type="button" onClick={() => setPestana(r.pestana)} className="font-medium text-red-800 underline">
                  {r.nombre}
                </button>
                <span className="text-red-700">: {r.campos.map((c) => c.etiqueta).join(", ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {errorEnvio && resumen.length === 0 && <p className="mt-4 text-sm text-red-600">{errorEnvio}</p>}
      {avisoEnvio && <p className="mt-4 text-sm text-green-700">{avisoEnvio}</p>}

      {confirmarAtras && (
        <section className="mt-4 rounded border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="text-amber-900">Hay cambios sin guardar en esta pestaña. Si vuelve sin guardar, seguirán sin guardarse.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={guardarYVolver} className="rounded bg-blue-700 px-3 py-1 text-white">Guardar y volver</button>
            <button type="button" onClick={() => { setConfirmarAtras(false); setPestana((p) => Math.max(0, p - 1)); }}
              className="rounded border border-slate-300 bg-white px-3 py-1">Volver sin guardar</button>
            <button type="button" onClick={() => setConfirmarAtras(false)}
              className="rounded border border-slate-300 bg-white px-3 py-1">Cancelar</button>
          </div>
        </section>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/registros" className="rounded border border-slate-300 px-4 py-2 text-sm">Volver al listado</Link>
        <div className="flex gap-2">
          {pestana > 0 && (
            <button type="button" onClick={atras} className="rounded border border-slate-300 px-4 py-2 text-sm">Atrás</button>
          )}
          {pestana < 4 && (
            <button type="button" onClick={siguiente} disabled={guardando}
              className="rounded border border-blue-700 px-4 py-2 text-sm text-blue-700 disabled:opacity-60">Siguiente</button>
          )}
          {pestana === 4 && !bloqueado && registroId && (
            <button type="button" onClick={enviarRevision} disabled={enviando}
              className="rounded bg-green-700 px-4 py-2 text-sm text-white disabled:opacity-60">
              {enviando ? "Enviando..." : "Enviar a revisión"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
