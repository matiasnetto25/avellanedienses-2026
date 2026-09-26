import { TipoMesa, DisponibilidadMesa } from './mesa.model';

export type EstadoSolicitudMesa = 'en_espera' | 'aceptado' | 'rechazado' | 'vinculado';

export interface MiSolicitud {
  id: string;
  estado: EstadoSolicitudMesa;
  mesa_id: string;
  numero_mesa: number;
  tipo: TipoMesa;
  cant_comensales: number;
  foto: string | null;
}

export interface FilaListaEspera {
  id: string;
  cliente_id: string;
  nombre: string;
  apellido: string | null;
  foto: string;
  mesa_id: string;
  numero_mesa: number;
  tipo: TipoMesa;
  cant_comensales: number;
  /** Estado ACTUAL de la mesa (no de la solicitud) — puede seguir
   *  ocupada aunque la solicitud siga en_espera; el metre la ve para
   *  saber si puede aceptar en este momento o no. */
  disponibilidad: DisponibilidadMesa;
  created_at: string;
}