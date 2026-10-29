"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmarRecuperacion, solicitarRecuperacion } from "@/lib/api";

const INPUT = "mt-1 w-full rounded border border-slate-300 px-3 py-2";
const ESPERA = 60;

/** ¿Olvidó su contraseña? Paso 1: correo → código de 6 dígitos. Paso 2: código + contraseña nueva. */
export default function RecuperarPage() {
  const router = useRouter();
  const [paso, setPaso] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(false);
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((e) => e - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function pedirCodigo(e?: React.FormEvent) {
    e?.preventDefault();
    setError(""); setAviso(""); setCargando(true);
    try {
      const r = await solicitarRecuperacion(email.trim());
      setAviso(r.mensaje); setPaso(2); setCodigo(""); setEspera(ESPERA);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  async function cambiar(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setAviso("");
    if (clave.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (clave !== clave2) { setError("Las contraseñas no coinciden."); return; }
    setCargando(true);
    try {
      await confirmarRecuperacion(email.trim(), codigo, clave);
      router.push("/login?recuperada=1");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 via-slate-50 to-green-50 p-4">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 animate-flotar rounded-full bg-marca-cielo/25 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-24 h-[28rem] w-[28rem] animate-flotar rounded-full bg-marca-verde/25 blur-3xl [animation-delay:-7s]" />
      <div className="relative w-full max-w-sm animate-entrar space-y-4 rounded-2xl bg-white/90 p-7 shadow-xl ring-1 ring-slate-200 backdrop-blur">
        <h1 className="text-xl font-semibold">Recuperar contraseña</h1>
        {paso === 1 ? (
          <form onSubmit={pedirCodigo} className="space-y-4">
            <p className="text-sm text-slate-600">Escriba el correo de su cuenta y le enviaremos un código de 6 dígitos.</p>
            <label className="block text-sm">Correo
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={cargando} className="w-full rounded-lg bg-blue-700 py-2.5 font-medium text-white disabled:opacity-60">
              {cargando ? "Enviando..." : "Enviar código"}
            </button>
          </form>
        ) : (
          <form onSubmit={cambiar} className="space-y-4">
            {aviso && <p className="text-sm text-green-700">{aviso}</p>}
            <label className="block text-sm">Código de verificación
              <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                className={`${INPUT} text-center text-xl tracking-widest`} />
            </label>
            <label className="block text-sm">Contraseña nueva
              <input type="password" required minLength={8} autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} className={INPUT} />
              <span className="text-xs text-slate-500">Mínimo 8 caracteres.</span>
            </label>
            <label className="block text-sm">Confirmar contraseña nueva
              <input type="password" required autoComplete="new-password" value={clave2} onChange={(e) => setClave2(e.target.value)} className={INPUT} />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={cargando || codigo.length !== 6} className="w-full rounded-lg bg-blue-700 py-2.5 font-medium text-white disabled:opacity-60">
              {cargando ? "Guardando..." : "Cambiar contraseña"}
            </button>
            <div className="flex justify-between text-sm">
              <button type="button" onClick={() => { setPaso(1); setError(""); setAviso(""); }} className="text-slate-600 hover:underline">Cambiar correo</button>
              <button type="button" onClick={() => pedirCodigo()} disabled={cargando || espera > 0}
                className="text-blue-700 hover:underline disabled:text-slate-400 disabled:no-underline">
                {espera > 0 ? `Reenviar código (${espera} s)` : "Reenviar código"}
              </button>
            </div>
          </form>
        )}
        <p className="text-center text-sm"><Link href="/login" className="text-blue-700 hover:underline">Volver a iniciar sesión</Link></p>
      </div>
    </main>
  );
}
