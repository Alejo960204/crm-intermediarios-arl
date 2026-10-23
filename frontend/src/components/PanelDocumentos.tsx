"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError, clearToken, descargarDocumento, eliminarDocumento, listarDocumentos, MAX_DOCUMENTO_BYTES,
  reemplazarDocumento, subirDocumento, tiposDocumento, type Documento, type ObjetivoDocumento,
} from "@/lib/api";

const INPUT = "mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm";
const BTN = "rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50";
const fmtFecha = (d: string) => new Date(d).toLocaleString("es-CO");
const fmtTam = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Documentos de una empresa o de un proceso: PDF/PNG/JPG hasta 5 MB. Reemplazar crea una versión nueva (las anteriores se conservan). */
export default function PanelDocumentos({ objetivo, id, seccion }: { objetivo: ObjetivoDocumento; id: number; seccion?: string }) {
  const router = useRouter();
  const [docs, setDocs] = useState<Documento[] | null>(null);
  const [tipos, setTipos] = useState<string[]>([]);
  const [tipo, setTipo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [abierto, setAbierto] = useState<number | null>(null);
  const [aEliminar, setAEliminar] = useState<Documento | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const reemplazo = useRef<HTMLInputElement>(null);
  const [reemplazando, setReemplazando] = useState<number | null>(null);

  const fallo = useCallback((e: unknown) => {
    if ((e as Error).message === "UNAUTHORIZED") { clearToken(); router.replace("/login"); return; }
    setError((e as Error).message);
    if (e instanceof ApiError) setErrores(e.campos ?? {});
  }, [router]);

  const cargar = useCallback(async () => {
    try { setDocs(await listarDocumentos(objetivo, id, seccion)); } catch (e) { fallo(e); }
  }, [objetivo, id, seccion, fallo]);

  useEffect(() => { cargar(); if (!seccion) tiposDocumento().then(setTipos).catch(fallo); }, [cargar, fallo, seccion]);

  function elegir(f: File | null, alElegir: (f: File) => void) {
    setError(""); setErrores({});
    if (!f) return;
    if (f.size > MAX_DOCUMENTO_BYTES) { setError(`'${f.name}' supera el máximo de 5 MB.`); return; }
    if (!/\.(pdf|png|jpe?g)$/i.test(f.name)) { setError(`'${f.name}' no es un PDF, PNG o JPG.`); return; }
    alElegir(f);
  }

  async function subir(ev: React.FormEvent) {
    ev.preventDefault(); setError(""); setErrores({}); setOcupado(true);
    try {
      await subirDocumento(objetivo, id, tipo, descripcion, archivo, seccion, titulo);
      setTipo(""); setTitulo(""); setDescripcion(""); setArchivo(null);
      if (entrada.current) entrada.current.value = "";
      await cargar();
    } catch (e) { fallo(e); } finally { setOcupado(false); }
  }

  async function reemplazar(f: File) {
    if (reemplazando === null) return;
    setOcupado(true);
    try { await reemplazarDocumento(reemplazando, f); await cargar(); } catch (e) { fallo(e); }
    finally { setOcupado(false); setReemplazando(null); if (reemplazo.current) reemplazo.current.value = ""; }
  }

  async function confirmarEliminar() {
    if (!aEliminar) return;
    setOcupado(true);
    try { await eliminarDocumento(aEliminar.id); setAEliminar(null); await cargar(); } catch (e) { setAEliminar(null); fallo(e); }
    finally { setOcupado(false); }
  }

  return (
    <section className="mt-6 rounded-lg bg-white p-6 shadow">
      <h2 className="text-lg font-semibold">Documentos</h2>
      <p className="text-xs text-slate-500">PDF, PNG o JPG de hasta 5 MB. Al reemplazar un documento se guarda una versión nueva y las anteriores se conservan.</p>

      <form onSubmit={subir} className="mt-4 grid gap-3 sm:grid-cols-[18rem_1fr]">
        {seccion ? (
          <label className="block text-sm"><span className="font-medium">Título <span className="text-red-600">*</span></span>
            <input className={INPUT} maxLength={150} value={titulo} onChange={(e) => { setTitulo(e.target.value); setErrores({}); }} />
            {errores.titulo && <span className="text-xs text-red-600">{errores.titulo}</span>}
          </label>
        ) : (
          <label className="block text-sm"><span className="font-medium">Tipo de documento <span className="text-red-600">*</span></span>
          <select className={INPUT} value={tipo} onChange={(e) => { setTipo(e.target.value); setErrores({}); }}>
            <option value="">Seleccione...</option>{tipos.map((t) => <option key={t}>{t}</option>)}
          </select>
          {errores.tipo && <span className="text-xs text-red-600">{errores.tipo}</span>}
          </label>
        )}
        <label className="block text-sm"><span className="font-medium">Descripción (opcional)</span>
          <input className={INPUT} maxLength={500} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </label>
        <label className="block text-sm sm:col-span-2"><span className="font-medium">Archivo <span className="text-red-600">*</span></span>
          <input ref={entrada} type="file" accept=".pdf,.png,.jpg,.jpeg" className="mt-1 block text-sm"
            onChange={(e) => elegir(e.target.files?.[0] ?? null, setArchivo)} />
          {errores.archivo && <span className="text-xs text-red-600">{errores.archivo}</span>}
        </label>
        <div className="sm:col-span-2">
          <button disabled={ocupado || !archivo} className="rounded bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50">
            {ocupado ? "Subiendo..." : "Subir documento"}
          </button>
        </div>
      </form>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <input ref={reemplazo} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
        onChange={(e) => elegir(e.target.files?.[0] ?? null, reemplazar)} />

      <ul className="mt-5 space-y-3">
        {docs === null && <li className="text-sm text-slate-500">Cargando...</li>}
        {docs?.length === 0 && <li className="text-sm text-slate-500">Aún no hay documentos.</li>}
        {docs?.map((d) => (
          <li key={d.id} className="rounded border border-slate-200 p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{d.titulo ?? d.tipo} <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-normal">v{d.version_actual}</span></p>
                {d.descripcion && <p className="text-slate-600">{d.descripcion}</p>}
                <p className="text-xs text-slate-500">{d.nombre_original} · {fmtTam(d.tamano_bytes)} · {d.subido_por} · {fmtFecha(d.fecha)}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                <button className={BTN} onClick={() => descargarDocumento(d.id, d.versiones[0]).catch(fallo)}>Descargar</button>
                <button className={BTN} disabled={ocupado} onClick={() => { setReemplazando(d.id); reemplazo.current?.click(); }}>Reemplazar</button>
                {d.versiones.length > 1 && (
                  <button className={BTN} onClick={() => setAbierto(abierto === d.id ? null : d.id)}>Historial ({d.versiones.length})</button>
                )}
                {d.puede_eliminar && <button className={`${BTN} text-red-700`} onClick={() => setAEliminar(d)}>Eliminar</button>}
              </div>
            </div>
            {abierto === d.id && (
              <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs">
                {d.versiones.map((v) => (
                  <li key={v.version} className="flex flex-wrap items-center justify-between gap-2">
                    <span>v{v.version} · {v.nombre_original} · {fmtTam(v.tamano_bytes)} · {v.subido_por} · {fmtFecha(v.fecha)}</span>
                    <button className={BTN} onClick={() => descargarDocumento(d.id, v).catch(fallo)}>Descargar</button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {aEliminar && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Eliminar documento</h3>
            <p className="mt-2 text-sm text-slate-600">¿Eliminar «{aEliminar.titulo ?? aEliminar.tipo}» ({aEliminar.nombre_original})? Dejará de verse para todos.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className={BTN} onClick={() => setAEliminar(null)}>Cancelar</button>
              <button disabled={ocupado} onClick={confirmarEliminar} className="rounded bg-red-700 px-3 py-1 text-xs text-white disabled:opacity-60">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
