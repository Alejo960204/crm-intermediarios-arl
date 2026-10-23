import FormularioRegistro from "@/components/FormularioRegistro";

export default function VerRegistroPage({ params }: { params: { id: string } }) {
  return <FormularioRegistro registroId={Number(params.id)} soloLectura />;
}
