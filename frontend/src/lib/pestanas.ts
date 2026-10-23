import { useEffect, useState } from "react";

/** Lo que cada pestaña expone al formulario padre para los botones Atrás / Siguiente / Enviar. */
export interface PestanaHandle {
  /** Guarda la pestaña como borrador. Devuelve true si se guardó sin errores. */
  guardar: () => Promise<boolean>;
  /** true si hay cambios sin guardar. */
  sucio: () => boolean;
}

export interface PropsPestana {
  registroId: number;
  soloLectura: boolean;
  /** Campos obligatorios que faltan (campo -> mensaje), señalados tras intentar enviar a revisión. */
  faltantes?: Record<string, string>;
  /** Se llama tras guardar correctamente la pestaña. */
  onGuardado?: () => void;
}

/**
 * Detecta cambios sin guardar comparando una "firma" (texto) del estado actual con la del último estado
 * cargado o guardado. Llamar a `limpiar()` justo al cargar o guardar datos del servidor.
 */
export function useSucio(firma: string, cargando: boolean) {
  const [base, setBase] = useState<string | null>(null);
  useEffect(() => {
    if (base === null && !cargando) setBase(firma);
  }, [base, firma, cargando]);
  return { sucio: base !== null && base !== firma, limpiar: () => setBase(null) };
}
