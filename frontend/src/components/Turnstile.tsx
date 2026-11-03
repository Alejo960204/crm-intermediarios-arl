"use client";
import { useEffect, useRef } from "react";

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
export const CAPTCHA_ACTIVO = TURNSTILE_SITE_KEY !== "";

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}
declare global { interface Window { turnstile?: TurnstileApi } }

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function cargarScript(): Promise<void> {
  return new Promise((ok, fallo) => {
    if (window.turnstile) { ok(); return; }
    let s = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement("script");
      s.id = SCRIPT_ID; s.src = SCRIPT_URL; s.async = true;
      document.head.appendChild(s);
    }
    s.addEventListener("load", () => ok());
    s.addEventListener("error", () => fallo(new Error("No se pudo cargar el captcha")));
  });
}

/**
 * Captcha Cloudflare Turnstile («Confirme que no es un robot»). Entrega el token con onToken (null si vence o falla).
 * Cada token sirve una sola vez: cambie `resetKey` después de usarlo para pedir uno nuevo.
 * Sin NEXT_PUBLIC_TURNSTILE_SITE_KEY no se muestra nada (captcha desactivado).
 */
export default function Turnstile({ onToken, resetKey = 0 }: { onToken: (t: string | null) => void; resetKey?: number }) {
  const caja = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!CAPTCHA_ACTIVO) return;
    let vivo = true;
    cargarScript().then(() => {
      if (!vivo || !caja.current || !window.turnstile) return;
      id.current = window.turnstile.render(caja.current, {
        sitekey: TURNSTILE_SITE_KEY, theme: "auto", language: "es",
        callback: (t: string) => cb.current(t),
        "expired-callback": () => cb.current(null),
        "error-callback": () => cb.current(null),
      });
    }).catch(() => cb.current(null));
    return () => { vivo = false; if (id.current && window.turnstile) { window.turnstile.remove(id.current); id.current = null; } };
  }, []);

  useEffect(() => {
    if (resetKey > 0 && id.current && window.turnstile) { cb.current(null); window.turnstile.reset(id.current); }
  }, [resetKey]);

  if (!CAPTCHA_ACTIVO) return null;
  return <div ref={caja} className="flex min-h-[65px] justify-center" data-testid="captcha" />;
}
