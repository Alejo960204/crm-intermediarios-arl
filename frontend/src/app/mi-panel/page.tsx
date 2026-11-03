"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** «Mi panel» pasó a ser el Dashboard del intermediario. */
export default function MiPanelRedirige() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard"); }, [router]);
  return <main className="p-6 text-sm text-slate-500">Cargando...</main>;
}
