"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError, MAX_FIRMA_BYTES, TIPOS_DOCUMENTO, clearToken, guardarFirma, obtenerFirma, urlImagenFirma,
  type FirmaDatos,
} from "@/lib/api";
import { useSucio, type PestanaHandle, type PropsPestana } from "@/lib/pestanas";

const INPUT = "mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-600";
const kb = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default forwardRef<PestanaHandle, PropsPestana>(function PestanaFirma(
  { registroId, soloLectura, faltantes, onGuardado, onSucio }, ref,
) {
  const router = useRouter();
  const [datos, setDatos] = useState({ nombres_apellidos: "", tipo_documento: "", numero_documento: "" });
  const [guardada, setGuardada] = useState<FirmaDatos["firma"]>(null);
  const [urlGuardada, setUrlGuardada] = useState("");
  const [quitar, setQuitar] = useState(false);
  const [nueva, setNueva] = useState<File | null>(null);
  const [urlNueva, setUrlNueva] = useState("");
  const [modo, setModo] = useState<"subir" | "dibujar">("subir");
  const [hayTrazo, setHayTrazo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState("");
  const [mensaje, setMensaje] = useState("");
  const lienzo = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);

  function manejarError(e: unknown) {
    const err = e as ApiError;
    if (err.message === "UNAUTHORIZED") { clearToken(); router.replace("/login"); return; }
    setErrores(err.campos ?? {});
    setErrorGeneral(err.message);
  }

  async function aEstado(d: FirmaDatos) {
    setDatos({
      nombres_apellidos: d.nombres_apellidos ?? "", tipo_documento: d.tipo_documento ?? "",
      numero_documento: d.numero_documento ?? "",
    });
    setGuardada(d.firma);
    setQuitar(false); setNueva(null); setUrlNueva("");
    setUrlGuardada(d.firma ? await urlImagenFirma(registroId) : "");
  }

  const { sucio, limpiar } = useSucio(
    JSON.stringify({ datos, quitar, nueva: nueva ? `${nueva.name}:${nueva.size}` : null }), cargando,
  );

  useEffect(() => {
    obtenerFirma(registroId).then(async (d) => { await aEstado(d); limpiar(); }).catch(manejarError).finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registroId]);

  useEffect(() => () => { if (urlNueva) URL.revokeObjectURL(urlNueva); }, [urlNueva]);

  function cambiar(campo: keyof typeof datos, valor: string) {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: "" }));
    setMensaje("");
  }

  function ponerNueva(f: File | null) {
    setNueva(f);
    setUrlNueva(f ? URL.createObjectURL(f) : "");
    setErrores((e) => ({ ...e, firma: "" }));
    setMensaje("");
  }

  function elegirArchivo(lista: FileList | null) {
    const f = lista?.[0];
    if (!f) return;
    const n = f.name.toLowerCase();
    let problema = "";
    if (!(n.endsWith(".png") || n.endsWith(".jpg") || n.endsWith(".jpeg"))) problema = `'${f.name}' no es una imagen PNG o JPG.`;
    else if (f.size > MAX_FIRMA_BYTES) problema = `'${f.name}' supera el máximo de 2 MB.`;
    else if (f.size === 0) problema = `'${f.name}' está vacío.`;
    if (problema) { setErrores((e) => ({ ...e, firma: problema })); return; }
    ponerNueva(f);
  }

  // ---- Lienzo ----
  function punto(ev: React.PointerEvent<HTMLCanvasElement>) {
    const c = lienzo.current!;
    const r = c.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) * c.width) / r.width, y: ((ev.clientY - r.top) * c.height) / r.height };
  }
  function iniciar(ev: React.PointerEvent<HTMLCanvasElement>) {
    const c = lienzo.current!;
    c.setPointerCapture(ev.pointerId);
    dibujando.current = true;
    const ctx = c.getContext("2d")!;
    const p = punto(ev);
    ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#111827";
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
  }
  function trazar(ev: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const ctx = lienzo.current!.getContext("2d")!;
    const p = punto(ev);
    ctx.lineTo(p.x, p.y); ctx.stroke();
    setHayTrazo(true);
  }
  const terminar = () => { dibujando.current = false; };
  function limpiarLienzo() {
    const c = lienzo.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHayTrazo(false);
  }
  function usarDibujo() {
    lienzo.current!.toBlob((blob) => {
      if (!blob) return;
      ponerNueva(new File([blob], "firma.png", { type: "image/png" }));
      limpiarLienzo();
    }, "image/png");
  }

  async function guardar(): Promise<boolean> {
    setErrores({}); setErrorGeneral(""); setMensaje(""); setGuardando(true);
    let ok = false;
    try {
      await aEstado(await guardarFirma(registroId, { ...datos, quitar_firma: quitar }, nueva));
      limpiar();
      setMensaje("Firma digitalizada guardada correctamente.");
      ok = true;
      onGuardado?.();
    } catch (e) {
      manejarError(e);
    } finally {
      setGuardando(false);
    }
    return ok;
  }

  // Avisa al formulario si hay cambios sin guardar (habilita o bloquea «Siguiente»)
  useEffect(() => { onSucio?.(sucio); }, [sucio]); // eslint-disable-line react-hooks/exhaustive-deps
  useImperativeHandle(ref, () => ({ guardar, sucio: () => sucio }));

  if (cargando) return <p className="text-sm text-slate-500">Cargando...</p>;

  const todos = { ...(faltantes ?? {}), ...errores };
  const mostrarGuardada = !!guardada && !quitar && !nueva;
  const hayFirma = mostrarGuardada || !!nueva;

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold">Representante Legal</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-6">
          <label className="block text-sm sm:col-span-3">Nombres y apellidos <span className="text-red-600">*</span>
            <input value={datos.nombres_apellidos} disabled={soloLectura} className={INPUT}
              onChange={(e) => cambiar("nombres_apellidos", e.target.value)} />
            {todos.nombres_apellidos && <span className="text-xs text-red-600">{todos.nombres_apellidos}</span>}
          </label>
          <label className="block text-sm sm:col-span-1">Tipo doc. <span className="text-red-600">*</span>
            <select value={datos.tipo_documento} disabled={soloLectura} className={INPUT}
              onChange={(e) => cambiar("tipo_documento", e.target.value)}>
              <option value="">—</option>
              {TIPOS_DOCUMENTO.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {todos.tipo_documento && <span className="text-xs text-red-600">{todos.tipo_documento}</span>}
          </label>
          <label className="block text-sm sm:col-span-2">Número de documento <span className="text-red-600">*</span>
            <input value={datos.numero_documento} disabled={soloLectura} className={INPUT}
              onChange={(e) => cambiar("numero_documento", e.target.value)} />
            {todos.numero_documento && <span className="text-xs text-red-600">{todos.numero_documento}</span>}
          </label>
        </div>
      </section>

      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold">Firma digitalizada <span className="text-red-600">*</span></h2>

        <div className="mt-3">
          {hayFirma ? (
            <div className="inline-block rounded border border-slate-200 bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={nueva ? urlNueva : urlGuardada} alt="Firma del Representante Legal" className="max-h-40" />
              <p className="mt-2 text-xs text-slate-500">
                {nueva ? `${nueva.name} (${kb(nueva.size)}) — se guardará al pulsar Guardar` : `${guardada!.nombre_original} (${kb(guardada!.tamano_bytes)})`}
              </p>
              {!soloLectura && (
                <button type="button" className="mt-1 text-xs text-red-700 hover:underline"
                  onClick={() => { ponerNueva(null); setQuitar(true); }}>
                  Quitar firma
                </button>
              )}
            </div>
          ) : (
            <p className="rounded border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              {quitar ? "La firma se quitará al pulsar Guardar." : "Aún no hay una firma registrada."}
            </p>
          )}
        </div>

        {!soloLectura && (
          <div className="mt-4">
            <div className="flex gap-2 text-sm">
              {(["subir", "dibujar"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setModo(m)}
                  className={modo === m ? "rounded bg-blue-700 px-3 py-1 text-white" : "rounded border border-slate-300 px-3 py-1"}>
                  {m === "subir" ? "Subir imagen" : "Dibujar firma"}
                </button>
              ))}
            </div>

            {modo === "subir" ? (
              <div className="mt-3">
                <input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" className="block text-sm"
                  onChange={(e) => { elegirArchivo(e.target.files); e.target.value = ""; setQuitar(false); }} />
                <p className="mt-1 text-xs text-slate-500">PNG o JPG, máximo 2 MB. Subir otra imagen reemplaza la actual.</p>
              </div>
            ) : (
              <div className="mt-3">
                <canvas ref={lienzo} width={600} height={200}
                  className="canvas-firma w-full max-w-xl touch-none rounded border border-slate-300 bg-white"
                  onPointerDown={iniciar} onPointerMove={trazar} onPointerUp={terminar} onPointerLeave={terminar} />
                <div className="mt-2 flex gap-2 text-sm">
                  <button type="button" onClick={limpiarLienzo} className="rounded border border-slate-300 px-3 py-1">Limpiar</button>
                  <button type="button" onClick={() => { usarDibujo(); setQuitar(false); }} disabled={!hayTrazo}
                    className="rounded bg-slate-800 px-3 py-1 text-white disabled:opacity-50">Usar este dibujo</button>
                </div>
                <p className="mt-1 text-xs text-slate-500">Firme con el mouse o el dedo y pulse «Usar este dibujo»; luego Guardar.</p>
              </div>
            )}
          </div>
        )}
        {todos.firma && <p className="mt-2 text-xs text-red-600">{todos.firma}</p>}

        {errorGeneral && <p className="mt-4 text-sm text-red-600">{errorGeneral}</p>}
        {mensaje && <p className="mt-4 text-sm text-green-700">{mensaje}</p>}

        {!soloLectura && (
          <div className="mt-6 flex justify-end">
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
