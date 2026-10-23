const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Estado = "Borrador" | "En revisión" | "Aprobado" | "Rechazado";

export interface Registro {
  id: number;
  rui: string;
  nit: string;
  razon_social: string | null;
  ciudad: string | null;
  estado: Estado;
  fecha_creacion: string;
  fecha_actualizacion: string;
  propietario: string | null;
  decision_comentario: string | null;
}

export interface RegistroDetalle {
  id: number;
  rui: string;
  nit: string;
  razon_social: string | null;
  departamento_codigo: string | null;
  municipio_codigo: string | null;
  direccion: string | null;
  correo: string | null;
  telefono_fijo: string | null;
  estado: Estado;
  fecha_creacion: string;
  fecha_actualizacion: string;
  propietario: string | null;
  editable: boolean;
  decision_comentario: string | null;
  decision_fecha: string | null;
  decision_por: string | null;
  puede_decidir: boolean;
}

/** Datos del formulario (Pestaña 1). Los campos vacíos se envían como "". */
export interface RegistroEntrada {
  rui: string;
  nit: string;
  razon_social: string;
  departamento_codigo: string;
  municipio_codigo: string;
  direccion: string;
  correo: string;
  telefono_fijo: string;
}

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: "root Admin" | "cliente" | "empleado";
}

export interface Departamento { codigo: string; nombre: string }
export interface Municipio { codigo: string; nombre: string; departamento_codigo: string }

export interface FaltantePestana {
  pestana: number;
  nombre: string;
  campos: { campo: string; etiqueta: string; mensaje: string }[];
}

export class ApiError extends Error {
  status: number;
  campos: Record<string, string>;
  faltantes: FaltantePestana[];
  constructor(status: number, message: string, campos: Record<string, string> = {}, faltantes: FaltantePestana[] = []) {
    super(message);
    this.status = status;
    this.campos = campos;
    this.faltantes = faltantes;
  }
}

export function getToken(): string | null {
  try { return localStorage.getItem("token"); } catch { return null; }
}
export function setToken(t: string) { localStorage.setItem("token", t); }
export function clearToken() { try { localStorage.removeItem("token"); } catch {} }

export interface VerificacionPendiente {
  verificacion_id: number;
  correo: string; // enmascarado
  reenviar_en: number; // segundos
}

async function postAuth<T>(ruta: string, cuerpo: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${ruta}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    throw new Error(`No se pudo conectar con el servidor (${API}). Verifica que el backend esté en ejecución.`);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const d = body?.detail;
    throw new Error(typeof d === "string" ? d : res.status === 422 ? "Revise los datos ingresados." : "Error al iniciar sesión");
  }
  return body as T;
}

/**
 * Correo y contraseña. Con la verificación por correo activa devuelve los datos del paso 2 (el servidor envía el
 * código); con la verificación desactivada guarda el token y devuelve null (ya se puede entrar).
 */
export async function login(email: string, password: string): Promise<VerificacionPendiente | null> {
  const r = await postAuth<VerificacionPendiente & { requiere_verificacion: boolean; access_token?: string }>(
    "/auth/login", { email, password },
  );
  if (!r.requiere_verificacion) {
    setToken(r.access_token as string);
    return null;
  }
  return r;
}

/** Paso 2: código recibido por correo. Si es correcto guarda el token de sesión. */
export async function verificarCodigo(verificacionId: number, codigo: string): Promise<void> {
  const r = await postAuth<{ access_token: string }>("/auth/verificar", { verificacion_id: verificacionId, codigo });
  setToken(r.access_token);
}

export const reenviarCodigo = (verificacionId: number) =>
  postAuth<VerificacionPendiente>("/auth/reenviar", { verificacion_id: verificacionId });

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        // Con FormData el navegador define el Content-Type (multipart) por sí mismo
        ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        Authorization: `Bearer ${getToken()}`,
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, `No se pudo conectar con el servidor (${API}). Verifica que el backend esté en ejecución.`);
  }
  if (res.status === 401) throw new ApiError(401, "UNAUTHORIZED");
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body?.detail;
    if (Array.isArray(detail)) {
      const campos: Record<string, string> = {};
      for (const e of detail) {
        // "body" se omite: ["body","rui"] -> "rui"; ["body","personas",0,"correo"] -> "personas.0.correo"
        const campo = (e.loc ?? []).filter((x: unknown) => x !== "body").join(".");
        campos[campo] = String(e.msg).replace(/^Value error, /, "");
      }
      throw new ApiError(res.status, "Revise los campos marcados en el formulario.", campos);
    }
    if (detail && typeof detail === "object" && Array.isArray(detail.faltantes)) {
      throw new ApiError(res.status, String(detail.mensaje ?? "Faltan campos obligatorios."), {}, detail.faltantes);
    }
    throw new ApiError(res.status, typeof detail === "string" ? detail : "Ocurrió un error inesperado");
  }
  return body as T;
}

export const listarMisRegistros = () => request<Registro[]>("/registros");
export const obtenerUsuarioActual = () => request<Usuario>("/auth/me");
export const obtenerRegistro = (id: number) => request<RegistroDetalle>(`/registros/${id}`);
export const crearRegistro = (d: RegistroEntrada) =>
  request<RegistroDetalle>("/registros", { method: "POST", body: JSON.stringify(d) });
export const actualizarRegistro = (id: number, d: RegistroEntrada) =>
  request<RegistroDetalle>(`/registros/${id}`, { method: "PUT", body: JSON.stringify(d) });
export const enviarARevision = (id: number) =>
  request<RegistroDetalle>(`/registros/${id}/enviar-revision`, { method: "POST" });
export const decidirRegistro = (id: number, decision: "Aprobado" | "Rechazado", comentario: string) =>
  request<RegistroDetalle>(`/registros/${id}/decision`, { method: "POST", body: JSON.stringify({ decision, comentario }) });
export const eliminarRegistro = (id: number) => request<void>(`/registros/${id}`, { method: "DELETE" });
export const listarDepartamentos = () => request<Departamento[]>("/catalogos/departamentos");
export const listarMunicipios = (departamento: string) =>
  request<Municipio[]>(`/catalogos/municipios?departamento_codigo=${encodeURIComponent(departamento)}`);

export type TipoDocumento = "CC" | "CE" | "Pasaporte" | "PEP";
export const TIPOS_DOCUMENTO: TipoDocumento[] = ["CC", "CE", "Pasaporte", "PEP"];
export const MAX_SOPORTE_BYTES = 5 * 1024 * 1024;

export interface SoporteInfo { id: number; nombre_original: string; tamano_bytes: number }

export interface PersonaIdoneidad {
  id: number;
  nombres_apellidos: string;
  tipo_documento: TipoDocumento;
  numero_documento: string;
  cargo: string | null;
  correo: string | null;
  telefono: string | null;
  soportes: SoporteInfo[];
}

/** Fila enviada al guardar la Pestaña 2. 'clave' enlaza la fila con sus archivos nuevos. */
export interface PersonaEnvio {
  id: number | null;
  clave: string;
  nombres_apellidos: string;
  tipo_documento: string;
  numero_documento: string;
  cargo: string;
  correo: string;
  telefono: string;
  soportes_conservar: number[];
}

export const listarIdoneidad = (registroId: number) =>
  request<PersonaIdoneidad[]>(`/registros/${registroId}/idoneidad`);

export function guardarIdoneidad(registroId: number, personas: PersonaEnvio[], archivos: Record<string, File[]>) {
  const fd = new FormData();
  fd.append("personas", JSON.stringify(personas));
  for (const [clave, lista] of Object.entries(archivos)) {
    for (const f of lista) fd.append(`archivos__${clave}`, f, f.name);
  }
  return request<PersonaIdoneidad[]>(`/registros/${registroId}/idoneidad`, { method: "PUT", body: fd });
}

export async function descargarSoporte(registroId: number, soporte: SoporteInfo): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API}/registros/${registroId}/idoneidad/soportes/${soporte.id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  } catch {
    throw new ApiError(0, `No se pudo conectar con el servidor (${API}).`);
  }
  if (res.status === 401) throw new ApiError(401, "UNAUTHORIZED");
  if (!res.ok) throw new ApiError(res.status, "No se pudo descargar el archivo");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = soporte.nombre_original;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Pestaña 3: Infraestructura Humana ----------
export interface ResponsableHumana {
  nombres_apellidos: string | null;
  tipo_documento: string | null;
  numero_documento: string | null;
  cargo: string | null;
  correo: string | null;
  telefono: string | null;
}

export interface ExperienciaHumana {
  id: number;
  empresa: string;
  cargo: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  cargo_actual: boolean;
  funciones: string | null;
  soportes: SoporteInfo[];
}

export interface HumanaDatos { responsable: ResponsableHumana; experiencias: ExperienciaHumana[] }

/** Experiencia enviada al guardar. 'clave' enlaza la fila con sus archivos nuevos. */
export interface ExperienciaEnvio {
  id: number | null;
  clave: string;
  empresa: string;
  cargo: string;
  fecha_inicio: string;
  fecha_fin: string;
  cargo_actual: boolean;
  funciones: string;
  soportes_conservar: number[];
}

export interface ResponsableEnvio {
  nombres_apellidos: string;
  tipo_documento: string;
  numero_documento: string;
  cargo: string;
  correo: string;
  telefono: string;
}

export const obtenerHumana = (registroId: number) =>
  request<HumanaDatos>(`/registros/${registroId}/infraestructura-humana`);

export function guardarHumana(
  registroId: number, responsable: ResponsableEnvio, experiencias: ExperienciaEnvio[], archivos: Record<string, File[]>,
) {
  const fd = new FormData();
  fd.append("datos", JSON.stringify({ responsable, experiencias }));
  for (const [clave, lista] of Object.entries(archivos)) {
    for (const f of lista) fd.append(`archivos__${clave}`, f, f.name);
  }
  return request<HumanaDatos>(`/registros/${registroId}/infraestructura-humana`, { method: "PUT", body: fd });
}

export async function descargarSoporteHumana(registroId: number, soporte: SoporteInfo): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API}/registros/${registroId}/infraestructura-humana/soportes/${soporte.id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  } catch {
    throw new ApiError(0, `No se pudo conectar con el servidor (${API}).`);
  }
  if (res.status === 401) throw new ApiError(401, "UNAUTHORIZED");
  if (!res.ok) throw new ApiError(res.status, "No se pudo descargar el archivo");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = soporte.nombre_original;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Requerimiento 5: Pestaña 4 Infraestructura Operativa ----------
export interface ItemTecnologia { nombre: string; descripcion: string | null }

export interface OperativaDatos {
  linea_1: string | null;
  linea_2: string | null;
  linea_3: string | null;
  fax: string | null;
  correo: string | null;
  direccion_atencion: string | null;
  software: ItemTecnologia[];
  equipos: ItemTecnologia[];
  soportes: SoporteInfo[];
}

export interface OperativaEnvio {
  linea_1: string;
  linea_2: string;
  linea_3: string;
  fax: string;
  correo: string;
  direccion_atencion: string;
  software: { nombre: string; descripcion: string }[];
  equipos: { nombre: string; descripcion: string }[];
  soportes_conservar: number[];
}

export const obtenerOperativa = (registroId: number) =>
  request<OperativaDatos>(`/registros/${registroId}/infraestructura-operativa`);

export function guardarOperativa(registroId: number, datos: OperativaEnvio, archivos: File[]) {
  const fd = new FormData();
  fd.append("datos", JSON.stringify(datos));
  for (const f of archivos) fd.append("archivos", f, f.name);
  return request<OperativaDatos>(`/registros/${registroId}/infraestructura-operativa`, { method: "PUT", body: fd });
}

export async function descargarSoporteOperativa(registroId: number, soporte: SoporteInfo): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API}/registros/${registroId}/infraestructura-operativa/soportes/${soporte.id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  } catch {
    throw new ApiError(0, `No se pudo conectar con el servidor (${API}).`);
  }
  if (res.status === 401) throw new ApiError(401, "UNAUTHORIZED");
  if (!res.ok) throw new ApiError(res.status, "No se pudo descargar el archivo");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = soporte.nombre_original;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Requerimiento 6: Pestaña 5 Firma Digitalizada ----------
export const MAX_FIRMA_BYTES = 2 * 1024 * 1024;

export interface FirmaDatos {
  nombres_apellidos: string | null;
  tipo_documento: string | null;
  numero_documento: string | null;
  firma: { nombre_original: string; tipo: string; tamano_bytes: number } | null;
}

export interface FirmaEnvio {
  nombres_apellidos: string;
  tipo_documento: string;
  numero_documento: string;
  quitar_firma: boolean;
}

export const obtenerFirma = (registroId: number) => request<FirmaDatos>(`/registros/${registroId}/firma`);

export function guardarFirma(registroId: number, datos: FirmaEnvio, archivo: File | null) {
  const fd = new FormData();
  fd.append("datos", JSON.stringify(datos));
  if (archivo) fd.append("firma", archivo, archivo.name);
  return request<FirmaDatos>(`/registros/${registroId}/firma`, { method: "PUT", body: fd });
}

/** Descarga la imagen guardada (requiere token) y devuelve una URL local para mostrarla. */
export async function urlImagenFirma(registroId: number): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API}/registros/${registroId}/firma/imagen`, { headers: { Authorization: `Bearer ${getToken()}` } });
  } catch {
    throw new ApiError(0, `No se pudo conectar con el servidor (${API}).`);
  }
  if (res.status === 401) throw new ApiError(401, "UNAUTHORIZED");
  if (!res.ok) throw new ApiError(res.status, "No se pudo cargar la firma");
  return URL.createObjectURL(await res.blob());
}

// ---------- Requerimiento 9: Usuarios y carga masiva (solo root Admin) ----------
export interface UsuarioListado {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  fecha_creacion: string;
  empresas: number;
  registros: number;
  procesos_asignados: number;
}

export interface FilaCarga { fila: number; correo: string; estado: "creado" | "omitido" | "error"; detalle: string }
export interface ResultadoCarga { total: number; creados: number; omitidos: number; con_error: number; filas: FilaCarga[] }

export const listarUsuarios = () => request<UsuarioListado[]>("/usuarios");

// Req 14B
export const cambiarRolUsuario = (id: number, rol: string) =>
  request<UsuarioListado>(`/usuarios/${id}/rol`, { method: "PATCH", body: JSON.stringify({ rol }) });
export const cambiarActivoUsuario = (id: number, activo: boolean) =>
  request<UsuarioListado>(`/usuarios/${id}/activo`, { method: "PATCH", body: JSON.stringify({ activo }) });

export function cargarUsuariosExcel(archivo: File) {
  const fd = new FormData();
  fd.append("archivo", archivo, archivo.name);
  return request<ResultadoCarga>("/usuarios/carga-masiva", { method: "POST", body: fd });
}

export async function descargarPlantillaUsuarios(): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API}/usuarios/plantilla`, { headers: { Authorization: `Bearer ${getToken()}` } });
  } catch {
    throw new ApiError(0, `No se pudo conectar con el servidor (${API}).`);
  }
  if (res.status === 401) throw new ApiError(401, "UNAUTHORIZED");
  if (!res.ok) throw new ApiError(res.status, "No se pudo descargar la plantilla");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla_usuarios.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Req 10: Empresas ----------
export interface EmpresaListItem {
  id: number; nombre: string; nit: string; ciudad: string | null; gerente: string | null;
  trabajadores_directos: number | null; fecha_creacion: string; fecha_actualizacion: string; propietario: string | null;
  estado_proceso: string | null; fecha_vencimiento: string | null;
}
/** Los números se envían como texto ("" = vacío) y el servidor los valida. */
export interface EmpresaEntrada {
  usuario_id: string; nombre: string; nit: string; direccion: string; telefono_fijo: string; celular: string;
  departamento_codigo: string; municipio_codigo: string; contacto_nombre: string; contacto_cargo: string;
  responsable_sgsst_nombre: string; responsable_sgsst_cargo: string; gerente: string; actividad_economica: string;
  trabajadores_directos: string; contratistas_independientes: string; estudiantes_decreto_055: string;
  tasa_cotizacion: string; arl_actual: string; tiempo_afiliacion_arl: string; valor_cotizacion_arl: string;
}
export type EmpresaDetalle = { id: number; propietario: string | null } & Record<keyof EmpresaEntrada, string | number | null>;

export const listarEmpresas = (estado?: string) =>
  request<EmpresaListItem[]>(`/empresas${estado ? `?estado=${encodeURIComponent(estado)}` : ""}`);
export const obtenerEmpresa = (id: number) => request<EmpresaDetalle>(`/empresas/${id}`);
export const crearEmpresa = (d: EmpresaEntrada) =>
  request<EmpresaDetalle>("/empresas", { method: "POST", body: JSON.stringify(d) });
export const actualizarEmpresa = (id: number, d: EmpresaEntrada) =>
  request<EmpresaDetalle>(`/empresas/${id}`, { method: "PUT", body: JSON.stringify(d) });
export const eliminarEmpresa = (id: number) => request<void>(`/empresas/${id}`, { method: "DELETE" });

// ---------- Req 11: Procesos de afiliación ----------
export type EstadoProceso = "Pendiente" | "En proceso" | "Vigente" | "Caducado";
export interface ProcesoListItem {
  id: number; empresa_id: number; empresa: string; nit: string; arl_destino: string | null; estado: EstadoProceso;
  fecha_inicio: string | null; fecha_vencimiento: string | null; fecha_actualizacion: string; propietario: string | null; empleado: string | null; empleado_activo: boolean | null;
}
export interface HistorialProceso {
  id: number; accion: string; estado: string; fecha_inicio: string | null; periodo: string | null;
  fecha_vencimiento: string | null; observacion: string | null; usuario: string | null; fecha: string;
}
export interface ProcesoDetalle extends ProcesoListItem {
  numero_afiliacion: string | null; periodo: string | null; observacion: string | null; fecha_creacion: string;
  empleado_id: number | null; puede_asignar: boolean;
  puede_editar_datos: boolean; puede_cambiar_estado: boolean; historial: HistorialProceso[];
}
export interface ProcesoEntrada { empresa_id: string; empleado_id?: string; arl_destino: string; numero_afiliacion: string }
export interface CambioEstadoEntrada {
  estado: "En proceso" | "Vigente"; fecha_inicio: string; periodo: string; observacion: string;
}

export const listarProcesos = (empresaId?: number) =>
  request<ProcesoListItem[]>(`/procesos${empresaId ? `?empresa_id=${empresaId}` : ""}`);
export const obtenerProceso = (id: number) => request<ProcesoDetalle>(`/procesos/${id}`);
export const crearProceso = (d: ProcesoEntrada) =>
  request<ProcesoDetalle>("/procesos", { method: "POST", body: JSON.stringify(d) });
export const actualizarProceso = (id: number, d: ProcesoEntrada) =>
  request<ProcesoDetalle>(`/procesos/${id}`, { method: "PUT", body: JSON.stringify(d) });
export const cambiarEstadoProceso = (id: number, d: CambioEstadoEntrada) =>
  request<ProcesoDetalle>(`/procesos/${id}/estado`, { method: "POST", body: JSON.stringify(d) });
export const asignarProceso = (id: number, empleadoId: string) =>
  request<ProcesoDetalle>(`/procesos/${id}/asignacion`, { method: "PUT", body: JSON.stringify({ empleado_id: empleadoId }) });

// ---------- Req 12: Diagnóstico ----------
export const PREGUNTAS_SGSST: [string, string][] = [
  ["panorama_riesgos", "¿Tiene panorama de riesgos actualizado?"],
  ["copasst", "¿Tiene COPASST o vigía de SST?"],
  ["comite_convivencia", "¿Tiene Comité de Convivencia?"],
  ["reglamento_hs", "¿Tiene reglamento de Higiene y Seguridad actualizado y publicado?"],
  ["plan_trabajo", "¿Cuenta con un plan de trabajo para la gestión de sus riesgos?"],
  ["plan_emergencias", "¿Cuenta con un plan de emergencias activo?"],
  ["brigada_emergencias", "¿Cuenta con brigada de emergencias conformada y capacitada?"],
  ["patrocina_eventos", "¿La empresa patrocina eventos deportivos, recreativos o culturales a sus empleados?"],
  ["viajes_exterior", "¿Tiene trabajadores que se desplacen por razones de trabajo fuera del país?"],
];
export const FACTORES_RIESGO: [string, string][] = [
  ["fisicos", "Físicos"], ["quimicos", "Químicos"], ["psicolaborales", "Psicolaborales"], ["ergonomicos", "Ergonómicos"],
  ["mecanicos", "Mecánicos"], ["electricos", "Eléctricos"], ["locativos", "Locativos"],
  ["incendio_explosion", "Incendio y explosión"], ["otros", "Otros (¿cuáles?)"],
];
export const DATOS_GENERALES: [string, string][] = [
  ["nombre_empresa", "Nombre de la empresa"], ["nit", "NIT de la empresa"], ["direccion", "Dirección principal"],
  ["telefono_fijo", "Teléfono fijo"], ["celular", "Celular"], ["ciudad", "Ciudad / Municipio principal"],
  ["contacto_nombre", "Persona que suministra la información"], ["contacto_cargo", "Cargo"],
  ["responsable_sgsst_nombre", "Responsable de SG-SST"], ["responsable_sgsst_cargo", "Cargo del responsable de SG-SST"],
  ["gerente", "Nombre del gerente"], ["actividad_economica", "Actividad económica principal"],
  ["trabajadores_directos", "Número de trabajadores directos"], ["contratistas_independientes", "Contratistas independientes"],
  ["estudiantes_decreto_055", "Estudiantes según Decreto 055/2015"], ["tasa_cotizacion", "Tasa de cotización (clase de riesgo)"],
  ["arl_actual", "ARL actual"], ["tiempo_afiliacion_arl", "Tiempo de afiliación a la ARL actual"],
  ["valor_cotizacion_arl", "Valor de la cotización a la ARL actual"],
];

export type DatosGeneralesDx = Record<string, string | null>;
export interface OpcionIntermediario { id: number; rui: string; nit: string; razon_social: string | null; estado: string }
export interface PrecargaDx { empresa_id: number; empresa: string; datos_generales: DatosGeneralesDx; intermediarios: OpcionIntermediario[] }
export interface BloqueDx { nivel: string | null; resumen: string; hallazgos: string[] }
export interface ResultadoDx {
  sgsst: BloqueDx; sgsst_puntos: number; sgsst_total: number; accidentalidad: BloqueDx; enfermedad_laboral: BloqueDx;
  factores_riesgo: BloqueDx; factores_existentes: string[];
}
export interface DiagnosticoListItem {
  id: number; empresa_id: number; empresa: string; nit: string; fecha_diagnostico: string; creado_por: string | null;
  fecha_actualizacion: string; sgsst_puntos: number; nivel_accidentalidad: string; nivel_enfermedad_laboral: string;
}
/** Cuerpo que se envía/recibe (los números van como número; vacíos no se envían). */
export interface DiagnosticoCuerpo {
  empresa_id?: number | null; registro_id: number | null; fecha_diagnostico: string; datos_generales: DatosGeneralesDx;
  viajes_detalle: string | null; at_cantidad: number | null; at_dias_incapacidad: number | null; at_causas: string | null;
  at_mortales_invalidos: number | null; el_calificadas: number | null; el_causas: string | null;
  el_en_calificacion: number | null; programas_vigilancia: boolean | null;
  factores_riesgo: Record<string, { existe: boolean; descripcion: string | null }>;
  expectativas: string | null; observaciones: string | null;
  [pregunta: string]: unknown;
}
export type DiagnosticoDetalle = DiagnosticoCuerpo & {
  id: number; empresa_id: number; empresa: string; creado_por: string | null; intermediario_nombre: string | null;
  intermediario_rui: string | null; intermediario_nit: string | null; resultado: ResultadoDx;
};

export const listarDiagnosticos = (empresaId?: number) =>
  request<DiagnosticoListItem[]>(`/diagnosticos${empresaId ? `?empresa_id=${empresaId}` : ""}`);
export const precargaDiagnostico = (empresaId: number) => request<PrecargaDx>(`/diagnosticos/precarga?empresa_id=${empresaId}`);
export const obtenerDiagnostico = (id: number) => request<DiagnosticoDetalle>(`/diagnosticos/${id}`);
export const crearDiagnostico = (d: DiagnosticoCuerpo) =>
  request<DiagnosticoDetalle>("/diagnosticos", { method: "POST", body: JSON.stringify(d) });
export const actualizarDiagnostico = (id: number, d: DiagnosticoCuerpo) =>
  request<DiagnosticoDetalle>(`/diagnosticos/${id}`, { method: "PUT", body: JSON.stringify(d) });
export async function descargarDiagnosticoPdf(id: number): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API}/diagnosticos/${id}/pdf`, { headers: { Authorization: `Bearer ${getToken()}` } });
  } catch {
    throw new ApiError(0, `No se pudo conectar con el servidor (${API}).`);
  }
  if (res.status === 401) throw new ApiError(401, "UNAUTHORIZED");
  if (!res.ok) throw new ApiError(res.status, "No se pudo generar el PDF");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url; a.download = `diagnostico_${id}.pdf`; a.click();
  URL.revokeObjectURL(url);
}

// ---------- Req 13: Dashboard (solo root) ----------
export interface MetricasDashboard {
  total: number; en_curso: number; vigente: number; caducado: number; sin_proceso: number; por_vencer: number;
  por_vencer_dias: number;
}
export const obtenerDashboard = () => request<MetricasDashboard>("/dashboard");

// ---------- Req 14A: Documentos por empresa / proceso (con versiones) ----------
export const MAX_DOCUMENTO_BYTES = 5 * 1024 * 1024;
export interface VersionDocumento { version: number; nombre_original: string; tamano_bytes: number; content_type: string; subido_por: string | null; fecha: string }
export interface Documento {
  id: number; tipo: string | null; titulo: string | null; seccion: string | null; descripcion: string | null; version_actual: number; nombre_original: string;
  tamano_bytes: number; content_type: string; subido_por: string | null; fecha: string; fecha_creacion: string;
  versiones: VersionDocumento[]; puede_eliminar: boolean;
}
export type ObjetivoDocumento = "empresas" | "procesos";

export const tiposDocumento = () => request<string[]>("/documentos/tipos");
// Req 15: con `seccion` los documentos son los de esa sección del menú (solo empresas) y llevan título en vez de tipo.
const rutaDocumentos = (objetivo: ObjetivoDocumento, id: number, seccion?: string) =>
  seccion ? `/empresas/${id}/secciones/${seccion}/documentos` : `/${objetivo}/${id}/documentos`;
export const listarDocumentos = (objetivo: ObjetivoDocumento, id: number, seccion?: string) =>
  request<Documento[]>(rutaDocumentos(objetivo, id, seccion));
export function subirDocumento(objetivo: ObjetivoDocumento, id: number, tipo: string, descripcion: string, archivo: File | null,
  seccion?: string, titulo?: string) {
  const fd = new FormData();
  if (seccion) fd.append("titulo", titulo ?? ""); else fd.append("tipo", tipo);
  fd.append("descripcion", descripcion);
  if (archivo) fd.append("archivo", archivo);
  return request<Documento>(rutaDocumentos(objetivo, id, seccion), { method: "POST", body: fd });
}

// Req 15: estructura del menú lateral (SG-SST y RUI guardan documentos por empresa)
export const SECCIONES: Record<string, string> = {
  rui: "RUI",
  medicina_laboral: "Medicina Laboral",
  higiene_seguridad: "Higiene y Seguridad Industrial",
  riesgo_psicosocial: "Riesgo Psicosocial",
  trabajo_alturas: "Trabajo en Alturas",
  trabajo_seguro: "Trabajo Seguro",
  inspecciones: "Inspecciones",
  pesv: "PESV (Plan de Seguridad Vial)",
  politicas: "Políticas",
  matriz_peligros: "Matriz de identificación de peligros y valoración de riesgos",
  matriz_legal: "Matriz legal",
};
export const MENU_SGSST: { grupo: string; items: string[] }[] = [
  { grupo: "Programas", items: ["medicina_laboral", "higiene_seguridad", "riesgo_psicosocial", "trabajo_alturas", "trabajo_seguro", "inspecciones"] },
  { grupo: "Planes", items: ["pesv"] },
  { grupo: "Políticas", items: ["politicas"] },
  { grupo: "Matrices", items: ["matriz_peligros", "matriz_legal"] },
];
export function reemplazarDocumento(documentoId: number, archivo: File) {
  const fd = new FormData();
  fd.append("archivo", archivo);
  return request<Documento>(`/documentos/${documentoId}/versiones`, { method: "POST", body: fd });
}
export const eliminarDocumento = (documentoId: number) => request<void>(`/documentos/${documentoId}`, { method: "DELETE" });
export async function descargarDocumento(documentoId: number, version: VersionDocumento): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API}/documentos/${documentoId}/versiones/${version.version}/descargar`, { headers: { Authorization: `Bearer ${getToken()}` } });
  } catch {
    throw new ApiError(0, `No se pudo conectar con el servidor (${API}).`);
  }
  if (res.status === 401) throw new ApiError(401, "UNAUTHORIZED");
  if (!res.ok) throw new ApiError(res.status, "No se pudo descargar el documento");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url; a.download = version.nombre_original; a.click();
  URL.revokeObjectURL(url);
}
