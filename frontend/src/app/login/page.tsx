"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TextoConsentimiento from "@/components/TextoConsentimiento";
import { login, reenviarCodigo, verificarCodigo, type VerificacionPendiente } from "@/lib/api";

const INPUT = "mt-1 w-full rounded border border-slate-300 px-3 py-2";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [pendiente, setPendiente] = useState<VerificacionPendiente | null>(null);
  const [codigo, setCodigo] = useState("");
  const [espera, setEspera] = useState(0);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("recuperada") === "1") setAviso("Contraseña actualizada. Inicie sesión con la nueva contraseña.");
  }, []);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((e) => e - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  function iniciarPaso2(p: VerificacionPendiente) {
    setPendiente(p); setCodigo(""); setEspera(p.reenviar_en);
  }

  async function onCredenciales(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setAviso(""); setCargando(true);
    try {
      const paso2 = await login(email, password, acepta);
      if (paso2) iniciarPaso2(paso2);
      else router.push("/"); // verificación por correo desactivada; la portada decide según el rol
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  async function onCodigo(e: React.FormEvent) {
    e.preventDefault();
    if (!pendiente) return;
    setError(""); setAviso(""); setCargando(true);
    try {
      await verificarCodigo(pendiente.verificacion_id, codigo);
      router.push("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  async function onReenviar() {
    if (!pendiente) return;
    setError(""); setAviso(""); setCargando(true);
    try {
      iniciarPaso2(await reenviarCodigo(pendiente.verificacion_id));
      setAviso("Enviamos un código nuevo a su correo.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  function volver() {
    setPendiente(null); setCodigo(""); setPassword(""); setError(""); setAviso("");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 via-slate-50 to-green-50 p-4">
      {/* Formas suaves con los colores del logotipo */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 animate-flotar rounded-full bg-marca-cielo/25 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-24 h-[28rem] w-[28rem] animate-flotar rounded-full bg-marca-verde/25 blur-3xl [animation-delay:-7s]" />
      {/* Marca de agua: logotipo centrado, muy tenue y detrás del formulario */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" aria-hidden="true" draggable={false}
        className="pointer-events-none absolute left-1/2 top-1/2 w-[min(90vw,900px)] -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.10] mix-blend-multiply dark:hidden" />
      {!pendiente ? (
        <form onSubmit={onCredenciales} className="relative w-full max-w-md animate-entrar space-y-4 rounded-2xl bg-white/90 p-7 shadow-xl ring-1 ring-slate-200 backdrop-blur">
          <h1 className="text-xl font-semibold">Iniciar sesión</h1>
          <label className="block text-sm">Correo
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
          </label>
          <label className="block text-sm">Contraseña
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
          </label>
          <div className="text-right text-sm">
            <Link href="/recuperar" className="text-blue-700 hover:underline">¿Olvidó su contraseña?</Link>
          </div>
          <TextoConsentimiento />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-1" />
            <span>He leído y acepto la política de tratamiento de datos personales.</span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {aviso && <p className="text-sm text-green-700">{aviso}</p>}
          <button disabled={cargando || !acepta} className="w-full rounded-lg bg-blue-700 py-2.5 font-medium text-white disabled:opacity-60">
            {cargando ? "Verificando..." : "Continuar"}
          </button>
        </form>
      ) : (
        <form onSubmit={onCodigo} className="relative w-full max-w-sm animate-entrar space-y-4 rounded-2xl bg-white/90 p-7 shadow-xl ring-1 ring-slate-200 backdrop-blur">
          <h1 className="text-xl font-semibold">Verificación en dos pasos</h1>
          <p className="text-sm text-slate-600">
            Enviamos un código de 6 dígitos a <span className="font-medium">{pendiente.correo}</span>. Escríbalo para continuar.
          </p>
          <label className="block text-sm">Código de verificación
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              className={`${INPUT} text-center text-xl tracking-widest`} />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {aviso && <p className="text-sm text-green-700">{aviso}</p>}
          <button disabled={cargando || codigo.length !== 6} className="w-full rounded-lg bg-blue-700 py-2.5 font-medium text-white disabled:opacity-60">
            {cargando ? "Verificando..." : "Ingresar"}
          </button>
          <div className="flex justify-between text-sm">
            <button type="button" onClick={volver} className="text-slate-600 hover:underline">Volver</button>
            <button type="button" onClick={onReenviar} disabled={cargando || espera > 0}
              className="text-blue-700 hover:underline disabled:text-slate-400 disabled:no-underline">
              {espera > 0 ? `Reenviar código (${espera} s)` : "Reenviar código"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
