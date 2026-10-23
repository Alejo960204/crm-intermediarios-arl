"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError, MAX_SOPORTE_BYTES, TIPOS_DOCUMENTO, clearToken, descargarSoporte, guardarIdoneidad, listarIdoneidad,
  type SoporteInfo,
} from "@/lib/api";
import { useSucio, type PestanaHandle, type PropsPestana } from "@/lib/pestanas";

interface Fila {
  clave: string;
  id: number | null;
  nombres_apellidos: string;
  tipo_documento: string;
  numero_documento: string;
  cargo: string;
  correo: string;
  telefono: string;
  soportes: SoporteInfo[]; // ya guardados
  nuevos: File[]; // pendientes de subir al guardar
}

const INPUT = "mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-600";
const kb = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default forwardRef<PestanaHandle, PropsPestana>(function PestanaIdoneidad(
  { registroId, soloLectura, faltantes, onGuardado }, ref,
) {
  const router = useRouter();
  const contador = useRef(0);
  const nuevaClave = () => `f${Date.now()}_${contador.current++}`;
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState("");
  const [mensaje, setMensaje] = useState("");

  function manejarError(e: unknown) {
    const err = e as ApiError;
    if (err.message === "UNAUTHORIZED") { clearToken(); router.replace("/login"); return; }
    setErrores(err.campos ?? {});
    setErrorGeneral(err.message);
  }

  function aFilas(datos: Awaited<ReturnType<typeof listarIdoneidad>>): Fila[] {
    return datos.map((p) => ({
      clave: nuevaClave(), id: p.id, nombres_apellidos: p.nombres_apellidos, tipo_documento: p.tipo_documento,
      numero_documento: p.numero_documento, cargo: p.cargo ?? "", correo: p.correo ?? "", telefono: p.telefono ?? "",
      soportes: p.soportes, nuevos: [],
    }));
  }

  const { sucio, limpiar } = useSucio(
    JSON.stringify(filas.map((f) => ({ ...f, nuevos: f.nuevos.map((n) => `${n.name}:${n.size}`) }))), cargando,
  );

  useEffect(() => {
    listarIdoneidad(registroId).then((d) => { setFilas(aFilas(d)); limpiar(); }).catch(manejarError).finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registroId]);

  function limpiarAvisos(clave?: string) {
    setMensaje(""); setErrorGeneral("");
    if (clave !== undefined) setErrores((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith(`personas.${indiceDe(clave)}.`))));
  }
  const indiceDe = (clave: string) => filas.findIndex((f) => f.clave === clave);

  function cambiar(clave: string, campo: keyof Fila, valor: string) {
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f)));
    setErrores((e) => ({ ...e, [`personas.${indiceDe(clave)}.${campo}`]: "" }));
    setMensaje("");
  }

  function agregar() {
    setFilas((fs) => [...fs, {
      clave: nuevaClave(), id: null, nombres_apellidos: "", tipo_documento: "CC", numero_documento: "",
      cargo: "", correo: "", telefono: "", soportes: [], nuevos: [],
    }]);
    limpiarAvisos();
  }

  function quitarFila(clave: string) {
    setFilas((fs) => fs.filter((f) => f.clave !== clave));
    setErrores({});
    limpiarAvisos();
  }

  function agregarArchivos(clave: string, lista: FileList | null) {
    if (!lista) return;
    const idx = indiceDe(clave);
    const validos: File[] = [];
    let problema = "";
    for (const f of Array.from(lista)) {
      if (!f.name.toLowerCase().endsWith(".pdf")) problema = `'${f.name}' no es un PDF.`;
      else if (f.size > MAX_SOPORTE_BYTES) problema = `'${f.name}' supera el máximo de 5 MB.`;
      else if (f.size === 0) problema = `'${f.name}' está vacío.`;
      else validos.push(f);
    }
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, nuevos: [...f.nuevos, ...validos] } : f)));
    setErrores((e) => ({ ...e, [`personas.${idx}.soportes`]: problema }));
    setMensaje("");
  }

  const quitarNuevo = (clave: string, i: number) =>
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, nuevos: f.nuevos.filter((_, j) => j !== i) } : f)));
  const quitarGuardado = (clave: string, id: number) =>
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, soportes: f.soportes.filter((s) => s.id !== id) } : f)));

  async function bajar(s: SoporteInfo) {
    try { await descargarSoporte(registroId, s); } catch (e) { manejarError(e); }
  }

  async function guardar(): Promise<boolean> {
    setErrores({}); setErrorGeneral(""); setMensaje(""); setGuardando(true);
    let ok = false;
    try {
      const personas = filas.map((f) => ({
        id: f.id, clave: f.clave, nombres_apellidos: f.nombres_apellidos, tipo_documento: f.tipo_documento,
        numero_documento: f.numero_documento, cargo: f.cargo, correo: f.correo, telefono: f.telefono,
        soportes_conservar: f.soportes.map((s) => s.id),
      }));
      const archivos = Object.fromEntries(filas.filter((f) => f.nuevos.length).map((f) => [f.clave, f.nuevos]));
      setFilas(aFilas(await guardarIdoneidad(registroId, personas, archivos)));
      limpiar();
      setMensaje("Competencia profesional guardada correctamente.");
      ok = true;
      onGuardado?.();
    } catch (e) {
      manejarError(e);
    } finally {
      setGuardando(false);
    }
    return ok;
  }

  useImperativeHandle(ref, () => ({ guardar, sucio: () => sucio }));

  if (cargando) return <p className="text-sm text-slate-500">Cargando...</p>;

  const todos = { ...(faltantes ?? {}), ...errores };
  const err = (i: number, campo: string) => todos[`personas.${i}.${campo}`];

  return (
    <section className="rounded-lg bg-white p-6 shadow">
      <h2 className="text-lg font-semibold">Equipo que desempeña la función de intermediación</h2>
      <p className="mb-4 text-sm text-slate-500">
        Registre cada persona y adjunte los soportes (PDF, máximo 5 MB cada uno) de sus cursos del SGRL.
      </p>

      {filas.length === 0 && (
        <p className="rounded border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          {soloLectura ? "No hay personas registradas." : "Aún no hay personas. Use \"Agregar persona\"."}
        </p>
      )}

      <div className="space-y-4">
        {filas.map((f, i) => (
          <div key={f.clave} className="rounded border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-700">Persona {i + 1}</h3>
              {!soloLectura && (
                <button type="button" onClick={() => quitarFila(f.clave)} className="text-xs text-red-700 hover:underline">
                  Eliminar persona
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-6">
              <label className="block text-sm sm:col-span-3">Nombres y apellidos <span className="text-red-600">*</span>
                <input value={f.nombres_apellidos} disabled={soloLectura} className={INPUT}
                  onChange={(e) => cambiar(f.clave, "nombres_apellidos", e.target.value)} />
                {err(i, "nombres_apellidos") && <span className="text-xs text-red-600">{err(i, "nombres_apellidos")}</span>}
              </label>
              <label className="block text-sm sm:col-span-1">Tipo doc. <span className="text-red-600">*</span>
                <select value={f.tipo_documento} disabled={soloLectura} className={INPUT}
                  onChange={(e) => cambiar(f.clave, "tipo_documento", e.target.value)}>
                  {TIPOS_DOCUMENTO.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="block text-sm sm:col-span-2">Número de documento <span className="text-red-600">*</span>
                <input value={f.numero_documento} disabled={soloLectura} className={INPUT}
                  onChange={(e) => cambiar(f.clave, "numero_documento", e.target.value)} />
                {err(i, "numero_documento") && <span className="text-xs text-red-600">{err(i, "numero_documento")}</span>}
              </label>
              <label className="block text-sm sm:col-span-2">Cargo
                <input value={f.cargo} disabled={soloLectura} className={INPUT}
                  onChange={(e) => cambiar(f.clave, "cargo", e.target.value)} />
              </label>
              <label className="block text-sm sm:col-span-2">Correo electrónico
                <input type="email" value={f.correo} disabled={soloLectura} className={INPUT}
                  onChange={(e) => cambiar(f.clave, "correo", e.target.value)} />
                {err(i, "correo") && <span className="text-xs text-red-600">{err(i, "correo")}</span>}
              </label>
              <label className="block text-sm sm:col-span-2">Teléfono
                <input value={f.telefono} disabled={soloLectura} className={INPUT}
                  onChange={(e) => cambiar(f.clave, "telefono", e.target.value)} />
                {err(i, "telefono") && <span className="text-xs text-red-600">{err(i, "telefono")}</span>}
              </label>
            </div>

            <div className="mt-4">
              <p className="text-sm">Soportes de cursos SGRL (PDF)</p>
              <ul className="mt-1 space-y-1 text-sm">
                {f.soportes.map((s) => (
                  <li key={s.id} className="flex items-center justify-between rounded bg-slate-50 px-3 py-1">
                    <span>{s.nombre_original} <span className="text-xs text-slate-500">({kb(s.tamano_bytes)})</span></span>
                    <span className="flex gap-3 text-xs">
                      <button type="button" onClick={() => bajar(s)} className="text-blue-700 hover:underline">Descargar</button>
                      {!soloLectura && (
                        <button type="button" onClick={() => quitarGuardado(f.clave, s.id)} className="text-red-700 hover:underline">Quitar</button>
                      )}
                    </span>
                  </li>
                ))}
                {f.nuevos.map((n, j) => (
                  <li key={`n${j}`} className="flex items-center justify-between rounded bg-amber-50 px-3 py-1">
                    <span>{n.name} <span className="text-xs text-slate-500">({kb(n.size)}) — se subirá al guardar</span></span>
                    <button type="button" onClick={() => quitarNuevo(f.clave, j)} className="text-xs text-red-700 hover:underline">Quitar</button>
                  </li>
                ))}
                {f.soportes.length === 0 && f.nuevos.length === 0 && <li className="text-xs text-slate-500">Sin soportes.</li>}
              </ul>
              {!soloLectura && (
                <input type="file" accept="application/pdf,.pdf" multiple
                  onChange={(e) => { agregarArchivos(f.clave, e.target.files); e.target.value = ""; }}
                  className="mt-2 block text-sm" />
              )}
              {err(i, "soportes") && <p className="mt-1 text-xs text-red-600">{err(i, "soportes")}</p>}
            </div>
          </div>
        ))}
      </div>

      {todos.personas && <p className="mt-4 text-sm text-red-600">{todos.personas}</p>}
      {errorGeneral && <p className="mt-4 text-sm text-red-600">{errorGeneral}</p>}
      {mensaje && <p className="mt-4 text-sm text-green-700">{mensaje}</p>}

      {!soloLectura && (
        <div className="mt-6 flex justify-between">
          <button type="button" onClick={agregar} className="rounded border border-slate-300 px-4 py-2 text-sm">+ Agregar persona</button>
          <button type="button" onClick={guardar} disabled={guardando}
            className="rounded bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-60">
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      )}
    </section>
  );
});
