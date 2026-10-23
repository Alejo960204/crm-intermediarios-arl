"use client";
import { MAX_SOPORTE_BYTES, type SoporteInfo } from "@/lib/api";

const kb = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Valida archivos elegidos: devuelve los PDF válidos (≤ 5 MB) y un mensaje si alguno se rechazó. */
export function filtrarPdf(lista: FileList | null): { validos: File[]; problema: string } {
  const validos: File[] = [];
  let problema = "";
  for (const f of Array.from(lista ?? [])) {
    if (!f.name.toLowerCase().endsWith(".pdf")) problema = `'${f.name}' no es un PDF.`;
    else if (f.size > MAX_SOPORTE_BYTES) problema = `'${f.name}' supera el máximo de 5 MB.`;
    else if (f.size === 0) problema = `'${f.name}' está vacío.`;
    else validos.push(f);
  }
  return { validos, problema };
}

interface Props {
  titulo: string;
  guardados: SoporteInfo[];
  nuevos: File[];
  soloLectura: boolean;
  error?: string;
  onDescargar: (s: SoporteInfo) => void;
  onQuitarGuardado: (id: number) => void;
  onQuitarNuevo: (indice: number) => void;
  onElegir: (lista: FileList | null) => void;
}

export default function ListaSoportes({
  titulo, guardados, nuevos, soloLectura, error, onDescargar, onQuitarGuardado, onQuitarNuevo, onElegir,
}: Props) {
  return (
    <div className="mt-4">
      <p className="text-sm">{titulo}</p>
      <ul className="mt-1 space-y-1 text-sm">
        {guardados.map((s) => (
          <li key={s.id} className="flex items-center justify-between rounded bg-slate-50 px-3 py-1">
            <span>{s.nombre_original} <span className="text-xs text-slate-500">({kb(s.tamano_bytes)})</span></span>
            <span className="flex gap-3 text-xs">
              <button type="button" onClick={() => onDescargar(s)} className="text-blue-700 hover:underline">Descargar</button>
              {!soloLectura && (
                <button type="button" onClick={() => onQuitarGuardado(s.id)} className="text-red-700 hover:underline">Quitar</button>
              )}
            </span>
          </li>
        ))}
        {nuevos.map((n, j) => (
          <li key={`n${j}`} className="flex items-center justify-between rounded bg-amber-50 px-3 py-1">
            <span>{n.name} <span className="text-xs text-slate-500">({kb(n.size)}) — se subirá al guardar</span></span>
            <button type="button" onClick={() => onQuitarNuevo(j)} className="text-xs text-red-700 hover:underline">Quitar</button>
          </li>
        ))}
        {guardados.length === 0 && nuevos.length === 0 && <li className="text-xs text-slate-500">Sin soportes.</li>}
      </ul>
      {!soloLectura && (
        <input type="file" accept="application/pdf,.pdf" multiple className="mt-2 block text-sm"
          onChange={(e) => { onElegir(e.target.files); e.target.value = ""; }} />
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
