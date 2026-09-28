import { Signal, computed, inject } from '@angular/core';
import { EtapaClienteService } from '../services/etapa-cliente.service';
import { ClientesPendientesService } from '../services/clientes-pendientes.service';
import { ListaEsperaService } from '../services/lista-espera.service';
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

export const PESTANAS_COCINA: Pestana[] = [
  { ruta: 'ahora', etiqueta: 'Ahora', icono: 'flash-outline' },
  { ruta: 'platos', etiqueta: 'Platos', icono: 'restaurant-outline' },
];

export const PESTANAS_CANTINA: Pestana[] = [
  { ruta: 'ahora', etiqueta: 'Ahora', icono: 'flash-outline' },
  { ruta: 'bebidas', etiqueta: 'Bebidas', icono: 'wine-outline' },
];

export const PESTANAS_METRE: Pestana[] = [
  {
    ruta: 'lista-espera',
    etiqueta: 'Lista de espera',
    icono: 'people-outline',
    contador: () => {
      const listaEspera = inject(ListaEsperaService);
      listaEspera.iniciar();
      return listaEspera.enEspera;
    },
    tonoContador: 'espera',
  },
  { ruta: 'registrar-cliente', etiqueta: 'Registrar cliente', icono: 'person-add-outline' },
];

export const PESTANAS_ADMIN: Pestana[] = [
  {
    ruta: 'ahora',
    etiqueta: 'Ahora',
    icono: 'flash-outline',
    contador: () => {
      const pendientes = inject(ClientesPendientesService);
      pendientes.iniciar();
      return pendientes.cantidad;
    },
    tonoContador: 'espera',
  },
  { ruta: 'personal', etiqueta: 'Personal', icono: 'id-card-outline' },
  { ruta: 'salon', etiqueta: 'Salón', icono: 'restaurant-outline' },
  { ruta: 'estadisticas', etiqueta: 'Estadísticas', icono: 'stats-chart-outline' },
];

export function pestanasCliente(): Signal<Pestana[]> {
  const etapaCliente = inject(EtapaClienteService);
  void etapaCliente.iniciar();
  return computed(() => {
    const menu: Pestana = { ruta: 'menu', etiqueta: 'Menú', icono: 'book-outline' };
    if (!etapaCliente.enEstadia()) {
      return [{ ruta: 'inicio', etiqueta: 'Inicio', icono: 'home-outline' }, menu];
    }
    return [
      { ruta: 'inicio', etiqueta: 'Mi mesa', icono: 'restaurant-outline' },
      menu,
      { ruta: 'consultas', etiqueta: 'Consultas', icono: 'chatbubbles-outline' },
      { ruta: 'juegos', etiqueta: 'Juegos', icono: 'game-controller-outline' },
    ];
  });
}
