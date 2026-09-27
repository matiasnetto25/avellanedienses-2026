/**
 * Nombres de los buckets de Supabase Storage. Único lugar donde están
 * escritos: si un bucket cambia de nombre, se cambia acá.
 *
 * Las fotos del cliente anónimo y del registrado van al MISMO bucket.
 */
export const BUCKETS = {
  clientes: 'cliente',
  empleados: 'empleado',
  mesas: 'mesas',
  qrMesas: 'qr_mesa',
  menu: 'menu',
} as const;

export type Bucket = (typeof BUCKETS)[keyof typeof BUCKETS];
