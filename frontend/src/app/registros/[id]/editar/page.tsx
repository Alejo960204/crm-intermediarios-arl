import FormularioRegistro from "@/components/FormularioRegistro";

export default function EditarRegistroPage({ params }: { params: { id: string } }) {
  return <FormularioRegistro registroId={Number(params.id)} />;
}
