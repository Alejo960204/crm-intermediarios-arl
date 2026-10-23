"use client";
import { useParams } from "next/navigation";
import FormularioDiagnostico from "@/components/FormularioDiagnostico";

export default function EditarDiagnostico() {
  const { id } = useParams<{ id: string }>();
  return <FormularioDiagnostico diagnosticoId={Number(id)} />;
}
