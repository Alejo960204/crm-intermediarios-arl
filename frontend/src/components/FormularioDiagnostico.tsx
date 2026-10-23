"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  actualizarDiagnostico, ApiError, clearToken, crearDiagnostico, DATOS_GENERALES, FACTORES_RIESGO, getToken,
  obtenerDiagnostico, precargaDiagnostico, PREGUNTAS_SGSST, type DatosGeneralesDx, type DiagnosticoCuerpo,
  type OpcionIntermediario,
} from "@/lib/api";

const INPUT = "mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm";
const hoy = () => { // fecha local (no UTC) para no adelantar el día en la noche
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const numStr = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const NUMEROS: [string, string][] = [
  ["at_cantidad", "¿Cuántos AT tuvo el año anterior y en lo corrido del año?"],
  ["at_dias_incapacidad", "Días de incapacidad generados por los accidentes de trabajo"],
  ["at_mortales_invalidos", "Cantidad de AT mortales o con invalidez"],
  ["el_calificadas", "Número de empleados con enfermedad laboral calificada"],
  ["el_en_calificacion", "Número de trabajadores con enfermedad laboral en proceso de calificación"],
];

export default function FormularioDiagnostico({ empresaId, diagnosticoId }: { empresaId?: number; diagnosticoId?: number }) {
  const router = useRouter();
  const [empresa, setEmpresa] = useState("");
  const [empId, setEmpId] = useState<number | null>(empresaId ?? null);
  const [intermediarios, setIntermediarios] = useState<OpcionIntermediario[]>([]);
  const [registroId, setRegistroId] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [dg, setDg] = useState<DatosGeneralesDx>({});
  const [sg, setSg] = useState<Record<string, boolean | null>>({});
  const [num, setNum] = useState<Record<string, string>>({});
  const [vigilancia, setVigilancia] = useState<boolean | null>(null);
  const [txt, setTxt] = useState({ viajes_detalle: "", at_causas: "", el_causas: "", expectativas: "", observaciones: "" });
  const [fr, setFr] = useState<Record<string, { existe: boolean; descripcion: string }>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  function fallo(e: unknown) {
    if ((e as Error).message === "UNAUTHORIZED") { clearToken(); router.replace("/login"); return; }
    setError((e as Error).message);
    if (e instanceof ApiError) setErrores(e.campos ?? {});
  }

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    (async () => {
      try {
        let id = empresaId ?? null;
        if (diagnosticoId) {
          const d = await obtenerDiagnostico(diagnosticoId);
          id = d.empresa_id;
          setFecha(d.fecha_diagnostico); setDg(d.datos_generales);
          setRegistroId(d.registro_id ? String(d.registro_id) : "");
          const s: Record<string, boolean | null> = {};
          PREGUNTAS_SGSST.forEach(([k]) => { s[k] = d[k] as boolean; });
          setSg(s); setVigilancia(d.programas_vigilancia);
          const n: Record<string, string> = {};
          NUMEROS.forEach(([k]) => { n[k] = numStr(d[k]); });
          setNum(n);
          setTxt({ viajes_detalle: d.viajes_detalle ?? "", at_causas: d.at_causas ?? "", el_causas: d.el_causas ?? "",
                   expectativas: d.expectativas ?? "", observaciones: d.observaciones ?? "" });
          const f: Record<string, { existe: boolean; descripcion: string }> = {};
          FACTORES_RIESGO.forEach(([k]) => { const x = d.factores_riesgo?.[k]; f[k] = { existe: !!x?.existe, descripcion: x?.descripcion ?? "" }; });
          setFr(f); setEmpresa(d.empresa);
        } else {
          const f: Record<string, { existe: boolean; descripcion: string }> = {};
          FACTORES_RIESGO.forEach(([k]) => { f[k] = { existe: false, descripcion: "" }; });
          setFr(f);
        }
        if (id) {
          setEmpId(id);
          const p = await precargaDiagnostico(id);
          setEmpresa(p.empresa); setIntermediarios(p.intermediarios);
          if (!diagnosticoId) setDg(p.datos_generales);
        }
      } catch (e) { fallo(e); } finally { setCargando(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault(); setError("");
    const err: Record<string, string> = {};
    PREGUNTAS_SGSST.forEach(([k]) => { if (sg[k] === undefined || sg[k] === null) err[k] = "Seleccione Sí o No"; });
    NUMEROS.forEach(([k]) => {
      const v = num[k];
      if (v === undefined || v === "") err[k] = "Obligatorio (use 0 si no hay)";
      else if (!/^\d+$/.test(v)) err[k] = "Escriba un número entero (0 o más)";
    });
    if (vigilancia === null) err.programas_vigilancia = "Seleccione Sí o No";
    if (!fecha) err.fecha_diagnostico = "Obligatorio";
    setErrores(err);
    if (Object.keys(err).length) { setError("Revise los campos marcados en el formulario."); return; }

    const cuerpo: DiagnosticoCuerpo = {
      registro_id: registroId ? Number(registroId) : null, fecha_diagnostico: fecha, datos_generales: dg,
      ...(Object.fromEntries(PREGUNTAS_SGSST.map(([k]) => [k, sg[k]]))),
      ...(Object.fromEntries(NUMEROS.map(([k]) => [k, Number(num[k])]))),
      viajes_detalle: txt.viajes_detalle, at_causas: txt.at_causas, el_causas: txt.el_causas,
      programas_vigilancia: vigilancia, expectativas: txt.expectativas, observaciones: txt.observaciones,
      factores_riesgo: fr,
    } as DiagnosticoCuerpo;
    if (!diagnosticoId) cuerpo.empresa_id = empId;
    setGuardando(true);
    try {
      const r = diagnosticoId ? await actualizarDiagnostico(diagnosticoId, cuerpo) : await crearDiagnostico(cuerpo);
      router.push(`/diagnosticos/${r.id}`);
    } catch (e) { fallo(e); } finally { setGuardando(false); }
  }

  const si_no = (k: string, valor: boolean | null | undefined, set: (v: boolean) => void) => (
    <div className="mt-1 flex gap-4 text-sm">
      {[true, false].map((b) => (
        <label key={String(b)} className="flex items-center gap-1">
          <input type="radio" name={k} checked={valor === b} onChange={() => { set(b); setErrores((e) => ({ ...e, [k]: "" })); }} />
          {b ? "Sí" : "No"}
        </label>
      ))}
    </div>
  );

  if (cargando) return <main className="p-6 text-sm text-slate-500">Cargando...</main>;
  if (!empId) return (
    <main className="p-6 text-sm">
      <p className="text-red-600">{error || "Falta indicar la empresa."}</p>
      <Link href="/diagnosticos" className="underline">Volver</Link>
    </main>
  );

  const seccion = "space-y-4 rounded-lg bg-white p-6 shadow";
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">{diagnosticoId ? "Editar diagnóstico" : "Nuevo diagnóstico"} · {empresa}</h1>
      <form onSubmit={guardar} className="space-y-4">
        <section className={seccion}>
          <h2 className="font-semibold text-slate-700">Datos generales</h2>
          <p className="text-xs text-slate-500">Precargados de la empresa. Si los corrige aquí, solo cambia este diagnóstico, no la empresa.</p>
          <label className="block text-sm"><span className="font-medium">Fecha del diagnóstico <span className="text-red-600">*</span></span>
            <input type="date" className={INPUT} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            {errores.fecha_diagnostico && <span className="text-xs text-red-600">{errores.fecha_diagnostico}</span>}
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            {DATOS_GENERALES.map(([k, et]) => (
              <label key={k} className="block text-sm"><span className="font-medium">{et}</span>
                <input className={INPUT} value={dg[k] ?? ""} onChange={(e) => setDg({ ...dg, [k]: e.target.value })} />
                {errores[`datos_generales.${k}`] && <span className="text-xs text-red-600">{errores[`datos_generales.${k}`]}</span>}
              </label>
            ))}
          </div>
        </section>

        <section className={seccion}>
          <h2 className="font-semibold text-slate-700">SG-SST</h2>
          {PREGUNTAS_SGSST.map(([k, q]) => (
            <div key={k} className="text-sm">
              <span className="font-medium">{q} <span className="text-red-600">*</span></span>
              {si_no(k, sg[k], (v) => setSg({ ...sg, [k]: v }))}
              {errores[k] && <span className="text-xs text-red-600">{errores[k]}</span>}
            </div>
          ))}
          <label className="block text-sm"><span className="font-medium">Si tiene viajes al exterior: ¿cuántos y con qué periodicidad?</span>
            <input className={INPUT} value={txt.viajes_detalle} onChange={(e) => setTxt({ ...txt, viajes_detalle: e.target.value })} />
          </label>
        </section>

        <section className={seccion}>
          <h2 className="font-semibold text-slate-700">Accidentalidad</h2>
          {NUMEROS.slice(0, 3).map(([k, q]) => (
            <label key={k} className="block text-sm"><span className="font-medium">{q} <span className="text-red-600">*</span></span>
              <input inputMode="numeric" className={INPUT} value={num[k] ?? ""} onChange={(e) => { setNum({ ...num, [k]: e.target.value }); setErrores({ ...errores, [k]: "" }); }} />
              {errores[k] && <span className="text-xs text-red-600">{errores[k]}</span>}
            </label>
          ))}
          <label className="block text-sm"><span className="font-medium">Causas de los accidentes de trabajo presentados</span>
            <textarea rows={2} className={INPUT} value={txt.at_causas} onChange={(e) => setTxt({ ...txt, at_causas: e.target.value })} />
          </label>
        </section>

        <section className={seccion}>
          <h2 className="font-semibold text-slate-700">Enfermedad laboral</h2>
          {NUMEROS.slice(3).map(([k, q]) => (
            <label key={k} className="block text-sm"><span className="font-medium">{q} <span className="text-red-600">*</span></span>
              <input inputMode="numeric" className={INPUT} value={num[k] ?? ""} onChange={(e) => { setNum({ ...num, [k]: e.target.value }); setErrores({ ...errores, [k]: "" }); }} />
              {errores[k] && <span className="text-xs text-red-600">{errores[k]}</span>}
            </label>
          ))}
          <label className="block text-sm"><span className="font-medium">Causas de las enfermedades laborales calificadas</span>
            <textarea rows={2} className={INPUT} value={txt.el_causas} onChange={(e) => setTxt({ ...txt, el_causas: e.target.value })} />
          </label>
          <div className="text-sm">
            <span className="font-medium">¿Cuenta con programas de vigilancia epidemiológica para los factores de riesgo más críticos? <span className="text-red-600">*</span></span>
            {si_no("programas_vigilancia", vigilancia, setVigilancia)}
            {errores.programas_vigilancia && <span className="text-xs text-red-600">{errores.programas_vigilancia}</span>}
          </div>
        </section>

        <section className={seccion}>
          <h2 className="font-semibold text-slate-700">Factores de riesgo</h2>
          <p className="text-xs text-slate-500">Marque si existen fuentes de riesgo y descríbalas.</p>
          {FACTORES_RIESGO.map(([k, et]) => (
            <div key={k} className="grid items-start gap-2 text-sm md:grid-cols-[12rem_1fr]">
              <label className="flex items-center gap-2 pt-2 font-medium">
                <input type="checkbox" checked={fr[k]?.existe ?? false}
                  onChange={(e) => setFr({ ...fr, [k]: { ...fr[k], existe: e.target.checked } })} /> {et}
              </label>
              <input className={INPUT} placeholder="Descripción de las fuentes de riesgo" disabled={!fr[k]?.existe}
                value={fr[k]?.descripcion ?? ""} onChange={(e) => setFr({ ...fr, [k]: { ...fr[k], descripcion: e.target.value } })} />
            </div>
          ))}
        </section>

        <section className={seccion}>
          <h2 className="font-semibold text-slate-700">Expectativas y observaciones</h2>
          <label className="block text-sm"><span className="font-medium">Expectativas al trasladarse a la ARL</span>
            <textarea rows={3} className={INPUT} value={txt.expectativas} onChange={(e) => setTxt({ ...txt, expectativas: e.target.value })} />
          </label>
          <label className="block text-sm"><span className="font-medium">Observaciones importantes para la oferta por sector económico</span>
            <textarea rows={3} className={INPUT} value={txt.observaciones} onChange={(e) => setTxt({ ...txt, observaciones: e.target.value })} />
          </label>
        </section>

        <section className={seccion}>
          <h2 className="font-semibold text-slate-700">Intermediario</h2>
          <label className="block text-sm"><span className="font-medium">Registro de intermediario (Formulario Único)</span>
            <select className={INPUT} value={registroId} onChange={(e) => setRegistroId(e.target.value)}>
              <option value="">Sin seleccionar</option>
              {intermediarios.map((i) => <option key={i.id} value={i.id}>{i.razon_social ?? "(sin razón social)"} · RUI {i.rui} · NIT {i.nit}</option>)}
            </select>
            {intermediarios.length === 0 && <span className="text-xs text-amber-700">El cliente dueño de la empresa aún no tiene registros de intermediario.</span>}
            {errores.registro_id && <span className="block text-xs text-red-600">{errores.registro_id}</span>}
          </label>
          <p className="text-xs text-slate-500">Se tomarán la razón social como nombre, y el RUI y el NIT como clave ARL y cédula.</p>
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Link href={diagnosticoId ? `/diagnosticos/${diagnosticoId}` : "/diagnosticos"} className="rounded border border-slate-300 px-3 py-2 text-sm">Cancelar</Link>
          <button disabled={guardando} className="rounded bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-60">
            {guardando ? "Guardando..." : "Guardar y ver resultado"}
          </button>
        </div>
      </form>
    </main>
  );
}
