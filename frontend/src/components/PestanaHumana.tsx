"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ListaSoportes, { filtrarPdf } from "@/components/ListaSoportes";
import {
  ApiError, TIPOS_DOCUMENTO, clearToken, descargarSoporteHumana, guardarHumana, obtenerHumana,
  type HumanaDatos, type ResponsableEnvio, type SoporteInfo,
} from "@/lib/api";
import { useSucio, type PestanaHandle, type PropsPestana } from "@/lib/pestanas";

interface Fila {
  clave: string;
  id: number | null;
  empresa: string;
  cargo: string;
  fecha_inicio: string;
  fecha_fin: string;
  cargo_actual: boolean;
  funciones: string;
  soportes: SoporteInfo[];
  nuevos: File[];
}

const RESP_VACIO: ResponsableEnvio = {
  nombres_apellidos: "", tipo_documento: "", numero_documento: "", cargo: "", correo: "", telefono: "",
};

const INPUT = "mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-600";

export default forwardRef<PestanaHandle, PropsPestana>(function PestanaHumana(
  { registroId, soloLectura, faltantes, onGuardado }, ref,
) {
  const router = useRouter();
  const contador = useRef(0);
  const nuevaClave = () => `e${Date.now()}_${contador.current++}`;
  const [resp, setResp] = useState<ResponsableEnvio>(RESP_VACIO);
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

  function aEstado(d: HumanaDatos) {
    const r = d.responsable;
    setResp({
      nombres_apellidos: r.nombres_apellidos ?? "", tipo_documento: r.tipo_documento ?? "",
      numero_documento: r.numero_documento ?? "", cargo: r.cargo ?? "", correo: r.correo ?? "", telefono: r.telefono ?? "",
    });
    setFilas(d.experiencias.map((e) => ({
      clave: nuevaClave(), id: e.id, empresa: e.empresa, cargo: e.cargo, fecha_inicio: e.fecha_inicio ?? "",
      fecha_fin: e.fecha_fin ?? "", cargo_actual: e.cargo_actual, funciones: e.funciones ?? "", soportes: e.soportes, nuevos: [],
    })));
  }

  const { sucio, limpiar } = useSucio(
    JSON.stringify({ resp, filas: filas.map((f) => ({ ...f, nuevos: f.nuevos.map((n) => `${n.name}:${n.size}`) })) }), cargando,
  );

  useEffect(() => {
    obtenerHumana(registroId).then((d) => { aEstado(d); limpiar(); }).catch(manejarError).finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registroId]);

  const indiceDe = (clave: string) => filas.findIndex((f) => f.clave === clave);

  function cambiarResp(campo: keyof ResponsableEnvio, valor: string) {
    setResp((r) => ({ ...r, [campo]: valor }));
    setErrores((e) => ({ ...e, [`responsable.${campo}`]: "" }));
    setMensaje("");
  }

  function cambiarFila(clave: string, campo: "empresa" | "cargo" | "fecha_inicio" | "fecha_fin" | "funciones", valor: string) {
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f)));
    setErrores((e) => ({ ...e, [`experiencias.${indiceDe(clave)}.${campo}`]: "" }));
    setMensaje("");
  }

  function alternarActual(clave: string, actual: boolean) {
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, cargo_actual: actual, fecha_fin: actual ? "" : f.fecha_fin } : f)));
    setErrores((e) => ({ ...e, [`experiencias.${indiceDe(clave)}.fecha_fin`]: "" }));
    setMensaje("");
  }

  const agregar = () => {
    setFilas((fs) => [...fs, {
      clave: nuevaClave(), id: null, empresa: "", cargo: "", fecha_inicio: "", fecha_fin: "", cargo_actual: false, funciones: "",
      soportes: [], nuevos: [],
    }]);
    setMensaje(""); setErrorGeneral("");
  };

  const quitarFila = (clave: string) => {
    setFilas((fs) => fs.filter((f) => f.clave !== clave));
    setErrores({}); setMensaje("");
  };

  function elegirArchivos(clave: string, lista: FileList | null) {
    const { validos, problema } = filtrarPdf(lista);
    const idx = indiceDe(clave);
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, nuevos: [...f.nuevos, ...validos] } : f)));
    setErrores((e) => ({ ...e, [`experiencias.${idx}.soportes`]: problema }));
    setMensaje("");
  }

  async function bajar(s: SoporteInfo) {
    try { await descargarSoporteHumana(registroId, s); } catch (e) { manejarError(e); }
  }

  async function guardar(): Promise<boolean> {
    setErrores({}); setErrorGeneral(""); setMensaje(""); setGuardando(true);
    let ok = false;
    try {
      const experiencias = filas.map((f) => ({
        id: f.id, clave: f.clave, empresa: f.empresa, cargo: f.cargo, fecha_inicio: f.fecha_inicio,
        fecha_fin: f.cargo_actual ? "" : f.fecha_fin, cargo_actual: f.cargo_actual,
        funciones: f.funciones, soportes_conservar: f.soportes.map((s) => s.id),
      }));
      const archivos = Object.fromEntries(filas.filter((f) => f.nuevos.length).map((f) => [f.clave, f.nuevos]));
      aEstado(await guardarHumana(registroId, resp, experiencias, archivos));
      limpiar();
      setMensaje("Talento humano guardado correctamente.");
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
  const errR = (campo: string) => todos[`responsable.${campo}`];
  const errE = (i: number, campo: string) => todos[`experiencias.${i}.${campo}`];

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold">Datos del responsable</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-6">
          <label className="block text-sm sm:col-span-3">Nombres y apellidos <span className="text-red-600">*</span>
            <input value={resp.nombres_apellidos} disabled={soloLectura} className={INPUT}
              onChange={(e) => cambiarResp("nombres_apellidos", e.target.value)} />
            {errR("nombres_apellidos") && <span className="text-xs text-red-600">{errR("nombres_apellidos")}</span>}
          </label>
          <label className="block text-sm sm:col-span-1">Tipo doc. <span className="text-red-600">*</span>
            <select value={resp.tipo_documento} disabled={soloLectura} className={INPUT}
              onChange={(e) => cambiarResp("tipo_documento", e.target.value)}>
              <option value="">—</option>
              {TIPOS_DOCUMENTO.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {errR("tipo_documento") && <span className="text-xs text-red-600">{errR("tipo_documento")}</span>}
          </label>
          <label className="block text-sm sm:col-span-2">Número de documento <span className="text-red-600">*</span>
            <input value={resp.numero_documento} disabled={soloLectura} className={INPUT}
              onChange={(e) => cambiarResp("numero_documento", e.target.value)} />
            {errR("numero_documento") && <span className="text-xs text-red-600">{errR("numero_documento")}</span>}
          </label>
          <label className="block text-sm sm:col-span-2">Cargo <span className="text-red-600">*</span>
            <input value={resp.cargo} disabled={soloLectura} className={INPUT}
              onChange={(e) => cambiarResp("cargo", e.target.value)} />
            {errR("cargo") && <span className="text-xs text-red-600">{errR("cargo")}</span>}
          </label>
          <label className="block text-sm sm:col-span-2">Correo electrónico <span className="text-red-600">*</span>
            <input type="email" value={resp.correo} disabled={soloLectura} className={INPUT}
              onChange={(e) => cambiarResp("correo", e.target.value)} />
            {errR("correo") && <span className="text-xs text-red-600">{errR("correo")}</span>}
          </label>
          <label className="block text-sm sm:col-span-2">Teléfono <span className="text-red-600">*</span>
            <input value={resp.telefono} disabled={soloLectura} className={INPUT}
              onChange={(e) => cambiarResp("telefono", e.target.value)} />
            {errR("telefono") && <span className="text-xs text-red-600">{errR("telefono")}</span>}
          </label>
        </div>
      </section>

      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold">Experiencia laboral previa</h2>
        <p className="mb-4 text-sm text-slate-500">
          Registre cada experiencia del responsable y adjunte las certificaciones (PDF, máximo 5 MB cada una).
        </p>

        {filas.length === 0 && (
          <p className="rounded border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            {soloLectura ? "No hay experiencias registradas." : "Aún no hay experiencias. Use \"Agregar experiencia\"."}
          </p>
        )}

        <div className="space-y-4">
          {filas.map((f, i) => (
            <div key={f.clave} className="rounded border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-700">Experiencia {i + 1}</h3>
                {!soloLectura && (
                  <button type="button" onClick={() => quitarFila(f.clave)} className="text-xs text-red-700 hover:underline">
                    Eliminar experiencia
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="block text-sm sm:col-span-2">Empresa <span className="text-red-600">*</span>
                  <input value={f.empresa} disabled={soloLectura} className={INPUT}
                    onChange={(e) => cambiarFila(f.clave, "empresa", e.target.value)} />
                  {errE(i, "empresa") && <span className="text-xs text-red-600">{errE(i, "empresa")}</span>}
                </label>
                <label className="block text-sm sm:col-span-2">Cargo desempeñado <span className="text-red-600">*</span>
                  <input value={f.cargo} disabled={soloLectura} className={INPUT}
                    onChange={(e) => cambiarFila(f.clave, "cargo", e.target.value)} />
                  {errE(i, "cargo") && <span className="text-xs text-red-600">{errE(i, "cargo")}</span>}
                </label>
                <label className="block text-sm sm:col-span-2">Fecha de inicio <span className="text-red-600">*</span>
                  <input type="date" value={f.fecha_inicio} disabled={soloLectura} className={INPUT}
                    onChange={(e) => cambiarFila(f.clave, "fecha_inicio", e.target.value)} />
                  {errE(i, "fecha_inicio") && <span className="text-xs text-red-600">{errE(i, "fecha_inicio")}</span>}
                </label>
                <div className="block text-sm sm:col-span-2">
                  <label>Fecha de fin {!f.cargo_actual && <span className="text-red-600">*</span>}
                    {soloLectura && f.cargo_actual
                      ? <input value="Actualidad" disabled className={INPUT} readOnly />
                      : <input type="date" value={f.fecha_fin} disabled={soloLectura || f.cargo_actual} className={INPUT}
                          onChange={(e) => cambiarFila(f.clave, "fecha_fin", e.target.value)} />}
                  </label>
                  {!soloLectura && (
                    <label className="mt-2 flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={f.cargo_actual}
                        onChange={(e) => alternarActual(f.clave, e.target.checked)} />
                      Cargo actual
                    </label>
                  )}
                  {errE(i, "fecha_fin") && <span className="text-xs text-red-600">{errE(i, "fecha_fin")}</span>}
                </div>
                <label className="block text-sm sm:col-span-4">Funciones o descripción
                  <textarea value={f.funciones} disabled={soloLectura} rows={3} className={INPUT}
                    onChange={(e) => cambiarFila(f.clave, "funciones", e.target.value)} />
                </label>
              </div>

              <ListaSoportes
                titulo="Certificaciones laborales (PDF)"
                guardados={f.soportes} nuevos={f.nuevos} soloLectura={soloLectura} error={errE(i, "soportes")}
                onDescargar={bajar}
                onQuitarGuardado={(id) => setFilas((fs) => fs.map((x) => x.clave === f.clave ? { ...x, soportes: x.soportes.filter((s) => s.id !== id) } : x))}
                onQuitarNuevo={(j) => setFilas((fs) => fs.map((x) => x.clave === f.clave ? { ...x, nuevos: x.nuevos.filter((_, k) => k !== j) } : x))}
                onElegir={(lista) => elegirArchivos(f.clave, lista)}
              />
            </div>
          ))}
        </div>

        {errorGeneral && <p className="mt-4 text-sm text-red-600">{errorGeneral}</p>}
        {mensaje && <p className="mt-4 text-sm text-green-700">{mensaje}</p>}

        {!soloLectura && (
          <div className="mt-6 flex justify-between">
            <button type="button" onClick={agregar} className="rounded border border-slate-300 px-4 py-2 text-sm">+ Agregar experiencia</button>
            <button type="button" onClick={guardar} disabled={guardando}
              className="rounded bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-60">
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
});
