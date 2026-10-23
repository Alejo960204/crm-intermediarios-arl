"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { login, reenviarCodigo, verificarCodigo, type VerificacionPendiente } from "@/lib/api";

const INPUT = "mt-1 w-full rounded border border-slate-300 px-3 py-2";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendiente, setPendiente] = useState<VerificacionPendiente | null>(null);
  const [codigo, setCodigo] = useState("");
  const [espera, setEspera] = useState(0);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(false);

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
      const paso2 = await login(email, password);
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
    <main className="flex min-h-screen items-center justify-center p-4">
      {!pendiente ? (
        <form onSubmit={onCredenciales} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
          <h1 className="text-xl font-semibold">Iniciar sesión</h1>
          <label className="block text-sm">Correo
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
          </label>
          <label className="block text-sm">Contraseña
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={cargando} className="w-full rounded bg-blue-700 py-2 text-white disabled:opacity-60">
            {cargando ? "Verificando..." : "Continuar"}
          </button>
        </form>
      ) : (
        <form onSubmit={onCodigo} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
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
          <button disabled={cargando || codigo.length !== 6} className="w-full rounded bg-blue-700 py-2 text-white disabled:opacity-60">
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
