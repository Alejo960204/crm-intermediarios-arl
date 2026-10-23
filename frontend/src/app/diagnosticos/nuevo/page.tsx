"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import FormularioDiagnostico from "@/components/FormularioDiagnostico";

function Contenido() {
  const id = Number(useSearchParams().get("empresa_id"));
  return <FormularioDiagnostico empresaId={id || undefined} />;
}

export default function NuevoDiagnostico() {
  return <Suspense fallback={null}><Contenido /></Suspense>;
}
