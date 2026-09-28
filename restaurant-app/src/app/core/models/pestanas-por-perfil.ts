import { Signal, inject } from '@angular/core';
import { ResumenMozoService } from '../services/resumen-mozo.service';

export interface Pestana {
  ruta: string;
  etiqueta: string;
  /** Variante -outline; la activa usa la rellena. */
  icono: string;
  /** Fábrica que se ejecuta en el contexto de inyección de la barra. */
  contador?: () => Signal<number>;
  tonoContador?: 'espera' | 'rechazo';
}

function cifraMozo(cifra: 'porConfirmar' | 'consultasSinResponder'): () => Signal<number> {
  return () => {
    const resumen = inject(ResumenMozoService);
    void resumen.iniciar();
    return resumen[cifra];
  };
}

export const PESTANAS_MOZO: Pestana[] = [
  { ruta: 'ahora', etiqueta: 'Ahora', icono: 'flash-outline' },
  { ruta: 'pedidos', etiqueta: 'Pedidos', icono: 'receipt-outline', contador: cifraMozo('porConfirmar'), tonoContador: 'espera' },
  { ruta: 'consultas', etiqueta: 'Consultas', icono: 'chatbubbles-outline', contador: cifraMozo('consultasSinResponder'), tonoContador: 'espera' },
  { ruta: 'mesas', etiqueta: 'Mesas', icono: 'restaurant-outline' },
];
