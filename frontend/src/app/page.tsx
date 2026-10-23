"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken, obtenerUsuarioActual } from "@/lib/api";

/** Portada: cada rol entra a su pantalla de inicio. */
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    obtenerUsuarioActual()
      .then((u) => router.replace(u.rol === "root Admin" ? "/dashboard" : u.rol === "empleado" ? "/procesos" : "/registros"))
      .catch(() => { clearToken(); router.replace("/login"); });
  }, [router]);
  return <main className="p-6 text-sm text-slate-500">Cargando...</main>;
}
