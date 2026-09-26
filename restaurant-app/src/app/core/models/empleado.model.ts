export type Puesto =
  'dueño' |
  'supervisor' |
  'mozo' |
  'metre' |
  'cocinero' |
  'cantinero';

export type EstadoEmpleado = 'On' | 'Off';

export type Sexo = 'masculino' | 'femenino' | 'otros';

/** Puestos que pueden acceder a /administracion */
export const PUESTOS_ADMIN: readonly Puesto[] = [
  'dueño',
  'supervisor'
];

/** Los 6 puestos posibles, en el orden que se muestran cuando loguea un "dueño" */
export const PUESTOS_TODOS: readonly Puesto[] = [
  'dueño',
  'supervisor',
  'mozo',
  'metre',
  'cocinero',
  'cantinero',
];

/** Puestos que puede crear un "supervisor" (no puede crear dueño ni supervisor) */
export const PUESTOS_CREABLES_POR_SUPERVISOR: readonly Puesto[] = [
  'mozo',
  'metre',
  'cocinero',
  'cantinero',
];

export const PUESTOS_VISTA_MESA: readonly Puesto[] = ['dueño', 'supervisor', 'metre', 'mozo'];

/** Fila cruda de la tabla "empleados" en Supabase */
export interface EmpleadoRow {
  /** ID interno del empleado. Es INT autoincremental en Supabase. */
  id: number;

  /** UUID del usuario correspondiente en Supabase Auth. */
  auth_user_id: string;

  estado: EstadoEmpleado;
  nombre: string;
  apellido: string;
  cuil: string;
  sexo: Sexo | null;
  fecha_nacimiento: string | null;
  email: string;
  puesto: Puesto;

  /**
   * Nombre del archivo de foto almacenado en Supabase Storage.
   * Ejemplo: "20-35371754-6.jpg"
   */
  foto: string | null;
}

/** Datos del empleado autenticado disponibles durante la sesión */
export interface EmpleadoSesion {
  /** ID interno del empleado en la tabla empleados. */
  id: number;

  nombre: string;
  apellido: string;
  email: string;
  puesto: Puesto;
  estado: EstadoEmpleado;

  /**
   * URL pública de la foto en Supabase Storage.
   * Ejemplo:
   * https://...supabase.co/storage/v1/object/public/empleados/20-35371754-6.jpg
   */
  foto: string | null;
}

/** Payload para dar de alta un empleado nuevo (sin id ni auth_user_id) */
export type NuevoEmpleado = Omit<
  EmpleadoRow,
  'id' | 'auth_user_id'
>;

/** Datos que se pueden extraer del código del DNI argentino (PDF417) */
export interface DniQrData {
  apellido?: string;
  nombre?: string;
  sexo?: Sexo;
  dni?: string;

  /** CUIL sugerido, calculado a partir del DNI. Debe revisarse antes de guardar. */
  cuilSugerido?: string;

  /** Fecha convertida a formato ISO: YYYY-MM-DD */
  fechaNacimiento?: string;

  fechaEmision?: string;
  tramite?: string;
}
