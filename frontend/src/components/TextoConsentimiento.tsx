/**
 * Política de tratamiento de datos personales (Ley 1581 de 2012 y decretos reglamentarios).
 * BORRADOR: complete [NIT], [CORREO] y [DIRECCIÓN] (constante CONTACTO_DATOS) y haga revisar el texto por su asesor legal antes de salir a producción.
 * Si modifica el texto, cambie también VERSION_POLITICA en backend/src/app/services/auth_service.py.
 */
export const CONTACTO_DATOS = { correo: "[CORREO]", direccion: "[DIRECCIÓN]", razonSocial: "PROGRESCOL BIC S.A.S.", nit: "[NIT]" };

export default function TextoConsentimiento() {
  return (
    <div className="max-h-44 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600"
      tabIndex={0} aria-label="Política de tratamiento de datos personales">
      <p className="font-semibold text-slate-700">Autorización para el tratamiento de datos personales</p>
      <p className="mt-1">
        En cumplimiento de la Ley 1581 de 2012, el Decreto 1377 de 2013 y demás normas que los modifiquen o complementen,
        <strong> {CONTACTO_DATOS.razonSocial}</strong> (NIT {CONTACTO_DATOS.nit}), en calidad de responsable del tratamiento, le informa que los datos
        personales que usted y las empresas que representa registren en esta plataforma serán recolectados, almacenados, usados y
        consultados para las siguientes finalidades: (i) gestionar el Formulario Único de Intermediarios de Seguros en el Ramo de
        Riesgos Laborales y el RUI; (ii) administrar los procesos de afiliación, diagnósticos, documentos y programas del Sistema de
        Gestión de Seguridad y Salud en el Trabajo (SG-SST); (iii) validar la identidad y administrar el acceso de los usuarios;
        (iv) contactarlo para el seguimiento de los trámites y enviarle información relacionada con el servicio; y (v) cumplir
        obligaciones legales y requerimientos de autoridades competentes.
      </p>
      <p className="mt-2">
        Como titular de los datos usted tiene derecho a conocer, actualizar y rectificar su información; solicitar prueba de esta
        autorización; ser informado del uso que se ha dado a sus datos; presentar quejas ante la Superintendencia de Industria y
        Comercio; revocar la autorización y solicitar la supresión de sus datos cuando no se respeten los principios y garantías
        legales; y acceder gratuitamente a sus datos personales. La respuesta a las preguntas sobre datos sensibles es facultativa.
      </p>
      <p className="mt-2">
        Puede ejercer sus derechos escribiendo a <strong>{CONTACTO_DATOS.correo}</strong> o en la dirección
        <strong> {CONTACTO_DATOS.direccion}</strong>. Al marcar la casilla y continuar, usted declara que leyó esta política y autoriza de
        manera libre, previa, expresa e informada el tratamiento de sus datos personales en los términos descritos.
      </p>
    </div>
  );
}
