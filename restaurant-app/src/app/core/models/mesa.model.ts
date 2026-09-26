export type TipoMesa = 'VIP' | 'Estándar' | 'Movilidad reducida';
export type DisponibilidadMesa = 'Libre' | 'Ocupada';

export interface MesaRow {
  id: string;
  numero_mesa: number;
  cant_comensales: number;
  tipo: TipoMesa;
  disponibilidad: DisponibilidadMesa;
  /** Solo el NOMBRE del archivo en el bucket "mesas" (no la URL completa) */
  foto: string | null;
  /** Solo el NOMBRE del archivo en el bucket "qr_mesa" (no la URL completa) */
  qr: string | null;
}

export type NuevaMesa = Omit<MesaRow, 'id' | 'disponibilidad'>;

export const TIPOS_MESA: readonly { valor: TipoMesa; etiqueta: string }[] = [
  { valor: 'VIP', etiqueta: 'VIP' },
  { valor: 'Estándar', etiqueta: 'Estándar' },
  { valor: 'Movilidad reducida', etiqueta: 'Movilidad reducida' },
];

export function etiquetaTipo(tipo: TipoMesa): string {
  return TIPOS_MESA.find((t) => t.valor === tipo)?.etiqueta ?? tipo;
}
