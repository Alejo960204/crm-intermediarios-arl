"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ListaSoportes, { filtrarPdf } from "@/components/ListaSoportes";
import {
  ApiError, clearToken, descargarSoporteOperativa, guardarOperativa, obtenerOperativa,
  type OperativaDatos, type SoporteInfo,
} from "@/lib/api";
import { useSucio, type PestanaHandle, type PropsPestana } from "@/lib/pestanas";

interface Item { clave: string; nombre: string; descripcion: string }
type Lista = "software" | "equipos";
type CampoContacto = "linea_1" | "linea_2" | "linea_3" | "fax" | "correo" | "direccion_atencion";

const CONTACTO_VACIO: Record<CampoContacto, string> = {
  linea_1: "", linea_2: "", linea_3: "", fax: "", correo: "", direccion_atencion: "",
};

const INPUT = "mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-600";

export default forwardRef<PestanaHandle, PropsPestana>(function PestanaOperativa(
  { registroId, soloLectura, faltantes, onGuardado }, ref,
) {
  const router = useRouter();
  const contador = useRef(0);
  const nuevaClave = () => `i${Date.now()}_${contador.current++}`;
  const [contacto, setContacto] = useState(CONTACTO_VACIO);
  const [software, setSoftware] = useState<Item[]>([]);
  const [equipos, setEquipos] = useState<Item[]>([]);
  const [soportes, setSoportes] = useState<SoporteInfo[]>([]);
  const [nuevos, setNuevos] = useState<File[]>([]);
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

  function aEstado(d: OperativaDatos) {
    setContacto({
      linea_1: d.linea_1 ?? "", linea_2: d.linea_2 ?? "", linea_3: d.linea_3 ?? "", fax: d.fax ?? "",
      correo: d.correo ?? "", direccion_atencion: d.direccion_atencion ?? "",
    });
    const aItems = (l: OperativaDatos["software"]) =>
      l.map((x) => ({ clave: nuevaClave(), nombre: x.nombre, descripcion: x.descripcion ?? "" }));
    setSoftware(aItems(d.software));
    setEquipos(aItems(d.equipos));
    setSoportes(d.soportes);
    setNuevos([]);
  }

  const { sucio, limpiar } = useSucio(
    JSON.stringify({ contacto, software, equipos, soportes: soportes.map((x) => x.id), nuevos: nuevos.map((n) => `${n.name}:${n.size}`) }),
    cargando,
  );

  useEffect(() => {
    obtenerOperativa(registroId).then((d) => { aEstado(d); limpiar(); }).catch(manejarError).finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registroId]);

  const setLista = (l: Lista) => (l === "software" ? setSoftware : setEquipos);

  function cambiarContacto(campo: CampoContacto, valor: string) {
    setContacto((c) => ({ ...c, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: "" }));
    setMensaje("");
  }

  function cambiarItem(l: Lista, clave: string, campo: "nombre" | "descripcion", valor: string, indice: number) {
    setLista(l)((its) => its.map((x) => (x.clave === clave ? { ...x, [campo]: valor } : x)));
    setErrores((e) => ({ ...e, [`${l}.${indice}.${campo}`]: "" }));
    setMensaje("");
  }

  function agregarItem(l: Lista) {
    setLista(l)((its) => [...its, { clave: nuevaClave(), nombre: "", descripcion: "" }]);
    setMensaje(""); setErrorGeneral("");
  }

  function quitarItem(l: Lista, clave: string) {
    setLista(l)((its) => its.filter((x) => x.clave !== clave));
    setErrores({}); setMensaje("");
  }

  function elegirArchivos(lista: FileList | null) {
    const { validos, problema } = filtrarPdf(lista);
    setNuevos((n) => [...n, ...validos]);
    setErrores((e) => ({ ...e, soportes: problema }));
    setMensaje("");
  }

  async function bajar(s: SoporteInfo) {
    try { await descargarSoporteOperativa(registroId, s); } catch (e) { manejarError(e); }
  }

  async function guardar(): Promise<boolean> {
    setErrores({}); setErrorGeneral(""); setMensaje(""); setGuardando(true);
    let ok = false;
    try {
      const aEnvio = (l: Item[]) => l.map((x) => ({ nombre: x.nombre, descripcion: x.descripcion }));
      aEstado(await guardarOperativa(registroId, {
        ...contacto, software: aEnvio(software), equipos: aEnvio(equipos), soportes_conservar: soportes.map((s) => s.id),
      }, nuevos));
      limpiar();
      setMensaje("Infraestructura operativa guardada correctamente.");
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

  // Funciones de render (no componentes) para que los inputs no pierdan el foco al escribir
  function renderContacto(campo: CampoContacto, etiqueta: string, opts: { obligatorio?: boolean; ayuda?: string; tipo?: string; span?: string } = {}) {
    return (
      <label key={campo} className={`block text-sm ${opts.span ?? "sm:col-span-2"}`}>
        {etiqueta}{opts.obligatorio && <span className="text-red-600"> *</span>}
        <input type={opts.tipo ?? "text"} value={contacto[campo]} disabled={soloLectura} className={INPUT}
          onChange={(e) => cambiarContacto(campo, e.target.value)} />
        {opts.ayuda && !todos[campo] && <span className="text-xs text-slate-500">{opts.ayuda}</span>}
        {todos[campo] && <span className="text-xs text-red-600">{todos[campo]}</span>}
      </label>
    );
  }

  function renderLista(l: Lista, titulo: string, ayuda: string, textoAgregar: string, items: Item[]) {
    return (
      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold">{titulo}</h2>
        <p className="mb-4 text-sm text-slate-500">{ayuda}</p>
        {items.length === 0 && (
          <p className="rounded border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
            {soloLectura ? "No hay elementos registrados." : `Aún no hay elementos. Use "${textoAgregar}".`}
          </p>
        )}
        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={it.clave} className="grid gap-3 rounded border border-slate-200 p-3 sm:grid-cols-6">
              <label className="block text-sm sm:col-span-2">Nombre <span className="text-red-600">*</span>
                <input value={it.nombre} disabled={soloLectura} className={INPUT}
                  onChange={(e) => cambiarItem(l, it.clave, "nombre", e.target.value, i)} />
                {todos[`${l}.${i}.nombre`] && <span className="text-xs text-red-600">{todos[`${l}.${i}.nombre`]}</span>}
              </label>
              <label className="block text-sm sm:col-span-3">Descripción
                <input value={it.descripcion} disabled={soloLectura} className={INPUT}
                  onChange={(e) => cambiarItem(l, it.clave, "descripcion", e.target.value, i)} />
              </label>
              {!soloLectura && (
                <div className="flex items-end sm:col-span-1">
                  <button type="button" onClick={() => quitarItem(l, it.clave)} className="pb-2 text-xs text-red-700 hover:underline">Quitar</button>
                </div>
              )}
            </div>
          ))}
        </div>
        {!soloLectura && (
          <button type="button" onClick={() => agregarItem(l)} className="mt-4 rounded border border-slate-300 px-4 py-2 text-sm">
            + {textoAgregar}
          </button>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold">Soportes de la Cámara de Comercio</h2>
        <ListaSoportes
          titulo="Certificado de existencia y representación legal u otros soportes (PDF, máximo 5 MB cada uno)"
          guardados={soportes} nuevos={nuevos} soloLectura={soloLectura} error={todos.soportes}
          onDescargar={bajar}
          onQuitarGuardado={(id) => setSoportes((ss) => ss.filter((s) => s.id !== id))}
          onQuitarNuevo={(j) => setNuevos((n) => n.filter((_, k) => k !== j))}
          onElegir={elegirArchivos}
        />
      </section>

      {renderLista("software", "Software y bases de datos", "Programas y bases de datos que utiliza para la operación.", "Agregar software o base de datos", software)}
      {renderLista("equipos", "Equipos tecnológicos", "Equipos con los que cuenta para la operación.", "Agregar equipo", equipos)}

      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold">Líneas de contacto y atención</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-6">
          {renderContacto("linea_1", "Línea telefónica 1", { obligatorio: true, ayuda: "7 a 10 dígitos, solo números." })}
          {renderContacto("linea_2", "Línea telefónica 2", { obligatorio: true, ayuda: "7 a 10 dígitos, solo números." })}
          {renderContacto("linea_3", "Línea telefónica 3", { ayuda: "7 a 10 dígitos, solo números." })}
          {renderContacto("fax", "Fax", { ayuda: "7 a 10 dígitos, solo números." })}
          {renderContacto("correo", "Correo electrónico de atención", { obligatorio: true, tipo: "email", span: "sm:col-span-4" })}
          {renderContacto("direccion_atencion", "Dirección de atención", { span: "sm:col-span-6" })}
        </div>

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
