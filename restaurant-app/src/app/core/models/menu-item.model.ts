export type TipoMenuItem = 'comida' | 'postre' | 'bebida';
export type EstadoMenuItem = 'On' | 'Off';

export interface MenuItemRow {
  id: string;
  estado: EstadoMenuItem;
  tipo: TipoMenuItem;
  nombre: string;
  descripcion: string | null;
  demora: number | null;
  precio: number;
  /** Paths dentro del bucket "menu", ej: "<id>/principal.jpg" */
  foto_principal: string | null;
  foto_cerca: string | null;
  foto_contexto: string | null;
}

export type NuevoMenuItem = Omit<MenuItemRow, 'id' | 'estado'>;

export const TIPOS_COCINERO: readonly { valor: TipoMenuItem; etiqueta: string }[] = [
  { valor: 'comida', etiqueta: 'Comida' },
  { valor: 'postre', etiqueta: 'Postre' },
];