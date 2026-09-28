import { Signal } from '@angular/core';

export interface Pestana {
  ruta: string;
  etiqueta: string;
  /** Variante -outline; la activa usa la rellena. */
  icono: string;
  /** Fábrica que se ejecuta en el contexto de inyección de la barra. */
  contador?: () => Signal<number>;
  tonoContador?: 'espera' | 'rechazo';
}

export const PESTANAS_MOZO: Pestana[] = [
  { ruta: 'ahora', etiqueta: 'Ahora', icono: 'flash-outline' },
  { ruta: 'pedidos', etiqueta: 'Pedidos', icono: 'receipt-outline' },
  { ruta: 'consultas', etiqueta: 'Consultas', icono: 'chatbubbles-outline' },
];
